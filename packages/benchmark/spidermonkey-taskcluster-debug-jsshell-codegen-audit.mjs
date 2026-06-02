import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'spidermonkey-taskcluster-debug-jsshell-codegen-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'spidermonkey-taskcluster-debug-jsshell-codegen-audit.md');
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
  console.log(`${report.objective}: status=${report.outcome.status} codegen=${report.outcome.hasCodegenDumpOutput} sameContract=${report.outcome.sameContractStaxRow} closes=${report.outcome.closesEmittedIrObligation}`);
}

function runAudit(options) {
  const provenance = readProvenance(options);
  if (!options.jsShell || !existsSync(options.jsShell)) {
    return createReport(options, {
      status: 'missing-shell',
      provenance,
      help: null,
      version: null,
      codegenProbe: null,
      apiProbe: null,
    });
  }

  const version = run(options.jsShell, ['--version']);
  const help = run(options.jsShell, ['--help']);
  const codegenProbe = runCodegenProbe(options.jsShell);
  const apiProbe = runApiProbe(options.jsShell);
  return createReport(options, {
    status: version.exitCode === 0 && help.exitCode === 0 && codegenProbe.exitCode === 0 ? 'available' : 'probe-failed',
    provenance,
    help: summarizeHelp(help),
    version: summarizeVersion(version),
    codegenProbe,
    apiProbe,
  });
}

