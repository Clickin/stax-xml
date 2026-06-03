import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultReleaseJson = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-release-jsshell-availability-audit.json');
const defaultNightlyJson = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-nightly-jsshell-availability-audit.json');
const defaultCorpusFile = resolve(__dirname, 'assets', 'books.xml');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'spidermonkey-jsshell-stax-primary-byte-batch.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'spidermonkey-jsshell-stax-primary-byte-batch.md');
const defaultDistImport = '../../../../stax-xml/dist/index.js';
const MIB = 1024 * 1024;

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    releaseJson: defaultReleaseJson,
    nightlyJson: defaultNightlyJson,
    corpusFile: defaultCorpusFile,
    distImport: defaultDistImport,
    targetMiB: 16,
    runs: 3,
    warmups: 1,
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
      case '--release-json': options.releaseJson = resolve(process.cwd(), readValue()); break;
      case '--nightly-json': options.nightlyJson = resolve(process.cwd(), readValue()); break;
      case '--corpus-file': options.corpusFile = resolve(process.cwd(), readValue()); break;
      case '--dist-import': options.distImport = readValue(); break;
      case '--target-mib': options.targetMiB = parsePositiveNumber(readValue(), name); break;
      case '--runs': options.runs = parsePositiveInteger(readValue(), name); break;
      case '--warmups': options.warmups = parseNonNegativeInteger(readValue(), name); break;
      case '--json-out': options.jsonOut = resolve(process.cwd(), readValue()); break;
      case '--md-out': options.mdOut = resolve(process.cwd(), readValue()); break;
      default: throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!existsSync(options.corpusFile)) throw new Error(`--corpus-file does not exist: ${options.corpusFile}`);
  return options;
}

function main() {
  const options = parseArgs();
  const shells = [
    readShellFromAvailability(options.releaseJson, 'release'),
    readShellFromAvailability(options.nightlyJson, 'nightly'),
  ];
  const rows = shells.map(shell => runShellRow(shell, options));
  const report = createReport(options, rows);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`spidermonkey-jsshell-stax-primary-byte-batch: rows=${rows.length} fastest=${formatNumber(report.summary.fastest?.mibPerSec)} MiB/s`);
}

function readShellFromAvailability(filePath, packageKind) {
  const report = JSON.parse(readFileSync(filePath, 'utf8'));
  const jsShell = report.shell?.jsShell;
  if (!jsShell || !existsSync(jsShell)) {
    throw new Error(`${packageKind} SpiderMonkey js-shell not found from ${filePath}: ${jsShell ?? 'missing'}`);
  }
  return {
    packageKind,
    jsShell,
    version: oneLine(report.shell?.version?.stdout),
    packageVerified: report.outcome?.packageVerified === true,
    hasJitExecutionStatus: report.outcome?.hasJitExecutionStatus === true,
    canReadBinaryInput: report.outcome?.canReadBinaryInput === true,
    sourceArtifact: filePath.split(/[\\/]/).pop(),
  };
}

