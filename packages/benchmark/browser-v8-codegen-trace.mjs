import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const distDir = resolve(__dirname, '../stax-xml/dist');
const distIndexPath = resolve(distDir, 'index.js');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'browser-v8-codegen-trace.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'browser-v8-codegen-trace.md');

const targetFunctions = [
  'consumeBrowserStringFull',
  'consumeBrowserRawFrameNameId',
  'consumeBrowserEventObjectFull',
  'decodeBrowserSpan',
  'foldBrowserString',
  'materializeBrowserEventObject',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizeMiB: 4,
    diverseCycleSize: 512,
    batchSize: 16,
    warmups: 80,
    iterations: 6,
    cases: ['stringFull', 'rawFrameNameId', 'eventObjectFull'],
    browserExecutable: process.env.CHROME_PATH || process.env.EDGE_PATH || findBrowserExecutable(),
    browserTimeoutMs: 180_000,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
    if (arg === '--self-test') {
      options.selfTest = true;
      continue;
    }
    if (arg === '--quick') {
      options.sizeMiB = 1;
      options.diverseCycleSize = 128;
      options.warmups = 24;
      options.iterations = 2;
      continue;
    }
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
        options.sizeMiB = parsePositiveNumber(readValue(), name);
        break;
      case '--diverse-cycle-size':
        options.diverseCycleSize = parsePositiveInteger(readValue(), name);
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), name);
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--iterations':
        options.iterations = parsePositiveInteger(readValue(), name);
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

  if (options.selfTest) return options;
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
  const cases = value.split(',').map(entry => entry.trim()).filter(Boolean);
  const allowed = new Set(['stringFull', 'rawFrameNameId', 'eventObjectFull']);
  if (cases.length === 0) throw new Error('--cases must contain at least one case id.');
  for (const id of cases) {
    if (!allowed.has(id)) throw new Error(`Unknown case: ${id}`);
  }
  return cases;
}

