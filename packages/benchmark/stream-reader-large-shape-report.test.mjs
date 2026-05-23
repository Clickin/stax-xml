import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'stream-reader-large-shape-report-test.json');
const mdOut = join(tmpDir, 'stream-reader-large-shape-report-test.md');

test('large stream-reader shape report records parity, memory, and materialization counters', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'stream-reader-4gb-consumption.mjs'),
    '--size-gib',
    '0.001',
    '--style',
    'shapes',
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
  assert.equal(report.objective, 'stream-reader-large-shape');
  assert.equal(report.contract, 'generated-byte-batch-full-string');
  assert.equal(report.parity.status, 'ok');
  assert.deepEqual(report.results.map(entry => entry.style), [
    'index-for',
    'raw-frame-direct',
    'raw-frame-name-id',
  ]);
  assert.ok(report.results.every(entry => entry.events === report.parity.events));
  assert.ok(report.results.every(entry => entry.checksum === report.parity.checksum));
  assert.ok(report.results.every(entry => entry.materialization.stringFieldReads > 0));
  assert.ok(report.results.every(entry => entry.materialization.eventObjects === 0));
  assert.equal(report.results.find(entry => entry.style === 'index-for').materialization.rawSpanMaterializations, 0);
  assert.ok(report.results.find(entry => entry.style === 'raw-frame-direct').materialization.rawSpanMaterializations > 0);
  assert.ok(report.results.find(entry => entry.style === 'raw-frame-name-id').materialization.rawNameCacheHits > 0);
  for (const entry of report.results) {
    assert.equal(typeof entry.memory?.avgHeapUsedDeltaBytes, 'number');
    assert.equal(typeof entry.memory?.avgRssDeltaBytes, 'number');
    assert.equal(typeof entry.memory?.maxRssBytes, 'number');
  }

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# StreamReaderSync Large Shape Benchmark/);
  assert.match(markdown, /## Materialization Counters/);
  assert.match(markdown, /Raw span materializations/);
  assert.match(markdown, /Name cache hit\/miss/);
  assert.match(markdown, /## Parity/);
});
