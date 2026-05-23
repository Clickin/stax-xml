import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'browser-v8-allocation-sampling.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'browser-v8-allocation-sampling.md');
const distDir = resolve(__dirname, '../stax-xml/dist');
const distIndexPath = resolve(distDir, 'index.js');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizeMiB: 16,
    fixtureShape: 'diverse-cycle',
    diverseCycleSize: 4096,
    batchSize: 16,
    warmups: 0,
    cases: ['stringFull', 'eventObjectFull', 'rawFrameNameId'],
    samplingInterval: 8192,
    browserExecutable: process.env.CHROME_PATH || process.env.EDGE_PATH || findBrowserExecutable(),
    browserTimeoutMs: 10 * 60 * 1000,
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
        options.sizeMiB = parsePositiveNumber(readValue(), '--size-mib');
        break;
      case '--fixture-shape':
        options.fixtureShape = readValue();
        break;
      case '--diverse-cycle-size':
        options.diverseCycleSize = parsePositiveInteger(readValue(), '--diverse-cycle-size');
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), '--batch-size');
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), '--warmups');
        break;
      case '--cases':
        options.cases = parseCaseList(readValue());
        break;
      case '--sampling-interval':
        options.samplingInterval = parsePositiveInteger(readValue(), '--sampling-interval');
        break;
      case '--browser-executable':
        options.browserExecutable = resolve(process.cwd(), readValue());
        break;
      case '--browser-timeout-ms':
        options.browserTimeoutMs = parsePositiveInteger(readValue(), '--browser-timeout-ms');
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

function parseCaseList(value) {
  const parsed = value.split(',').map(entry => entry.trim()).filter(Boolean);
  if (parsed.length === 0) {
    throw new Error('--cases must contain at least one case id.');
  }
  return parsed;
}

