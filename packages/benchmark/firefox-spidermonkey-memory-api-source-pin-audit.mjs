import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { reservePort } from './browser-candidate-headroom.mjs';
import {
  FirefoxBidiClient,
  findFirefoxExecutable,
  launchFirefox,
  safeRemoveDir,
  terminateBrowser,
} from './firefox-bidi-candidate-headroom.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-memory-api-source-pin-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-memory-api-source-pin-audit.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    browserExecutable: process.env.FIREFOX_PATH || findFirefoxExecutable(),
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

  if (!options.browserExecutable) {
    throw new Error('Firefox executable was not found. Pass --browser-executable or set FIREFOX_PATH.');
  }
  return options;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

async function main() {
  const options = parseArgs();
  const userDataDir = mkdtempSync(join(tmpdir(), 'stax-firefox-memory-api-audit-'));
  let browser;
  let client;
  let contextId;
  try {
    const browserPort = await reservePort();
    browser = launchFirefox(options, browserPort, userDataDir);
    client = await FirefoxBidiClient.connect(`ws://127.0.0.1:${browserPort}/session`, options.browserTimeoutMs, browser);
    await client.send('session.new', { capabilities: { alwaysMatch: {} } });
    const created = await client.send('browsingContext.create', { type: 'tab' });
    contextId = created.context;
    await client.send('browsingContext.navigate', {
      context: contextId,
      url: 'data:text/html,<meta charset="utf-8"><title>stax firefox memory api audit</title>',
      wait: 'complete',
    });

    const pageProbe = await evaluateJson(client, contextId, createPageProbeExpression(), options.browserTimeoutMs);
    const report = createReport({ options, pageProbe, browserStderr: browser.stderrText ?? '' });
    writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
    writeOutput(options.mdOut, renderMarkdown(report));
    printSummary(report);
  } finally {
    if (contextId) {
      await client?.send('browsingContext.close', { context: contextId }).catch(() => {});
    }
    await client?.send('session.end', {}).catch(() => {});
    await client?.close().catch(() => {});
    await terminateBrowser(browser);
    safeRemoveDir(userDataDir);
  }
}

function createPageProbeExpression() {
  return `
    JSON.stringify((() => {
      const read = (fn) => {
        try {
          return fn();
        } catch (error) {
          return { error: { name: error?.name ?? 'Error', message: error?.message ?? String(error) } };
        }
      };
      const components = read(() => ({
        type: typeof Components,
        keys: typeof Components === 'object' ? Object.keys(Components).slice(0, 20) : [],
        classesType: typeof Components?.classes,
        interfacesType: typeof Components?.interfaces,
        memoryReporterManager: String(Components?.classes?.['@mozilla.org/memory-reporter-manager;1']),
        nsIMemoryReporterManager: String(Components?.interfaces?.nsIMemoryReporterManager),
      }));
      return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        crossOriginIsolated: globalThis.crossOriginIsolated,
        pageApis: {
          performanceMemory: typeof performance.memory,
          measureUserAgentSpecificMemory: typeof performance.measureUserAgentSpecificMemory,
          gc: typeof globalThis.gc,
          SpecialPowers: typeof globalThis.SpecialPowers,
          ChromeUtils: typeof globalThis.ChromeUtils,
          Cu: typeof globalThis.Cu,
          Components: typeof globalThis.Components,
        },
        components,
      };
    })())
  `;
}

async function evaluateJson(client, contextId, expression, timeoutMs) {
  const result = await withTimeout(client.send('script.evaluate', {
    expression,
    target: { context: contextId },
    awaitPromise: true,
    resultOwnership: 'none',
  }), timeoutMs, 'Timed out waiting for Firefox memory API audit evaluation.');
  if (result.type !== 'success') {
    throw new Error(`Firefox BiDi script evaluation failed: ${JSON.stringify(result)}`);
  }
  const remote = result.result;
  if (remote?.type !== 'string') {
    throw new Error(`Firefox BiDi script evaluation did not return a string: ${JSON.stringify(remote)}`);
  }
  return JSON.parse(remote.value);
}

function createReport({ options, pageProbe, browserStderr }) {
  const application = readFirefoxApplicationInfo(options.browserExecutable);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'firefox-spidermonkey-memory-api-source-pin-audit',
    contract: 'firefox-bidi-page-memory-api-boundary',
    note: 'Runtime/source-boundary audit for Firefox/SpiderMonkey page memory and allocation APIs used by the browser benchmark rows. This is negative capability evidence, not an allocation profile and not a bounded-memory counterexample.',
    runtime: {
      runtimeName: 'browser',
      browserName: 'Firefox',
      javascriptEngine: 'SpiderMonkey',
      executable: options.browserExecutable,
      userAgent: pageProbe.userAgent,
      platform: pageProbe.platform,
      application,
    },
    automation: {
      protocol: 'WebDriver BiDi',
      endpoint: 'ws://127.0.0.1:<port>/session',
      note: 'Probe uses the same built-in Firefox BiDi endpoint as the Firefox benchmark rows.',
    },
    probes: {
      page: pageProbe,
      browserStderrTail: browserStderr.slice(-4096),
    },
    findings: createFindings(pageProbe),
  };
}

