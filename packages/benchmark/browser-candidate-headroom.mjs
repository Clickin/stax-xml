import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const packageVersion = JSON.parse(readFileSync(resolve(__dirname, '../stax-xml/package.json'), 'utf8')).version;
const externalBaselinePath = resolve(__dirname, 'results', 'release', 'external-baseline.json');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'browser-candidate-headroom-large.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'browser-candidate-headroom-large.md');
const defaultCorpusFile = resolve(__dirname, '../stax-xml/performance/samples/treebank_e.xml');
const distIndexPath = resolve(__dirname, '../stax-xml/dist/index.js');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizeGiB: 1,
    runs: 1,
    warmups: 0,
    fixtureShape: 'diverse-cycle',
    diverseCycleSize: 4096,
    corpusFile: defaultCorpusFile,
    batchSize: 16,
    batchSizeExplicit: false,
    boundedJsHeapMiB: 512,
    browserExecutable: process.env.CHROME_PATH || process.env.EDGE_PATH || findBrowserExecutable(),
    browserTimeoutMs: 20 * 60 * 1000,
    collectHostProcessMemory: true,
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
        options.sizeGiB = parsePositiveNumber(readValue(), '--size-gib');
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), '--runs');
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), '--warmups');
        break;
      case '--fixture-shape':
        options.fixtureShape = readValue();
        break;
      case '--diverse-cycle-size':
        options.diverseCycleSize = parsePositiveInteger(readValue(), '--diverse-cycle-size');
        break;
      case '--corpus-file':
        options.corpusFile = resolve(process.cwd(), readValue());
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), '--batch-size');
        options.batchSizeExplicit = true;
        break;
      case '--bounded-js-heap-mib':
        options.boundedJsHeapMiB = parsePositiveNumber(readValue(), '--bounded-js-heap-mib');
        break;
      case '--browser-executable':
        options.browserExecutable = resolve(process.cwd(), readValue());
        break;
      case '--browser-timeout-ms':
        options.browserTimeoutMs = parsePositiveInteger(readValue(), '--browser-timeout-ms');
        break;
      case '--no-host-process-memory':
        options.collectHostProcessMemory = false;
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

  if (!['repeated-person', 'diverse-cycle', 'corpus-cycle'].includes(options.fixtureShape)) {
    throw new Error('--fixture-shape must be one of repeated-person, diverse-cycle, corpus-cycle.');
  }
  if (!options.browserExecutable || !existsSync(options.browserExecutable)) {
    throw new Error('Chrome or Edge executable was not found. Pass --browser-executable or set CHROME_PATH/EDGE_PATH.');
  }
  if (!existsSync(distIndexPath)) {
    throw new Error(`Built browser module does not exist: ${distIndexPath}. Run pnpm --filter stax-xml build first.`);
  }
  if (options.fixtureShape === 'corpus-cycle' && !existsSync(options.corpusFile)) {
    throw new Error(`--corpus-file does not exist: ${options.corpusFile}`);
  }
  if (options.fixtureShape === 'corpus-cycle' && !options.batchSizeExplicit) {
    options.batchSize = 1;
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

function parseNonNegativeInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${flag} must be a non-negative integer.`);
  return parsed;
}

async function main() {
  const options = parseArgs();
  const server = await startBenchmarkServer(options);
  let browser;
  let client;
  let targetId;
  let browserPort;
  const hostProcessMemorySamples = [];
  const userDataDir = mkdtempSync(join(tmpdir(), 'stax-browser-headroom-'));
  try {
    browserPort = await reservePort();
    browser = launchBrowser(options, browserPort, userDataDir);
    await waitForBrowser(browserPort, options.browserTimeoutMs, browser);
    hostProcessMemorySamples.push(collectHostProcessMemorySample(browser.pid, 'browser-started', options));
    const runnerUrl = `http://127.0.0.1:${server.port}/runner.html`;
    const target = await openPage(browserPort, 'about:blank');
    targetId = target.id;
    client = await CdpClient.connect(target.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    hostProcessMemorySamples.push(collectHostProcessMemorySample(browser.pid, 'before-run', options));
    await client.send('Page.navigate', { url: runnerUrl });
    await withTimeout(client.waitForEvent('Runtime.executionContextCreated'), 5000, 'Timed out waiting for browser execution context.').catch(() => {});
    const browserResult = await evaluateRunner(client, options.browserTimeoutMs);
    hostProcessMemorySamples.push(collectHostProcessMemorySample(browser.pid, 'after-run', options));
    if (browserResult?.error) {
      throw new Error(`${browserResult.error.name}: ${browserResult.error.message}\n${browserResult.error.stack ?? ''}`);
    }
    const report = createReport(browserResult, options, summarizeHostProcessMemory(hostProcessMemorySamples, options));
    writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
    writeOutput(options.mdOut, renderMarkdown(report));
    printSummary(report);
  } finally {
    await client?.close().catch(() => {});
    if (targetId && browserPort) {
      await closePage(browserPort, targetId).catch(() => {});
    }
    await terminateBrowser(browser);
    await server.close();
    safeRemoveDir(userDataDir);
  }
}

async function startBenchmarkServer(options) {
  const runnerScript = createRunnerScript(options);
  const html = '<!doctype html><meta charset="utf-8"><title>stax browser candidate headroom</title><script type="module" src="/runner.js"></script>';
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/runner.html') {
      sendText(response, 200, 'text/html; charset=utf-8', html);
      return;
    }
    if (url.pathname === '/runner.js') {
      sendText(response, 200, 'text/javascript; charset=utf-8', runnerScript);
      return;
    }
    if (url.pathname === '/stax/index.js') {
      sendFile(response, distIndexPath, 'text/javascript; charset=utf-8');
      return;
    }
    if (url.pathname === '/corpus') {
      sendFile(response, options.corpusFile, 'application/xml; charset=utf-8');
      return;
    }
    sendText(response, 404, 'text/plain; charset=utf-8', 'not found');
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  return {
    port: server.address().port,
    close: () => new Promise(resolveClose => server.close(resolveClose)),
  };
}

function sendText(response, statusCode, contentType, body) {
  response.writeHead(statusCode, {
    'content-type': contentType,
    'cache-control': 'no-store',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-embedder-policy': 'require-corp',
  });
  response.end(body);
}

function sendFile(response, filePath, contentType) {
  const size = statSync(filePath).size;
  response.writeHead(200, {
    'content-type': contentType,
    'content-length': size,
    'cache-control': 'no-store',
    'cross-origin-resource-policy': 'same-origin',
  });
  createReadStream(filePath).pipe(response);
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const port = server.address().port;
  await new Promise(resolveClose => server.close(resolveClose));
  return port;
}

