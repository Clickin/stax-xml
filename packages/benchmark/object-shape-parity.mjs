import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventReaderSync, StreamEventType, StreamReaderSync, XmlEventType } from 'stax-xml';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultFile = join(__dirname, 'test-data', 'runtime-comparison-16mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'object-shape-parity.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'object-shape-parity.md');
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { ignoreBOM: true });

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    runs: 3,
    warmups: 1,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    selfTest: false,
    fileExplicit: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
    if (arg === '--self-test') {
      options.selfTest = true;
      continue;
    }

    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${arg} requires a value.`);
      index++;
      return value;
    };

    switch (name) {
      case '--file':
        options.file = resolve(process.cwd(), readValue());
        options.fileExplicit = true;
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), '--runs');
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), '--warmups');
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

function parseNonNegativeInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${flag} must be a non-negative integer.`);
  return parsed;
}

function main() {
  const options = parseArgs();
  const fixture = loadFixture(options);
  const variants = [
    {
      id: 'stream-batch-index',
      objectShape: 'StreamBatch index accessors',
      perEventObject: false,
      materialization: 'full-string',
      run: () => consumeStreamBatchIndex(fixture.bytes),
    },
    {
      id: 'stream-event-view',
      objectShape: 'StreamEventView wrapper per event',
      perEventObject: true,
      materialization: 'full-string',
      run: () => consumeStreamEventView(fixture.bytes),
    },
    {
      id: 'cursor-adapter',
      objectShape: 'single mutable cursor over StreamBatch',
      perEventObject: false,
      materialization: 'full-string',
      run: () => consumeCursorAdapter(fixture.bytes),
    },
    {
      id: 'event-reader-object',
      objectShape: 'EventReaderSync public event objects',
      perEventObject: true,
      materialization: 'full-string',
      run: () => consumeEventReaderObject(fixture.xml),
    },
    {
      id: 'raw-frame-name-id',
      objectShape: 'nextRawBatch typed arrays with numeric name-id cache',
      perEventObject: false,
      materialization: 'full-string',
      run: () => consumeRawFrameNameId(fixture.bytes),
    },
  ];

  const results = variants.map((variant) => measureVariant(variant, fixture, options));
  const report = createReport(fixture, options, results);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function loadFixture(options) {
  if (options.selfTest) {
    const xml = makeXml(32);
    const bytes = textEncoder.encode(xml);
    return {
      source: 'self-test-generated',
      xml,
      bytes,
      byteLength: bytes.byteLength,
      file: null,
    };
  }

  if (!existsSync(options.file) && !options.fileExplicit) {
    generateXmlFile(options.file, 16 * MIB);
  }
  if (!existsSync(options.file)) {
    throw new Error(`Benchmark fixture does not exist: ${options.file}`);
  }
  const bytes = readFileSync(options.file);
  return {
    source: 'file',
    xml: textDecoder.decode(bytes),
    bytes,
    byteLength: statSync(options.file).size,
    file: options.file,
  };
}

function generateXmlFile(filePath, targetBytes) {
  mkdirSync(dirname(filePath), { recursive: true });
  const fd = openSync(filePath, 'w');
  const header = Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<root>\n');
  const footer = Buffer.from('</root>\n');
  const pending = [];
  let pendingBytes = 0;
  let written = 0;
  let id = 0;

  try {
    writeSync(fd, header);
    written += header.byteLength;
    while (written + pendingBytes + footer.byteLength < targetBytes) {
      const element = Buffer.from(makeBookElement(id));
      if (written + pendingBytes + element.byteLength + footer.byteLength > targetBytes) {
        break;
      }
      pending.push(element);
      pendingBytes += element.byteLength;
      id++;
      if (pendingBytes >= MIB) {
        writeSync(fd, Buffer.concat(pending, pendingBytes));
        written += pendingBytes;
        pending.length = 0;
        pendingBytes = 0;
      }
    }
    if (pendingBytes > 0) {
      writeSync(fd, Buffer.concat(pending, pendingBytes));
    }
    writeSync(fd, footer);
  } finally {
    closeSync(fd);
  }
}

function makeXml(elements) {
  const parts = ['<?xml version="1.0" encoding="UTF-8"?>\n<root>\n'];
  for (let id = 0; id < elements; id++) {
    parts.push(makeBookElement(id));
  }
  parts.push('</root>\n');
  return parts.join('');
}

function makeBookElement(id) {
  return `  <book id="book-${id}" lang="en" code="${id % 97}">`
    + `<title>Runtime Benchmark ${id}</title>`
    + `<author>Author ${id % 4096}</author>`
    + `<description>Full string checksum text payload ${id} with stable words and numbers.</description>`
    + `<chapter number="1">Intro ${id}</chapter>`
    + `<chapter number="2">Body ${id}</chapter>`
    + '</book>\n';
}

function measureVariant(variant, fixture, options) {
  for (let index = 0; index < options.warmups; index++) {
    variant.run();
  }

  const samplesMs = [];
  const memorySamples = [];
  let first;
  for (let index = 0; index < options.runs; index++) {
    globalThis.gc?.();
    const memoryBefore = takeMemorySnapshot();
    const startedAt = performance.now();
    const result = variant.run();
    const elapsedMs = performance.now() - startedAt;
    const memoryAfter = takeMemorySnapshot();
    if (first && (result.eventCount !== first.eventCount || result.checksum !== first.checksum)) {
      throw new Error(`${variant.id} produced unstable event count or checksum.`);
    }
    first ??= result;
    samplesMs.push(elapsedMs);
    memorySamples.push(createMemorySample(memoryBefore, memoryAfter));
  }

  const avgMs = average(samplesMs);
  return {
    id: variant.id,
    objectShape: variant.objectShape,
    perEventObject: variant.perEventObject,
    materialization: variant.materialization,
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    mibPerSec: (fixture.byteLength / MIB) / (avgMs / 1000),
    eventCount: first.eventCount,
    checksum: first.checksum,
    samplesMs,
    memory: summarizeMemorySamples(memorySamples),
  };
}

function takeMemorySnapshot() {
  const usage = process.memoryUsage();
  return {
    rssBytes: usage.rss,
    heapTotalBytes: usage.heapTotal,
    heapUsedBytes: usage.heapUsed,
    externalBytes: usage.external,
    arrayBuffersBytes: usage.arrayBuffers,
  };
}

function createMemorySample(before, after) {
  return {
    before,
    after,
    delta: {
      rssBytes: after.rssBytes - before.rssBytes,
      heapTotalBytes: after.heapTotalBytes - before.heapTotalBytes,
      heapUsedBytes: after.heapUsedBytes - before.heapUsedBytes,
      externalBytes: after.externalBytes - before.externalBytes,
      arrayBuffersBytes: after.arrayBuffersBytes - before.arrayBuffersBytes,
    },
  };
}

function summarizeMemorySamples(samples) {
  return {
    avgHeapUsedDeltaBytes: average(samples.map((sample) => sample.delta.heapUsedBytes)),
    avgHeapTotalDeltaBytes: average(samples.map((sample) => sample.delta.heapTotalBytes)),
    avgRssDeltaBytes: average(samples.map((sample) => sample.delta.rssBytes)),
    avgExternalDeltaBytes: average(samples.map((sample) => sample.delta.externalBytes)),
    avgArrayBuffersDeltaBytes: average(samples.map((sample) => sample.delta.arrayBuffersBytes)),
    maxHeapUsedBytes: Math.max(...samples.flatMap((sample) => [sample.before.heapUsedBytes, sample.after.heapUsedBytes])),
    maxHeapTotalBytes: Math.max(...samples.flatMap((sample) => [sample.before.heapTotalBytes, sample.after.heapTotalBytes])),
    maxRssBytes: Math.max(...samples.flatMap((sample) => [sample.before.rssBytes, sample.after.rssBytes])),
    samples,
  };
}

function createReport(fixture, options, variants) {
  const baseline = variants.find((entry) => entry.id === 'stream-batch-index');
  const parity = computeParity(variants);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'object-shape-parity',
    contract: 'full-string-materialization',
    note: 'Compares JavaScript reader object shapes under the same event, string, attribute, checksum, and memory endpoint contract.',
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
      v8: process.versions.v8,
    },
    fixture: {
      source: fixture.source,
      file: fixture.file,
      byteLength: fixture.byteLength,
      sizeMiB: fixture.byteLength / MIB,
    },
    options: {
      runs: options.runs,
      warmups: options.warmups,
    },
    parity,
    variants: variants.map((entry) => ({
      ...entry,
      relativeToStreamBatchIndex: baseline ? entry.mibPerSec / baseline.mibPerSec : 1,
    })),
    findings: createFindings(variants),
  };
}

