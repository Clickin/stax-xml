import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'spidermonkey-archival-debug-jsshell-codegen-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'spidermonkey-archival-debug-jsshell-codegen-audit.md');
const defaultPackageUrl = 'https://archive.mozilla.org/pub/firefox/nightly/2015/01/2015-01-03-mozilla-aurora-debug/jsshell-win64-x86_64.zip';
const defaultBuildInfoUrl = 'https://archive.mozilla.org/pub/firefox/nightly/2015/01/2015-01-03-mozilla-aurora-debug/firefox-36.0a2.en-US.debug-win64-x86_64.txt';

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    jsShell: null,
    packageUrl: defaultPackageUrl,
    buildInfoUrl: defaultBuildInfoUrl,
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
      case '--package-url':
        options.packageUrl = readValue();
        break;
      case '--build-info-url':
        options.buildInfoUrl = readValue();
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
  const report = options.selfTest ? createSelfTestReport(options) : await runAudit(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`${report.objective}: status=${report.outcome.status} codegen=${report.outcome.hasCodegenDumpOutput} closes=${report.outcome.closesEmittedIrObligation}`);
}

async function runAudit(options) {
  if (!options.jsShell || !existsSync(options.jsShell)) {
    return createReport(options, {
      status: 'missing-shell',
      buildInfo: await fetchBuildInfo(options.buildInfoUrl),
      help: null,
      codegenProbe: null,
    });
  }
  const buildInfo = await fetchBuildInfo(options.buildInfoUrl);
  const help = run(options.jsShell, ['--help']);
  const codegenProbe = runCodegenProbe(options.jsShell);
  return createReport(options, {
    status: help.exitCode === 0 && codegenProbe.exitCode === 0 ? 'available' : 'probe-failed',
    buildInfo,
    help: summarizeHelp(help),
    codegenProbe,
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
  const ionScriptMarkerCount = countMatches(combined, /Created IonScript/g);
  const assemblyMnemonicCount = countMatches(combined, /\b(?:movq|movl|addq|subq|push|pop|call|jmp|ret|cmpq|testl)\b/g);
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

async function fetchBuildInfo(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { status: 'http-error', url, httpStatus: response.status, raw: null, buildId: null, sourceRevision: null };
    }
    const raw = await response.text();
    const lines = raw.trim().split(/\r?\n/);
    return {
      status: 'ok',
      url,
      httpStatus: response.status,
      raw: raw.trim(),
      buildId: lines[0] ?? null,
      sourceRevision: firstMatch(raw, /https:\/\/hg\.mozilla\.org\/[^\s]+\/rev\/([0-9a-f]+)/)?.[1] ?? null,
      sourceUrl: firstMatch(raw, /(https:\/\/hg\.mozilla\.org\/[^\s]+)/)?.[1] ?? null,
    };
  } catch (error) {
    return { status: 'fetch-failed', url, httpStatus: null, raw: null, buildId: null, sourceRevision: null, error: error.message };
  }
}

function summarizeHelp(result) {
  const combined = `${result.stdout}\n${result.stderr}`;
  return {
    exitCode: result.exitCode,
    error: result.error,
    versionLine: firstMatch(combined, /^Version: .+$/m)?.[0] ?? null,
    hasIonEager: /--ion-eager\b/.test(combined),
    hasIonOffthreadCompile: /--ion-offthread-compile=on\/off\b/.test(combined),
    hasDumpBytecode: /--dump-bytecode\b/.test(combined),
    mentionsJitCodegen: /test JIT codegen/i.test(combined),
  };
}

function createSelfTestReport(options) {
  return createReport(options, {
    status: 'available',
    buildInfo: {
      status: 'ok',
      url: options.buildInfoUrl,
      httpStatus: 200,
      raw: '20150102133716\nhttps://hg.mozilla.org/releases/mozilla-aurora/rev/b6b89746c58b',
      buildId: '20150102133716',
      sourceRevision: 'b6b89746c58b',
      sourceUrl: 'https://hg.mozilla.org/releases/mozilla-aurora/rev/b6b89746c58b',
    },
    help: {
      exitCode: 0,
      error: null,
      versionLine: 'Version: JavaScript-C36.0a2',
      hasIonEager: true,
      hasIonOffthreadCompile: true,
      hasDumpBytecode: true,
      mentionsJitCodegen: true,
    },
    codegenProbe: {
      status: 'codegen-output-emitted',
      flags: 'codegen',
      exitCode: 0,
      error: null,
      checksum: 5050,
      outputBytes: 123456,
      stdoutLineCount: 29616,
      stderrLineCount: 0,
      codegenMarkerCount: 1800,
      ionScriptMarkerCount: 1,
      assemblyMnemonicCount: 900,
      excerpt: [
        'checksum=5050',
        '[Codegen] # Emitting exception tail stub',
        '[Codegen] movq       %rsp, %rax',
        '[Codegen] Created IonScript 0000000000000000 (raw 0000000000000000)',
      ],
    },
  });
}

function createReport(options, shell) {
  const hasCodegenDumpOutput = shell.codegenProbe?.status === 'codegen-output-emitted';
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'spidermonkey-archival-debug-jsshell-codegen-audit',
    contract: 'archival-debug-spidermonkey-codegen-surface-not-current-stax-evidence',
    note: 'Checks an archived Mozilla debug SpiderMonkey js-shell for JitSpew codegen output. This proves the expected diagnostic surface shape, but the shell is Firefox 36 era and is not current Firefox/SpiderMonkey StAX evidence.',
    environment: {
      platform: `${process.platform}-${process.arch}`,
    },
    parameters: {
      jsShell: options.jsShell,
      packageUrl: options.packageUrl,
      buildInfoUrl: options.buildInfoUrl,
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
      scopeComparableToCurrentFirefox: false,
      sameContractStaxRow: false,
      canRunCurrentStaxFullStringBenchmark: false,
      closesEmittedIrObligation: false,
    },
  };
  report.findings = createFindings(report);
  return report;
}

