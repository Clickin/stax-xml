import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, statSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance, PerformanceObserver, constants as perfConstants } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { EventReaderSync } from '../stax-xml/src/EventReaderSync.ts';
import {
  StringCurrentCursorSync,
  type StringCurrentCursorMaterializationPolicy,
} from '../stax-xml/src/StringCurrentCursorSync.ts';
import { XmlEventType } from '../stax-xml/src/types.ts';

type CaseId =
  | 'public-event-reader-sync-js'
  | 'legacy-string-baseline'
  | 'string-current-cursor-none'
  | 'string-current-cursor-current-event'
  | 'string-current-cursor-eager-touch';

const defaultSizesMiB = [16, 128];
const cases: CaseId[] = [
  'public-event-reader-sync-js',
  'legacy-string-baseline',
  'string-current-cursor-none',
  'string-current-cursor-current-event',
  'string-current-cursor-eager-touch',
];

const args = parseArgs(process.argv.slice(2));

function runChildCase(caseId: CaseId, sizeMiB: number) {
  const child = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      fileURLToPath(import.meta.url),
      '--child-case',
      caseId,
      '--child-size-mib',
      String(sizeMiB),
      '--warmups',
      String(args.warmups),
      '--runs',
      String(args.runs),
    ],
    {
      cwd: fileURLToPath(new URL('../..', import.meta.url)),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      maxBuffer: 1024 * 1024,
    },
  );
  if (child.status !== 0) {
    throw new Error(`Child case failed: ${caseId}`);
  }
  return JSON.parse(child.stdout);
}

function measureCase(caseId: CaseId, xml: string, bytes: number, warmups: number, runs: number) {
  const peak = { heapPeakBytes: 0, rssPeakBytes: 0 };
  const gc = createGcTracker();
  const updatePeak = () => {
    const current = process.memoryUsage();
    peak.heapPeakBytes = Math.max(peak.heapPeakBytes, current.heapUsed);
    peak.rssPeakBytes = Math.max(peak.rssPeakBytes, current.rss);
  };

  let reference: { events: number; checksum: number } | undefined;
  const samples: number[] = [];

  for (let index = 0; index < warmups + runs; index++) {
    if (globalThis.gc) globalThis.gc();
    updatePeak();
    gc.start();
    const startedAt = performance.now();
    const result = consumeCase(caseId, xml, updatePeak);
    const elapsedMs = performance.now() - startedAt;
    gc.stop();
    updatePeak();

    if (!reference) {
      reference = result;
    } else if (reference.events !== result.events || reference.checksum !== result.checksum) {
      throw new Error(`Unstable output for ${caseId}`);
    }

    if (index >= warmups) {
      samples.push(elapsedMs);
    }
  }
  gc.disconnect();

  const elapsedMs = average(samples);
  return {
    caseId,
    elapsedMs,
    throughputMiBs: bytes / 1024 / 1024 / (elapsedMs / 1000),
    heapPeakBytes: peak.heapPeakBytes,
    rssPeakBytes: peak.rssPeakBytes,
    events: reference?.events ?? 0,
    checksum: reference?.checksum ?? 0,
    gc: {
      totalMs: gc.totalMs,
      majorMs: gc.majorMs,
      minorMs: gc.minorMs,
      incrementalMs: gc.incrementalMs,
      count: gc.count,
      sharePct: elapsedMs === 0 ? 0 : (gc.totalMs / elapsedMs) * 100,
    },
  };
}

function consumeCase(caseId: CaseId, xml: string, updatePeak: () => void) {
  switch (caseId) {
    case 'public-event-reader-sync-js':
      return consumePublicEventReaderSyncJs(xml, updatePeak);
    case 'legacy-string-baseline':
      return consumeLegacyStringBaseline(xml, updatePeak);
    case 'string-current-cursor-none':
      return consumeStringCurrentCursor(xml, 'none', updatePeak);
    case 'string-current-cursor-current-event':
      return consumeStringCurrentCursor(xml, 'current-event', updatePeak);
    case 'string-current-cursor-eager-touch':
      return consumeStringCurrentCursor(xml, 'eager-touch', updatePeak);
  }
}

