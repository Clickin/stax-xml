import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit.md');
const defaultCorpusFile = resolve(__dirname, 'assets', 'books.xml');
const defaultTaskId = 'bzK0wWZvQoOguMjTIbRJ_g';
const defaultRoute = 'gecko.v2.mozilla-central.latest.firefox.win64-debug';
const defaultArtifactName = 'public/build/target.jsshell.zip';
const defaultArtifactUrl = `https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/${defaultTaskId}/artifacts/${defaultArtifactName}`;

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    jsShell: null,
    taskId: defaultTaskId,
    route: defaultRoute,
    artifactName: defaultArtifactName,
    artifactUrl: defaultArtifactUrl,
    zipPath: null,
    targetTxt: null,
    buildhubJson: null,
    mozinfoJson: null,
    corpusFile: defaultCorpusFile,
    targetMiB: 1,
    runs: 1,
    warmups: 0,
    selfTest: false,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    artifactUrlExplicit: false,
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
      case '--js-shell':
        options.jsShell = resolve(process.cwd(), readValue());
        break;
      case '--task-id':
        options.taskId = readValue();
        updateArtifactUrl(options);
        break;
      case '--route':
        options.route = readValue();
        break;
      case '--artifact-name':
        options.artifactName = readValue();
        updateArtifactUrl(options);
        break;
      case '--artifact-url':
        options.artifactUrl = readValue();
        options.artifactUrlExplicit = true;
        break;
      case '--zip-path':
        options.zipPath = resolve(process.cwd(), readValue());
        break;
      case '--target-txt':
        options.targetTxt = resolve(process.cwd(), readValue());
        break;
      case '--buildhub-json':
        options.buildhubJson = resolve(process.cwd(), readValue());
        break;
      case '--mozinfo-json':
        options.mozinfoJson = resolve(process.cwd(), readValue());
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
  return options;
}

function updateArtifactUrl(options) {
  if (!options.artifactUrlExplicit) {
    options.artifactUrl = `https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/${options.taskId}/artifacts/${options.artifactName}`;
  }
}

async function main() {
  const options = parseArgs();
  const report = options.selfTest ? createSelfTestReport(options) : runAudit(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`${report.objective}: status=${report.outcome.status} xmlCodegen=${report.outcome.hasXmlWorkloadCodegenOutput} sameContract=${report.outcome.sameContractStaxRow} closes=${report.outcome.closesEmittedIrObligation}`);
}

function runAudit(options) {
  const provenance = readProvenance(options);
  if (!options.jsShell || !existsSync(options.jsShell)) {
    return createReport(options, {
      status: 'missing-shell',
      provenance,
      version: null,
      xmlCodegenProbe: null,
      apiProbe: null,
    });
  }
  const version = run(options.jsShell, ['--version']);
  const xmlCodegenProbe = runXmlCodegenProbe(options);
  const apiProbe = runApiProbe(options.jsShell);
  return createReport(options, {
    status: version.exitCode === 0 && xmlCodegenProbe.exitCode === 0 ? 'available' : 'probe-failed',
    provenance,
    version: summarizeVersion(version),
    xmlCodegenProbe,
    apiProbe,
  });
}

