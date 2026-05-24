import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'firefox-fetch-readable-stream-timeout-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'firefox-fetch-readable-stream-timeout-audit.md');
const defaultChildJsonOut = resolve(__dirname, 'results', 'tmp', 'firefox-fetch-readable-stream-timeout-child.json');
const defaultChildMdOut = resolve(__dirname, 'results', 'tmp', 'firefox-fetch-readable-stream-timeout-child.md');
const defaultCorpusFile = resolve(__dirname, 'assets', 'books.xml');
const harnessPath = resolve(__dirname, 'firefox-bidi-candidate-headroom.mjs');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizeGiB: 1,
    corpusFile: defaultCorpusFile,
    childTimeoutMs: 300_000,
    browserTimeoutMs: 1_200_000,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    childJsonOut: defaultChildJsonOut,
    childMdOut: defaultChildMdOut,
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
      case '--corpus-file':
        options.corpusFile = resolve(process.cwd(), readValue());
        break;
      case '--child-timeout-ms':
        options.childTimeoutMs = parsePositiveInteger(readValue(), name);
        break;
      case '--browser-timeout-ms':
        options.browserTimeoutMs = parsePositiveInteger(readValue(), name);
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      case '--child-json-out':
        options.childJsonOut = resolve(process.cwd(), readValue());
        break;
      case '--child-md-out':
        options.childMdOut = resolve(process.cwd(), readValue());
        break;
      case '--self-test':
        options.selfTest = true;
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

