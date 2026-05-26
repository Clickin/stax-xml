import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const harnessPath = resolve(__dirname, 'firefox-bidi-candidate-headroom.mjs');
const defaultOutputDir = resolve(__dirname, 'results', 'firefox-spidermonkey-diagnostic-dump-audit');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-diagnostic-dump-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-diagnostic-dump-audit.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizeGiB: 0.0001,
    fixtureShape: 'diverse-cycle',
    diverseCycleSize: 16,
    cases: ['rawFrameNameId'],
    batchSize: 16,
    browserTimeoutMs: 180_000,
    outputDir: defaultOutputDir,
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
      case '--size-gib':
        options.sizeGiB = parsePositiveNumber(readValue(), name);
        break;
      case '--fixture-shape':
        options.fixtureShape = parseChoice(readValue(), ['diverse-cycle', 'corpus-cycle', 'projection-cycle'], name);
        break;
      case '--diverse-cycle-size':
        options.diverseCycleSize = parsePositiveInteger(readValue(), name);
        break;
      case '--cases':
        options.cases = parseList(readValue(), name);
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), name);
        break;
      case '--browser-timeout-ms':
        options.browserTimeoutMs = parsePositiveInteger(readValue(), name);
        break;
      case '--output-dir':
        options.outputDir = resolve(process.cwd(), readValue());
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

function parseChoice(value, choices, flag) {
  if (!choices.includes(value)) throw new Error(`${flag} must be one of ${choices.join(', ')}.`);
  return value;
}