function consumePublicEventReaderSyncJs(xml: string, updatePeak: () => void) {
  const parser = new EventReaderSync(xml, { namespaceAware: false, autoDecodeEntities: false });
  let events = 0;
  let checksum = 2166136261 >>> 0;
  for (const event of parser) {
    events++;
    checksum = mixChecksum(checksum, mapXmlEventType(event.type));
    if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
      checksum = foldString(checksum, event.name);
    }
    if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
      checksum = foldString(checksum, event.value?.trim());
    }
    const attrs = event.type === XmlEventType.START_ELEMENT ? Object.entries(event.attributes ?? {}) : [];
    checksum = mixChecksum(checksum, attrs.length);
    for (const [name, value] of attrs) {
      checksum = foldString(checksum, name);
      checksum = foldString(checksum, value);
    }
    if (events % 50_000 === 0) updatePeak();
  }
  return { events, checksum };
}

function consumeLegacyStringBaseline(xml: string, updatePeak: () => void) {
  const parser = new LegacyStringParserBaseline(xml);
  let events = 0;
  let checksum = 2166136261 >>> 0;
  for (;;) {
    const result = parser.next();
    if (result.done) break;
    const event = result.value!;
    events++;
    checksum = mixChecksum(checksum, event.type);
    if (event.type === 2 || event.type === 3) {
      checksum = foldString(checksum, event.name);
    }
    if (event.type === 4 || event.type === 5) {
      checksum = foldString(checksum, event.text?.trim());
    }
    const attrCount = event.type === 2 ? event.attributes.length : 0;
    checksum = mixChecksum(checksum, attrCount);
    for (let index = 0; index < attrCount; index++) {
      const attribute = event.attributes[index]!;
      checksum = foldString(checksum, attribute.name);
      checksum = foldString(checksum, attribute.value);
    }
    if (events % 50_000 === 0) updatePeak();
  }
  return { events, checksum };
}

function consumeStringCurrentCursor(
  xml: string,
  materialization: StringCurrentCursorMaterializationPolicy,
  updatePeak: () => void,
) {
  const cursor = new StringCurrentCursorSync(xml, { materialization });
  let events = 0;
  let checksum = 2166136261 >>> 0;
  while (cursor.next()) {
    const type = cursor.eventType();
    events++;
    checksum = mixChecksum(checksum, type);
    if (type === 2 || type === 3) {
      checksum = foldString(checksum, cursor.name());
    }
    if (type === 4 || type === 5) {
      checksum = foldString(checksum, cursor.text()?.trim());
    }
    const attrCount = type === 2 ? cursor.getAttributeCount() : 0;
    checksum = mixChecksum(checksum, attrCount);
    for (let index = 0; index < attrCount; index++) {
      checksum = foldString(checksum, cursor.getAttributeName(index));
      checksum = foldString(checksum, cursor.getAttributeValue(index));
    }
    if (events % 50_000 === 0) updatePeak();
  }
  return { events, checksum };
}

type LegacyAttribute = { name: string; value: string };
type LegacyEvent = {
  type: number;
  name?: string;
  text?: string;
  attributes: LegacyAttribute[];
};

class LegacyStringParserBaseline implements Iterator<LegacyEvent>, Iterable<LegacyEvent> {
  private pos = 0;
  private state = 0;
  private pendingEndName: string | undefined;
  private readonly iteratorResult: IteratorResult<LegacyEvent> = { value: undefined as never, done: false };
  private readonly doneResult: IteratorResult<LegacyEvent> = { value: undefined, done: true };

  constructor(private readonly xml: string) {}

  [Symbol.iterator](): Iterator<LegacyEvent> {
    return this;
  }

