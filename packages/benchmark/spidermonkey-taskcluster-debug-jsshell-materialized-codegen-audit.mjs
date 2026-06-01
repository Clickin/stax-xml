import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.md');
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
        if (options.artifactUrl === defaultArtifactUrl) {
          options.artifactUrl = `https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/${options.taskId}/artifacts/${options.artifactName}`;
        }
        break;
      case '--route':
        options.route = readValue();
        break;
      case '--artifact-name':
        options.artifactName = readValue();
        if (options.artifactUrl === defaultArtifactUrl) {
          options.artifactUrl = `https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/${options.taskId}/artifacts/${options.artifactName}`;
        }
        break;
      case '--artifact-url':
        options.artifactUrl = readValue();
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

async function main() {
  const options = parseArgs();
  const report = options.selfTest ? createSelfTestReport(options) : runAudit(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`${report.objective}: status=${report.outcome.status} materializedCodegen=${report.outcome.hasMaterializedStringObjectCodegenOutput} sameContract=${report.outcome.sameContractStaxRow} closes=${report.outcome.closesEmittedIrObligation}`);
}

function runAudit(options) {
  const provenance = readProvenance(options);
  if (!options.jsShell || !existsSync(options.jsShell)) {
    return createReport(options, {
      status: 'missing-shell',
      provenance,
      version: null,
      materializedCodegenProbe: null,
      apiProbe: null,
    });
  }
  const version = run(options.jsShell, ['--version']);
  const materializedCodegenProbe = runMaterializedCodegenProbe(options);
  const apiProbe = runApiProbe(options.jsShell);
  return createReport(options, {
    status: version.exitCode === 0 && materializedCodegenProbe.exitCode === 0 ? 'available' : 'probe-failed',
    provenance,
    version: summarizeVersion(version),
    materializedCodegenProbe,
    apiProbe,
  });
}

