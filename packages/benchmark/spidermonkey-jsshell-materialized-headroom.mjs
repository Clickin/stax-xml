import { spawnSync } from 'node:child_process';
import { cpus, tmpdir } from 'node:os';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultReleaseJson = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-release-jsshell-availability-audit.json');
const defaultNightlyJson = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-nightly-jsshell-availability-audit.json');
const defaultCorpusFile = resolve(__dirname, 'assets', 'books.xml');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'spidermonkey-jsshell-materialized-headroom.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'spidermonkey-jsshell-materialized-headroom.md');
const MIB = 1024 * 1024;

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    releaseJson: defaultReleaseJson,
    nightlyJson: defaultNightlyJson,
    corpusFile: defaultCorpusFile,
    targetMiB: 16,
    runs: 3,
    warmups: 1,
    selfTest: false,
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
      case '--target-mib': options.targetMiB = parsePositiveNumber(readValue(), name); break;
      case '--runs': options.runs = parsePositiveInteger(readValue(), name); break;
      case '--warmups': options.warmups = parseNonNegativeInteger(readValue(), name); break;
      case '--self-test': options.selfTest = true; break;
      case '--json-out': options.jsonOut = resolve(process.cwd(), readValue()); break;
      case '--md-out': options.mdOut = resolve(process.cwd(), readValue()); break;
      default: throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.selfTest && !existsSync(options.corpusFile)) {
    throw new Error(`--corpus-file does not exist: ${options.corpusFile}`);
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

function main() {
  const options = parseArgs();
  const report = options.selfTest ? createSelfTestReport(options) : runBenchmark(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`spidermonkey-jsshell-materialized-headroom: rows=${report.rows.length} fastest=${report.summary.fastest.id} ${formatNumber(report.summary.fastest.mibPerSec)} MiB/s`);
}

function runBenchmark(options) {
  const shells = [
    readShellFromAvailability(options.releaseJson, 'release'),
    readShellFromAvailability(options.nightlyJson, 'nightly'),
  ];
  const rows = shells.map(shell => runShellRow(shell, options));
  const fastest = maxBy(rows, row => row.mibPerSec);
  return createReport(options, rows, {
    corpusSeedBytes: rows[0]?.corpusSeedBytes ?? null,
    selfTest: false,
    fastest,
  });
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
    canRunCurrentStaxFullStringBenchmark: report.outcome?.canRunCurrentStaxFullStringBenchmark === true,
    sourceArtifact: filePath.split(/[\\/]/).pop(),
  };
}