  next(): IteratorResult<LegacyEvent> {
    if (this.pendingEndName) {
      this.iteratorResult.value = { type: 3, name: this.pendingEndName, attributes: [] };
      this.pendingEndName = undefined;
      return this.iteratorResult;
    }

    if (this.state === 0) {
      this.state = 1;
      this.iteratorResult.value = { type: 0, attributes: [] };
      return this.iteratorResult;
    }
    if (this.state === 2) {
      return this.doneResult;
    }

    while (this.pos < this.xml.length) {
      const lt = this.xml.indexOf('<', this.pos);
      if (lt === -1) {
        if (this.pos < this.xml.length) {
          const text = this.xml.slice(this.pos, this.xml.length);
          this.pos = this.xml.length;
          if (text.length > 0) {
            this.iteratorResult.value = { type: 4, text, attributes: [] };
            return this.iteratorResult;
          }
        }
        this.state = 2;
        this.iteratorResult.value = { type: 1, attributes: [] };
        return this.iteratorResult;
      }

      if (lt > this.pos) {
        const text = this.xml.slice(this.pos, lt);
        this.pos = lt;
        if (text.length > 0) {
          this.iteratorResult.value = { type: 4, text, attributes: [] };
          return this.iteratorResult;
        }
      }

      if (this.xml.startsWith('<!--', lt)) {
        const end = this.xml.indexOf('-->', lt + 4);
        this.pos = end === -1 ? this.xml.length : end + 3;
        continue;
      }
      if (this.xml.startsWith('<?', lt)) {
        const end = this.xml.indexOf('?>', lt + 2);
        this.pos = end === -1 ? this.xml.length : end + 2;
        continue;
      }
      if (this.xml.startsWith('<![CDATA[', lt)) {
        const end = this.xml.indexOf(']]>', lt + 9);
        const textEnd = end === -1 ? this.xml.length : end;
        this.pos = end === -1 ? this.xml.length : end + 3;
        this.iteratorResult.value = {
          type: 5,
          text: this.xml.slice(lt + 9, textEnd),
          attributes: [],
        };
        return this.iteratorResult;
      }
      if (this.xml.startsWith('</', lt)) {
        const gt = this.xml.indexOf('>', lt + 2);
        const name = this.xml.slice(lt + 2, gt).trim();
        this.pos = gt + 1;
        this.iteratorResult.value = { type: 3, name, attributes: [] };
        return this.iteratorResult;
      }

      const gt = findTagEnd(this.xml, lt + 1);
      const selfClosing = this.xml.charCodeAt(gt - 1) === 47;
      const actualEnd = selfClosing ? gt - 1 : gt;
      let cursor = lt + 1;
      while (cursor < actualEnd && isWhitespace(this.xml.charCodeAt(cursor))) cursor++;
      const nameStart = cursor;
      while (cursor < actualEnd) {
        const code = this.xml.charCodeAt(cursor);
        if (isWhitespace(code) || code === 47 || code === 62) break;
        cursor++;
      }
      const name = this.xml.slice(nameStart, cursor);
      const attributes = parseAttributes(this.xml, cursor, actualEnd);
      this.pos = gt + 1;
      if (selfClosing) {
        this.pendingEndName = name;
      }
      this.iteratorResult.value = { type: 2, name, attributes };
      return this.iteratorResult;
    }

    this.state = 2;
    this.iteratorResult.value = { type: 1, attributes: [] };
    return this.iteratorResult;
  }
}

function parseAttributes(
  xml: string,
  start: number,
  end: number,
) {
  const attributes: LegacyAttribute[] = [];
  let cursor = start;
  while (cursor < end) {
    while (cursor < end && isWhitespace(xml.charCodeAt(cursor))) cursor++;
    if (cursor >= end) break;
    const nameStart = cursor;
    while (cursor < end) {
      const code = xml.charCodeAt(cursor);
      if (isWhitespace(code) || code === 61) break;
      cursor++;
    }
    const name = xml.slice(nameStart, cursor);
    while (cursor < end && isWhitespace(xml.charCodeAt(cursor))) cursor++;
    if (cursor >= end || xml.charCodeAt(cursor) !== 61) {
      attributes.push({ name, value: 'true' });
      continue;
    }
    cursor++;
    while (cursor < end && isWhitespace(xml.charCodeAt(cursor))) cursor++;
    const quote = xml.charCodeAt(cursor);
    cursor++;
    const valueStart = cursor;
    while (cursor < end && xml.charCodeAt(cursor) !== quote) cursor++;
    const value = xml.slice(valueStart, cursor);
    cursor++;
    attributes.push({ name, value });
  }
  return attributes;
}

