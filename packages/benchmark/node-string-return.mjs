import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, statSync, writeSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { IterableEventType, StaxXmlIterableParser } from 'stax-xml/iterable';
import {
  nodeFileByteBatchesSync,
  StaxXmlNodeIterableParser,
} from '../stax-xml/dist/iterable/node.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TIER_IDS = [
  'count-only',
  'name-string-only',
  'text-string-only',
  'attr-value-string-only',
  'full-string',
];

const DEFAULT_SIZES_MIB = [512, 1024];
const DEFAULT_CHUNK_SIZE = 1024 * 1024;
const DEFAULT_BATCH_SIZE = 1;
const DEFAULT_RUNS = 3;
const DEFAULT_WARMUPS = 1;
const QUICK_FILE = join(__dirname, 'assets', 'midsize.xml');
const GENERATED_DIR = join(__dirname, 'test-data');
const COUNT_REGRESSION_LIMIT = 0.03;
const FULL_STRING_MIN_IMPROVEMENT = 0.10;
const FULL_STRING_MIN_MIB_PER_SEC = 190;

function parseArgs(argv) {
  const options = {
    files: [],
    sizesMiB: [],
    quick: false,
    runs: DEFAULT_RUNS,
    warmups: DEFAULT_WARMUPS,
    chunkSize: DEFAULT_CHUNK_SIZE,
    batchSize: DEFAULT_BATCH_SIZE,
    generatedDir: GENERATED_DIR,
    jsonOut: undefined,
    failGate: false,
    sampleEvery: 65_536,
    woodstoxCmd: undefined,
    quickXmlCmd: undefined,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;

    if (arg === '--quick') {
      options.quick = true;
      options.runs = 1;
      options.warmups = 0;
      continue;
    }
    if (arg === '--fail-gate') {
      options.failGate = true;
      continue;
    }

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
        options.files.push(resolve(process.cwd(), readValue()));
        break;
      case '--size-mib':
        options.sizesMiB.push(parsePositiveNumber(readValue(), '--size-mib'));
        break;
      case '--sizes-mib':
        options.sizesMiB.push(...readValue().split(',').filter(Boolean).map(value => parsePositiveNumber(value, '--sizes-mib')));
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), '--runs');
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), '--warmups');
        break;
      case '--chunk-size':
        options.chunkSize = parsePositiveInteger(readValue(), '--chunk-size');
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), '--batch-size');
        break;
      case '--generated-dir':
        options.generatedDir = resolve(process.cwd(), readValue());
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--sample-every':
        options.sampleEvery = parsePositiveInteger(readValue(), '--sample-every');
        break;
      case '--woodstox-cmd':
        options.woodstoxCmd = readValue();
        break;
      case '--quick-xml-cmd':
        options.quickXmlCmd = readValue();
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.quick && options.files.length === 0 && options.sizesMiB.length === 0 && existsSync(QUICK_FILE)) {
    options.files.push(QUICK_FILE);
  }
  if (options.files.length === 0 && options.sizesMiB.length === 0) {
    options.sizesMiB.push(...DEFAULT_SIZES_MIB);
  }

  return options;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }
  return parsed;
}

function parsePositiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive number.`);
  }
  return parsed;
}

function ensureGeneratedFile(sizeMiB, generatedDir) {
  mkdirSync(generatedDir, { recursive: true });
  const filePath = join(generatedDir, `node-string-return-${formatSizeName(sizeMiB)}.xml`);
  const targetBytes = Math.floor(sizeMiB * 1024 * 1024);

  if (existsSync(filePath)) {
    const actual = statSync(filePath).size;
    if (Math.abs(actual - targetBytes) / targetBytes < 0.01) {
      return filePath;
    }
  }

  generateXmlFile(filePath, targetBytes);
  return filePath;
}

function formatSizeName(sizeMiB) {
  return Number.isInteger(sizeMiB) ? `${sizeMiB}mib` : `${String(sizeMiB).replace('.', '_')}mib`;
}

function generateXmlFile(filePath, targetBytes) {
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
      const element = Buffer.from(
        `  <book id="book-${id}" lang="en" code="${id % 97}">` +
          `<title>Sample Book ${id}</title>` +
          `<author>Author ${id % 4096}</author>` +
          `<description>Full string checksum text payload ${id} with stable words and numbers.</description>` +
          `<chapter number="1">Intro ${id}</chapter>` +
          `<chapter number="2">Body ${id}</chapter>` +
        '</book>\n',
      );
      if (written + pendingBytes + element.byteLength + footer.byteLength > targetBytes) {
        break;
      }

      pending.push(element);
      pendingBytes += element.byteLength;
      id++;

      if (pendingBytes >= 1024 * 1024) {
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

function makeNeutralParser(filePath, options) {
  return new StaxXmlIterableParser(nodeFileByteBatchesSync(filePath, {
    chunkSize: options.chunkSize,
    batchSize: options.batchSize,
  }));
}

function makeNodeParser(filePath, options) {
  return new StaxXmlNodeIterableParser(nodeFileByteBatchesSync(filePath, {
    chunkSize: options.chunkSize,
    batchSize: options.batchSize,
  }));
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

function captureMemoryPeak(peak) {
  const current = process.memoryUsage();
  peak.rssBytes = Math.max(peak.rssBytes, current.rss);
  peak.heapUsedBytes = Math.max(peak.heapUsedBytes, current.heapUsed);
}

function consumeParser(parser, tier, sampleEvery) {
  let eventCount = 0;
  let checksum = 0;
  const peak = { rssBytes: 0, heapUsedBytes: 0 };

  captureMemoryPeak(peak);
  while (parser.nextBatch()) {
    for (let index = 0; index < parser.eventCount(); index++) {
      const type = parser.eventType(index);
      const attrCount = parser.attrCount(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);

      if (tier === 'count-only') {
        checksum = mixChecksum(checksum, attrCount);
      } else if (tier === 'name-string-only') {
        if (type === IterableEventType.START_ELEMENT || type === IterableEventType.END_ELEMENT) {
          checksum = foldString(checksum, parser.copyName(index));
        }
      } else if (tier === 'text-string-only') {
        if (type === IterableEventType.CHARACTERS || type === IterableEventType.CDATA) {
          checksum = foldString(checksum, parser.copyText(index)?.trim());
        }
      } else if (tier === 'attr-value-string-only') {
        checksum = mixChecksum(checksum, attrCount);
        for (let attr = 0; attr < attrCount; attr++) {
          checksum = foldString(checksum, parser.copyAttrValue(index, attr));
        }
      } else {
        if (type === IterableEventType.START_ELEMENT || type === IterableEventType.END_ELEMENT) {
          checksum = foldString(checksum, parser.copyName(index));
        }
        if (type === IterableEventType.CHARACTERS || type === IterableEventType.CDATA) {
          checksum = foldString(checksum, parser.copyText(index)?.trim());
        }
        checksum = mixChecksum(checksum, attrCount);
        for (let attr = 0; attr < attrCount; attr++) {
          checksum = foldString(checksum, parser.copyAttrName(index, attr));
          checksum = foldString(checksum, parser.copyAttrValue(index, attr));
        }
      }

      if (eventCount % sampleEvery === 0) {
        captureMemoryPeak(peak);
      }
    }
  }
  captureMemoryPeak(peak);
  return { eventCount, checksum, peak };
}

function measureScenario(id, createParser, fileSizeMiB, tier, options) {
  for (let index = 0; index < options.warmups; index++) {
    consumeParser(createParser(), tier, options.sampleEvery);
  }

  const samplesMs = [];
  let eventCount = 0;
  let checksum = 0;
  const peak = { rssBytes: 0, heapUsedBytes: 0 };

  for (let index = 0; index < options.runs; index++) {
    if (globalThis.gc) {
      globalThis.gc();
    }
    const startedAt = performance.now();
    const result = consumeParser(createParser(), tier, options.sampleEvery);
    const elapsedMs = performance.now() - startedAt;

    if (index > 0 && (result.eventCount !== eventCount || result.checksum !== checksum)) {
      throw new Error(`${id} ${tier} produced unstable event count or checksum between runs.`);
    }

    eventCount = result.eventCount;
    checksum = result.checksum;
    peak.rssBytes = Math.max(peak.rssBytes, result.peak.rssBytes);
    peak.heapUsedBytes = Math.max(peak.heapUsedBytes, result.peak.heapUsedBytes);
    samplesMs.push(elapsedMs);
  }

  const avgMs = average(samplesMs);
  return {
    id,
    status: 'ok',
    tier,
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    mibPerSec: fileSizeMiB / (avgMs / 1000),
    eventCount,
    checksum,
    peakRssBytes: peak.rssBytes,
    peakHeapUsedBytes: peak.heapUsedBytes,
    samplesMs,
  };
}

function measureExternal(id, command, filePath, fileSizeMiB, tier) {
  if (!command) {
    return {
      id,
      status: 'skipped',
      tier,
      reason: `No --${id === 'woodstox' ? 'woodstox' : 'quick-xml'}-cmd was provided.`,
    };
  }

  const child = spawnSync(command, [], {
    shell: true,
    encoding: 'utf8',
    env: {
      ...process.env,
      STAX_XML_BENCH_FILE: filePath,
      STAX_XML_BENCH_TIER: tier,
      STAX_XML_BENCH_CONTRACT: 'namespace-off,skip-decl-comment-pi-doctype,cdata-event,skip-whitespace-text,trim-text-checksum,entity-decode-off',
    },
  });

  if (child.status !== 0) {
    return {
      id,
      status: 'failed',
      tier,
      reason: child.stderr.trim() || child.stdout.trim() || `external command exited ${child.status}`,
    };
  }

  const parsed = JSON.parse(child.stdout);
  return {
    id,
    status: 'ok',
    tier,
    avgMs: parsed.avgMs,
    minMs: parsed.minMs ?? parsed.avgMs,
    maxMs: parsed.maxMs ?? parsed.avgMs,
    mibPerSec: parsed.mibPerSec ?? fileSizeMiB / (parsed.avgMs / 1000),
    eventCount: parsed.eventCount,
    checksum: parsed.checksum,
    peakRssBytes: parsed.peakRssBytes,
    peakHeapUsedBytes: parsed.peakHeapUsedBytes,
    samplesMs: parsed.samplesMs ?? [parsed.avgMs],
  };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bytesToMiB(bytes) {
  return bytes / 1024 / 1024;
}

function formatMs(value) {
  return value.toFixed(2);
}

function formatRate(value) {
  return value.toFixed(1);
}

function formatMiB(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
}

function pct(value) {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

function buildGate(fileReport) {
  const tiers = new Map(fileReport.tiers.map(tier => [tier.id, tier]));
  const count = tiers.get('count-only');
  const full = tiers.get('full-string');
  const failures = [];

  for (const tier of fileReport.tiers) {
    const neutral = tier.scenarios.find(scenario => scenario.id === 'neutral');
    const node = tier.scenarios.find(scenario => scenario.id === 'node');
    if (!neutral || !node || neutral.status !== 'ok' || node.status !== 'ok') {
      failures.push(`${tier.id}: missing neutral/node result`);
      continue;
    }
    if (neutral.eventCount !== node.eventCount || neutral.checksum !== node.checksum) {
      failures.push(`${tier.id}: neutral/node event count or checksum mismatch`);
    }
  }

  const countNeutral = count?.scenarios.find(scenario => scenario.id === 'neutral');
  const countNode = count?.scenarios.find(scenario => scenario.id === 'node');
  const fullNeutral = full?.scenarios.find(scenario => scenario.id === 'neutral');
  const fullNode = full?.scenarios.find(scenario => scenario.id === 'node');

  const countOnlyRegression = countNeutral && countNode
    ? (countNode.avgMs - countNeutral.avgMs) / countNeutral.avgMs
    : Number.NaN;
  const fullStringImprovement = fullNeutral && fullNode
    ? (fullNeutral.avgMs - fullNode.avgMs) / fullNeutral.avgMs
    : Number.NaN;

  if (Number.isFinite(countOnlyRegression) && countOnlyRegression >= COUNT_REGRESSION_LIMIT) {
    failures.push(`count-only regression ${pct(countOnlyRegression)} exceeds ${pct(COUNT_REGRESSION_LIMIT)}`);
  }
  if (Number.isFinite(fullStringImprovement) && fullNode) {
    const passesFullStringGate = fullStringImprovement >= FULL_STRING_MIN_IMPROVEMENT ||
      fullNode.mibPerSec >= FULL_STRING_MIN_MIB_PER_SEC;
    if (!passesFullStringGate) {
      failures.push(
        `full-string improvement ${pct(fullStringImprovement)} and ${formatRate(fullNode.mibPerSec)} MiB/s miss gate`,
      );
    }
  }

  return {
    status: failures.length === 0 ? 'pass' : 'fail',
    countOnlyRegression,
    fullStringImprovement,
    failures,
  };
}

function printReport(report) {
  console.log('Node string-return iterable benchmark');
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Contract: ${report.contract.join(', ')}`);
  console.log(`Runs: warmups=${report.options.warmups}, runs=${report.options.runs}, chunkSize=${report.options.chunkSize}, batchSize=${report.options.batchSize}`);

  for (const file of report.files) {
    console.log('');
    console.log(`${file.path} (${file.sizeMiB.toFixed(2)} MiB)`);
    for (const tier of file.tiers) {
      console.log(`  ${tier.id}`);
      for (const scenario of tier.scenarios) {
        if (scenario.status !== 'ok') {
          console.log(`    ${scenario.id}: ${scenario.status} (${scenario.reason})`);
          continue;
        }
        console.log(
          `    ${scenario.id}: ${formatRate(scenario.mibPerSec)} MiB/s, ` +
          `${formatMs(scenario.avgMs)} ms, events=${scenario.eventCount}, checksum=${scenario.checksum}, ` +
          `rss=${formatMiB(scenario.peakRssBytes)} MiB, heap=${formatMiB(scenario.peakHeapUsedBytes)} MiB`,
        );
      }
    }

    console.log(
      `  gate: ${file.gate.status}, count-only regression=${pct(file.gate.countOnlyRegression)}, ` +
      `full-string improvement=${pct(file.gate.fullStringImprovement)}`,
    );
    for (const failure of file.gate.failures) {
      console.log(`    - ${failure}`);
    }
  }
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const files = [
    ...options.files,
    ...options.sizesMiB.map(sizeMiB => ensureGeneratedFile(sizeMiB, options.generatedDir)),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    contract: [
      'namespace off',
      'XML declaration/comment/PI/DOCTYPE skipped',
      'CDATA remains a separate event',
      'whitespace-only text skipped',
      'text trimmed before checksum',
      'entity decode off',
    ],
    options: {
      runs: options.runs,
      warmups: options.warmups,
      chunkSize: options.chunkSize,
      batchSize: options.batchSize,
      sampleEvery: options.sampleEvery,
    },
    files: [],
  };

  for (const filePath of files) {
    const stat = statSync(filePath);
    const fileSizeMiB = bytesToMiB(stat.size);
    const fileReport = {
      path: filePath,
      sizeBytes: stat.size,
      sizeMiB: fileSizeMiB,
      tiers: [],
      gate: undefined,
    };

    for (const tierId of TIER_IDS) {
      const scenarios = [
        measureScenario('neutral', () => makeNeutralParser(filePath, options), fileSizeMiB, tierId, options),
        measureScenario('node', () => makeNodeParser(filePath, options), fileSizeMiB, tierId, options),
        measureExternal('woodstox', options.woodstoxCmd, filePath, fileSizeMiB, tierId),
        measureExternal('quick-xml', options.quickXmlCmd, filePath, fileSizeMiB, tierId),
      ];
      fileReport.tiers.push({ id: tierId, scenarios });
    }

    fileReport.gate = buildGate(fileReport);
    report.files.push(fileReport);
  }

  printReport(report);

  if (options.jsonOut) {
    mkdirSync(dirname(options.jsonOut), { recursive: true });
    const fd = openSync(options.jsonOut, 'w');
    try {
      writeSync(fd, `${JSON.stringify(report, null, 2)}\n`, undefined, 'utf8');
    } finally {
      closeSync(fd);
    }
    console.log(`Saved JSON report to ${options.jsonOut}`);
  }

  if (options.failGate) {
    const failures = report.files.flatMap(file => file.gate.failures.map(failure => `${file.path}: ${failure}`));
    if (failures.length > 0) {
      process.exitCode = 1;
    }
  }
}

void main();
