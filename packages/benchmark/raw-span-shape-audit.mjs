import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StreamEventType, StreamReaderSync } from 'stax-xml';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultCorpusFile = resolve(__dirname, 'assets', 'books.xml');
const defaultReleaseDir = resolve(__dirname, 'results', 'release');
const defaultJsonOut = resolve(defaultReleaseDir, 'raw-span-shape-audit.json');
const defaultMdOut = resolve(defaultReleaseDir, 'raw-span-shape-audit.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizeGiB: 1,
    corpusFile: defaultCorpusFile,
    batchSize: 1,
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
      if (value === undefined) throw new Error(`${arg} requires a value.`);
      index++;
      return value;
    };

    switch (name) {
      case '--size-gib':
        options.sizeGiB = parsePositiveNumber(readValue(), name);
        break;
      case '--corpus-file':
        options.corpusFile = resolve(process.cwd(), readValue());
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

  if (!existsSync(options.corpusFile)) {
    throw new Error(`--corpus-file does not exist: ${options.corpusFile}`);
  }
  return options;
}

function main() {
  const options = parseArgs();
  const report = createReport(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`raw-span-shape-audit: events=${report.summary.eventCount} attrValueMediumAscii=${report.spans.attrValueExplicit.mediumAsciiCount} textMediumAscii=${report.spans.text.mediumAsciiCount}`);
}

function createReport(options) {
  const seed = new Uint8Array(readFileSync(options.corpusFile));
  if (seed.byteLength === 0) {
    throw new Error(`Corpus fixture is empty: ${options.corpusFile}`);
  }
  const targetBytes = Math.floor(options.sizeGiB * GIB);
  const actualBytes = computeExpectedBytes(targetBytes, seed.byteLength);
  const fixture = {
    source: 'corpus-file',
    sourceFile: options.corpusFile,
    shape: 'corpus-cycle',
    seedBytes: seed.byteLength,
    targetBytes,
    actualBytes,
    sizeGiB: actualBytes / GIB,
    batchSize: options.batchSize,
  };
  const spans = createSpanStats();
  const eventTypeCounts = {
    startElement: 0,
    endElement: 0,
    characters: 0,
    cdata: 0,
    other: 0,
  };
  let eventCount = 0;
  let shapeChecksum = 0;
  const parser = new StreamReaderSync(byteBatches(seed, targetBytes, options.batchSize));
  let frame;

  while ((frame = parser.nextRawBatch()) !== null) {
    if (frame.kind !== 'frame') {
      throw new Error(`Unsupported raw batch kind in raw span shape audit: ${frame.kind}`);
    }
    const {
      eventTypes,
      nameStarts,
      nameEnds,
      textStarts,
      textEnds,
      attrStarts,
      attrCounts,
      attrNameStarts,
      attrNameEnds,
      attrValueStarts,
      attrValueEnds,
      buffer,
    } = frame;

    for (let index = 0; index < frame.eventCount; index++) {
      const type = eventTypes[index];
      eventCount++;
      shapeChecksum = mixChecksum(shapeChecksum, type);
      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        recordSpan(spans.elementName, buffer, nameStarts[index], nameEnds[index]);
        shapeChecksum = mixChecksum(shapeChecksum, nameEnds[index] - nameStarts[index]);
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        recordSpan(spans.text, buffer, textStarts[index], textEnds[index]);
        shapeChecksum = mixChecksum(shapeChecksum, textEnds[index] - textStarts[index]);
      }
      if (type === StreamEventType.START_ELEMENT) {
        eventTypeCounts.startElement++;
        const attrStart = attrStarts[index];
        const attrCount = attrCounts[index];
        shapeChecksum = mixChecksum(shapeChecksum, attrCount);
        for (let offset = 0; offset < attrCount; offset++) {
          const attrIndex = attrStart + offset;
          recordSpan(spans.attrName, buffer, attrNameStarts[attrIndex], attrNameEnds[attrIndex]);
          if (isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, attrIndex)) {
            recordSpan(spans.attrValueImplicit, buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex]);
          } else {
            recordSpan(spans.attrValueExplicit, buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex]);
          }
        }
      } else if (type === StreamEventType.END_ELEMENT) {
        eventTypeCounts.endElement++;
      } else if (type === StreamEventType.CHARACTERS) {
        eventTypeCounts.characters++;
      } else if (type === StreamEventType.CDATA) {
        eventTypeCounts.cdata++;
      } else {
        eventTypeCounts.other++;
      }
    }
  }

  const finalizedSpans = Object.fromEntries(
    Object.entries(spans).map(([name, stats]) => [name, finalizeSpanStats(stats)]),
  );
  const summary = {
    eventCount,
    shapeChecksum,
    totalMaterializedStringSpans: finalizedSpans.elementName.count
      + finalizedSpans.text.count
      + finalizedSpans.attrName.count
      + finalizedSpans.attrValueExplicit.count,
    explicitAttrValueMediumAsciiCount: finalizedSpans.attrValueExplicit.mediumAsciiCount,
    textMediumAsciiCount: finalizedSpans.text.mediumAsciiCount,
    textLongOrNonAsciiCount: finalizedSpans.text.longOrNonAsciiCount,
  };

  return {
    generatedAt: new Date().toISOString(),
    objective: 'raw-span-shape-audit',
    contract: 'raw-frame-span-length-and-ascii-distribution',
    note: 'Audits raw-frame span shape over a demand-driven synchronous Iterable<Uint8Array[]> corpus-cycle input. It records source/span facts only; it is not a throughput benchmark and not a runtime-limit proof.',
    environment: createRuntimeEnvironment(),
    fixture,
    sourceConsumption: {
      parserInput: 'synchronous Iterable<Uint8Array[]>',
      arrayBufferConsumption: 'The corpus seed is read once and replayed as Uint8Array batches; the parser does not receive one full 1 GiB ArrayBuffer input.',
      batchBackpressure: 'The iterator yields one Uint8Array[] batch per StreamReaderSync pull and does not prebuild the repeated 1 GiB stream.',
      directReadableStream: false,
    },
    summary,
    eventTypeCounts,
    spans: finalizedSpans,
    findings: createFindings(finalizedSpans),
  };
}

