import { mkdirSync, openSync, readSync, statSync, writeFileSync, closeSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  StreamEventType,
  StreamReaderSync,
} from '../stax-xml/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultFile = join(__dirname, 'test-data', 'node-string-return-1024mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'file-backed-materialization-profile.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'file-backed-materialization-profile.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    chunkKiB: 32,
    batchSize: 4,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error(`${arg} requires a value.`);
      }
      index++;
      return value;
    };

    switch (name) {
      case '--file':
        options.file = resolve(process.cwd(), readValue());
        break;
      case '--chunk-kib':
        options.chunkKiB = parsePositiveInteger(readValue(), name);
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), name);
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

function parsePositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

function main() {
  const options = parseArgs();
  const report = createReport(options);
  mkdirSync(dirname(options.jsonOut), { recursive: true });
  writeFileSync(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(options.mdOut, renderMarkdown(report), 'utf8');
  console.log(`file-backed-materialization-profile: events=${report.result.eventCount} checksum=${report.result.checksum} decoderCalls=${report.materialization.textDecoderCalls.total}`);
}

function createReport(options) {
  const fileStats = statSync(options.file);
  const result = consumeRawFrameNameIdProfile(
    createFileByteBatches(options.file, options.chunkKiB * 1024, options.batchSize),
  );
  const materialization = summarizeMaterialization(result.counters);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'file-backed-materialization-profile',
    contract: 'same-file-backed-raw-frame-name-id-full-string-checksum',
    note: 'Counts the string materialization work performed by the current file-backed raw-frame name-id full-string checksum path. This is deterministic counter evidence for where full-string work remains; it is not a throughput run and not a runtime ceiling proof.',
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
      v8: process.versions.v8,
    },
    fixture: {
      path: options.file,
      sizeBytes: fileStats.size,
      sizeMiB: fileStats.size / 1024 / 1024,
    },
    sourceContract: {
      parserInput: 'StreamReaderSync over a synchronous Iterable<Uint8Array[]>',
      sourceMode: 'file-backed-sync-iterable-byte-batches',
      fileRead: 'readSync is called only while the iterator is pulled for the next parser batch',
      chunkBytes: options.chunkKiB * 1024,
      batchSize: options.batchSize,
      preMaterializesFullXml: false,
      directReadableStream: false,
      nativeAddon: false,
      nodeBufferStringDecode: false,
    },
    result: {
      eventCount: result.eventCount,
      checksum: result.checksum,
      fullStringParity: true,
    },
    eventShape: result.counters.events,
    materialization,
    findings: createFindings(materialization, result.counters),
  };
}

function consumeRawFrameNameIdProfile(byteBatches) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const parser = new StreamReaderSync(byteBatches);
  const nameCache = [];
  const counters = createCounters();
  let eventCount = 0;
  let checksum = 0;
  let frame;

  while ((frame = parser.nextRawBatch()) !== null) {
    if (frame.kind !== 'frame') {
      throw new Error(`Unsupported raw batch kind: ${frame.kind}`);
    }
    counters.frames++;
    const buffer = frame.buffer;
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
    const count = frame.eventCount;

    for (let index = 0; index < count; index++) {
      const type = eventTypes[index];
      eventCount++;
      countEvent(counters, type);
      checksum = mixChecksum(checksum, type);

      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        checksum = foldString(
          checksum,
          materializeName(buffer, nameStarts[index], nameEnds[index], nameIds[index], decoder, nameCache, counters),
        );
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        const start = textStarts[index];
        if (start >= 0) {
          const value = decodeSpan(buffer, start, textEnds[index], decoder, counters, 'text');
          countTextTrim(counters, value);
          checksum = foldString(checksum, value.trim());
        }
      }
      if (type === StreamEventType.START_ELEMENT) {
        const attrStart = attrStarts[index];
        const attrCount = attrCounts[index];
        counters.events.attributePairs += attrCount;
        checksum = mixChecksum(checksum, attrCount);
        const attrEnd = attrStart + attrCount;
        for (let attrIndex = attrStart; attrIndex < attrEnd; attrIndex++) {
          checksum = foldString(
            checksum,
            materializeName(
              buffer,
              attrNameStarts[attrIndex],
              attrNameEnds[attrIndex],
              attrNameIds[attrIndex],
              decoder,
              nameCache,
              counters,
            ),
          );
          checksum = foldString(
            checksum,
            decodeSpan(buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex], decoder, counters, 'attrValue'),
          );
        }
      }
    }
  }

  counters.nameCache.uniqueNames = nameCache.filter(value => value !== undefined).length;
  return { eventCount, checksum, counters };
}

