import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import {
  createReport,
  printSummary,
  renderMarkdown,
  reservePort,
  startBenchmarkServer,
} from './browser-candidate-headroom.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'safari-webdriver-candidate-headroom-smoke.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'safari-webdriver-candidate-headroom-smoke.md');
const defaultCorpusFile = resolve(__dirname, '../stax-xml/performance/samples/treebank_e.xml');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizeGiB: 0.001,
    runs: 1,
    warmups: 0,
    fixtureShape: 'diverse-cycle',
    diverseCycleSize: 64,
    corpusFile: defaultCorpusFile,
    batchSize: 16,
    batchSizeExplicit: false,
    boundedJsHeapMiB: 512,
    cases: ['stringFull', 'eventObjectFull', 'rawFrameNameId'],
    driverExecutable: process.env.SAFARIDRIVER_PATH || findSafariDriverExecutable(),
    browserTimeoutMs: 120_000,
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
      case '--size-gib':
        options.sizeGiB = parsePositiveNumber(readValue(), name);
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), name);
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--fixture-shape':
        options.fixtureShape = readValue();
        break;
      case '--diverse-cycle-size':
        options.diverseCycleSize = parsePositiveInteger(readValue(), name);
        break;
      case '--corpus-file':
        options.corpusFile = resolve(process.cwd(), readValue());
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), name);
        options.batchSizeExplicit = true;
        break;
      case '--bounded-js-heap-mib':
        options.boundedJsHeapMiB = parsePositiveNumber(readValue(), name);
        break;
      case '--cases':
        options.cases = parseCaseList(readValue());
        break;
      case '--driver-executable':
        options.driverExecutable = resolve(process.cwd(), readValue());
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
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!['repeated-person', 'diverse-cycle', 'corpus-cycle', 'projection-cycle'].includes(options.fixtureShape)) {
    throw new Error('--fixture-shape must be one of repeated-person, diverse-cycle, corpus-cycle, projection-cycle.');
  }
  if (!options.driverExecutable || !existsSync(options.driverExecutable)) {
    throw new Error('safaridriver executable was not found. Pass --driver-executable or set SAFARIDRIVER_PATH.');
  }
  if (options.fixtureShape === 'corpus-cycle' && !existsSync(options.corpusFile)) {
    throw new Error(`--corpus-file does not exist: ${options.corpusFile}`);
  }
  if (options.fixtureShape === 'corpus-cycle' && !options.batchSizeExplicit) {
    options.batchSize = 1;
  }
  return options;
}

async function main() {
  const options = parseArgs();
  const server = await startBenchmarkServer(options);
  let driver;
  let client;
  const userDataDir = mkdtempSync(join(tmpdir(), 'stax-safari-webdriver-headroom-'));
  try {
    const driverPort = await reservePort();
    driver = launchSafariDriver(options, driverPort);
    client = new WebDriverClient(`http://127.0.0.1:${driverPort}`);
    await waitForSafariDriver(client, options.browserTimeoutMs, driver);
    const session = await client.createSession();
    const runnerUrl = `http://127.0.0.1:${server.port}/runner.html`;
    await client.navigate(session.sessionId, runnerUrl);
    const browserResult = await evaluateRunner(client, session.sessionId, options.browserTimeoutMs);
    if (browserResult?.error) {
      throw new Error(`${browserResult.error.name}: ${browserResult.error.message}\n${browserResult.error.stack ?? ''}`);
    }
    await client.deleteSession(session.sessionId).catch(() => {});
    const report = createReport(browserResult, {
      ...options,
      browserExecutable: options.driverExecutable,
    }, createHostProcessMemoryUnavailable());
    report.objective = 'safari-webdriver-candidate-headroom';
    report.automation = {
      protocol: 'W3C WebDriver',
      endpoint: 'http://127.0.0.1:<port>/session',
      note: 'Safari/WebKit is driven through safaridriver without Playwright, Selenium, CDP, or native addons.',
    };
    report.note = 'Safari/WebKit same-contract browser counterexample search over Uint8Array batches. Browser JS heap is available only if Safari exposes page memory counters; host process memory is not normalized across browsers.';
    writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
    writeOutput(options.mdOut, appendSafariNotes(renderMarkdown(report), report));
    printSummary(report);
  } finally {
    await client?.close().catch(() => {});
    await terminateProcess(driver);
    await server.close();
    safeRemoveDir(userDataDir);
  }
}

function launchSafariDriver(options, port) {
  const child = spawn(options.driverExecutable, ['--port', String(port)], {
    cwd: resolve(__dirname, '..', '..'),
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.stderrText = '';
  child.stderr.on('data', chunk => {
    child.stderrText += chunk.toString('utf8');
    if (child.stderrText.length > 16_384) {
      child.stderrText = child.stderrText.slice(-16_384);
    }
  });
  return child;
}

async function waitForSafariDriver(client, timeoutMs, driver) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    if (driver.exitCode !== null) {
      throw new Error(`safaridriver exited before WebDriver became available: ${driver.exitCode}\n${driver.stderrText}`);
    }
    try {
      await client.status();
      return;
    } catch (error) {
      lastError = error;
      await delay(100);
    }
  }
  throw new Error(`Timed out waiting for safaridriver: ${lastError?.message ?? 'not available'}\n${driver.stderrText}`);
}

