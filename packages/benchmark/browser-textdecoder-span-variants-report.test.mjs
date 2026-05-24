import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'browser-textdecoder-span-variants-report-test.json');
const mdOut = join(tmpDir, 'browser-textdecoder-span-variants-report-test.md');
const corpusJsonOut = join(tmpDir, 'browser-textdecoder-span-variants-corpus-report-test.json');
const corpusMdOut = join(tmpDir, 'browser-textdecoder-span-variants-corpus-report-test.md');
const firefoxJsonOut = join(tmpDir, 'firefox-bidi-textdecoder-span-variants-report-test.json');
const firefoxMdOut = join(tmpDir, 'firefox-bidi-textdecoder-span-variants-report-test.md');

test('browser TextDecoder span variants stay on the same full-string contract', (t) => {
  const browserExecutable = findBrowserExecutable();
  if (!browserExecutable) {
    t.skip('Chrome or Edge executable was not found.');
    return;
  }

  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'browser-textdecoder-span-variants.mjs'),
    '--browser-executable',
    browserExecutable,
    '--size-gib',
    '0.0001',
    '--fixture-shape',
    'diverse-cycle',
    '--diverse-cycle-size',
    '16',
    '--runs',
    '1',
    '--warmups',
    '0',
    '--json-out',
    jsonOut,
    '--md-out',
    mdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
  assert.equal(report.objective, 'browser-textdecoder-span-variants');
  assert.equal(report.contract, 'browser-full-string-textdecoder-span-variant-headroom');
  assert.equal(report.environment.runtimeName, 'browser');
  assert.equal(report.environment.javascriptEngine, 'V8');
  assert.match(report.environment.userAgent, /Chrome|Edg/);
  assert.equal(report.fixture.generated, true);
  assert.equal(report.fixture.shape, 'diverse-cycle');
  assert.equal(report.fixture.rowCycleSize, 16);
  assert.equal(report.fullStringParity.status, 'ok');
  assert.equal(report.eventCountParity.status, 'ok');
  assert.deepEqual(report.variants.map(entry => entry.id), [
    'subarraySharedDecoder',
    'viewSharedDecoder',
    'sliceCopySharedDecoder',
    'subarrayNewDecoder',
    'shortAsciiSubarraySharedDecoder',
  ]);

  for (const entry of report.variants) {
    assert.equal(entry.family, 'full-stax-js');
    assert.equal(entry.contractScope, 'full-string-materialization');
    assert.equal(entry.fullStringParity, true);
    assert.equal(entry.eventCount, report.fullStringParity.eventCount);
    assert.equal(entry.checksum, report.fullStringParity.checksum);
    assert.equal(entry.decodeStrategy.usesTextDecoder, true);
    assert.equal(entry.decodeStrategy.nodeBufferSpecific, false);
    assert.equal(entry.decodeStrategy.nativeAddon, false);
    assert.equal(entry.decodeStrategy.lazyGetter, false);
    assert.equal(entry.memory.scope, 'browser-js-heap');
    assert.equal(
      entry.runtimeLimitCounterexampleEligible,
      report.fixture.actualBytes >= 1024 * 1024 * 1024 && entry.mibPerSec >= 200 && entry.boundedMemory,
    );
    assert.ok(entry.materializationCounters.stringFieldReads > 0);
    assert.ok(entry.materializationCounters.rawSpanMaterializations > 0);
    assert.equal(entry.materializationCounters.decodeSpanCalls, entry.materializationCounters.rawSpanMaterializations);
  }

  assert.ok(report.findings.some(entry => entry.id === 'same-full-string-contract'));
  assert.ok(report.findings.some(entry => entry.id === 'browser-textdecoder-variants-are-headroom-search'));
  assert.ok(report.findings.some(entry => entry.id === 'browser-memory-scope'));
  assert.ok(report.findings.some(entry => entry.id === 'runtime-limit-still-unproven'));
  assert.equal(report.hostProcessMemory.scope, process.platform === 'win32' ? 'windows-process-tree' : 'unsupported');

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Browser TextDecoder Span Variant Matrix/);
  assert.match(markdown, /same full-string checksum contract/);
  assert.match(markdown, /browser JS heap/);
  assert.match(markdown, /Host Process Memory/);
  assert.match(markdown, /does not use Node `Buffer\.toString\(\)`/);
  assert.match(markdown, /does not use native addons/);
  assert.match(markdown, /does not use lazy getters/);
  assert.match(markdown, /not a proof that JavaScript runtimes have no further headroom/);
});