function findTagEnd(xml: string, start: number) {
  let inQuote = false;
  let quote = 0;
  for (let index = start; index < xml.length; index++) {
    const code = xml.charCodeAt(index);
    if (code === 34 || code === 39) {
      if (!inQuote) {
        inQuote = true;
        quote = code;
      } else if (quote === code) {
        inQuote = false;
      }
    } else if (code === 62 && !inQuote) {
      return index;
    }
  }
  return xml.length - 1;
}

function isWhitespace(code: number) {
  return code === 32 || code === 9 || code === 10 || code === 13;
}

function mapXmlEventType(type: XmlEventType) {
  switch (type) {
    case XmlEventType.START_DOCUMENT:
      return 0;
    case XmlEventType.END_DOCUMENT:
      return 1;
    case XmlEventType.START_ELEMENT:
      return 2;
    case XmlEventType.END_ELEMENT:
      return 3;
    case XmlEventType.CHARACTERS:
      return 4;
    case XmlEventType.CDATA:
      return 5;
    default:
      return 31;
  }
}

function createGcTracker() {
  const stats = {
    totalMs: 0,
    majorMs: 0,
    minorMs: 0,
    incrementalMs: 0,
    count: 0,
  };
  let enabled = false;
  const observer = new PerformanceObserver((list) => {
    if (!enabled) return;
    for (const entry of list.getEntries()) {
      const gcEntry = entry as PerformanceEntry & { kind?: number; detail?: { kind?: number } };
      const kind = gcEntry.detail?.kind ?? gcEntry.kind ?? 0;
      stats.totalMs += entry.duration;
      stats.count += 1;
      if (kind === perfConstants.NODE_PERFORMANCE_GC_MAJOR) stats.majorMs += entry.duration;
      if (kind === perfConstants.NODE_PERFORMANCE_GC_MINOR) stats.minorMs += entry.duration;
      if (kind === perfConstants.NODE_PERFORMANCE_GC_INCREMENTAL) stats.incrementalMs += entry.duration;
    }
  });
  observer.observe({ entryTypes: ['gc'] });
  return Object.assign(stats, {
    start() {
      enabled = true;
    },
    stop() {
      enabled = false;
    },
    disconnect() {
      observer.disconnect();
    },
  });
}

function ensureCompactXmlFile(sizeMiB: number, verbose: boolean) {
  const filePath = join(tmpdir(), `stax-xml-string-feasibility-${sizeMiB}mib.xml`);
  const targetBytes = sizeMiB * 1024 * 1024;
  if (existsSync(filePath)) {
    const existing = statSync(filePath);
    if (existing.size >= targetBytes - 1024) {
      if (verbose) {
        console.log(`Reusing ${sizeMiB}MiB compact XML fixture: ${filePath} (${formatBytes(existing.size)})`);
      }
      return { filePath, bytes: existing.size };
    }
  }

  if (verbose) {
    console.log(`Creating ${sizeMiB}MiB compact XML fixture: ${filePath}`);
  }

  const fd = openSync(filePath, 'w');
  let written = 0;
  let id = 0;
  try {
    written += writeString(fd, '<root>');
    while (written < targetBytes - 16) {
      written += writeString(fd, compactBook(id++));
    }
    written += writeString(fd, '</root>');
  } finally {
    closeSync(fd);
  }
  return { filePath, bytes: written };
}

function compactBook(id: number) {
  return `<book id="book-${id}" lang="en" code="${id % 97}"><title>Compact ${id}</title><author>Author ${id % 4096}</author><description>Stable text payload ${id}</description><chapter number="1">Intro ${id}</chapter><chapter number="2">Body ${id}</chapter></book>`;
}

