import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'spidermonkey-taskcluster-debug-jsshell-ascii-stax-codegen-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'spidermonkey-taskcluster-debug-jsshell-ascii-stax-codegen-audit.md');
const defaultTaskId = 'bzK0wWZvQoOguMjTIbRJ_g';
const defaultRoute = 'gecko.v2.mozilla-central.latest.firefox.win64-debug';
const defaultArtifactName = 'public/build/target.jsshell.zip';
const defaultArtifactUrl = `https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/${defaultTaskId}/artifacts/${defaultArtifactName}`;
const defaultDistImport = '../../../../stax-xml/dist/index.js';

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
    distImport: defaultDistImport,
    iterations: 200,
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
      case '--dist-import':
        options.distImport = readValue();
        break;
      case '--iterations':
        options.iterations = parsePositiveInteger(readValue(), name);
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
  console.log(`${report.objective}: status=${report.outcome.status} codegen=${report.outcome.hasCodegenDumpOutput} currentStaxAscii=${report.outcome.currentStaxAsciiPrimaryByteBatchRow} closes=${report.outcome.closesEmittedIrObligation}`);
}

function runAudit(options) {
  const provenance = readProvenance(options);
  if (!options.jsShell || !existsSync(options.jsShell)) {
    return createReport(options, {
      status: 'missing-shell',
      provenance,
      version: null,
      staxCodegenProbe: null,
      apiProbe: null,
    });
  }
  const version = run(options.jsShell, ['--version']);
  const staxCodegenProbe = runStaxCodegenProbe(options);
  const apiProbe = runApiProbe(options.jsShell);
  return createReport(options, {
    status: version.exitCode === 0 && staxCodegenProbe.exitCode === 0 ? 'available' : 'probe-failed',
    provenance,
    version: summarizeVersion(version),
    staxCodegenProbe,
    apiProbe,
  });
}