async function main() {
  const options = parseArgs();
  const report = options.selfTest
    ? createTimeoutReport(options, { timedOut: true, exitCode: null, signal: 'SELF_TEST', stdoutTail: '', stderrTail: '' })
    : await runAudit(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

async function runAudit(options) {
  const childArgs = [
    harnessPath,
    '--size-gib',
    String(options.sizeGiB),
    '--fixture-shape',
    'corpus-cycle',
    '--corpus-file',
    options.corpusFile,
    '--batch-size',
    '1',
    '--runs',
    '1',
    '--warmups',
    '0',
    '--cases',
    'fetchReadableStreamFull',
    '--browser-timeout-ms',
    String(options.browserTimeoutMs),
    '--json-out',
    options.childJsonOut,
    '--md-out',
    options.childMdOut,
  ];
  const child = spawn(process.execPath, childArgs, {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => {
    stdout = keepTail(stdout + chunk.toString('utf8'));
  });
  child.stderr.on('data', chunk => {
    stderr = keepTail(stderr + chunk.toString('utf8'));
  });

  const timeout = new Promise(resolve => {
    setTimeout(() => resolve('timeout'), options.childTimeoutMs);
  });
  const exit = new Promise(resolve => {
    child.once('exit', (exitCode, signal) => resolve({ exitCode, signal }));
  });
  const result = await Promise.race([timeout, exit]);
  if (result === 'timeout') {
    await terminateProcessTree(child.pid);
    return createTimeoutReport(options, {
      timedOut: true,
      exitCode: null,
      signal: 'timeout',
      stdoutTail: stdout,
      stderrTail: stderr,
    });
  }

  const childReport = existsSync(options.childJsonOut)
    ? JSON.parse(readFileSync(options.childJsonOut, 'utf8'))
    : null;
  return createCompletedReport(options, {
    timedOut: false,
    exitCode: result.exitCode,
    signal: result.signal,
    stdoutTail: stdout,
    stderrTail: stderr,
    childReport,
  });
}

function createTimeoutReport(options, result) {
  const sizeMiB = options.sizeGiB * 1024;
  const timeoutSeconds = options.childTimeoutMs / 1000;
  return {
    generatedAt: new Date().toISOString(),
    objective: 'firefox-fetch-readable-stream-timeout-audit',
    contract: 'firefox-browser-fetch-readable-stream-full-event-object-timeout',
    note: 'Timeout audit for Firefox/SpiderMonkey public EventReader over fetch Response.body on a 1 GiB corpus-cycle source.',
    parameters: createParameters(options),
    outcome: {
      status: 'timeout',
      completedWithinTimeout: false,
      timeoutSeconds,
      impliedThroughputUpperBoundMiBPerSec: sizeMiB / timeoutSeconds,
      exitCode: result.exitCode,
      signal: result.signal,
      stdoutTail: result.stdoutTail,
      stderrTail: result.stderrTail,
    },
    findings: [
      {
        id: 'firefox-fetch-readable-stream-timeout',
        classification: 'NEGATIVE_RESULT',
        summary: `Firefox/SpiderMonkey fetchReadableStreamFull did not complete ${options.sizeGiB.toFixed(2)} GiB within ${timeoutSeconds.toFixed(1)} seconds.`,
        evidence: [
          `impliedThroughputUpperBound=${(sizeMiB / timeoutSeconds).toFixed(2)} MiB/s`,
          'case=fetchReadableStreamFull',
          'contract=public EventReader full event-object checksum if completed',
        ],
      },
    ],
  };
}

function createCompletedReport(options, result) {
  const row = result.childReport?.variants?.find(entry => entry.id === 'fetchReadableStreamFull') ?? null;
  return {
    generatedAt: new Date().toISOString(),
    objective: 'firefox-fetch-readable-stream-timeout-audit',
    contract: 'firefox-browser-fetch-readable-stream-full-event-object-timeout',
    note: 'Timeout audit for Firefox/SpiderMonkey public EventReader over fetch Response.body on a 1 GiB corpus-cycle source.',
    parameters: createParameters(options),
    outcome: {
      status: result.exitCode === 0 && row ? 'completed' : 'failed',
      completedWithinTimeout: result.exitCode === 0 && Boolean(row),
      timeoutSeconds: options.childTimeoutMs / 1000,
      exitCode: result.exitCode,
      signal: result.signal,
      stdoutTail: result.stdoutTail,
      stderrTail: result.stderrTail,
      row: row ? {
        mibPerSec: row.mibPerSec,
        eventCount: row.eventCount,
        checksum: row.checksum,
        boundedMemory: row.boundedMemory,
        maxJsHeapUsedBytes: row.memory?.maxJsHeapUsedBytes ?? null,
      } : null,
    },
    findings: row ? [
      {
        id: 'firefox-fetch-readable-stream-completed',
        classification: 'BENCH_FACT',
        summary: `Firefox/SpiderMonkey fetchReadableStreamFull completed at ${row.mibPerSec.toFixed(2)} MiB/s.`,
        evidence: [
          `events=${row.eventCount}`,
          `checksum=${row.checksum}`,
          `boundedMemory=${row.boundedMemory}`,
        ],
      },
    ] : [],
  };
}

function createParameters(options) {
  return {
    sizeGiB: options.sizeGiB,
    corpusFile: options.corpusFile,
    case: 'fetchReadableStreamFull',
    childTimeoutMs: options.childTimeoutMs,
    browserTimeoutMs: options.browserTimeoutMs,
    childJsonOut: options.childJsonOut,
    childMdOut: options.childMdOut,
  };
}

function keepTail(value) {
  return value.length > 16_384 ? value.slice(-16_384) : value;
}

async function terminateProcessTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    await new Promise(resolve => {
      const killer = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    });
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Best-effort timeout cleanup.
  }
}

function renderMarkdown(report) {
  const lines = [
    '# Firefox Fetch ReadableStream Timeout Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Parameters',
    '',
    `- Size GiB: ${report.parameters.sizeGiB}`,
    `- Corpus file: ${report.parameters.corpusFile}`,
    `- Case: ${report.parameters.case}`,
    `- Child timeout: ${(report.parameters.childTimeoutMs / 1000).toFixed(1)} s`,
    `- Browser timeout: ${(report.parameters.browserTimeoutMs / 1000).toFixed(1)} s`,
    '',
    '## Outcome',
    '',
    `- Status: ${report.outcome.status}`,
    `- Completed within timeout: ${report.outcome.completedWithinTimeout ? 'yes' : 'no'}`,
  ];
  if (report.outcome.status === 'timeout') {
    lines.push(`- Implied throughput upper bound: ${report.outcome.impliedThroughputUpperBoundMiBPerSec.toFixed(2)} MiB/s`);
  }
  if (report.outcome.row) {
    lines.push(`- Throughput: ${report.outcome.row.mibPerSec.toFixed(2)} MiB/s`);
    lines.push(`- Events: ${report.outcome.row.eventCount}`);
    lines.push(`- Checksum: ${report.outcome.row.checksum}`);
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

function printSummary(report) {
  console.log(`firefox-fetch-readable-stream-timeout-audit: ${report.outcome.status}`);
  if (report.outcome.status === 'timeout') {
    console.log(`impliedThroughputUpperBound=${report.outcome.impliedThroughputUpperBoundMiBPerSec.toFixed(2)} MiB/s`);
  }
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

void main().catch(error => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
