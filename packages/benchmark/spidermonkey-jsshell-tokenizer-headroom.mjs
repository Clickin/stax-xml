import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultReleaseJson = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-release-jsshell-availability-audit.json');
const defaultNightlyJson = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-nightly-jsshell-availability-audit.json');
const defaultCorpusFile = resolve(__dirname, 'assets', 'books.xml');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'spidermonkey-jsshell-tokenizer-headroom.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'spidermonkey-jsshell-tokenizer-headroom.md');
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
      case '--release-json':
        options.releaseJson = resolve(process.cwd(), readValue());
        break;
      case '--nightly-json':
        options.nightlyJson = resolve(process.cwd(), readValue());
        break;
      case '--corpus-file':
        options.corpusFile = resolve(process.cwd(), readValue());
        break;
      case '--target-mib':
        options.targetMiB = parsePositiveNumber(readValue(), name);
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), name);
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--self-test':
        options.selfTest = true;
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
  console.log(`spidermonkey-jsshell-tokenizer-headroom: rows=${report.rows.length} fastest=${report.summary.fastest.id} ${formatNumber(report.summary.fastest.mibPerSec)} MiB/s`);
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
  const tempDir = mkdtempSync(join(tmpdir(), 'stax-spidermonkey-tokenizer-'));
  const scriptPath = join(tempDir, 'tokenizer-headroom.js');
  try {
    writeFileSync(scriptPath, createShellScript(options), 'utf8');
    const result = spawnSync(shell.jsShell, ['--ion-eager', '--ion-offthread-compile=off', scriptPath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    });
    if (result.status !== 0) {
      throw new Error(`${shell.packageKind} js-shell tokenizer probe failed: ${result.stderr || result.stdout}`);
    }
    const payloadLine = String(result.stdout ?? '').trim().split(/\r?\n/).find(line => line.startsWith('{'));
    if (!payloadLine) {
      throw new Error(`${shell.packageKind} js-shell tokenizer probe emitted no JSON payload: ${result.stdout}`);
    }
    const payload = JSON.parse(payloadLine);
    return normalizeShellPayload(shell, payload, options);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function normalizeShellPayload(shell, payload, options) {
  return {
    id: `${shell.packageKind}-spidermonkey-token-boundary`,
    tool: `spidermonkey-jsshell-${shell.packageKind}`,
    runtime: {
      id: 'spidermonkey-jsshell',
      name: 'SpiderMonkey js-shell',
      version: shell.version,
      packageKind: shell.packageKind,
      packageVerified: shell.packageVerified,
    },
    implementation: 'SpiderMonkey js-shell corpus-seed XML token-boundary byte scanner',
    family: 'partial-spidermonkey-tokenizer-headroom',
    contractScope: 'xml-token-boundary-no-string-materialization',
    fullStringParity: false,
    boundedMemory: null,
    memory: { primaryKind: 'not-recorded', note: 'SpiderMonkey js-shell does not expose process RSS or JS heap counters in this harness.' },
    sourceMode: 'corpus-seed-replay-sync-byte-loop',
    parserInput: 'SpiderMonkey js-shell Uint8Array from read(file, "binary"), replayed as bounded corpus seed bytes',
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

function scanRepeated(target) {
  const tokenizer = new ByteTokenizer();
  let remaining = target;
  while (remaining > 0) {
    const count = Math.min(seed.length, remaining);
    tokenizer.scan(count === seed.length ? seed : seed.subarray(0, count));
    remaining -= count;
  }
  return tokenizer.finish();
}

class ByteTokenizer {
  constructor() {
    this.inTag = false;
    this.tagParts = null;
    this.textHasNonWhitespace = false;
    this.textLength = 0;
    this.eventCount = 0;
    this.startElementCount = 0;
    this.endElementCount = 0;
    this.textEventCount = 0;
    this.attributeCount = 0;
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
      this.scanText(buffer, offset, end);
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
      checksum: mixChecksum(this.checksum, this.eventCount),
    };
  }
  scanText(buffer, start, end) {
    if (start >= end) return;
    this.textLength += end - start;
    if (this.textHasNonWhitespace) return;
    for (let index = start; index < end; index++) {
      if (!isXmlWhitespace(buffer[index])) {
        this.textHasNonWhitespace = true;
        return;
      }
    }
  }
  flushText() {
    if (!this.textHasNonWhitespace) {
      this.textLength = 0;
      return;
    }
    this.eventCount++;
    this.textEventCount++;
    this.checksum = mixChecksum(this.checksum, 4);
    this.checksum = mixChecksum(this.checksum, this.textLength);
    this.textLength = 0;
    this.textHasNonWhitespace = false;
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
}

function processTag(bytes, state) {
  let start = skipWhitespace(bytes, 0, bytes.length);
  let end = trimTrailingWhitespace(bytes, start, bytes.length);
  if (start >= end) return;
  const first = bytes[start];
  if (first === 63) return;
  if (first === 33) return;
  if (first === 47) {
    const nameStart = skipWhitespace(bytes, start + 1, end);
    const nameEnd = scanNameEnd(bytes, nameStart, end);
    emitElement(state, 3, hashBytes(bytes, nameStart, nameEnd), 0);
    state.endElementCount++;
    return;
  }
  const nameStart = start;
  const nameEnd = scanNameEnd(bytes, nameStart, end);
  const selfClosing = trimTrailingSlash(bytes, nameEnd, end);
  const tagEnd = selfClosing ? end - 1 : end;
  const attrCount = countAttributes(bytes, nameEnd, tagEnd);
  const nameHash = hashBytes(bytes, nameStart, nameEnd);
  emitElement(state, 2, nameHash, attrCount);
  state.startElementCount++;
  state.attributeCount += attrCount;
  if (selfClosing) {
    emitElement(state, 3, nameHash, 0);
    state.endElementCount++;
  }
}
function emitElement(state, type, nameHash, attrCount) {
  state.eventCount++;
  state.checksum = mixChecksum(state.checksum, type);
  state.checksum = mixChecksum(state.checksum, nameHash);
  state.checksum = mixChecksum(state.checksum, attrCount);
}
function countAttributes(bytes, start, end) {
  let count = 0;
  let quote = 0;
  for (let index = start; index < end; index++) {
    const byte = bytes[index];
    if (quote !== 0) {
      if (byte === quote) quote = 0;
      continue;
    }
    if (byte === 34 || byte === 39) quote = byte;
    else if (byte === 61) count++;
  }
  return count;
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
function hashBytes(bytes, start, end) {
  let hash = 2166136261 | 0;
  for (let index = start; index < end; index++) hash = mixChecksum(hash, bytes[index]);
  return hash;
}
function isXmlWhitespace(byte) {
  return byte === 32 || byte === 10 || byte === 13 || byte === 9;
}
function mixChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}
function sameTokenResult(left, right) {
  return left.eventCount === right.eventCount
    && left.startElementCount === right.startElementCount
    && left.endElementCount === right.endElementCount
    && left.textEventCount === right.textEventCount
    && left.attributeCount === right.attributeCount
    && left.checksum === right.checksum;
}

let first = null;
const samplesMs = [];
for (let i = 0; i < warmups; i++) scanRepeated(targetBytes);
for (let i = 0; i < runs; i++) {
  if (typeof gc === 'function') gc();
  const started = performance.now();
  const result = scanRepeated(targetBytes);
  const elapsed = performance.now() - started;
  if (first !== null && !sameTokenResult(first, result)) throw new Error('unstable token checksum');
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
    objective: 'spidermonkey-jsshell-tokenizer-headroom',
    contract: 'spidermonkey-jsshell-corpus-token-boundary-headroom-not-stax',
    note: 'Runs a SpiderMonkey js-shell XML token-boundary byte scanner over corpus-seed replay. This is JavaScript runtime parser-core headroom evidence only: it does not use TextDecoder, does not materialize names/text strings, does not expose public StAX event objects, and is not a full-string StAX counterexample.',
    environment: {
      runtimeName: 'spidermonkey-jsshell',
      javascriptEngine: 'SpiderMonkey',
      platform: `${process.platform}-${process.arch}`,
      cpuName: cpus()[0]?.model ?? 'unknown',
    },
    fixture: {
      source: 'corpus-seed-replay',
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
    },
    findings: createFindings(rows, fastest),
  };
}

function createSelfTestReport(options) {
  const rows = ['release', 'nightly'].map((packageKind, index) => ({
    id: `${packageKind}-spidermonkey-token-boundary`,
    tool: `spidermonkey-jsshell-${packageKind}`,
    runtime: {
      id: 'spidermonkey-jsshell',
      name: 'SpiderMonkey js-shell',
      version: packageKind === 'release' ? 'JavaScript-C143.0.1' : 'JavaScript-C143.0a1',
      packageKind,
      packageVerified: packageKind === 'release',
    },
    implementation: 'SpiderMonkey js-shell corpus-seed XML token-boundary byte scanner',
    family: 'partial-spidermonkey-tokenizer-headroom',
    contractScope: 'xml-token-boundary-no-string-materialization',
    fullStringParity: false,
    boundedMemory: null,
    memory: { primaryKind: 'not-recorded', note: 'self-test' },
    sourceMode: 'corpus-seed-replay-sync-byte-loop',
    parserInput: 'SpiderMonkey js-shell Uint8Array from read(file, "binary"), replayed as bounded corpus seed bytes',
    demandDrivenSource: true,
    directReadableStream: false,
    fullArrayBufferParserInput: false,
    corpusSeedReplay: true,
    corpusSeedBytes: 4551,
    targetBytes: Math.round(options.targetMiB * MIB),
    targetMiB: options.targetMiB,
    corpusSeedToTargetRatio: 4551 / Math.round(options.targetMiB * MIB),
    sampleCount: options.runs,
    samplesMs: [8 + index],
    avgMs: 8 + index,
    minMs: 8 + index,
    maxMs: 8 + index,
    sampleSpreadRatio: 0,
    mibPerSec: options.targetMiB / ((8 + index) / 1000),
    eventCount: 1000,
    startElementCount: 300,
    endElementCount: 300,
    textEventCount: 400,
    attributeCount: 200,
    checksum: -123456 + index,
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
    fastest: maxBy(rows, row => row.mibPerSec),
  });
}

function createFindings(rows, fastest) {
  return [
    {
      id: 'spidermonkey-jsshell-tokenizer-headroom',
      classification: 'BENCH_FACT',
      summary: `Fastest SpiderMonkey js-shell token-boundary row was ${fastest.id} at ${formatNumber(fastest.mibPerSec)} MiB/s.`,
      evidence: rows.map(row => `${row.id}: ${formatNumber(row.mibPerSec)} MiB/s, jitStatus=${row.shellFacts.hasJitExecutionStatus}, binaryInput=${row.shellFacts.canReadBinaryInput}`),
    },
    {
      id: 'partial-not-stax-counterexample',
      classification: 'SCOPE_GUARD',
      summary: 'Rows scan token boundaries and fold counters without TextDecoder, JavaScript string materialization, public event objects, or full StAX checksum parity.',
      evidence: rows.map(row => `${row.id}: fullStringParity=${row.fullStringParity}, boundedMemory=${row.boundedMemory}, contractScope=${row.contractScope}`),
    },
    {
      id: 'unchanged-stax-surface-still-blocked',
      classification: 'SCOPE_GUARD',
      summary: 'The official js-shells can read corpus bytes and execute Ion, but cannot run the current full-string StAX benchmark unchanged because TextDecoder and Web globals are missing.',
      evidence: rows.map(row => `${row.id}: canRunCurrentStaxFullStringBenchmark=${row.shellFacts.canRunCurrentStaxFullStringBenchmark}`),
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# SpiderMonkey JS Shell Tokenizer Headroom',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Fixture source: ${report.fixture.sourceFile}`,
    `- Target size: ${formatNumber(report.fixture.sizeMiB)} MiB`,
    `- Corpus seed bytes: ${report.fixture.corpusSeedBytes}`,
    `- Fastest row: ${report.summary.fastest.id} ${formatNumber(report.summary.fastest.mibPerSec)} MiB/s`,
    `- 200 MiB/s bounded full-string counterexamples: ${report.summary.counterexamples200MiB}`,
    `- Partial rows at or above 200 MiB/s: ${report.summary.partialRowsAtOrAbove200MiB}`,
    `- Rows with memory proof: ${report.summary.memoryProofRows}`,
    '',
    '## Rows',
    '',
    '| Row | Version | Package verified | MiB/s | Samples | Spread | Full string | Bounded memory | Events | Start | End | Text | Attrs | Checksum | Seed/target |',
    '| --- | --- | --- | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const row of report.rows) {
    lines.push(`| \`${row.id}\` | ${row.runtime.version} | ${row.runtime.packageVerified ? 'yes' : 'no'} | ${formatNumber(row.mibPerSec)} | ${row.sampleCount} | ${formatPercent(row.sampleSpreadRatio)} | ${row.fullStringParity ? 'yes' : 'no'} | ${row.boundedMemory === null ? 'unknown' : row.boundedMemory ? 'yes' : 'no'} | ${row.eventCount} | ${row.startElementCount} | ${row.endElementCount} | ${row.textEventCount} | ${row.attributeCount} | ${row.checksum} | ${formatNumber(row.corpusSeedToTargetRatio)} |`);
  }
  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) lines.push(`  - ${evidence}`);
  }
  lines.push(
    '',
    '## Limits',
    '',
    '- This is not emitted SpiderMonkey IR or optimized-code evidence.',
    '- This is not a full StAX benchmark: it deliberately avoids TextDecoder and string/object materialization.',
    '- Missing memory counters mean even a fast partial row is not a bounded-memory full-string counterexample.',
    '',
  );
  return `${lines.join('\n')}\n`;
}

function summarizeRow(row) {
  return {
    id: row.id,
    mibPerSec: row.mibPerSec,
    fullStringParity: row.fullStringParity,
    boundedMemory: row.boundedMemory,
  };
}

function maxBy(values, selector) {
  return values.reduce((best, value) => best === undefined || selector(value) > selector(best) ? value : best, undefined);
}

function writeOutput(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function formatPercent(value) {
  return `${formatNumber(value * 100)}%`;
}

function oneLine(value) {
  return String(value ?? 'not-recorded').trim().replace(/\s+/g, ' ') || 'not-recorded';
}

main();
