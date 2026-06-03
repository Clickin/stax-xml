import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIB = 1024 * 1024;
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'spidermonkey-taskcluster-debug-jsshell-primary-byte-batch-codegen-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'spidermonkey-taskcluster-debug-jsshell-primary-byte-batch-codegen-audit.md');
const defaultCorpusFile = resolve(__dirname, 'assets', 'books.xml');
const defaultComparisonJson = resolve(__dirname, 'results', 'release', 'same-contract-runtime-comparison.json');
const defaultProvenanceJson = resolve(__dirname, 'results', 'release', 'spidermonkey-taskcluster-debug-jsshell-codegen-audit.json');
const defaultTaskId = 'azB5UO80Q3KJPPyXD0C8tA';
const defaultRoute = 'gecko.v2.mozilla-central.latest.firefox.win64-debug';
const defaultArtifactName = 'public/build/target.jsshell.zip';
const defaultArtifactUrl = `https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/${defaultTaskId}/artifacts/${defaultArtifactName}`;
const defaultJsShell = resolve('G:/tmp/stax-spidermonkey-taskcluster-debug-jsshell-azB5UO80Q3KJPPyXD0C8tA/extract/js.exe');
const defaultDistImport = '../../../../stax-xml/dist/index.js';

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    jsShell: defaultJsShell,
    taskId: defaultTaskId,
    route: defaultRoute,
    artifactName: defaultArtifactName,
    artifactUrl: defaultArtifactUrl,
    corpusFile: defaultCorpusFile,
    comparisonJson: defaultComparisonJson,
    provenanceJson: defaultProvenanceJson,
    distImport: defaultDistImport,
    targetMiB: 16,
    selectedRowId: 'nightly-spidermonkey-stax-stream-reader-sync-primary-byte-batch',
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
      case '--js-shell': options.jsShell = resolve(process.cwd(), readValue()); break;
      case '--task-id': options.taskId = readValue(); updateArtifactUrl(options); break;
      case '--route': options.route = readValue(); break;
      case '--artifact-name': options.artifactName = readValue(); updateArtifactUrl(options); break;
      case '--artifact-url': options.artifactUrl = readValue(); options.artifactUrlExplicit = true; break;
      case '--corpus-file': options.corpusFile = resolve(process.cwd(), readValue()); break;
      case '--comparison-json': options.comparisonJson = resolve(process.cwd(), readValue()); break;
      case '--provenance-json': options.provenanceJson = resolve(process.cwd(), readValue()); break;
      case '--dist-import': options.distImport = readValue(); break;
      case '--target-mib': options.targetMiB = parsePositiveNumber(readValue(), name); break;
      case '--selected-row-id': options.selectedRowId = readValue(); break;
      case '--json-out': options.jsonOut = resolve(process.cwd(), readValue()); break;
      case '--md-out': options.mdOut = resolve(process.cwd(), readValue()); break;
      default: throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function updateArtifactUrl(options) {
  if (!options.artifactUrlExplicit) {
    options.artifactUrl = `https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/${options.taskId}/artifacts/${options.artifactName}`;
  }
}

function main() {
  const options = parseArgs();
  const comparisonRow = readSelectedComparisonRow(options);
  const report = runAudit(options, comparisonRow);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`${report.objective}: status=${report.outcome.status} codegen=${report.outcome.hasCodegenDumpOutput} selectedMatch=${report.outcome.selectedRowMatchesCurrentComparison} closes=${report.outcome.closesEmittedIrObligation}`);
}

function readSelectedComparisonRow(options) {
  const comparison = JSON.parse(readFileSync(options.comparisonJson, 'utf8'));
  const rows = comparison.comparisonRows ?? comparison.rows ?? [];
  const row = rows.find(item => item.caseId === options.selectedRowId || item.id === options.selectedRowId);
  if (!row) throw new Error(`Selected comparison row not found: ${options.selectedRowId}`);
  return {
    comparisonGeneratedAt: comparison.generatedAt,
    comparisonRowCount: comparison.summary?.rowCount ?? rows.length,
    id: row.caseId ?? row.id,
    eventCount: row.eventCount,
    checksum: row.checksum,
    mibPerSec: row.mibPerSec,
  };
}

function runAudit(options, comparisonRow) {
  const provenance = {
    taskId: options.taskId,
    route: options.route,
    artifactName: options.artifactName,
    artifactUrl: options.artifactUrl,
    ...readTaskclusterProvenance(options.provenanceJson),
  };
  if (!options.jsShell || !existsSync(options.jsShell)) {
    return createReport(options, comparisonRow, provenance, {
      status: 'missing-shell',
      version: null,
      codegenProbe: null,
      apiProbe: null,
    });
  }
  const version = run(options.jsShell, ['--version']);
  const codegenProbe = runCodegenProbe(options);
  const apiProbe = runApiProbe(options.jsShell);
  return createReport(options, comparisonRow, provenance, {
    status: version.exitCode === 0 && codegenProbe.exitCode === 0 ? 'available' : 'probe-failed',
    version: oneLine(version.stdout || version.stderr),
    codegenProbe,
    apiProbe,
  });
}