function runXmlCodegenProbe(options) {
  const tempDir = mkdtempSync(join(tmpdir(), 'stax-spidermonkey-xml-codegen-'));
  const scriptPath = join(tempDir, 'xml-codegen.js');
  try {
    writeFileSync(scriptPath, createShellScript(options), 'utf8');
    const flags = 'codegen';
    const result = run(options.jsShell, ['--ion-eager', '--ion-offthread-compile=off', scriptPath], {
      env: { ...process.env, IONFLAGS: flags, JIT_SPEW: flags },
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120_000,
    });
    const combined = `${result.stdout}\n${result.stderr}`;
    const payload = normalizePayload(parsePayload(combined));
    const codegenMarkerCount = countMatches(combined, /\[Codegen\]/g);
    const ionScriptMarkerCount = countMatches(combined, /Created IonScript|IonScript/g);
    const assemblyMnemonicCount = countMatches(combined, /\b(?:movq|movl|mov|addq|addl|subq|push|pop|call|jmp|ret|cmpq|testl)\b/g);
    return {
      status: result.exitCode === 0 && payload && codegenMarkerCount > 0
        ? 'xml-workload-codegen-output-emitted'
        : result.exitCode === 0 && payload
          ? 'xml-workload-no-codegen-output'
          : 'failed',
      flags,
      exitCode: result.exitCode,
      error: result.error,
      outputBytes: Buffer.byteLength(combined, 'utf8'),
      stdoutLineCount: lineCount(result.stdout),
      stderrLineCount: lineCount(result.stderr),
      codegenMarkerCount,
      ionScriptMarkerCount,
      assemblyMnemonicCount,
      payload,
      excerpt: selectExcerptLines(combined, 50),
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function runApiProbe(jsShell) {
  const result = run(jsShell, ['-e', [
    'var names = ["TextDecoder", "TextEncoder", "ReadableStream", "fetch", "Uint8Array", "read"];',
    'var out = {};',
    'for (var i = 0; i < names.length; i++) out[names[i]] = typeof globalThis[names[i]];',
    "print('apiProbe=' + JSON.stringify(out));",
  ].join(' ')]);
  const combined = `${result.stdout}\n${result.stderr}`;
  const raw = firstMatch(combined, /apiProbe=(\{.+\})/)?.[1] ?? null;
  let globals = null;
  if (raw) {
    try {
      globals = JSON.parse(raw);
    } catch {
      globals = null;
    }
  }
  const missingGlobals = globals
    ? Object.entries(globals).filter(([, value]) => value === 'undefined').map(([name]) => name)
    : [];
  return {
    status: result.exitCode === 0 && globals ? 'completed' : 'failed',
    exitCode: result.exitCode,
    error: result.error,
    globals,
    missingGlobals,
    canRunCurrentStaxFullStringBenchmark: globals
      ? ['TextDecoder', 'TextEncoder', 'ReadableStream', 'fetch', 'Uint8Array'].every(name => globals[name] !== 'undefined')
      : false,
    excerpt: selectExcerptLines(combined, 10),
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
function nowMs() {
  return typeof performance !== 'undefined' && performance && typeof performance.now === 'function' ? performance.now() : Date.now();
}
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
  if (first === 63 || first === 33) return;
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
  const started = nowMs();
  const result = scanRepeated(targetBytes);
  const elapsed = nowMs() - started;
  if (first !== null && !sameTokenResult(first, result)) throw new Error('unstable token checksum');
  first = first || result;
  samplesMs.push(elapsed);
}
const avgMs = samplesMs.reduce((sum, value) => sum + value, 0) / samplesMs.length;
print('xmlPayload=' + JSON.stringify({
  seedBytes: seed.length,
  targetBytes,
  samplesMs,
  avgMs,
  mibPerSec: (targetBytes / ${MIB}) / (avgMs / 1000),
  result: first
}));
`;
}

function createReport(options, shell) {
  const hasXmlWorkloadCodegenOutput = shell.xmlCodegenProbe?.status === 'xml-workload-codegen-output-emitted';
  const canRunCurrentStaxFullStringBenchmark = shell.apiProbe?.canRunCurrentStaxFullStringBenchmark === true;
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit',
    contract: 'current-taskcluster-debug-spidermonkey-xml-workload-codegen-surface-not-same-contract-stax',
    note: 'Runs a current mozilla-central Taskcluster win64-debug SpiderMonkey js-shell with JitSpew codegen enabled on the repository XML byte-tokenizer workload. This ties current codegen diagnostics to XML byte scanning, but it is not a same-contract StAX full-string row because it avoids TextDecoder, string materialization, and public event objects.',
    environment: {
      platform: `${process.platform}-${process.arch}`,
    },
    fixture: {
      source: 'corpus-seed-replay',
      sourceFile: options.corpusFile,
      corpusSeedBytes: shell.xmlCodegenProbe?.payload?.seedBytes ?? null,
      targetBytes: Math.round(options.targetMiB * MIB),
      sizeMiB: options.targetMiB,
      sizeGiB: options.targetMiB / 1024,
    },
    parameters: {
      jsShell: options.jsShell,
      taskId: options.taskId,
      route: options.route,
      artifactName: options.artifactName,
      artifactUrl: options.artifactUrl,
      zipPath: options.zipPath,
      targetTxt: options.targetTxt,
      buildhubJson: options.buildhubJson,
      mozinfoJson: options.mozinfoJson,
      corpusFile: options.corpusFile,
      targetMiB: options.targetMiB,
      runs: options.runs,
      warmups: options.warmups,
      selfTest: options.selfTest,
    },
    runtime: {
      id: 'spidermonkey-jsshell',
      name: 'SpiderMonkey js-shell',
      version: shell.version?.value ?? null,
    },
    shell,
    row: createScopeGuardRow(options, shell),
    outcome: {
      status: shell.status,
      hasJitExecutionStatus: null,
      hasIrDumpSurface: hasXmlWorkloadCodegenOutput,
      hasCodegenDumpOutput: hasXmlWorkloadCodegenOutput,
      hasXmlWorkloadCodegenOutput,
      hasNativeDisassemblySurface: hasXmlWorkloadCodegenOutput,
      nativeDumpComplete: hasXmlWorkloadCodegenOutput,
      scopeComparableToCurrentFirefox: true,
      sameContractStaxRow: false,
      fullStringParity: false,
      canRunCurrentStaxFullStringBenchmark,
      closesDiagnosticSurfaceObligation: hasXmlWorkloadCodegenOutput,
      closesEmittedIrObligation: false,
    },
  };
  report.findings = createFindings(report);
  return report;
}

function createScopeGuardRow(options, shell) {
  const payload = shell.xmlCodegenProbe?.payload;
  if (!payload) return null;
  return {
    id: 'taskcluster-debug-spidermonkey-xml-token-boundary-codegen',
    tool: 'spidermonkey-taskcluster-debug-jsshell',
    runtime: {
      id: 'spidermonkey-jsshell',
      name: 'SpiderMonkey js-shell',
      version: shell.version?.value ?? null,
      taskId: shell.provenance?.taskId ?? null,
      buildId: shell.provenance?.targetTxt?.buildId ?? shell.provenance?.buildhub?.buildId ?? null,
    },
    implementation: 'SpiderMonkey debug js-shell XML token-boundary byte scanner under IONFLAGS/JIT_SPEW=codegen',
    family: 'partial-spidermonkey-tokenizer-codegen',
    contractScope: 'xml-token-boundary-no-string-materialization',
    fullStringParity: false,
    boundedMemory: null,
    memory: { primaryKind: 'not-recorded', note: 'SpiderMonkey js-shell codegen audit does not expose process RSS or JS heap counters.' },
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
    mibPerSec: payload.throughputMiBPerSec,
    eventCount: payload.result.eventCount,
    startElementCount: payload.result.startElementCount,
    endElementCount: payload.result.endElementCount,
    textEventCount: payload.result.textEventCount,
    attributeCount: payload.result.attributeCount,
    checksum: payload.result.checksum,
    codegenMarkers: shell.xmlCodegenProbe?.codegenMarkerCount ?? null,
    options: {
      runs: options.runs,
      warmups: options.warmups,
    },
  };
}

function createFindings(report) {
  return [
    {
      id: 'taskcluster-debug-jsshell-xml-codegen-emitted',
      classification: report.outcome.hasXmlWorkloadCodegenOutput ? 'TRACE_FACT' : 'NEGATIVE_RESULT',
      summary: report.outcome.hasXmlWorkloadCodegenOutput
        ? 'The current Taskcluster debug SpiderMonkey shell emits JitSpew codegen diagnostics while executing the XML byte-tokenizer workload.'
        : 'The current Taskcluster debug SpiderMonkey shell did not emit JitSpew codegen diagnostics for the XML byte-tokenizer workload.',
      evidence: [
        `version=${report.shell.version?.value ?? 'unknown'}`,
        `taskId=${report.shell.provenance?.taskId ?? 'unknown'}`,
        `buildId=${report.shell.provenance?.targetTxt?.buildId ?? report.shell.provenance?.buildhub?.buildId ?? 'unknown'}`,
        `sourceRevision=${report.shell.provenance?.targetTxt?.sourceRevision ?? report.shell.provenance?.buildhub?.sourceRevision ?? 'unknown'}`,
        `status=${report.shell.xmlCodegenProbe?.status ?? 'unknown'}`,
        `codegenMarkers=${report.shell.xmlCodegenProbe?.codegenMarkerCount ?? 'unknown'}`,
        `ionScriptMarkers=${report.shell.xmlCodegenProbe?.ionScriptMarkerCount ?? 'unknown'}`,
        `assemblyMnemonics=${report.shell.xmlCodegenProbe?.assemblyMnemonicCount ?? 'unknown'}`,
        `eventCount=${report.row?.eventCount ?? 'unknown'}`,
        `checksum=${report.row?.checksum ?? 'unknown'}`,
      ],
    },
    {
      id: 'taskcluster-debug-jsshell-xml-stax-scope-gap',
      classification: 'SCOPE_GUARD',
      summary: 'The XML workload is parser-core diagnostic evidence only, not a same-contract full-string StAX benchmark row.',
      evidence: [
        'fullStringParity=false',
        'sameContractStaxRow=false',
        'contractScope=xml-token-boundary-no-string-materialization',
        'closesEmittedIrObligation=false',
      ],
    },
    {
      id: 'taskcluster-debug-jsshell-stax-api-gap',
      classification: 'NEGATIVE_RESULT',
      summary: 'The current debug js-shell lacks the host APIs needed to run the unchanged StAX full-string benchmark.',
      evidence: [
        `missingGlobals=${(report.shell.apiProbe?.missingGlobals ?? []).join(', ') || 'none'}`,
        `canRunCurrentStaxFullStringBenchmark=${report.outcome.canRunCurrentStaxFullStringBenchmark}`,
        'sameContractStaxRow=false',
      ],
    },
  ];
}

function createSelfTestReport(options) {
  return createReport(options, {
    status: 'available',
    provenance: {
      taskId: options.taskId,
      route: options.route,
      artifactName: options.artifactName,
      artifactUrl: options.artifactUrl,
      artifactBytes: 24836220,
      targetTxt: {
        raw: '20260531212007\nhttps://hg.mozilla.org/mozilla-central/rev/71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7',
        buildId: '20260531212007',
        sourceUrl: 'https://hg.mozilla.org/mozilla-central/rev/71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7',
        sourceRevision: '71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7',
      },
      buildhub: {
        buildId: '20260531212007',
        buildDate: '2026-05-31T21:20:07Z',
        sourceRepository: 'https://hg.mozilla.org/mozilla-central',
        sourceRevision: '71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7',
        targetVersion: '153.0a1',
        targetPlatform: 'win64',
        targetOs: 'win',
      },
      mozinfo: {
        buildtype: 'debug',
        buildtypeGuess: 'debug',
        debug: true,
        nightlyBuild: true,
        official: true,
        opt: false,
        testsEnabled: true,
        platformGuess: 'win64',
      },
    },
    version: {
      exitCode: 0,
      error: null,
      value: 'JavaScript-C153.0a1',
    },
    xmlCodegenProbe: {
      status: 'xml-workload-codegen-output-emitted',
      flags: 'codegen',
      exitCode: 0,
      error: null,
      outputBytes: 789123,
      stdoutLineCount: 5000,
      stderrLineCount: 0,
      codegenMarkerCount: 1800,
      ionScriptMarkerCount: 4,
      assemblyMnemonicCount: 1200,
      payload: {
        seedBytes: 4551,
        targetBytes: Math.round(options.targetMiB * MIB),
        samplesMs: [12.5],
        avgMs: 12.5,
        throughputMiBPerSec: options.targetMiB / 0.0125,
        result: {
          eventCount: 1000,
          startElementCount: 300,
          endElementCount: 300,
          textEventCount: 400,
          attributeCount: 200,
          checksum: -123456,
        },
      },
      excerpt: [
        'found tag: codegen',
        '[Codegen] # XML workload codegen sample',
        '[Codegen] movq       %rsp, %rax',
        'xmlPayload={"seedBytes":4551}',
      ],
    },
    apiProbe: {
      status: 'completed',
      exitCode: 0,
      error: null,
      globals: {
        TextDecoder: 'undefined',
        TextEncoder: 'undefined',
        ReadableStream: 'undefined',
        fetch: 'undefined',
        Uint8Array: 'function',
        read: 'function',
      },
      missingGlobals: ['TextDecoder', 'TextEncoder', 'ReadableStream', 'fetch'],
      canRunCurrentStaxFullStringBenchmark: false,
      excerpt: ['apiProbe={"TextDecoder":"undefined","TextEncoder":"undefined","ReadableStream":"undefined","fetch":"undefined","Uint8Array":"function","read":"function"}'],
    },
  });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeout ?? 30_000,
    env: options.env ?? process.env,
    maxBuffer: options.maxBuffer ?? 1024 * 1024,
  });
  return {
    command,
    args,
    exitCode: result.status,
    error: result.error?.message ?? null,
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
  };
}

function readProvenance(options) {
  const targetTxt = readTargetTxt(options.targetTxt);
  const buildhub = readJson(options.buildhubJson);
  const mozinfo = readJson(options.mozinfoJson);
  return {
    taskId: options.taskId,
    route: options.route,
    artifactName: options.artifactName,
    artifactUrl: options.artifactUrl,
    artifactBytes: options.zipPath && existsSync(options.zipPath) ? statSync(options.zipPath).size : null,
    targetTxt,
    buildhub: buildhub ? {
      buildId: buildhub.build?.id ?? null,
      buildDate: buildhub.build?.date ?? null,
      sourceRepository: buildhub.source?.repository ?? null,
      sourceRevision: buildhub.source?.revision ?? null,
      targetVersion: buildhub.target?.version ?? null,
      targetPlatform: buildhub.target?.platform ?? null,
      targetOs: buildhub.target?.os ?? null,
    } : null,
    mozinfo: mozinfo ? {
      buildtype: mozinfo.buildtype ?? null,
      buildtypeGuess: mozinfo.buildtype_guess ?? null,
      debug: mozinfo.debug ?? null,
      nightlyBuild: mozinfo.nightly_build ?? null,
      official: mozinfo.official ?? null,
      opt: mozinfo.opt ?? null,
      testsEnabled: mozinfo.tests_enabled ?? null,
      platformGuess: mozinfo.platform_guess ?? null,
    } : null,
  };
}

function readTargetTxt(filePath) {
  if (!filePath || !existsSync(filePath)) return null;
  const raw = readFileSync(filePath, 'utf8').trim();
  const lines = raw.split(/\r?\n/);
  return {
    raw,
    buildId: lines[0] ?? null,
    sourceUrl: lines[1] ?? null,
    sourceRevision: firstMatch(lines[1] ?? '', /\/rev\/([0-9a-f]+)/)?.[1] ?? null,
  };
}

function readJson(filePath) {
  if (!filePath || !existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function summarizeVersion(result) {
  const combined = `${result.stdout}\n${result.stderr}`.trim();
  return {
    exitCode: result.exitCode,
    error: result.error,
    value: combined || null,
  };
}

function parsePayload(text) {
  const raw = firstMatch(text, /xmlPayload=(\{.+\})/)?.[1] ?? null;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const { mibPerSec, ...rest } = payload;
  return {
    ...rest,
    throughputMiBPerSec: typeof mibPerSec === 'number' ? mibPerSec : payload.throughputMiBPerSec ?? null,
  };
}

function renderMarkdown(report) {
  const provenance = report.shell.provenance ?? {};
  const lines = [
    '# SpiderMonkey Taskcluster Debug JS Shell XML Codegen Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Status: ${report.outcome.status}`,
    `- Version: ${report.shell.version?.value ?? 'not-recorded'}`,
    `- Task ID: ${provenance.taskId ?? 'not-recorded'}`,
    `- Route: ${provenance.route ?? 'not-recorded'}`,
    `- Artifact: ${provenance.artifactName ?? 'not-recorded'}`,
    `- Artifact bytes: ${provenance.artifactBytes ?? 'not-recorded'}`,
    `- Build ID: ${provenance.targetTxt?.buildId ?? provenance.buildhub?.buildId ?? 'not-recorded'}`,
    `- Source revision: ${provenance.targetTxt?.sourceRevision ?? provenance.buildhub?.sourceRevision ?? 'not-recorded'}`,
    `- Target version: ${provenance.buildhub?.targetVersion ?? 'not-recorded'}`,
    `- Debug build: ${provenance.mozinfo?.debug ?? 'not-recorded'}`,
    `- XML workload codegen output emitted: ${report.outcome.hasXmlWorkloadCodegenOutput}`,
    `- Same-contract StAX row: ${report.outcome.sameContractStaxRow}`,
    `- Full-string parity: ${report.outcome.fullStringParity}`,
    `- Can run current StAX full-string benchmark: ${report.outcome.canRunCurrentStaxFullStringBenchmark}`,
    `- Closes diagnostic surface obligation: ${report.outcome.closesDiagnosticSurfaceObligation}`,
    `- Closes emitted IR obligation: ${report.outcome.closesEmittedIrObligation}`,
    '',
    '## XML Codegen Probe',
    '',
    `- Status: ${report.shell.xmlCodegenProbe?.status ?? 'not-run'}`,
    `- Flags: ${report.shell.xmlCodegenProbe?.flags ?? 'not-recorded'}`,
    `- Exit code: ${report.shell.xmlCodegenProbe?.exitCode ?? 'not-run'}`,
    `- Output bytes: ${report.shell.xmlCodegenProbe?.outputBytes ?? 'not-recorded'}`,
    `- Stdout lines: ${report.shell.xmlCodegenProbe?.stdoutLineCount ?? 'not-recorded'}`,
    `- Stderr lines: ${report.shell.xmlCodegenProbe?.stderrLineCount ?? 'not-recorded'}`,
    `- Codegen marker count: ${report.shell.xmlCodegenProbe?.codegenMarkerCount ?? 'not-recorded'}`,
    `- IonScript marker count: ${report.shell.xmlCodegenProbe?.ionScriptMarkerCount ?? 'not-recorded'}`,
    `- Assembly mnemonic count: ${report.shell.xmlCodegenProbe?.assemblyMnemonicCount ?? 'not-recorded'}`,
    `- Target MiB: ${report.parameters.targetMiB}`,
    `- Event count: ${report.row?.eventCount ?? 'not-recorded'}`,
    `- Checksum: ${report.row?.checksum ?? 'not-recorded'}`,
    '',
    '## Host API Probe',
    '',
    `- Status: ${report.shell.apiProbe?.status ?? 'not-run'}`,
    `- Missing globals: ${(report.shell.apiProbe?.missingGlobals ?? []).join(', ') || 'none'}`,
    `- Can run current StAX full-string benchmark: ${report.shell.apiProbe?.canRunCurrentStaxFullStringBenchmark ?? false}`,
    '',
    '## Excerpt',
    '',
    '```text',
    ...(report.shell.xmlCodegenProbe?.excerpt ?? []),
    '```',
    '',
    '## Findings',
    '',
  ];
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence ?? []) {
      lines.push(`  - ${evidence}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function selectExcerptLines(text, limit) {
  const lines = String(text ?? '').split(/\r?\n/);
  const selected = [];
  for (const line of lines) {
    if (selected.length >= limit) break;
    if (/xmlPayload=|apiProbe=|found tag:/.test(line)) selected.push(line);
    if (/\[Codegen\]|Created IonScript|\b(?:movq|addq|subq|call|ret)\b/.test(line)) selected.push(line);
  }
  return selected.slice(0, limit);
}

function firstMatch(text, pattern) {
  return String(text ?? '').match(pattern) ?? null;
}

function countMatches(text, pattern) {
  return Array.from(String(text ?? '').matchAll(pattern)).length;
}

function lineCount(text) {
  const value = String(text ?? '');
  if (value.length === 0) return 0;
  return value.split(/\r?\n/).filter(line => line.length > 0).length;
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

function parseNonNegativeInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${flag} must be a non-negative integer.`);
  return parsed;
}

function writeOutput(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