async function main() {
  const options = parseArgs();
  const report = options.selfTest ? createSelfTestReport(options) : await runBrowserTrace(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

async function runBrowserTrace(options) {
  const server = await startServer(options);
  let browser;
  let client;
  let targetId;
  let browserPort;
  const userDataDir = mkdtempSync(join(tmpdir(), 'stax-browser-v8-codegen-'));

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
    await client.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/runner.html` });
    const prepared = await waitForReady(client, options.browserTimeoutMs);
    if (prepared?.error) {
      throw new Error(`${prepared.error.name}: ${prepared.error.message}\n${prepared.error.stack ?? ''}`);
    }

    const variants = [];
    for (const caseId of options.cases) {
      const measured = await evaluateBrowserValue(
        client,
        `globalThis.__staxBrowserCodegenRun(${JSON.stringify(caseId)})`,
        options.browserTimeoutMs,
      );
      if (measured?.error) {
        throw new Error(`${measured.error.name}: ${measured.error.message}\n${measured.error.stack ?? ''}`);
      }
      variants.push(measured);
    }

    // Give Chrome a short window to flush V8 trace logs before reading stderr.
    await delay(500);
    const optimizationStatus = await evaluateBrowserValue(
      client,
      'globalThis.__staxBrowserCodegenOptimizationStatus()',
      options.browserTimeoutMs,
    );
    if (optimizationStatus?.error) {
      throw new Error(`${optimizationStatus.error.name}: ${optimizationStatus.error.message}\n${optimizationStatus.error.stack ?? ''}`);
    }
    const traceText = browser.stderrText ?? '';
    return createReport({
      options,
      cdpVersion,
      browserResult: await evaluateBrowserValue(client, 'globalThis.__staxBrowserCodegenSummary()', options.browserTimeoutMs),
      variants,
      optimizationStatus,
      traceText,
    });
  } finally {
    await client?.close().catch(() => {});
    if (targetId && browserPort) await closePage(browserPort, targetId).catch(() => {});
    await terminateBrowser(browser);
    await server.close();
    safeRemoveDir(userDataDir);
  }
}

async function startServer(options) {
  const runnerScript = createRunnerScript(options);
  const html = '<!doctype html><meta charset="utf-8"><title>stax browser V8 codegen trace</title><script type="module" src="/runner.js"></script>';
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/runner.html') return sendText(response, 200, 'text/html; charset=utf-8', html);
    if (url.pathname === '/runner.js') return sendText(response, 200, 'text/javascript; charset=utf-8', runnerScript);
    if (url.pathname === '/stax/index.js') return sendFile(response, distIndexPath, 'text/javascript; charset=utf-8');
    if (url.pathname.startsWith('/stax/') && url.pathname.endsWith('.js')) {
      const fileName = url.pathname.slice('/stax/'.length);
      if (!fileName.includes('/') && !fileName.includes('\\')) {
        const filePath = resolve(distDir, fileName);
        if (existsSync(filePath)) return sendFile(response, filePath, 'text/javascript; charset=utf-8');
      }
    }
    return sendText(response, 404, 'text/plain; charset=utf-8', 'not found');
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
  const jsFlags = [
    '--expose-gc',
    '--allow-natives-syntax',
    '--trace-opt',
    '--trace-deopt',
    '--trace-file-names',
  ];
  const args = [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-gpu',
    '--disable-sync',
    `--js-flags=${jsFlags.join(' ')}`,
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
    if (child.stderrText.length > 4 * MIB) {
      child.stderrText = child.stderrText.slice(-4 * MIB);
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
      // Keep polling.
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
  if (!target.webSocketDebuggerUrl) throw new Error('CDP target did not include webSocketDebuggerUrl.');
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
    // Windows can keep Chrome profile files locked briefly after process exit.
  }
}

async function waitForReady(client, timeoutMs) {
  const expression = `
    new Promise((resolve) => {
      const startedAt = performance.now();
      const tick = () => {
        if (globalThis.__staxBrowserCodegenReady) {
          Promise.resolve(globalThis.__staxBrowserCodegenReady).then(resolve, (error) => {
            resolve({ error: { name: error?.name ?? 'Error', message: error?.message ?? String(error), stack: error?.stack ?? null } });
          });
          return;
        }
        if (performance.now() - startedAt > ${JSON.stringify(timeoutMs - 1000)}) {
          resolve({ error: { name: 'TimeoutError', message: 'Timed out waiting for browser codegen runner.', stack: null } });
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
  }), timeoutMs, 'Timed out waiting for browser codegen runner readiness.');
  if (result.exceptionDetails) throw new Error(`Browser readiness evaluation failed: ${formatExceptionDetails(result.exceptionDetails)}`);
  return result.result.value;
}

async function evaluateBrowserValue(client, expression, timeoutMs) {
  const result = await withTimeout(client.send('Runtime.evaluate', {
    expression: `Promise.resolve(${expression}).catch(error => ({ error: { name: error?.name ?? 'Error', message: error?.message ?? String(error), stack: error?.stack ?? null } }))`,
    awaitPromise: true,
    returnByValue: true,
  }), timeoutMs, 'Timed out waiting for browser codegen evaluation.');
  if (result.exceptionDetails) throw new Error(`Browser evaluation failed: ${formatExceptionDetails(result.exceptionDetails)}`);
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
    socket.addEventListener('message', event => this.handleMessage(event));
    socket.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) reject(new Error('CDP socket closed.'));
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
    if (message.error) {
      pending.reject(new Error(`${message.error.message}: ${message.error.data ?? ''}`));
      return;
    }
    pending.resolve(message.result);
  }

  async close() {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.close();
  }
}

function createReport({ options, cdpVersion, browserResult, variants, optimizationStatus, traceText }) {
  const traceSummary = summarizeTrace(traceText);
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'browser-v8-codegen-trace',
    contract: 'browser-v8-trace-opt-deopt-same-contract-reader-shapes',
    note: 'Chrome/Edge browser V8 optimization-status and optional --trace-opt/--trace-deopt stderr evidence for selected same-contract browser reader functions. This is browser-build-specific trace evidence, not a throughput ceiling proof and not a source-code proof.',
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
      diverseCycleSize: options.diverseCycleSize,
      batchSize: options.batchSize,
      warmups: options.warmups,
      iterations: options.iterations,
      cases: options.cases,
      jsFlags: ['--expose-gc', '--allow-natives-syntax', '--trace-opt', '--trace-deopt', '--trace-file-names'],
    },
    variants,
    optimizationStatus,
    traceSummary,
    findings: createFindings(variants, optimizationStatus, traceSummary),
  };
  validateReport(report);
  return report;
}

