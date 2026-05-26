import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  StreamReaderSync,
  XmlEventType,
} from '../stax-xml/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultFile = join(__dirname, 'test-data', 'node-string-return-1024mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'file-backed-public-consumer-shape-sweep.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'file-backed-public-consumer-shape-sweep.md');
const defaultTmpDir = join(__dirname, 'results', 'tmp', 'file-backed-public-consumer-shape-sweep');
const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

const START_DOCUMENT = 0;
const END_DOCUMENT = 1;
const START_ELEMENT = 2;
const END_ELEMENT = 3;
const CHARACTERS = 4;
const CDATA = 5;

const variants = [
  'public-baseline',
  'public-no-optional-text',
  'public-switch-dispatch',
  'public-event-object',
  'public-event-object-stable-shape',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    mode: 'driver',
    file: defaultFile,
    variants: [...variants],
    variant: 'public-baseline',
    chunkKiB: 64,
    batchSize: 1,
    runs: 1,
    warmups: 0,
    boundedRssMiB: 512,
    tmpDir: defaultTmpDir,
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
      case '--mode':
        options.mode = parseChoice(readValue(), ['driver', 'run'], name);
        break;
      case '--file':
        options.file = resolve(process.cwd(), readValue());
        break;
      case '--variants':
        options.variants = parseList(readValue(), variants, name);
        break;
      case '--variant':
        options.variant = parseChoice(readValue(), variants, name);
        break;
      case '--chunk-kib':
        options.chunkKiB = parsePositiveInteger(readValue(), name);
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), name);
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), name);
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--bounded-rss-mib':
        options.boundedRssMiB = parsePositiveNumber(readValue(), name);
        break;
      case '--tmp-dir':
        options.tmpDir = resolve(process.cwd(), readValue());
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

  if (!existsSync(options.file)) {
    throw new Error(`Benchmark fixture does not exist: ${options.file}`);
  }
  return options;
}

function parseChoice(value, allowed, flag) {
  if (!allowed.includes(value)) throw new Error(`${flag} must be one of: ${allowed.join(', ')}`);
  return value;
}

