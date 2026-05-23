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
const defaultCorpusFile = resolve(__dirname, '../stax-xml/performance/samples/treebank_e.xml');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'browser-textdecoder-span-variants.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'browser-textdecoder-span-variants.md');
const distDir = resolve(__dirname, '../stax-xml/dist');
const distIndexPath = resolve(distDir, 'index.js');

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
  const userDataDir = mkdtempSync(join(tmpdir(), 'stax-browser-textdecoder-'));
  try {
    browserPort = await reservePort();
    browser = launchBrowser(options, browserPort, userDataDir);
    await waitForBrowser(browserPort, options.browserTimeoutMs, browser);
    hostProcessMemorySamples.push(collectHostProcessMemorySample(browser.pid, 'browser-started', options));
    const target = await openPage(browserPort, 'about:blank');
    targetId = target.id;
    client = await CdpClient.connect(target.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    hostProcessMemorySamples.push(collectHostProcessMemorySample(browser.pid, 'before-run', options));
    await client.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/runner.html` });
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
  const html = '<!doctype html><meta charset="utf-8"><title>stax browser TextDecoder spans</title><script type="module" src="/runner.js"></script>';
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
    if (url.pathname.startsWith('/stax/') && url.pathname.endsWith('.js')) {
      const fileName = url.pathname.slice('/stax/'.length);
      if (!fileName.includes('/') && !fileName.includes('\\')) {
        const filePath = resolve(distDir, fileName);
        if (existsSync(filePath)) {
          sendFile(response, filePath, 'text/javascript; charset=utf-8');
          return;
        }
      }
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
      if (response.ok) return;
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
  await fetch(`http://127.0.0.1:${port}/json/close/${encodeURIComponent(targetId)}`);
}

async function terminateBrowser(browser) {
  if (!browser || browser.exitCode !== null) return;
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
    // Chrome profile cleanup can race with Windows file handles.
  }
}