function createCounters() {
  return {
    frames: 0,
    events: {
      startElements: 0,
      endElements: 0,
      textEvents: 0,
      cdataEvents: 0,
      attributePairs: 0,
    },
    nameCache: {
      hits: 0,
      misses: 0,
      uniqueNames: 0,
    },
    spans: {
      name: createSpanCounters(),
      text: createSpanCounters(),
      attrValue: createSpanCounters(),
    },
    textTrim: {
      calls: 0,
      boundaryWhitespace: 0,
      emptyAfterTrim: 0,
    },
  };
}

function createSpanCounters() {
  return {
    calls: 0,
    bytes: 0,
    shortAsciiHits: 0,
    shortAsciiBytes: 0,
    textDecoderCalls: 0,
    textDecoderBytes: 0,
    asciiTextDecoderCalls: 0,
    asciiTextDecoderBytes: 0,
    nonAsciiTextDecoderCalls: 0,
    nonAsciiTextDecoderBytes: 0,
  };
}

function countEvent(counters, type) {
  if (type === StreamEventType.START_ELEMENT) counters.events.startElements++;
  if (type === StreamEventType.END_ELEMENT) counters.events.endElements++;
  if (type === StreamEventType.CHARACTERS) counters.events.textEvents++;
  if (type === StreamEventType.CDATA) counters.events.cdataEvents++;
}

function materializeName(buffer, start, end, nameId, decoder, nameCache, counters) {
  if (nameId < 0 || start < 0) {
    return undefined;
  }
  const cached = nameCache[nameId];
  if (cached !== undefined) {
    counters.nameCache.hits++;
    return cached;
  }
  counters.nameCache.misses++;
  const value = decodeSpan(buffer, start, end, decoder, counters, 'name');
  nameCache[nameId] = value;
  return value;
}

function decodeSpan(buffer, start, end, decoder, counters, kind) {
  const span = counters.spans[kind];
  const length = end - start;
  span.calls++;
  span.bytes += length;
  const ascii = decodeShortAsciiSpan(buffer, start, end);
  if (ascii !== undefined) {
    span.shortAsciiHits++;
    span.shortAsciiBytes += length;
    return ascii;
  }
  span.textDecoderCalls++;
  span.textDecoderBytes += length;
  if (isAsciiSpan(buffer, start, end)) {
    span.asciiTextDecoderCalls++;
    span.asciiTextDecoderBytes += length;
  } else {
    span.nonAsciiTextDecoderCalls++;
    span.nonAsciiTextDecoderBytes += length;
  }
  return decoder.decode(buffer.subarray(start, end));
}

function decodeShortAsciiSpan(buffer, start, end) {
  const length = end - start;
  if (length < 0 || length > 12) {
    return undefined;
  }
  let asciiMask = 0;
  const codes = [];
  for (let index = start; index < end; index++) {
    const byte = buffer[index];
    asciiMask |= byte;
    codes.push(byte);
  }
  return asciiMask <= 0x7f ? String.fromCharCode(...codes) : undefined;
}

function isAsciiSpan(buffer, start, end) {
  for (let index = start; index < end; index++) {
    if (buffer[index] > 0x7f) {
      return false;
    }
  }
  return true;
}