function parseList(value, allowed, flag) {
  if (value === 'all') return [...allowed];
  const entries = value.split(',').map(entry => entry.trim()).filter(Boolean);
  if (entries.length === 0) throw new Error(`${flag} must not be empty.`);
  for (const entry of entries) {
    if (!allowed.includes(entry)) throw new Error(`${flag} contains unknown id ${entry}.`);
  }
  return entries;
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

function main() {
  const options = parseArgs();
  if (options.mode === 'run') {
    const report = runVariantProcess(options);
    console.log(JSON.stringify(report));
    return;
  }
  const report = runDriver(options);
  mkdirSync(dirname(options.jsonOut), { recursive: true });
  writeFileSync(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(options.mdOut, renderMarkdown(report), 'utf8');
  console.log(`file-backed-public-consumer-shape-sweep: rows=${report.rows.length} fastest=${report.summary.fastest?.id ?? 'n/a'} ${formatNumber(report.summary.fastest?.throughputMiBPerSec)} MiB/s`);
}

function runDriver(options) {
  mkdirSync(options.tmpDir, { recursive: true });
  const fileStats = statSync(options.file);
  const rows = [];
  for (const variant of options.variants) {
    const result = spawnSync(process.execPath, [
      '--expose-gc',
      fileURLToPath(import.meta.url),
      '--mode=run',
      `--file=${options.file}`,
      `--variant=${variant}`,
      `--chunk-kib=${options.chunkKiB}`,
      `--batch-size=${options.batchSize}`,
      `--runs=${options.runs}`,
      `--warmups=${options.warmups}`,
      `--bounded-rss-mib=${options.boundedRssMiB}`,
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      throw new Error(`Variant ${variant} failed: ${result.stderr || result.stdout}`);
    }
    const lines = result.stdout.trim().split(/\r?\n/);
    rows.push(JSON.parse(lines[lines.length - 1]));
  }

  const fastest = maxBy(rows, row => row.mibPerSec);
  const baseline = rows.find(row => row.id === 'public-baseline');
  return {
    generatedAt: new Date().toISOString(),
    objective: 'file-backed-public-consumer-shape-sweep',
    contract: 'same-full-string-checksum-public-streambatch-consumer-shapes',
    note: 'Runs public StreamBatch full-string checksum consumer variants in separate Node processes over the same file-backed Iterable<Uint8Array[]> source. This tests whether small JavaScript consumer-shape changes expose headroom without changing the StAX API or checksum contract.',
    environment: {
      node: process.version,
      v8: process.versions.v8,
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
    },
    fixture: {
      source: 'file-backed',
      path: options.file,
      sizeBytes: fileStats.size,
      sizeMiB: fileStats.size / MIB,
      sizeGiB: fileStats.size / GIB,
    },
    options: {
      variants: options.variants,
      chunkKiB: options.chunkKiB,
      batchSize: options.batchSize,
      runs: options.runs,
      warmups: options.warmups,
      boundedRssMiB: options.boundedRssMiB,
    },
    rows,
    summary: {
      rowCount: rows.length,
      fastest: summarizeRow(fastest),
      baseline: summarizeRow(baseline),
      fastestBaselineRatio: fastest && baseline ? fastest.mibPerSec / baseline.mibPerSec : null,
      counterexamples200MiB: rows.filter(row => row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200).length,
      checksumSet: [...new Set(rows.map(row => row.checksum))],
      eventCountSet: [...new Set(rows.map(row => row.eventCount))],
    },
    findings: createFindings(rows, baseline, fastest),
  };
}

function runVariantProcess(options) {
  const fileStats = statSync(options.file);
  for (let index = 0; index < options.warmups; index++) runVariant(options.variant, options);
  const samplesMs = [];
  const memorySamples = [];
  let eventCount = 0;
  let checksum = 0;
  let materializationCounters = null;
  for (let index = 0; index < options.runs; index++) {
    gcNow();
    const before = takeMemorySnapshot();
    const startedAt = performance.now();
    const result = runVariant(options.variant, options);
    const elapsedMs = performance.now() - startedAt;
    const after = takeMemorySnapshot();
    if (index > 0 && (eventCount !== result.eventCount || checksum !== result.checksum)) {
      throw new Error(`${options.variant} produced unstable event count or checksum.`);
    }
    eventCount = result.eventCount;
    checksum = result.checksum;
    materializationCounters = result.materializationCounters ?? null;
    samplesMs.push(elapsedMs);
    memorySamples.push({ before, after });
  }
  const avgMs = samplesMs.reduce((sum, value) => sum + value, 0) / samplesMs.length;
  const maxRssBytes = Math.max(...memorySamples.map(sample => sample.after.rssBytes));
  const maxHeapUsedBytes = Math.max(...memorySamples.map(sample => sample.after.heapUsedBytes));
  return {
    id: options.variant,
    tool: options.variant,
    implementation: describeVariant(options.variant),
    family: 'public-streambatch-consumer-shape',
    sourceMode: 'file-backed-sync-iterable-byte-batches',
    contractScope: 'full-string-checksum',
    fullStringParity: true,
    chunkKiB: options.chunkKiB,
    batchSize: options.batchSize,
    mibPerSec: (fileStats.size / MIB) / (avgMs / 1000),
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    samplesMs,
    eventCount,
    checksum,
    materializationCounters,
    boundedMemory: maxRssBytes <= options.boundedRssMiB * 1024 * 1024,
    memory: {
      maxRssBytes,
      maxHeapUsedBytes,
      samples: memorySamples,
    },
  };
}

function runVariant(variant, options) {
  const batches = createFileByteBatches(options.file, options.chunkKiB * 1024, options.batchSize);
  switch (variant) {
    case 'public-baseline':
      return consumePublicBaseline(batches);
    case 'public-no-optional-text':
      return consumePublicNoOptionalText(batches);
    case 'public-switch-dispatch':
      return consumePublicSwitchDispatch(batches);
    case 'public-event-object':
      return consumePublicEventObject(batches);
    case 'public-event-object-stable-shape':
      return consumePublicEventObjectStableShape(batches);
    default:
      throw new Error(`Unknown variant: ${variant}`);
  }
}

function consumePublicBaseline(bytes) {
  let eventCount = 0;
  let checksum = 0;
  for (const batch of new StreamReaderSync(bytes)) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const type = batch.typeAt(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);
      if (type === START_ELEMENT || type === END_ELEMENT) {
        checksum = foldString(checksum, batch.nameAt(index));
      }
      if (type === CHARACTERS || type === CDATA) {
        checksum = foldString(checksum, batch.textAt(index)?.trim());
      }
      if (type === START_ELEMENT) {
        const attrCount = batch.attributeCountAt(index);
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          checksum = foldString(checksum, batch.attributeNameAt(index, attrIndex));
          checksum = foldString(checksum, batch.attributeValueAt(index, attrIndex));
        }
      }
    }
  }
  return { eventCount, checksum };
}