function launchBrowser(options, port, userDataDir) {
  const args = [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-gpu',
    '--disable-sync',
    '--enable-precise-memory-info',
    '--js-flags=--expose-gc',
    '--no-default-browser-check',
    '--no-first-run',
    'about:blank',
  ];
  const child = spawn(options.browserExecutable, args, {
    cwd: repoRoot,
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

async function waitForBrowser(port, timeoutMs, browser) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (browser.exitCode !== null) {
      throw new Error(`Browser exited before CDP became available: ${browser.exitCode}\n${browser.stderrText}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until Chrome publishes the DevTools endpoint.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for browser CDP on port ${port}.\n${browser.stderrText}`);
}

async function openPage(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!response.ok) {
    throw new Error(`Failed to open browser page via CDP: HTTP ${response.status} ${await response.text()}`);
  }
  const target = await response.json();
  if (!target.webSocketDebuggerUrl) {
    throw new Error('CDP target did not include webSocketDebuggerUrl.');
  }
  return target;
}

async function closePage(port, targetId) {
  // Chrome accepts this on the browser HTTP endpoint, but target closure is best-effort.
  await fetch(`http://127.0.0.1:${port}/json/close/${encodeURIComponent(targetId)}`);
}

async function terminateBrowser(browser) {
  if (!browser || browser.exitCode !== null) {
    return;
  }
  browser.kill();
  await Promise.race([
    new Promise(resolveExit => browser.once('exit', resolveExit)),
    delay(2000),
  ]);
}

function safeRemoveDir(dirPath) {
  try {
    rmSync(dirPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch {
    // Windows can keep Chrome profile files locked briefly after process exit.
    // The benchmark result is still valid, so cleanup remains best-effort.
  }
}

async function evaluateRunner(client, timeoutMs) {
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
          resolve({ error: { name: 'TimeoutError', message: 'Timed out waiting for browser benchmark runner.', stack: null } });
          return;
        }
        setTimeout(tick, 25);
      };
      tick();
    })
  `;
  const result = await withTimeout(client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }), timeoutMs, 'Timed out waiting for browser benchmark evaluation.');
  if (result.exceptionDetails) {
    throw new Error(`Browser evaluation failed: ${result.exceptionDetails.text}`);
  }
  return result.result.value;
}

async function withTimeout(promise, timeoutMs, message) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function delay(ms) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, ms));
}

class CdpClient {
  static async connect(wsUrl) {
    const socket = new WebSocket(wsUrl);
    await new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener('open', resolveOpen, { once: true });
      socket.addEventListener('error', rejectOpen, { once: true });
    });
    return new CdpClient(socket);
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.eventWaiters = new Map();
    socket.addEventListener('message', event => this.handleMessage(event));
    socket.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) {
        reject(new Error('CDP socket closed.'));
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
    if (!message.id) {
      const waiters = this.eventWaiters.get(message.method);
      if (waiters?.length) {
        waiters.shift().resolve(message.params);
        if (waiters.length === 0) {
          this.eventWaiters.delete(message.method);
        }
      }
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(new Error(`${message.error.message}: ${message.error.data ?? ''}`));
      return;
    }
    pending.resolve(message.result);
  }

  waitForEvent(method) {
    return new Promise(resolveEvent => {
      const waiters = this.eventWaiters.get(method) ?? [];
      waiters.push({ resolve: resolveEvent });
      this.eventWaiters.set(method, waiters);
    });
  }

  async close() {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
  }
}

function collectHostProcessMemorySample(rootPid, label, options) {
  const at = new Date().toISOString();
  if (!options.collectHostProcessMemory) {
    return {
      label,
      at,
      scope: 'disabled',
      reason: 'Host process memory collection was disabled with --no-host-process-memory.',
    };
  }
  if (process.platform !== 'win32') {
    return {
      label,
      at,
      scope: 'unsupported',
      reason: 'Host process-tree memory collection is currently implemented only for Windows.',
    };
  }
  if (!Number.isInteger(rootPid) || rootPid <= 0) {
    return {
      label,
      at,
      scope: 'unavailable',
      error: `Invalid browser root pid: ${rootPid}`,
    };
  }

  const script = `
$ErrorActionPreference = 'Stop'
$root = [int]${rootPid}
$all = @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,WorkingSetSize,PrivatePageCount)
$ids = [System.Collections.Generic.HashSet[int]]::new()
[void]$ids.Add($root)
do {
  $changed = $false
  foreach ($process in $all) {
    $processId = [int]$process.ProcessId
    $parentProcessId = [int]$process.ParentProcessId
    if ($ids.Contains($parentProcessId) -and -not $ids.Contains($processId)) {
      [void]$ids.Add($processId)
      $changed = $true
    }
  }
} while ($changed)
$selected = @($all | Where-Object { $ids.Contains([int]$_.ProcessId) })
$workingSet = ($selected | Measure-Object -Property WorkingSetSize -Sum).Sum
if ($null -eq $workingSet) { $workingSet = 0 }
$privateBytes = ($selected | Measure-Object -Property PrivatePageCount -Sum).Sum
if ($null -eq $privateBytes) { $privateBytes = 0 }
[pscustomobject]@{
  rootPid = $root
  processCount = $selected.Count
  workingSetBytes = [int64]$workingSet
  privateBytes = [int64]$privateBytes
  processes = @($selected | ForEach-Object {
    [pscustomobject]@{
      pid = [int]$_.ProcessId
      parentPid = [int]$_.ParentProcessId
      name = [string]$_.Name
      workingSetBytes = [int64]$_.WorkingSetSize
      privateBytes = [int64]$_.PrivatePageCount
    }
  })
} | ConvertTo-Json -Depth 5 -Compress
`;

  const result = spawnSync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    script,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15_000,
  });
  if (result.error || result.status !== 0) {
    return {
      label,
      at,
      scope: 'unavailable',
      error: result.error?.message ?? result.stderr.trim() ?? `PowerShell exited with ${result.status}`,
    };
  }
  try {
    const parsed = JSON.parse(result.stdout.trim());
    return {
      label,
      at,
      scope: 'windows-process-tree',
      rootPid: parsed.rootPid,
      processCount: parsed.processCount,
      workingSetBytes: parsed.workingSetBytes,
      privateBytes: parsed.privateBytes,
      processes: Array.isArray(parsed.processes) ? parsed.processes : [],
    };
  } catch (error) {
    return {
      label,
      at,
      scope: 'unavailable',
      error: `Could not parse host process memory sample: ${error.message}`,
    };
  }
}

function summarizeHostProcessMemory(samples, options) {
  if (!options.collectHostProcessMemory) {
    return {
      scope: 'disabled',
      note: 'Host process memory collection was disabled.',
      samples,
      maxWorkingSetBytes: null,
      maxPrivateBytes: null,
      maxProcessCount: null,
    };
  }
  if (process.platform !== 'win32') {
    return {
      scope: 'unsupported',
      note: 'Host process-tree memory collection is currently implemented only for Windows.',
      samples,
      maxWorkingSetBytes: null,
      maxPrivateBytes: null,
      maxProcessCount: null,
    };
  }

  const usableSamples = samples.filter(sample => sample.scope === 'windows-process-tree');
  if (usableSamples.length === 0) {
    return {
      scope: 'unavailable',
      note: 'Windows host process-tree memory collection failed for every sample.',
      samples,
      maxWorkingSetBytes: null,
      maxPrivateBytes: null,
      maxProcessCount: null,
    };
  }

  return {
    scope: 'windows-process-tree',
    note: 'Windows Win32_Process process tree rooted at the browser pid. Working set and private bytes are host OS counters, not portable browser RSS, and are not variant-level JS heap measurements.',
    samples,
    maxWorkingSetBytes: Math.max(...usableSamples.map(sample => sample.workingSetBytes ?? 0)),
    maxPrivateBytes: Math.max(...usableSamples.map(sample => sample.privateBytes ?? 0)),
    maxProcessCount: Math.max(...usableSamples.map(sample => sample.processCount ?? 0)),
  };
}

function createReport(browserResult, options, hostProcessMemory) {
  const woodstoxTarget = readWoodstoxTarget();
  const boundedJsHeapBytes = options.boundedJsHeapMiB * MIB;
  const stringFull = browserResult.variants.find(entry => entry.id === 'stringFull');
  const variants = browserResult.variants.map(entry => {
    const boundedMemory = typeof entry.memory.maxJsHeapUsedBytes === 'number'
      ? entry.memory.maxJsHeapUsedBytes <= boundedJsHeapBytes
      : false;
    const counterexampleEligible = entry.fullStringParity && browserResult.fixture.actualBytes >= GIB && boundedMemory;
    return {
      ...entry,
      boundedMemory,
      runtimeLimitCounterexampleEligible: counterexampleEligible,
      counterexampleStatus: counterexampleEligible && entry.mibPerSec >= 200 ? 'found' : 'not-found',
      relativeToStringFull: stringFull ? entry.mibPerSec / stringFull.mibPerSec : 1,
      woodstoxRatio: woodstoxTarget.woodstoxMiBPerSec
        ? entry.mibPerSec / woodstoxTarget.woodstoxMiBPerSec
        : null,
      targetStatus: entry.fullStringParity && woodstoxTarget.targetThroughputMiB
        ? entry.mibPerSec >= woodstoxTarget.targetThroughputMiB ? 'met' : 'below'
        : 'not-applicable',
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    objective: 'browser-candidate-headroom',
    contract: browserResult.fixture.source === 'corpus-file'
      ? 'browser-corpus-byte-batch-mixed-materialization-headroom-matrix'
      : 'browser-byte-batch-mixed-materialization-headroom-matrix',
    note: 'This is a browser-runtime counterexample search over Uint8Array batches. Variant memory is browser JS heap; host process-tree memory is reported separately when available.',
    packageVersion,
    environment: {
      ...browserResult.environment,
      cpuName: cpus()[0]?.model ?? 'unknown',
      hostPlatform: `${process.platform}-${process.arch}`,
      browserExecutable: options.browserExecutable,
    },
    fixture: browserResult.fixture,
    options: {
      runs: options.runs,
      warmups: options.warmups,
      boundedJsHeapMiB: options.boundedJsHeapMiB,
    },
    hostProcessMemory,
    woodstoxTarget,
    omittedRows: [
      {
        id: 'projectionLowSelectivity',
        reason: 'Projection rows require a separate selector contract and remain future work.',
      },
      {
        id: 'projectionHighSelectivity',
        reason: 'Projection rows require a separate selector contract and remain future work.',
      },
      {
        id: 'processRss',
        reason: 'Browsers do not expose a portable process RSS metric to page JavaScript; this report records variant JS heap via Chromium performance.memory and separate Windows process-tree counters when available.',
      },
    ],
    eventCountParity: browserResult.eventCountParity,
    fullStringParity: browserResult.fullStringParity,
    variants,
    findings: createFindings(variants, browserResult.fixture, hostProcessMemory),
  };
}

function readWoodstoxTarget() {
  if (!existsSync(externalBaselinePath)) {
    return {
      status: 'missing',
      path: externalBaselinePath,
      baselineTool: 'woodstox',
      goalRatio: 0.9,
      targetThroughputMiB: null,
      woodstoxMiBPerSec: null,
    };
  }
  const report = JSON.parse(readFileSync(externalBaselinePath, 'utf8'));
  const woodstox = report.results?.find(entry => entry.tool === 'woodstox');
  return {
    status: 'ok',
    path: externalBaselinePath,
    baselineTool: report.target?.baselineTool ?? 'woodstox',
    goalRatio: report.target?.goalRatio ?? 0.9,
    targetThroughputMiB: report.target?.targetThroughputMiB ?? null,
    woodstoxMiBPerSec: woodstox?.mibPerSec ?? null,
  };
}

function createFindings(variants, fixture, hostProcessMemory) {
  const partialRows = variants.filter(entry => !entry.fullStringParity);
  const fullRows = variants.filter(entry => entry.fullStringParity);
  const fastestPartial = maxBy(partialRows, entry => entry.mibPerSec);
  const fastestFull = maxBy(fullRows, entry => entry.mibPerSec);
  const findings = [
    {
      id: 'browser-byte-batch-contract',
      summary: fixture.source === 'corpus-file'
        ? 'Rows consume corpus-backed browser Uint8Array batches and do not load a full XML string.'
        : 'Rows consume generated browser Uint8Array batches and do not load a full XML string.',
      evidence: fullRows.map(entry => `${entry.id}: maxJsHeap=${formatBytes(entry.memory.maxJsHeapUsedBytes)}`),
    },
    {
      id: 'browser-memory-scope',
      summary: 'Variant memory is browser JS heap only; it is not a process RSS replacement.',
      evidence: fullRows.map(entry => `${entry.id}: jsHeapLimit=${formatBytes(entry.memory.jsHeapSizeLimitBytes)}`),
    },
    {
      id: 'browser-host-process-memory',
      summary: 'Host process-tree memory is recorded separately from variant JS heap when the host supports it.',
      evidence: hostProcessMemory.scope === 'windows-process-tree'
        ? [
            `maxWorkingSet=${formatBytes(hostProcessMemory.maxWorkingSetBytes)}`,
            `maxPrivateBytes=${formatBytes(hostProcessMemory.maxPrivateBytes)}`,
            `maxProcessCount=${hostProcessMemory.maxProcessCount}`,
          ]
        : [`scope=${hostProcessMemory.scope}: ${hostProcessMemory.note}`],
    },
    {
      id: 'contract-separation',
      summary: 'Partial rows deliberately drop one or more string fields and are not StAX parity rows.',
      evidence: partialRows.map(entry => `${entry.id}: ${entry.contractScope}, strings=${entry.materializationCounters.stringFieldReads}`),
    },
    {
      id: 'full-string-parity',
      summary: 'Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.',
      evidence: fullRows.map(entry => `${entry.id}: events=${entry.eventCount}, checksum=${entry.checksum}`),
    },
    {
      id: 'headroom-search',
      summary: 'The fastest row in each family is a browser headroom signal, not a runtime-limit conclusion.',
      evidence: [
        fastestPartial ? `partial=${fastestPartial.id} ${formatRate(fastestPartial.mibPerSec)}` : 'partial=missing',
        fastestFull ? `full=${fastestFull.id} ${formatRate(fastestFull.mibPerSec)}` : 'full=missing',
      ],
    },
  ];
  if (fixture.source === 'corpus-file') {
    findings.push({
      id: 'corpus-cycle-fixture',
      summary: 'The browser fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.',
      evidence: [
        `sourceFile=${fixture.sourceFile}`,
        `sourceBytes=${fixture.maxRowBytes}`,
        `actualBytes=${fixture.actualBytes}`,
      ],
    });
  }
  return findings;
}

function renderMarkdown(report) {
  const corpusBacked = report.fixture.source === 'corpus-file';
  const lines = [
    '# Browser Candidate Headroom Matrix',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    corpusBacked
      ? 'This experiment is a browser-runtime counterexample search over corpus-backed browser `Uint8Array` batches.'
      : 'This experiment is a browser-runtime counterexample search over generated browser `Uint8Array` batches.',
    'Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.',
    'Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.',
    'Variant memory uses browser JS heap only. Host process-tree memory is reported separately when available and must not be mixed with Node/Bun RSS rows as the same memory proof.',
    '',
    '## Fixture',
    '',
    `- Package: stax-xml ${report.packageVersion}`,
    `- Runtime: ${formatRuntime(report.environment)}`,
    `- Fixture source: ${report.fixture.source}`,
    ...(report.fixture.sourceFile ? [`- Source file: ${report.fixture.sourceFile}`] : []),
    `- Generated size: ${formatBytes(report.fixture.actualBytes)} (${report.fixture.actualBytes} bytes)`,
    `- Fixture shape: ${report.fixture.shape}`,
    `- Row cycle size: ${report.fixture.rowCycleSize}`,
    `- Row bytes: min=${report.fixture.minRowBytes}, max=${report.fixture.maxRowBytes}, avg=${report.fixture.averageRowBytes.toFixed(1)}`,
    `- Batch size: ${report.fixture.batchSize}`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    `- Bounded JS heap reporting gate: ${report.options.boundedJsHeapMiB.toFixed(1)} MiB`,
    '',
    '## Woodstox Target',
    '',
    ...renderWoodstoxTarget(report.woodstoxTarget),
    '',
    '## Results',
    '',
    '| Variant | Family | Contract scope | Throughput | Relative to stringFull | Woodstox ratio | 0.9x target | Bounded JS heap | Counterexample | Events | Checksum | Full parity |',
    '| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | ---: | ---: | --- |',
  ];
  for (const entry of report.variants) {
    lines.push(
      `| ${entry.id} | ${entry.family} | ${entry.contractScope} | ${formatRate(entry.mibPerSec)} | `
      + `${entry.relativeToStringFull.toFixed(2)}x | ${formatOptionalRatio(entry.woodstoxRatio)} | ${entry.targetStatus} | `
      + `${entry.boundedMemory ? 'yes' : 'no'} | ${entry.counterexampleStatus} | ${entry.eventCount} | ${entry.checksum} | `
      + `${entry.fullStringParity ? 'yes' : 'no'} |`,
    );
  }

  lines.push('');
  lines.push('## Memory');
  lines.push('');
  lines.push('Memory uses Chromium `performance.memory` before and after each measured run; max values are the maximum observed run endpoints.');
  lines.push('');
  lines.push('| Variant | Avg used heap delta | Max used heap | Max total heap | JS heap limit |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const entry of report.variants) {
    lines.push(
      `| ${entry.id} | ${formatSignedBytes(entry.memory.avgJsHeapUsedDeltaBytes)} | `
      + `${formatBytes(entry.memory.maxJsHeapUsedBytes)} | ${formatBytes(entry.memory.maxJsHeapTotalBytes)} | `
      + `${formatBytes(entry.memory.jsHeapSizeLimitBytes)} |`,
    );
  }

  lines.push('');
  lines.push('## Host Process Memory');
  lines.push('');
  lines.push(report.hostProcessMemory.note);
  lines.push('');
  lines.push(`- Scope: ${report.hostProcessMemory.scope}`);
  lines.push(`- Max working set: ${formatBytes(report.hostProcessMemory.maxWorkingSetBytes)}`);
  lines.push(`- Max private bytes: ${formatBytes(report.hostProcessMemory.maxPrivateBytes)}`);
  lines.push(`- Max process count: ${report.hostProcessMemory.maxProcessCount ?? 'n/a'}`);
  lines.push('');
  lines.push('| Sample | Scope | Processes | Working set | Private bytes |');
  lines.push('| --- | --- | ---: | ---: | ---: |');
  for (const sample of report.hostProcessMemory.samples) {
    lines.push(
      `| ${sample.label} | ${sample.scope} | ${sample.processCount ?? 'n/a'} | `
      + `${formatBytes(sample.workingSetBytes)} | ${formatBytes(sample.privateBytes)} |`,
    );
  }

  lines.push('');
  lines.push('## Materialization Counters');
  lines.push('');
  lines.push('| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Event objects | Attribute pairs |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const entry of report.variants) {
    const counters = entry.materializationCounters;
    lines.push(
      `| ${entry.id} | ${formatCount(counters.stringFieldReads)} | ${formatCount(counters.nameStringReads)} | `
      + `${formatCount(counters.textStringReads)} | ${formatCount(counters.attrNameStringReads)} | `
      + `${formatCount(counters.attrValueStringReads)} | ${formatCount(counters.rawSpanMaterializations)} | `
      + `${formatCount(counters.rawNameCacheHits)}/${formatCount(counters.rawNameCacheMisses)} | `
      + `${formatCount(counters.eventObjects)} | ${formatCount(counters.attributePairs)} |`,
    );
  }

  lines.push('');
  lines.push('## Omitted Rows');
  lines.push('');
  for (const row of report.omittedRows) {
    lines.push(`- ${row.id}: ${row.reason}`);
  }

  lines.push('');
  lines.push('## Parity');
  lines.push('');
  lines.push(`- Event count parity: ${report.eventCountParity.status}, events=${report.eventCountParity.eventCount}`);
  lines.push(`- Full-string parity rows: ${report.fullStringParity.status}, events=${report.fullStringParity.eventCount}, checksum=${report.fullStringParity.checksum}`);

  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id}: ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function renderWoodstoxTarget(target) {
  if (target.status !== 'ok') {
    return [`- Status: ${target.status}`, `- Path: ${target.path}`];
  }
  return [
    `- Baseline tool: ${target.baselineTool}`,
    `- Woodstox throughput: ${formatNullableRate(target.woodstoxMiBPerSec)}`,
    `- Goal ratio: ${target.goalRatio.toFixed(2)}x`,
    `- Target throughput: ${formatNullableRate(target.targetThroughputMiB)}`,
  ];
}

function formatRuntime(environment) {
  return `${environment.browserName} ${environment.browserVersion}, ${environment.javascriptEngine}, ${environment.userAgent}`;
}

function formatNullableRate(value) {
  return value === null || value === undefined ? 'n/a' : formatRate(value);
}

function formatOptionalRatio(value) {
  return value === null || value === undefined ? 'n/a' : `${value.toFixed(2)}x`;
}

function formatRate(value) {
  return `${value.toFixed(2)} MiB/s`;
}

function formatBytes(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'n/a';
  }
  const abs = Math.abs(value);
  if (abs >= GIB) return `${(value / GIB).toFixed(2)} GiB`;
  if (abs >= MIB) return `${(value / MIB).toFixed(1)} MiB`;
  if (abs >= 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${value.toFixed(0)} B`;
}

