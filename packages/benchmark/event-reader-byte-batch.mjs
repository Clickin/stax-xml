import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventReader, XmlEventType, createEventReaderFromAsyncByteBatches } from 'stax-xml';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'event-reader-byte-batch.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'event-reader-byte-batch.md');
const packageVersion = JSON.parse(readFileSync(resolve(__dirname, '../stax-xml/package.json'), 'utf8')).version;
const encoder = new TextEncoder();

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizeGiB: 1,
    runs: 1,
    warmups: 0,
    diverseCycleSize: 4096,
    batchSizes: [1, 16, 64],
    boundedRssMiB: 512,
    runtimeLabel: null,
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
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), name);
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--diverse-cycle-size':
        options.diverseCycleSize = parsePositiveInteger(readValue(), name);
        break;
      case '--batch-sizes':
        options.batchSizes = parsePositiveIntegerList(readValue(), name);
        break;
      case '--bounded-rss-mib':
        options.boundedRssMiB = parsePositiveNumber(readValue(), name);
        break;
      case '--runtime-label':
        options.runtimeLabel = readValue();
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

function parsePositiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive number.`);
  return parsed;
}

function parsePositiveIntegerList(value, flag) {
  const parsed = value.split(',').map(entry => parsePositiveInteger(entry.trim(), flag));
  if (parsed.length === 0) throw new Error(`${flag} must contain at least one value.`);
  return parsed;
}

async function main() {
  const options = parseArgs();
  const fixture = createFixture(options);
  const variants = [
    ...options.batchSizes.map(batchSize => ({
      id: `readableStreamBatch${batchSize}`,
      family: 'readable-stream',
      batchSize,
      implementation: `EventReader over ReadableStream with internal byte batch size ${batchSize}`,
      run: () => consumeReadableStream(fixture, batchSize),
    })),
    ...options.batchSizes.filter(batchSize => batchSize > 1).map(batchSize => ({
      id: `asyncByteBatch${batchSize}`,
      family: 'async-byte-batch',
      batchSize,
      implementation: `createEventReaderFromAsyncByteBatches with ${batchSize} chunks yielded per await`,
      run: () => consumeAsyncByteBatches(fixture, batchSize),
    })),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'event-reader-byte-batch',
    contract: 'public-event-object-full-string-checksum',
    note: 'Compares direct ReadableStream chunk consumption with an AsyncIterable<Uint8Array[]> source that yields already-grouped byte batches. Both sources are demand-driven and do not enqueue/read the next batch until the reader asks for it.',
    environment: createEnvironment(options.runtimeLabel),
    options: {
      sizeGiB: options.sizeGiB,
      runs: options.runs,
      warmups: options.warmups,
      diverseCycleSize: options.diverseCycleSize,
      batchSizes: options.batchSizes,
      boundedRssMiB: options.boundedRssMiB,
      runtimeLabel: options.runtimeLabel,
    },
    fixture: {
      source: 'generated-diverse-cycle',
      targetBytes: fixture.targetBytes,
      actualBytes: fixture.actualBytes,
      sizeGiB: fixture.actualBytes / GIB,
      rows: fixture.rows.length,
    },
    variants: [],
    findings: [],
  };

  for (const variant of variants) {
    report.variants.push(await measureVariant(variant, fixture, options));
  }
  report.findings = createFindings(report);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

async function measureVariant(variant, fixture, options) {
  for (let index = 0; index < options.warmups; index++) {
    await variant.run();
  }

  const samplesMs = [];
  const memorySamples = [];
  let first;
  for (let index = 0; index < options.runs; index++) {
    forceGc();
    const before = takeMemorySnapshot();
    const startedAt = performance.now();
    const result = await variant.run();
    const elapsedMs = performance.now() - startedAt;
    const after = takeMemorySnapshot();
    if (first && (first.eventCount !== result.eventCount || first.checksum !== result.checksum)) {
      throw new Error(`${variant.id} produced unstable event count or checksum.`);
    }
    first ??= result;
    samplesMs.push(elapsedMs);
    memorySamples.push({ before, after });
  }

  const avgMs = average(samplesMs);
  const maxRssBytes = Math.max(...memorySamples.map(sample => sample.after.rssBytes));
  const maxHeapUsedBytes = Math.max(...memorySamples.map(sample => sample.after.heapUsedBytes));
  return {
    id: variant.id,
    family: variant.family,
    implementation: variant.implementation,
    batchSize: variant.batchSize,
    fullStringParity: true,
    eventCountKind: 'stream-events',
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    mibPerSec: bytesToMiB(fixture.actualBytes) / (avgMs / 1000),
    samplesMs,
    eventCount: first.eventCount,
    checksum: first.checksum,
    sourceReads: first.sourceReads,
    sourceBatches: first.sourceBatches,
    boundedMemory: maxRssBytes <= options.boundedRssMiB * MIB,
    memory: {
      maxRssBytes,
      maxHeapUsedBytes,
    },
  };
}

async function consumeReadableStream(fixture, batchSize) {
  const counters = { reads: 0, batches: 0 };
  return consumeEventReader(
    new EventReader(createBackpressuredReadableStream(fixture, counters), { batchSize }),
    counters,
  );
}

async function consumeAsyncByteBatches(fixture, batchSize) {
  const counters = { reads: 0, batches: 0 };
  return consumeEventReader(
    createEventReaderFromAsyncByteBatches(createAsyncByteBatchSource(fixture, batchSize, counters)),
    counters,
  );
}

async function consumeEventReader(reader, counters) {
  let eventCount = 0;
  let checksum = 0;
  for await (const event of reader) {
    eventCount++;
    checksum = foldEvent(checksum, event);
  }
  return {
    eventCount,
    checksum,
    sourceReads: counters.reads,
    sourceBatches: counters.batches,
  };
}

function createBackpressuredReadableStream(fixture, counters) {
  let emittedBytes = 0;
  let rowIndex = 0;
  return new ReadableStream({
    pull(controller) {
      counters.reads++;
      if (emittedBytes >= fixture.targetBytes) {
        controller.close();
        return;
      }
      const row = fixture.rows[rowIndex % fixture.rows.length];
      rowIndex++;
      emittedBytes += row.byteLength;
      counters.batches++;
      controller.enqueue(row);
    },
  });
}

async function* createAsyncByteBatchSource(fixture, batchSize, counters) {
  let emittedBytes = 0;
  let rowIndex = 0;
  while (emittedBytes < fixture.targetBytes) {
    const batch = [];
    for (let index = 0; index < batchSize && emittedBytes < fixture.targetBytes; index++) {
      const row = fixture.rows[rowIndex % fixture.rows.length];
      rowIndex++;
      emittedBytes += row.byteLength;
      counters.reads++;
      batch.push(row);
    }
    counters.batches++;
    yield batch;
  }
}

function foldEvent(checksum, event) {
  checksum = mix(checksum, publicEventTypeCode(event.type));
  if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
    checksum = foldString(checksum, event.name);
  }
  if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
    checksum = foldString(checksum, event.value?.trim());
  }
  if (event.type === XmlEventType.START_ELEMENT) {
    const entries = Object.entries(event.attributes);
    checksum = mix(checksum, entries.length);
    for (const [name, value] of entries) {
      checksum = foldString(checksum, name);
      checksum = foldString(checksum, value);
    }
  }
  return checksum;
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
      return 99;
  }
}

function foldString(checksum, value) {
  if (!value) return mix(checksum, 0);
  let next = mix(checksum, value.length);
  for (let index = 0; index < value.length; index++) {
    next = mix(next, value.charCodeAt(index));
  }
  return next;
}

function mix(checksum, value) {
  return ((checksum * 31 + value) | 0);
}

function createFixture(options) {
  const targetBytes = Math.floor(options.sizeGiB * GIB);
  const rows = Array.from({ length: options.diverseCycleSize }, (_, id) => encoder.encode(makeDiverseRow(id)));
  const cycleBytes = rows.reduce((sum, row) => sum + row.byteLength, 0);
  let actualBytes = Math.floor(targetBytes / cycleBytes) * cycleBytes;
  for (let index = 0; actualBytes < targetBytes; index++) {
    actualBytes += rows[index % rows.length].byteLength;
  }
  return { rows, targetBytes, actualBytes };
}

function makeDiverseRow(id) {
  const rootNames = ['person', 'record', 'entry', 'invoice', 'profile', 'asset', 'sample'];
  const childNames = ['name', 'title', 'summary', 'note', 'group', 'bucket', 'payload'];
  const rootName = `${rootNames[id % rootNames.length]}${id % 257}`;
  const childA = `${childNames[id % childNames.length]}${(id * 3) % 193}`;
  const childB = `${childNames[(id + 2) % childNames.length]}${(id * 5) % 197}`;
  const attrA = `data${id % 997}`;
  const attrB = `code${(id * 11) % 991}`;
  return `<${rootName} id="item-${id}" ${attrA}="value-${(id * 31) % 65521}" ${attrB}="group-${id % 4093}">`
    + `<${childA}>Runtime Benchmark ${id}</${childA}>`
    + `<${childB} rank="${id % 29}">Full string checksum payload ${(id * 8191) % 104729}</${childB}>`
    + `</${rootName}>`;
}

function createEnvironment(runtimeLabel) {
  const runtimeName = typeof Bun !== 'undefined' ? 'bun' : 'node';
  return {
    packageVersion,
    runtimeName,
    runtimeLabel: runtimeLabel ?? (runtimeName === 'bun' ? 'Bun/JSC' : 'Node/V8'),
    nodeVersion: process.version,
    bunVersion: typeof Bun !== 'undefined' ? Bun.version : null,
    v8Version: process.versions.v8 ?? null,
    webkitVersion: process.versions.webkit ?? null,
    platform: `${process.platform}-${process.arch}`,
    cpu: cpus()[0]?.model ?? 'unknown',
  };
}

function createFindings(report) {
  const comparedBatchSize = report.options.batchSizes.find(batchSize =>
    batchSize > 1
    && report.variants.some(row => row.id === `readableStreamBatch${batchSize}`)
    && report.variants.some(row => row.id === `asyncByteBatch${batchSize}`)
  );
  const readable = comparedBatchSize
    ? report.variants.find(row => row.id === `readableStreamBatch${comparedBatchSize}`)
    : undefined;
  const asyncBatch = comparedBatchSize
    ? report.variants.find(row => row.id === `asyncByteBatch${comparedBatchSize}`)
    : undefined;
  return [
    {
      id: 'backpressure-preserved',
      classification: 'SOURCE_FACT',
      summary: 'Both benchmark sources are demand-driven. The ReadableStream source enqueues in pull(), and the async byte-batch source yields one batch only when next() is awaited.',
      evidence: report.variants.map(row => `${row.id}: sourceReads=${row.sourceReads}, sourceBatches=${row.sourceBatches}`),
    },
    readable && asyncBatch
      ? {
          id: 'async-byte-batch-headroom',
          classification: 'BENCH_FACT',
          summary: `At batch size ${comparedBatchSize}, async byte batches were ${(asyncBatch.mibPerSec / readable.mibPerSec).toFixed(2)}x the ReadableStream row on this run.`,
          evidence: [
            `readableStreamBatch${comparedBatchSize}=${readable.mibPerSec.toFixed(2)} MiB/s`,
            `asyncByteBatch${comparedBatchSize}=${asyncBatch.mibPerSec.toFixed(2)} MiB/s`,
          ],
        }
      : null,
  ].filter(Boolean);
}

function renderMarkdown(report) {
  const lines = [
    '# EventReader Byte Batch Benchmark',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Options',
    '',
    `- Size GiB: ${report.options.sizeGiB}`,
    `- Runs: ${report.options.runs}`,
    `- Warmups: ${report.options.warmups}`,
    `- Runtime: ${report.environment.runtimeLabel}`,
    `- Diverse cycle size: ${report.options.diverseCycleSize}`,
    `- Batch sizes: ${report.options.batchSizes.join(', ')}`,
    `- Bounded RSS gate: ${formatMiB(report.options.boundedRssMiB * MIB)}`,
    '',
    '## Results',
    '',
    '| Variant | Family | Batch size | Throughput | Events | Checksum | Source reads | Source batches | Bounded | Max RSS |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |',
  ];
  for (const row of report.variants) {
    lines.push(`| ${row.id} | ${row.family} | ${row.batchSize} | ${row.mibPerSec.toFixed(2)} MiB/s | ${row.eventCount} | ${row.checksum} | ${row.sourceReads} | ${row.sourceBatches} | ${row.boundedMemory ? 'yes' : 'no'} | ${formatMiB(row.memory.maxRssBytes)} |`);
  }
  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const item of finding.evidence) {
      lines.push(`  - ${item}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function printSummary(report) {
  console.log('EventReader byte batch benchmark');
  for (const row of report.variants) {
    console.log(`${row.id.padEnd(24)} ${row.mibPerSec.toFixed(2)} MiB/s reads=${row.sourceReads} batches=${row.sourceBatches}`);
  }
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  console.log(`Wrote ${filePath}`);
}

function forceGc() {
  if (typeof globalThis.gc === 'function') globalThis.gc();
}

function takeMemorySnapshot() {
  const memory = process.memoryUsage();
  return {
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
  };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bytesToMiB(value) {
  return value / MIB;
}

function formatMiB(value) {
  return `${bytesToMiB(value).toFixed(1)} MiB`;
}

void main();