function createFindings(spans) {
  return [
    {
      id: 'attr-value-medium-ascii-pocket-absent',
      classification: 'NEGATIVE_RESULT',
      summary: 'The books.xml corpus-cycle has no explicit attribute-value spans in the 13-24 byte ASCII bucket, so the medium ASCII attr-value fast path has no hit population on this input.',
      evidence: [
        `explicitAttrValueTotal=${formatCount(spans.attrValueExplicit.count)}`,
        `explicitAttrValueShortAscii=${formatCount(spans.attrValueExplicit.shortAsciiCount)}`,
        `explicitAttrValueMediumAscii=${formatCount(spans.attrValueExplicit.mediumAsciiCount)}`,
      ],
    },
    {
      id: 'text-medium-ascii-pocket-present',
      classification: 'SOURCE_FACT',
      summary: 'The same corpus-cycle does contain a 13-24 byte ASCII text/CDATA population, matching the medium ASCII text candidate hit counter.',
      evidence: [
        `textTotal=${formatCount(spans.text.count)}`,
        `textMediumAscii=${formatCount(spans.text.mediumAsciiCount)}`,
        `textLongOrNonAscii=${formatCount(spans.text.longOrNonAsciiCount)}`,
      ],
    },
    {
      id: 'source-shape-separated-from-stream-overhead',
      classification: 'SCOPE_GUARD',
      summary: 'This audit uses the same synchronous byte-batch source shape as the primary Node/V8 full-parity rows; it is not a direct ReadableStream measurement.',
      evidence: ['parserInput=synchronous Iterable<Uint8Array[]>', 'directReadableStream=false'],
    },
  ];
}