function computeParity(variants) {
  const first = variants[0];
  const mismatch = variants.find((entry) => entry.eventCount !== first.eventCount || entry.checksum !== first.checksum);
  if (mismatch) {
    throw new Error(`Variant ${mismatch.id} does not match ${first.id}.`);
  }
  return {
    status: 'ok',
    eventCount: first.eventCount,
    checksum: first.checksum,
  };
}

function createFindings(variants) {
  const baseline = variants.find((entry) => entry.id === 'stream-batch-index');
  const findings = [
    {
      id: 'shape-parity',
      summary: 'All variants consume the same event types, names, text, attribute names, and attribute values.',
      evidence: variants.map((entry) => `${entry.id}: events=${entry.eventCount}, checksum=${entry.checksum}`),
    },
  ];
  if (baseline) {
    findings.push({
      id: 'object-shape-deltas',
      summary: 'Relative throughput separates public object/view/cursor shape overhead from parser-core and string materialization work.',
      evidence: variants.map((entry) => `${entry.id}: relative=${(entry.mibPerSec / baseline.mibPerSec).toFixed(2)}x`),
    });
  }
  return findings;
}

function consumeStreamBatchIndex(bytes) {
  let eventCount = 0;
  let checksum = 0;

  for (const batch of new StreamReaderSync(bytes)) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const type = batch.typeAt(index);
      eventCount++;
      checksum = foldStreamBatchEvent(batch, index, type, checksum);
    }
  }

  return { eventCount, checksum };
}

