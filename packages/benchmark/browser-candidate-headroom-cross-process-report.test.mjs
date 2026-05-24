import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const outputDir = join(tmpDir, 'browser-candidate-headroom-cross-process-report-test');
const jsonOut = join(tmpDir, 'browser-candidate-headroom-cross-process-report-test.json');
const mdOut = join(tmpDir, 'browser-candidate-headroom-cross-process-report-test.md');
const firefoxOutputDir = join(tmpDir, 'firefox-bidi-candidate-headroom-cross-process-report-test');
const firefoxJsonOut = join(tmpDir, 'firefox-bidi-candidate-headroom-cross-process-report-test.json');
const firefoxMdOut = join(tmpDir, 'firefox-bidi-candidate-headroom-cross-process-report-test.md');
const firefoxTextDecoderOutputDir = join(tmpDir, 'firefox-bidi-textdecoder-cross-process-report-test');
const firefoxTextDecoderJsonOut = join(tmpDir, 'firefox-bidi-textdecoder-cross-process-report-test.json');
const firefoxTextDecoderMdOut = join(tmpDir, 'firefox-bidi-textdecoder-cross-process-report-test.md');

test('browser candidate headroom cross-process report summarizes fresh browser process rows', (t) => {
  const browserExecutable = findBrowserExecutable();
  if (!browserExecutable) {
    t.skip('Chrome or Edge executable was not found.');
    return;
  }

  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [outputDir, jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath, { recursive: true, force: true });
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'browser-candidate-headroom-cross-process.mjs'),
    '--browser-executable',
    browserExecutable,
    '--process-runs',
    '2',
    '--size-gib',
    '0.0001',
    '--fixture-shape',
    'projection-cycle',
    '--diverse-cycle-size',
    '16',
    '--child-warmups',
    '0',
    '--cases',
    'stringFull,rawFrameNameId,projectionLowSelectivity,projectionHighSelectivity',
    '--no-host-process-memory',
    '--output-dir',
    outputDir,
    '--json-out',
    jsonOut,
    '--md-out',
    mdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 240_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
  assert.equal(report.objective, 'browser-candidate-headroom-cross-process');
  assert.equal(report.contract, 'independent-browser-process-candidate-headroom-stability');
  assert.equal(report.sampleCount, 2);
  assert.equal(report.environment.runtimeName, 'browser');
  assert.equal(report.environment.javascriptEngine, 'V8');
  assert.equal(report.fixture.shape, 'projection-cycle');
  assert.deepEqual(report.options.cases, [
    'stringFull',
    'rawFrameNameId',
    'projectionLowSelectivity',
    'projectionHighSelectivity',
  ]);
  assert.deepEqual(report.variants.map(entry => entry.id), report.options.cases);
  assert.equal(report.childReports.length, 2);
  assert.ok(report.childReports.every(entry => entry.variants.length === report.options.cases.length));
  assert.equal(report.parity.streamAndFullRowsStable, true);
  assert.equal(report.parity.projectionRowsStable, true);
  assert.deepEqual(report.parity.projectionRowIds, ['projectionLowSelectivity', 'projectionHighSelectivity']);
  assert.ok(report.variants.every(entry => entry.sampleCount === 2));
  assert.ok(report.variants.every(entry => entry.stableResult));
  assert.ok(report.variants.every(entry => entry.maxJsHeapUsedBytes > 0));
  assert.equal(report.hostProcessMemory.scope, 'disabled');
  assert.ok(report.findings.some(entry => entry.id === 'independent-browser-process-rerun'));
  assert.ok(report.findings.some(entry => entry.id === 'browser-memory-scope'));
  assert.ok(report.findings.some(entry => entry.id === 'full-stax-counterexample-search'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Browser Candidate Headroom Cross-Process Stability/);
  assert.match(markdown, /fresh browser processes/);
  assert.match(markdown, /Cases: stringFull, rawFrameNameId, projectionLowSelectivity, projectionHighSelectivity/);
  assert.match(markdown, /Host Process Memory/);
  assert.match(markdown, /browser-v8-scope/);
});

