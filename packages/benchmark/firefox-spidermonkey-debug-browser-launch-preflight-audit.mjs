import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-taskcluster-debug-browser-launch-preflight-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-taskcluster-debug-browser-launch-preflight-audit.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    browserExecutable: process.env.FIREFOX_PATH ?? null,
    timeoutMs: 30_000,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    selfTest: false,
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
      case '--browser-executable':
        options.browserExecutable = resolve(process.cwd(), readValue());
        break;
      case '--timeout-ms':
        options.timeoutMs = parsePositiveInteger(readValue(), name);
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      case '--self-test':
        options.selfTest = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

function main() {
  const options = parseArgs();
  const report = options.selfTest ? createSelfTestReport(options) : runAudit(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function runAudit(options) {
  const attempts = options.browserExecutable && existsSync(options.browserExecutable)
    ? [
        runAttempt({
          id: 'help-baseline',
          browserExecutable: options.browserExecutable,
          args: ['--help'],
          timeoutMs: options.timeoutMs,
          extraEnv: {},
        }),
        runAttempt({
          id: 'help-disable-dll-blocklist',
          browserExecutable: options.browserExecutable,
          args: ['--help'],
          timeoutMs: options.timeoutMs,
          extraEnv: { MOZ_DISABLE_DLL_BLOCKLIST: '1' },
        }),
      ]
    : [];
  return createReport(options, attempts);
}

function runAttempt({ id, browserExecutable, args, timeoutMs, extraEnv }) {
  const result = spawnSync(browserExecutable, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMs,
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
  const stdoutTail = keepTail(String(result.stdout ?? ''));
  const stderrTail = keepTail(String(result.stderr ?? ''));
  return {
    id,
    argv: [browserExecutable, ...args],
    extraEnv,
    status: result.status === 0 ? 'started' : result.error?.code === 'ETIMEDOUT' ? 'timed-out' : 'failed',
    exitCode: result.status,
    signal: result.signal,
    timedOut: Boolean(result.error && result.error.code === 'ETIMEDOUT'),
    error: result.error?.message ?? null,
    stdoutTail,
    stderrTail,
    dllBlocklistFailure: /DLL blocklist was unable to intercept AppInit DLLs/i.test(stderrTail),
    interceptorAssertion: /PatcherDetour\.h|MOZ_ASSERT_UNREACHABLE|Unrecognized opcode sequence/i.test(stderrTail),
    bidiRunnable: false,
  };
}

function createSelfTestReport(options) {
  return createReport(options, [
    {
      id: 'help-baseline',
      argv: ['self-test-firefox.exe', '--help'],
      extraEnv: {},
      status: 'failed',
      exitCode: 1,
      signal: null,
      timedOut: false,
      error: null,
      stdoutTail: '',
      stderrTail: 'DLL blocklist was unable to intercept AppInit DLLs.\nAssertion failure: false (MOZ_ASSERT_UNREACHABLE: Unrecognized opcode sequence), at PatcherDetour.h:1653\n',
      dllBlocklistFailure: true,
      interceptorAssertion: true,
      bidiRunnable: false,
    },
    {
      id: 'help-disable-dll-blocklist',
      argv: ['self-test-firefox.exe', '--help'],
      extraEnv: { MOZ_DISABLE_DLL_BLOCKLIST: '1' },
      status: 'failed',
      exitCode: 1,
      signal: null,
      timedOut: false,
      error: null,
      stdoutTail: '',
      stderrTail: 'DLL blocklist was unable to intercept AppInit DLLs.\nAssertion failure: false (MOZ_ASSERT_UNREACHABLE: Unrecognized opcode sequence), at PatcherDetour.h:1653\n',
      dllBlocklistFailure: true,
      interceptorAssertion: true,
      bidiRunnable: false,
    },
  ]);
}

function createReport(options, attempts) {
  const executablePresent = options.selfTest || Boolean(options.browserExecutable && existsSync(options.browserExecutable));
  const startedAttempts = attempts.filter(attempt => attempt.status === 'started');
  const failedAttempts = attempts.filter(attempt => attempt.status !== 'started');
  const blocklistFailures = attempts.filter(attempt => attempt.dllBlocklistFailure && attempt.interceptorAssertion);
  const disableDllBlocklistAttempt = attempts.find(attempt => attempt.id === 'help-disable-dll-blocklist') ?? null;
  const disableDllBlocklistChangedFailure = disableDllBlocklistAttempt
    ? !(disableDllBlocklistAttempt.dllBlocklistFailure && disableDllBlocklistAttempt.interceptorAssertion)
    : null;
  const status = !executablePresent
    ? 'missing-executable'
    : startedAttempts.length > 0
      ? 'starts'
      : blocklistFailures.length > 0
        ? 'blocked-by-dll-blocklist-interceptor'
        : 'failed';
  return {
    generatedAt: new Date().toISOString(),
    objective: 'firefox-spidermonkey-taskcluster-debug-browser-launch-preflight-audit',
    contract: 'taskcluster-debug-firefox-browser-launch-preflight-not-same-contract-stax',
    note: 'Checks whether the Taskcluster win64-debug Firefox browser can start at all on this Windows host before treating it as a same-contract SpiderMonkey browser codegen path. This is launch preflight evidence, not emitted IR, not benchmark throughput, and not a runtime-limit conclusion.',
    parameters: {
      browserExecutable: options.browserExecutable,
      timeoutMs: options.timeoutMs,
      attemptedEnvOverrides: ['MOZ_DISABLE_DLL_BLOCKLIST=1'],
    },
    environment: {
      runtimeName: 'browser',
      browserName: 'Firefox',
      javascriptEngine: 'SpiderMonkey',
      hostPlatform: `${process.platform}-${process.arch}`,
    },
    attempts,
    outcome: {
      status,
      executablePresent,
      attemptCount: attempts.length,
      startedAttemptCount: startedAttempts.length,
      failedAttemptCount: failedAttempts.length,
      dllBlocklistFailureCount: blocklistFailures.length,
      disableDllBlocklistChangedFailure,
      canStartDebugBrowser: startedAttempts.length > 0,
      canRunCurrentStaxFullStringBenchmark: false,
      sameContractStaxRow: false,
      closesEmittedIrObligation: false,
      emittedDump: false,
      evidenceClass: 'negative-diagnostic-surface',
    },
    findings: createFindings({ executablePresent, attempts, blocklistFailures, disableDllBlocklistChangedFailure }),
  };
}

function createFindings({ executablePresent, attempts, blocklistFailures, disableDllBlocklistChangedFailure }) {
  const findings = [];
  if (!executablePresent) {
    findings.push({
      id: 'taskcluster-debug-firefox-executable-missing',
      classification: 'NEGATIVE_RESULT',
      summary: 'The selected Taskcluster debug Firefox executable is missing on this host.',
      evidence: ['browserExecutable does not exist'],
    });
  } else if (blocklistFailures.length > 0) {
    findings.push({
      id: 'taskcluster-debug-firefox-preflight-blocked',
      classification: 'NEGATIVE_RESULT',
      summary: 'The Taskcluster debug Firefox browser fails during minimal process startup before any BiDi or StAX benchmark work can run.',
      evidence: [
        `attempts=${attempts.length}`,
        `dllBlocklistFailures=${blocklistFailures.length}`,
        `disableDllBlocklistChangedFailure=${disableDllBlocklistChangedFailure}`,
      ],
    });
  }
  findings.push({
    id: 'debug-browser-preflight-scope',
    classification: 'SCOPE_GUARD',
    summary: 'This launch preflight is not SpiderMonkey emitted IR or same-contract StAX closure evidence.',
    evidence: [
      'A failed debug browser startup cannot close codegen-traces-open.',
      'A future debug browser that reaches BiDi must still emit IR or optimized-code metadata for a same-contract full-string StAX row.',
    ],
  });
  return findings;
}

function keepTail(text, maxChars = 4096) {
  if (text.length <= maxChars) return text;
  return text.slice(-maxChars);
}

function renderMarkdown(report) {
  const lines = [
    '# Firefox/SpiderMonkey Taskcluster Debug Browser Launch Preflight Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Outcome',
    '',
    `- Status: ${report.outcome.status}`,
    `- Browser executable: ${report.parameters.browserExecutable ?? 'not-set'}`,
    `- Executable present: ${formatBoolean(report.outcome.executablePresent)}`,
    `- Attempts: ${report.outcome.attemptCount}`,
    `- Started attempts: ${report.outcome.startedAttemptCount}`,
    `- DLL blocklist/interceptor failures: ${report.outcome.dllBlocklistFailureCount}`,
    `- MOZ_DISABLE_DLL_BLOCKLIST changed failure: ${formatBoolean(report.outcome.disableDllBlocklistChangedFailure)}`,
    `- Can start debug browser: ${formatBoolean(report.outcome.canStartDebugBrowser)}`,
    `- Same-contract StAX row: ${formatBoolean(report.outcome.sameContractStaxRow)}`,
    `- Closes emitted IR obligation: ${formatBoolean(report.outcome.closesEmittedIrObligation)}`,
    '',
    '## Attempts',
    '',
    '| Attempt | Status | Exit code | Timed out | DLL blocklist failure | Interceptor assertion | Env override |',
    '| --- | --- | ---: | --- | --- | --- | --- |',
  ];
  for (const attempt of report.attempts) {
    const envOverride = Object.entries(attempt.extraEnv ?? {})
      .map(([key, value]) => `${key}=${value}`)
      .join(', ') || 'none';
    lines.push(`| ${attempt.id} | ${attempt.status} | ${attempt.exitCode ?? 'n/a'} | ${formatBoolean(attempt.timedOut)} | ${formatBoolean(attempt.dllBlocklistFailure)} | ${formatBoolean(attempt.interceptorAssertion)} | ${envOverride} |`);
  }
  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const item of finding.evidence) {
      lines.push(`  - ${item}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function formatBoolean(value) {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return 'unknown';
}

function writeOutput(filePath, text) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, text);
}

function printSummary(report) {
  console.log(`${report.objective}: status=${report.outcome.status} starts=${report.outcome.canStartDebugBrowser} dllBlocklistFailures=${report.outcome.dllBlocklistFailureCount}`);
}

main();