async function evaluateRunner(client, timeoutMs) {
  const expression = `
    new Promise((resolve) => {
      const startedAt = performance.now();
      const tick = () => {
        if (globalThis.__staxBrowserTextDecoderResult) {
          Promise.resolve(globalThis.__staxBrowserTextDecoderResult).then(resolve, (error) => {
            resolve({ error: { name: error?.name ?? 'Error', message: error?.message ?? String(error), stack: error?.stack ?? null } });
          });
          return;
        }
        if (performance.now() - startedAt > ${JSON.stringify(timeoutMs - 1000)}) {
          resolve({ error: { name: 'TimeoutError', message: 'Timed out waiting for browser TextDecoder benchmark runner.', stack: null } });
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
        if (waiters.length === 0) this.eventWaiters.delete(message.method);
      }
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) return;
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
    return { label, at, scope: 'disabled', reason: 'Host process memory collection was disabled with --no-host-process-memory.' };
  }
  if (process.platform !== 'win32') {
    return { label, at, scope: 'unsupported', reason: 'Host process-tree memory collection is currently implemented only for Windows.' };
  }
  if (!Number.isInteger(rootPid) || rootPid <= 0) {
    return { label, at, scope: 'unavailable', error: `Invalid browser root pid: ${rootPid}` };
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
} | ConvertTo-Json -Depth 3 -Compress
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
    };
  } catch (error) {
    return { label, at, scope: 'unavailable', error: `Could not parse host process memory sample: ${error.message}` };
  }
}

function summarizeHostProcessMemory(samples, options) {
  if (!options.collectHostProcessMemory) {
    return { scope: 'disabled', note: 'Host process memory collection was disabled.', samples, maxWorkingSetBytes: null, maxPrivateBytes: null, maxProcessCount: null };
  }
  if (process.platform !== 'win32') {
    return { scope: 'unsupported', note: 'Host process-tree memory collection is currently implemented only for Windows.', samples, maxWorkingSetBytes: null, maxPrivateBytes: null, maxProcessCount: null };
  }
  const usableSamples = samples.filter(sample => sample.scope === 'windows-process-tree');
  if (usableSamples.length === 0) {
    return { scope: 'unavailable', note: 'Windows host process-tree memory collection failed for every sample.', samples, maxWorkingSetBytes: null, maxPrivateBytes: null, maxProcessCount: null };
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
  const boundedJsHeapBytes = options.boundedJsHeapMiB * MIB;
  const variants = browserResult.variants.map(entry => {
    const boundedMemory = typeof entry.memory.maxJsHeapUsedBytes === 'number'
      ? entry.memory.maxJsHeapUsedBytes <= boundedJsHeapBytes
      : false;
    const counterexampleEligible = entry.fullStringParity && browserResult.fixture.actualBytes >= GIB && boundedMemory;
    return {
      ...entry,
      boundedMemory,
      runtimeLimitCounterexampleEligible: counterexampleEligible && entry.mibPerSec >= 200,
      counterexampleStatus: counterexampleEligible && entry.mibPerSec >= 200 ? 'found' : 'not-found',
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    objective: 'browser-textdecoder-span-variants',
    contract: 'browser-full-string-textdecoder-span-variant-headroom',
    note: 'Compares browser-compatible TextDecoder span materialization variants under the same full-string checksum contract. Variant memory is browser JS heap; host process-tree memory is separate.',
    packageVersion,
    environment: {
      ...browserResult.environment,
      cpuName: cpus()[0]?.model ?? 'unknown',
      hostPlatform: `${process.platform}-${process.arch}`,
      browserExecutable: options.browserExecutable,
    },
    fixture: browserResult.fixture,
    options: {
      sizeGiB: options.sizeGiB,
      runs: options.runs,
      warmups: options.warmups,
      boundedJsHeapMiB: options.boundedJsHeapMiB,
    },
    hostProcessMemory,
    eventCountParity: browserResult.eventCountParity,
    fullStringParity: browserResult.fullStringParity,
    variants,
    findings: createFindings(browserResult.fixture, variants, hostProcessMemory),
  };
}

function createFindings(fixture, variants, hostProcessMemory) {
  const fastest = maxBy(variants, entry => entry.mibPerSec);
  const counterexamples = variants.filter(entry => entry.runtimeLimitCounterexampleEligible);
  const findings = [
    {
      id: 'same-full-string-contract',
      status: 'BENCH_FACT',
      summary: 'All browser TextDecoder variants fold event type, names, text/CDATA, attribute names, and attribute values into the same checksum.',
    },
    {
      id: 'browser-textdecoder-variants-are-headroom-search',
      status: 'BENCH_FACT',
      summary: `Fastest browser row in this run was ${fastest.id} at ${formatRate(fastest.mibPerSec)}; this is a decode-span headroom search, not an impossibility proof.`,
    },
    {
      id: 'browser-memory-scope',
      status: 'BENCH_FACT',
      summary: `Variant memory is browser JS heap only; host process memory is separate (${hostProcessMemory.scope}).`,
    },
    {
      id: 'runtime-limit-still-unproven',
      status: counterexamples.length > 0 ? 'COUNTEREXAMPLE' : 'HYPOTHESIS',
      summary: counterexamples.length > 0
        ? `Found 200 MiB/s+ bounded-memory 1 GiB+ full-string browser row(s): ${counterexamples.map(entry => entry.id).join(', ')}.`
        : 'No 200 MiB/s+ bounded-memory 1 GiB+ full-string browser row was found in this matrix, but absence in this matrix is not a proof that JavaScript runtimes have no further headroom.',
    },
    {
      id: 'no-buffer-native-or-lazy-getter-path',
      status: 'SOURCE_FACT',
      summary: 'Rows use browser Uint8Array plus TextDecoder only; they do not use Node Buffer.toString(), native addons, or lazy getters.',
    },
    {
      id: 'fixture-scope',
      status: 'BENCH_FACT',
      summary: `Fixture is ${fixture.source === 'generated' ? 'generated' : 'corpus-backed'} ${formatBytes(fixture.actualBytes)} ${fixture.shape}; broaden browser engines and corpus coverage before drawing global conclusions.`,
    },
  ];
  if (fixture.source === 'corpus-file') {
    findings.push({
      id: 'corpus-cycle-fixture',
      status: 'BENCH_FACT',
      summary: 'The browser fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.',
    });
  }
  return findings;
}

function renderMarkdown(report) {
  const fastest = maxBy(report.variants, entry => entry.mibPerSec);
  const corpusBacked = report.fixture.source === 'corpus-file';
  const lines = [
    '# Browser TextDecoder Span Variant Matrix',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    corpusBacked
      ? 'This experiment compares browser-compatible `Uint8Array` + `TextDecoder` span materialization variants over corpus-backed browser `Uint8Array` batches under the same full-string checksum contract.'
      : 'This experiment compares browser-compatible `Uint8Array` + `TextDecoder` span materialization variants under the same full-string checksum contract.',
    'Every row folds event type, element names, text/CDATA, attribute names, and attribute values.',
    'It does not use Node `Buffer.toString()`, does not use native addons, and does not use lazy getters.',
    'Variant memory uses browser JS heap. Host process-tree memory is reported separately when available.',
    'It is a counterexample search, not a proof that JavaScript runtimes have no further headroom.',
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
    `- Batch size: ${report.fixture.batchSize}`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    `- Bounded JS heap reporting gate: ${report.options.boundedJsHeapMiB.toFixed(1)} MiB`,
    '',
    '## Results',
    '',
    '| Variant | Span view | Decoder lifetime | Copy span bytes | Manual short ASCII | Throughput | Bounded JS heap | Counterexample | Events | Checksum |',
    '| --- | --- | --- | --- | --- | ---: | --- | --- | ---: | ---: |',
  ];
  for (const entry of report.variants) {
    lines.push(
      `| ${entry.id} | ${entry.decodeStrategy.spanView} | ${entry.decodeStrategy.decoderLifetime} | `
      + `${entry.decodeStrategy.copiesSpanBytes ? 'yes' : 'no'} | ${entry.decodeStrategy.manualShortAscii ? 'yes' : 'no'} | `
      + `${formatRate(entry.mibPerSec)} | ${entry.boundedMemory ? 'yes' : 'no'} | ${entry.counterexampleStatus} | `
      + `${entry.eventCount} | ${entry.checksum} |`,
    );
  }

  lines.push('');
  lines.push('## Parity');
  lines.push('');
  lines.push(`- Full-string parity rows: ${report.fullStringParity.status}`);
  lines.push(`- Event count parity rows: ${report.eventCountParity.status}`);
  lines.push(`- Shared events: ${report.fullStringParity.eventCount}`);
  lines.push(`- Shared checksum: ${report.fullStringParity.checksum}`);
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
  lines.push('## Materialization Counters');
  lines.push('');
  lines.push('| Variant | String fields | Raw spans | TextDecoder calls | New TextDecoder instances | Short ASCII hits | Copied spans | Copied bytes | Attribute pairs |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const entry of report.variants) {
    const counters = entry.materializationCounters;
    lines.push(
      `| ${entry.id} | ${formatCount(counters.stringFieldReads)} | ${formatCount(counters.rawSpanMaterializations)} | `
      + `${formatCount(counters.textDecoderCalls)} | ${formatCount(counters.textDecoderInstances)} | `
      + `${formatCount(counters.shortAsciiHits)} | ${formatCount(counters.copiedSpans)} | `
      + `${formatBytes(counters.copiedSpanBytes)} | ${formatCount(counters.attributePairs)} |`,
    );
  }

  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.status}): ${finding.summary}`);
  }
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  lines.push(`- Fastest row: ${fastest.id} at ${formatRate(fastest.mibPerSec)}.`);
  lines.push('- A slow row only rejects that decode strategy under this browser build and fixture; it does not reject all JS runtime headroom.');
  lines.push('- Browser JS heap and host process-tree memory are different counters and must not be mixed as a single RSS proof.');

  return `${lines.join('\n')}\n`;
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
import { StreamEventType, StreamReaderSync } from '/stax/index.js';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const textEncoder = new TextEncoder();
const previewDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
const config = ${JSON.stringify(runnerConfig)};