function summarizeTrace(traceText) {
  const lines = traceText.split(/\r?\n/).filter(Boolean);
  const optLines = lines.filter(line => /optimizing|marking .* for optimization|completed optimizing/i.test(line));
  const deoptLines = lines.filter(line => /deopt/i.test(line));
  const targetHits = targetFunctions.map(functionName => ({
    functionName,
    optimizingMentions: countMatches(traceText, new RegExp(`${escapeRegExp(functionName)}[^\\n]*(?:optimizing|optimization)|(?:optimizing|optimization)[^\\n]*${escapeRegExp(functionName)}`, 'gi')),
    deoptMentions: countMatches(traceText, new RegExp(`${escapeRegExp(functionName)}[^\\n]*deopt|deopt[^\\n]*${escapeRegExp(functionName)}`, 'gi')),
    traceMentions: countMatches(traceText, new RegExp(escapeRegExp(functionName), 'g')),
  }));
  return {
    rawBytes: Buffer.byteLength(traceText),
    lineCount: lines.length,
    optimizingLineCount: optLines.length,
    deoptLineCount: deoptLines.length,
    targetFunctionHits: targetHits,
    excerpts: [...optLines, ...deoptLines]
      .filter(line => targetFunctions.some(name => line.includes(name)))
      .slice(0, 24),
    stderrTail: traceText.slice(-8192),
  };
}