function formatSignedBytes(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'n/a';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatBytes(value)}`;
}

function formatCount(value) {
  return value.toLocaleString('en-US');
}

function maxBy(values, selector) {
  let selected;
  for (const value of values) {
    if (!selected || selector(value) > selector(selected)) {
      selected = value;
    }
  }
  return selected;
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function printSummary(report) {
  const fastestPartial = maxBy(report.variants.filter(entry => !entry.fullStringParity), entry => entry.mibPerSec);
  const fastestFull = maxBy(report.variants.filter(entry => entry.fullStringParity), entry => entry.mibPerSec);
  console.log(`Wrote ${report.objective}: ${report.fixture.actualBytes} bytes`);
  console.log(`Fastest partial: ${fastestPartial.id} ${formatRate(fastestPartial.mibPerSec)}`);
  console.log(`Fastest full: ${fastestFull.id} ${formatRate(fastestFull.mibPerSec)}`);
}

function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return candidates.find(candidate => existsSync(candidate));
}

function createRunnerScript(options) {
  const runnerConfig = {
    sizeGiB: options.sizeGiB,
    runs: options.runs,
    warmups: options.warmups,
    fixtureShape: options.fixtureShape,
    diverseCycleSize: options.diverseCycleSize,
    batchSize: options.batchSize,
    sourceFile: options.fixtureShape === 'corpus-cycle' ? options.corpusFile : null,
  };
  return `