function runStaxCodegenProbe(options) {
  const tempDir = resolve(__dirname, 'results', 'tmp', 'spidermonkey-ascii-stax-codegen-probe');
  const scriptPath = join(tempDir, 'ascii-stax-codegen-probe.mjs');
  try {
    rmSync(tempDir, { recursive: true, force: true });
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(scriptPath, createShellModule(options), 'utf8');
    const flags = 'codegen';
    const result = run(options.jsShell, ['--ion-eager', '--ion-offthread-compile=off', `--module=${scriptPath}`], {
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
        ? 'ascii-stax-codegen-output-emitted'
        : result.exitCode === 0 && payload
          ? 'ascii-stax-no-codegen-output'
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

function createShellModule(options) {
  return `
import { StreamReaderSync } from ${JSON.stringify(options.distImport)};

const bytes = new Uint8Array([
  60, 114, 111, 111, 116, 32, 97, 61, 34, 98, 34, 62,
  116, 101, 120, 116,
  60, 47, 114, 111, 111, 116, 62,
]);
const iterations = ${options.iterations};

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
function runOnce() {
  const reader = new StreamReaderSync([[bytes]]);
  const batch = reader.nextBatch();
  let checksum = 0;
  checksum = mixChecksum(checksum, batch.eventCount);
  checksum = foldString(checksum, batch.nameAt(1));
  checksum = foldString(checksum, batch.attributeNameAt(1, 0));
  checksum = foldString(checksum, batch.attributeValueAt(1, 0));
  checksum = foldString(checksum, batch.textAt(2));
  return {
    eventCount: batch.eventCount,
    checksum,
    name: batch.nameAt(1),
    attrName: batch.attributeNameAt(1, 0),
    attrValue: batch.attributeValueAt(1, 0),
    text: batch.textAt(2),
  };
}

let first = null;
for (let index = 0; index < iterations; index++) {
  const result = runOnce();
  if (first !== null && (first.eventCount !== result.eventCount || first.checksum !== result.checksum)) {
    throw new Error('unstable ASCII StAX checksum');
  }
  first = first || result;
}
print('asciiStaxPayload=' + JSON.stringify({
  iterations,
  byteLength: bytes.length,
  result: first,
  globals: {
    TextDecoder: typeof globalThis.TextDecoder,
    TextEncoder: typeof globalThis.TextEncoder,
    ReadableStream: typeof globalThis.ReadableStream,
    fetch: typeof globalThis.fetch,
    Uint8Array: typeof globalThis.Uint8Array,
  },
}));
`;
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
    canRunAsciiPrimaryByteBatchBenchmark: globals
      ? globals.Uint8Array !== 'undefined'
      : false,
    excerpt: selectExcerptLines(combined, 10),
  };
}

function createReport(options, shell) {
  const hasCodegenDumpOutput = shell.staxCodegenProbe?.status === 'ascii-stax-codegen-output-emitted';
  const payload = shell.staxCodegenProbe?.payload;
  const currentStaxAsciiPrimaryByteBatchRow = payload?.result?.eventCount === 4
    && payload?.result?.name === 'root'
    && payload?.result?.attrName === 'a'
    && payload?.result?.attrValue === 'b'
    && payload?.result?.text === 'text';
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'spidermonkey-taskcluster-debug-jsshell-ascii-stax-codegen-audit',
    contract: 'current-taskcluster-debug-spidermonkey-ascii-primary-stax-codegen-scope-guard',
    note: 'Runs the current built StAX StreamReaderSync primary byte-batch API in a Taskcluster debug SpiderMonkey js-shell on an ASCII fixture and records JitSpew codegen output. This proves a current StAX API ASCII js-shell codegen surface after the TextDecoder lazy boundary, but it is not the broad full-string same-contract benchmark because non-ASCII/general materialization still requires TextDecoder and the selected row is not in same-contract-runtime-comparison.',
    environment: {
      platform: `${process.platform}-${process.arch}`,
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
      distImport: options.distImport,
      iterations: options.iterations,
      selfTest: options.selfTest,
    },
    shell,
    asciiStaxWorkload: {
      sourceMode: 'current-stax-stream-reader-sync-ascii-primary-byte-batch',
      byteLength: payload?.byteLength ?? null,
      iterations: payload?.iterations ?? null,
      eventCount: payload?.result?.eventCount ?? null,
      checksum: payload?.result?.checksum ?? null,
      materializedFields: {
        name: payload?.result?.name ?? null,
        attrName: payload?.result?.attrName ?? null,
        attrValue: payload?.result?.attrValue ?? null,
        text: payload?.result?.text ?? null,
      },
      globals: payload?.globals ?? null,
    },
    outcome: {
      status: shell.status,
      hasJitExecutionStatus: null,
      hasIrDumpSurface: hasCodegenDumpOutput,
      hasCodegenDumpOutput,
      hasAsciiCurrentStaxCodegenOutput: hasCodegenDumpOutput,
      hasNativeDisassemblySurface: hasCodegenDumpOutput,
      nativeDumpComplete: hasCodegenDumpOutput,
      scopeComparableToCurrentFirefox: true,
      currentStaxAsciiPrimaryByteBatchRow,
      sameContractStaxRow: false,
      unchangedStaxBenchmark: false,
      canRunCurrentStaxFullStringBenchmark: false,
      canRunAsciiPrimaryByteBatchBenchmark: shell.apiProbe?.canRunAsciiPrimaryByteBatchBenchmark === true,
      evidenceClass: 'current-debug-ascii-stax-codegen-scope-guard',
      selectedRowIdentityStatus: 'not-claimed-ascii-stax-diagnostic',
      closesDiagnosticSurfaceObligation: hasCodegenDumpOutput,
      closesEmittedIrObligation: false,
    },
  };
  report.findings = createFindings(report);
  return report;
}

function createFindings(report) {
  return [
    {
      id: 'taskcluster-debug-jsshell-ascii-stax-codegen-emitted',
      classification: report.outcome.hasCodegenDumpOutput ? 'TRACE_FACT' : 'NEGATIVE_RESULT',
      summary: report.outcome.hasCodegenDumpOutput
        ? 'The current Taskcluster debug SpiderMonkey shell emits JitSpew codegen while running the built StAX StreamReaderSync ASCII primary byte-batch API.'
        : 'The current Taskcluster debug SpiderMonkey shell did not emit JitSpew codegen for the built StAX ASCII primary byte-batch API.',
      evidence: [
        `version=${report.shell.version?.value ?? 'unknown'}`,
        `taskId=${report.shell.provenance?.taskId ?? 'unknown'}`,
        `buildId=${report.shell.provenance?.targetTxt?.buildId ?? report.shell.provenance?.buildhub?.buildId ?? 'unknown'}`,
        `sourceRevision=${report.shell.provenance?.targetTxt?.sourceRevision ?? report.shell.provenance?.buildhub?.sourceRevision ?? 'unknown'}`,
        `status=${report.shell.staxCodegenProbe?.status ?? 'unknown'}`,
        `codegenMarkers=${report.shell.staxCodegenProbe?.codegenMarkerCount ?? 'unknown'}`,
        `eventCount=${report.asciiStaxWorkload.eventCount ?? 'unknown'}`,
        `checksum=${report.asciiStaxWorkload.checksum ?? 'unknown'}`,
      ],
    },
    {
      id: 'taskcluster-debug-jsshell-ascii-stax-host-api-narrowing',
      classification: 'SCOPE_GUARD',
      summary: 'The ASCII primary byte-batch StAX path can run without TextDecoder/TextEncoder, but this does not prove the general full-string benchmark.',
      evidence: [
        `currentStaxAsciiPrimaryByteBatchRow=${report.outcome.currentStaxAsciiPrimaryByteBatchRow}`,
        `canRunAsciiPrimaryByteBatchBenchmark=${report.outcome.canRunAsciiPrimaryByteBatchBenchmark}`,
        `missingGlobals=${(report.shell.apiProbe?.missingGlobals ?? []).join(', ') || 'none'}`,
        'sameContractStaxRow=false',
        'closesEmittedIrObligation=false',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const provenance = report.shell.provenance ?? {};
  const lines = [
    '# SpiderMonkey Taskcluster Debug JS Shell ASCII StAX Codegen Audit',
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
    `- Build ID: ${provenance.targetTxt?.buildId ?? provenance.buildhub?.buildId ?? 'not-recorded'}`,
    `- Source revision: ${provenance.targetTxt?.sourceRevision ?? provenance.buildhub?.sourceRevision ?? 'not-recorded'}`,
    `- Codegen dump output emitted: ${report.outcome.hasCodegenDumpOutput}`,
    `- Current StAX ASCII primary byte-batch row: ${report.outcome.currentStaxAsciiPrimaryByteBatchRow}`,
    `- Same-contract StAX row: ${report.outcome.sameContractStaxRow}`,
    `- Can run current StAX full-string benchmark: ${report.outcome.canRunCurrentStaxFullStringBenchmark}`,
    `- Can run ASCII primary byte-batch benchmark: ${report.outcome.canRunAsciiPrimaryByteBatchBenchmark}`,
    `- Evidence class: ${report.outcome.evidenceClass}`,
    `- Closes diagnostic surface obligation: ${report.outcome.closesDiagnosticSurfaceObligation}`,
    `- Closes emitted IR obligation: ${report.outcome.closesEmittedIrObligation}`,
    '',
    '## ASCII StAX Probe',
    '',
    `- Status: ${report.shell.staxCodegenProbe?.status ?? 'not-run'}`,
    `- Flags: ${report.shell.staxCodegenProbe?.flags ?? 'not-recorded'}`,
    `- Exit code: ${report.shell.staxCodegenProbe?.exitCode ?? 'not-run'}`,
    `- Output bytes: ${report.shell.staxCodegenProbe?.outputBytes ?? 'not-recorded'}`,
    `- Codegen marker count: ${report.shell.staxCodegenProbe?.codegenMarkerCount ?? 'not-recorded'}`,
    `- IonScript marker count: ${report.shell.staxCodegenProbe?.ionScriptMarkerCount ?? 'not-recorded'}`,
    `- Assembly mnemonic count: ${report.shell.staxCodegenProbe?.assemblyMnemonicCount ?? 'not-recorded'}`,
    `- Event count: ${report.asciiStaxWorkload.eventCount ?? 'not-recorded'}`,
    `- Checksum: ${report.asciiStaxWorkload.checksum ?? 'not-recorded'}`,
    `- Materialized fields: ${JSON.stringify(report.asciiStaxWorkload.materializedFields)}`,
    '',
    '## Host API Probe',
    '',
    `- Missing globals: ${(report.shell.apiProbe?.missingGlobals ?? []).join(', ') || 'none'}`,
    `- Can run ASCII primary byte-batch benchmark: ${report.shell.apiProbe?.canRunAsciiPrimaryByteBatchBenchmark ?? false}`,
    '',
    '## Excerpt',
    '',
    '```text',
    ...(report.shell.staxCodegenProbe?.excerpt ?? []),
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
  lines.push('');
  return `${lines.join('\n')}\n`;
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
        buildId: '20260531212007',
        sourceRevision: '71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7',
      },
      buildhub: {
        buildId: '20260531212007',
        buildDate: '2026-05-31T21:20:07Z',
        sourceRevision: '71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7',
      },
      mozinfo: {
        debug: true,
        official: true,
        opt: false,
      },
    },
    version: {
      exitCode: 0,
      error: null,
      value: 'JavaScript-C153.0a1',
    },
    staxCodegenProbe: {
      status: 'ascii-stax-codegen-output-emitted',
      flags: 'codegen',
      exitCode: 0,
      error: null,
      outputBytes: 456789,
      stdoutLineCount: 4200,
      stderrLineCount: 0,
      codegenMarkerCount: 1200,
      ionScriptMarkerCount: 2,
      assemblyMnemonicCount: 800,
      payload: {
        iterations: options.iterations,
        byteLength: 23,
        result: {
          eventCount: 4,
          checksum: 12345,
          name: 'root',
          attrName: 'a',
          attrValue: 'b',
          text: 'text',
        },
        globals: {
          TextDecoder: 'undefined',
          TextEncoder: 'undefined',
          ReadableStream: 'undefined',
          fetch: 'undefined',
          Uint8Array: 'function',
        },
      },
      excerpt: [
        'found tag: codegen',
        '[Codegen] # Emitting bailout tail stub',
        '[Codegen] movq       %rsp, %rax',
        'asciiStaxPayload={"iterations":200}',
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
      canRunAsciiPrimaryByteBatchBenchmark: true,
      excerpt: ['apiProbe={"TextDecoder":"undefined","TextEncoder":"undefined","Uint8Array":"function"}'],
    },
  });
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
      sourceRevision: buildhub.source?.revision ?? null,
    } : null,
    mozinfo: mozinfo ? {
      debug: mozinfo.debug ?? null,
      official: mozinfo.official ?? null,
      opt: mozinfo.opt ?? null,
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

function parsePayload(text) {
  const raw = firstMatch(text, /asciiStaxPayload=(\{.+\})/)?.[1] ?? null;
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

function summarizeVersion(result) {
  const combined = `${result.stdout}\n${result.stderr}`.trim();
  return {
    exitCode: result.exitCode,
    error: result.error,
    value: combined || null,
  };
}

function selectExcerptLines(text, limit) {
  const lines = String(text ?? '').split(/\r?\n/);
  const selected = [];
  for (const line of lines) {
    if (selected.length >= limit) break;
    if (/asciiStaxPayload=|apiProbe=|found tag:|\[Codegen\]|Created IonScript|\b(?:movq|addq|subq|call|ret)\b/.test(line)) {
      selected.push(line);
    }
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

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
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