globalThis.__staxBrowserTextDecoderResult = runBenchmark().catch(error => ({
  error: {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    stack: error?.stack ?? null,
  },
}));

async function runBenchmark() {
  const fixture = await createFixture(config);
  const variants = createVariants().map(variant => measureVariant(variant, fixture, config));
  return {
    environment: createRuntimeEnvironment(),
    fixture: createFixtureReport(fixture),
    eventCountParity: computeEventCountParity(variants),
    fullStringParity: computeFullStringParity(variants),
    variants,
  };
}

function createVariants() {
  return [
    {
      id: 'subarraySharedDecoder',
      implementation: 'shared TextDecoder over buffer.subarray(start, end)',
      decodeStrategy: { spanView: 'Uint8Array.subarray', decoderLifetime: 'per-run-shared', copiesSpanBytes: false, manualShortAscii: false },
      createState: () => ({ decoder: new TextDecoder('utf-8', { ignoreBOM: true }) }),
      decode: (buffer, start, end, state, counters) => {
        counters.textDecoderCalls++;
        return state.decoder.decode(buffer.subarray(start, end));
      },
    },
    {
      id: 'viewSharedDecoder',
      implementation: 'shared TextDecoder over new Uint8Array(buffer, offset, length)',
      decodeStrategy: { spanView: 'Uint8Array constructor view', decoderLifetime: 'per-run-shared', copiesSpanBytes: false, manualShortAscii: false },
      createState: () => ({ decoder: new TextDecoder('utf-8', { ignoreBOM: true }) }),
      decode: (buffer, start, end, state, counters) => {
        counters.textDecoderCalls++;
        return state.decoder.decode(new Uint8Array(buffer.buffer, buffer.byteOffset + start, end - start));
      },
    },
    {
      id: 'sliceCopySharedDecoder',
      implementation: 'shared TextDecoder over copied Uint8Array span',
      decodeStrategy: { spanView: 'Uint8Array copy', decoderLifetime: 'per-run-shared', copiesSpanBytes: true, manualShortAscii: false },
      createState: () => ({ decoder: new TextDecoder('utf-8', { ignoreBOM: true }) }),
      decode: (buffer, start, end, state, counters) => {
        counters.textDecoderCalls++;
        counters.copiedSpans++;
        counters.copiedSpanBytes += end - start;
        return state.decoder.decode(new Uint8Array(buffer.subarray(start, end)));
      },
    },
    {
      id: 'subarrayNewDecoder',
      implementation: 'new TextDecoder for each buffer.subarray(start, end)',
      decodeStrategy: { spanView: 'Uint8Array.subarray', decoderLifetime: 'per-span-new', copiesSpanBytes: false, manualShortAscii: false },
      createState: () => ({}),
      decode: (buffer, start, end, _state, counters) => {
        counters.textDecoderCalls++;
        counters.textDecoderInstances++;
        return new TextDecoder('utf-8', { ignoreBOM: true }).decode(buffer.subarray(start, end));
      },
    },
    {
      id: 'shortAsciiSubarraySharedDecoder',
      implementation: 'short ASCII fast path, then shared TextDecoder over buffer.subarray(start, end)',
      decodeStrategy: { spanView: 'Uint8Array.subarray', decoderLifetime: 'per-run-shared', copiesSpanBytes: false, manualShortAscii: true },
      createState: () => ({ decoder: new TextDecoder('utf-8', { ignoreBOM: true }) }),
      decode: (buffer, start, end, state, counters) => {
        const ascii = decodeShortAsciiSpan(buffer, start, end);
        if (ascii !== undefined) {
          counters.shortAsciiHits++;
          return ascii;
        }
        counters.textDecoderCalls++;
        return state.decoder.decode(buffer.subarray(start, end));
      },
    },
  ].map(variant => ({
    ...variant,
    family: 'full-stax-js',
    contractScope: 'full-string-materialization',
    fullStringParity: true,
    decodeStrategy: {
      ...variant.decodeStrategy,
      usesTextDecoder: true,
      nodeBufferSpecific: false,
      nativeAddon: false,
      lazyGetter: false,
    },
  }));
}

