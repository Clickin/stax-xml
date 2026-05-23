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
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'browser-string-limit-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'browser-string-limit-audit.md');
const distDir = resolve(__dirname, '../stax-xml/dist');
const distIndexPath = resolve(distDir, 'index.js');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizesMiB: [64, 1024],
    runs: 1,
    warmups: 0,
    fixtureShape: 'diverse-cycle',
    diverseCycleSize: 4096,
    sampleEveryEvents: 250_000,
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
      case '--size-mib':
        options.sizesMiB = [parsePositiveNumber(readValue(), '--size-mib')];
        break;
      case '--sizes-mib':
        options.sizesMiB = readValue().split(',').map(value => parsePositiveNumber(value.trim(), '--sizes-mib'));
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
      case '--sample-every-events':
        options.sampleEveryEvents = parsePositiveInteger(readValue(), '--sample-every-events');
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

  if (!['repeated-person', 'diverse-cycle'].includes(options.fixtureShape)) {
    throw new Error('--fixture-shape must be one of repeated-person, diverse-cycle.');
  }
  if (!options.browserExecutable || !existsSync(options.browserExecutable)) {
    throw new Error('Chrome or Edge executable was not found. Pass --browser-executable or set CHROME_PATH/EDGE_PATH.');
  }
  if (!existsSync(distIndexPath)) {
    throw new Error(`Built browser module does not exist: ${distIndexPath}. Run pnpm --filter stax-xml build first.`);
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
  const userDataDir = mkdtempSync(join(tmpdir(), 'stax-browser-string-limit-'));
  try {
    browserPort = await reservePort();
    browser = launchBrowser(options, browserPort, userDataDir);
    const cdpVersion = await waitForBrowser(browserPort, options.browserTimeoutMs, browser);
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
    const report = createReport(browserResult, options, cdpVersion, summarizeHostProcessMemory(hostProcessMemorySamples, options));
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
  const html = '<!doctype html><meta charset="utf-8"><title>stax browser string limit audit</title><script type="module" src="/runner.js"></script>';
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
        return await response.json();
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
    // Chrome can briefly keep profile files locked after process exit.
  }
}