function parseList(value, flag) {
  const parsed = value.split(',').map(entry => entry.trim()).filter(Boolean);
  if (parsed.length === 0) throw new Error(`${flag} must contain at least one value.`);
  return parsed;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

function parsePositiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive number.`);
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
  rmSync(options.outputDir, { recursive: true, force: true });
  mkdirSync(options.outputDir, { recursive: true });
  const childJsonOut = join(options.outputDir, 'firefox-diagnostic-child.json');
  const childMdOut = join(options.outputDir, 'firefox-diagnostic-child.md');
  const ionSpewFile = join(options.outputDir, 'ion-spew.log');
  const diagnosticEnv = {
    IONFLAGS: 'logs,codegen,mir,lir,aborts,scripts',
    ION_SPEW_FILENAME: ionSpewFile,
    JIT_SPEW_DIR: options.outputDir,
    JS_JITSPEW: 'logs,codegen,mir,lir,aborts,scripts',
  };
  const childArgs = [
    harnessPath,
    '--size-gib',
    String(options.sizeGiB),
    '--fixture-shape',
    options.fixtureShape,
    '--diverse-cycle-size',
    String(options.diverseCycleSize),
    '--batch-size',
    String(options.batchSize),
    '--runs',
    '1',
    '--warmups',
    '0',
    '--cases',
    options.cases.join(','),
    '--no-host-process-memory',
    '--graceful-browser-close',
    '--browser-timeout-ms',
    String(options.browserTimeoutMs),
    '--json-out',
    childJsonOut,
    '--md-out',
    childMdOut,
  ];
  const child = spawnSync(process.execPath, childArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ...diagnosticEnv,
    },
    timeout: options.browserTimeoutMs + 30_000,
  });
  const dumpFiles = listFiles(options.outputDir)
    .filter(file => ![childJsonOut, childMdOut].includes(file.path))
    .map(file => ({
      path: file.path,
      relativePath: file.path.slice(options.outputDir.length + 1),
      bytes: file.bytes,
    }));
  const stdoutTail = keepTail(String(child.stdout ?? ''));
  const stderrTail = keepTail(String(child.stderr ?? ''));
  const childReport = existsSync(childJsonOut) ? JSON.parse(readFileSync(childJsonOut, 'utf8')) : null;
  return createReport(options, {
    diagnosticEnv,
    childArgs,
    exitCode: child.status,
    signal: child.signal,
    error: child.error?.message ?? null,
    timedOut: Boolean(child.error && child.error.code === 'ETIMEDOUT'),
    stdoutTail,
    stderrTail,
    dumpFiles,
    childReport,
  });
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else {
        files.push({ path, bytes: statSync(path).size });
      }
    }
  };
  visit(root);
  return files;
}

function createSelfTestReport(options) {
  return createReport(options, {
    diagnosticEnv: {
      IONFLAGS: 'logs,codegen,mir,lir,aborts,scripts',
      ION_SPEW_FILENAME: join(options.outputDir, 'ion-spew.log'),
      JIT_SPEW_DIR: options.outputDir,
      JS_JITSPEW: 'logs,codegen,mir,lir,aborts,scripts',
    },
    childArgs: ['self-test'],
    exitCode: 0,
    signal: null,
    error: null,
    timedOut: false,
    stdoutTail: 'Wrote browser-candidate-headroom: 104857 bytes\n',
    stderrTail: '',
    dumpFiles: [],
    childReport: {
      environment: {
        runtimeName: 'browser',
        javascriptEngine: 'SpiderMonkey',
        browserName: 'Firefox',
        browserVersion: 'self-test',
      },
      variants: [
        {
          id: 'rawFrameNameId',
          mibPerSec: 1,
          eventCount: 1,
          checksum: 1,
          fullStringParity: true,
        },
      ],
      fullStringParity: {
        status: 'ok',
        eventCount: 1,
        checksum: 1,
      },
    },
  });
}

function createReport(options, result) {
  const dumpBytes = result.dumpFiles.reduce((sum, file) => sum + file.bytes, 0);
  const stderrDiagnosticHits = countDiagnosticHits(result.stderrTail);
  const stdoutDiagnosticHits = countDiagnosticHits(result.stdoutTail);
  const emittedDump = result.dumpFiles.length > 0 || stderrDiagnosticHits > 0 || stdoutDiagnosticHits > 0;
  const completed = result.exitCode === 0 && Boolean(result.childReport);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'firefox-spidermonkey-diagnostic-dump-audit',
    contract: 'firefox-browser-spidermonkey-diagnostic-dump-availability',
    note: 'Attempts to collect SpiderMonkey JIT diagnostic dump output from the installed Firefox browser while running the same browser reader harness. This is an availability audit; if no dump is emitted, it is not JIT IR evidence and must not be counted as optimized-code proof.',
    parameters: {
      sizeGiB: options.sizeGiB,
      fixtureShape: options.fixtureShape,
      diverseCycleSize: options.diverseCycleSize,
      batchSize: options.batchSize,
      cases: options.cases,
      browserTimeoutMs: options.browserTimeoutMs,
      outputDir: options.outputDir,
      diagnosticEnv: result.diagnosticEnv,
    },
    outcome: {
      status: completed ? emittedDump ? 'dump-emitted' : 'no-dump-emitted' : 'failed',
      completed,
      emittedDump,
      dumpFileCount: result.dumpFiles.length,
      dumpBytes,
      stderrDiagnosticHits,
      stdoutDiagnosticHits,
      exitCode: result.exitCode,
      signal: result.signal,
      timedOut: result.timedOut,
      error: result.error,
      stdoutTail: result.stdoutTail,
      stderrTail: result.stderrTail,
      dumpFiles: result.dumpFiles,
    },
    environment: result.childReport?.environment ?? null,
    variants: (result.childReport?.variants ?? []).map(row => ({
      id: row.id,
      mibPerSec: row.mibPerSec,
      eventCount: row.eventCount,
      checksum: row.checksum,
      fullStringParity: row.fullStringParity,
    })),
    parity: result.childReport?.fullStringParity ?? null,
    findings: createFindings(completed, emittedDump, result.dumpFiles, dumpBytes, result.childReport),
  };
}

function countDiagnosticHits(text) {
  return (text.match(/ion|baseline|jit|mir|lir|codegen|spew/gi) ?? []).length;
}

function createFindings(completed, emittedDump, dumpFiles, dumpBytes, childReport) {
  const findings = [];
  if (completed) {
    findings.push({
      id: 'same-harness-diagnostic-run-completed',
      classification: 'BENCH_FACT',
      summary: 'The Firefox browser reader harness completed while SpiderMonkey diagnostic dump environment variables were set.',
      evidence: (childReport?.variants ?? []).map(row =>
        `${row.id}: events=${row.eventCount}, checksum=${row.checksum}, throughput=${row.mibPerSec.toFixed(2)} MiB/s`),
    });
  }
  if (emittedDump) {
    findings.push({
      id: 'spidermonkey-diagnostic-dump-emitted',
      classification: 'TRACE_FACT',
      summary: 'The installed Firefox run emitted diagnostic dump output under the requested SpiderMonkey diagnostic environment.',
      evidence: [
        `dumpFileCount=${dumpFiles.length}`,
        `dumpBytes=${dumpBytes}`,
      ],
    });
  } else {
    findings.push({
      id: 'spidermonkey-diagnostic-dump-not-emitted',
      classification: 'NEGATIVE_RESULT',
      summary: 'The installed Firefox run completed but did not emit SpiderMonkey JIT diagnostic dump files or recognizable diagnostic stream output.',
      evidence: [
        'IONFLAGS=logs,codegen,mir,lir,aborts,scripts',
        'ION_SPEW_FILENAME was set inside the audit output directory',
        'JS_JITSPEW=logs,codegen,mir,lir,aborts,scripts',
        'JIT_SPEW_DIR was set to the audit output directory',
        'This is not JIT IR evidence; keep the codegen proof obligation open.',
      ],
    });
  }
  findings.push({
    id: 'diagnostic-dump-audit-scope',
    classification: 'SCOPE_GUARD',
    summary: 'This artifact is an availability audit for diagnostic dump output, not a proof that SpiderMonkey has no optimized-code headroom.',
    evidence: [
      'A no-dump result may mean the installed release build does not expose this diagnostic surface.',
      'A future debug/nightly/js-shell run can still provide SpiderMonkey JIT IR or optimized-code evidence.',
    ],
  });
  return findings;
}

function keepTail(value) {
  return value.length > 16_384 ? value.slice(-16_384) : value;
}

function renderMarkdown(report) {
  const lines = [
    '# Firefox/SpiderMonkey Diagnostic Dump Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Outcome',
    '',
    `- Status: ${report.outcome.status}`,
    `- Completed: ${report.outcome.completed ? 'yes' : 'no'}`,
    `- Emitted dump: ${report.outcome.emittedDump ? 'yes' : 'no'}`,
    `- Dump files: ${report.outcome.dumpFileCount}`,
    `- Dump bytes: ${report.outcome.dumpBytes}`,
    `- stderr diagnostic hits: ${report.outcome.stderrDiagnosticHits}`,
    `- stdout diagnostic hits: ${report.outcome.stdoutDiagnosticHits}`,
    '',
    '## Diagnostic Environment',
    '',
    ...Object.entries(report.parameters.diagnosticEnv).map(([name, value]) => `- ${name}: ${value}`),
    '',
    '## Variants',
    '',
    '| Variant | Throughput | Events | Checksum | Full parity |',
    '| --- | ---: | ---: | ---: | --- |',
    ...report.variants.map(row =>
      `| ${row.id} | ${row.mibPerSec.toFixed(2)} MiB/s | ${row.eventCount} | ${row.checksum} | ${row.fullStringParity ? 'yes' : 'no'} |`),
    '',
    '## Findings',
    '',
    ...report.findings.flatMap(finding => [
      `- ${finding.id} (${finding.classification}): ${finding.summary}`,
      ...finding.evidence.map(entry => `  - ${entry}`),
    ]),
    '',
  ];
  if (report.outcome.dumpFiles.length > 0) {
    lines.push('## Dump Files', '');
    for (const file of report.outcome.dumpFiles) {
      lines.push(`- ${file.relativePath}: ${file.bytes} bytes`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function printSummary(report) {
  console.log(`firefox-spidermonkey-diagnostic-dump-audit: status=${report.outcome.status} dumps=${report.outcome.dumpFileCount}`);
}

function writeOutput(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

main();