function measureVariant(variant, fixture, options) {
  for (let index = 0; index < options.warmups; index++) {
    consumeVariant(variant, fixture);
  }
  const samplesMs = [];
  const memorySamples = [];
  let first;
  for (let index = 0; index < options.runs; index++) {
    forceGc();
    const memoryBefore = takeMemorySnapshot();
    const startedAt = performance.now();
    const result = consumeVariant(variant, fixture);
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
    eventCountKind: 'stream-events',
    fullStringParity: variant.fullStringParity,
    decodeStrategy: variant.decodeStrategy,
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

function consumeVariant(variant, fixture) {
  const state = variant.createState();
  const parser = new StreamReaderSync(byteBatches(fixture));
  const materializationCounters = createMaterializationCounters();
  let eventCount = 0;
  let checksum = 0;
  let frame;
  while ((frame = parser.nextRawBatch()) !== null) {
    const result = consumeRawFrame(frame, checksum, eventCount, variant, state, materializationCounters);
    checksum = result.checksum;
    eventCount = result.eventCount;
  }
  return { eventCount, checksum, materializationCounters };
}

function consumeRawFrame(frame, checksum, eventCount, variant, state, counters) {
  if (frame.kind !== 'frame') {
    throw new Error('Unsupported raw batch kind in browser TextDecoder matrix: ' + frame.kind);
  }
  const eventTypes = frame.eventTypes;
  const nameStarts = frame.nameStarts;
  const nameEnds = frame.nameEnds;
  const textStarts = frame.textStarts;
  const textEnds = frame.textEnds;
  const attrStarts = frame.attrStarts;
  const attrCounts = frame.attrCounts;
  const attrNameStarts = frame.attrNameStarts;
  const attrNameEnds = frame.attrNameEnds;
  const attrValueStarts = frame.attrValueStarts;
  const attrValueEnds = frame.attrValueEnds;
  const buffer = frame.buffer;
  for (let index = 0; index < frame.eventCount; index++) {
    const type = eventTypes[index];
    eventCount++;
    checksum = mixChecksum(checksum, type);
    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      countStringField(counters, 'name');
      checksum = foldString(checksum, decodeSpan(buffer, nameStarts[index], nameEnds[index], variant, state, counters, 'name'));
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      const start = textStarts[index];
      if (start >= 0) {
        countStringField(counters, 'text');
        checksum = foldString(checksum, decodeSpan(buffer, start, textEnds[index], variant, state, counters, 'text').trim());
      }
    }
    if (type === StreamEventType.START_ELEMENT) {
      const attrStart = attrStarts[index];
      const attrCount = attrCounts[index];
      counters.attributePairs += attrCount;
      checksum = mixChecksum(checksum, attrCount);
      const attrEnd = attrStart + attrCount;
      for (let attrIndex = attrStart; attrIndex < attrEnd; attrIndex++) {
        countStringField(counters, 'attrName');
        checksum = foldString(checksum, decodeSpan(buffer, attrNameStarts[attrIndex], attrNameEnds[attrIndex], variant, state, counters, 'attrName'));
        countStringField(counters, 'attrValue');
        const value = isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, attrIndex)
          ? countImplicitAttributeValue(counters)
          : decodeSpan(buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex], variant, state, counters, 'attrValue');
        checksum = foldString(checksum, value);
      }
    }
  }
  return { eventCount, checksum };
}