async function main() {
  const options = parseArgs();
  const server = await startBenchmarkServer(options);
  let browser;
  let client;
  let targetId;
  let browserPort;
  const userDataDir = mkdtempSync(join(tmpdir(), 'stax-browser-v8-alloc-'));

  try {
    browserPort = await reservePort();
    browser = launchBrowser(options, browserPort, userDataDir);
    await waitForBrowser(browserPort, options.browserTimeoutMs, browser);
    const cdpVersion = await fetchJson(`http://127.0.0.1:${browserPort}/json/version`);
    const target = await openPage(browserPort, 'about:blank');
    targetId = target.id;
    client = await CdpClient.connect(target.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('HeapProfiler.enable');

    await client.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/runner.html` });
    await withTimeout(client.waitForEvent('Runtime.executionContextCreated'), 5000, 'Timed out waiting for browser execution context.').catch(() => {});
    const prepared = await waitForBrowserAllocationReady(client, options.browserTimeoutMs);
    if (prepared?.error) {
      throw new Error(`${prepared.error.name}: ${prepared.error.message}\n${prepared.error.stack ?? ''}`);
    }

    const variants = [];
    for (const caseId of options.cases) {
      await client.send('HeapProfiler.startSampling', { samplingInterval: options.samplingInterval });
      const measured = await evaluateBrowserValue(
        client,
        `globalThis.__staxBrowserAllocationRun(${JSON.stringify(caseId)})`,
        options.browserTimeoutMs,
      );
      const stopped = await client.send('HeapProfiler.stopSampling');
      if (measured?.error) {
        throw new Error(`${measured.error.name}: ${measured.error.message}\n${measured.error.stack ?? ''}`);
      }
      variants.push({
        ...measured,
        profile: {
          scope: 'browser-v8-heap-profiler',
          samplingInterval: options.samplingInterval,
          ...summarizeProfile(stopped.profile),
        },
      });
    }

    const report = createReport({
      options,
      browserResult: await evaluateBrowserValue(client, 'globalThis.__staxBrowserAllocationSummary()', options.browserTimeoutMs),
      cdpVersion,
      variants,
    });
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
  const html = '<!doctype html><meta charset="utf-8"><title>stax browser V8 allocation sampling</title><script type="module" src="/runner.js"></script>';
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
        return;
      }
    } catch {
      // Keep polling until Chrome publishes the DevTools endpoint.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for browser CDP on port ${port}.\n${browser.stderrText}`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status} ${await response.text()}`);
  }
  return response.json();
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
    // Windows can keep Chrome profile files locked briefly after process exit.
  }
}

async function evaluateBrowserValue(client, expression, timeoutMs) {
  const result = await withTimeout(client.send('Runtime.evaluate', {
    expression: `Promise.resolve(${expression}).catch(error => ({ error: { name: error?.name ?? 'Error', message: error?.message ?? String(error), stack: error?.stack ?? null } }))`,
    awaitPromise: true,
    returnByValue: true,
  }), timeoutMs, 'Timed out waiting for browser allocation sampling evaluation.');
  if (result.exceptionDetails) {
    throw new Error(`Browser evaluation failed: ${formatExceptionDetails(result.exceptionDetails)}`);
  }
  return result.result.value;
}

async function waitForBrowserAllocationReady(client, timeoutMs) {
  const expression = `
    new Promise((resolve) => {
      const startedAt = performance.now();
      const tick = () => {
        if (globalThis.__staxBrowserAllocationReady) {
          Promise.resolve(globalThis.__staxBrowserAllocationReady).then(resolve, (error) => {
            resolve({ error: { name: error?.name ?? 'Error', message: error?.message ?? String(error), stack: error?.stack ?? null } });
          });
          return;
        }
        if (performance.now() - startedAt > ${JSON.stringify(timeoutMs - 1000)}) {
          resolve({ error: { name: 'TimeoutError', message: 'Timed out waiting for browser allocation runner.', stack: null } });
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
  }), timeoutMs, 'Timed out waiting for browser allocation runner readiness.');
  if (result.exceptionDetails) {
    throw new Error(`Browser readiness evaluation failed: ${formatExceptionDetails(result.exceptionDetails)}`);
  }
  return result.result.value;
}

function formatExceptionDetails(details) {
  const description = details.exception?.description ?? details.text ?? 'unknown browser exception';
  const frames = details.stackTrace?.callFrames?.slice(0, 5).map(frame => `${frame.functionName || '(anonymous)'} ${frame.url}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`) ?? [];
  return [description, ...frames].join('\n');
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

function summarizeProfile(profile) {
  const nodes = [];
  collectNodes(profile?.head, nodes);
  const sampledBytes = nodes.reduce((sum, node) => sum + node.selfSize, 0);
  const topFunctions = nodes
    .filter(node => node.selfSize > 0)
    .sort((a, b) => b.selfSize - a.selfSize)
    .slice(0, 16)
    .map(node => ({
      functionName: node.functionName,
      url: node.url,
      lineNumber: node.lineNumber,
      columnNumber: node.columnNumber,
      selfSize: node.selfSize,
      percent: sampledBytes > 0 ? node.selfSize / sampledBytes : 0,
    }));
  return {
    sampledBytes,
    sampleCount: Array.isArray(profile?.samples) ? profile.samples.length : 0,
    topFunctions,
  };
}

function collectNodes(node, output) {
  if (!node) return;
  const callFrame = node.callFrame ?? {};
  output.push({
    id: node.id,
    selfSize: Number(node.selfSize ?? 0),
    functionName: callFrame.functionName || '(anonymous)',
    url: callFrame.url || '',
    lineNumber: Number(callFrame.lineNumber ?? -1),
    columnNumber: Number(callFrame.columnNumber ?? -1),
  });
  for (const child of node.children ?? []) {
    collectNodes(child, output);
  }
}

function createReport({ options, browserResult, cdpVersion, variants }) {
  const eventCountParity = computeEventCountParity(variants);
  const fullStringParity = computeFullStringParity(variants);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'browser-v8-allocation-sampling',
    contract: 'browser-v8-heap-profiler-allocation-sampling',
    note: 'Chrome/Edge CDP HeapProfiler allocation sampling for browser byte-batch JavaScript reader shapes. Sampling is statistical, browser-build-specific evidence and is not a runtime ceiling proof.',
    environment: {
      ...browserResult.environment,
      cdpVersion,
      hostNode: process.version,
      hostPlatform: `${process.platform}-${process.arch}`,
      cpuName: cpus()[0]?.model ?? 'unknown',
    },
    fixture: browserResult.fixture,
    options: {
      sizeMiB: options.sizeMiB,
      fixtureShape: options.fixtureShape,
      diverseCycleSize: options.diverseCycleSize,
      batchSize: options.batchSize,
      warmups: options.warmups,
      cases: options.cases,
      samplingInterval: options.samplingInterval,
    },
    eventCountParity,
    fullStringParity,
    variants,
    findings: createFindings(variants, browserResult.fixture),
  };
}

function computeEventCountParity(variants) {
  const first = variants[0];
  if (!first) {
    return { status: 'not-applicable', rowIds: [], eventCount: null };
  }
  const mismatch = variants.find(entry => entry.eventCount !== first.eventCount);
  if (mismatch) {
    throw new Error(`Variant ${mismatch.id} does not match ${first.id} event count.`);
  }
  return {
    status: 'ok',
    eventCount: first.eventCount,
    rowIds: variants.map(entry => entry.id),
  };
}

function computeFullStringParity(variants) {
  const rows = variants.filter(entry => entry.fullStringParity);
  const first = rows[0];
  if (!first) {
    return { status: 'not-applicable', rowIds: [], eventCount: null, checksum: null };
  }
  const mismatch = rows.find(entry => entry.eventCount !== first.eventCount || entry.checksum !== first.checksum);
  if (mismatch) {
    throw new Error(`Full-string variant ${mismatch.id} does not match ${first.id}.`);
  }
  return {
    status: 'ok',
    eventCount: first.eventCount,
    checksum: first.checksum,
    rowIds: rows.map(entry => entry.id),
  };
}

function createFindings(variants, fixture) {
  return [
    {
      id: 'same-contract-result',
      classification: 'TRACE_FACT',
      summary: 'All sampled browser full-materialization variants preserved the same event count and checksum.',
      evidence: variants.map(entry => `${entry.id}: events=${entry.eventCount}, checksum=${entry.checksum}`),
    },
    {
      id: 'browser-allocation-sampling',
      classification: 'TRACE_FACT',
      summary: 'Chrome/Edge CDP HeapProfiler sampled JavaScript allocation self-size around each browser variant.',
      evidence: variants.map(entry => `${entry.id}: sampledBytes=${entry.profile.sampledBytes}, samples=${entry.profile.sampleCount}`),
    },
    {
      id: 'browser-memory-scope',
      classification: 'TRACE_FACT_LIMIT',
      summary: 'Per-variant memory values are browser JS heap snapshots, not host process RSS or full browser process private bytes.',
      evidence: variants.map(entry => `${entry.id}: maxJsHeapUsedBytes=${entry.memory.maxJsHeapUsedBytes}`),
    },
    {
      id: 'browser-allocation-sampling-not-ceiling-proof',
      classification: 'TRACE_FACT_LIMIT',
      summary: 'This report narrows the Chrome/V8 browser allocation-attribution gap, but it does not prove that JavaScript runtimes have no further headroom.',
      evidence: [
        `fixture=${fixture.shape}, bytes=${fixture.actualBytes}`,
        'Need non-V8 browser allocation/codegen evidence, broader fixtures, and source-level runtime proof before promoting runtime-limit claims.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Browser V8 Allocation Sampling',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report is a TRACE_FACT for one browser/V8 build and one byte-batch fixture.',
    'It uses CDP `HeapProfiler.startSampling` / `HeapProfiler.stopSampling` around same-contract browser reader variants.',
    'It is not a proof that JavaScript runtimes have no further headroom.',
    '',
    '## Environment',
    '',
    `- Browser: ${report.environment.browserName} ${report.environment.browserVersion}`,
    `- JavaScript engine: ${report.environment.javascriptEngine}`,
    `- User agent: ${report.environment.userAgent}`,
    `- CDP V8 version: ${report.environment.cdpVersion['V8-Version'] ?? 'unknown'}`,
    `- Host Node: ${report.environment.hostNode}`,
    `- Platform: ${report.environment.hostPlatform}`,
    `- CPU: ${report.environment.cpuName}`,
    `- Fixture shape: ${report.fixture.shape}`,
    `- Fixture size: ${formatBytes(report.fixture.actualBytes)} (${report.fixture.actualBytes} bytes)`,
    `- Sampling interval: ${report.options.samplingInterval} bytes`,
    '',
    '## Results',
    '',
    '| Variant | Throughput | Events | Checksum | Sampled bytes | Samples | Top function | Max browser JS heap |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |',
  ];

  for (const entry of report.variants) {
    const top = entry.profile.topFunctions[0];
    lines.push(`| ${entry.id} | ${formatRate(entry.mibPerSec)} | ${formatCount(entry.eventCount)} | ${entry.checksum} | ${formatBytes(entry.profile.sampledBytes)} | ${formatCount(entry.profile.sampleCount)} | ${escapePipe(top ? top.functionName : 'n/a')} | ${formatBytes(entry.memory.maxJsHeapUsedBytes)} |`);
  }

  lines.push('');
  lines.push('## Top Functions');
  lines.push('');
  for (const entry of report.variants) {
    lines.push(`### ${entry.id}`);
    lines.push('');
    if (entry.profile.topFunctions.length === 0) {
      lines.push('- No sampled allocation frames.');
      lines.push('');
      continue;
    }
    lines.push('| Function | Self size | Percent | Source |');
    lines.push('| --- | ---: | ---: | --- |');
    for (const frame of entry.profile.topFunctions.slice(0, 8)) {
      lines.push(`| ${escapePipe(frame.functionName)} | ${formatBytes(frame.selfSize)} | ${(frame.percent * 100).toFixed(1)}% | ${escapePipe(formatFrameSource(frame))} |`);
    }
    lines.push('');
  }

  lines.push('## Memory Scope');
  lines.push('');
  lines.push('Per-variant memory values use browser JS heap snapshots from `performance.memory`; they are not host process RSS.');
  lines.push('');
  lines.push('## Parity');
  lines.push('');
  lines.push(`- Event-count parity: ${report.eventCountParity.status}, events=${report.eventCountParity.eventCount}, rows=${report.eventCountParity.rowIds.join(', ')}`);
  lines.push(`- Full-string parity: ${report.fullStringParity.status}, events=${report.fullStringParity.eventCount}, checksum=${report.fullStringParity.checksum}, rows=${report.fullStringParity.rowIds.join(', ')}`);
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function formatFrameSource(frame) {
  if (!frame.url) return '(native or anonymous)';
  return `${frame.url}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`;
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

function formatCount(value) {
  return value.toLocaleString('en-US');
}

function escapePipe(value) {
  return String(value).replaceAll('|', '\\|');
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function printSummary(report) {
  console.log('Browser V8 allocation sampling');
  for (const entry of report.variants) {
    console.log(`${entry.id}: ${formatRate(entry.mibPerSec)} sampled=${formatBytes(entry.profile.sampledBytes)} events=${entry.eventCount} checksum=${entry.checksum}`);
  }
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
    sizeMiB: options.sizeMiB,
    fixtureShape: options.fixtureShape,
    diverseCycleSize: options.diverseCycleSize,
    batchSize: options.batchSize,
    warmups: options.warmups,
    cases: options.cases,
  };
  return `
import { StreamEventType, StreamReaderSync, XmlEventType } from '/stax/index.js';

const MIB = 1024 * 1024;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
const allStringFields = Object.freeze({
  name: true,
  text: true,
  attrName: true,
  attrValue: true,
});
const config = ${JSON.stringify(runnerConfig)};
let state;

globalThis.__staxBrowserAllocationReady = prepare().catch(error => ({
  error: {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    stack: error?.stack ?? null,
  },
}));

globalThis.__staxBrowserAllocationRun = async function runCase(caseId) {
  try {
    const variant = state.variantById.get(caseId);
    if (!variant) {
      throw new Error('Unknown case: ' + caseId);
    }
    return measureVariant(variant, state.fixture, config);
  } catch (error) {
    return {
      error: {
        name: error?.name ?? 'Error',
        message: error?.message ?? String(error),
        stack: error?.stack ?? null,
      },
    };
  }
};

globalThis.__staxBrowserAllocationSummary = function allocationSummary() {
  return {
    environment: createRuntimeEnvironment(),
    fixture: createFixtureReport(state.fixture),
  };
};

async function prepare() {
  const fixture = await createFixture(config);
  const variants = filterVariants(createVariants(fixture), config.cases);
  state = {
    fixture,
    variants,
    variantById: new Map(variants.map(variant => [variant.id, variant])),
  };
  return { ok: true };
}

function createVariants(fixture) {
  return [
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
      id: 'rawFrameNameId',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, []),
    },
  ];
}

function filterVariants(variants, caseIds) {
  const byId = new Map(variants.map(variant => [variant.id, variant]));
  return caseIds.map((id) => {
    const variant = byId.get(id);
    if (!variant) {
      throw new Error('Unknown case for this fixture: ' + id);
    }
    return variant;
  });
}

async function createFixture(options) {
  const targetBytes = Math.floor(options.sizeMiB * MIB);
  const rows = createFixtureRows(options.fixtureShape, options.diverseCycleSize);
  const rowStats = summarizeRows(rows);
  const actualBytes = computeExpectedBytes(targetBytes, rows);
  return {
    source: 'generated',
    rows,
    rowPreview: textDecoder.decode(rows[0].subarray(0, Math.min(rows[0].byteLength, 512))),
    rowPreviewTruncated: rows[0].byteLength > 512,
    rowStats,
    targetBytes,
    actualBytes,
    sizeMiB: actualBytes / MIB,
    fixtureShape: options.fixtureShape,
    diverseCycleSize: options.diverseCycleSize,
    batchSize: options.batchSize,
  };
}

function createFixtureRows(shape, cycleSize) {
  if (shape === 'repeated-person') {
    return [textEncoder.encode(makeRepeatedPersonRow())];
  }
  return Array.from({ length: cycleSize }, (_, id) => textEncoder.encode(makeDiverseRow(id)));
}

function createFixtureReport(fixture) {
  return {
    generated: true,
    source: fixture.source,
    shape: fixture.fixtureShape,
    rowXml: fixture.rowPreview,
    rowPreviewTruncated: fixture.rowPreviewTruncated,
    rowCycleSize: fixture.rows.length,
    minRowBytes: fixture.rowStats.minRowBytes,
    maxRowBytes: fixture.rowStats.maxRowBytes,
    averageRowBytes: fixture.rowStats.averageRowBytes,
    targetBytes: fixture.targetBytes,
    actualBytes: fixture.actualBytes,
    sizeMiB: fixture.sizeMiB,
    batchSize: fixture.batchSize,
  };
}

function measureVariant(variant, fixture, options) {
  for (let index = 0; index < options.warmups; index++) {
    variant.run();
  }

  forceGc();
  const memoryBefore = takeMemorySnapshot();
  const startedAt = performance.now();
  const result = variant.run();
  const elapsedMs = performance.now() - startedAt;
  const memoryAfter = takeMemorySnapshot();

  return {
    id: variant.id,
    family: variant.family,
    implementation: variant.implementation,
    contractScope: variant.contractScope,
    eventCountKind: 'stream-events',
    fullStringParity: variant.fullStringParity,
    avgMs: elapsedMs,
    minMs: elapsedMs,
    maxMs: elapsedMs,
    mibPerSec: (fixture.actualBytes / MIB) / (elapsedMs / 1000),
    eventCount: result.eventCount,
    checksum: result.checksum,
    samplesMs: [elapsedMs],
    memory: summarizeMemorySamples([createMemorySample(memoryBefore, memoryAfter)]),
    materializationCounters: result.materializationCounters,
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

  globalThis.__staxBrowserAllocationEventObjectSink = objectSink[(objectSinkIndex - 1) & (objectSink.length - 1)];
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
      return { type: XmlEventType.START_ELEMENT, name, attributes };
    }
    case StreamEventType.END_ELEMENT:
      countStringField(materializationCounters, 'name');
      return { type: XmlEventType.END_ELEMENT, name: batch.nameAt(index) };
    case StreamEventType.CHARACTERS:
      countStringField(materializationCounters, 'text');
      return { type: XmlEventType.CHARACTERS, value: batch.textAt(index) };
    case StreamEventType.CDATA:
      countStringField(materializationCounters, 'text');
      return { type: XmlEventType.CDATA, value: batch.textAt(index) };
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
    throw new Error('Unsupported raw batch kind in browser allocation sampling: ' + frame.kind);
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
  if (end - start > 12) {
    return undefined;
  }
  let codeUnits = '';
  for (let index = start; index < end; index++) {
    const byte = buffer[index];
    if (byte > 0x7f) {
      return undefined;
    }
    codeUnits += String.fromCharCode(byte);
  }
  return codeUnits;
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

function numericDelta(before, after) {
  return typeof before === 'number' && typeof after === 'number' ? after - before : null;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
`;
}

await main();