function readFirefoxApplicationInfo(executable) {
  const installDir = dirname(executable);
  const applicationIni = readIniIfExists(join(installDir, 'application.ini'));
  const platformIni = readIniIfExists(join(installDir, 'platform.ini'));
  return {
    version: applicationIni.Version ?? null,
    buildId: applicationIni.BuildID ?? null,
    sourceRepository: platformIni.SourceRepository ?? applicationIni.SourceRepository ?? null,
    sourceStamp: platformIni.SourceStamp ?? applicationIni.SourceStamp ?? null,
  };
}

function readIniIfExists(filePath) {
  try {
    const text = readFileSync(filePath, 'utf8');
    const values = {};
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([^=;\[][^=]*)=(.*)$/);
      if (match) values[match[1].trim()] = match[2].trim();
    }
    return values;
  } catch {
    return {};
  }
}

function createFindings(pageProbe) {
  const apis = pageProbe.pageApis;
  return [
    {
      id: 'firefox-page-heap-api-unavailable',
      classification: 'SOURCE_FACT',
      summary: 'The tested Firefox page context does not expose Chromium performance.memory or measureUserAgentSpecificMemory.',
      evidence: [
        `performance.memory=${apis.performanceMemory}`,
        `performance.measureUserAgentSpecificMemory=${apis.measureUserAgentSpecificMemory}`,
      ],
    },
    {
      id: 'firefox-privileged-memory-reporter-unavailable-to-page-bidi',
      classification: 'SOURCE_FACT',
      summary: 'The tested BiDi page context does not expose privileged memory reporter globals needed for a JS heap or allocation profile.',
      evidence: [
        `SpecialPowers=${apis.SpecialPowers}`,
        `ChromeUtils=${apis.ChromeUtils}`,
        `Cu=${apis.Cu}`,
        `Components.classes=${pageProbe.components.classesType}`,
        `Components.interfaces.nsIMemoryReporterManager=${pageProbe.components.nsIMemoryReporterManager}`,
      ],
    },
    {
      id: 'host-counter-boundary',
      classification: 'TRACE_FACT_LIMIT',
      summary: 'Current Firefox benchmark memory remains host process-tree evidence unless a separate privileged/profiler path is added.',
      evidence: [
        'This audit explains the missing row-level JS heap proof; it does not replace a SpiderMonkey allocator stack/type profile.',
        'Firefox/SpiderMonkey benchmark rows must stay classified separately from bounded JS heap counterexamples.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const app = report.runtime.application;
  const apis = report.probes.page.pageApis;
  const components = report.probes.page.components;
  const lines = [
    '# Firefox/SpiderMonkey Memory API Source Pin Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report is a SOURCE_FACT for the tested Firefox/SpiderMonkey browser memory API boundary.',
    'It is negative capability evidence for the current BiDi page context, not an allocation profile and not a runtime ceiling proof.',
    '',
    '## Runtime',
    '',
    `- User agent: ${report.runtime.userAgent}`,
    `- Firefox version: ${app.version ?? 'unknown'}`,
    `- Build ID: ${app.buildId ?? 'unknown'}`,
    `- Source repository: ${app.sourceRepository ?? 'unknown'}`,
    `- Source stamp: ${app.sourceStamp ?? 'unknown'}`,
    `- Executable: ${report.runtime.executable}`,
    '',
    '## Page Memory API Probe',
    '',
    `- performance.memory: ${apis.performanceMemory}`,
    `- performance.measureUserAgentSpecificMemory: ${apis.measureUserAgentSpecificMemory}`,
    `- globalThis.gc: ${apis.gc}`,
    `- SpecialPowers: ${apis.SpecialPowers}`,
    `- ChromeUtils: ${apis.ChromeUtils}`,
    `- Cu: ${apis.Cu}`,
    `- Components: ${apis.Components}`,
    `- Components keys: ${Array.isArray(components.keys) ? components.keys.join(', ') : 'n/a'}`,
    `- Components.classes: ${components.classesType}`,
    `- Components.interfaces: ${components.interfacesType}`,
    `- nsIMemoryReporterManager: ${components.nsIMemoryReporterManager}`,
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

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log(JSON.stringify({
    objective: report.objective,
    userAgent: report.runtime.userAgent,
    performanceMemory: report.probes.page.pageApis.performanceMemory,
    measureUserAgentSpecificMemory: report.probes.page.pageApis.measureUserAgentSpecificMemory,
    componentsClasses: report.probes.page.components.classesType,
  }, null, 2));
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

await main();