function decodeSpan(buffer, start, end, variant, state, counters, kind) {
  counters.decodeSpanCalls++;
  countRawSpanMaterialization(counters, kind);
  return variant.decode(buffer, start, end, state, counters);
}

function isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, index) {
  return attrNameStarts[index] === attrValueStarts[index] && attrNameEnds[index] === attrValueEnds[index];
}

function countImplicitAttributeValue(counters) {
  counters.implicitAttrValueReads++;
  return 'true';
}

function decodeShortAsciiSpan(buffer, start, end) {
  const length = end - start;
  if (length === 0) return '';
  if (length > 12) return undefined;
  let bits = 0;
  for (let index = start; index < end; index++) bits |= buffer[index];
  if (bits > 0x7f) return undefined;
  switch (length) {
    case 1: return String.fromCharCode(buffer[start]);
    case 2: return String.fromCharCode(buffer[start], buffer[start + 1]);
    case 3: return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2]);
    case 4: return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3]);
    case 5: return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3], buffer[start + 4]);
    case 6: return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3], buffer[start + 4], buffer[start + 5]);
    case 7: return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3], buffer[start + 4], buffer[start + 5], buffer[start + 6]);
    case 8: return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3], buffer[start + 4], buffer[start + 5], buffer[start + 6], buffer[start + 7]);
    case 9: return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3], buffer[start + 4], buffer[start + 5], buffer[start + 6], buffer[start + 7], buffer[start + 8]);
    case 10: return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3], buffer[start + 4], buffer[start + 5], buffer[start + 6], buffer[start + 7], buffer[start + 8], buffer[start + 9]);
    case 11: return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3], buffer[start + 4], buffer[start + 5], buffer[start + 6], buffer[start + 7], buffer[start + 8], buffer[start + 9], buffer[start + 10]);
    case 12: return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3], buffer[start + 4], buffer[start + 5], buffer[start + 6], buffer[start + 7], buffer[start + 8], buffer[start + 9], buffer[start + 10], buffer[start + 11]);
    default: return undefined;
  }
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
    rowStats,
    targetBytes,
    actualBytes,
    sizeGiB: actualBytes / GIB,
    fixtureShape: options.fixtureShape,
    batchSize: options.batchSize,
    rowPreview: previewDecoder.decode(rows[0].subarray(0, Math.min(rows[0].byteLength, 512))),
    rowPreviewTruncated: rows[0].byteLength > 512,
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
  if (shape === 'repeated-person') return [textEncoder.encode(makeRepeatedPersonRow())];
  if (shape === 'corpus-cycle') {
    const response = await fetch('/corpus');
    if (!response.ok) throw new Error('Failed to fetch corpus fixture: HTTP ' + response.status);
    return [new Uint8Array(await response.arrayBuffer())];
  }
  return Array.from({ length: cycleSize }, (_, id) => textEncoder.encode(makeDiverseRow(id)));
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
  const utf8Text = id % 11 === 0 ? ' ' + String.fromCodePoint(0x2603) + '-' + id + '-' + String.fromCodePoint(0x1f642) : '';
  return '<' + rootName + ' id="item-' + id + '" ' + attrA + '="value-' + ((id * 31) % 65521) + '" ' + attrB + '="group-' + (id % 4093) + '" ' + attrC + '="' + (id % 2 === 0 ? 'true' : 'false') + '">'
    + '<' + childA + '>Runtime Benchmark ' + id + utf8Text + '</' + childA + '>'
    + '<' + childB + ' rank="' + (id % 29) + '">Full string checksum payload ' + ((id * 8191) % 104729) + '</' + childB + '>'
    + '<' + childC + ' shard="' + (id % 37) + '" bucket="' + ((id * 19) % 389) + '">Text ' + id + ' ' + ((id * id) % 99991) + '</' + childC + '>'
    + '</' + rootName + '>';
}