import { StreamEventType, StreamReaderSync, XmlEventType } from '/stax/index.js';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
const allStringFields = Object.freeze({
  name: true,
  text: true,
  attrName: true,
  attrValue: true,
});
const config = ${JSON.stringify(runnerConfig)};

globalThis.__staxBrowserBenchmarkResult = runBenchmark().catch(error => ({
  error: {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    stack: error?.stack ?? null,
  },
}));

async function runBenchmark() {
  const fixture = await createFixture(config);
  const variants = createVariants(fixture).map(variant => measureVariant(variant, fixture, config));
  return {
    environment: createRuntimeEnvironment(),
    fixture: createFixtureReport(fixture),
    eventCountParity: computeEventCountParity(variants),
    fullStringParity: computeFullStringParity(variants),
    variants,
  };
}

function createVariants(fixture) {
  return [
    {
      id: 'scanAllNoDecode',
      family: 'partial-upper-bound',
      implementation: 'StreamBatch index accessors over browser byte batches',
      contractScope: 'event-types-and-attribute-counts-only',
      fullStringParity: false,
      run: () => consumeStreamSelective(fixture, { name: false, text: false, attrName: false, attrValue: false }),
    },
    {
      id: 'nameStringOnly',
      family: 'partial-upper-bound',
      implementation: 'StreamBatch index accessors over browser byte batches',
      contractScope: 'event-types-attribute-counts-and-element-names',
      fullStringParity: false,
      run: () => consumeStreamSelective(fixture, { name: true, text: false, attrName: false, attrValue: false }),
    },
    {
      id: 'textStringOnly',
      family: 'partial-upper-bound',
      implementation: 'StreamBatch index accessors over browser byte batches',
      contractScope: 'event-types-attribute-counts-and-text-cdata',
      fullStringParity: false,
      run: () => consumeStreamSelective(fixture, { name: false, text: true, attrName: false, attrValue: false }),
    },
    {
      id: 'attrNameStringOnly',
      family: 'partial-upper-bound',
      implementation: 'StreamBatch index accessors over browser byte batches',
      contractScope: 'event-types-attribute-counts-and-attribute-names',
      fullStringParity: false,
      run: () => consumeStreamSelective(fixture, { name: false, text: false, attrName: true, attrValue: false }),
    },
    {
      id: 'attrValueStringOnly',
      family: 'partial-upper-bound',
      implementation: 'StreamBatch index accessors over browser byte batches',
      contractScope: 'event-types-attribute-counts-and-attribute-values',
      fullStringParity: false,
      run: () => consumeStreamSelective(fixture, { name: false, text: false, attrName: false, attrValue: true }),
    },
    {
      id: 'stringFull',
      family: 'full-stax-js',
      implementation: 'StreamBatch index accessors over browser byte batches',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeStreamSelective(fixture, allStringFields),
    },
    {
      id: 'eventObjectFull',
      family: 'full-stax-js',
      implementation: 'public event objects materialized from browser byte batches',
      contractScope: 'full-event-object-materialization',
      fullStringParity: true,
      run: () => consumeEventObjectFull(fixture),
    },
    {
      id: 'cursorAccessor',
      family: 'full-stax-js',
      implementation: 'single mutable cursor over StreamBatch browser byte batches',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeCursorAccessor(fixture),
    },
    {
      id: 'rawFrameDirect',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with direct span decode',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, undefined),
    },
    {
      id: 'rawFrameNameId',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, []),
    },
  ];
}