function consumePublicNoOptionalText(bytes) {
  let eventCount = 0;
  let checksum = 0;
  for (const batch of new StreamReaderSync(bytes)) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const type = batch.typeAt(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);
      if (type === START_ELEMENT || type === END_ELEMENT) {
        checksum = foldString(checksum, batch.nameAt(index));
      }
      if (type === CHARACTERS || type === CDATA) {
        const text = batch.textAt(index);
        checksum = foldString(checksum, text === undefined ? undefined : text.trim());
      }
      if (type === START_ELEMENT) {
        const attrCount = batch.attributeCountAt(index);
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          checksum = foldString(checksum, batch.attributeNameAt(index, attrIndex));
          checksum = foldString(checksum, batch.attributeValueAt(index, attrIndex));
        }
      }
    }
  }
  return { eventCount, checksum };
}

function consumePublicSwitchDispatch(bytes) {
  let eventCount = 0;
  let checksum = 0;
  for (const batch of new StreamReaderSync(bytes)) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const type = batch.typeAt(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);
      switch (type) {
        case START_ELEMENT: {
          checksum = foldString(checksum, batch.nameAt(index));
          const attrCount = batch.attributeCountAt(index);
          checksum = mixChecksum(checksum, attrCount);
          for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
            checksum = foldString(checksum, batch.attributeNameAt(index, attrIndex));
            checksum = foldString(checksum, batch.attributeValueAt(index, attrIndex));
          }
          break;
        }
        case END_ELEMENT:
          checksum = foldString(checksum, batch.nameAt(index));
          break;
        case CHARACTERS:
        case CDATA: {
          const text = batch.textAt(index);
          checksum = foldString(checksum, text === undefined ? undefined : text.trim());
          break;
        }
      }
    }
  }
  return { eventCount, checksum };
}

function consumePublicEventObject(bytes) {
  const materializationCounters = {
    eventObjects: 0,
    nameStrings: 0,
    textStrings: 0,
    attributeNameStrings: 0,
    attributeValueStrings: 0,
    attributePairs: 0,
  };
  const objectSink = new Array(1024);
  let objectSinkIndex = 0;
  let eventCount = 0;
  let checksum = 0;
  for (const batch of new StreamReaderSync(bytes)) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const event = materializePublicEventObject(batch, index, materializationCounters);
      objectSink[objectSinkIndex & (objectSink.length - 1)] = event;
      objectSinkIndex++;

      eventCount++;
      checksum = mixChecksum(checksum, publicEventTypeCode(event.type));
      if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
        checksum = foldString(checksum, event.name);
      }
      if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
        checksum = foldString(checksum, event.value?.trim());
      }
      if (event.type === XmlEventType.START_ELEMENT) {
        const entries = Object.entries(event.attributes);
        materializationCounters.attributePairs += entries.length;
        checksum = mixChecksum(checksum, entries.length);
        for (const [name, value] of entries) {
          checksum = foldString(checksum, name);
          checksum = foldString(checksum, value);
        }
      }
    }
  }

  globalThis.__staxFileBackedPublicEventObjectSink = objectSink[(objectSinkIndex - 1) & (objectSink.length - 1)];
  return { eventCount, checksum, materializationCounters };
}