function writeString(fd: number, value: string) {
  const buffer = Buffer.from(value, 'utf8');
  writeSync(fd, buffer);
  return buffer.byteLength;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mixChecksum(checksum: number, value: number) {
  return Math.imul(checksum ^ (value >>> 0), 16777619) >>> 0;
}

function foldString(seed: number, value: string | undefined) {
  if (!value) return seed;
  let next = seed >>> 0;
  for (let index = 0; index < value.length; index++) {
    next = Math.imul(next ^ value.charCodeAt(index), 16777619) >>> 0;
  }
  return next;
}

function formatDurationMs(ms: number) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms.toFixed(2)} ms`;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MiB`;
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

function printRatios(results: Array<{ caseId: CaseId; elapsedMs: number }>) {
  const baseline = results.find((entry) => entry.caseId === 'legacy-string-baseline');
  const publicJs = results.find((entry) => entry.caseId === 'public-event-reader-sync-js');
  const cursor = results.find((entry) => entry.caseId === 'string-current-cursor-current-event');
  if (!baseline || !publicJs || !cursor) return;
  console.log('\nRelative ratios (lower time is better):');
  console.log(`- legacy-string-baseline vs public-event-reader-sync-js: ${(publicJs.elapsedMs / baseline.elapsedMs).toFixed(2)}x faster`);
  console.log(`- string-current-cursor-current-event vs legacy-string-baseline: ${(baseline.elapsedMs / cursor.elapsedMs).toFixed(2)}x of baseline`);
  console.log(`- string-current-cursor-current-event vs public-event-reader-sync-js: ${(publicJs.elapsedMs / cursor.elapsedMs).toFixed(2)}x faster`);
}

function parseArgs(argv: string[]) {
  const result = {
    sizesMiB: [...defaultSizesMiB],
    warmups: 1,
    runs: 3,
    childCase: undefined as CaseId | undefined,
    childSizeMiB: undefined as number | undefined,
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--child-case' && argv[index + 1]) {
      result.childCase = argv[++index] as CaseId;
      continue;
    }
    if (arg === '--child-size-mib' && argv[index + 1]) {
      result.childSizeMiB = Number(argv[++index]);
      continue;
    }
    if (arg === '--sizes-mib' && argv[index + 1]) {
      result.sizesMiB = argv[++index]!.split(',').map(Number);
      continue;
    }
    if (arg === '--warmups' && argv[index + 1]) {
      result.warmups = Number(argv[++index]);
      continue;
    }
    if (arg === '--runs' && argv[index + 1]) {
      result.runs = Number(argv[++index]);
    }
  }
  return result;
}

function main() {
  if (args.childCase && args.childSizeMiB) {
    const fixture = ensureCompactXmlFile(args.childSizeMiB, false);
    const xml = readFileSync(fixture.filePath, 'utf8');
    const result = measureCase(args.childCase, xml, fixture.bytes, args.warmups, args.runs);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  for (const sizeMiB of args.sizesMiB) {
    const fixture = ensureCompactXmlFile(sizeMiB, true);
    const results = cases.map((caseId) => runChildCase(caseId, sizeMiB));

    console.log(`\nString cursor feasibility (${sizeMiB} MiB compact XML)`);
    console.log(`Fixture: ${fixture.filePath}`);
    console.log('| Case | Throughput | Time | Heap peak | RSS peak | GC total | GC share | Events | Checksum |');
    console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
    for (const result of results) {
      console.log(
        `| ${result.caseId} | ${result.throughputMiBs.toFixed(2)} MiB/s | ${formatDurationMs(result.elapsedMs)} | ` +
          `${formatBytes(result.heapPeakBytes)} | ${formatBytes(result.rssPeakBytes)} | ` +
          `${formatDurationMs(result.gc.totalMs)} | ${result.gc.sharePct.toFixed(1)}% | ${result.events} | ${result.checksum} |`,
      );
    }

    const baseline = results[0]!;
    for (const result of results) {
      if (result.events !== baseline.events || result.checksum !== baseline.checksum) {
        throw new Error(`Parity mismatch: ${result.caseId} at ${sizeMiB} MiB`);
      }
    }

    printRatios(results);
  }
}

main();
