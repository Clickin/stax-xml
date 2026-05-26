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
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-buildconfig-source-pin-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-buildconfig-source-pin-audit.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    browserExecutable: process.env.FIREFOX_PATH || findFirefoxExecutable(),
    browserTimeoutMs: 60_000,
    selfTest: false,
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
      case '--self-test':
        options.selfTest = true;
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
  return options;
}

async function main() {
  const options = parseArgs();
  const report = options.selfTest ? createSelfTestReport(options) : await runAudit(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

async function runAudit(options) {
  const installation = readInstallationMetadata(options.browserExecutable);
  let browser;
  let client;
  let contextId;
  const userDataDir = mkdtempSync(join(tmpdir(), 'stax-firefox-buildconfig-'));
  try {
    const browserPort = await reservePort();
    browser = launchFirefox(options, browserPort, userDataDir);
    client = await FirefoxBidiClient.connect(`ws://127.0.0.1:${browserPort}/session`, options.browserTimeoutMs, browser);
    await client.send('session.new', { capabilities: { alwaysMatch: {} } });
    const created = await client.send('browsingContext.create', { type: 'tab' });
    contextId = created.context;
    await client.send('browsingContext.navigate', { context: contextId, url: 'about:buildconfig', wait: 'complete' });
    const buildconfig = await readPageText(client, contextId, options.browserTimeoutMs);
    await client.send('browsingContext.close', { context: contextId }).catch(() => {});
    contextId = null;
    await client.send('session.end', {}).catch(() => {});
    await client.close().catch(() => {});
    client = null;
    await terminateBrowser(browser);
    browser = null;
    return createReport(options, installation, {
      completed: true,
      error: null,
      title: buildconfig.title,
      text: buildconfig.text,
    });
  } catch (error) {
    return createReport(options, installation, {
      completed: false,
      error: error?.message ?? String(error),
      title: null,
      text: '',
    });
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

async function readPageText(client, contextId, timeoutMs) {
  const expression = `JSON.stringify({
    title: document.title,
    text: document.body?.innerText ?? document.documentElement?.innerText ?? ''
  })`;
  const result = await withTimeout(client.send('script.evaluate', {
    expression,
    target: { context: contextId },
    awaitPromise: false,
    resultOwnership: 'none',
  }), timeoutMs, 'Timed out reading Firefox about:buildconfig.');
  if (result.type !== 'success') {
    throw new Error(`Firefox BiDi script evaluation failed: ${JSON.stringify(result)}`);
  }
  if (result.result?.type !== 'string') {
    throw new Error(`Firefox BiDi script evaluation did not return a string: ${JSON.stringify(result.result)}`);
  }
  return JSON.parse(result.result.value);
}

function readInstallationMetadata(browserExecutable) {
  if (!browserExecutable) {
    return { browserExecutable: null, applicationIni: null, platformIni: null };
  }
  const installDir = dirname(resolve(process.cwd(), browserExecutable));
  return {
    browserExecutable: resolve(process.cwd(), browserExecutable),
    applicationIni: readIniFile(join(installDir, 'application.ini')),
    platformIni: readIniFile(join(installDir, 'platform.ini')),
  };
}

function readIniFile(path) {
  try {
    const text = readFileSync(path, 'utf8');
    return { path, text, values: parseIni(text) };
  } catch (error) {
    return { path, text: null, values: {}, error: error?.message ?? String(error) };
  }
}

function parseIni(text) {
  const values = {};
  let section = '';
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    const sectionMatch = line.match(/^\[(.+)]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      values[section] ??= {};
      continue;
    }
    const equals = line.indexOf('=');
    if (equals < 0) continue;
    values[section] ??= {};
    values[section][line.slice(0, equals)] = line.slice(equals + 1);
  }
  return values;
}

function createReport(options, installation, buildconfig) {
  const text = buildconfig.text ?? '';
  const app = installation.applicationIni?.values?.App ?? {};
  const build = installation.platformIni?.values?.Build ?? {};
  const summary = {
    browserExecutable: installation.browserExecutable,
    version: app.Version ?? build.Milestone ?? null,
    buildId: app.BuildID ?? build.BuildID ?? null,
    sourceRepository: app.SourceRepository ?? build.SourceRepository ?? null,
    sourceStamp: app.SourceStamp ?? build.SourceStamp ?? null,
    aboutBuildconfigCompleted: buildconfig.completed,
    aboutBuildconfigTitle: buildconfig.title,
    configureMentionsEnableJsShell: /--enable-js-shell\b/.test(text),
    configureMentionsMozPackageJsShell: /\bMOZ_PACKAGE_JSSHELL=1\b/.test(text),
    configureMentionsEnableJitSpew: /--enable-jitspew\b/.test(text),
    configureMentionsJsJitSpew: /\bJS_JITSPEW\b/.test(text),
    configureMentionsStructuredSpew: /\bJS_STRUCTURED_SPEW\b/.test(text),
  };
  return {
    generatedAt: new Date().toISOString(),
    objective: 'firefox-spidermonkey-buildconfig-source-pin-audit',
    contract: 'installed-firefox-buildconfig-jitspew-boundary',
    note: 'Pins installed Firefox build metadata and about:buildconfig diagnostic flags for the SpiderMonkey JitSpew/codegen evidence gap. This is build/source-boundary evidence, not emitted JIT IR or optimized-code proof.',
    parameters: {
      browserExecutable: options.browserExecutable,
      browserTimeoutMs: options.browserTimeoutMs,
      selfTest: options.selfTest,
    },
    summary,
    installation,
    aboutBuildconfig: {
      completed: buildconfig.completed,
      error: buildconfig.error,
      title: buildconfig.title,
      textExcerpt: keepExcerpt(text),
    },
    findings: createFindings(summary, buildconfig),
  };
}

function createSelfTestReport(options) {
  return createReport(options, {
    browserExecutable: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
    applicationIni: {
      path: 'application.ini',
      text: '',
      values: {
        App: {
          Version: '143.0.1',
          BuildID: '20250918214338',
          SourceRepository: 'https://hg.mozilla.org/releases/mozilla-release',
          SourceStamp: '644b498d517849c3fb95679e2017e965fe62b77a',
        },
      },
    },
    platformIni: {
      path: 'platform.ini',
      text: '',
      values: {},
    },
  }, {
    completed: true,
    error: null,
    title: 'Build Configuration',
    text: 'Build platform\nConfigure options\n--enable-application=browser --enable-release',
  });
}

function createFindings(summary, buildconfig) {
  const findings = [
    {
      id: 'installed-firefox-source-stamp-pinned',
      classification: 'SOURCE_FACT',
      summary: 'The installed Firefox build identity is pinned from installation metadata.',
      evidence: [
        `version=${summary.version ?? 'unknown'}`,
        `buildId=${summary.buildId ?? 'unknown'}`,
        `sourceRepository=${summary.sourceRepository ?? 'unknown'}`,
        `sourceStamp=${summary.sourceStamp ?? 'unknown'}`,
      ],
    },
  ];
  if (buildconfig.completed) {
    findings.push({
      id: summary.configureMentionsEnableJitSpew
        ? 'installed-firefox-buildconfig-mentions-jitspew'
        : 'installed-firefox-buildconfig-does-not-mention-jitspew',
      classification: summary.configureMentionsEnableJitSpew ? 'SOURCE_FACT' : 'NEGATIVE_RESULT',
      summary: summary.configureMentionsEnableJitSpew
        ? 'The installed Firefox about:buildconfig text mentions --enable-jitspew.'
        : 'The installed Firefox about:buildconfig text does not mention --enable-jitspew, JS_JITSPEW, or JS_STRUCTURED_SPEW.',
      evidence: [
        `aboutBuildconfigTitle=${summary.aboutBuildconfigTitle ?? 'unknown'}`,
        `configureMentionsEnableJsShell=${summary.configureMentionsEnableJsShell}`,
        `configureMentionsMozPackageJsShell=${summary.configureMentionsMozPackageJsShell}`,
        `configureMentionsEnableJitSpew=${summary.configureMentionsEnableJitSpew}`,
        `configureMentionsJsJitSpew=${summary.configureMentionsJsJitSpew}`,
        `configureMentionsStructuredSpew=${summary.configureMentionsStructuredSpew}`,
      ],
    });
  } else {
    findings.push({
      id: 'installed-firefox-buildconfig-read-failed',
      classification: 'NEGATIVE_RESULT',
      summary: 'The audit could not read about:buildconfig through Firefox WebDriver BiDi.',
      evidence: [
        buildconfig.error ?? 'unknown error',
      ],
    });
  }
  findings.push({
    id: 'buildconfig-audit-scope',
    classification: 'SCOPE_GUARD',
    summary: 'Buildconfig metadata narrows the diagnostic surface only; it is not emitted SpiderMonkey JIT IR, optimized-code, allocation, or throughput evidence.',
    evidence: [
      'A diagnostic-capable Firefox build or SpiderMonkey shell can still close the codegen proof obligation.',
    ],
  });
  return findings;
}

function renderMarkdown(report) {
  const lines = [
    '# Firefox/SpiderMonkey Buildconfig Source Pin Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Firefox executable: ${report.summary.browserExecutable ?? 'not-found'}`,
    `- Version: ${report.summary.version ?? 'unknown'}`,
    `- Build ID: ${report.summary.buildId ?? 'unknown'}`,
    `- Source repository: ${report.summary.sourceRepository ?? 'unknown'}`,
    `- Source stamp: ${report.summary.sourceStamp ?? 'unknown'}`,
    `- about:buildconfig read: ${report.summary.aboutBuildconfigCompleted ? 'yes' : 'no'}`,
    `- Mentions --enable-js-shell: ${report.summary.configureMentionsEnableJsShell ? 'yes' : 'no'}`,
    `- Mentions MOZ_PACKAGE_JSSHELL=1: ${report.summary.configureMentionsMozPackageJsShell ? 'yes' : 'no'}`,
    `- Mentions --enable-jitspew: ${report.summary.configureMentionsEnableJitSpew ? 'yes' : 'no'}`,
    `- Mentions JS_JITSPEW: ${report.summary.configureMentionsJsJitSpew ? 'yes' : 'no'}`,
    `- Mentions JS_STRUCTURED_SPEW: ${report.summary.configureMentionsStructuredSpew ? 'yes' : 'no'}`,
    '',
    '## Findings',
    '',
    ...report.findings.flatMap(finding => [
      `- ${finding.id} (${finding.classification}): ${finding.summary}`,
      ...finding.evidence.map(entry => `  - ${entry}`),
    ]),
    '',
    '## about:buildconfig Excerpt',
    '',
    '```text',
    report.aboutBuildconfig.textExcerpt || report.aboutBuildconfig.error || '',
    '```',
    '',
    '## Limits',
    '',
    '- This artifact does not contain emitted JIT IR or optimized-code.',
    '- A missing JitSpew flag in this installed release build is not a SpiderMonkey runtime ceiling proof.',
    '- Use a diagnostic-capable Firefox build or SpiderMonkey shell for the actual codegen proof obligation.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function keepExcerpt(text) {
  return text.trim().replace(/\r\n/g, '\n').slice(0, 6000);
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
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

function writeOutput(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function printSummary(report) {
  console.log(`firefox-spidermonkey-buildconfig-source-pin-audit: buildconfig=${report.summary.aboutBuildconfigCompleted ? 'yes' : 'no'} enableJitSpew=${report.summary.configureMentionsEnableJitSpew ? 'yes' : 'no'}`);
}

await main();