async function createFixture(options) {
  const targetBytes = Math.floor(options.sizeGiB * GIB);
  const rows = await createFixtureRows(options.fixtureShape, options.diverseCycleSize);
  const rowStats = summarizeRows(rows);
  const actualBytes = computeExpectedBytes(targetBytes, rows);
  const source = options.fixtureShape === 'corpus-cycle' ? 'corpus-file' : 'generated';
  return {
    source,
    sourceFile: source === 'corpus-file' ? options.sourceFile : null,
    rows,
    rowPreview: textDecoder.decode(rows[0].subarray(0, Math.min(rows[0].byteLength, 512))),
    rowPreviewTruncated: rows[0].byteLength > 512,
    rowStats,
    targetBytes,
    actualBytes,
    sizeGiB: actualBytes / GIB,
    fixtureShape: options.fixtureShape,
    diverseCycleSize: options.diverseCycleSize,
    batchSize: options.batchSize,
  };
}

function createFixtureReport(fixture) {
  return {
    generated: fixture.source === 'generated',
    source: fixture.source,
    sourceFile: fixture.sourceFile,
    shape: fixture.fixtureShape,
    rowXml: fixture.rowPreview,
    rowPreviewTruncated: fixture.rowPreviewTruncated,
    rowCycleSize: fixture.rows.length,
    minRowBytes: fixture.rowStats.minRowBytes,
    maxRowBytes: fixture.rowStats.maxRowBytes,
    averageRowBytes: fixture.rowStats.averageRowBytes,
    targetBytes: fixture.targetBytes,
    actualBytes: fixture.actualBytes,
    sizeGiB: fixture.sizeGiB,
    batchSize: fixture.batchSize,
  };
}

async function createFixtureRows(shape, cycleSize) {
  if (shape === 'repeated-person') {
    return [textEncoder.encode(makeRepeatedPersonRow())];
  }
  if (shape === 'corpus-cycle') {
    const response = await fetch('/corpus');
    if (!response.ok) {
      throw new Error('Failed to fetch corpus fixture: HTTP ' + response.status);
    }
    return [new Uint8Array(await response.arrayBuffer())];
  }
  return Array.from({ length: cycleSize }, (_, id) => textEncoder.encode(makeDiverseRow(id)));
}

function measureVariant(variant, fixture, options) {
  for (let index = 0; index < options.warmups; index++) {
    variant.run();
  }

  const samplesMs = [];
  const memorySamples = [];
  let first;
  for (let index = 0; index < options.runs; index++) {
    forceGc();
    const memoryBefore = takeMemorySnapshot();
    const startedAt = performance.now();
    const result = variant.run();
    const elapsedMs = performance.now() - startedAt;
    const memoryAfter = takeMemorySnapshot();
    if (first && (result.eventCount !== first.eventCount || result.checksum !== first.checksum)) {
      throw new Error(variant.id + ' produced unstable event count or checksum.');
    }
    first ??= result;
    samplesMs.push(elapsedMs);
    memorySamples.push(createMemorySample(memoryBefore, memoryAfter));
  }

  const avgMs = average(samplesMs);
  return {
    id: variant.id,
    family: variant.family,
    implementation: variant.implementation,
    contractScope: variant.contractScope,
    fullStringParity: variant.fullStringParity,
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    mibPerSec: (fixture.actualBytes / MIB) / (avgMs / 1000),
    eventCount: first.eventCount,
    checksum: first.checksum,
    samplesMs,
    memory: summarizeMemorySamples(memorySamples),
    materializationCounters: first.materializationCounters,
  };
}