function runShellRow(shell, options) {
  const tempDir = mkdtempSync(join(tmpdir(), 'stax-spidermonkey-materialized-'));
  const scriptPath = join(tempDir, 'materialized-headroom.js');
  try {
    writeFileSync(scriptPath, createShellScript(options), 'utf8');
    const result = spawnSync(shell.jsShell, ['--ion-eager', '--ion-offthread-compile=off', scriptPath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    });
    if (result.status !== 0) {
      throw new Error(`${shell.packageKind} js-shell materialized probe failed: ${result.stderr || result.stdout}`);
    }
    const payloadLine = String(result.stdout ?? '').trim().split(/\r?\n/).find(line => line.startsWith('{'));
    if (!payloadLine) {
      throw new Error(`${shell.packageKind} js-shell materialized probe emitted no JSON payload: ${result.stdout}`);
    }
    return normalizeShellPayload(shell, JSON.parse(payloadLine), options);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function normalizeShellPayload(shell, payload, options) {
  return {
    id: `${shell.packageKind}-spidermonkey-materialized-string-object`,
    tool: `spidermonkey-jsshell-${shell.packageKind}`,
    runtime: {
      id: 'spidermonkey-jsshell',
      name: 'SpiderMonkey js-shell',
      version: shell.version,
      packageKind: shell.packageKind,
      packageVerified: shell.packageVerified,
    },
    implementation: 'SpiderMonkey js-shell ASCII XML string and event-object materializer',
    family: 'partial-spidermonkey-materialized-headroom',
    contractScope: 'ascii-materialized-string-object-no-textdecoder',
    sameSemanticChecksumFields: true,
    fullStringParity: false,
    boundedMemory: null,
    memory: { primaryKind: 'not-recorded', note: 'SpiderMonkey js-shell does not expose process RSS or JS heap counters in this harness.' },
    sourceMode: 'corpus-seed-replay-sync-byte-loop',
    parserInput: 'SpiderMonkey js-shell Uint8Array from read(file, "binary"), replayed as bounded ASCII corpus seed bytes',
    demandDrivenSource: true,
    directReadableStream: false,
    fullArrayBufferParserInput: false,
    corpusSeedReplay: true,
    corpusSeedBytes: payload.seedBytes,
    targetBytes: payload.targetBytes,
    targetMiB: payload.targetBytes / MIB,
    corpusSeedToTargetRatio: payload.seedBytes / payload.targetBytes,
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
    startElementCount: payload.result.startElementCount,
    endElementCount: payload.result.endElementCount,
    textEventCount: payload.result.textEventCount,
    attributeCount: payload.result.attributeCount,
    checksum: payload.result.checksum,
    materializedStringCount: payload.result.materializedStringCount,
    materializedObjectCount: payload.result.materializedObjectCount,
    materializedAttributeObjectCount: payload.result.materializedAttributeObjectCount,
    shellFacts: {
      sourceArtifact: shell.sourceArtifact,
      hasJitExecutionStatus: shell.hasJitExecutionStatus,
      canReadBinaryInput: shell.canReadBinaryInput,
      canRunCurrentStaxFullStringBenchmark: shell.canRunCurrentStaxFullStringBenchmark,
    },
    options: {
      runs: options.runs,
      warmups: options.warmups,
    },
  };
}

function createShellScript(options) {
  const relativeCorpusPath = relative(process.cwd(), options.corpusFile);
  const corpusPathForShell = relativeCorpusPath && !relativeCorpusPath.startsWith('..') && !isAbsolute(relativeCorpusPath)
    ? relativeCorpusPath
    : options.corpusFile;
  const corpusPath = corpusPathForShell.replace(/\\/g, '/');
  const targetBytes = Math.round(options.targetMiB * MIB);
  return `
const corpusPath = ${JSON.stringify(corpusPath)};
const targetBytes = ${targetBytes};
const runs = ${options.runs};
const warmups = ${options.warmups};
const seed = read(corpusPath, 'binary');
if (!(seed instanceof Uint8Array)) throw new Error('read(..., "binary") did not return Uint8Array');

function parseRepeated(target) {
  const parser = new MaterializingParser();
  let remaining = target;
  while (remaining > 0) {
    const count = Math.min(seed.length, remaining);
    parser.scan(count === seed.length ? seed : seed.subarray(0, count));
    remaining -= count;
  }
  return parser.finish();
}

class MaterializingParser {
  constructor() {
    this.inTag = false;
    this.tagParts = null;
    this.textChunks = null;
    this.eventCount = 0;
    this.startElementCount = 0;
    this.endElementCount = 0;
    this.textEventCount = 0;
    this.attributeCount = 0;
    this.materializedStringCount = 0;
    this.materializedObjectCount = 0;
    this.materializedAttributeObjectCount = 0;
    this.checksum = 0;
  }
  scan(buffer) {
    let offset = 0;
    while (offset < buffer.length) {
      if (this.inTag) {
        const gt = buffer.indexOf(62, offset);
        if (gt === -1) {
          this.appendTagPart(buffer.subarray(offset));
          return;
        }
        const current = buffer.subarray(offset, gt);
        this.processTagWithCurrent(current);
        this.inTag = false;
        offset = gt + 1;
        continue;
      }
      const lt = buffer.indexOf(60, offset);
      const end = lt === -1 ? buffer.length : lt;
      this.appendText(buffer, offset, end);
      if (lt === -1) return;
      this.flushText();
      this.inTag = true;
      this.tagParts = null;
      offset = lt + 1;
    }
  }
  finish() {
    if (this.inTag) throw new Error('Unexpected end of file while scanning an XML tag.');
    this.flushText();
    return {
      eventCount: this.eventCount,
      startElementCount: this.startElementCount,
      endElementCount: this.endElementCount,
      textEventCount: this.textEventCount,
      attributeCount: this.attributeCount,
      materializedStringCount: this.materializedStringCount,
      materializedObjectCount: this.materializedObjectCount,
      materializedAttributeObjectCount: this.materializedAttributeObjectCount,
      checksum: mixChecksum(this.checksum, this.eventCount),
    };
  }
  appendText(buffer, start, end) {
    if (start >= end) return;
    this.textChunks = this.textChunks || [];
    this.textChunks.push(buffer.subarray(start, end));
  }
  flushText() {
    if (!this.textChunks) return;
    const value = asciiFromChunks(this.textChunks);
    this.textChunks = null;
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    this.materializedStringCount += value === trimmed ? 1 : 2;
    this.consume({ type: 'CHARACTERS', value: trimmed });
    this.textEventCount++;
  }
  appendTagPart(part) {
    if (part.length === 0) return;
    this.tagParts = this.tagParts || [];
    this.tagParts.push(part);
  }
  processTagWithCurrent(current) {
    if (this.tagParts === null) {
      processTag(current, this);
      return;
    }
    this.appendTagPart(current);
    processTag(concatUint8Arrays(this.tagParts), this);
    this.tagParts = null;
  }
  consume(event) {
    this.materializedObjectCount++;
    this.eventCount++;
    this.checksum = mixChecksum(this.checksum, publicEventTypeCode(event.type));
    if (event.type === 'START_ELEMENT' || event.type === 'END_ELEMENT') {
      this.checksum = foldString(this.checksum, event.name);
    }
    if (event.type === 'CHARACTERS') {
      this.checksum = foldString(this.checksum, event.value);
    }
    if (event.type === 'START_ELEMENT') {
      const entries = Object.entries(event.attributes);
      this.checksum = mixChecksum(this.checksum, entries.length);
      for (const entry of entries) {
        this.checksum = foldString(this.checksum, entry[0]);
        this.checksum = foldString(this.checksum, entry[1]);
      }
    }
  }
}

function processTag(bytes, parser) {
  let start = skipWhitespace(bytes, 0, bytes.length);
  let end = trimTrailingWhitespace(bytes, start, bytes.length);
  if (start >= end) return;
  const first = bytes[start];
  if (first === 63 || first === 33) return;
  if (first === 47) {
    const nameStart = skipWhitespace(bytes, start + 1, end);
    const nameEnd = scanNameEnd(bytes, nameStart, end);
    const name = asciiFromBytes(bytes, nameStart, nameEnd);
    parser.materializedStringCount++;
    parser.consume({ type: 'END_ELEMENT', name });
    parser.endElementCount++;
    return;
  }
  const nameStart = start;
  const nameEnd = scanNameEnd(bytes, nameStart, end);
  const selfClosing = trimTrailingSlash(bytes, nameEnd, end);
  const tagEnd = selfClosing ? trimTrailingWhitespace(bytes, nameEnd, end - 1) : end;
  const name = asciiFromBytes(bytes, nameStart, nameEnd);
  const attributes = parseAttributes(bytes, nameEnd, tagEnd, parser);
  parser.materializedStringCount++;
  parser.consume({ type: 'START_ELEMENT', name, attributes });
  parser.startElementCount++;
  parser.attributeCount += Object.keys(attributes).length;
  if (selfClosing) {
    parser.consume({ type: 'END_ELEMENT', name });
    parser.endElementCount++;
  }
}

function parseAttributes(bytes, start, end, parser) {
  const attributes = {};
  parser.materializedAttributeObjectCount++;
  let index = start;
  while (index < end) {
    index = skipWhitespace(bytes, index, end);
    if (index >= end) break;
    const nameStart = index;
    while (index < end && !isXmlWhitespace(bytes[index]) && bytes[index] !== 61) index++;
    const nameEnd = index;
    index = skipWhitespace(bytes, index, end);
    if (bytes[index] !== 61) break;
    index++;
    index = skipWhitespace(bytes, index, end);
    const quote = bytes[index];
    if (quote !== 34 && quote !== 39) break;
    index++;
    const valueStart = index;
    while (index < end && bytes[index] !== quote) index++;
    const valueEnd = index;
    if (index < end) index++;
    const name = asciiFromBytes(bytes, nameStart, nameEnd);
    const value = asciiFromBytes(bytes, valueStart, valueEnd);
    parser.materializedStringCount += 2;
    attributes[name] = value;
  }
  return attributes;
}
function publicEventTypeCode(type) {
  if (type === 'START_ELEMENT') return 2;
  if (type === 'END_ELEMENT') return 3;
  if (type === 'CHARACTERS') return 4;
  return 6;
}
function asciiFromChunks(chunks) {
  if (chunks.length === 1) return asciiFromBytes(chunks[0], 0, chunks[0].length);
  return asciiFromBytes(concatUint8Arrays(chunks), 0, chunks.reduce((sum, chunk) => sum + chunk.length, 0));
}
function asciiFromBytes(bytes, start, end) {
  let value = '';
  for (let index = start; index < end; index += 8192) {
    const sliceEnd = Math.min(end, index + 8192);
    value += String.fromCharCode.apply(null, bytes.subarray(index, sliceEnd));
  }
  return value;
}
function concatUint8Arrays(chunks) {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  return buffer;
}
function skipWhitespace(bytes, index, end) {
  while (index < end && isXmlWhitespace(bytes[index])) index++;
  return index;
}
function trimTrailingWhitespace(bytes, start, end) {
  while (end > start && isXmlWhitespace(bytes[end - 1])) end--;
  return end;
}
function trimTrailingSlash(bytes, start, end) {
  let index = trimTrailingWhitespace(bytes, start, end);
  return index > start && bytes[index - 1] === 47;
}
function scanNameEnd(bytes, index, end) {
  while (index < end) {
    const byte = bytes[index];
    if (isXmlWhitespace(byte) || byte === 47) return index;
    index++;
  }
  return index;
}
function isXmlWhitespace(byte) {
  return byte === 32 || byte === 10 || byte === 13 || byte === 9;
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
function sameResult(left, right) {
  return left.eventCount === right.eventCount
    && left.checksum === right.checksum
    && left.materializedStringCount === right.materializedStringCount
    && left.materializedObjectCount === right.materializedObjectCount
    && left.materializedAttributeObjectCount === right.materializedAttributeObjectCount;
}

let first = null;
const samplesMs = [];
for (let i = 0; i < warmups; i++) parseRepeated(targetBytes);
for (let i = 0; i < runs; i++) {
  if (typeof gc === 'function') gc();
  const started = performance.now();
  const result = parseRepeated(targetBytes);
  const elapsed = performance.now() - started;
  if (first !== null && !sameResult(first, result)) throw new Error('unstable materialized checksum');
  first = first || result;
  samplesMs.push(elapsed);
}
const avgMs = samplesMs.reduce((sum, value) => sum + value, 0) / samplesMs.length;
print(JSON.stringify({
  seedBytes: seed.length,
  targetBytes,
  samplesMs,
  avgMs,
  mibPerSec: (targetBytes / ${MIB}) / (avgMs / 1000),
  result: first
}));
`;
}

function createReport(options, rows, extra) {
  const fastest = extra.fastest ?? maxBy(rows, row => row.mibPerSec);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'spidermonkey-jsshell-materialized-headroom',
    contract: 'spidermonkey-jsshell-ascii-materialized-string-object-headroom-not-stax',
    note: 'Runs a SpiderMonkey js-shell ASCII XML workload that materializes JS string primitives and event-shaped objects. This is closer to the public StAX object surface than token-boundary scanning, but it still does not use TextDecoder, ReadableStream, or the unchanged public StAX reader, and it has no row-level memory proof.',
    environment: {
      runtimeName: 'spidermonkey-jsshell',
      javascriptEngine: 'SpiderMonkey',
      platform: `${process.platform}-${process.arch}`,
      cpuName: cpus()[0]?.model ?? 'unknown',
    },
    fixture: {
      source: 'ascii-corpus-seed-replay',
      sourceFile: options.corpusFile,
      corpusSeedBytes: extra.corpusSeedBytes,
      targetBytes: Math.round(options.targetMiB * MIB),
      sizeMiB: options.targetMiB,
      sizeGiB: options.targetMiB / 1024,
    },
    options: {
      runs: options.runs,
      warmups: options.warmups,
      selfTest: extra.selfTest,
    },
    runtime: {
      id: 'spidermonkey-jsshell',
      name: 'SpiderMonkey js-shell',
    },
    rows,
    summary: {
      rowCount: rows.length,
      fastest: summarizeRow(fastest),
      counterexamples200MiB: rows.filter(row => row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200).length,
      partialRowsAtOrAbove200MiB: rows.filter(row => row.fullStringParity === false && row.mibPerSec >= 200).length,
      memoryProofRows: rows.filter(row => row.boundedMemory !== null).length,
      sameSemanticChecksumRows: rows.filter(row => row.sameSemanticChecksumFields === true).length,
    },
    findings: createFindings(rows, fastest),
  };
}

function createSelfTestReport(options) {
  const rows = ['release', 'nightly'].map((packageKind, index) => ({
    id: `${packageKind}-spidermonkey-materialized-string-object`,
    tool: `spidermonkey-jsshell-${packageKind}`,
    runtime: {
      id: 'spidermonkey-jsshell',
      name: 'SpiderMonkey js-shell',
      version: packageKind === 'release' ? 'JavaScript-C143.0.1' : 'JavaScript-C143.0a1',
      packageKind,
      packageVerified: packageKind === 'release',
    },
    implementation: 'SpiderMonkey js-shell ASCII XML string and event-object materializer',
    family: 'partial-spidermonkey-materialized-headroom',
    contractScope: 'ascii-materialized-string-object-no-textdecoder',
    sameSemanticChecksumFields: true,
    fullStringParity: false,
    boundedMemory: null,
    memory: { primaryKind: 'not-recorded', note: 'self-test' },
    sourceMode: 'corpus-seed-replay-sync-byte-loop',
    parserInput: 'SpiderMonkey js-shell Uint8Array from read(file, "binary"), replayed as bounded ASCII corpus seed bytes',
    demandDrivenSource: true,
    directReadableStream: false,
    fullArrayBufferParserInput: false,
    corpusSeedReplay: true,
    corpusSeedBytes: 4551,
    targetBytes: Math.round(options.targetMiB * MIB),
    targetMiB: options.targetMiB,
    corpusSeedToTargetRatio: 4551 / Math.round(options.targetMiB * MIB),
    sampleCount: options.runs,
    samplesMs: [24 + index],
    avgMs: 24 + index,
    minMs: 24 + index,
    maxMs: 24 + index,
    sampleSpreadRatio: 0,
    mibPerSec: options.targetMiB / ((24 + index) / 1000),
    eventCount: 1000,
    startElementCount: 300,
    endElementCount: 300,
    textEventCount: 400,
    attributeCount: 200,
    checksum: -223456 + index,
    materializedStringCount: 1600,
    materializedObjectCount: 1000,
    materializedAttributeObjectCount: 300,
    shellFacts: {
      sourceArtifact: `firefox-spidermonkey-${packageKind}-jsshell-availability-audit.json`,
      hasJitExecutionStatus: true,
      canReadBinaryInput: true,
      canRunCurrentStaxFullStringBenchmark: false,
    },
    options: {
      runs: options.runs,
      warmups: options.warmups,
    },
  }));
  return createReport(options, rows, {
    corpusSeedBytes: 4551,
    selfTest: true,
    fastest: rows[0],
  });
}

function createFindings(rows, fastest) {
  return [
    {
      id: 'spidermonkey-materialized-headroom',
      classification: 'LIMITED_EVIDENCE_PRESENT',
      summary: `Fastest SpiderMonkey js-shell materialized string/object row is ${formatNumber(fastest?.mibPerSec)} MiB/s.`,
      evidence: [
        `row=${fastest?.id ?? 'none'}`,
        `sameSemanticChecksumFields=${fastest?.sameSemanticChecksumFields ?? false}`,
        `fullStringParity=${fastest?.fullStringParity ?? null}`,
      ],
    },
    {
      id: 'materialized-headroom-not-stax-counterexample',
      classification: 'SCOPE_GUARD',
      summary: 'The materialized js-shell rows are not 200 MiB/s full-string bounded-memory counterexamples.',
      evidence: [
        `counterexampleRows=${rows.filter(row => row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200).length}`,
        `memoryProofRows=${rows.filter(row => row.boundedMemory !== null).length}`,
        'TextDecoder/ReadableStream/public StAX reader unchanged execution remains blocked.',
      ],
    },
  ];
}

function summarizeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    mibPerSec: row.mibPerSec,
    fullStringParity: row.fullStringParity,
    sameSemanticChecksumFields: row.sameSemanticChecksumFields,
    boundedMemory: row.boundedMemory,
    materializedStringCount: row.materializedStringCount,
    materializedObjectCount: row.materializedObjectCount,
  };
}

