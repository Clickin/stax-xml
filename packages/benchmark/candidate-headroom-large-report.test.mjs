import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'candidate-headroom-large-report-test.json');
const mdOut = join(tmpDir, 'candidate-headroom-large-report-test.md');

test('large candidate headroom matrix preserves bounded byte-batch contract', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'candidate-headroom-large.mjs'),
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
    '--json-out',
    jsonOut,
    '--md-out',
    mdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
  assert.equal(report.objective, 'candidate-headroom-large');
  assert.equal(report.contract, 'generated-byte-batch-mixed-materialization-headroom-matrix');
  assert.equal(report.environment.gcStrategy, 'globalThis.gc');
  assert.equal(report.fixture.generated, true);
  assert.equal(report.fixture.shape, 'diverse-cycle');
  assert.equal(report.fixture.rowCycleSize, 64);
  assert.equal(report.woodstoxTarget.baselineTool, 'woodstox');
  assert.equal(report.woodstoxTarget.goalRatio, 0.9);
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

  const partialRows = report.variants.filter(entry => !entry.fullStringParity);
  const fullRows = report.variants.filter(entry => entry.fullStringParity);
  assert.ok(partialRows.every(entry => entry.family === 'partial-upper-bound'));
  assert.ok(fullRows.every(entry => entry.family === 'full-stax-js'));
  assert.ok(report.variants.every(entry => entry.eventCount === report.eventCountParity.eventCount));
  assert.ok(fullRows.every(entry => entry.eventCount === report.fullStringParity.eventCount));
  assert.ok(fullRows.every(entry => entry.checksum === report.fullStringParity.checksum));
  assert.ok(report.variants.every(entry => entry.boundedMemory === true));
  assert.ok(report.variants.every(entry => entry.counterexampleStatus === 'not-found'));
  assert.ok(report.variants.every(entry => entry.runtimeLimitCounterexampleEligible === false));

  const scan = report.variants.find(entry => entry.id === 'scanAllNoDecode');
  const stringFull = report.variants.find(entry => entry.id === 'stringFull');
  const eventObjectFull = report.variants.find(entry => entry.id === 'eventObjectFull');
  const rawDirect = report.variants.find(entry => entry.id === 'rawFrameDirect');
  const rawNameId = report.variants.find(entry => entry.id === 'rawFrameNameId');

  assert.equal(scan.materializationCounters.stringFieldReads, 0);
  assert.equal(scan.materializationCounters.rawSpanMaterializations, 0);
  assert.ok(stringFull.materializationCounters.stringFieldReads > 0);
  assert.ok(eventObjectFull.fullStringParity);
  assert.equal(eventObjectFull.materializationCounters.eventObjects, eventObjectFull.eventCount);
  assert.equal(eventObjectFull.checksum, report.fullStringParity.checksum);
  assert.ok(rawDirect.materializationCounters.rawSpanMaterializations > 0);
  assert.ok(rawNameId.materializationCounters.rawNameCacheHits > 0);
  assert.ok(rawNameId.materializationCounters.rawSpanMaterializations < rawDirect.materializationCounters.rawSpanMaterializations);
  assert.ok(!report.omittedRows.some(entry => entry.id === 'eventObjectFull'));
  assert.ok(report.omittedRows.some(entry => entry.id === 'projectionLowSelectivity'));
  assert.ok(report.omittedRows.some(entry => entry.id === 'projectionHighSelectivity'));

  for (const entry of report.variants) {
    assert.equal(typeof entry.memory?.avgHeapUsedDeltaBytes, 'number');
    assert.equal(typeof entry.memory?.avgRssDeltaBytes, 'number');
    assert.equal(typeof entry.memory?.maxHeapUsedBytes, 'number');
    assert.equal(typeof entry.memory?.maxRssBytes, 'number');
    assert.equal(entry.memory.samples.length, 1);
    assert.equal(typeof entry.materializationCounters?.attributePairs, 'number');
  }

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Large Candidate Headroom Matrix/);
  assert.match(markdown, /1 GiB\+ bounded-memory counterexample search/);
  assert.match(markdown, /generated `Uint8Array` batches/);
  assert.match(markdown, /Partial rows intentionally skip/);
  assert.match(markdown, /Full rows preserve/);
  assert.match(markdown, /Node `Buffer\.toString\(\)`/);
  assert.match(markdown, /lazy getters/);
  assert.match(markdown, /## Omitted Rows/);
  assert.match(markdown, /eventObjectFull/);
  assert.doesNotMatch(markdown, /eventObjectFull: EventReaderSync requires a complete XML string input/);
  assert.match(markdown, /Projection rows require a separate selector contract/);
  assert.match(markdown, /Full-string parity rows: ok/);
});

test('large candidate headroom matrix supports a corpus-cycle fixture seed', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'candidate-headroom-large.mjs'),
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
    '--json-out',
    jsonOut,
    '--md-out',
    mdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
  assert.equal(report.objective, 'candidate-headroom-large');
  assert.equal(report.contract, 'byte-batch-mixed-materialization-headroom-matrix');
  assert.equal(report.environment.gcStrategy, 'globalThis.gc');
  assert.equal(report.fixture.generated, false);
  assert.equal(report.fixture.source, 'corpus-file');
  assert.equal(report.fixture.shape, 'corpus-cycle');
  assert.equal(report.fixture.rowCycleSize, 1);
  assert.equal(report.fixture.batchSize, 1);
  assert.match(report.fixture.sourceFile, /books\.xml$/);
  assert.equal(report.eventCountParity.status, 'ok');
  assert.equal(report.fullStringParity.status, 'ok');
  assert.ok(report.variants.every(entry => entry.boundedMemory === true));
  assert.ok(report.variants.some(entry => entry.fullStringParity));
  assert.ok(report.findings.some(entry => entry.id === 'corpus-cycle-fixture'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /corpus-backed `Uint8Array` batches/);
  assert.match(markdown, /Fixture source: corpus-file/);
  assert.match(markdown, /Source file: .*books\.xml/);
  assert.match(markdown, /corpus-cycle-fixture/);
});