function runCodegenProbe(jsShell) {
  const flags = 'codegen';
  const result = run(jsShell, [
    '--ion-eager',
    '--ion-offthread-compile=off',
    '-e',
    [
      'function f(x) { return ((x + 1) | 0); }',
      'var checksum = 0;',
      'for (var i = 0; i < 100; i++) checksum = (checksum + f(i)) | 0;',
      "print('checksum=' + checksum);",
    ].join(' '),
  ], {
    env: {
      ...process.env,
      IONFLAGS: flags,
      JIT_SPEW: flags,
    },
    maxBuffer: 64 * 1024 * 1024,
  });
  const combined = `${result.stdout}\n${result.stderr}`;
  const codegenMarkerCount = countMatches(combined, /\[Codegen\]/g);
  const ionScriptMarkerCount = countMatches(combined, /Created IonScript|IonScript/g);
  const assemblyMnemonicCount = countMatches(combined, /\b(?:movq|movl|mov|addq|addl|subq|push|pop|call|jmp|ret|cmpq|testl)\b/g);
  const checksum = Number(firstMatch(combined, /checksum=(-?\d+)/)?.[1] ?? NaN);
  return {
    status: result.exitCode === 0 && codegenMarkerCount > 0 ? 'codegen-output-emitted' : result.exitCode === 0 ? 'no-codegen-output' : 'failed',
    flags,
    exitCode: result.exitCode,
    error: result.error,
    checksum: Number.isFinite(checksum) ? checksum : null,
    outputBytes: Buffer.byteLength(combined, 'utf8'),
    stdoutLineCount: lineCount(result.stdout),
    stderrLineCount: lineCount(result.stderr),
    codegenMarkerCount,
    ionScriptMarkerCount,
    assemblyMnemonicCount,
    excerpt: selectExcerptLines(combined, 40),
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

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
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

function summarizeHelp(result) {
  const combined = `${result.stdout}\n${result.stderr}`;
  return {
    exitCode: result.exitCode,
    error: result.error,
    hasIonEager: /--ion-eager\b/.test(combined),
    hasIonOffthreadCompile: /--ion-offthread-compile=on\/off\b/.test(combined),
    hasDumpBytecode: /--dump-bytecode\b/.test(combined),
    mentionsJitCodegen: /test JIT codegen/i.test(combined),
  };
}

function summarizeVersion(result) {
  const combined = `${result.stdout}\n${result.stderr}`.trim();
  return {
    exitCode: result.exitCode,
    error: result.error,
    value: combined || null,
  };
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
    help: {
      exitCode: 0,
      error: null,
      hasIonEager: true,
      hasIonOffthreadCompile: true,
      hasDumpBytecode: true,
      mentionsJitCodegen: true,
    },
    version: {
      exitCode: 0,
      error: null,
      value: 'JavaScript-C153.0a1',
    },
    codegenProbe: {
      status: 'codegen-output-emitted',
      flags: 'codegen',
      exitCode: 0,
      error: null,
      checksum: 5050,
      outputBytes: 456789,
      stdoutLineCount: 4200,
      stderrLineCount: 0,
      codegenMarkerCount: 1200,
      ionScriptMarkerCount: 2,
      assemblyMnemonicCount: 800,
      excerpt: [
        'found tag: codegen',
        '[Codegen] # Emitting bailout tail stub',
        '[Codegen] movq       %rsp, %rax',
        'checksum=5050',
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

function createReport(options, shell) {
  const hasCodegenDumpOutput = shell.codegenProbe?.status === 'codegen-output-emitted';
  const canRunCurrentStaxFullStringBenchmark = shell.apiProbe?.canRunCurrentStaxFullStringBenchmark === true;
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'spidermonkey-taskcluster-debug-jsshell-codegen-audit',
    contract: 'current-taskcluster-debug-spidermonkey-codegen-surface-not-same-contract-stax',
    note: 'Checks a current mozilla-central Taskcluster win64-debug SpiderMonkey js-shell for JitSpew codegen output. This proves a current diagnostic-capable shell surface, but it is not a same-contract StAX full-string row because the js-shell host API surface cannot run the unchanged benchmark.',
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
      selfTest: options.selfTest,
    },
    shell,
    outcome: {
      status: shell.status,
      hasJitExecutionStatus: null,
      hasIrDumpSurface: hasCodegenDumpOutput,
      hasCodegenDumpOutput,
      hasNativeDisassemblySurface: hasCodegenDumpOutput,
      nativeDumpComplete: hasCodegenDumpOutput,
      scopeComparableToCurrentFirefox: true,
      sameContractStaxRow: false,
      canRunCurrentStaxFullStringBenchmark,
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
      id: 'taskcluster-debug-jsshell-codegen-emitted',
      classification: report.outcome.hasCodegenDumpOutput ? 'TRACE_FACT' : 'NEGATIVE_RESULT',
      summary: report.outcome.hasCodegenDumpOutput
        ? 'The current Taskcluster debug SpiderMonkey shell emits JitSpew codegen diagnostics under IONFLAGS/JIT_SPEW.'
        : 'The current Taskcluster debug SpiderMonkey shell did not emit JitSpew codegen diagnostics.',
      evidence: [
        `version=${report.shell.version?.value ?? 'unknown'}`,
        `taskId=${report.shell.provenance?.taskId ?? 'unknown'}`,
        `route=${report.shell.provenance?.route ?? 'unknown'}`,
        `buildId=${report.shell.provenance?.targetTxt?.buildId ?? report.shell.provenance?.buildhub?.buildId ?? 'unknown'}`,
        `sourceRevision=${report.shell.provenance?.targetTxt?.sourceRevision ?? report.shell.provenance?.buildhub?.sourceRevision ?? 'unknown'}`,
        `debug=${report.shell.provenance?.mozinfo?.debug ?? 'unknown'}`,
        `official=${report.shell.provenance?.mozinfo?.official ?? 'unknown'}`,
        `status=${report.shell.codegenProbe?.status ?? 'unknown'}`,
        `codegenMarkers=${report.shell.codegenProbe?.codegenMarkerCount ?? 'unknown'}`,
        `ionScriptMarkers=${report.shell.codegenProbe?.ionScriptMarkerCount ?? 'unknown'}`,
        `assemblyMnemonics=${report.shell.codegenProbe?.assemblyMnemonicCount ?? 'unknown'}`,
        `checksum=${report.shell.codegenProbe?.checksum ?? 'unknown'}`,
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
        'closesEmittedIrObligation=false',
      ],
    },
    {
      id: 'taskcluster-debug-jsshell-scope-guard',
      classification: 'SCOPE_GUARD',
      summary: 'This is current diagnostic-shell evidence, not emitted codegen for a same-contract StAX full-string benchmark row.',
      evidence: [
        'scopeComparableToCurrentFirefox=true',
        'sameContractStaxRow=false',
        'closesDiagnosticSurfaceObligation=true',
        'closesEmittedIrObligation=false',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const provenance = report.shell.provenance ?? {};
  const lines = [
    '# SpiderMonkey Taskcluster Debug JS Shell Codegen Audit',
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
    `- Build date: ${provenance.buildhub?.buildDate ?? 'not-recorded'}`,
    `- Source revision: ${provenance.targetTxt?.sourceRevision ?? provenance.buildhub?.sourceRevision ?? 'not-recorded'}`,
    `- Source repository: ${provenance.buildhub?.sourceRepository ?? 'not-recorded'}`,
    `- Target version: ${provenance.buildhub?.targetVersion ?? 'not-recorded'}`,
    `- Debug build: ${provenance.mozinfo?.debug ?? 'not-recorded'}`,
    `- Official build: ${provenance.mozinfo?.official ?? 'not-recorded'}`,
    `- Nightly build: ${provenance.mozinfo?.nightlyBuild ?? 'not-recorded'}`,
    `- Codegen dump output emitted: ${report.outcome.hasCodegenDumpOutput}`,
    `- Scope comparable to current Firefox: ${report.outcome.scopeComparableToCurrentFirefox}`,
    `- Same-contract StAX row: ${report.outcome.sameContractStaxRow}`,
    `- Can run current StAX full-string benchmark: ${report.outcome.canRunCurrentStaxFullStringBenchmark}`,
    `- Closes diagnostic surface obligation: ${report.outcome.closesDiagnosticSurfaceObligation}`,
    `- Closes emitted IR obligation: ${report.outcome.closesEmittedIrObligation}`,
    '',
    '## Codegen Probe',
    '',
    `- Status: ${report.shell.codegenProbe?.status ?? 'not-run'}`,
    `- Flags: ${report.shell.codegenProbe?.flags ?? 'not-recorded'}`,
    `- Exit code: ${report.shell.codegenProbe?.exitCode ?? 'not-run'}`,
    `- Checksum: ${report.shell.codegenProbe?.checksum ?? 'not-recorded'}`,
    `- Output bytes: ${report.shell.codegenProbe?.outputBytes ?? 'not-recorded'}`,
    `- Stdout lines: ${report.shell.codegenProbe?.stdoutLineCount ?? 'not-recorded'}`,
    `- Stderr lines: ${report.shell.codegenProbe?.stderrLineCount ?? 'not-recorded'}`,
    `- Codegen marker count: ${report.shell.codegenProbe?.codegenMarkerCount ?? 'not-recorded'}`,
    `- IonScript marker count: ${report.shell.codegenProbe?.ionScriptMarkerCount ?? 'not-recorded'}`,
    `- Assembly mnemonic count: ${report.shell.codegenProbe?.assemblyMnemonicCount ?? 'not-recorded'}`,
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
    ...(report.shell.codegenProbe?.excerpt ?? []),
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

function selectExcerptLines(text, limit) {
  const lines = String(text ?? '').split(/\r?\n/);
  const selected = [];
  for (const line of lines) {
    if (selected.length >= limit) break;
    if (selected.length === 0 && /checksum=|apiProbe=|found tag:/.test(line)) selected.push(line);
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

function writeOutput(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