function createFindings(report) {
  return [
    {
      id: 'archival-debug-jsshell-codegen-emitted',
      classification: report.outcome.hasCodegenDumpOutput ? 'TRACE_FACT' : 'NEGATIVE_RESULT',
      summary: report.outcome.hasCodegenDumpOutput
        ? 'The archived debug SpiderMonkey shell emits JitSpew codegen diagnostics under IONFLAGS/JIT_SPEW.'
        : 'The archived debug SpiderMonkey shell did not emit JitSpew codegen diagnostics.',
      evidence: [
        `version=${report.shell.help?.versionLine ?? 'unknown'}`,
        `buildId=${report.shell.buildInfo?.buildId ?? 'unknown'}`,
        `sourceRevision=${report.shell.buildInfo?.sourceRevision ?? 'unknown'}`,
        `status=${report.shell.codegenProbe?.status ?? 'unknown'}`,
        `codegenMarkers=${report.shell.codegenProbe?.codegenMarkerCount ?? 'unknown'}`,
        `ionScriptMarkers=${report.shell.codegenProbe?.ionScriptMarkerCount ?? 'unknown'}`,
        `assemblyMnemonics=${report.shell.codegenProbe?.assemblyMnemonicCount ?? 'unknown'}`,
        `checksum=${report.shell.codegenProbe?.checksum ?? 'unknown'}`,
      ],
    },
    {
      id: 'archival-debug-jsshell-scope-guard',
      classification: 'SCOPE_GUARD',
      summary: 'This is diagnostic-surface evidence for an archived Firefox 36 era shell, not current Firefox 143/SpiderMonkey benchmark evidence.',
      evidence: [
        'scopeComparableToCurrentFirefox=false',
        'sameContractStaxRow=false',
        'closesEmittedIrObligation=false',
        'A current diagnostic-capable Firefox/SpiderMonkey build is still required for the open codegen obligation.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# SpiderMonkey Archival Debug JS Shell Codegen Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Status: ${report.outcome.status}`,
    `- Version: ${report.shell.help?.versionLine ?? 'not-recorded'}`,
    `- Build ID: ${report.shell.buildInfo?.buildId ?? 'not-recorded'}`,
    `- Source revision: ${report.shell.buildInfo?.sourceRevision ?? 'not-recorded'}`,
    `- Package URL: ${report.parameters.packageUrl}`,
    `- Build info URL: ${report.parameters.buildInfoUrl}`,
    `- Codegen dump output emitted: ${report.outcome.hasCodegenDumpOutput}`,
    `- Scope comparable to current Firefox: ${report.outcome.scopeComparableToCurrentFirefox}`,
    `- Same-contract StAX row: ${report.outcome.sameContractStaxRow}`,
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
    if (selected.length === 0 && /checksum=/.test(line)) selected.push(line);
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