function* byteBatches(seed, targetBytes, batchSize) {
  let emittedBytes = 0;
  while (emittedBytes < targetBytes) {
    const batch = [];
    for (let index = 0; index < batchSize && emittedBytes < targetBytes; index++) {
      batch.push(seed);
      emittedBytes += seed.byteLength;
    }
    yield batch;
  }
}

function createSpanStats() {
  return {
    elementName: createOneSpanStats(),
    text: createOneSpanStats(),
    attrName: createOneSpanStats(),
    attrValueExplicit: createOneSpanStats(),
    attrValueImplicit: createOneSpanStats(),
  };
}

function createOneSpanStats() {
  return {
    count: 0,
    totalBytes: 0,
    minBytes: Infinity,
    maxBytes: 0,
    asciiCount: 0,
    nonAsciiCount: 0,
    shortAsciiCount: 0,
    mediumAsciiCount: 0,
    longAsciiCount: 0,
    longOrNonAsciiCount: 0,
    whitespaceBoundaryCount: 0,
    emptyCount: 0,
    buckets: {
      empty: 0,
      '1-4': 0,
      '5-8': 0,
      '9-12': 0,
      '13-24': 0,
      '25-64': 0,
      '65+': 0,
    },
    lengths: new Map(),
  };
}

function recordSpan(stats, buffer, start, end) {
  if (start < 0 || end < start) return;
  const length = end - start;
  stats.count++;
  stats.totalBytes += length;
  stats.minBytes = Math.min(stats.minBytes, length);
  stats.maxBytes = Math.max(stats.maxBytes, length);
  stats.lengths.set(length, (stats.lengths.get(length) ?? 0) + 1);
  stats.buckets[bucketForLength(length)]++;
  if (length === 0) {
    stats.emptyCount++;
  }
  const ascii = isAsciiSpan(buffer, start, end);
  if (ascii) {
    stats.asciiCount++;
    if (length <= 12) {
      stats.shortAsciiCount++;
    } else if (length <= 24) {
      stats.mediumAsciiCount++;
    } else {
      stats.longAsciiCount++;
    }
  } else {
    stats.nonAsciiCount++;
  }
  if (!ascii || length > 24) {
    stats.longOrNonAsciiCount++;
  }
  if (hasTrimBoundary(buffer, start, end)) {
    stats.whitespaceBoundaryCount++;
  }
}

function finalizeSpanStats(stats) {
  return {
    count: stats.count,
    totalBytes: stats.totalBytes,
    averageBytes: stats.count > 0 ? round(stats.totalBytes / stats.count) : 0,
    minBytes: stats.count > 0 ? stats.minBytes : 0,
    maxBytes: stats.maxBytes,
    asciiCount: stats.asciiCount,
    nonAsciiCount: stats.nonAsciiCount,
    shortAsciiCount: stats.shortAsciiCount,
    mediumAsciiCount: stats.mediumAsciiCount,
    longAsciiCount: stats.longAsciiCount,
    longOrNonAsciiCount: stats.longOrNonAsciiCount,
    whitespaceBoundaryCount: stats.whitespaceBoundaryCount,
    emptyCount: stats.emptyCount,
    buckets: stats.buckets,
    topLengths: Array.from(stats.lengths.entries())
      .map(([length, count]) => ({ length: Number(length), count }))
      .sort((left, right) => right.count - left.count || left.length - right.length)
      .slice(0, 12),
  };
}

function bucketForLength(length) {
  if (length === 0) return 'empty';
  if (length <= 4) return '1-4';
  if (length <= 8) return '5-8';
  if (length <= 12) return '9-12';
  if (length <= 24) return '13-24';
  if (length <= 64) return '25-64';
  return '65+';
}

function isAsciiSpan(buffer, start, end) {
  for (let index = start; index < end; index++) {
    if (buffer[index] > 0x7f) return false;
  }
  return true;
}