function takeMemorySnapshot() {
  const memory = performance.memory;
  return {
    scope: 'browser-js-heap',
    jsHeapSizeLimitBytes: typeof memory?.jsHeapSizeLimit === 'number' ? memory.jsHeapSizeLimit : null,
    jsHeapTotalBytes: typeof memory?.totalJSHeapSize === 'number' ? memory.totalJSHeapSize : null,
    jsHeapUsedBytes: typeof memory?.usedJSHeapSize === 'number' ? memory.usedJSHeapSize : null,
  };
}

function createMemorySample(before, after) {
  return {
    before,
    after,
    delta: {
      jsHeapUsedBytes: numericDelta(before.jsHeapUsedBytes, after.jsHeapUsedBytes),
      jsHeapTotalBytes: numericDelta(before.jsHeapTotalBytes, after.jsHeapTotalBytes),
    },
  };
}

function numericDelta(before, after) {
  return typeof before === 'number' && typeof after === 'number' ? after - before : null;
}

function summarizeMemorySamples(samples) {
  const heapUsedValues = samples.flatMap(sample => [sample.before.jsHeapUsedBytes, sample.after.jsHeapUsedBytes]).filter(isFiniteNumber);
  const heapTotalValues = samples.flatMap(sample => [sample.before.jsHeapTotalBytes, sample.after.jsHeapTotalBytes]).filter(isFiniteNumber);
  const heapLimitValues = samples.flatMap(sample => [sample.before.jsHeapSizeLimitBytes, sample.after.jsHeapSizeLimitBytes]).filter(isFiniteNumber);
  return {
    scope: 'browser-js-heap',
    avgJsHeapUsedDeltaBytes: averageNullable(samples.map(sample => sample.delta.jsHeapUsedBytes)),
    avgJsHeapTotalDeltaBytes: averageNullable(samples.map(sample => sample.delta.jsHeapTotalBytes)),
    maxJsHeapUsedBytes: heapUsedValues.length > 0 ? Math.max(...heapUsedValues) : null,
    maxJsHeapTotalBytes: heapTotalValues.length > 0 ? Math.max(...heapTotalValues) : null,
    jsHeapSizeLimitBytes: heapLimitValues.length > 0 ? Math.max(...heapLimitValues) : null,
    samples,
  };
}

function createRuntimeEnvironment() {
  const userAgent = navigator.userAgent;
  const browserVersion = parseBrowserVersion(userAgent);
  return {
    runtimeName: 'browser',
    javascriptEngine: 'V8',
    browserName: browserVersion.name,
    browserVersion: browserVersion.version,
    userAgent,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    gcStrategy: typeof globalThis.gc === 'function' ? 'window.gc' : 'unavailable',
  };
}

function parseBrowserVersion(userAgent) {
  const edge = userAgent.match(/Edg\\/([^\\s]+)/);
  if (edge) return { name: 'Edge', version: edge[1] };
  const chrome = userAgent.match(/Chrome\\/([^\\s]+)/);
  if (chrome) return { name: 'Chrome', version: chrome[1] };
  return { name: 'unknown', version: 'unknown' };
}

function forceGc() {
  if (typeof globalThis.gc === 'function') {
    globalThis.gc();
    globalThis.gc();
  }
}

function computeEventCountParity(variants) {
  const first = variants[0];
  const mismatch = variants.find(entry => entry.eventCount !== first.eventCount);
  if (mismatch) {
    throw new Error('Variant ' + mismatch.id + ' does not match ' + first.id + ' event count.');
  }
  return {
    status: 'ok',
    eventCount: first.eventCount,
  };
}

function computeFullStringParity(variants) {
  const fullRows = variants.filter(entry => entry.fullStringParity);
  const first = fullRows[0];
  const mismatch = fullRows.find(entry => entry.eventCount !== first.eventCount || entry.checksum !== first.checksum);
  if (mismatch) {
    throw new Error('Full-string variant ' + mismatch.id + ' does not match ' + first.id + '.');
  }
  return {
    status: 'ok',
    rowIds: fullRows.map(entry => entry.id),
    eventCount: first.eventCount,
    checksum: first.checksum,
  };
}

function consumeStreamSelective(fixture, fields) {
  const materializationCounters = createMaterializationCounters();
  let eventCount = 0;
  let checksum = 0;

  for (const batch of new StreamReaderSync(byteBatches(fixture))) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const type = batch.typeAt(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);

      if (fields.name && (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT)) {
        countStringField(materializationCounters, 'name');
        checksum = foldString(checksum, batch.nameAt(index));
      }
      if (fields.text && (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA)) {
        countStringField(materializationCounters, 'text');
        checksum = foldString(checksum, batch.textAt(index)?.trim());
      }
      if (type === StreamEventType.START_ELEMENT) {
        const attrCount = batch.attributeCountAt(index);
        materializationCounters.attributePairs += attrCount;
        checksum = mixChecksum(checksum, attrCount);
        if (!fields.attrName && !fields.attrValue) {
          continue;
        }
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          if (fields.attrName) {
            countStringField(materializationCounters, 'attrName');
            checksum = foldString(checksum, batch.attributeNameAt(index, attrIndex));
          }
          if (fields.attrValue) {
            countStringField(materializationCounters, 'attrValue');
            checksum = foldString(checksum, batch.attributeValueAt(index, attrIndex));
          }
        }
      }
    }
  }

  return { eventCount, checksum, materializationCounters };
}

function consumeCursorAccessor(fixture) {
  const materializationCounters = createMaterializationCounters();
  const cursor = new BatchCursor();
  let eventCount = 0;
  let checksum = 0;

  for (const batch of new StreamReaderSync(byteBatches(fixture))) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      cursor.set(batch, index);
      const type = cursor.type();
      eventCount++;
      checksum = mixChecksum(checksum, type);

      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        countStringField(materializationCounters, 'name');
        checksum = foldString(checksum, cursor.name());
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        countStringField(materializationCounters, 'text');
        checksum = foldString(checksum, cursor.text()?.trim());
      }
      if (type === StreamEventType.START_ELEMENT) {
        const attrCount = cursor.getAttributeCount();
        materializationCounters.attributePairs += attrCount;
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          countStringField(materializationCounters, 'attrName');
          checksum = foldString(checksum, cursor.getAttributeName(attrIndex));
          countStringField(materializationCounters, 'attrValue');
          checksum = foldString(checksum, cursor.getAttributeValue(attrIndex));
        }
      }
    }
  }

  return { eventCount, checksum, materializationCounters };
}