function countTextTrim(counters, value) {
  counters.textTrim.calls++;
  if (!value) {
    counters.textTrim.emptyAfterTrim++;
    return;
  }
  const first = value.charCodeAt(0);
  const last = value.charCodeAt(value.length - 1);
  if (isXmlWhitespaceCodeUnit(first) || isXmlWhitespaceCodeUnit(last)) {
    counters.textTrim.boundaryWhitespace++;
  }
  if (value.trim().length === 0) {
    counters.textTrim.emptyAfterTrim++;
  }
}

function isXmlWhitespaceCodeUnit(value) {
  return value === 0x20 || value === 0x09 || value === 0x0a || value === 0x0d;
}

function summarizeMaterialization(counters) {
  const spans = counters.spans;
  const totals = sumSpanCounters(Object.values(spans));
  const nonNameDecoderCalls = spans.text.textDecoderCalls + spans.attrValue.textDecoderCalls;
  const nonNameDecodeCalls = spans.text.calls + spans.attrValue.calls;
  return {
    frames: counters.frames,
    decodeSpanCalls: {
      total: totals.calls,
      byKind: mapSpanValue(spans, 'calls'),
    },
    textDecoderCalls: {
      total: totals.textDecoderCalls,
      byKind: mapSpanValue(spans, 'textDecoderCalls'),
      nonNameTotal: nonNameDecoderCalls,
      nonNameShare: ratio(nonNameDecoderCalls, totals.textDecoderCalls),
      asciiFallback: {
        total: totals.asciiTextDecoderCalls,
        byKind: mapSpanValue(spans, 'asciiTextDecoderCalls'),
        bytes: totals.asciiTextDecoderBytes,
        share: ratio(totals.asciiTextDecoderCalls, totals.textDecoderCalls),
      },
      nonAscii: {
        total: totals.nonAsciiTextDecoderCalls,
        byKind: mapSpanValue(spans, 'nonAsciiTextDecoderCalls'),
        bytes: totals.nonAsciiTextDecoderBytes,
        share: ratio(totals.nonAsciiTextDecoderCalls, totals.textDecoderCalls),
      },
    },
    shortAsciiHits: {
      total: totals.shortAsciiHits,
      byKind: mapSpanValue(spans, 'shortAsciiHits'),
      hitRate: ratio(totals.shortAsciiHits, totals.calls),
    },
    bytes: {
      decodedSpanBytes: totals.bytes,
      textDecoderBytes: totals.textDecoderBytes,
      shortAsciiBytes: totals.shortAsciiBytes,
      byKind: {
        name: pickByteValues(spans.name),
        text: pickByteValues(spans.text),
        attrValue: pickByteValues(spans.attrValue),
      },
    },
    nameCache: {
      ...counters.nameCache,
      hitRate: ratio(counters.nameCache.hits, counters.nameCache.hits + counters.nameCache.misses),
    },
    textTrim: counters.textTrim,
    nonNameDecodeCalls,
  };
}

function sumSpanCounters(entries) {
  return entries.reduce((sum, entry) => ({
    calls: sum.calls + entry.calls,
    bytes: sum.bytes + entry.bytes,
    shortAsciiHits: sum.shortAsciiHits + entry.shortAsciiHits,
    shortAsciiBytes: sum.shortAsciiBytes + entry.shortAsciiBytes,
    textDecoderCalls: sum.textDecoderCalls + entry.textDecoderCalls,
    textDecoderBytes: sum.textDecoderBytes + entry.textDecoderBytes,
    asciiTextDecoderCalls: sum.asciiTextDecoderCalls + entry.asciiTextDecoderCalls,
    asciiTextDecoderBytes: sum.asciiTextDecoderBytes + entry.asciiTextDecoderBytes,
    nonAsciiTextDecoderCalls: sum.nonAsciiTextDecoderCalls + entry.nonAsciiTextDecoderCalls,
    nonAsciiTextDecoderBytes: sum.nonAsciiTextDecoderBytes + entry.nonAsciiTextDecoderBytes,
  }), createSpanCounters());
}

function mapSpanValue(spans, key) {
  return {
    name: spans.name[key],
    text: spans.text[key],
    attrValue: spans.attrValue[key],
  };
}