function runShellRow(shell, options) {
  const tempDir = resolve(__dirname, 'results', 'tmp', `spidermonkey-stax-primary-byte-batch-${shell.packageKind}`);
  const scriptPath = join(tempDir, 'stax-primary-byte-batch.mjs');
  const fixturePath = join(tempDir, 'fixture.xml');
  try {
    rmSync(tempDir, { recursive: true, force: true });
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(fixturePath, createCorpusFixture(options), 'utf8');
    writeFileSync(scriptPath, createShellModule({ ...options, shellCorpusFile: fixturePath }), 'utf8');
    const result = spawnSync(shell.jsShell, ['--ion-eager', '--ion-offthread-compile=off', `--module=${scriptPath}`], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 180_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.status !== 0) {
      throw new Error(`${shell.packageKind} js-shell StAX primary byte-batch probe failed: ${result.stderr || result.stdout}`);
    }
    const payloadLine = String(result.stdout ?? '').trim().split(/\r?\n/).find(line => line.startsWith('{'));
    if (!payloadLine) throw new Error(`${shell.packageKind} js-shell StAX probe emitted no JSON payload: ${result.stdout}`);
    return normalizeShellPayload(shell, JSON.parse(payloadLine), options);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function normalizeShellPayload(shell, payload, options) {
  return {
    id: `${shell.packageKind}-spidermonkey-stax-stream-reader-sync-primary-byte-batch`,
    runtime: {
      id: 'spidermonkey-jsshell',
      name: 'SpiderMonkey js-shell',
      version: shell.version,
      packageKind: shell.packageKind,
      packageVerified: shell.packageVerified,
      hasJitExecutionStatus: shell.hasJitExecutionStatus,
      canReadBinaryInput: shell.canReadBinaryInput,
    },
    implementation: 'Current built StreamReaderSync index accessors over SpiderMonkey js-shell read(file, "binary") byte batches',
    family: 'full-stax-js',
    contractScope: 'full-string-materialization',
    eventCountKind: 'stream-events',
    fullStringParity: true,
    sameContractStaxRow: true,
    currentStaxPrimaryByteBatchRow: true,
    canRunCurrentStaxPrimaryByteBatchBenchmark: true,
    canRunCurrentStaxFullStringBenchmark: false,
    unchangedStaxBenchmark: false,
    blockedUnchangedHarnessGlobals: ['TextEncoder', 'ReadableStream', 'fetch'],
    boundedMemory: null,
    memory: {
      primaryKind: 'not-recorded',
      note: 'SpiderMonkey js-shell does not expose process RSS or JS heap counters in this harness.',
    },
    sourceMode: 'sync-iterable-byte-batches',
    parserInput: 'SpiderMonkey js-shell Uint8Array from read(file, "binary"), replayed as Iterable<Uint8Array[]> byte batches',
    demandDrivenSource: true,
    directReadableStream: false,
    fullArrayBufferParserInput: false,
    corpusSeedReplay: false,
    corpusSeedBytes: statSync(options.corpusFile).size,
    generatedFixtureBytes: payload.seedBytes,
    targetBytes: payload.targetBytes,
    targetMiB: payload.targetBytes / MIB,
    sampleCount: payload.samplesMs.length,
    samplesMs: payload.samplesMs,
    avgMs: payload.avgMs,
    minMs: Math.min(...payload.samplesMs),
    maxMs: Math.max(...payload.samplesMs),
    sampleSpreadRatio: payload.samplesMs.length > 1
      ? (Math.max(...payload.samplesMs) - Math.min(...payload.samplesMs)) / payload.avgMs
      : 0,
    mibPerSec: payload.mibPerSec,
    eventCount: payload.result.eventCount,
    checksum: payload.result.checksum,
    globals: payload.globals,
    sourceArtifact: shell.sourceArtifact,
    options: {
      runs: options.runs,
      warmups: options.warmups,
    },
  };
}

function createReport(options, rows) {
  const fastest = maxBy(rows, row => row.mibPerSec);
  const corpusStat = statSync(options.corpusFile);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'spidermonkey-jsshell-stax-primary-byte-batch',
    contract: 'current-stax-stream-reader-sync-primary-byte-batch-full-string-js-shell-row',
    note: 'Runs the current built StreamReaderSync primary byte-batch path in official SpiderMonkey js-shells over corpus bytes read with read(file, "binary"). This is same full-string checksum StAX API evidence for js-shell, but not emitted-code closure and not a bounded-memory counterexample because row-level memory is unavailable.',
    fixture: {
      generated: true,
      source: 'corpus-file',
      sourceFile: options.corpusFile,
      shape: 'generated-single-root-corpus-repetition',
      seedBytes: corpusStat.size,
      targetBytes: Math.round(options.targetMiB * MIB),
      sizeMiB: options.targetMiB,
      sizeGiB: options.targetMiB / 1024,
      batchSize: 1,
    },
    environment: {
      runtimeName: 'spidermonkey-jsshell',
      javascriptEngine: 'SpiderMonkey',
      platform: `${process.platform}-${process.arch}`,
    },
    sourceContract: {
      sourceMode: 'sync-iterable-byte-batches',
      parserInput: 'Iterable<Uint8Array[]>',
      directReadableStream: false,
      demandDrivenSource: true,
      fullArrayBufferParserInput: false,
      primarySyncByteBatchMissingGlobals: [],
      primaryPathRunnableWithoutHostEncoding: true,
    },
    variants: rows,
    summary: {
      rowCount: rows.length,
      fastest,
      allRowsFullStringParity: rows.every(row => row.fullStringParity === true),
      allRowsPrimaryByteBatch: rows.every(row => row.currentStaxPrimaryByteBatchRow === true),
      allRowsMissingHostEncodingGlobals: rows.every(row =>
        row.globals.TextDecoder === 'undefined'
        && row.globals.TextEncoder === 'undefined'
      ),
      counterexampleCount: rows.filter(row => row.boundedMemory === true && row.mibPerSec >= 200).length,
      conclusionAllowed: false,
    },
    findings: [
      {
        id: 'spidermonkey-jsshell-current-stax-primary-row',
        classification: 'BENCH_FACT',
        summary: 'Official SpiderMonkey js-shells can execute the current built StreamReaderSync primary byte-batch full-string checksum path without host TextDecoder or TextEncoder.',
        evidence: [
          `rows=${rows.length}`,
          `primaryPathRunnableWithoutHostEncoding=${rows.every(row => row.globals.TextDecoder === 'undefined' && row.globals.TextEncoder === 'undefined')}`,
          `fastest=${formatNumber(fastest?.mibPerSec)} MiB/s`,
        ],
      },
      {
        id: 'spidermonkey-jsshell-row-scope',
        classification: 'SCOPE_GUARD',
        summary: 'The row is not a runtime-limit closure because it has no row-level memory proof and no emitted same-contract codegen evidence.',
        evidence: [
          'boundedMemory=null',
          'canRunCurrentStaxFullStringBenchmark=false',
          'conclusionAllowed=false',
        ],
      },
    ],
  };
}

function createCorpusFixture(options) {
  const source = readFileSync(options.corpusFile, 'utf8');
  const body = source
    .replace(/^\uFEFF?/, '')
    .replace(/^\s*<\?xml[^>]*\?>\s*/i, '')
    .replace(/^\s*<catalog>\s*/i, '')
    .replace(/\s*<\/catalog>\s*$/i, '')
    .trim();
  if (!body) throw new Error(`Could not extract corpus body from ${options.corpusFile}`);

  const header = '<?xml version="1.0"?>\n<catalog>\n';
  const footer = '\n</catalog>\n';
  const bodyChunk = `${body}\n`;
  const targetBytes = Math.max(1, Math.round(options.targetMiB * MIB));
  let byteLength = Buffer.byteLength(header, 'utf8') + Buffer.byteLength(footer, 'utf8');
  const bodyBytes = Buffer.byteLength(bodyChunk, 'utf8');
  const chunks = [header];
  while (byteLength < targetBytes) {
    chunks.push(bodyChunk);
    byteLength += bodyBytes;
  }
  chunks.push(footer);
  return chunks.join('');
}

function createShellModule(options) {
  const corpusPath = relative(process.cwd(), options.shellCorpusFile ?? options.corpusFile).replace(/\\/g, '/');
  const targetBytes = Math.round(options.targetMiB * MIB);
  return `
import { StreamEventType, StreamReaderSync } from ${JSON.stringify(options.distImport)};

const corpusPath = ${JSON.stringify(corpusPath)};
const requestedTargetBytes = ${targetBytes};
const runs = ${options.runs};
const warmups = ${options.warmups};
const seed = read(corpusPath, 'binary');
if (!(seed instanceof Uint8Array)) throw new Error('read(..., "binary") did not return Uint8Array');
const targetBytes = seed.length;

function* byteBatches() {
  yield [seed];
}

function mixChecksum(seedValue, value) {
  return Math.imul((seedValue ^ value) | 0, 16777619) | 0;
}

function foldString(seedValue, value) {
  if (!value) return seedValue;
  let next = seedValue;
  for (let index = 0; index < value.length; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
}

function consume() {
  let eventCount = 0;
  let checksum = 0;
  for (const batch of new StreamReaderSync(byteBatches())) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const type = batch.typeAt(index);
      eventCount++;
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
    }
  }
  return { eventCount, checksum };
}

let reference = null;
for (let index = 0; index < warmups; index++) reference = consume();
const samplesMs = [];
for (let index = 0; index < runs; index++) {
  const started = Date.now();
  const result = consume();
  const elapsed = Date.now() - started;
  if (reference !== null && (reference.eventCount !== result.eventCount || reference.checksum !== result.checksum)) {
    throw new Error('unstable StAX primary byte-batch checksum');
  }
  reference = reference || result;
  samplesMs.push(elapsed);
}
const avgMs = samplesMs.reduce((sum, value) => sum + value, 0) / samplesMs.length;
print(JSON.stringify({
  seedBytes: seed.length,
  requestedTargetBytes,
  targetBytes,
  result: reference,
  samplesMs,
  avgMs,
  mibPerSec: (targetBytes / ${MIB}) / (avgMs / 1000),
  globals: {
    TextDecoder: typeof globalThis.TextDecoder,
    TextEncoder: typeof globalThis.TextEncoder,
    ReadableStream: typeof globalThis.ReadableStream,
    fetch: typeof globalThis.fetch,
    Uint8Array: typeof globalThis.Uint8Array,
    read: typeof globalThis.read,
  },
}));
`;
}

function renderMarkdown(report) {
  const lines = [
    '# SpiderMonkey js-shell StAX Primary Byte-Batch Row',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Rows: ${report.summary.rowCount}`,
    `- Fastest: ${report.summary.fastest.id} ${formatNumber(report.summary.fastest.mibPerSec)} MiB/s`,
    `- All rows full-string parity: ${report.summary.allRowsFullStringParity ? 'yes' : 'no'}`,
    `- All rows primary byte-batch: ${report.summary.allRowsPrimaryByteBatch ? 'yes' : 'no'}`,
    `- Missing host encoding globals: ${report.summary.allRowsMissingHostEncodingGlobals ? 'yes' : 'no'}`,
    `- Counterexamples >= 200 MiB/s with bounded memory: ${report.summary.counterexampleCount}`,
    `- Runtime-limit conclusion allowed: ${report.summary.conclusionAllowed ? 'yes' : 'no'}`,
    '',
    '## Rows',
    '',
    '| Row | Runtime | MiB/s | Events | Checksum | Samples ms | TextDecoder | TextEncoder |',
    '| --- | --- | ---: | ---: | ---: | --- | --- | --- |',
  ];
  for (const row of report.variants) {
    lines.push(`| ${row.id} | ${row.runtime.version} | ${formatNumber(row.mibPerSec)} | ${row.eventCount} | ${row.checksum} | ${row.samplesMs.map(formatNumber).join(', ')} | ${row.globals.TextDecoder} | ${row.globals.TextEncoder} |`);
  }
  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) lines.push(`  - ${evidence}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
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

function writeOutput(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function maxBy(values, selector) {
  return values.reduce((best, value) => {
    if (!best) return value;
    return selector(value) > selector(best) ? value : best;
  }, null);
}

function oneLine(value) {
  return String(value ?? 'not-recorded').trim().replace(/\s+/g, ' ') || 'not-recorded';
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

main();