function consumeEventObjectFull(fixture) {
  const materializationCounters = createMaterializationCounters();
  const objectSink = new Array(1024);
  let objectSinkIndex = 0;
  let eventCount = 0;
  let checksum = 0;

  for (const batch of new StreamReaderSync(byteBatches(fixture))) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const event = materializePublicEventObject(batch, index, materializationCounters);
      objectSink[objectSinkIndex & (objectSink.length - 1)] = event;
      objectSinkIndex++;

      eventCount++;
      checksum = mixChecksum(checksum, publicEventTypeCode(event.type));

      if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
        checksum = foldString(checksum, event.name);
      }
      if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
        checksum = foldString(checksum, event.value?.trim());
      }
      if (event.type === XmlEventType.START_ELEMENT) {
        const entries = Object.entries(event.attributes);
        materializationCounters.attributePairs += entries.length;
        checksum = mixChecksum(checksum, entries.length);
        for (const [name, value] of entries) {
          checksum = foldString(checksum, name);
          checksum = foldString(checksum, value);
        }
      }
    }
  }

  globalThis.__staxBrowserCandidateEventObjectSink = objectSink[(objectSinkIndex - 1) & (objectSink.length - 1)];
  return { eventCount, checksum, materializationCounters };
}

function materializePublicEventObject(batch, index, materializationCounters) {
  const type = batch.typeAt(index);
  materializationCounters.eventObjects++;
  switch (type) {
    case StreamEventType.START_DOCUMENT:
      return { type: XmlEventType.START_DOCUMENT };
    case StreamEventType.END_DOCUMENT:
      return { type: XmlEventType.END_DOCUMENT };
    case StreamEventType.START_ELEMENT: {
      countStringField(materializationCounters, 'name');
      const name = batch.nameAt(index);
      const attrCount = batch.attributeCountAt(index);
      const attributes = {};
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        countStringField(materializationCounters, 'attrName');
        const attrName = batch.attributeNameAt(index, attrIndex);
        countStringField(materializationCounters, 'attrValue');
        attributes[attrName] = batch.attributeValueAt(index, attrIndex);
      }
      return {
        type: XmlEventType.START_ELEMENT,
        name,
        attributes,
      };
    }
    case StreamEventType.END_ELEMENT:
      countStringField(materializationCounters, 'name');
      return {
        type: XmlEventType.END_ELEMENT,
        name: batch.nameAt(index),
      };
    case StreamEventType.CHARACTERS:
      countStringField(materializationCounters, 'text');
      return {
        type: XmlEventType.CHARACTERS,
        value: batch.textAt(index),
      };
    case StreamEventType.CDATA:
      countStringField(materializationCounters, 'text');
      return {
        type: XmlEventType.CDATA,
        value: batch.textAt(index),
      };
    default:
      throw new Error('Unsupported stream event type: ' + type);
  }
}

function publicEventTypeCode(type) {
  switch (type) {
    case XmlEventType.START_DOCUMENT:
      return StreamEventType.START_DOCUMENT;
    case XmlEventType.END_DOCUMENT:
      return StreamEventType.END_DOCUMENT;
    case XmlEventType.START_ELEMENT:
      return StreamEventType.START_ELEMENT;
    case XmlEventType.END_ELEMENT:
      return StreamEventType.END_ELEMENT;
    case XmlEventType.CHARACTERS:
      return StreamEventType.CHARACTERS;
    case XmlEventType.CDATA:
      return StreamEventType.CDATA;
    default:
      throw new Error('Unsupported public event type: ' + type);
  }
}

class BatchCursor {
  batch;
  index = 0;

  set(batch, index) {
    this.batch = batch;
    this.index = index;
  }

  type() {
    return this.batch.typeAt(this.index);
  }

  name() {
    return this.batch.nameAt(this.index);
  }

  text() {
    return this.batch.textAt(this.index);
  }

  getAttributeCount() {
    return this.batch.attributeCountAt(this.index);
  }

  getAttributeName(attrIndex) {
    return this.batch.attributeNameAt(this.index, attrIndex);
  }

  getAttributeValue(attrIndex) {
    return this.batch.attributeValueAt(this.index, attrIndex);
  }
}

function consumeRawFrameStyle(fixture, nameCache) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const parser = new StreamReaderSync(byteBatches(fixture));
  const materializationCounters = createMaterializationCounters();
  let eventCount = 0;
  let checksum = 0;
  let frame;

  while ((frame = parser.nextRawBatch()) !== null) {
    const result = consumeRawFrame(frame, checksum, eventCount, decoder, nameCache, materializationCounters);
    checksum = result.checksum;
    eventCount = result.eventCount;
  }

  return { eventCount, checksum, materializationCounters };
}

function consumeRawFrame(frame, checksum, eventCount, decoder, nameCache, materializationCounters) {
  if (frame.kind !== 'frame') {
    throw new Error('Unsupported raw batch kind in browser candidate matrix: ' + frame.kind);
  }

  const eventTypes = frame.eventTypes;
  const nameStarts = frame.nameStarts;
  const nameEnds = frame.nameEnds;
  const nameIds = frame.nameIds;
  const textStarts = frame.textStarts;
  const textEnds = frame.textEnds;
  const attrStarts = frame.attrStarts;
  const attrCounts = frame.attrCounts;
  const attrNameStarts = frame.attrNameStarts;
  const attrNameEnds = frame.attrNameEnds;
  const attrNameIds = frame.attrNameIds;
  const attrValueStarts = frame.attrValueStarts;
  const attrValueEnds = frame.attrValueEnds;
  const buffer = frame.buffer;
  const count = frame.eventCount;

  for (let index = 0; index < count; index++) {
    const type = eventTypes[index];
    eventCount++;
    checksum = mixChecksum(checksum, type);

    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      countStringField(materializationCounters, 'name');
      checksum = foldString(
        checksum,
        materializeName(buffer, nameStarts[index], nameEnds[index], nameIds[index], decoder, nameCache, materializationCounters, 'name'),
      );
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      const start = textStarts[index];
      if (start >= 0) {
        countStringField(materializationCounters, 'text');
        checksum = foldString(checksum, decodeSpan(buffer, start, textEnds[index], decoder, materializationCounters, 'text').trim());
      }
    }
    if (type === StreamEventType.START_ELEMENT) {
      const attrStart = attrStarts[index];
      const attrCount = attrCounts[index];
      materializationCounters.attributePairs += attrCount;
      checksum = mixChecksum(checksum, attrCount);
      const attrEnd = attrStart + attrCount;
      for (let attrIndex = attrStart; attrIndex < attrEnd; attrIndex++) {
        countStringField(materializationCounters, 'attrName');
        checksum = foldString(
          checksum,
          materializeName(
            buffer,
            attrNameStarts[attrIndex],
            attrNameEnds[attrIndex],
            attrNameIds[attrIndex],
            decoder,
            nameCache,
            materializationCounters,
            'attrName',
          ),
        );
        countStringField(materializationCounters, 'attrValue');
        const value = isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, attrIndex)
          ? countImplicitAttributeValue(materializationCounters)
          : decodeSpan(buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex], decoder, materializationCounters, 'attrValue');
        checksum = foldString(checksum, value);
      }
    }
  }

  return { eventCount, checksum };
}