function pickByteValues(span) {
  return {
    spanBytes: span.bytes,
    textDecoderBytes: span.textDecoderBytes,
    shortAsciiBytes: span.shortAsciiBytes,
  };
}

function createFindings(materialization, counters) {
  return [
    {
      id: 'same-contract-file-backed-profile',
      classification: 'TRACE_FACT',
      summary: 'The profile replays the current raw-frame name-id full-string checksum over demand-driven file-backed byte batches.',
      evidence: [
        `frames=${materialization.frames}`,
        `startElements=${counters.events.startElements}`,
        `attributePairs=${counters.events.attributePairs}`,
      ],
    },
    {
      id: 'name-cache-removes-repeated-name-decodes',
      classification: 'TRACE_FACT',
      summary: `Name-id caching leaves ${formatCount(materialization.nameCache.misses)} unique name decodes and serves repeated names at ${formatPercent(materialization.nameCache.hitRate)} hit rate.`,
      evidence: [
        `hits=${materialization.nameCache.hits}`,
        `misses=${materialization.nameCache.misses}`,
        `uniqueNames=${materialization.nameCache.uniqueNames}`,
      ],
    },
    {
      id: 'non-name-strings-dominate-decoder-work',
      classification: 'HEADROOM_EVIDENCE',
      summary: `Text and attribute values account for ${formatPercent(materialization.textDecoderCalls.nonNameShare)} of TextDecoder calls that remain after name caching.`,
      evidence: [
        `textDecoderCalls=${materialization.textDecoderCalls.total}`,
        `nonNameTextDecoderCalls=${materialization.textDecoderCalls.nonNameTotal}`,
        `decodeSpanCalls=${materialization.decodeSpanCalls.total}`,
      ],
    },
    {
      id: 'long-ascii-text-drives-decoder-fallback',
      classification: 'HEADROOM_EVIDENCE',
      summary: `${formatPercent(materialization.textDecoderCalls.asciiFallback.share)} of TextDecoder calls are ASCII spans longer than the short ASCII fast path, not non-ASCII UTF-8 spans.`,
      evidence: [
        `asciiTextDecoderCalls=${materialization.textDecoderCalls.asciiFallback.total}`,
        `nonAsciiTextDecoderCalls=${materialization.textDecoderCalls.nonAscii.total}`,
        `asciiTextDecoderBytes=${materialization.textDecoderCalls.asciiFallback.bytes}`,
      ],
    },
    {
      id: 'not-runtime-ceiling-proof',
      classification: 'TRACE_FACT_LIMIT',
      summary: 'This is deterministic materialization-count evidence for one source shape and fixture; it does not prove JavaScript runtimes have no remaining headroom.',
      evidence: [
        'Use it to rank next hypotheses, not to conclude impossibility.',
      ],
    },
  ];
}