function summarizeRows(rowList) {
  const rowBytes = rowList.map(entry => entry.byteLength);
  return { minRowBytes: Math.min(...rowBytes), maxRowBytes: Math.max(...rowBytes), averageRowBytes: average(rowBytes) };
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
  if (mismatch) throw new Error('Variant ' + mismatch.id + ' does not match ' + first.id + ' event count.');
  return { status: 'ok', eventCount: first.eventCount, rowIds: variants.map(entry => entry.id) };
}

function computeFullStringParity(variants) {
  const first = variants[0];
  const mismatch = variants.find(entry => entry.eventCount !== first.eventCount || entry.checksum !== first.checksum);
  if (mismatch) throw new Error('Full-string variant ' + mismatch.id + ' does not match ' + first.id + '.');
  return { status: 'ok', rowIds: variants.map(entry => entry.id), eventCount: first.eventCount, checksum: first.checksum };
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
    decodeSpanCalls: 0,
    textDecoderCalls: 0,
    textDecoderInstances: 0,
    shortAsciiHits: 0,
    copiedSpans: 0,
    copiedSpanBytes: 0,
    implicitAttrValueReads: 0,
    attributePairs: 0,
  };
}

function countStringField(counters, kind) {
  counters.stringFieldReads++;
  if (kind === 'name') counters.nameStringReads++;
  else if (kind === 'text') counters.textStringReads++;
  else if (kind === 'attrName') counters.attrNameStringReads++;
  else if (kind === 'attrValue') counters.attrValueStringReads++;
  else throw new Error('Unknown string field kind: ' + kind);
}