async function evaluateRunner(client, timeoutMs) {
  const expression = `
    new Promise((resolve) => {
      const startedAt = performance.now();
      const tick = () => {
        if (globalThis.__staxBrowserStringLimitResult) {
          Promise.resolve(globalThis.__staxBrowserStringLimitResult).then(resolve, (error) => {
            resolve({ error: { name: error?.name ?? 'Error', message: error?.message ?? String(error), stack: error?.stack ?? null } });
          });
          return;
        }
        if (performance.now() - startedAt > ${JSON.stringify(timeoutMs - 1000)}) {
          resolve({ error: { name: 'TimeoutError', message: 'Timed out waiting for browser string-limit audit.', stack: null } });
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
  }), timeoutMs, 'Timed out waiting for browser string-limit evaluation.');
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
    return { label, at, scope: 'disabled', reason: 'Host process memory collection was disabled.' };
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
} | ConvertTo-Json -Depth 4 -Compress
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
  const usableSamples = samples.filter(sample => sample.scope === 'windows-process-tree');
  if (usableSamples.length === 0) {
    return { scope: process.platform === 'win32' ? 'unavailable' : 'unsupported', note: 'Host process-tree memory was not available.', samples, maxWorkingSetBytes: null, maxPrivateBytes: null, maxProcessCount: null };
  }
  return {
    scope: 'windows-process-tree',
    note: 'Windows process-tree memory rooted at the browser pid. This is host process context, not variant-level JS heap memory.',
    samples,
    maxWorkingSetBytes: Math.max(...usableSamples.map(sample => sample.workingSetBytes ?? 0)),
    maxPrivateBytes: Math.max(...usableSamples.map(sample => sample.privateBytes ?? 0)),
    maxProcessCount: Math.max(...usableSamples.map(sample => sample.processCount ?? 0)),
  };
}

function createReport(browserResult, options, cdpVersion, hostProcessMemory) {
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'browser-string-limit-audit',
    contract: 'browser-v8-complete-js-string-input-boundary',
    note: 'This audits the browser EventReaderSync complete-string input boundary. It is not a byte-batch runtime ceiling or a 200 MiB/s impossibility proof.',
    packageVersion,
    environment: {
      ...browserResult.environment,
      cpuName: cpus()[0]?.model ?? 'unknown',
      hostPlatform: `${process.platform}-${process.arch}`,
      browserExecutable: options.browserExecutable,
      cdpVersion,
    },
    options: {
      sizesMiB: options.sizesMiB,
      runs: options.runs,
      warmups: options.warmups,
      fixtureShape: options.fixtureShape,
      diverseCycleSize: options.diverseCycleSize,
      sampleEveryEvents: options.sampleEveryEvents,
    },
    rows: browserResult.rows,
    hostProcessMemory,
  };
  return {
    ...report,
    findings: createFindings(report),
  };
}

function createFindings(report) {
  const okRows = report.rows.filter(row => row.status === 'ok');
  const failedRows = report.rows.filter(row => row.status === 'string-construction-failed');
  const largestOk = okRows.toSorted((a, b) => b.fixture.actualUtf8Bytes - a.fixture.actualUtf8Bytes)[0];
  return [
    {
      id: 'browser-string-input-control',
      classification: 'BENCH_FACT',
      summary: 'At least one browser EventReaderSync complete-string control row parsed successfully.',
      evidence: largestOk
        ? [`${largestOk.sizeMiB} MiB: ${formatRate(largestOk.mibPerSec)}, events=${formatCount(largestOk.eventCount)}, checksum=${largestOk.checksum}`]
        : ['no successful control row'],
    },
    {
      id: 'browser-complete-string-boundary',
      classification: 'BENCH_FACT',
      summary: failedRows.length > 0
        ? 'At least one projected complete XML string failed browser string construction before EventReaderSync parsing.'
        : 'No complete-string construction failure was observed for the selected sizes.',
      evidence: failedRows.length > 0
        ? failedRows.map(row => `${row.sizeMiB} MiB: ${row.stringConstructionProbe.errorName}: ${row.stringConstructionProbe.errorMessage}`)
        : ['construction-failure=not-observed'],
    },
    {
      id: 'browser-memory-scope',
      classification: 'BENCH_FACT',
      summary: 'Measured row memory is Chromium page JS heap. Host process-tree memory is reported separately when available.',
      evidence: okRows.map(row => `${row.sizeMiB} MiB: maxJsHeap=${formatBytes(row.memory.maxJsHeapUsedBytes)}`),
    },
    {
      id: 'not-byte-batch-runtime-ceiling',
      classification: 'TRACE_FACT_LIMIT',
      summary: 'A complete-string construction failure limits EventReaderSync string input only; it is not a byte-batch runtime ceiling.',
      evidence: ['StreamReaderSync byte-batch browser artifacts remain the relevant bounded-memory reader path.'],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Browser String-Limit Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This experiment audits the EventReaderSync complete XML string path in the browser.',
    'It tests whether a projected 1 GiB generated XML string can be constructed before parsing.',
    'It is not a byte-batch runtime ceiling and not proof that JavaScript runtimes have no further headroom.',
    '',
    '## Environment',
    '',
    `- Package: stax-xml ${report.packageVersion}`,
    `- Runtime: ${report.environment.browserName} ${report.environment.browserVersion}, ${report.environment.javascriptEngine}`,
    `- User agent: ${report.environment.userAgent}`,
    `- CDP browser: ${report.environment.cdpVersion?.Browser ?? 'n/a'}`,
    `- CDP V8: ${report.environment.cdpVersion?.['V8-Version'] ?? 'n/a'}`,
    `- Fixture shape: ${report.options.fixtureShape}`,
    `- Row cycle size: ${report.options.diverseCycleSize}`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    '',
    '## Results',
    '',
    '| Size | Status | Throughput | Events | Checksum | Event objects | String fields | String code units | Max JS heap | Construction probe |',
    '| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ];

  for (const row of report.rows) {
    if (row.status !== 'ok') {
      lines.push(
        `| ${row.sizeMiB} MiB | ${row.status} | n/a | n/a | n/a | n/a | n/a | `
        + `${formatCount(row.fixture.stringCodeUnits)} | n/a | ${formatProbe(row.stringConstructionProbe)} |`,
      );
      continue;
    }
    lines.push(
      `| ${formatBytes(row.fixture.actualUtf8Bytes)} | ok | ${formatRate(row.mibPerSec)} | ${formatCount(row.eventCount)} | `
      + `${row.checksum} | ${formatCount(row.materializationCounters.eventObjects)} | `
      + `${formatCount(row.materializationCounters.stringFieldReads)} | ${formatCount(row.fixture.stringCodeUnits)} | `
      + `${formatBytes(row.memory.maxJsHeapUsedBytes)} | n/a |`,
    );
  }

  lines.push('');
  lines.push('## Memory');
  lines.push('');
  lines.push('Variant memory uses Chromium `performance.memory` page JS heap endpoints. Host process-tree memory is separate host context.');
  lines.push('');
  lines.push('| Size | Avg used heap delta | Max used heap | Max total heap | JS heap limit |');
  lines.push('| ---: | ---: | ---: | ---: | ---: |');
  for (const row of report.rows.filter(entry => entry.status === 'ok')) {
    lines.push(
      `| ${formatBytes(row.fixture.actualUtf8Bytes)} | ${formatSignedBytes(row.memory.avgJsHeapUsedDeltaBytes)} | `
      + `${formatBytes(row.memory.maxJsHeapUsedBytes)} | ${formatBytes(row.memory.maxJsHeapTotalBytes)} | `
      + `${formatBytes(row.memory.jsHeapSizeLimitBytes)} |`,
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
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function formatProbe(probe) {
  if (!probe) return 'n/a';
  if (probe.status === 'throws') {
    return `${probe.errorName}: ${probe.errorMessage}`;
  }
  return probe.status;
}

function printSummary(report) {
  console.log('Browser string-limit audit');
  for (const row of report.rows) {
    if (row.status !== 'ok') {
      console.log(`${String(row.sizeMiB).padStart(8)} MiB status=${row.status} ${formatProbe(row.stringConstructionProbe)}`);
      continue;
    }
    console.log(`${formatBytes(row.fixture.actualUtf8Bytes).padStart(10)} ${formatRate(row.mibPerSec).padStart(14)} maxHeap=${formatBytes(row.memory.maxJsHeapUsedBytes)} events=${row.eventCount}`);
  }
}

function formatRate(value) {
  return `${value.toFixed(2)} MiB/s`;
}

function formatBytes(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a';
  const abs = Math.abs(value);
  if (abs >= GIB) return `${(value / GIB).toFixed(2)} GiB`;
  if (abs >= MIB) return `${(value / MIB).toFixed(1)} MiB`;
  if (abs >= 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${value.toFixed(0)} B`;
}

