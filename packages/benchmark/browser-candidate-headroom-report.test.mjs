import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'browser-candidate-headroom-report-test.json');
const mdOut = join(tmpDir, 'browser-candidate-headroom-report-test.md');
const corpusJsonOut = join(tmpDir, 'browser-candidate-headroom-corpus-report-test.json');
const corpusMdOut = join(tmpDir, 'browser-candidate-headroom-corpus-report-test.md');
const projectionJsonOut = join(tmpDir, 'browser-candidate-headroom-projection-report-test.json');
const projectionMdOut = join(tmpDir, 'browser-candidate-headroom-projection-report-test.md');
const timingJsonOut = join(tmpDir, 'browser-candidate-headroom-timing-report-test.json');
const timingMdOut = join(tmpDir, 'browser-candidate-headroom-timing-report-test.md');

test('browser candidate headroom matrix records the same byte-batch contract', (t) => {
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
    join(__dirname, 'browser-candidate-headroom.mjs'),
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
  assert.equal(report.objective, 'browser-candidate-headroom');
  assert.equal(report.contract, 'browser-byte-batch-mixed-materialization-headroom-matrix');
  assert.equal(report.environment.runtimeName, 'browser');
  assert.equal(report.environment.javascriptEngine, 'V8');
  assert.match(report.environment.userAgent, /Chrome|Edg/);
  assert.equal(report.environment.gcStrategy, 'window.gc');
  assert.equal(report.fixture.generated, true);
  assert.equal(report.fixture.shape, 'diverse-cycle');
  assert.equal(report.fixture.rowCycleSize, 16);
  assert.equal(report.eventCountParity.status, 'ok');
  assert.equal(report.fullStringParity.status, 'ok');
  assert.deepEqual(report.variants.map(entry => entry.id), [
    'scanAllNoDecode',
    'nameStringOnly',
    'textStringOnly',
    'attrNameStringOnly',
    'attrValueStringOnly',
    'stringFull',
    'eventObjectFull',
    'cursorAccessor',
    'rawFrameDirect',
    'rawFrameNameId',
  ]);
  assert.ok(report.variants.every(entry => entry.eventCount === report.eventCountParity.eventCount));
  assert.ok(report.variants.filter(entry => entry.fullStringParity).every(entry => entry.checksum === report.fullStringParity.checksum));
  assert.ok(report.variants.every(entry => entry.memory?.scope === 'browser-js-heap'));
  assert.equal(report.hostProcessMemory.scope, process.platform === 'win32' ? 'windows-process-tree' : 'unsupported');
  assert.ok(report.hostProcessMemory.samples.length >= 2);
  if (process.platform === 'win32') {
    assert.ok(report.hostProcessMemory.maxWorkingSetBytes > 0);
    assert.ok(report.hostProcessMemory.maxPrivateBytes > 0);
  }

  const scan = report.variants.find(entry => entry.id === 'scanAllNoDecode');
  const eventObjectFull = report.variants.find(entry => entry.id === 'eventObjectFull');
  const rawNameId = report.variants.find(entry => entry.id === 'rawFrameNameId');
  assert.equal(scan.materializationCounters.stringFieldReads, 0);
  assert.ok(eventObjectFull.fullStringParity);
  assert.equal(eventObjectFull.materializationCounters.eventObjects, eventObjectFull.eventCount);
  assert.equal(eventObjectFull.checksum, report.fullStringParity.checksum);
  assert.ok(rawNameId.materializationCounters.rawNameCacheHits > 0);
  assert.ok(!report.omittedRows.some(entry => entry.id === 'eventObjectFull'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Browser Candidate Headroom Matrix/);
  assert.match(markdown, /browser `Uint8Array` batches/);
  assert.match(markdown, /Variant memory uses browser JS heap only/);
  assert.match(markdown, /Host Process Memory/);
  assert.match(markdown, /Full-string parity rows: ok/);
});

test('browser candidate headroom matrix supports a corpus-cycle fixture seed', (t) => {
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
    join(__dirname, 'browser-candidate-headroom.mjs'),
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
  assert.equal(report.objective, 'browser-candidate-headroom');
  assert.equal(report.contract, 'browser-corpus-byte-batch-mixed-materialization-headroom-matrix');
  assert.equal(report.environment.runtimeName, 'browser');
  assert.equal(report.fixture.generated, false);
  assert.equal(report.fixture.source, 'corpus-file');
  assert.equal(report.fixture.shape, 'corpus-cycle');
  assert.equal(report.fixture.rowCycleSize, 1);
  assert.equal(report.fixture.batchSize, 1);
  assert.match(report.fixture.sourceFile, /books\.xml$/);
  assert.equal(report.eventCountParity.status, 'ok');
  assert.equal(report.fullStringParity.status, 'ok');
  assert.ok(report.variants.every(entry => entry.memory?.scope === 'browser-js-heap'));
  const eventObjectFull = report.variants.find(entry => entry.id === 'eventObjectFull');
  assert.equal(eventObjectFull.materializationCounters.eventObjects, eventObjectFull.eventCount);
  assert.equal(eventObjectFull.checksum, report.fullStringParity.checksum);
  assert.equal(report.hostProcessMemory.scope, process.platform === 'win32' ? 'windows-process-tree' : 'unsupported');
  assert.ok(report.findings.some(entry => entry.id === 'corpus-cycle-fixture'));

  const markdown = readFileSync(corpusMdOut, 'utf8');
  assert.match(markdown, /corpus-backed browser `Uint8Array` batches/);
  assert.match(markdown, /Fixture source: corpus-file/);
  assert.match(markdown, /Source file: .*books\.xml/);
  assert.match(markdown, /corpus-cycle-fixture/);
});

test('browser candidate headroom matrix includes projection rows on projection fixtures', (t) => {
  const browserExecutable = findBrowserExecutable();
  if (!browserExecutable) {
    t.skip('Chrome or Edge executable was not found.');
    return;
  }

  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [projectionJsonOut, projectionMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'browser-candidate-headroom.mjs'),
    '--browser-executable',
    browserExecutable,
    '--size-gib',
    '0.0001',
    '--fixture-shape',
    'projection-cycle',
    '--diverse-cycle-size',
    '16',
    '--runs',
    '1',
    '--warmups',
    '0',
    '--json-out',
    projectionJsonOut,
    '--md-out',
    projectionMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(projectionJsonOut, 'utf8'));
  assert.equal(report.objective, 'browser-candidate-headroom');
  assert.equal(report.fixture.shape, 'projection-cycle');
  assert.deepEqual(report.variants.map(entry => entry.id), [
    'scanAllNoDecode',
    'nameStringOnly',
    'textStringOnly',
    'attrNameStringOnly',
    'attrValueStringOnly',
    'stringFull',
    'eventObjectFull',
    'cursorAccessor',
    'rawFrameDirect',
    'rawFrameNameId',
    'projectionLowSelectivity',
    'projectionHighSelectivity',
  ]);
  assert.ok(!report.omittedRows.some(entry => entry.id === 'projectionLowSelectivity'));
  assert.ok(!report.omittedRows.some(entry => entry.id === 'projectionHighSelectivity'));
  assert.equal(report.projectionParity.status, 'ok');
  assert.deepEqual(report.projectionParity.rowIds, ['projectionLowSelectivity', 'projectionHighSelectivity']);

  const streamRows = report.variants.filter(entry => entry.eventCountKind === 'stream-events');
  assert.ok(streamRows.every(entry => entry.eventCount === report.eventCountParity.eventCount));

  const low = report.variants.find(entry => entry.id === 'projectionLowSelectivity');
  const high = report.variants.find(entry => entry.id === 'projectionHighSelectivity');
  assert.equal(low.family, 'projection-js');
  assert.equal(high.family, 'projection-js');
  assert.equal(low.eventCountKind, 'projected-records');
  assert.equal(high.eventCountKind, 'projected-records');
  assert.equal(low.fullStringParity, false);
  assert.equal(high.fullStringParity, false);
  assert.ok(low.eventCount > 0);
  assert.ok(high.eventCount > low.eventCount);
  assert.equal(low.materializationCounters.projectedRecords, low.eventCount);
  assert.equal(high.materializationCounters.projectedRecords, high.eventCount);
  assert.equal(low.materializationCounters.projectionFieldReads, low.eventCount * 2);
  assert.equal(high.materializationCounters.projectionFieldReads, high.eventCount * 2);
  assert.equal(low.runtimeLimitCounterexampleEligible, false);
  assert.equal(high.runtimeLimitCounterexampleEligible, false);

  const markdown = readFileSync(projectionMdOut, 'utf8');
  assert.match(markdown, /Projection rows report projected record counts/);
  assert.match(markdown, /projectionLowSelectivity/);
  assert.match(markdown, /projectionHighSelectivity/);
});

