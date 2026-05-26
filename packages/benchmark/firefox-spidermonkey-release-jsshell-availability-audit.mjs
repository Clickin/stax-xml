import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-release-jsshell-availability-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-release-jsshell-availability-audit.md');
const defaultPackageUrl = 'https://archive.mozilla.org/pub/firefox/releases/143.0.1/jsshell/jsshell-win64.zip';
const defaultSumsUrl = 'https://archive.mozilla.org/pub/firefox/releases/143.0.1/SHA512SUMS';
const defaultPackagePathInSums = 'jsshell/jsshell-win64.zip';
const jitProbeSource = [
  'let ionHits = 0;',
  'function f(x) { if (inIon()) ionHits++; return (x + 1) | 0; }',
  'let checksum = 0;',
  'for (let i = 0; i < 5000; i++) checksum = (checksum + f(i)) | 0;',
  "print('ionHits=' + ionHits);",
  "print('checksum=' + checksum);",
  "print('ionEnable=' + getJitCompilerOptions()['ion.enable']);",
  "print('ionWarmup=' + getJitCompilerOptions()['ion.warmup.trigger']);",
].join(' ');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    jsShell: null,
    packageZip: null,
    sha512sums: null,
    packageUrl: defaultPackageUrl,
    sumsUrl: defaultSumsUrl,
    packagePathInSums: defaultPackagePathInSums,
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
      case '--package-zip':
        options.packageZip = resolve(process.cwd(), readValue());
        break;
      case '--sha512sums':
        options.sha512sums = resolve(process.cwd(), readValue());
        break;
      case '--package-url':
        options.packageUrl = readValue();
        break;
      case '--sums-url':
        options.sumsUrl = readValue();
        break;
      case '--package-path-in-sums':
        options.packagePathInSums = readValue();
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

function main() {
  const options = parseArgs();
  const report = options.selfTest ? createSelfTestReport(options) : runAudit(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function runAudit(options) {
  const packageVerification = verifyPackage(options);
  const shell = probeShell(options.jsShell);
  return createReport(options, packageVerification, shell);
}

function verifyPackage(options) {
  if (!options.packageZip || !options.sha512sums) {
    return {
      status: 'not-checked',
      packageZip: options.packageZip,
      sha512sums: options.sha512sums,
      packageSha512: null,
      expectedLine: null,
      hashMatches: null,
    };
  }
  if (!existsSync(options.packageZip) || !existsSync(options.sha512sums)) {
    return {
      status: 'missing-input',
      packageZip: options.packageZip,
      sha512sums: options.sha512sums,
      packageSha512: null,
      expectedLine: null,
      hashMatches: false,
    };
  }
  const packageSha512 = createHash('sha512').update(readFileSync(options.packageZip)).digest('hex');
  const expectedLine = readFileSync(options.sha512sums, 'utf8')
    .split(/\r?\n/)
    .find(line => line.endsWith(`  ${options.packagePathInSums}`)) ?? null;
  return {
    status: expectedLine?.startsWith(`${packageSha512}  `) ? 'verified' : 'mismatch',
    packageZip: options.packageZip,
    sha512sums: options.sha512sums,
    packageSha512,
    expectedLine,
    hashMatches: Boolean(expectedLine?.startsWith(`${packageSha512}  `)),
  };
}

function probeShell(jsShell) {
  if (!jsShell) {
    return {
      status: 'not-configured',
      jsShell: null,
      version: null,
      help: null,
      jitProbe: null,
    };
  }
  if (!existsSync(jsShell)) {
    return {
      status: 'missing',
      jsShell,
      version: null,
      help: null,
      jitProbe: null,
    };
  }
  const version = run(jsShell, ['--version']);
  const help = run(jsShell, ['--help']);
  const jitProbe = run(jsShell, [
    '--ion-eager',
    '--ion-offthread-compile=off',
    '-e',
    jitProbeSource,
  ]);
  return {
    status: version.exitCode === 0 && help.exitCode === 0 && jitProbe.exitCode === 0 ? 'available' : 'probe-failed',
    jsShell,
    version,
    help: summarizeHelp(help.stdout),
    jitProbe: summarizeJitProbe(jitProbe),
  };
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  });
  return {
    command,
    args,
    exitCode: result.status,
    error: result.error?.message ?? null,
    stdout: keepShort(String(result.stdout ?? ''), 20_000),
    stderr: keepShort(String(result.stderr ?? ''), 20_000),
  };
}