test('browser TextDecoder span variants support a corpus-cycle fixture seed', (t) => {
  const browserExecutable = findBrowserExecutable();
  if (!browserExecutable) {
    t.skip('Chrome or Edge executable was not found.');
    return;
  }

  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [corpusJsonOut, corpusMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'browser-textdecoder-span-variants.mjs'),
    '--browser-executable',
    browserExecutable,
    '--size-gib',
    '0.0001',
    '--fixture-shape',
    'corpus-cycle',
    '--corpus-file',
    join(__dirname, 'assets', 'books.xml'),
    '--runs',
    '1',
    '--warmups',
    '0',
    '--json-out',
    corpusJsonOut,
    '--md-out',
    corpusMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(corpusJsonOut, 'utf8'));
  assert.equal(report.objective, 'browser-textdecoder-span-variants');
  assert.equal(report.contract, 'browser-full-string-textdecoder-span-variant-headroom');
  assert.equal(report.fixture.generated, false);
  assert.equal(report.fixture.source, 'corpus-file');
  assert.equal(report.fixture.shape, 'corpus-cycle');
  assert.equal(report.fixture.rowCycleSize, 1);
  assert.equal(report.fixture.batchSize, 1);
  assert.match(report.fixture.sourceFile, /books\.xml$/);
  assert.equal(report.fullStringParity.status, 'ok');
  assert.equal(report.eventCountParity.status, 'ok');
  assert.ok(report.variants.every(entry => entry.fullStringParity));
  assert.ok(report.findings.some(entry => entry.id === 'corpus-cycle-fixture'));

  const markdown = readFileSync(corpusMdOut, 'utf8');
  assert.match(markdown, /corpus-backed browser `Uint8Array` batches/);
  assert.match(markdown, /Fixture source: corpus-file/);
  assert.match(markdown, /Source file: .*books\.xml/);
  assert.match(markdown, /corpus-cycle-fixture/);
});

test('Firefox BiDi TextDecoder span variants record SpiderMonkey rows without JS heap proof', (t) => {
  const browserExecutable = findFirefoxExecutable();
  if (!browserExecutable) {
    t.skip('Firefox executable was not found.');
    return;
  }

  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [firefoxJsonOut, firefoxMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-bidi-textdecoder-span-variants.mjs'),
    '--browser-executable',
    browserExecutable,
    '--size-gib',
    '0.0001',
    '--fixture-shape',
    'diverse-cycle',
    '--diverse-cycle-size',
    '16',
    '--runs',
    '1',
    '--warmups',
    '0',
    '--json-out',
    firefoxJsonOut,
    '--md-out',
    firefoxMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(firefoxJsonOut, 'utf8'));
  assert.equal(report.objective, 'firefox-bidi-textdecoder-span-variants');
  assert.equal(report.contract, 'firefox-bidi-full-string-textdecoder-span-variant-headroom');
  assert.equal(report.automation.protocol, 'WebDriver BiDi');
  assert.equal(report.environment.runtimeName, 'browser');
  assert.equal(report.environment.browserName, 'Firefox');
  assert.equal(report.environment.javascriptEngine, 'SpiderMonkey');
  assert.match(report.environment.userAgent, /Firefox/);
  assert.equal(report.fixture.generated, true);
  assert.equal(report.fixture.shape, 'diverse-cycle');
  assert.equal(report.fullStringParity.status, 'ok');
  assert.equal(report.eventCountParity.status, 'ok');
  assert.deepEqual(report.variants.map(entry => entry.id), [
    'subarraySharedDecoder',
    'viewSharedDecoder',
    'sliceCopySharedDecoder',
    'subarrayNewDecoder',
    'shortAsciiSubarraySharedDecoder',
  ]);

  for (const entry of report.variants) {
    assert.equal(entry.fullStringParity, true);
    assert.equal(entry.decodeStrategy.usesTextDecoder, true);
    assert.equal(entry.decodeStrategy.nodeBufferSpecific, false);
    assert.equal(entry.decodeStrategy.nativeAddon, false);
    assert.equal(entry.decodeStrategy.lazyGetter, false);
    assert.equal(entry.memory.scope, 'browser-js-heap-unavailable');
    assert.equal(entry.memory.maxJsHeapUsedBytes, null);
    assert.equal(entry.boundedMemory, false);
    assert.equal(entry.runtimeLimitCounterexampleEligible, false);
  }

  assert.equal(report.hostProcessMemory.scope, process.platform === 'win32' ? 'windows-process-tree' : 'unsupported');
  assert.ok(report.findings.some(entry =>
    entry.id === 'browser-memory-scope'
    && /browser JS heap unavailable/.test(entry.summary)
  ));

  const markdown = readFileSync(firefoxMdOut, 'utf8');
  assert.match(markdown, /# Browser TextDecoder Span Variant Matrix/);
  assert.match(markdown, /Firefox BiDi Notes/);
  assert.match(markdown, /SpiderMonkey/);
  assert.match(markdown, /does not expose compatible `performance\.memory`/);
  assert.match(markdown, /does not use Playwright, Selenium, CDP, Node `Buffer\.toString\(\)`, native addons, or lazy getters/);
  assert.match(markdown, /not a proof that JavaScript runtimes have no further headroom/);
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