function consumeStreamEventView(bytes) {
  let eventCount = 0;
  let checksum = 0;

  for (const batch of new StreamReaderSync(bytes)) {
    for (const event of batch) {
      const type = event.type;
      eventCount++;
      checksum = mixChecksum(checksum, type);

      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        checksum = foldString(checksum, event.name());
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        checksum = foldString(checksum, event.text()?.trim());
      }
      if (type === StreamEventType.START_ELEMENT) {
        const attrCount = event.getAttributeCount();
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          checksum = foldString(checksum, event.getAttributeName(attrIndex));
          checksum = foldString(checksum, event.getAttributeValue(attrIndex));
        }
      }
    }
  }

  return { eventCount, checksum };
}

function consumeCursorAdapter(bytes) {
  const cursor = new BatchCursor();
  let eventCount = 0;
  let checksum = 0;

  for (const batch of new StreamReaderSync(bytes)) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      cursor.set(batch, index);
      const type = cursor.type();
      eventCount++;
      checksum = mixChecksum(checksum, type);

      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        checksum = foldString(checksum, cursor.name());
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        checksum = foldString(checksum, cursor.text()?.trim());
      }
      if (type === StreamEventType.START_ELEMENT) {
        const attrCount = cursor.getAttributeCount();
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          checksum = foldString(checksum, cursor.getAttributeName(attrIndex));
          checksum = foldString(checksum, cursor.getAttributeValue(attrIndex));
        }
      }
    }
  }

  return { eventCount, checksum };
}

class BatchCursor {
  batch;
  index = 0;

  set(batch, index) {
    this.batch = batch;
    this.index = index;
  }

  type() {
    return this.batch.typeAt(this.index);
  }

  name() {
    return this.batch.nameAt(this.index);
  }

  text() {
    return this.batch.textAt(this.index);
  }

  getAttributeCount() {
    return this.batch.attributeCountAt(this.index);
  }

  getAttributeName(attrIndex) {
    return this.batch.attributeNameAt(this.index, attrIndex);
  }

  getAttributeValue(attrIndex) {
    return this.batch.attributeValueAt(this.index, attrIndex);
  }
}

function consumeEventReaderObject(xml) {
  let eventCount = 0;
  let checksum = 0;

  for (const event of new EventReaderSync(xml)) {
    const typeCode = publicEventTypeCode(event.type);
    eventCount++;
    checksum = mixChecksum(checksum, typeCode);

    if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
      checksum = foldString(checksum, event.name);
    }
    if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
      checksum = foldString(checksum, event.value?.trim());
    }
    if (event.type === XmlEventType.START_ELEMENT) {
      const entries = Object.entries(event.attributes);
      checksum = mixChecksum(checksum, entries.length);
      for (const [name, value] of entries) {
        checksum = foldString(checksum, name);
        checksum = foldString(checksum, value);
      }
    }
  }

  return { eventCount, checksum };
}

