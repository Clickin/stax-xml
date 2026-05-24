import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import {
  collectHostProcessMemorySample,
  createReport,
  printSummary,
  renderMarkdown,
  reservePort,
  startBenchmarkServer,
  summarizeHostProcessMemory,
} from './browser-candidate-headroom.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'firefox-bidi-candidate-headroom-smoke.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'firefox-bidi-candidate-headroom-smoke.md');
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
    browserExecutable: process.env.FIREFOX_PATH || findFirefoxExecutable(),
    browserTimeoutMs: 120_000,
    collectHostProcessMemory: true,
    gracefulBrowserClose: false,
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
      case '--browser-executable':
        options.browserExecutable = resolve(process.cwd(), readValue());
        break;
      case '--browser-timeout-ms':
        options.browserTimeoutMs = parsePositiveInteger(readValue(), name);
        break;
      case '--no-host-process-memory':
        options.collectHostProcessMemory = false;
        break;
      case '--graceful-browser-close':
        options.gracefulBrowserClose = true;
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
  if (!options.browserExecutable || !existsSync(options.browserExecutable)) {
    throw new Error('Firefox executable was not found. Pass --browser-executable or set FIREFOX_PATH.');
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
  let browser;
  let client;
  let contextId;
  const hostProcessMemorySamples = [];
  const userDataDir = mkdtempSync(join(tmpdir(), 'stax-firefox-bidi-headroom-'));
  try {
    const browserPort = await reservePort();
    browser = launchFirefox(options, browserPort, userDataDir);
    client = await FirefoxBidiClient.connect(`ws://127.0.0.1:${browserPort}/session`, options.browserTimeoutMs, browser);
    await client.send('session.new', { capabilities: { alwaysMatch: {} } });
    const created = await client.send('browsingContext.create', { type: 'tab' });
    contextId = created.context;
    hostProcessMemorySamples.push(collectHostProcessMemorySample(browser.pid, 'browser-started', options));
    const runnerUrl = `http://127.0.0.1:${server.port}/runner.html`;
    hostProcessMemorySamples.push(collectHostProcessMemorySample(browser.pid, 'before-run', options));
    await client.send('browsingContext.navigate', { context: contextId, url: runnerUrl, wait: 'complete' });
    const browserResult = await evaluateRunner(client, contextId, options.browserTimeoutMs);
    hostProcessMemorySamples.push(collectHostProcessMemorySample(browser.pid, 'after-run', options));
    if (browserResult?.error) {
      throw new Error(`${browserResult.error.name}: ${browserResult.error.message}\n${browserResult.error.stack ?? ''}`);
    }

    await closeFirefoxBrowser({ client, browser, contextId, graceful: options.gracefulBrowserClose });
    contextId = null;
    client = null;
    browser = null;

    await collectVariantHostProcessMemoryProbes(browserResult, options);
    const report = createReport(browserResult, options, summarizeHostProcessMemory(hostProcessMemorySamples, options));
    report.objective = 'firefox-bidi-candidate-headroom';
    report.automation = {
      protocol: 'WebDriver BiDi',
      endpoint: 'ws://127.0.0.1:<port>/session',
      note: 'Firefox is driven through its built-in WebDriver BiDi endpoint without Playwright or Selenium.',
    };
    report.note = 'Firefox/SpiderMonkey same-contract browser counterexample search over Uint8Array batches. Variant memory is available only when the browser exposes page heap counters; host process-tree memory is reported separately.';
    writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
    writeOutput(options.mdOut, appendFirefoxNotes(renderMarkdown(report), report));
    printSummary(report);
  } finally {
    if (contextId) {
      await client?.send('browsingContext.close', { context: contextId }).catch(() => {});
    }
    await client?.send('session.end', {}).catch(() => {});
    await client?.close().catch(() => {});
    await terminateBrowser(browser);
    await server.close();
    safeRemoveDir(userDataDir);
  }
}

