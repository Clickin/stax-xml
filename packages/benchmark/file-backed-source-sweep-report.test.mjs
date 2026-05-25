import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'file-backed-source-sweep-report-test');
const jsonOut = join(tmpDir, 'file-backed-source-sweep.json');
const mdOut = join(tmpDir, 'file-backed-source-sweep.md');

test('file-backed source sweep reports chunk-size headroom under the checksum contract', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'file-backed-source-sweep.mjs'),
    '--file',
    join(__dirname, 'test-data', 'runtime-comparison-16mib.xml'),
    '--chunk-kibs',
    '16,64',
    '--batch-size',
    '4',
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
  assert.equal(report.objective, 'file-backed-source-sweep');
  assert.equal(report.contract, 'same-full-string-checksum-file-backed-byte-batches');
  assert.equal(report.summary.rowCount, 4);
  assert.equal(report.summary.counterexamples200MiB, 0);
  assert.equal(report.rows.length, 4);
  assert.equal(report.options.batchSize, 4);
  assert.deepEqual(report.options.tools, ['stax-stream', 'stax-raw-frame-name-id']);
  assert.deepEqual(report.rows.map(row => row.id), [
    'stax-stream-chunk-16kib',
    'stax-raw-frame-name-id-chunk-16kib',
    'stax-stream-chunk-64kib',
    'stax-raw-frame-name-id-chunk-64kib',
  ]);
  for (const row of report.rows) {
    assert.equal(row.fullStringParity, true);
    assert.equal(row.batchSize, 4);
    assert.equal(row.eventCount, 967967);
    assert.equal(row.checksum, -746772258);
    assert.equal(row.boundedMemory, true);
    assert.equal(row.memory.maxRssBytes > 0, true);
  }

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# File-Backed Source Sweep/);
  assert.match(markdown, /chunk-size-headroom/);
  assert.match(markdown, /Batch size: 4/);
  assert.match(markdown, /200 MiB\/s bounded counterexamples: 0/);
  assert.match(markdown, /not a JavaScript runtime ceiling proof/);
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