function countRawSpanMaterialization(counters, kind) {
  counters.rawSpanMaterializations++;
  if (kind === 'name') counters.rawNameSpanMaterializations++;
  else if (kind === 'text') counters.rawTextSpanMaterializations++;
  else if (kind === 'attrName') counters.rawAttrNameSpanMaterializations++;
  else if (kind === 'attrValue') counters.rawAttrValueSpanMaterializations++;
  else throw new Error('Unknown raw span kind: ' + kind);
}

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

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageNullable(values) {
  const numeric = values.filter(isFiniteNumber);
  return numeric.length > 0 ? average(numeric) : null;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
`;
}

function printSummary(report) {
  console.log('Browser TextDecoder span variant matrix');
  console.log(`fixture=${report.fixture.shape} size=${formatBytes(report.fixture.actualBytes)} runs=${report.options.runs}`);
  for (const entry of report.variants) {
    console.log(
      `${entry.id.padEnd(34)} ${formatRate(entry.mibPerSec).padStart(14)} `
      + `bounded=${entry.boundedMemory ? 'yes' : 'no'} counterexample=${entry.counterexampleStatus} `
      + `decoderCalls=${entry.materializationCounters.textDecoderCalls} maxJsHeap=${formatBytes(entry.memory.maxJsHeapUsedBytes)} `
      + `events=${entry.eventCount} checksum=${entry.checksum}`,
    );
  }
}

function writeOutput(path, content) {
  const resolved = resolve(process.cwd(), path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content, 'utf8');
  console.log(`Wrote ${resolved}`);
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

function formatRuntime(environment) {
  return `${environment.browserName} ${environment.browserVersion} / browser ${environment.javascriptEngine}`;
}

function maxBy(values, selector) {
  let selected;
  for (const value of values) {
    if (!selected || selector(value) > selector(selected)) selected = value;
  }
  return selected;
}

function formatRate(value) {
  return `${value.toFixed(2)} MiB/s`;
}

function formatCount(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatBytes(value) {
  if (value == null) return 'n/a';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= GIB) return `${sign}${(abs / GIB).toFixed(2)} GiB`;
  if (abs >= MIB) return `${sign}${(abs / MIB).toFixed(1)} MiB`;
  if (abs >= 1024) return `${sign}${(abs / 1024).toFixed(1)} KiB`;
  return `${sign}${abs.toFixed(0)} B`;
}

function formatSignedBytes(value) {
  if (value == null) return 'n/a';
  if (value === 0) return '0 B';
  return `${value > 0 ? '+' : ''}${formatBytes(value)}`;
}

main();