function* createFileByteBatches(filePath, chunkBytes, batchSize) {
  const fd = openSync(filePath, 'r');
  try {
    while (true) {
      const batch = [];
      for (let index = 0; index < batchSize; index++) {
        const buffer = new Uint8Array(chunkBytes);
        const bytesRead = readSync(fd, buffer, 0, chunkBytes, null);
        if (bytesRead === 0) break;
        batch.push(bytesRead === chunkBytes ? buffer : buffer.subarray(0, bytesRead));
      }
      if (batch.length === 0) return;
      yield batch;
    }
  } finally {
    closeSync(fd);
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

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# File-Backed Materialization Profile');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(report.note);
  lines.push('');
  lines.push('## Source Contract');
  lines.push('');
  lines.push(`- Parser input: ${report.sourceContract.parserInput}`);
  lines.push(`- Source mode: ${report.sourceContract.sourceMode}`);
  lines.push(`- File read: ${report.sourceContract.fileRead}`);
  lines.push(`- Chunk bytes: ${report.sourceContract.chunkBytes}`);
  lines.push(`- Batch size: ${report.sourceContract.batchSize}`);
  lines.push(`- Pre-materializes full XML: ${report.sourceContract.preMaterializesFullXml ? 'yes' : 'no'}`);
  lines.push(`- Direct ReadableStream: ${report.sourceContract.directReadableStream ? 'yes' : 'no'}`);
  lines.push(`- Native addon: ${report.sourceContract.nativeAddon ? 'yes' : 'no'}`);
  lines.push(`- Node Buffer string decode: ${report.sourceContract.nodeBufferStringDecode ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Result');
  lines.push('');
  lines.push(`- Fixture: ${report.fixture.path}`);
  lines.push(`- Fixture size: ${formatNumber(report.fixture.sizeMiB)} MiB`);
  lines.push(`- Events: ${formatCount(report.result.eventCount)}`);
  lines.push(`- Checksum: ${report.result.checksum}`);
  lines.push(`- Full-string parity: ${report.result.fullStringParity ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Event Shape');
  lines.push('');
  lines.push(`- Start elements: ${formatCount(report.eventShape.startElements)}`);
  lines.push(`- End elements: ${formatCount(report.eventShape.endElements)}`);
  lines.push(`- Text events: ${formatCount(report.eventShape.textEvents)}`);
  lines.push(`- CDATA events: ${formatCount(report.eventShape.cdataEvents)}`);
  lines.push(`- Attribute pairs: ${formatCount(report.eventShape.attributePairs)}`);
  lines.push('');
  lines.push('## Materialization');
  lines.push('');
  lines.push('| Kind | Decode span calls | TextDecoder calls | Short ASCII hits | Span bytes | TextDecoder bytes | Short ASCII bytes |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const kind of ['name', 'text', 'attrValue']) {
    const bytes = report.materialization.bytes.byKind[kind];
    lines.push([
      `| ${kind}`,
      formatCount(report.materialization.decodeSpanCalls.byKind[kind]),
      formatCount(report.materialization.textDecoderCalls.byKind[kind]),
      formatCount(report.materialization.shortAsciiHits.byKind[kind]),
      formatCount(bytes.spanBytes),
      formatCount(bytes.textDecoderBytes),
      `${formatCount(bytes.shortAsciiBytes)} |`,
    ].join(' | '));
  }
  lines.push('');
  lines.push(`- Total decodeSpan calls: ${formatCount(report.materialization.decodeSpanCalls.total)}`);
  lines.push(`- Total TextDecoder calls: ${formatCount(report.materialization.textDecoderCalls.total)}`);
  lines.push(`- Non-name TextDecoder share: ${formatPercent(report.materialization.textDecoderCalls.nonNameShare)}`);
  lines.push(`- ASCII TextDecoder fallback share: ${formatPercent(report.materialization.textDecoderCalls.asciiFallback.share)}`);
  lines.push(`- Non-ASCII TextDecoder share: ${formatPercent(report.materialization.textDecoderCalls.nonAscii.share)}`);
  lines.push(`- ASCII TextDecoder fallback bytes: ${formatCount(report.materialization.textDecoderCalls.asciiFallback.bytes)}`);
  lines.push(`- Non-ASCII TextDecoder bytes: ${formatCount(report.materialization.textDecoderCalls.nonAscii.bytes)}`);
  lines.push(`- Short ASCII hit rate: ${formatPercent(report.materialization.shortAsciiHits.hitRate)}`);
  lines.push(`- Name cache hits/misses: ${formatCount(report.materialization.nameCache.hits)} / ${formatCount(report.materialization.nameCache.misses)} (${formatPercent(report.materialization.nameCache.hitRate)})`);
  lines.push(`- Unique names: ${formatCount(report.materialization.nameCache.uniqueNames)}`);
  lines.push(`- Text trim calls: ${formatCount(report.materialization.textTrim.calls)}`);
  lines.push(`- Text boundary whitespace: ${formatCount(report.materialization.textTrim.boundaryWhitespace)}`);
  lines.push(`- Text empty after trim: ${formatCount(report.materialization.textTrim.emptyAfterTrim)}`);
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function formatCount(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatNumber(value) {
  return value.toFixed(2);
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}