function summarizeHelp(text) {
  return {
    versionLine: firstMatch(text, /^Version: .+$/m),
    hasIonEager: /--ion-eager\b/.test(text),
    hasIonOffthreadCompile: /--ion-offthread-compile=on\/off\b/.test(text),
    hasDumpBytecode: /--dump-bytecode\b/.test(text),
    hasJitSpewFlag: /JIT_SPEW|IONFLAGS|--enable-jitspew|--iongraph|--dump-ion|--dump-mir|--dump-lir/i.test(text),
    hasInIonHelp: /\binIon\b/.test(text),
  };
}

function summarizeJitProbe(runResult) {
  const combined = `${runResult.stdout}\n${runResult.stderr}`;
  const ionHits = Number(firstMatch(combined, /ionHits=(\d+)/)?.[1] ?? NaN);
  const checksum = Number(firstMatch(combined, /checksum=(-?\d+)/)?.[1] ?? NaN);
  const ionEnable = Number(firstMatch(combined, /ionEnable=(-?\d+)/)?.[1] ?? NaN);
  const ionWarmup = Number(firstMatch(combined, /ionWarmup=(-?\d+)/)?.[1] ?? NaN);
  return {
    exitCode: runResult.exitCode,
    error: runResult.error,
    ionHits: Number.isFinite(ionHits) ? ionHits : null,
    checksum: Number.isFinite(checksum) ? checksum : null,
    ionEnable: Number.isFinite(ionEnable) ? ionEnable : null,
    ionWarmup: Number.isFinite(ionWarmup) ? ionWarmup : null,
    stdout: keepShort(runResult.stdout, 2000),
    stderr: keepShort(runResult.stderr, 2000),
  };
}

function firstMatch(text, pattern) {
  return text.match(pattern) ?? null;
}

function createSelfTestReport(options) {
  return createReport(
    options,
    {
      status: 'verified',
      packageZip: 'self-test/jsshell-win64.zip',
      sha512sums: 'self-test/SHA512SUMS',
      packageSha512: 'abc123',
      expectedLine: `abc123  ${options.packagePathInSums}`,
      hashMatches: true,
    },
    {
      status: 'available',
      jsShell: 'self-test/js.exe',
      version: { exitCode: 0, stdout: 'JavaScript-C143.0.1\n', stderr: '', error: null },
      help: {
        versionLine: 'Version: JavaScript-C143.0.1',
        hasIonEager: true,
        hasIonOffthreadCompile: true,
        hasDumpBytecode: true,
        hasJitSpewFlag: false,
        hasInIonHelp: false,
      },
      jitProbe: {
        exitCode: 0,
        error: null,
        ionHits: 4988,
        checksum: 12502500,
        ionEnable: 1,
        ionWarmup: 0,
        stdout: 'ionHits=4988\nchecksum=12502500\nionEnable=1\nionWarmup=0\n',
        stderr: '',
      },
    },
  );
}

function createReport(options, packageVerification, shell) {
  const hasJitExecutionStatus = shell.jitProbe?.ionHits > 0 && shell.jitProbe?.ionEnable === 1;
  const hasIrDumpSurface = shell.help?.hasJitSpewFlag === true;
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'firefox-spidermonkey-release-jsshell-availability-audit',
    contract: 'official-firefox-release-jsshell-jit-status-and-diagnostic-surface',
    note: 'Checks an official Firefox release SpiderMonkey JavaScript shell package for local JIT execution status and diagnostic surface. This is not emitted JIT IR, optimized-code, throughput, or browser evidence.',
    environment: {
      platform: `${process.platform}-${process.arch}`,
    },
    parameters: {
      packageUrl: options.packageUrl,
      sumsUrl: options.sumsUrl,
      packagePathInSums: options.packagePathInSums,
      selfTest: options.selfTest,
    },
    packageVerification,
    shell,
    outcome: {
      status: shell.status,
      packageVerified: packageVerification.hashMatches === true,
      hasJitExecutionStatus,
      hasIrDumpSurface,
      closesEmittedIrObligation: false,
    },
  };
  report.findings = createFindings(report);
  return report;
}

