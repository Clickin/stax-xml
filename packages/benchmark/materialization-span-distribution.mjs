import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StreamEventType, StreamReaderSync } from 'stax-xml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const defaultCorpusFile = resolve(__dirname, 'assets', 'books.xml');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'materialization-span-distribution-books-corpus.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'materialization-span-distribution-books-corpus.md');

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
  return options;
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

function main() {
  const options = parseArgs();
  const report = createReport(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`materialization-span-distribution: text=${report.summary.text.total} attrValue=${report.summary.attrValue.total}`);
}

function createReport(options) {
  const corpusBytes = new Uint8Array(readFileSync(options.corpusFile));
  if (corpusBytes.byteLength === 0) throw new Error(`Corpus fixture is empty: ${options.corpusFile}`);
  const targetBytes = options.sizeGiB * GIB;
  const parser = new StreamReaderSync(byteBatches(corpusBytes, targetBytes, options.batchSize));
  const stats = createStats();
  let eventCount = 0;
  let frame;
  while ((frame = parser.nextRawBatch()) !== null) {
    if (frame.kind !== 'frame') throw new Error(`Unsupported raw batch kind: ${frame.kind}`);
    eventCount += frame.eventCount;
    recordFrame(frame, stats);
  }
  const summary = summarizeStats(stats);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'materialization-span-distribution',
    contract: 'same-raw-frame-materialization-span-distribution',
    note: 'Counts raw UTF-8 span length, ASCII, and trim properties for full-string materialization fields. This is distribution evidence for candidate selection, not throughput evidence and not a runtime-limit proof.',
    sourceContract: {
      parserInput: 'StreamReaderSync over synchronous Iterable<Uint8Array[]> corpus-cycle batches.',
      fullArrayBufferParserInput: false,
      directReadableStream: false,
      demandDrivenSource: true,
      corpusCycle: 'The corpus seed is replayed as parser byte batches until the target byte size is reached, matching candidate-headroom-large corpus-cycle semantics.',
    },
    options: {
      sizeGiB: options.sizeGiB,
      corpusFile: options.corpusFile,
      batchSize: options.batchSize,
      corpusBytes: corpusBytes.byteLength,
      targetBytes,
    },
    eventCount,
    summary,
    findings: createFindings(summary),
  };
}

function* byteBatches(corpusBytes, targetBytes, batchSize) {
  let emittedBytes = 0;
  while (emittedBytes < targetBytes) {
    const batch = [];
    for (let index = 0; index < batchSize && emittedBytes < targetBytes; index++) {
      batch.push(corpusBytes);
      emittedBytes += corpusBytes.byteLength;
    }
    yield batch;
  }
}

function createStats() {
  return {
    text: createKindStats(),
    attrValue: createKindStats(),
    attrName: createKindStats(),
    name: createKindStats(),
    implicitAttrValueCount: 0,
    attributePairCount: 0,
  };
}

function createKindStats() {
  return {
    total: 0,
    ascii: 0,
    nonAscii: 0,
    shortAscii: 0,
    mediumAscii: 0,
    longAscii: 0,
    trimUnchanged: 0,
    trimChanged: 0,
    empty: 0,
    minLength: null,
    maxLength: 0,
    totalBytes: 0,
    buckets: {
      '0': 0,
      '1-12': 0,
      '13-24': 0,
      '25-64': 0,
      '65-256': 0,
      '257+': 0,
    },
  };
}

function recordFrame(frame, stats) {
  const {
    buffer,
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
  } = frame;

  for (let eventIndex = 0; eventIndex < frame.eventCount; eventIndex++) {
    const type = eventTypes[eventIndex];
    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      recordSpan(stats.name, buffer, nameStarts[eventIndex], nameEnds[eventIndex], false);
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      const start = textStarts[eventIndex];
      if (start >= 0) recordSpan(stats.text, buffer, start, textEnds[eventIndex], true);
    }
    if (type === StreamEventType.START_ELEMENT) {
      const start = attrStarts[eventIndex];
      const end = start + attrCounts[eventIndex];
      stats.attributePairCount += attrCounts[eventIndex];
      for (let attrIndex = start; attrIndex < end; attrIndex++) {
        recordSpan(stats.attrName, buffer, attrNameStarts[attrIndex], attrNameEnds[attrIndex], false);
        if (isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, attrIndex)) {
          stats.implicitAttrValueCount++;
          continue;
        }
        recordSpan(stats.attrValue, buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex], false);
      }
    }
  }
}

function isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, index) {
  return attrNameStarts[index] === attrValueStarts[index] && attrNameEnds[index] === attrValueEnds[index];
}

function recordSpan(stats, buffer, start, end, countTrim) {
  const length = end - start;
  stats.total++;
  stats.totalBytes += length;
  stats.minLength = stats.minLength === null ? length : Math.min(stats.minLength, length);
  stats.maxLength = Math.max(stats.maxLength, length);
  stats.buckets[lengthBucket(length)]++;
  if (length === 0) stats.empty++;
  const ascii = isAsciiSpan(buffer, start, end);
  if (ascii) {
    stats.ascii++;
    if (length <= 12) stats.shortAscii++;
    else if (length <= 24) stats.mediumAscii++;
    else stats.longAscii++;
  } else {
    stats.nonAscii++;
  }
  if (countTrim) {
    const [trimmedStart, trimmedEnd] = trimAsciiWhitespace(buffer, start, end);
    if (trimmedStart === start && trimmedEnd === end) stats.trimUnchanged++;
    else stats.trimChanged++;
  }
}