function consumeRawFrameNameId(bytes) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const reader = new StreamReaderSync(bytes);
  const nameCache = [];
  let eventCount = 0;
  let checksum = 0;
  let frame;

  while ((frame = reader.nextRawBatch()) !== null) {
    const result = consumeRawFrame(frame, checksum, eventCount, decoder, nameCache);
    checksum = result.checksum;
    eventCount = result.eventCount;
  }

  return { eventCount, checksum };
}

function foldStreamBatchEvent(batch, index, type, checksum) {
  checksum = mixChecksum(checksum, type);

  if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
    checksum = foldString(checksum, batch.nameAt(index));
  }
  if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
    checksum = foldString(checksum, batch.textAt(index)?.trim());
  }
  if (type === StreamEventType.START_ELEMENT) {
    const attrCount = batch.attributeCountAt(index);
    checksum = mixChecksum(checksum, attrCount);
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      checksum = foldString(checksum, batch.attributeNameAt(index, attrIndex));
      checksum = foldString(checksum, batch.attributeValueAt(index, attrIndex));
    }
  }
  return checksum;
}

function consumeRawFrame(frame, checksum, eventCount, decoder, nameCache) {
  if (frame.kind !== 'frame') {
    throw new Error(`Unsupported raw batch kind in object-shape benchmark: ${frame.kind}`);
  }
  const eventTypes = frame.eventTypes;
  const nameStarts = frame.nameStarts;
  const nameEnds = frame.nameEnds;
  const nameIds = frame.nameIds;
  const textStarts = frame.textStarts;
  const textEnds = frame.textEnds;
  const attrStarts = frame.attrStarts;
  const attrCounts = frame.attrCounts;
  const attrNameStarts = frame.attrNameStarts;
  const attrNameEnds = frame.attrNameEnds;
  const attrNameIds = frame.attrNameIds;
  const attrValueStarts = frame.attrValueStarts;
  const attrValueEnds = frame.attrValueEnds;
  const buffer = frame.buffer;
  const count = frame.eventCount;

  for (let index = 0; index < count; index++) {
    const type = eventTypes[index];
    eventCount++;
    checksum = mixChecksum(checksum, type);

    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      checksum = foldString(checksum, materializeName(buffer, nameStarts[index], nameEnds[index], nameIds[index], decoder, nameCache));
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      const start = textStarts[index];
      checksum = foldString(checksum, start < 0 ? undefined : decodeSpan(buffer, start, textEnds[index], decoder).trim());
    }
    if (type === StreamEventType.START_ELEMENT) {
      const attrStart = attrStarts[index];
      const attrCount = attrCounts[index];
      checksum = mixChecksum(checksum, attrCount);
      const attrEnd = attrStart + attrCount;
      for (let attrIndex = attrStart; attrIndex < attrEnd; attrIndex++) {
        checksum = foldString(
          checksum,
          materializeName(buffer, attrNameStarts[attrIndex], attrNameEnds[attrIndex], attrNameIds[attrIndex], decoder, nameCache),
        );
        const value = isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, attrIndex)
          ? 'true'
          : decodeSpan(buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex], decoder);
        checksum = foldString(checksum, value);
      }
    }
  }

  return { eventCount, checksum };
}

function materializeName(buffer, start, end, nameId, decoder, nameCache) {
  if (nameId < 0 || start < 0) {
    return undefined;
  }
  const cached = nameCache[nameId];
  if (cached !== undefined) {
    return cached;
  }
  const value = decodeSpan(buffer, start, end, decoder);
  nameCache[nameId] = value;
  return value;
}

function decodeSpan(buffer, start, end, decoder) {
  const ascii = decodeShortAsciiSpan(buffer, start, end);
  return ascii ?? decoder.decode(buffer.subarray(start, end));
}

function decodeShortAsciiSpan(buffer, start, end) {
  switch (end - start) {
    case 0:
      return '';
    case 1: {
      const b0 = buffer[start];
      return b0 <= 0x7f ? String.fromCharCode(b0) : undefined;
    }
    case 2: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      return (b0 | b1) <= 0x7f ? String.fromCharCode(b0, b1) : undefined;
    }
    case 3: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      return (b0 | b1 | b2) <= 0x7f ? String.fromCharCode(b0, b1, b2) : undefined;
    }
    case 4: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      return (b0 | b1 | b2 | b3) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3) : undefined;
    }
    case 5: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      return (b0 | b1 | b2 | b3 | b4) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4) : undefined;
    }
    case 6: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      return (b0 | b1 | b2 | b3 | b4 | b5) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5) : undefined;
    }
    case 7: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6) : undefined;
    }
    case 8: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7)
        : undefined;
    }
    case 9: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8)
        : undefined;
    }
    case 10: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      const b9 = buffer[start + 9];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9)
        : undefined;
    }
    case 11: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      const b9 = buffer[start + 9];
      const b10 = buffer[start + 10];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10)
        : undefined;
    }
    case 12: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      const b9 = buffer[start + 9];
      const b10 = buffer[start + 10];
      const b11 = buffer[start + 11];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11)
        : undefined;
    }
    default:
      return undefined;
  }
}

function isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, index) {
  return attrNameStarts[index] === attrValueStarts[index] && attrNameEnds[index] === attrValueEnds[index];
}

function publicEventTypeCode(type) {
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
      return 6;
  }
}

function mixChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function foldString(seed, value) {
  if (!value) {
    return seed;
  }
  let next = seed;
  for (let index = 0; index < value.length; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
}

function renderMarkdown(report) {
  const lines = [
    '# Object Shape Parity',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This benchmark compares JavaScript reader object shapes under the same full-string checksum contract.',
    'It does not filter events, skip strings, use native addons, or use Node Buffer-specific decoding as the optimization being measured.',
    '',
    '## Fixture',
    '',
    `- Source: ${report.fixture.source}`,
    `- Size: ${formatBytes(report.fixture.byteLength)} (${report.fixture.byteLength} bytes)`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    '',
    '## Results',
    '',
    '| Variant | Object shape | Per-event object | Throughput | Relative to stream batch | Average | Events | Checksum |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const entry of report.variants) {
    lines.push(
      `| ${entry.id} | ${entry.objectShape} | ${entry.perEventObject ? 'yes' : 'no'} | `
      + `${formatRate(entry.mibPerSec)} | ${entry.relativeToStreamBatchIndex.toFixed(2)}x | `
      + `${formatMs(entry.avgMs)} | ${entry.eventCount} | ${entry.checksum} |`,
    );
  }
  lines.push('');
  lines.push('## Memory');
  lines.push('');
  lines.push('Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.');
  lines.push('');
  lines.push('| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const entry of report.variants) {
    lines.push(
      `| ${entry.id} | ${formatSignedBytes(entry.memory.avgHeapUsedDeltaBytes)} | `
      + `${formatSignedBytes(entry.memory.avgRssDeltaBytes)} | `
      + `${formatBytes(entry.memory.maxHeapUsedBytes)} | ${formatBytes(entry.memory.maxRssBytes)} |`,
    );
  }
  lines.push('');
  lines.push('## Parity');
  lines.push('');
  lines.push(`Status: ${report.parity.status}`);
  lines.push(`Events: ${report.parity.eventCount}`);
  lines.push(`Checksum: ${report.parity.checksum}`);
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id}: ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}`;
}

function printSummary(report) {
  console.log('Object shape parity');
  for (const entry of report.variants) {
    console.log(
      `${entry.id.padEnd(24)} ${formatRate(entry.mibPerSec).padStart(14)} `
      + `relative=${entry.relativeToStreamBatchIndex.toFixed(2)}x `
      + `heapDelta=${formatSignedBytes(entry.memory.avgHeapUsedDeltaBytes)} `
      + `rssDelta=${formatSignedBytes(entry.memory.avgRssDeltaBytes)} `
      + `events=${entry.eventCount} checksum=${entry.checksum}`,
    );
  }
}

function writeOutput(path, content) {
  const resolved = resolve(process.cwd(), path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content, 'utf8');
  console.log(`Wrote ${resolved}`);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatRate(value) {
  return `${value.toFixed(1)} MiB/s`;
}

function formatMs(value) {
  return `${value.toFixed(2)} ms`;
}

function formatBytes(bytes) {
  const absBytes = Math.abs(bytes);
  if (absBytes >= 1024 * MIB) {
    return `${(bytes / (1024 * MIB)).toFixed(2)} GiB`;
  }
  if (absBytes >= MIB) {
    return `${(bytes / MIB).toFixed(1)} MiB`;
  }
  if (absBytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${bytes.toFixed(0)} B`;
}

function formatSignedBytes(bytes) {
  if (bytes === 0) {
    return formatBytes(bytes);
  }
  return `${bytes > 0 ? '+' : ''}${formatBytes(bytes)}`;
}

main();