async function evaluateRunner(client, sessionId, timeoutMs) {
  const script = createWebDriverBenchmarkScript(timeoutMs);
  const encoded = await withTimeout(
    client.executeAsync(sessionId, script, []),
    timeoutMs,
    'Timed out waiting for Safari benchmark evaluation.',
  );
  if (typeof encoded !== 'string') {
    throw new Error(`Safari WebDriver benchmark evaluation did not return a string: ${JSON.stringify(encoded)}`);
  }
  return JSON.parse(encoded);
}

function createWebDriverBenchmarkScript(timeoutMs) {
  return `
const done = arguments[arguments.length - 1];
const startedAt = performance.now();
const tick = () => {
  if (globalThis.__staxBrowserBenchmarkResult) {
    Promise.resolve(globalThis.__staxBrowserBenchmarkResult).then((value) => {
      done(JSON.stringify(value));
    }, (error) => {
      done(JSON.stringify({ error: { name: error?.name ?? 'Error', message: error?.message ?? String(error), stack: error?.stack ?? null } }));
    });
    return;
  }
  if (performance.now() - startedAt > ${JSON.stringify(timeoutMs - 1000)}) {
    done(JSON.stringify({ error: { name: 'TimeoutError', message: 'Timed out waiting for Safari benchmark runner.', stack: null } }));
    return;
  }
  setTimeout(tick, 25);
};
tick();
`;
}

class WebDriverClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.sessionIds = new Set();
  }

  status() {
    return this.request('GET', '/status');
  }

  async createSession() {
    const response = await this.request('POST', '/session', {
      capabilities: {
        alwaysMatch: {
          browserName: 'safari',
        },
      },
    });
    const value = unwrapWebDriverValue(response);
    const sessionId = value.sessionId ?? response.sessionId;
    if (!sessionId) {
      throw new Error(`WebDriver session response did not include sessionId: ${JSON.stringify(response)}`);
    }
    this.sessionIds.add(sessionId);
    return { sessionId, capabilities: value.capabilities ?? value };
  }

  navigate(sessionId, url) {
    return this.request('POST', `/session/${encodeURIComponent(sessionId)}/url`, { url });
  }

  async executeAsync(sessionId, script, args = []) {
    const response = await this.request('POST', `/session/${encodeURIComponent(sessionId)}/execute/async`, {
      script,
      args,
    });
    return unwrapWebDriverValue(response);
  }

  async deleteSession(sessionId) {
    this.sessionIds.delete(sessionId);
    return this.request('DELETE', `/session/${encodeURIComponent(sessionId)}`);
  }

  async close() {
    for (const sessionId of Array.from(this.sessionIds)) {
      await this.deleteSession(sessionId).catch(() => {});
    }
  }

  async request(method, path, body = undefined) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json; charset=utf-8' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const parsed = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = parsed?.value?.message ?? parsed?.message ?? response.statusText;
      throw new Error(`WebDriver ${method} ${path} failed with ${response.status}: ${error}`);
    }
    return parsed;
  }
}

function unwrapWebDriverValue(response) {
  return response && Object.hasOwn(response, 'value') ? response.value : response;
}

function createHostProcessMemoryUnavailable() {
  return {
    scope: 'not-recorded',
    note: 'Safari/WebKit WebDriver harness does not record portable browser process RSS. Page JS heap counters are used only when the browser exposes them.',
    samples: [],
    maxWorkingSetBytes: null,
    maxPrivateBytes: null,
    maxProcessCount: null,
  };
}

function appendSafariNotes(markdown, report) {
  const lines = markdown.trimEnd().split('\n');
  lines.push(
    '',
    '## Safari WebDriver Notes',
    '',
    `- Automation: ${report.automation.protocol}`,
    `- Browser: ${report.environment.browserName} ${report.environment.browserVersion}`,
    `- Engine: ${report.environment.javascriptEngine}`,
    '- This path does not use Playwright, Selenium, CDP, Node `Buffer.toString()`, or a native addon.',
    '- Safari/WebKit rows must be generated on a host where safaridriver can launch the exact browser build under test.',
  );
  return `${lines.join('\n')}\n`;
}

function findSafariDriverExecutable() {
  const candidates = process.platform === 'darwin'
    ? ['/usr/bin/safaridriver']
    : [
        'C:\\Program Files\\Safari\\safaridriver.exe',
        'C:\\Program Files (x86)\\Safari\\safaridriver.exe',
      ];
  return candidates.find(candidate => existsSync(candidate)) ?? null;
}

async function terminateProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise(resolveExit => child.once('exit', resolveExit)),
    delay(2000),
  ]);
}

function safeRemoveDir(dirPath) {
  try {
    rmSync(dirPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch {
    // Browser processes may keep profile files locked briefly after exit.
  }
}

function parseCaseList(value) {
  const parsed = value.split(',').map(entry => entry.trim()).filter(Boolean);
  if (parsed.length === 0) throw new Error('--cases must contain at least one case id.');
  return parsed;
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

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function withTimeout(promise, timeoutMs, message) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeout));
}

function delay(ms) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, ms));
}

export {
  WebDriverClient,
  createHostProcessMemoryUnavailable,
  createWebDriverBenchmarkScript,
  findSafariDriverExecutable,
  parseArgs,
  unwrapWebDriverValue,
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