test('browser candidate headroom matrix renders multi-run timing stability', (t) => {
  const browserExecutable = findBrowserExecutable();
  if (!browserExecutable) {
    t.skip('Chrome or Edge executable was not found.');
    return;
  }

  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [timingJsonOut, timingMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'browser-candidate-headroom.mjs'),
    '--browser-executable',
    browserExecutable,
    '--size-gib',
    '0.0001',
    '--fixture-shape',
    'projection-cycle',
    '--diverse-cycle-size',
    '16',
    '--runs',
    '2',
    '--warmups',
    '0',
    '--cases',
    'stringFull,rawFrameNameId,projectionLowSelectivity,projectionHighSelectivity',
    '--json-out',
    timingJsonOut,
    '--md-out',
    timingMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(timingJsonOut, 'utf8'));
  assert.equal(report.options.runs, 2);
  assert.deepEqual(report.options.cases, [
    'stringFull',
    'rawFrameNameId',
    'projectionLowSelectivity',
    'projectionHighSelectivity',
  ]);
  assert.deepEqual(report.variants.map(entry => entry.id), report.options.cases);
  assert.ok(report.variants.every(entry => entry.samplesMs.length === 2));

  const markdown = readFileSync(timingMdOut, 'utf8');
  assert.match(markdown, /## Timing Stability/);
  assert.match(markdown, /same-process timing spread/);
  assert.match(markdown, /Cases: stringFull, rawFrameNameId, projectionLowSelectivity, projectionHighSelectivity/);
  assert.match(markdown, /\| Variant \| Runs \| Avg ms \| Min ms \| Max ms \| Spread \| Samples ms \|/);
  assert.match(markdown, /\| projectionLowSelectivity \| 2 \|/);
  assert.match(markdown, /\| projectionHighSelectivity \| 2 \|/);
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