function consumePublicEventObjectStableShape(bytes) {
  const materializationCounters = {
    eventObjects: 0,
    nameStrings: 0,
    textStrings: 0,
    attributeNameStrings: 0,
    attributeValueStrings: 0,
    attributePairs: 0,
  };
  const objectSink = new Array(1024);
  let objectSinkIndex = 0;
  let eventCount = 0;
  let checksum = 0;
  for (const batch of new StreamReaderSync(bytes)) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const event = materializeStablePublicEventObject(batch, index, materializationCounters);
      objectSink[objectSinkIndex & (objectSink.length - 1)] = event;
      objectSinkIndex++;

      eventCount++;
      checksum = mixChecksum(checksum, publicEventTypeCode(event.type));
      if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
        checksum = foldString(checksum, event.name);
      }
      if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
        checksum = foldString(checksum, event.value === undefined ? undefined : event.value.trim());
      }
      if (event.type === XmlEventType.START_ELEMENT) {
        const entries = Object.entries(event.attributes);
        materializationCounters.attributePairs += entries.length;
        checksum = mixChecksum(checksum, entries.length);
        for (const [name, value] of entries) {
          checksum = foldString(checksum, name);
          checksum = foldString(checksum, value);
        }
      }
    }
  }

  globalThis.__staxFileBackedStablePublicEventObjectSink = objectSink[(objectSinkIndex - 1) & (objectSink.length - 1)];
  return { eventCount, checksum, materializationCounters };
}

function materializePublicEventObject(batch, index, materializationCounters) {
  const type = batch.typeAt(index);
  materializationCounters.eventObjects++;
  switch (type) {
    case START_DOCUMENT:
      return { type: XmlEventType.START_DOCUMENT };
    case END_DOCUMENT:
      return { type: XmlEventType.END_DOCUMENT };
    case START_ELEMENT: {
      materializationCounters.nameStrings++;
      const name = batch.nameAt(index);
      const attrCount = batch.attributeCountAt(index);
      const attributes = {};
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        materializationCounters.attributeNameStrings++;
        const attrName = batch.attributeNameAt(index, attrIndex);
        materializationCounters.attributeValueStrings++;
        attributes[attrName] = batch.attributeValueAt(index, attrIndex);
      }
      return {
        type: XmlEventType.START_ELEMENT,
        name,
        attributes,
      };
    }
    case END_ELEMENT:
      materializationCounters.nameStrings++;
      return {
        type: XmlEventType.END_ELEMENT,
        name: batch.nameAt(index),
      };
    case CHARACTERS:
      materializationCounters.textStrings++;
      return {
        type: XmlEventType.CHARACTERS,
        value: batch.textAt(index),
      };
    case CDATA:
      materializationCounters.textStrings++;
      return {
        type: XmlEventType.CDATA,
        value: batch.textAt(index),
      };
    default:
      throw new Error(`Unsupported stream event type: ${type}`);
  }
}

function materializeStablePublicEventObject(batch, index, materializationCounters) {
  const type = batch.typeAt(index);
  materializationCounters.eventObjects++;
  let name = undefined;
  let value = undefined;
  let attributes = undefined;
  switch (type) {
    case START_DOCUMENT:
    case END_DOCUMENT:
      break;
    case START_ELEMENT: {
      materializationCounters.nameStrings++;
      name = batch.nameAt(index);
      attributes = {};
      const attrCount = batch.attributeCountAt(index);
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        materializationCounters.attributeNameStrings++;
        const attrName = batch.attributeNameAt(index, attrIndex);
        materializationCounters.attributeValueStrings++;
        attributes[attrName] = batch.attributeValueAt(index, attrIndex);
      }
      break;
    }
    case END_ELEMENT:
      materializationCounters.nameStrings++;
      name = batch.nameAt(index);
      break;
    case CHARACTERS:
    case CDATA:
      materializationCounters.textStrings++;
      value = batch.textAt(index);
      break;
    default:
      throw new Error(`Unsupported stream event type: ${type}`);
  }
  return {
    type: publicEventXmlType(type),
    name,
    value,
    attributes,
  };
}