function renderMarkdown(report) {
  const lines = [
    '# SpiderMonkey JS Shell Materialized Headroom',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Rows: ${report.summary.rowCount}`,
    `- Fastest row: ${report.summary.fastest?.id ?? 'none'} at ${formatNumber(report.summary.fastest?.mibPerSec)} MiB/s`,
    `- Same semantic checksum rows: ${report.summary.sameSemanticChecksumRows}`,
    `- 200 MiB/s bounded full-string counterexamples: ${report.summary.counterexamples200MiB}`,
    `- Partial rows at or above 200 MiB/s: ${report.summary.partialRowsAtOrAbove200MiB}`,
    `- Rows with memory proof: ${report.summary.memoryProofRows}`,
    '',
    '## Rows',
    '',
    '| Row | Runtime | MiB/s | Full StAX parity | Semantic fields | Memory proof | Strings | Objects |',
    '| --- | --- | ---: | --- | --- | --- | ---: | ---: |',
  ];
  for (const row of report.rows) {
    lines.push(`| \`${row.id}\` | ${row.runtime.version} | ${formatNumber(row.mibPerSec)} | ${row.fullStringParity ? 'yes' : 'no'} | ${row.sameSemanticChecksumFields ? 'yes' : 'no'} | ${row.boundedMemory === null ? 'none' : row.boundedMemory ? 'yes' : 'no'} | ${row.materializedStringCount} | ${row.materializedObjectCount} |`);
  }
  lines.push(
    '',
    '## Findings',
    '',
    ...report.findings.flatMap(finding => [
      `- ${finding.id} (${finding.classification}): ${finding.summary}`,
      ...finding.evidence.map(item => `  - ${item}`),
    ]),
    '',
  );
  return `${lines.join('\n')}\n`;
}

function maxBy(values, selector) {
  let best = null;
  let bestValue = -Infinity;
  for (const value of values) {
    const selected = selector(value);
    if (selected > bestValue) {
      best = value;
      bestValue = selected;
    }
  }
  return best;
}

function oneLine(value) {
  return String(value ?? '').trim().split(/\r?\n/)[0] || null;
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function writeOutput(filePath, text) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, text);
}

if (import.meta.url === pathToFileUrl(process.argv[1])) {
  main();
}

function pathToFileUrl(filePath) {
  return filePath ? `file:///${resolve(filePath).replace(/\\/g, '/')}` : '';
}