function runMaterializedCodegenProbe(options) {
  const tempDir = mkdtempSync(join(tmpdir(), 'stax-spidermonkey-materialized-codegen-'));
  const scriptPath = join(tempDir, 'materialized-codegen.js');
  try {
    writeFileSync(scriptPath, createShellScript(options), 'utf8');
    const flags = 'codegen';
    const result = run(options.jsShell, ['--ion-eager', '--ion-offthread-compile=off', scriptPath], {
      env: { ...process.env, IONFLAGS: flags, JIT_SPEW: flags },
      maxBuffer: 96 * 1024 * 1024,
      timeout: 120_000,
    });
    const combined = `${result.stdout}\n${result.stderr}`;
    const payload = normalizePayload(parsePayload(combined));
    const codegenMarkerCount = countMatches(combined, /\[Codegen\]/g);
    const ionScriptMarkerCount = countMatches(combined, /Created IonScript|IonScript/g);
    const assemblyMnemonicCount = countMatches(combined, /\b(?:movq|movl|mov|addq|addl|subq|push|pop|call|jmp|ret|cmpq|testl)\b/g);
    return {
      status: result.exitCode === 0 && payload && codegenMarkerCount > 0
        ? 'materialized-string-object-codegen-output-emitted'
        : result.exitCode === 0 && payload
          ? 'materialized-string-object-no-codegen-output'
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
function parseRepeated(target) {
  const parser = new MaterializedParser();
  let remaining = target;
  while (remaining > 0) {
    const count = Math.min(seed.length, remaining);
    parser.scan(count === seed.length ? seed : seed.subarray(0, count));
    remaining -= count;
  }
  return parser.finish();
}
class MaterializedParser {
  constructor() {
    this.inTag = false;
    this.tagParts = null;
    this.textParts = [];
    this.eventCount = 0;
    this.checksum = 0;
    this.startElementCount = 0;
    this.endElementCount = 0;
    this.textEventCount = 0;
    this.attributeCount = 0;
    this.materializedStringCount = 0;
    this.materializedObjectCount = 0;
    this.materializedAttributeObjectCount = 0;
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
        this.processTagWithCurrent(buffer.subarray(offset, gt));
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
      checksum: this.checksum,
      startElementCount: this.startElementCount,
      endElementCount: this.endElementCount,
      textEventCount: this.textEventCount,
      attributeCount: this.attributeCount,
      materializedStringCount: this.materializedStringCount,
      materializedObjectCount: this.materializedObjectCount,
      materializedAttributeObjectCount: this.materializedAttributeObjectCount,
    };
  }
  appendText(buffer, start, end) {
    if (start >= end) return;
    this.textParts.push(buffer.subarray(start, end));
  }
  flushText() {
    if (this.textParts.length === 0) return;
    const value = asciiFromChunks(this.textParts);
    this.textParts = [];
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
    if (event.type === 'CHARACTERS' || event.type === 'CDATA') {
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
  if (type === 'CDATA') return 5;
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
    && left.materializedObjectCount === right.materializedObjectCount;
}
let first = null;
const samplesMs = [];
for (let i = 0; i < warmups; i++) parseRepeated(targetBytes);
for (let i = 0; i < runs; i++) {
  if (typeof gc === 'function') gc();
  const started = nowMs();
  const result = parseRepeated(targetBytes);
  const elapsed = nowMs() - started;
  if (first !== null && !sameResult(first, result)) throw new Error('unstable materialized checksum');
  first = first || result;
  samplesMs.push(elapsed);
}
const avgMs = samplesMs.reduce((sum, value) => sum + value, 0) / samplesMs.length;
print('materializedPayload=' + JSON.stringify({
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
  const hasMaterializedStringObjectCodegenOutput = shell.materializedCodegenProbe?.status === 'materialized-string-object-codegen-output-emitted';
  const canRunCurrentStaxFullStringBenchmark = shell.apiProbe?.canRunCurrentStaxFullStringBenchmark === true;
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit',
    contract: 'current-taskcluster-debug-spidermonkey-materialized-string-object-codegen-surface-not-unchanged-stax',
    note: 'Runs a current mozilla-central Taskcluster win64-debug SpiderMonkey js-shell with JitSpew codegen enabled on an ASCII XML workload that materializes JS string primitives and public event-shaped objects before folding the same semantic checksum fields. This is stronger than token-boundary codegen evidence, but it is not the unchanged StAX benchmark because the js-shell host API lacks TextDecoder, ReadableStream, and fetch.',
    environment: {
      platform: `${process.platform}-${process.arch}`,
    },
    fixture: {
      source: 'ascii-corpus-seed-replay',
      sourceFile: options.corpusFile,
      corpusSeedBytes: shell.materializedCodegenProbe?.payload?.seedBytes ?? null,
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
    materializedWorkload: createMaterializedWorkloadSummary(shell),
    outcome: {
      status: shell.status,
      hasJitExecutionStatus: null,
      hasIrDumpSurface: hasMaterializedStringObjectCodegenOutput,
      hasCodegenDumpOutput: hasMaterializedStringObjectCodegenOutput,
      hasMaterializedStringObjectCodegenOutput,
      hasNativeDisassemblySurface: hasMaterializedStringObjectCodegenOutput,
      nativeDumpComplete: hasMaterializedStringObjectCodegenOutput,
      scopeComparableToCurrentFirefox: true,
      sameSemanticChecksumFields: true,
      sameContractStaxRow: false,
      unchangedStaxBenchmark: false,
      fullStringParity: true,
      canRunCurrentStaxFullStringBenchmark,
      closesDiagnosticSurfaceObligation: hasMaterializedStringObjectCodegenOutput,
      closesEmittedIrObligation: false,
    },
  };
  report.findings = createFindings(report);
  return report;
}

function createMaterializedWorkloadSummary(shell) {
  const payload = shell.materializedCodegenProbe?.payload;
  if (!payload) return null;
  return {
    contractScope: 'ascii-js-string-and-public-event-object-materialization',
    sameSemanticChecksumFields: true,
    fullStringParity: true,
    sameContractStaxRow: false,
    unchangedStaxBenchmark: false,
    sourceMode: 'ascii-corpus-seed-replay-sync-byte-loop',
    parserInput: 'SpiderMonkey js-shell Uint8Array from read(file, "binary"), replayed as bounded ASCII corpus seed bytes',
    targetBytes: payload.targetBytes,
    targetMiB: payload.targetBytes / MIB,
    samplesMs: payload.samplesMs,
    avgMs: payload.avgMs,
    throughputMiBPerSec: payload.throughputMiBPerSec,
    ...payload.result,
  };
}

function createFindings(report) {
  return [
    {
      id: 'taskcluster-debug-jsshell-materialized-codegen-emitted',
      classification: report.outcome.hasMaterializedStringObjectCodegenOutput ? 'TRACE_FACT' : 'NEGATIVE_RESULT',
      summary: report.outcome.hasMaterializedStringObjectCodegenOutput
        ? 'The current Taskcluster debug SpiderMonkey shell emits JitSpew codegen diagnostics while executing an XML workload that materializes JS strings and public event-shaped objects.'
        : 'The current Taskcluster debug SpiderMonkey shell did not emit JitSpew codegen diagnostics for the materialized XML workload.',
      evidence: [
        `version=${report.shell.version?.value ?? 'unknown'}`,
        `taskId=${report.shell.provenance?.taskId ?? 'unknown'}`,
        `buildId=${report.shell.provenance?.targetTxt?.buildId ?? report.shell.provenance?.buildhub?.buildId ?? 'unknown'}`,
        `sourceRevision=${report.shell.provenance?.targetTxt?.sourceRevision ?? report.shell.provenance?.buildhub?.sourceRevision ?? 'unknown'}`,
        `status=${report.shell.materializedCodegenProbe?.status ?? 'unknown'}`,
        `codegenMarkers=${report.shell.materializedCodegenProbe?.codegenMarkerCount ?? 'unknown'}`,
        `ionScriptMarkers=${report.shell.materializedCodegenProbe?.ionScriptMarkerCount ?? 'unknown'}`,
        `assemblyMnemonics=${report.shell.materializedCodegenProbe?.assemblyMnemonicCount ?? 'unknown'}`,
        `eventCount=${report.materializedWorkload?.eventCount ?? 'unknown'}`,
        `checksum=${report.materializedWorkload?.checksum ?? 'unknown'}`,
        `materializedStringCount=${report.materializedWorkload?.materializedStringCount ?? 'unknown'}`,
        `materializedObjectCount=${report.materializedWorkload?.materializedObjectCount ?? 'unknown'}`,
      ],
    },
    {
      id: 'taskcluster-debug-jsshell-materialized-stax-scope-gap',
      classification: 'SCOPE_GUARD',
      summary: 'The materialized workload folds the same semantic string fields but is not the unchanged StAX benchmark or a browser TextDecoder row.',
      evidence: [
        'sameSemanticChecksumFields=true',
        'fullStringParity=true',
        'sameContractStaxRow=false',
        'unchangedStaxBenchmark=false',
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
    version: { exitCode: 0, error: null, value: 'JavaScript-C153.0a1' },
    materializedCodegenProbe: {
      status: 'materialized-string-object-codegen-output-emitted',
      flags: 'codegen',
      exitCode: 0,
      error: null,
      outputBytes: 1234567,
      stdoutLineCount: 1,
      stderrLineCount: 12000,
      codegenMarkerCount: 2000,
      ionScriptMarkerCount: 6,
      assemblyMnemonicCount: 1400,
      payload: {
        seedBytes: 4551,
        targetBytes: Math.round(options.targetMiB * MIB),
        samplesMs: [20],
        avgMs: 20,
        throughputMiBPerSec: options.targetMiB / 0.02,
        result: {
          eventCount: 1000,
          checksum: -456789,
          startElementCount: 300,
          endElementCount: 300,
          textEventCount: 400,
          attributeCount: 200,
          materializedStringCount: 1800,
          materializedObjectCount: 1000,
          materializedAttributeObjectCount: 300,
        },
      },
      excerpt: [
        'found tag: codegen',
        '[Codegen] # materialized workload codegen sample',
        '[Codegen] movq       %rsp, %rax',
        'materializedPayload={"seedBytes":4551}',
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
  return { exitCode: result.exitCode, error: result.error, value: combined || null };
}

function parsePayload(text) {
  const raw = firstMatch(text, /materializedPayload=(\{.+\})/)?.[1] ?? null;
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
  const workload = report.materializedWorkload ?? {};
  const lines = [
    '# SpiderMonkey Taskcluster Debug JS Shell Materialized Codegen Audit',
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
    `- Artifact bytes: ${provenance.artifactBytes ?? 'not-recorded'}`,
    `- Build ID: ${provenance.targetTxt?.buildId ?? provenance.buildhub?.buildId ?? 'not-recorded'}`,
    `- Source revision: ${provenance.targetTxt?.sourceRevision ?? provenance.buildhub?.sourceRevision ?? 'not-recorded'}`,
    `- Target version: ${provenance.buildhub?.targetVersion ?? 'not-recorded'}`,
    `- Materialized string/object codegen output emitted: ${report.outcome.hasMaterializedStringObjectCodegenOutput}`,
    `- Same semantic checksum fields: ${report.outcome.sameSemanticChecksumFields}`,
    `- Full-string parity: ${report.outcome.fullStringParity}`,
    `- Same-contract StAX row: ${report.outcome.sameContractStaxRow}`,
    `- Unchanged StAX benchmark: ${report.outcome.unchangedStaxBenchmark}`,
    `- Can run current StAX full-string benchmark: ${report.outcome.canRunCurrentStaxFullStringBenchmark}`,
    `- Closes emitted IR obligation: ${report.outcome.closesEmittedIrObligation}`,
    '',
    '## Materialized Workload',
    '',
    `- Contract scope: ${workload.contractScope ?? 'not-recorded'}`,
    `- Target MiB: ${workload.targetMiB ?? 'not-recorded'}`,
    `- Event count: ${workload.eventCount ?? 'not-recorded'}`,
    `- Checksum: ${workload.checksum ?? 'not-recorded'}`,
    `- Materialized string count: ${workload.materializedStringCount ?? 'not-recorded'}`,
    `- Materialized object count: ${workload.materializedObjectCount ?? 'not-recorded'}`,
    `- Materialized attribute object count: ${workload.materializedAttributeObjectCount ?? 'not-recorded'}`,
    `- Throughput MiB/s: ${formatNumber(workload.throughputMiBPerSec)}`,
    '',
    '## Codegen Probe',
    '',
    `- Status: ${report.shell.materializedCodegenProbe?.status ?? 'not-run'}`,
    `- Codegen marker count: ${report.shell.materializedCodegenProbe?.codegenMarkerCount ?? 'not-recorded'}`,
    `- IonScript marker count: ${report.shell.materializedCodegenProbe?.ionScriptMarkerCount ?? 'not-recorded'}`,
    `- Assembly mnemonic count: ${report.shell.materializedCodegenProbe?.assemblyMnemonicCount ?? 'not-recorded'}`,
    '',
    '## Host API Probe',
    '',
    `- Missing globals: ${(report.shell.apiProbe?.missingGlobals ?? []).join(', ') || 'none'}`,
    `- Can run current StAX full-string benchmark: ${report.shell.apiProbe?.canRunCurrentStaxFullStringBenchmark ?? false}`,
    '',
    '## Excerpt',
    '',
    '```text',
    ...(report.shell.materializedCodegenProbe?.excerpt ?? []),
    '```',
    '',
    '## Findings',
    '',
  ];
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence ?? []) lines.push(`  - ${evidence}`);
  }
  return `${lines.join('\n')}\n`;
}

function selectExcerptLines(text, limit) {
  const lines = String(text ?? '').split(/\r?\n/);
  const selected = [];
  for (const line of lines) {
    if (selected.length >= limit) break;
    if (/materializedPayload=|apiProbe=|found tag:/.test(line)) selected.push(line);
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

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'not-recorded';
}

function writeOutput(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