function createFindings(report) {
  return [
    {
      id: 'official-release-jsshell-available',
      classification: 'ENVIRONMENT_FACT',
      summary: report.outcome.status === 'available'
        ? 'The official Firefox release SpiderMonkey JavaScript shell is executable locally.'
        : 'The official Firefox release SpiderMonkey JavaScript shell was not executable locally.',
      evidence: [
        `version=${oneLine(report.shell.version?.stdout)}`,
        `packageVerified=${report.outcome.packageVerified}`,
        `packageUrl=${report.parameters.packageUrl}`,
      ],
    },
    {
      id: 'spidermonkey-jit-status-observed',
      classification: report.outcome.hasJitExecutionStatus ? 'TRACE_FACT' : 'NEGATIVE_RESULT',
      summary: report.outcome.hasJitExecutionStatus
        ? 'The release SpiderMonkey shell can observe Ion execution status with inIon() under --ion-eager.'
        : 'The release SpiderMonkey shell did not observe Ion execution status in the probe.',
      evidence: [
        `ionHits=${report.shell.jitProbe?.ionHits ?? 'unknown'}`,
        `checksum=${report.shell.jitProbe?.checksum ?? 'unknown'}`,
        `ionEnable=${report.shell.jitProbe?.ionEnable ?? 'unknown'}`,
        `ionWarmup=${report.shell.jitProbe?.ionWarmup ?? 'unknown'}`,
      ],
    },
    {
      id: 'spidermonkey-release-jsshell-no-ir-dump-surface',
      classification: 'NEGATIVE_RESULT',
      summary: 'The release SpiderMonkey shell help surface exposes Ion controls but no JitSpew/IONFLAGS/IR dump flag surface.',
      evidence: [
        `hasIonEager=${report.shell.help?.hasIonEager ?? 'unknown'}`,
        `hasIonOffthreadCompile=${report.shell.help?.hasIonOffthreadCompile ?? 'unknown'}`,
        `hasDumpBytecode=${report.shell.help?.hasDumpBytecode ?? 'unknown'}`,
        `hasJitSpewFlag=${report.shell.help?.hasJitSpewFlag ?? 'unknown'}`,
        'This narrows the local diagnostic path but does not close the emitted JIT IR obligation.',
      ],
    },
    {
      id: 'release-jsshell-scope',
      classification: 'SCOPE_GUARD',
      summary: 'This audit is shell JIT-status evidence only; it is not browser throughput, allocation, emitted IR, or optimized-code evidence.',
      evidence: [
        'A diagnostic-capable SpiderMonkey shell or Firefox build is still required for emitted MIR/LIR/codegen dump evidence.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Firefox SpiderMonkey Release JS Shell Availability Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Status: ${report.outcome.status}`,
    `- Package verified: ${report.outcome.packageVerified}`,
    `- JIT execution status observed: ${report.outcome.hasJitExecutionStatus}`,
    `- IR dump surface present: ${report.outcome.hasIrDumpSurface}`,
    `- Closes emitted IR obligation: ${report.outcome.closesEmittedIrObligation}`,
    `- Package URL: ${report.parameters.packageUrl}`,
    `- Sums URL: ${report.parameters.sumsUrl}`,
    '',
    '## Package Verification',
    '',
    `- Status: ${report.packageVerification.status}`,
    `- SHA512 match: ${report.packageVerification.hashMatches}`,
    `- SHA512: ${report.packageVerification.packageSha512 ?? 'not-recorded'}`,
    `- Expected line: ${report.packageVerification.expectedLine ?? 'not-recorded'}`,
    '',
    '## Shell Surface',
    '',
    `- JS shell: ${report.shell.jsShell ?? 'not-configured'}`,
    `- Version: ${oneLine(report.shell.version?.stdout)}`,
    `- Help version: ${report.shell.help?.versionLine ?? 'not-recorded'}`,
    `- has --ion-eager: ${report.shell.help?.hasIonEager}`,
    `- has --ion-offthread-compile: ${report.shell.help?.hasIonOffthreadCompile}`,
    `- has --dump-bytecode: ${report.shell.help?.hasDumpBytecode}`,
    `- has JitSpew/IR dump flag surface: ${report.shell.help?.hasJitSpewFlag}`,
    '',
    '## JIT Status Probe',
    '',
    `- Exit code: ${report.shell.jitProbe?.exitCode ?? 'not-run'}`,
    `- Ion hits: ${report.shell.jitProbe?.ionHits ?? 'not-recorded'}`,
    `- Checksum: ${report.shell.jitProbe?.checksum ?? 'not-recorded'}`,
    `- ion.enable: ${report.shell.jitProbe?.ionEnable ?? 'not-recorded'}`,
    `- ion.warmup.trigger: ${report.shell.jitProbe?.ionWarmup ?? 'not-recorded'}`,
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

function writeOutput(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function printSummary(report) {
  console.log(`firefox-spidermonkey-release-jsshell-availability-audit: status=${report.outcome.status} jitStatus=${report.outcome.hasJitExecutionStatus} irDumpSurface=${report.outcome.hasIrDumpSurface}`);
}

function keepShort(value, limit = 4000) {
  return value.length <= limit ? value : `${value.slice(0, limit)}\n...<truncated ${value.length - limit} chars>`;
}

function oneLine(value) {
  return String(value ?? 'not-recorded').trim().replace(/\s+/g, ' ') || 'not-recorded';
}

main();