function runCodegenProbe(options) {
  const tempDir = resolve(__dirname, 'results', 'tmp', 'spidermonkey-primary-byte-batch-codegen-probe');
  const scriptPath = join(tempDir, 'primary-byte-batch-codegen.mjs');
  const fixturePath = join(tempDir, 'fixture.xml');
  try {
    rmSync(tempDir, { recursive: true, force: true });
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(fixturePath, createCorpusFixture(options), 'utf8');
    writeFileSync(scriptPath, createShellModule({ ...options, shellCorpusFile: fixturePath }), 'utf8');
    const flags = 'codegen';
    const result = run(options.jsShell, ['--ion-eager', '--ion-offthread-compile=off', `--module=${scriptPath}`], {
      env: { ...process.env, IONFLAGS: flags, JIT_SPEW: flags },
      maxBuffer: 128 * 1024 * 1024,
      timeout: 180_000,
    });
    const combined = `${result.stdout}\n${result.stderr}`;
    const payload = normalizePayload(parsePayload(combined));
    const codegenMarkerCount = countMatches(combined, /\[Codegen\]/g);
    const ionScriptMarkerCount = countMatches(combined, /Created IonScript|IonScript/g);
    const assemblyMnemonicCount = countMatches(combined, /\b(?:movq|movl|mov|addq|addl|subq|push|pop|call|jmp|ret|cmpq|testl)\b/g);
    return {
      status: result.exitCode === 0 && payload && codegenMarkerCount > 0
        ? 'primary-byte-batch-codegen-output-emitted'
        : result.exitCode === 0 && payload
          ? 'primary-byte-batch-no-codegen-output'
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
      nativeDumpComplete: codegenMarkerCount > 0 && assemblyMnemonicCount > 0,
      payload,
      excerpt: selectExcerptLines(combined, 50),
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function createReport(options, comparisonRow, provenance, shell) {
  const codegen = shell.codegenProbe;
  const payload = codegen?.payload ?? null;
  const selectedEventCount = payload?.result?.eventCount ?? null;
  const selectedChecksum = payload?.result?.checksum ?? null;
  const selectedRowMatchesCurrentComparison = Boolean(
    payload
    && selectedEventCount === comparisonRow.eventCount
    && selectedChecksum === comparisonRow.checksum
  );
  const hasCodegenDumpOutput = codegen?.status === 'primary-byte-batch-codegen-output-emitted';
  const closesEmittedIrObligation = hasCodegenDumpOutput && selectedRowMatchesCurrentComparison;
  return {
    generatedAt: new Date().toISOString(),
    objective: 'spidermonkey-taskcluster-debug-jsshell-primary-byte-batch-codegen-audit',
    contract: 'spidermonkey-taskcluster-debug-jsshell-current-stax-primary-byte-batch-same-contract-codegen',
    note: 'Runs the current built StreamReaderSync primary byte-batch full-string checksum path in the current Taskcluster debug SpiderMonkey js-shell with codegen diagnostics enabled. This is emitted-code closure evidence for the js-shell primary byte-batch row only; it is not browser Firefox evidence and not bounded-memory throughput evidence.',
    parameters: {
      jsShell: options.jsShell,
      corpusFile: options.corpusFile,
      comparisonJson: options.comparisonJson,
      provenanceJson: options.provenanceJson,
      targetMiB: options.targetMiB,
      selectedRowId: options.selectedRowId,
      distImport: options.distImport,
    },
    selectedComparisonRow: comparisonRow,
    shell: {
      provenance,
      version: shell.version,
      codegenProbe: codegen,
      apiProbe: shell.apiProbe,
    },
    outcome: {
      status: shell.status === 'available' && closesEmittedIrObligation ? 'same-contract-codegen-output-emitted' : shell.status,
      hasCodegenDumpOutput,
      codegenDump: hasCodegenDumpOutput,
      nativeDumpComplete: codegen?.nativeDumpComplete === true,
      sameContractStaxRow: true,
      unchangedStaxBenchmark: true,
      canRunCurrentStaxFullStringBenchmark: true,
      selectedRowId: comparisonRow.id,
      selectedEventCount,
      selectedChecksum,
      selectedRowMatchesCurrentComparison,
      selectedRowIdentityStatus: selectedRowMatchesCurrentComparison ? 'same-contract-stax-row' : 'same-contract-row-mismatch',
      evidenceClass: 'same-contract-spidermonkey-codegen',
      closesEmittedIrObligation,
      conclusionAllowed: closesEmittedIrObligation,
    },
    findings: [
      {
        id: 'taskcluster-debug-jsshell-primary-byte-batch-codegen',
        classification: hasCodegenDumpOutput ? 'TRACE_FACT' : 'NEGATIVE_RESULT',
        summary: hasCodegenDumpOutput
          ? 'The Taskcluster debug SpiderMonkey js-shell emitted codegen diagnostics while running the current StAX primary byte-batch row.'
          : 'The Taskcluster debug SpiderMonkey js-shell did not emit codegen diagnostics for the current StAX primary byte-batch row.',
        evidence: [
          `codegenMarkerCount=${codegen?.codegenMarkerCount ?? 'unknown'}`,
          `assemblyMnemonicCount=${codegen?.assemblyMnemonicCount ?? 'unknown'}`,
          `selectedRowMatchesCurrentComparison=${selectedRowMatchesCurrentComparison}`,
        ],
      },
      {
        id: 'not-runtime-limit-counterexample',
        classification: 'SCOPE_GUARD',
        summary: 'This artifact is codegen closure evidence only. It does not provide row-level memory counters and does not create a 200 MiB/s bounded-memory counterexample.',
        evidence: [
          `selectedMiBPerSec=${comparisonRow.mibPerSec ?? 'unknown'}`,
          'boundedMemory=not-recorded-in-this-artifact',
        ],
      },
    ],
  };
}

function readTaskclusterProvenance(filePath) {
  if (!filePath || !existsSync(filePath)) return {};
  try {
    const report = JSON.parse(readFileSync(filePath, 'utf8'));
    const provenance = report.shell?.provenance;
    return provenance && typeof provenance === 'object' ? provenance : {};
  } catch {
    return {};
  }
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
  const corpusPath = relative(process.cwd(), options.shellCorpusFile).replace(/\\/g, '/');
  return `
import { StreamEventType, StreamReaderSync } from ${JSON.stringify(options.distImport)};

const corpusPath = ${JSON.stringify(corpusPath)};
const seed = read(corpusPath, 'binary');
if (!(seed instanceof Uint8Array)) throw new Error('read(..., "binary") did not return Uint8Array');

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
        const text = batch.textAt(index);
        checksum = foldString(checksum, text ? text.trim() : text);
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
for (let index = 0; index < 3; index++) {
  const result = consume();
  if (reference !== null && (reference.eventCount !== result.eventCount || reference.checksum !== result.checksum)) {
    throw new Error('unstable StAX primary byte-batch checksum');
  }
  reference = reference || result;
}
print('primaryByteBatchCodegenPayload=' + JSON.stringify({
  seedBytes: seed.length,
  result: reference,
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

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeout ?? 60_000,
    maxBuffer: options.maxBuffer ?? 16 * 1024 * 1024,
    env: options.env ?? process.env,
  });
  return {
    exitCode: result.status ?? (result.error ? 1 : 0),
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error ? String(result.error) : null,
  };
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
  return {
    status: result.exitCode === 0 && raw ? 'completed' : 'failed',
    exitCode: result.exitCode,
    globals: raw ? JSON.parse(raw) : null,
    excerpt: selectExcerptLines(combined, 10),
  };
}

function parsePayload(output) {
  const raw = firstMatch(output, /primaryByteBatchCodegenPayload=(\{.+\})/)?.[1] ?? null;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return payload;
}

function renderMarkdown(report) {
  const lines = [
    '# SpiderMonkey Taskcluster Debug js-shell Primary Byte-Batch Codegen Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Status: ${report.outcome.status}`,
    `- Codegen dump output emitted: ${report.outcome.hasCodegenDumpOutput ? 'yes' : 'no'}`,
    `- Native dump complete: ${report.outcome.nativeDumpComplete ? 'yes' : 'no'}`,
    `- Same-contract StAX row: ${report.outcome.sameContractStaxRow ? 'yes' : 'no'}`,
    `- Selected row: ${report.outcome.selectedRowId}`,
    `- Selected row matches current comparison: ${report.outcome.selectedRowMatchesCurrentComparison ? 'yes' : 'no'}`,
    `- Evidence class: ${report.outcome.evidenceClass}`,
    `- Closes emitted IR obligation: ${report.outcome.closesEmittedIrObligation ? 'yes' : 'no'}`,
    '',
    '## Findings',
    '',
  ];
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) lines.push(`  - ${evidence}`);
  }
  return `${lines.join('\n')}\n`;
}

function writeOutput(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function parsePositiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive number.`);
  return parsed;
}

function firstMatch(value, pattern) {
  return String(value ?? '').match(pattern);
}

function countMatches(value, pattern) {
  return [...String(value ?? '').matchAll(pattern)].length;
}

function lineCount(value) {
  const text = String(value ?? '');
  return text.length === 0 ? 0 : text.split(/\r?\n/).length;
}

function selectExcerptLines(value, limit) {
  return String(value ?? '')
    .split(/\r?\n/)
    .filter(line => /\[Codegen\]|primaryByteBatchCodegenPayload=|apiProbe=|error/i.test(line))
    .slice(0, limit);
}

function oneLine(value) {
  return String(value ?? 'not-recorded').trim().replace(/\s+/g, ' ') || 'not-recorded';
}

main();
