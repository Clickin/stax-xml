import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'monomorphic-batch-access-report-test.json');
const mdOut = join(tmpDir, 'monomorphic-batch-access-report-test.md');

test('monomorphic batch access report preserves full materialization parity', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'monomorphic-batch-access.mjs'),
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
  assert.equal(report.contract, 'full-string-materialization');
  assert.equal(report.objective, 'monomorphic-batch-access');
  assert.equal(report.woodstoxTarget.baselineTool, 'woodstox');
  assert.equal(report.woodstoxTarget.goalRatio, 0.9);
  assert.equal(report.parity.status, 'ok');
  assert.deepEqual(report.variants.map(entry => entry.id), [
    'public-accessor',
    'raw-frame-direct-decode',
    'raw-frame-name-id-cache',
  ]);
  assert.ok(report.variants.every(entry => entry.eventCount === report.parity.eventCount));
  assert.ok(report.variants.every(entry => entry.checksum === report.parity.checksum));
  assert.ok(report.variants.every(entry => entry.eventCount > 0));
  assert.ok(report.variants.every(entry => entry.materialization === 'full-string'));
  for (const entry of report.variants) {
    assert.equal(typeof entry.memory?.avgHeapUsedDeltaBytes, 'number');
    assert.equal(typeof entry.memory?.avgHeapTotalDeltaBytes, 'number');
    assert.equal(typeof entry.memory?.avgRssDeltaBytes, 'number');
    assert.equal(typeof entry.memory?.maxHeapUsedBytes, 'number');
    assert.equal(typeof entry.memory?.maxRssBytes, 'number');
    assert.equal(entry.memory.samples.length, 1);
    assert.equal(typeof entry.materializationCounters?.stringFieldReads, 'number');
    assert.equal(typeof entry.materializationCounters?.rawSpanMaterializations, 'number');
    assert.equal(typeof entry.materializationCounters?.rawNameCacheHits, 'number');
    assert.equal(entry.materializationCounters.eventObjects, 0);
  }
  assert.ok(report.variants.every(entry => entry.materializationCounters.stringFieldReads > 0));
  assert.equal(report.variants.find(entry => entry.id === 'public-accessor').materializationCounters.rawSpanMaterializations, 0);
  assert.ok(report.variants.find(entry => entry.id === 'raw-frame-direct-decode').materializationCounters.rawSpanMaterializations > 0);
  assert.ok(report.variants.find(entry => entry.id === 'raw-frame-name-id-cache').materializationCounters.rawNameCacheHits > 0);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Monomorphic Batch Access/);
  assert.match(markdown, /## Woodstox Target/);
  assert.match(markdown, /Avg heap delta/);
  assert.match(markdown, /Max RSS/);
  assert.match(markdown, /## Materialization Counters/);
  assert.match(markdown, /Name cache hit\/miss/);
  assert.match(markdown, /full-string materialization/);
  assert.match(markdown, /raw-frame-name-id-cache/);
  assert.match(markdown, /does not filter events/);
});
