import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'stream-source-consumption-shapes-report-test');
const jsonOut = join(tmpDir, 'stream-source-consumption-shapes.json');
const mdOut = join(tmpDir, 'stream-source-consumption-shapes.md');

test('stream source consumption shapes report separates sync batches from ReadableStream overhead', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'stream-source-consumption-shapes.mjs'),
    '--file',
    join(__dirname, 'test-data', 'runtime-comparison-16mib.xml'),
    '--chunk-kib',
    '64',
    '--batch-size',
    '1',
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
  assert.equal(report.objective, 'stream-source-consumption-shapes');
  assert.equal(report.contract, 'same-full-string-checksum-source-consumption-shapes');
  assert.equal(report.summary.rowCount, 2);
  assert.equal(report.summary.counterexamples200MiB, 0);
  assert.equal(typeof report.summary.readableStreamRatioToSyncIterable, 'number');
  assert.deepEqual(report.rows.map(row => row.id), [
    'sync-iterable-byte-batches',
    'web-readable-stream-pull',
  ]);
  for (const row of report.rows) {
    assert.equal(row.fullStringParity, true);
    assert.equal(row.eventCount, 967967);
    assert.equal(row.checksum, -746772258);
    assert.equal(row.boundedMemory, true);
    assert.equal(row.memory.maxRssBytes > 0, true);
  }
  const readableRow = report.rows.find(row => row.id === 'web-readable-stream-pull');
  assert.equal(readableRow.respectsBackpressure, true);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Stream Source Consumption Shapes/);
  assert.match(markdown, /current-release-source-shape/);
  assert.match(markdown, /backpressure-respected/);
  assert.match(markdown, /not as a JavaScript runtime ceiling proof/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }
}
