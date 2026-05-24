import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  collectHostProcessMemorySample,
  createReport,
  printSummary,
  renderMarkdown,
  startBenchmarkServer,
  summarizeHostProcessMemory,
} from './browser-textdecoder-span-variants.mjs';
import {
  evaluateRunner,
  findFirefoxExecutable,
  FirefoxBidiClient,
  launchFirefox,
  safeRemoveDir,
  terminateBrowser,
} from './firefox-bidi-candidate-headroom.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultCorpusFile = resolve(__dirname, '../stax-xml/performance/samples/treebank_e.xml');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'firefox-bidi-textdecoder-span-variants.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'firefox-bidi-textdecoder-span-variants.md');

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
    browserExecutable: process.env.FIREFOX_PATH || findFirefoxExecutable(),
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
      case '--browser-executable':
        options.browserExecutable = resolve(process.cwd(), readValue());
        break;
      case '--browser-timeout-ms':
        options.browserTimeoutMs = parsePositiveInteger(readValue(), name);
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
  const userDataDir = mkdtempSync(join(tmpdir(), 'stax-firefox-bidi-textdecoder-'));
  try {
    const browserPort = await reservePort();
    browser = launchFirefox(options, browserPort, userDataDir);
    client = await FirefoxBidiClient.connect(`ws://127.0.0.1:${browserPort}/session`, options.browserTimeoutMs, browser);
    await client.send('session.new', { capabilities: { alwaysMatch: {} } });
    const created = await client.send('browsingContext.create', { type: 'tab' });
    contextId = created.context;
    hostProcessMemorySamples.push(collectHostProcessMemorySample(browser.pid, 'browser-started', options));
    hostProcessMemorySamples.push(collectHostProcessMemorySample(browser.pid, 'before-run', options));
    await client.send('browsingContext.navigate', {
      context: contextId,
      url: `http://127.0.0.1:${server.port}/runner.html`,
      wait: 'complete',
    });
    const browserResult = await evaluateRunner(client, contextId, options.browserTimeoutMs);
    hostProcessMemorySamples.push(collectHostProcessMemorySample(browser.pid, 'after-run', options));
    if (browserResult?.error) {
      throw new Error(`${browserResult.error.name}: ${browserResult.error.message}\n${browserResult.error.stack ?? ''}`);
    }

    const report = createReport(browserResult, options, summarizeHostProcessMemory(hostProcessMemorySamples, options));
    report.objective = 'firefox-bidi-textdecoder-span-variants';
    report.contract = 'firefox-bidi-full-string-textdecoder-span-variant-headroom';
    report.automation = {
      protocol: 'WebDriver BiDi',
      endpoint: 'ws://127.0.0.1:<port>/session',
      note: 'Firefox is driven through its built-in WebDriver BiDi endpoint without Playwright or Selenium.',
    };
    report.note = 'Firefox/SpiderMonkey TextDecoder span materialization variants under the same full-string checksum contract. Firefox page JS heap counters are unavailable, so host process-tree memory is separate evidence.';
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

function appendFirefoxNotes(markdown, report) {
  const lines = markdown.trimEnd().split('\n');
  lines.push(
    '',
    '## Firefox BiDi Notes',
    '',
    `- Automation: ${report.automation.protocol}`,
    `- Browser: ${report.environment.browserName} ${report.environment.browserVersion}`,
    `- Engine: ${report.environment.javascriptEngine}`,
    '- This path does not use Playwright, Selenium, CDP, Node `Buffer.toString()`, native addons, or lazy getters.',
    '- Firefox does not expose Chromium `performance.memory`; browser JS heap values are unavailable and host process-tree memory is not portable browser RSS or bounded JS heap proof.',
  );
  return `${lines.join('\n')}\n`;
}

async function reservePort() {
  const { createServer } = await import('node:net');
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const port = server.address().port;
  await new Promise(resolveClose => server.close(resolveClose));
  return port;
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

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