function formatSignedBytes(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a';
  return `${value > 0 ? '+' : ''}${formatBytes(value)}`;
}

function formatCount(value) {
  return value.toLocaleString('en-US');
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  console.log(`Wrote ${filePath}`);
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
    sizesMiB: options.sizesMiB,
    runs: options.runs,
    warmups: options.warmups,
    fixtureShape: options.fixtureShape,
    diverseCycleSize: options.diverseCycleSize,
    sampleEveryEvents: options.sampleEveryEvents,
  };
  return `
import { EventReaderSync, XmlEventType } from '/stax/index.js';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const textEncoder = new TextEncoder();
const config = ${JSON.stringify(runnerConfig)};

globalThis.__staxBrowserStringLimitResult = runBenchmark().catch(error => ({
  error: {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    stack: error?.stack ?? null,
  },
}));

async function runBenchmark() {
  const rows = createFixtureRows(config.fixtureShape, config.diverseCycleSize);
  return {
    environment: createRuntimeEnvironment(),
    rows: config.sizesMiB.map(sizeMiB => runSize(sizeMiB, rows, config)),
  };
}

function runSize(sizeMiB, rows, options) {
  const projection = projectFixture(sizeMiB, rows);
  const shouldProbeBeforeConstruct = projection.stringCodeUnits >= 128 * MIB;
  if (shouldProbeBeforeConstruct) {
    const stringConstructionProbe = probeStringConstruction(projection.stringCodeUnits);
    if (stringConstructionProbe.status === 'throws') {
      return {
        status: 'string-construction-failed',
        sizeMiB,
        fixture: projection,
        stringConstructionProbe,
        parsed: false,
      };
    }
  }

  try {
    forceGc();
    const beforeGenerate = takeMemorySnapshot();
    const generationStartedAt = performance.now();
    const fixture = createXmlString(projection.targetBytes, rows);
    const generationMs = performance.now() - generationStartedAt;
    const afterGenerate = takeMemorySnapshot();

    for (let index = 0; index < options.warmups; index++) {
      consumeEventReaderObject(fixture.xml, options.sampleEveryEvents);
    }

    const samplesMs = [];
    const memorySamples = [];
    let first;
    for (let index = 0; index < options.runs; index++) {
      forceGc();
      const beforeParse = takeMemorySnapshot();
      const startedAt = performance.now();
      const result = consumeEventReaderObject(fixture.xml, options.sampleEveryEvents);
      const elapsedMs = performance.now() - startedAt;
      const afterParse = takeMemorySnapshot();
      if (first && (result.eventCount !== first.eventCount || result.checksum !== first.checksum)) {
        throw new Error('EventReaderSync produced unstable event count or checksum.');
      }
      first ??= result;
      samplesMs.push(elapsedMs);
      memorySamples.push(createMemorySample(beforeParse, afterParse));
    }

    const avgMs = average(samplesMs);
    return {
      status: 'ok',
      sizeMiB,
      fixture: {
        ...projection,
        actualUtf8Bytes: fixture.actualUtf8Bytes,
        stringCodeUnits: fixture.xml.length,
        estimatedUtf16Bytes: fixture.xml.length * 2,
        constructingCompleteStringIsExpectedToFail: false,
      },
      generation: {
        ms: generationMs,
        before: beforeGenerate,
        after: afterGenerate,
        delta: createMemoryDelta(beforeGenerate, afterGenerate),
      },
      avgMs,
      minMs: Math.min(...samplesMs),
      maxMs: Math.max(...samplesMs),
      mibPerSec: (fixture.actualUtf8Bytes / MIB) / (avgMs / 1000),
      eventCount: first.eventCount,
      checksum: first.checksum,
      samplesMs,
      memory: summarizeMemorySamples(memorySamples),
      materializationCounters: first.materializationCounters,
      parsed: true,
    };
  } catch (error) {
    return {
      status: 'error',
      sizeMiB,
      fixture: projection,
      errorName: error?.name ?? 'Error',
      errorMessage: error?.message ?? String(error),
      stack: error?.stack ?? null,
      parsed: false,
    };
  }
}

function probeStringConstruction(length) {
  try {
    const value = 'x'.repeat(length);
    return {
      status: 'ok',
      requestedLength: length,
      actualLength: value.length,
    };
  } catch (error) {
    return {
      status: 'throws',
      requestedLength: length,
      errorName: error?.name ?? 'Error',
      errorMessage: error?.message ?? String(error),
    };
  }
}

function projectFixture(sizeMiB, rows) {
  const targetBytes = Math.floor(sizeMiB * MIB);
  const rowStats = summarizeRows(rows);
  const cycleUtf8Bytes = rows.reduce((sum, row) => sum + row.utf8Bytes, 0);
  const cycleStringCodeUnits = rows.reduce((sum, row) => sum + row.stringCodeUnits, 0);
  const fullCycles = Math.floor(targetBytes / cycleUtf8Bytes);
  let actualUtf8Bytes = cycleUtf8Bytes * fullCycles;
  let stringCodeUnits = cycleStringCodeUnits * fullCycles;
  let tailRows = 0;
  while (actualUtf8Bytes < targetBytes) {
    const row = rows[tailRows % rows.length];
    actualUtf8Bytes += row.utf8Bytes;
    stringCodeUnits += row.stringCodeUnits;
    tailRows++;
  }
  return {
    generated: true,
    shape: config.fixtureShape,
    rowCycleSize: rows.length,
    minRowBytes: rowStats.minRowBytes,
    maxRowBytes: rowStats.maxRowBytes,
    averageRowBytes: rowStats.averageRowBytes,
    targetBytes,
    actualUtf8Bytes,
    sizeGiB: actualUtf8Bytes / GIB,
    stringCodeUnits,
    estimatedUtf16Bytes: stringCodeUnits * 2,
    fullCycles,
    tailRows,
    cycleUtf8Bytes,
    cycleStringCodeUnits,
    constructingCompleteStringIsExpectedToFail: stringCodeUnits >= 128 * MIB,
  };
}

function createXmlString(targetBytes, rows) {
  const cycleUtf8Bytes = rows.reduce((sum, row) => sum + row.utf8Bytes, 0);
  const cycleString = rows.map(row => row.xml).join('');
  const fullCycles = Math.floor(targetBytes / cycleUtf8Bytes);
  const parts = [];
  let actualUtf8Bytes = 0;
  if (fullCycles > 0) {
    parts.push(cycleString.repeat(fullCycles));
    actualUtf8Bytes += cycleUtf8Bytes * fullCycles;
  }
  let rowIndex = 0;
  while (actualUtf8Bytes < targetBytes) {
    const row = rows[rowIndex % rows.length];
    parts.push(row.xml);
    actualUtf8Bytes += row.utf8Bytes;
    rowIndex++;
  }
  return {
    xml: parts.join(''),
    actualUtf8Bytes,
  };
}

function createFixtureRows(shape, cycleSize) {
  if (shape === 'repeated-person') {
    return [createFixtureRow(makeRepeatedPersonRow())];
  }
  return Array.from({ length: cycleSize }, (_, id) => createFixtureRow(makeDiverseRow(id)));
}

function createFixtureRow(xml) {
  const bytes = textEncoder.encode(xml);
  return {
    xml,
    utf8Bytes: bytes.byteLength,
    stringCodeUnits: xml.length,
  };
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

  return '<' + rootName + ' id="item-' + id + '" ' + attrA + '="value-' + ((id * 31) % 65521) + '" '
    + attrB + '="group-' + (id % 4093) + '" ' + attrC + '="' + (id % 2 === 0 ? 'true' : 'false') + '">'
    + '<' + childA + '>Runtime Benchmark ' + id + utf8Text + '</' + childA + '>'
    + '<' + childB + ' rank="' + (id % 29) + '">Full string checksum payload ' + ((id * 8191) % 104729) + '</' + childB + '>'
    + '<' + childC + ' shard="' + (id % 37) + '" bucket="' + ((id * 19) % 389) + '">Text ' + id + ' ' + ((id * id) % 99991) + '</' + childC + '>'
    + '</' + rootName + '>';
}

function summarizeRows(rowList) {
  const rowBytes = rowList.map(entry => entry.utf8Bytes);
  return {
    minRowBytes: Math.min(...rowBytes),
    maxRowBytes: Math.max(...rowBytes),
    averageRowBytes: average(rowBytes),
  };
}

function consumeEventReaderObject(xml, sampleEveryEvents) {
  const materializationCounters = createMaterializationCounters();
  let eventCount = 0;
  let checksum = 0;

  for (const event of new EventReaderSync(xml)) {
    const typeCode = publicEventTypeCode(event.type);
    materializationCounters.eventObjects++;
    eventCount++;
    checksum = mixChecksum(checksum, typeCode);

    if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
      countStringField(materializationCounters, 'name');
      checksum = foldString(checksum, event.name);
    }
    if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
      countStringField(materializationCounters, 'text');
      checksum = foldString(checksum, event.value?.trim());
    }
    if (event.type === XmlEventType.START_ELEMENT) {
      const entries = Object.entries(event.attributes);
      materializationCounters.attributePairs += entries.length;
      checksum = mixChecksum(checksum, entries.length);
      for (const [name, value] of entries) {
        countStringField(materializationCounters, 'attrName');
        checksum = foldString(checksum, name);
        countStringField(materializationCounters, 'attrValue');
        checksum = foldString(checksum, value);
      }
    }
    if (eventCount % sampleEveryEvents === 0) {
      takeMemorySnapshot();
    }
  }

  return { eventCount, checksum, materializationCounters };
}

function createMaterializationCounters() {
  return {
    stringFieldReads: 0,
    nameStringReads: 0,
    textStringReads: 0,
    attrNameStringReads: 0,
    attrValueStringReads: 0,
    eventObjects: 0,
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

function publicEventTypeCode(type) {
  switch (type) {
    case XmlEventType.START_DOCUMENT:
      return 0;
    case XmlEventType.END_DOCUMENT:
      return 1;
    case XmlEventType.START_ELEMENT:
      return 2;
    case XmlEventType.END_ELEMENT:
      return 3;
    case XmlEventType.CHARACTERS:
      return 4;
    case XmlEventType.CDATA:
      return 5;
    default:
      return 6;
  }
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
    delta: createMemoryDelta(before, after),
  };
}

function createMemoryDelta(before, after) {
  return {
    jsHeapUsedBytes: numericDelta(before.jsHeapUsedBytes, after.jsHeapUsedBytes),
    jsHeapTotalBytes: numericDelta(before.jsHeapTotalBytes, after.jsHeapTotalBytes),
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

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageNullable(values) {
  const finiteValues = values.filter(isFiniteNumber);
  return finiteValues.length > 0 ? average(finiteValues) : null;
}
`;
}

main();