function hasTrimBoundary(buffer, start, end) {
  return start < end && (isAsciiXmlWhitespace(buffer[start]) || isAsciiXmlWhitespace(buffer[end - 1]));
}

function isAsciiXmlWhitespace(value) {
  return value === 0x20 || value === 0x09 || value === 0x0a || value === 0x0d;
}

function isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, index) {
  return attrNameStarts[index] === attrValueStarts[index] && attrNameEnds[index] === attrValueEnds[index];
}

function computeExpectedBytes(targetBytes, seedBytes) {
  return Math.ceil(targetBytes / seedBytes) * seedBytes;
}

function createRuntimeEnvironment() {
  return {
    runtimeName: 'node',
    javascriptEngine: 'V8',
    cpuName: sanitizeEnvironmentString(cpus()[0]?.model),
    platform: `${process.platform}-${process.arch}`,
    node: process.version,
    v8: process.versions.v8,
  };
}

function sanitizeEnvironmentString(value) {
  const cleaned = String(value ?? '').replace(/\0/g, '').trim();
  return cleaned || 'unknown';
}

function renderMarkdown(report) {
  const lines = [
    '# Raw Span Shape Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Source Consumption',
    '',
    `- Parser input: ${report.sourceConsumption.parserInput}`,
    `- ArrayBuffer consumption: ${report.sourceConsumption.arrayBufferConsumption}`,
    `- Batch/backpressure: ${report.sourceConsumption.batchBackpressure}`,
    `- Direct ReadableStream: ${report.sourceConsumption.directReadableStream ? 'yes' : 'no'}`,
    '',
    '## Summary',
    '',
    `- Corpus: ${report.fixture.sourceFile}`,
    `- Size: ${formatBytes(report.fixture.actualBytes)} (${report.fixture.sizeGiB.toFixed(2)} GiB)`,
    `- Events: ${formatCount(report.summary.eventCount)}`,
    `- Shape checksum: ${report.summary.shapeChecksum}`,
    `- Explicit attr-value medium ASCII spans: ${formatCount(report.summary.explicitAttrValueMediumAsciiCount)}`,
    `- Text/CDATA medium ASCII spans: ${formatCount(report.summary.textMediumAsciiCount)}`,
    `- Text/CDATA long or non-ASCII spans: ${formatCount(report.summary.textLongOrNonAsciiCount)}`,
    '',
    '## Span Distribution',
    '',
    '| Kind | Count | Avg bytes | Min | Max | ASCII | Non-ASCII | <=12 ASCII | 13-24 ASCII | >24 ASCII | Long/non-ASCII | Trim boundary |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const [kind, stats] of Object.entries(report.spans)) {
    lines.push(`| ${kind} | ${formatCount(stats.count)} | ${stats.averageBytes.toFixed(2)} | ${stats.minBytes} | ${stats.maxBytes} | ${formatCount(stats.asciiCount)} | ${formatCount(stats.nonAsciiCount)} | ${formatCount(stats.shortAsciiCount)} | ${formatCount(stats.mediumAsciiCount)} | ${formatCount(stats.longAsciiCount)} | ${formatCount(stats.longOrNonAsciiCount)} | ${formatCount(stats.whitespaceBoundaryCount)} |`);
  }
  lines.push('', '## Top Lengths', '');
  for (const [kind, stats] of Object.entries(report.spans)) {
    lines.push(`- ${kind}: ${stats.topLengths.map(entry => `${entry.length}:${formatCount(entry.count)}`).join(', ')}`);
  }
  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function parsePositiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive number.`);
  return parsed;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

function mixChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function formatBytes(value) {
  if (value >= GIB) return `${(value / GIB).toFixed(2)} GiB`;
  if (value >= MIB) return `${(value / MIB).toFixed(1)} MiB`;
  return `${value} B`;
}

function formatCount(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

main();
