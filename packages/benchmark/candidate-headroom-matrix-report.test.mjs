import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'candidate-headroom-matrix-report-test.json');
const mdOut = join(tmpDir, 'candidate-headroom-matrix-report-test.md');

test('candidate headroom matrix separates partial probes from full-string parity rows', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'candidate-headroom-matrix.mjs'),
    '--self-test',
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
  assert.equal(report.objective, 'candidate-headroom-matrix');
  assert.equal(report.contract, 'mixed-materialization-headroom-matrix');
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
    'cursorAccessor',
    'eventObjectFull',
    'rawFrameDirect',
    'rawFrameNameId',
  ]);

  const partialRows = report.variants.filter(entry => !entry.fullStringParity);
  const fullRows = report.variants.filter(entry => entry.fullStringParity);
  assert.deepEqual(report.fullStringParity.rowIds, fullRows.map(entry => entry.id));
  assert.ok(partialRows.every(entry => entry.family === 'partial-upper-bound'));
  assert.ok(fullRows.every(entry => entry.family === 'full-stax-js'));
  assert.ok(report.variants.every(entry => entry.eventCount === report.eventCountParity.eventCount));
  assert.ok(fullRows.every(entry => entry.checksum === report.fullStringParity.checksum));
  assert.ok(fullRows.every(entry => entry.eventCount === report.fullStringParity.eventCount));
  assert.ok(report.variants.every(entry => entry.runtimeLimitCounterexampleEligible === false));

  const scan = report.variants.find(entry => entry.id === 'scanAllNoDecode');
  const stringFull = report.variants.find(entry => entry.id === 'stringFull');
  const eventObjectFull = report.variants.find(entry => entry.id === 'eventObjectFull');
  const rawDirect = report.variants.find(entry => entry.id === 'rawFrameDirect');
  const rawNameId = report.variants.find(entry => entry.id === 'rawFrameNameId');

  assert.equal(scan.materializationCounters.stringFieldReads, 0);
  assert.equal(scan.materializationCounters.rawSpanMaterializations, 0);
  assert.ok(stringFull.materializationCounters.stringFieldReads > 0);
  assert.equal(eventObjectFull.materializationCounters.eventObjects, eventObjectFull.eventCount);
  assert.ok(rawDirect.materializationCounters.rawSpanMaterializations > 0);
  assert.ok(rawNameId.materializationCounters.rawNameCacheHits > 0);
  assert.ok(rawNameId.materializationCounters.rawSpanMaterializations < rawDirect.materializationCounters.rawSpanMaterializations);

  for (const entry of report.variants) {
    assert.equal(typeof entry.memory?.avgHeapUsedDeltaBytes, 'number');
    assert.equal(typeof entry.memory?.avgRssDeltaBytes, 'number');
    assert.equal(typeof entry.memory?.maxHeapUsedBytes, 'number');
    assert.equal(typeof entry.memory?.maxRssBytes, 'number');
    assert.equal(entry.memory.samples.length, 1);
    assert.equal(typeof entry.materializationCounters?.attributePairs, 'number');
  }

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Candidate Headroom Matrix/);
  assert.match(markdown, /counterexample search scaffold/);
  assert.match(markdown, /Partial rows intentionally skip/);
  assert.match(markdown, /Full rows preserve/);
  assert.match(markdown, /Uint8Array/);
  assert.match(markdown, /TextDecoder/);
  assert.match(markdown, /Node `Buffer\.toString\(\)`/);
  assert.match(markdown, /lazy getters/);
  assert.match(markdown, /Full-string parity rows: ok/);
  assert.match(markdown, /runtime-limit conclusion/);
});