function countMatches(text, pattern) {
  return text.match(pattern)?.length ?? 0;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateReport(report) {
  const mismatch = report.variants.find(row => !row.fullStringParity || row.eventCount !== report.variants[0].eventCount || row.checksum !== report.variants[0].checksum);
  if (mismatch) throw new Error(`Variant ${mismatch.id} does not preserve full-string parity.`);
  if (!report.optimizationStatus?.available) {
    throw new Error('Browser V8 optimization status was not available.');
  }
  if (!report.optimizationStatus.functions.some(item => item.status > 0)) {
    throw new Error('Browser V8 optimization status did not report any optimized target functions.');
  }
}

function createFindings(variants, optimizationStatus, traceSummary) {
  return [
    {
      id: 'browser-v8-trace-opt-captured',
      classification: 'TRACE_FACT',
      summary: 'Chrome/Edge browser V8 exposed optimization-status evidence while running same-contract browser reader variants.',
      evidence: [
        `optimizationStatusAvailable=${true}`,
        `optimizedTargetFunctions=${optimizationStatus.functions.filter(item => item.status > 0).length}`,
        `traceBytes=${traceSummary.rawBytes}`,
        `optimizingLines=${traceSummary.optimizingLineCount}`,
        `deoptLines=${traceSummary.deoptLineCount}`,
      ],
    },
    {
      id: 'browser-v8-trace-same-contract',
      classification: 'TRACE_FACT',
      summary: 'The traced browser variants preserved full-string event count and checksum parity.',
      evidence: variants.map(row => `${row.id}: events=${row.eventCount}, checksum=${row.checksum}, mibPerSec=${row.mibPerSec.toFixed(2)}`),
    },
    {
      id: 'browser-v8-trace-scope-limit',
      classification: 'TRACE_FACT_LIMIT',
      summary: 'This is selected-function browser V8 trace evidence, not a complete generated-code proof and not a runtime ceiling proof.',
      evidence: [
        'V8 optimization status is captured from the page; raw trace logs are summarized when Chrome emits them.',
        'Safari/WebKit and Firefox/SpiderMonkey codegen/allocation obligations remain separate.',
      ],
    },
  ];
}

function createSelfTestReport(options) {
  return createReport({
    options,
    cdpVersion: { Browser: 'HeadlessChrome/0.0.0.0', 'V8-Version': '0.0.0-test' },
    browserResult: {
      environment: {
        runtimeName: 'browser',
        browserName: 'HeadlessChrome',
        browserVersion: '0.0.0.0',
        javascriptEngine: 'V8',
        userAgent: 'Mozilla/5.0 HeadlessChrome/0.0.0.0',
      },
      fixture: {
        generated: true,
        source: 'generated',
        shape: 'diverse-cycle',
        actualBytes: 1048576,
        sizeMiB: 1,
        batchSize: options.batchSize,
      },
    },
    variants: options.cases.map(id => ({
      id,
      fullStringParity: true,
      avgMs: 10,
      mibPerSec: 100,
      eventCount: 1234,
      checksum: 5678,
    })),
    optimizationStatus: {
      available: true,
      functions: targetFunctions.map((functionName, index) => ({
        functionName,
        status: index < 2 ? 81 : 1,
      })),
    },
    traceText: [
      '[marking 0x1 <JSFunction consumeBrowserStringFull (sfi = 0x2)> for optimization to TURBOFAN]',
      '[optimizing 0x1 <JSFunction consumeBrowserStringFull (sfi = 0x2)> (target TURBOFAN)]',
      '[optimizing 0x3 <JSFunction consumeBrowserRawFrameNameId (sfi = 0x4)> (target TURBOFAN)]',
    ].join('\n'),
  });
}

function renderMarkdown(report) {
  const lines = [
    '# Browser V8 Codegen Trace',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report is a TRACE_FACT for one browser/V8 build and selected same-contract reader functions.',
    'It uses browser V8 optimization status with `--allow-natives-syntax` and optional `--trace-opt --trace-deopt --trace-file-names` output. It is not a runtime ceiling proof.',
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
    `- Fixture size: ${formatBytes(report.fixture.actualBytes)} (${report.fixture.actualBytes} bytes)`,
    `- V8 optimization status available: ${report.optimizationStatus.available}`,
    '',
    '## Variant Parity',
    '',
    '| Case | MiB/s | Events | Checksum |',
    '| --- | ---: | ---: | ---: |',
    ...report.variants.map(row => `| ${row.id} | ${row.mibPerSec.toFixed(2)} | ${row.eventCount} | ${row.checksum} |`),
    '',
    '## Trace Summary',
    '',
    `- Trace bytes: ${report.traceSummary.rawBytes}`,
    `- Trace lines: ${report.traceSummary.lineCount}`,
    `- Optimization lines: ${report.traceSummary.optimizingLineCount}`,
    `- Deopt lines: ${report.traceSummary.deoptLineCount}`,
    '',
    '| Function | Trace mentions | Optimization mentions | Deopt mentions |',
    '| --- | ---: | ---: | ---: |',
    ...report.traceSummary.targetFunctionHits.map(hit => `| ${hit.functionName} | ${hit.traceMentions} | ${hit.optimizingMentions} | ${hit.deoptMentions} |`),
    '',
    '## V8 Optimization Status',
    '',
    '| Function | Status |',
    '| --- | ---: |',
    ...report.optimizationStatus.functions.map(item => `| ${item.functionName} | ${item.status} |`),
    '',
    '## Findings',
    '',
    ...report.findings.flatMap(finding => [
      `- ${finding.id} (${finding.classification}): ${finding.summary}`,
      ...finding.evidence.map(item => `  - ${item}`),
    ]),
    '',
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}

function formatBytes(bytes) {
  return `${(bytes / MIB).toFixed(2)} MiB`;
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log(JSON.stringify({
    objective: report.objective,
    browser: `${report.environment.browserName} ${report.environment.browserVersion}`,
    optimizedTargetFunctions: report.optimizationStatus.functions.filter(item => item.status > 0).length,
    optimizingLineCount: report.traceSummary.optimizingLineCount,
    deoptLineCount: report.traceSummary.deoptLineCount,
    targetMentions: report.traceSummary.targetFunctionHits.filter(hit => hit.traceMentions > 0).length,
  }, null, 2));
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
  const config = {
    sizeMiB: options.sizeMiB,
    diverseCycleSize: options.diverseCycleSize,
    batchSize: options.batchSize,
    warmups: options.warmups,
    iterations: options.iterations,
    cases: options.cases,
  };
  return `
import { StreamEventType, StreamReaderSync, XmlEventType } from '/stax/index.js';

const MIB = 1024 * 1024;
const textEncoder = new TextEncoder();
const config = ${JSON.stringify(config)};
let state;

globalThis.__staxBrowserCodegenReady = prepare().catch(error => ({
  error: { name: error?.name ?? 'Error', message: error?.message ?? String(error), stack: error?.stack ?? null },
}));

globalThis.__staxBrowserCodegenRun = async function runCase(caseId) {
  try {
    const variant = state.variantById.get(caseId);
    if (!variant) throw new Error('Unknown case: ' + caseId);
    return measureVariant(variant, state.fixture, config);
  } catch (error) {
    return { error: { name: error?.name ?? 'Error', message: error?.message ?? String(error), stack: error?.stack ?? null } };
  }
};

globalThis.__staxBrowserCodegenSummary = function summary() {
  return {
    environment: createRuntimeEnvironment(),
    fixture: {
      generated: true,
      source: 'generated',
      shape: 'diverse-cycle',
      actualBytes: state.fixture.actualBytes,
      sizeMiB: state.fixture.actualBytes / MIB,
      batchSize: state.fixture.batchSize,
    },
  };
};

globalThis.__staxBrowserCodegenOptimizationStatus = function optimizationStatus() {
  try {
    const statusOf = Function('fn', 'return %GetOptimizationStatus(fn);');
    return {
      available: true,
      functions: [
        ['consumeBrowserStringFull', consumeBrowserStringFull],
        ['consumeBrowserRawFrameNameId', consumeBrowserRawFrameNameId],
        ['consumeBrowserEventObjectFull', consumeBrowserEventObjectFull],
        ['decodeBrowserSpan', decodeBrowserSpan],
        ['foldBrowserString', foldBrowserString],
        ['materializeBrowserEventObject', materializeBrowserEventObject],
      ].map(([functionName, fn]) => ({ functionName, status: statusOf(fn) })),
    };
  } catch (error) {
    return {
      available: false,
      error: { name: error?.name ?? 'Error', message: error?.message ?? String(error) },
      functions: [],
    };
  }
};

async function prepare() {
  const fixture = createFixture(config);
  const variants = [
    { id: 'stringFull', run: () => consumeBrowserStringFull(fixture) },
    { id: 'rawFrameNameId', run: () => consumeBrowserRawFrameNameId(fixture) },
    { id: 'eventObjectFull', run: () => consumeBrowserEventObjectFull(fixture) },
  ].filter(variant => config.cases.includes(variant.id));
  state = { fixture, variants, variantById: new Map(variants.map(variant => [variant.id, variant])) };
  for (const variant of variants) {
    for (let index = 0; index < config.warmups; index++) variant.run();
  }
  return { ok: true };
}

function createFixture(options) {
  const prefix = textEncoder.encode('<root>\\n');
  const suffix = textEncoder.encode('</root>\\n');
  const rows = Array.from({ length: options.diverseCycleSize }, (_, id) => textEncoder.encode(makeDiverseRow(id)));
  const targetBytes = Math.floor(options.sizeMiB * MIB);
  const rowBytes = rows.reduce((sum, row) => sum + row.byteLength, 0);
  const cycles = Math.max(1, Math.ceil(Math.max(0, targetBytes - prefix.byteLength - suffix.byteLength) / rowBytes));
  const parts = [prefix];
  for (let cycle = 0; cycle < cycles; cycle++) {
    parts.push(...rows);
  }
  parts.push(suffix);
  const documentBytes = concatRows(parts, prefix.byteLength + (cycles * rowBytes) + suffix.byteLength);
  return {
    prefix,
    rows,
    suffix,
    cycles,
    documentBytes,
    actualBytes: documentBytes.byteLength,
    batchSize: options.batchSize,
  };
}

function measureVariant(variant, fixture, options) {
  let best = null;
  for (let index = 0; index < options.iterations; index++) {
    if (typeof globalThis.gc === 'function') globalThis.gc();
    const startedAt = performance.now();
    const result = variant.run();
    const elapsedMs = performance.now() - startedAt;
    const row = {
      id: variant.id,
      fullStringParity: true,
      avgMs: elapsedMs,
      mibPerSec: (fixture.actualBytes / MIB) / (elapsedMs / 1000),
      eventCount: result.eventCount,
      checksum: result.checksum,
    };
    if (!best || row.mibPerSec > best.mibPerSec) best = row;
  }
  return best;
}

function consumeBrowserStringFull(fixture) {
  let eventCount = 0;
  let checksum = 0;
  for (const batch of new StreamReaderSync(byteBatches(fixture))) {
    for (let index = 0; index < batch.eventCount; index++) {
      const type = batch.typeAt(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);
      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        checksum = foldBrowserString(checksum, batch.nameAt(index));
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        checksum = foldBrowserString(checksum, batch.textAt(index)?.trim());
      }
      if (type === StreamEventType.START_ELEMENT) {
        const attrCount = batch.attributeCountAt(index);
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          checksum = foldBrowserString(checksum, batch.attributeNameAt(index, attrIndex));
          checksum = foldBrowserString(checksum, batch.attributeValueAt(index, attrIndex));
        }
      }
    }
  }
  return { eventCount, checksum };
}

function consumeBrowserRawFrameNameId(fixture) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const parser = new StreamReaderSync(byteBatches(fixture));
  const nameIds = new Map();
  let nextNameId = 1;
  let eventCount = 0;
  let checksum = 0;
  let frame;
  while ((frame = parser.nextRawBatch()) !== null) {
    if (frame.kind !== 'frame') throw new Error('Unsupported raw batch kind: ' + frame.kind);
    for (let index = 0; index < frame.eventCount; index++) {
      const type = frame.eventTypes[index];
      eventCount++;
      checksum = mixChecksum(checksum, type);
      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        const name = decodeBrowserSpan(frame.buffer, frame.nameStarts[index], frame.nameEnds[index], decoder);
        let id = nameIds.get(name);
        if (id === undefined) {
          id = nextNameId++;
          nameIds.set(name, id);
        }
        checksum = foldBrowserString(checksum, name);
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        const start = frame.textStarts[index];
        if (start >= 0) {
          checksum = foldBrowserString(checksum, decodeBrowserSpan(frame.buffer, start, frame.textEnds[index], decoder).trim());
        }
      }
      if (type === StreamEventType.START_ELEMENT) {
        const attrStart = frame.attrStarts[index];
        const attrCount = frame.attrCounts[index];
        checksum = mixChecksum(checksum, attrCount);
        const attrEnd = attrStart + attrCount;
        for (let attrIndex = attrStart; attrIndex < attrEnd; attrIndex++) {
          checksum = foldBrowserString(checksum, decodeBrowserSpan(frame.buffer, frame.attrNameStarts[attrIndex], frame.attrNameEnds[attrIndex], decoder));
          checksum = foldBrowserString(checksum, decodeBrowserSpan(frame.buffer, frame.attrValueStarts[attrIndex], frame.attrValueEnds[attrIndex], decoder));
        }
      }
    }
  }
  globalThis.__staxBrowserCodegenNameIds = nameIds.size;
  return { eventCount, checksum };
}

function consumeBrowserEventObjectFull(fixture) {
  const sink = new Array(1024);
  let sinkIndex = 0;
  let eventCount = 0;
  let checksum = 0;
  for (const batch of new StreamReaderSync(byteBatches(fixture))) {
    for (let index = 0; index < batch.eventCount; index++) {
      const event = materializeBrowserEventObject(batch, index);
      sink[sinkIndex & (sink.length - 1)] = event;
      sinkIndex++;
      eventCount++;
      checksum = mixChecksum(checksum, publicEventTypeCode(event.type));
      if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
        checksum = foldBrowserString(checksum, event.name);
      }
      if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
        checksum = foldBrowserString(checksum, event.value?.trim());
      }
      if (event.type === XmlEventType.START_ELEMENT) {
        const entries = Object.entries(event.attributes);
        checksum = mixChecksum(checksum, entries.length);
        for (const [name, value] of entries) {
          checksum = foldBrowserString(checksum, name);
          checksum = foldBrowserString(checksum, value);
        }
      }
    }
  }
  globalThis.__staxBrowserCodegenEventSink = sink[(sinkIndex - 1) & (sink.length - 1)];
  return { eventCount, checksum };
}

function materializeBrowserEventObject(batch, index) {
  const type = batch.typeAt(index);
  switch (type) {
    case StreamEventType.START_DOCUMENT:
      return { type: XmlEventType.START_DOCUMENT };
    case StreamEventType.END_DOCUMENT:
      return { type: XmlEventType.END_DOCUMENT };
    case StreamEventType.START_ELEMENT: {
      const attributes = {};
      for (let attrIndex = 0; attrIndex < batch.attributeCountAt(index); attrIndex++) {
        attributes[batch.attributeNameAt(index, attrIndex)] = batch.attributeValueAt(index, attrIndex);
      }
      return { type: XmlEventType.START_ELEMENT, name: batch.nameAt(index), attributes };
    }
    case StreamEventType.END_ELEMENT:
      return { type: XmlEventType.END_ELEMENT, name: batch.nameAt(index) };
    case StreamEventType.CHARACTERS:
      return { type: XmlEventType.CHARACTERS, value: batch.textAt(index) };
    case StreamEventType.CDATA:
      return { type: XmlEventType.CDATA, value: batch.textAt(index) };
    default:
      throw new Error('Unsupported stream event type: ' + type);
  }
}

function decodeBrowserSpan(buffer, start, end, decoder) {
  if (end <= start) return '';
  return decoder.decode(buffer.subarray(start, end));
}

function* byteBatches(fixture) {
  yield [fixture.documentBytes];
}

function concatRows(rows, totalBytes) {
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const row of rows) {
    bytes.set(row, offset);
    offset += row.byteLength;
  }
  return bytes;
}

function makeDiverseRow(id) {
  const tag = 'n' + (id % 251);
  const attr = 'a' + (id % 37);
  const value = 'v' + ((id * 17) % 997);
  const text = 'text-' + id + '-' + ((id * 48271) % 2147483647);
  if (id % 11 === 0) return '<' + tag + ' ' + attr + '="' + value + '"><![CDATA[' + text + ']]></' + tag + '>\\n';
  if (id % 7 === 0) return '<' + tag + ' ' + attr + '="' + value + '"><child>' + text + '</child></' + tag + '>\\n';
  return '<' + tag + ' ' + attr + '="' + value + '">' + text + '</' + tag + '>\\n';
}

function foldBrowserString(seed, value) {
  if (value == null) return mixChecksum(seed, 0x9e3779b9);
  let hash = seed | 0;
  for (let index = 0; index < value.length; index++) {
    hash = mixChecksum(hash, value.charCodeAt(index));
  }
  return hash;
}

function mixChecksum(seed, value) {
  return Math.imul(seed ^ value, 16777619) | 0;
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

function createRuntimeEnvironment() {
  const ua = navigator.userAgent;
  const browserMatch = ua.match(/(HeadlessChrome|Chrome|Edg)\\/([\\d.]+)/);
  return {
    runtimeName: 'browser',
    browserName: browserMatch?.[1] ?? 'browser',
    browserVersion: browserMatch?.[2] ?? 'unknown',
    javascriptEngine: 'V8',
    userAgent: ua,
  };
}
`;
}

await main();
