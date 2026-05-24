import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'firefox-bidi-candidate-headroom-report-test');
const jsonOut = join(tmpDir, 'firefox-bidi-candidate-headroom.json');
const mdOut = join(tmpDir, 'firefox-bidi-candidate-headroom.md');
const projectionJsonOut = join(tmpDir, 'firefox-bidi-candidate-headroom-projection.json');
const projectionMdOut = join(tmpDir, 'firefox-bidi-candidate-headroom-projection.md');
const corpusJsonOut = join(tmpDir, 'firefox-bidi-candidate-headroom-corpus.json');
const corpusMdOut = join(tmpDir, 'firefox-bidi-candidate-headroom-corpus.md');

test('Firefox BiDi candidate headroom records same-contract SpiderMonkey rows', (t) => {
  const firefox = findFirefoxExecutable();
  if (!firefox) {
    t.skip('Firefox executable was not found.');
    return;
  }

  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-bidi-candidate-headroom.mjs'),
    '--browser-executable',
    firefox,
    '--size-gib',
    '0.001',
    '--fixture-shape',
    'diverse-cycle',
    '--diverse-cycle-size',
    '64',
    '--runs',
    '1',
    '--warmups',
    '0',
    '--cases',
    'stringFull,eventObjectFull,rawFrameNameId',
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
  assert.equal(report.objective, 'firefox-bidi-candidate-headroom');
  assert.equal(report.environment.runtimeName, 'browser');
  assert.equal(report.environment.browserName, 'Firefox');
  assert.equal(report.environment.javascriptEngine, 'SpiderMonkey');
  assert.equal(report.automation.protocol, 'WebDriver BiDi');
  assert.equal(report.fixture.shape, 'diverse-cycle');
  assert.ok(report.fixture.actualBytes > 0);
  assert.deepEqual(report.variants.map(entry => entry.id), [
    'stringFull',
    'eventObjectFull',
    'rawFrameNameId',
  ]);
  assert.equal(report.eventCountParity.status, 'ok');
  assert.equal(report.fullStringParity.status, 'ok');
  for (const row of report.variants) {
    assert.equal(row.fullStringParity, true);
    assert.equal(row.eventCount, report.fullStringParity.eventCount);
    assert.equal(row.checksum, report.fullStringParity.checksum);
    assert.equal(row.memory.scope, 'browser-js-heap');
    assert.equal(row.hostProcessMemoryProbe?.scope, process.platform === 'win32' ? 'windows-process-tree' : 'unsupported');
    assert.equal(row.hostProcessMemoryProbe?.probeEventCount, row.eventCount);
    assert.equal(row.hostProcessMemoryProbe?.probeChecksum, row.checksum);
  }

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /Firefox BiDi Notes/);
  assert.match(markdown, /SpiderMonkey/);
  assert.match(markdown, /does not use Playwright, Selenium, CDP, or a native addon/);
  assert.match(markdown, /per-variant host process-tree probes are Windows host evidence/);
  assert.match(markdown, /Per-Variant Host Process Memory Probes/);
  assert.match(markdown, /Full rows preserve/);
});

test('Firefox BiDi candidate headroom supports projection-cycle rows', (t) => {
  const firefox = findFirefoxExecutable();
  if (!firefox) {
    t.skip('Firefox executable was not found.');
    return;
  }

  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-bidi-candidate-headroom.mjs'),
    '--browser-executable',
    firefox,
    '--size-gib',
    '0.001',
    '--fixture-shape',
    'projection-cycle',
    '--diverse-cycle-size',
    '64',
    '--runs',
    '1',
    '--warmups',
    '0',
    '--cases',
    'stringFull,eventObjectFull,rawFrameNameId,projectionLowSelectivity,projectionHighSelectivity',
    '--no-host-process-memory',
    '--json-out',
    projectionJsonOut,
    '--md-out',
    projectionMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(projectionJsonOut, 'utf8'));
  assert.equal(report.objective, 'firefox-bidi-candidate-headroom');
  assert.equal(report.environment.browserName, 'Firefox');
  assert.equal(report.environment.javascriptEngine, 'SpiderMonkey');
  assert.equal(report.fixture.shape, 'projection-cycle');
  assert.equal(report.fullStringParity.status, 'ok');
  assert.deepEqual(report.variants.map(entry => entry.id), [
    'stringFull',
    'eventObjectFull',
    'rawFrameNameId',
    'projectionLowSelectivity',
    'projectionHighSelectivity',
  ]);
  assert.equal(report.hostProcessMemory?.enabled, undefined);
  assert.ok(report.variants.some(row =>
    row.id === 'projectionLowSelectivity'
    && row.fullStringParity === false
    && row.family === 'projection-js'
    && row.contractScope === 'projected-records-low-selectivity'
  ));
  assert.ok(report.variants.some(row =>
    row.id === 'projectionHighSelectivity'
    && row.fullStringParity === false
    && row.family === 'projection-js'
    && row.contractScope === 'projected-records-high-selectivity'
  ));

  const markdown = readFileSync(projectionMdOut, 'utf8');
  assert.match(markdown, /Fixture shape: projection-cycle/);
  assert.match(markdown, /projectionLowSelectivity/);
  assert.match(markdown, /projectionHighSelectivity/);
  assert.match(markdown, /Firefox BiDi Notes/);
});

test('Firefox BiDi candidate headroom supports a corpus-cycle fixture seed', (t) => {
  const firefox = findFirefoxExecutable();
  if (!firefox) {
    t.skip('Firefox executable was not found.');
    return;
  }

  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-bidi-candidate-headroom.mjs'),
    '--browser-executable',
    firefox,
    '--size-gib',
    '0.001',
    '--fixture-shape',
    'corpus-cycle',
    '--corpus-file',
    join(__dirname, 'assets', 'books.xml'),
    '--runs',
    '1',
    '--warmups',
    '0',
    '--cases',
    'stringFull,eventObjectFull,rawFrameNameId',
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
  assert.equal(report.objective, 'firefox-bidi-candidate-headroom');
  assert.equal(report.environment.browserName, 'Firefox');
  assert.equal(report.environment.javascriptEngine, 'SpiderMonkey');
  assert.equal(report.fixture.shape, 'corpus-cycle');
  assert.equal(report.fixture.source, 'corpus-file');
  assert.equal(report.fixture.batchSize, 1);
  assert.equal(report.fullStringParity.status, 'ok');
  assert.deepEqual(report.variants.map(entry => entry.id), [
    'stringFull',
    'eventObjectFull',
    'rawFrameNameId',
  ]);
  for (const row of report.variants) {
    assert.equal(row.fullStringParity, true);
    assert.equal(row.hostProcessMemoryProbe?.probeEventCount, row.eventCount);
    assert.equal(row.hostProcessMemoryProbe?.probeChecksum, row.checksum);
  }

  const markdown = readFileSync(corpusMdOut, 'utf8');
  assert.match(markdown, /corpus-backed browser `Uint8Array` batches/);
  assert.match(markdown, /Fixture shape: corpus-cycle/);
  assert.match(markdown, /Firefox BiDi Notes/);
});

function findFirefoxExecutable() {
  const candidates = [
    'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
    'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
  ];
  return candidates.find(candidate => existsSync(candidate)) ?? null;
}

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut, projectionJsonOut, projectionMdOut, corpusJsonOut, corpusMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }
}
