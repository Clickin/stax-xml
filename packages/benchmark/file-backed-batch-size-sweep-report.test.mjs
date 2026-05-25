import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'file-backed-batch-size-sweep-report-test');
const jsonOut = join(tmpDir, 'file-backed-batch-size-sweep.json');
const mdOut = join(tmpDir, 'file-backed-batch-size-sweep.md');

test('file-backed batch-size sweep preserves checksum while varying Uint8Array array batch size', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'file-backed-batch-size-sweep.mjs'),
    '--file',
    join(__dirname, 'test-data', 'runtime-comparison-16mib.xml'),
    '--chunk-kib',
    '64',
    '--batch-sizes',
    '1,4',
    '--tools',
    'stax-stream',
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
  assert.equal(report.objective, 'file-backed-batch-size-sweep');
  assert.equal(report.contract, 'same-full-string-checksum-file-backed-byte-batch-size');
  assert.equal(report.summary.rowCount, 2);
  assert.equal(report.summary.counterexamples200MiB, 0);
  assert.deepEqual(report.rows.map(row => row.batchSize), [1, 4]);
  for (const row of report.rows) {
    assert.equal(row.fullStringParity, true);
    assert.equal(row.sourceMode, 'file-sync-batches');
    assert.equal(row.eventCount, 967967);
    assert.equal(row.checksum, -746772258);
    assert.equal(row.boundedMemory, true);
    assert.equal(row.memory.maxRssBytes > 0, true);
  }

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# File-Backed Batch Size Sweep/);
  assert.match(markdown, /batch-size-headroom/);
  assert.match(markdown, /Iterable<Uint8Array\[]>/);
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