async function collectVariantHostProcessMemoryProbes(browserResult, options) {
  if (!options.collectHostProcessMemory) {
    return;
  }
  for (const variant of browserResult.variants) {
    variant.hostProcessMemoryProbe = await collectSingleVariantHostProcessMemoryProbe(variant.id, options);
  }
}

async function collectSingleVariantHostProcessMemoryProbe(caseId, options) {
  const caseOptions = { ...options, cases: [caseId] };
  let probeBrowser;
  let probeClient;
  let probeContextId;
  const userDataDir = mkdtempSync(join(tmpdir(), 'stax-firefox-bidi-memory-probe-'));
  const samples = [];
  try {
    const browserPort = await reservePort();
    probeBrowser = launchFirefox(caseOptions, browserPort, userDataDir);
    probeClient = await FirefoxBidiClient.connect(`ws://127.0.0.1:${browserPort}/session`, caseOptions.browserTimeoutMs, probeBrowser);
    await probeClient.send('session.new', { capabilities: { alwaysMatch: {} } });
    const created = await probeClient.send('browsingContext.create', { type: 'tab' });
    probeContextId = created.context;
    samples.push(collectHostProcessMemorySample(probeBrowser.pid, `probe-before-${caseId}`, options));
    const probeResult = await runBenchmarkCase(probeClient, probeContextId, caseOptions);
    samples.push(collectHostProcessMemorySample(probeBrowser.pid, `probe-after-${caseId}`, options));
    if (probeResult?.error) {
      throw new Error(`${probeResult.error.name}: ${probeResult.error.message}\n${probeResult.error.stack ?? ''}`);
    }
    const probeVariant = probeResult.variants.find(entry => entry.id === caseId);
    if (!probeVariant) {
      throw new Error(`Firefox host-memory probe did not return variant ${caseId}.`);
    }
    return {
      ...summarizeHostProcessMemory(samples, options),
      note: 'Separate fresh-browser per-case Firefox probe pass bracketing this variant with Windows host process-tree counters. This is not portable browser RSS, not JS heap proof, and not the timing sample used for throughput.',
      probeMibPerSec: probeVariant.mibPerSec,
      probeEventCount: probeVariant.eventCount,
      probeChecksum: probeVariant.checksum,
    };
  } finally {
    if (probeContextId) {
      await probeClient?.send('browsingContext.close', { context: probeContextId }).catch(() => {});
    }
    await probeClient?.send('session.end', {}).catch(() => {});
    await probeClient?.close().catch(() => {});
    await terminateBrowser(probeBrowser);
    safeRemoveDir(userDataDir);
  }
}

async function runBenchmarkCase(client, contextId, caseOptions) {
  const server = await startBenchmarkServer(caseOptions);
  try {
    const runnerUrl = `http://127.0.0.1:${server.port}/runner.html`;
    await client.send('browsingContext.navigate', { context: contextId, url: runnerUrl, wait: 'complete' });
    return await evaluateRunner(client, contextId, caseOptions.browserTimeoutMs);
  } finally {
    await server.close();
  }
}