function materializeName(buffer, start, end, nameId, decoder, nameCache, materializationCounters, kind) {
  if (nameId < 0 || start < 0) {
    return undefined;
  }
  if (nameCache) {
    const cached = nameCache[nameId];
    if (cached !== undefined) {
      materializationCounters.rawNameCacheHits++;
      return cached;
    }
    materializationCounters.rawNameCacheMisses++;
    const value = decodeSpan(buffer, start, end, decoder, materializationCounters, kind);
    nameCache[nameId] = value;
    return value;
  }
  return decodeSpan(buffer, start, end, decoder, materializationCounters, kind);
}

function decodeSpan(buffer, start, end, decoder, materializationCounters, kind) {
  countRawSpanMaterialization(materializationCounters, kind);
  const ascii = decodeShortAsciiSpan(buffer, start, end);
  return ascii ?? decoder.decode(buffer.subarray(start, end));
}

function decodeShortAsciiSpan(buffer, start, end) {
  switch (end - start) {
    case 0:
      return '';
    case 1: {
      const b0 = buffer[start];
      return b0 <= 0x7f ? String.fromCharCode(b0) : undefined;
    }
    case 2: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      return (b0 | b1) <= 0x7f ? String.fromCharCode(b0, b1) : undefined;
    }
    case 3: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      return (b0 | b1 | b2) <= 0x7f ? String.fromCharCode(b0, b1, b2) : undefined;
    }
    case 4: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      return (b0 | b1 | b2 | b3) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3) : undefined;
    }
    case 5: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      return (b0 | b1 | b2 | b3 | b4) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4) : undefined;
    }
    case 6: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      return (b0 | b1 | b2 | b3 | b4 | b5) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5) : undefined;
    }
    case 7: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6) : undefined;
    }
    case 8: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7)
        : undefined;
    }
    case 9: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8)
        : undefined;
    }
    case 10: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      const b9 = buffer[start + 9];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9)
        : undefined;
    }
    case 11: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      const b9 = buffer[start + 9];
      const b10 = buffer[start + 10];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10)
        : undefined;
    }
    case 12: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      const b9 = buffer[start + 9];
      const b10 = buffer[start + 10];
      const b11 = buffer[start + 11];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11)
        : undefined;
    }
    default:
      return undefined;
  }
}

function isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, index) {
  return attrNameStarts[index] === attrValueStarts[index] && attrNameEnds[index] === attrValueEnds[index];
}

function createMaterializationCounters() {
  return {
    stringFieldReads: 0,
    nameStringReads: 0,
    textStringReads: 0,
    attrNameStringReads: 0,
    attrValueStringReads: 0,
    rawSpanMaterializations: 0,
    rawNameSpanMaterializations: 0,
    rawTextSpanMaterializations: 0,
    rawAttrNameSpanMaterializations: 0,
    rawAttrValueSpanMaterializations: 0,
    rawNameCacheHits: 0,
    rawNameCacheMisses: 0,
    implicitAttrValueReads: 0,
    eventObjects: 0,
    attributePairs: 0,
  };
}

function countStringField(counters, kind) {
  counters.stringFieldReads++;
  switch (kind) {
    case 'name':
      counters.nameStringReads++;
      break;
    case 'text':
      counters.textStringReads++;
      break;
    case 'attrName':
      counters.attrNameStringReads++;
      break;
    case 'attrValue':
      counters.attrValueStringReads++;
      break;
    default:
      throw new Error('Unknown string field kind: ' + kind);
  }
}

function countRawSpanMaterialization(counters, kind) {
  counters.rawSpanMaterializations++;
  switch (kind) {
    case 'name':
      counters.rawNameSpanMaterializations++;
      break;
    case 'text':
      counters.rawTextSpanMaterializations++;
      break;
    case 'attrName':
      counters.rawAttrNameSpanMaterializations++;
      break;
    case 'attrValue':
      counters.rawAttrValueSpanMaterializations++;
      break;
    default:
      throw new Error('Unknown raw span kind: ' + kind);
  }
}

function countImplicitAttributeValue(counters) {
  counters.implicitAttrValueReads++;
  return 'true';
}

function* byteBatches(fixture) {
  let emittedBytes = 0;
  let rowIndex = 0;
  while (emittedBytes < fixture.targetBytes) {
    const batch = [];
    for (let index = 0; index < fixture.batchSize && emittedBytes < fixture.targetBytes; index++) {
      const nextRow = fixture.rows[rowIndex % fixture.rows.length];
      batch.push(nextRow);
      emittedBytes += nextRow.byteLength;
      rowIndex++;
    }
    yield batch;
  }
}

function makeRepeatedPersonRow() {
  return '<person id="123"><name>Jane Doe</name><age>42</age></person>';
}

function makeDiverseRow(id) {
  const rootNames = ['person', 'record', 'entry', 'invoice', 'profile', 'asset', 'sample'];
  const childNames = ['name', 'title', 'summary', 'note', 'group', 'bucket', 'payload'];
  const rootName = rootNames[id % rootNames.length] + (id % 257);
  const childA = childNames[id % childNames.length] + ((id * 3) % 193);
  const childB = childNames[(id + 2) % childNames.length] + ((id * 5) % 197);
  const childC = childNames[(id + 4) % childNames.length] + ((id * 7) % 199);
  const attrA = 'data' + (id % 997);
  const attrB = 'code' + ((id * 11) % 991);
  const attrC = 'flag' + ((id * 17) % 983);
  const utf8Text = id % 11 === 0
    ? ' ' + String.fromCodePoint(0x2603) + '-' + id + '-' + String.fromCodePoint(0x1f642)
    : '';

  return '<' + rootName + ' id="item-' + id + '" ' + attrA + '="value-' + ((id * 31) % 65521) + '" ' + attrB + '="group-' + (id % 4093) + '" ' + attrC + '="' + (id % 2 === 0 ? 'true' : 'false') + '">'
    + '<' + childA + '>Runtime Benchmark ' + id + utf8Text + '</' + childA + '>'
    + '<' + childB + ' rank="' + (id % 29) + '">Full string checksum payload ' + ((id * 8191) % 104729) + '</' + childB + '>'
    + '<' + childC + ' shard="' + (id % 37) + '" bucket="' + ((id * 19) % 389) + '">Text ' + id + ' ' + ((id * id) % 99991) + '</' + childC + '>'
    + '</' + rootName + '>';
}

function summarizeRows(rowList) {
  const rowBytes = rowList.map(entry => entry.byteLength);
  return {
    minRowBytes: Math.min(...rowBytes),
    maxRowBytes: Math.max(...rowBytes),
    averageRowBytes: average(rowBytes),
  };
}

function computeExpectedBytes(targetBytes, rowList) {
  const cycleBytes = rowList.reduce((sum, entry) => sum + entry.byteLength, 0);
  let emittedBytes = Math.floor(targetBytes / cycleBytes) * cycleBytes;
  let rowIndex = 0;
  while (emittedBytes < targetBytes) {
    emittedBytes += rowList[rowIndex % rowList.length].byteLength;
    rowIndex++;
  }
  return emittedBytes;
}

function mixChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function foldString(seed, value) {
  if (!value) {
    return seed;
  }
  let next = seed;
  for (let index = 0; index < value.length; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageNullable(values) {
  const numbers = values.filter(isFiniteNumber);
  return numbers.length > 0 ? average(numbers) : null;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
`;
}

await main();