function publicEventXmlType(type) {
  switch (type) {
    case START_DOCUMENT:
      return XmlEventType.START_DOCUMENT;
    case END_DOCUMENT:
      return XmlEventType.END_DOCUMENT;
    case START_ELEMENT:
      return XmlEventType.START_ELEMENT;
    case END_ELEMENT:
      return XmlEventType.END_ELEMENT;
    case CHARACTERS:
      return XmlEventType.CHARACTERS;
    case CDATA:
      return XmlEventType.CDATA;
    default:
      throw new Error(`Unsupported stream event type: ${type}`);
  }
}

function publicEventTypeCode(type) {
  switch (type) {
    case XmlEventType.START_ELEMENT:
      return START_ELEMENT;
    case XmlEventType.END_ELEMENT:
      return END_ELEMENT;
    case XmlEventType.CHARACTERS:
      return CHARACTERS;
    case XmlEventType.CDATA:
      return CDATA;
    case XmlEventType.START_DOCUMENT:
      return START_DOCUMENT;
    case XmlEventType.END_DOCUMENT:
      return END_DOCUMENT;
    default:
      throw new Error(`Unsupported public event type: ${type}`);
  }
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

function createFindings(rows, baseline, fastest) {
  return [
    {
      id: 'same-contract-preserved',
      classification: 'CONTRACT_FACT',
      summary: 'All public consumer-shape rows preserve the same full-string checksum contract.',
      evidence: [`eventCounts=${[...new Set(rows.map(row => row.eventCount))].join(',')}`, `checksums=${[...new Set(rows.map(row => row.checksum))].join(',')}`],
    },
    {
      id: 'consumer-shape-headroom',
      classification: fastest && baseline && fastest.id !== baseline.id && fastest.mibPerSec > baseline.mibPerSec
        ? 'HEADROOM_EVIDENCE'
        : 'BENCH_FACT',
      summary: fastest && baseline
        ? `Fastest public consumer shape was ${fastest.id} at ${formatNumber(fastest.mibPerSec)} MiB/s (${formatNumber(fastest.mibPerSec / baseline.mibPerSec)}x baseline).`
        : 'No baseline comparison available.',
      evidence: rows.map(row => `${row.id}=${formatNumber(row.mibPerSec)} MiB/s rss=${formatBytes(row.memory?.maxRssBytes)}`),
    },
    {
      id: 'streaming-public-object-contract',
      classification: rows.some(row => row.id === 'public-event-object') ? 'CONTRACT_FACT' : 'MISSING_EVIDENCE',
      summary: 'The public-event-object row materializes per-event JavaScript objects from file-backed StreamBatch data without full XML string preload.',
      evidence: rows
        .filter(row => row.id === 'public-event-object')
        .map(row => `events=${row.eventCount}, objects=${row.materializationCounters?.eventObjects ?? 'n/a'}, source=${row.sourceMode}`),
    },
    {
      id: 'bounded-counterexample-search',
      classification: rows.some(row => row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200)
        ? 'COUNTEREXAMPLE_FOUND'
        : 'COUNTEREXAMPLE_NOT_FOUND',
      summary: 'The consumer-shape sweep applies the same 200 MiB/s bounded full-string counterexample rule.',
      evidence: rows.map(row => `${row.id}: bounded=${row.boundedMemory}, mibPerSec=${formatNumber(row.mibPerSec)}`),
    },
  ];
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# File-Backed Public Consumer Shape Sweep');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(report.note);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Fixture: ${report.fixture.path}`);
  lines.push(`- Fixture size: ${formatNumber(report.fixture.sizeMiB)} MiB`);
  lines.push(`- Source shape: file-backed sync Iterable<Uint8Array[]>`);
  lines.push(`- Chunk KiB: ${report.options.chunkKiB}`);
  lines.push(`- Batch size: ${report.options.batchSize}`);
  lines.push(`- Fastest row: ${formatSummaryRow(report.summary.fastest)}`);
  lines.push(`- Fastest / baseline ratio: ${formatNumber(report.summary.fastestBaselineRatio)}x`);
  lines.push(`- 200 MiB/s bounded full-string counterexamples: ${report.summary.counterexamples200MiB}`);
  lines.push('');
  lines.push('## Rows');
  lines.push('');
  lines.push('| Row | Implementation | MiB/s | Bounded | Max RSS | Events | Checksum |');
  lines.push('| --- | --- | ---: | --- | ---: | ---: | ---: |');
  for (const row of report.rows) {
    lines.push(`| \`${row.id}\` | ${row.implementation} | ${formatNumber(row.mibPerSec)} | ${row.boundedMemory ? 'yes' : 'no'} | ${formatBytes(row.memory?.maxRssBytes)} | ${row.eventCount} | ${row.checksum} |`);
  }
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push('');
  lines.push('## Limits');
  lines.push('');
  lines.push('- This changes only JavaScript consumer shape over the public StreamBatch API; it does not change parser internals.');
  lines.push('- `public-event-object` creates public JavaScript event objects from file-backed `StreamBatch` rows; it is not the full-string `EventReaderSync(readFileSync(..., "utf8"))` path.');
  lines.push('- A missing counterexample in this artifact is not a JavaScript runtime ceiling proof.');
  lines.push('- This should be read together with `file-backed-v8-codegen-trace.md` because throughput and deopt behavior are separate evidence types.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function describeVariant(variant) {
  switch (variant) {
    case 'public-baseline':
      return 'public StreamBatch accessor loop matching external-baseline stax-stream';
    case 'public-no-optional-text':
      return 'public StreamBatch accessor loop with explicit text undefined check instead of optional chaining';
    case 'public-switch-dispatch':
      return 'public StreamBatch accessor loop using switch dispatch and explicit text undefined check';
    case 'public-event-object':
      return 'public event objects materialized from file-backed StreamBatch rows';
    case 'public-event-object-stable-shape':
      return 'public event objects with stable own-property shape `{ type, name, value, attributes }`';
    default:
      return variant;
  }
}

function mixChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function foldString(seed, value) {
  if (!value) return seed;
  let next = seed;
  for (let index = 0; index < value.length; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
}

function gcNow() {
  if (globalThis.gc) globalThis.gc();
}

function takeMemorySnapshot() {
  const usage = process.memoryUsage();
  return {
    rssBytes: usage.rss,
    heapUsedBytes: usage.heapUsed,
    externalBytes: usage.external,
    arrayBuffersBytes: usage.arrayBuffers,
  };
}

function maxBy(values, score) {
  let best = null;
  let bestScore = -Infinity;
  for (const value of values) {
    const nextScore = score(value);
    if (nextScore > bestScore) {
      best = value;
      bestScore = nextScore;
    }
  }
  return best;
}

function summarizeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    throughputMiBPerSec: row.mibPerSec,
    maxRssBytes: row.memory?.maxRssBytes ?? null,
    eventCount: row.eventCount,
    checksum: row.checksum,
  };
}

function formatSummaryRow(row) {
  if (!row) return 'n/a';
  return `${row.id} ${formatNumber(row.throughputMiBPerSec)} MiB/s, RSS ${formatBytes(row.maxRssBytes)}`;
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function formatBytes(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${formatNumber(value / MIB)} MiB` : 'n/a';
}

main();