function launchFirefox(options, port, userDataDir) {
  const child = spawn(options.browserExecutable, [
    '-headless',
    '--remote-debugging-port',
    String(port),
    '-profile',
    userDataDir,
    'about:blank',
  ], {
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

async function evaluateRunner(client, contextId, timeoutMs) {
  const expression = `
    new Promise((resolve) => {
      const startedAt = performance.now();
      const tick = () => {
        if (globalThis.__staxBrowserBenchmarkResult) {
          Promise.resolve(globalThis.__staxBrowserBenchmarkResult).then(resolve, (error) => {
            resolve({ error: { name: error?.name ?? 'Error', message: error?.message ?? String(error), stack: error?.stack ?? null } });
          });
          return;
        }
        if (performance.now() - startedAt > ${JSON.stringify(timeoutMs - 1000)}) {
          resolve({ error: { name: 'TimeoutError', message: 'Timed out waiting for Firefox benchmark runner.', stack: null } });
          return;
        }
        setTimeout(tick, 25);
      };
      tick();
    }).then((value) => JSON.stringify(value))
  `;
  const result = await withTimeout(client.send('script.evaluate', {
    expression,
    target: { context: contextId },
    awaitPromise: true,
    resultOwnership: 'none',
  }), timeoutMs, 'Timed out waiting for Firefox benchmark evaluation.');
  if (result.type !== 'success') {
    throw new Error(`Firefox BiDi script evaluation failed: ${JSON.stringify(result)}`);
  }
  const remote = result.result;
  if (remote?.type !== 'string') {
    throw new Error(`Firefox BiDi script evaluation did not return a string: ${JSON.stringify(remote)}`);
  }
  return JSON.parse(remote.value);
}

class FirefoxBidiClient {
  static async connect(wsUrl, timeoutMs, browser) {
    const startedAt = Date.now();
    let lastError = null;
    while (Date.now() - startedAt < timeoutMs) {
      if (browser.exitCode !== null) {
        throw new Error(`Firefox exited before BiDi became available: ${browser.exitCode}\n${browser.stderrText}`);
      }
      try {
        const socket = new WebSocket(wsUrl);
        await new Promise((resolveOpen, rejectOpen) => {
          socket.addEventListener('open', resolveOpen, { once: true });
          socket.addEventListener('error', rejectOpen, { once: true });
        });
        return new FirefoxBidiClient(socket);
      } catch (error) {
        lastError = error;
        await delay(100);
      }
    }
    throw new Error(`Timed out waiting for Firefox BiDi endpoint ${wsUrl}: ${lastError?.message ?? 'not available'}\n${browser.stderrText}`);
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener('message', event => this.handleMessage(event));
    socket.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) {
        reject(new Error('Firefox BiDi socket closed.'));
      }
      this.pending.clear();
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolveSend, rejectSend) => {
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend });
    });
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.type === 'error') {
      pending.reject(new Error(`${message.error}: ${message.message ?? ''}`));
      return;
    }
    pending.resolve(message.result);
  }

  async close() {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
  }
}

async function terminateBrowser(browser) {
  if (!browser || browser.exitCode !== null) return;
  browser.kill();
  await Promise.race([
    new Promise(resolveExit => browser.once('exit', resolveExit)),
    delay(2000),
  ]);
}

async function closeFirefoxBrowser({ client, browser, contextId, graceful }) {
  if (graceful && client && browser && browser.exitCode === null) {
    await client.send('browser.close', {}).catch(() => {});
    await Promise.race([
      new Promise(resolveExit => browser.once('exit', resolveExit)),
      delay(10_000),
    ]);
    await client.close().catch(() => {});
    if (browser.exitCode !== null) return;
  }
  if (contextId) {
    await client?.send('browsingContext.close', { context: contextId }).catch(() => {});
  }
  await client?.send('session.end', {}).catch(() => {});
  await client?.close().catch(() => {});
  await terminateBrowser(browser);
}

function safeRemoveDir(dirPath) {
  try {
    rmSync(dirPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch {
    // Firefox may keep profile files locked briefly after process exit.
  }
}

function appendFirefoxNotes(markdown, report) {
  const lines = markdown.trimEnd().split('\n');
  lines.push(
    '',
    '## Firefox BiDi Notes',
    '',
    `- Automation: ${report.automation.protocol}`,
    `- Browser: ${report.environment.browserName} ${report.environment.browserVersion}`,
    `- Engine: ${report.environment.javascriptEngine}`,
    '- This path does not use Playwright, Selenium, CDP, or a native addon.',
    '- Firefox does not expose Chromium `performance.memory`; per-variant host process-tree probes are Windows host evidence, not portable browser RSS or JS heap proof.',
  );
  return `${lines.join('\n')}\n`;
}

function findFirefoxExecutable() {
  const candidates = [
    'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
    'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
  ];
  return candidates.find(candidate => existsSync(candidate)) ?? null;
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
  FirefoxBidiClient,
  evaluateRunner,
  findFirefoxExecutable,
  launchFirefox,
  safeRemoveDir,
  terminateBrowser,
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