function lengthBucket(length) {
  if (length === 0) return '0';
  if (length <= 12) return '1-12';
  if (length <= 24) return '13-24';
  if (length <= 64) return '25-64';
  if (length <= 256) return '65-256';
  return '257+';
}

function isAsciiSpan(buffer, start, end) {
  for (let index = start; index < end; index++) {
    if (buffer[index] > 0x7f) return false;
  }
  return true;
}

function trimAsciiWhitespace(buffer, start, end) {
  let trimmedStart = start;
  let trimmedEnd = end;
  while (trimmedStart < trimmedEnd && isAsciiXmlWhitespace(buffer[trimmedStart])) trimmedStart++;
  while (trimmedEnd > trimmedStart && isAsciiXmlWhitespace(buffer[trimmedEnd - 1])) trimmedEnd--;
  return [trimmedStart, trimmedEnd];
}

function isAsciiXmlWhitespace(value) {
  return value === 0x20 || value === 0x09 || value === 0x0a || value === 0x0d;
}

function summarizeStats(stats) {
  return {
    attributePairCount: stats.attributePairCount,
    implicitAttrValueCount: stats.implicitAttrValueCount,
    name: summarizeKind(stats.name),
    text: summarizeKind(stats.text),
    attrName: summarizeKind(stats.attrName),
    attrValue: summarizeKind(stats.attrValue),
  };
}

function summarizeKind(stats) {
  return {
    ...stats,
    averageLength: stats.total > 0 ? stats.totalBytes / stats.total : 0,
    asciiRatio: ratio(stats.ascii, stats.total),
    shortAsciiRatio: ratio(stats.shortAscii, stats.total),
    mediumAsciiRatio: ratio(stats.mediumAscii, stats.total),
    longAsciiRatio: ratio(stats.longAscii, stats.total),
    trimChangedRatio: ratio(stats.trimChanged, stats.trimChanged + stats.trimUnchanged),
  };
}

function ratio(value, total) {
  return total > 0 ? value / total : 0;
}

function createFindings(summary) {
  return [
    {
      id: 'text-medium-ascii-candidate-coverage',
      classification: 'SOURCE_FACT',
      summary: 'Text spans have a measurable 13-24 byte ASCII cohort, so medium/unrolled ASCII text candidates exercise real corpus data.',
      evidence: [
        `text.mediumAscii=${summary.text.mediumAscii}`,
        `text.mediumAsciiRatio=${formatPercent(summary.text.mediumAsciiRatio)}`,
        `text.trimChanged=${summary.text.trimChanged}`,
      ],
    },
    {
      id: 'attr-value-medium-ascii-candidate-coverage',
      classification: summary.attrValue.mediumAscii === 0 ? 'NEGATIVE_RESULT' : 'SOURCE_FACT',
      summary: summary.attrValue.mediumAscii === 0
        ? 'Attribute values have no 13-24 byte ASCII spans in this corpus-cycle fixture, so the medium ASCII attr-value candidate is not expected to hit.'
        : 'Attribute values include 13-24 byte ASCII spans in this corpus-cycle fixture.',
      evidence: [
        `attrValue.mediumAscii=${summary.attrValue.mediumAscii}`,
        `attrValue.shortAscii=${summary.attrValue.shortAscii}`,
        `attrValue.longAscii=${summary.attrValue.longAscii}`,
      ],
    },
    {
      id: 'distribution-artifact-scope',
      classification: 'SCOPE_GUARD',
      summary: 'This artifact describes materialization span shape only; it is not a throughput benchmark or runtime-limit proof.',
      evidence: ['No MiB/s row is emitted.', 'No 200 MiB/s counterexample can be inferred from this artifact alone.'],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Materialization Span Distribution');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(report.note);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Event count: ${formatCount(report.eventCount)}`);
  lines.push(`- Attribute pairs: ${formatCount(report.summary.attributePairCount)}`);
  lines.push(`- Implicit attribute values: ${formatCount(report.summary.implicitAttrValueCount)}`);
  lines.push('');
  lines.push('| Kind | Total | ASCII | 1-12 ASCII | 13-24 ASCII | 25+ ASCII | Non-ASCII | Avg bytes | Trim changed |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const kind of ['name', 'text', 'attrName', 'attrValue']) {
    const row = report.summary[kind];
    lines.push(`| ${kind} | ${formatCount(row.total)} | ${formatPercent(row.asciiRatio)} | ${formatCount(row.shortAscii)} | ${formatCount(row.mediumAscii)} | ${formatCount(row.longAscii)} | ${formatCount(row.nonAscii)} | ${row.averageLength.toFixed(2)} | ${formatPercent(row.trimChangedRatio)} |`);
  }
  lines.push('');
  lines.push('## Buckets');
  lines.push('');
  for (const kind of ['name', 'text', 'attrName', 'attrValue']) {
    lines.push(`- ${kind}: ${Object.entries(report.summary[kind].buckets).map(([bucket, count]) => `${bucket}=${formatCount(count)}`).join(', ')}`);
  }
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) lines.push(`  - ${evidence}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function formatCount(value) {
  return Number(value ?? 0).toLocaleString('en-US');
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function writeOutput(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

main();