test('browser candidate headroom cross-process report can use the Firefox BiDi harness', (t) => {
  const browserExecutable = findFirefoxExecutable();
  if (!browserExecutable) {
    t.skip('Firefox executable was not found.');
    return;
  }

  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [firefoxOutputDir, firefoxJsonOut, firefoxMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath, { recursive: true, force: true });
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'browser-candidate-headroom-cross-process.mjs'),
    '--harness',
    'firefox-bidi',
    '--browser-executable',
    browserExecutable,
    '--process-runs',
    '1',
    '--size-gib',
    '0.0001',
    '--fixture-shape',
    'projection-cycle',
    '--diverse-cycle-size',
    '16',
    '--child-warmups',
    '0',
    '--cases',
    'stringFull,rawFrameNameId,projectionLowSelectivity',
    '--no-host-process-memory',
    '--output-dir',
    firefoxOutputDir,
    '--json-out',
    firefoxJsonOut,
    '--md-out',
    firefoxMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 240_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(firefoxJsonOut, 'utf8'));
  assert.equal(report.objective, 'browser-candidate-headroom-cross-process');
  assert.equal(report.options.harness, 'firefox-bidi');
  assert.equal(report.sampleCount, 1);
  assert.equal(report.environment.browserName, 'Firefox');
  assert.equal(report.environment.javascriptEngine, 'SpiderMonkey');
  assert.equal(report.fixture.shape, 'projection-cycle');
  assert.deepEqual(report.options.cases, ['stringFull', 'rawFrameNameId', 'projectionLowSelectivity']);
  assert.equal(report.hostProcessMemory.scope, 'disabled');
  assert.ok(report.variants.every(entry => entry.sampleCount === 1));
  assert.ok(report.variants.every(entry => entry.maxJsHeapUsedBytes === null));
  assert.ok(report.findings.some(entry =>
    entry.id === 'browser-v8-scope'
    && /Firefox\/SpiderMonkey/.test(entry.summary)
  ));

  const markdown = readFileSync(firefoxMdOut, 'utf8');
  assert.match(markdown, /Harness: firefox-bidi/);
  assert.match(markdown, /Firefox does not expose Chromium performance\.memory/);
  assert.match(markdown, /browser-v8-scope/);
});

test('browser cross-process report can use the Firefox BiDi TextDecoder harness', (t) => {
  const browserExecutable = findFirefoxExecutable();
  if (!browserExecutable) {
    t.skip('Firefox executable was not found.');
    return;
  }

  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [firefoxTextDecoderOutputDir, firefoxTextDecoderJsonOut, firefoxTextDecoderMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath, { recursive: true, force: true });
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'browser-candidate-headroom-cross-process.mjs'),
    '--harness',
    'firefox-bidi-textdecoder',
    '--browser-executable',
    browserExecutable,
    '--process-runs',
    '1',
    '--size-gib',
    '0.0001',
    '--fixture-shape',
    'diverse-cycle',
    '--diverse-cycle-size',
    '16',
    '--child-warmups',
    '0',
    '--no-host-process-memory',
    '--output-dir',
    firefoxTextDecoderOutputDir,
    '--json-out',
    firefoxTextDecoderJsonOut,
    '--md-out',
    firefoxTextDecoderMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 240_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(firefoxTextDecoderJsonOut, 'utf8'));
  assert.equal(report.objective, 'firefox-bidi-textdecoder-span-cross-process');
  assert.equal(report.contract, 'independent-firefox-bidi-textdecoder-span-stability');
  assert.equal(report.options.harness, 'firefox-bidi-textdecoder');
  assert.equal(report.sampleCount, 1);
  assert.equal(report.environment.browserName, 'Firefox');
  assert.equal(report.environment.javascriptEngine, 'SpiderMonkey');
  assert.equal(report.fixture.shape, 'diverse-cycle');
  assert.deepEqual(report.options.cases, [
    'subarraySharedDecoder',
    'viewSharedDecoder',
    'sliceCopySharedDecoder',
    'subarrayNewDecoder',
    'shortAsciiSubarraySharedDecoder',
  ]);
  assert.equal(report.hostProcessMemory.scope, 'disabled');
  assert.ok(report.variants.every(entry => entry.sampleCount === 1));
  assert.ok(report.variants.every(entry => entry.fullStringParity === true));
  assert.ok(report.variants.every(entry => entry.eventCountKind === 'stream-events'));
  assert.ok(report.variants.every(entry => entry.maxJsHeapUsedBytes === null));
  assert.equal(report.parity.streamAndFullRowsStable, true);
  assert.deepEqual(report.parity.projectionRowIds, []);
  assert.ok(report.findings.some(entry =>
    entry.id === 'projection-contract-separated'
    && /No projection rows/.test(entry.summary)
  ));

  const markdown = readFileSync(firefoxTextDecoderMdOut, 'utf8');
  assert.match(markdown, /Harness: firefox-bidi-textdecoder/);
  assert.match(markdown, /Firefox TextDecoder span rows/);
  assert.match(markdown, /All selected rows preserve full-string StAX parity/);
  assert.match(markdown, /Firefox does not expose Chromium performance\.memory/);
});

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  return candidates.find(candidate => existsSync(candidate));
}

function findFirefoxExecutable() {
  const candidates = [
    process.env.FIREFOX_PATH,
    'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
    'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
  ].filter(Boolean);
  return candidates.find(candidate => existsSync(candidate));
}
