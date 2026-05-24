import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'event-reader-byte-batch-cross-process-test.json');
const mdOut = join(tmpDir, 'event-reader-byte-batch-cross-process-test.md');
const outputDir = join(tmpDir, 'event-reader-byte-batch-cross-process-raw');

test('EventReader byte-batch cross-process report repeats full checksum rows', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'event-reader-byte-batch-cross-process.mjs'),
    '--runtimes',
    'node,deno',
    '--process-runs',
    '2',
    '--size-gib',
    '0.0001',
    '--fixture-shape',
    'corpus-cycle',
    '--corpus-file',
    join(__dirname, 'assets', 'books.xml'),
    '--batch-size',
    '4',
    '--variants',
    'readableStreamBatch4,syncIterableBatch4',
    '--output-dir',
    outputDir,
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
  assert.equal(report.objective, 'event-reader-byte-batch-cross-process');
  assert.equal(report.contract, 'independent-process-public-event-object-full-string-checksum');
  assert.deepEqual(report.options.runtimes, ['node', 'deno']);
  assert.deepEqual(report.options.variants, ['readableStreamBatch4', 'syncIterableBatch4']);
  assert.equal(report.runtimes.length, 2);

  const nodeRuntime = report.runtimes.find(entry => entry.runtime === 'node');
  const denoRuntime = report.runtimes.find(entry => entry.runtime === 'deno');
  assert.ok(nodeRuntime);
  assert.ok(denoRuntime);
  assert.equal(nodeRuntime.sampleCount, 2);
  assert.equal(denoRuntime.sampleCount, 2);
  assert.equal(denoRuntime.environment.runtimeName, 'deno');

  for (const runtime of [nodeRuntime, denoRuntime]) {
    assert.equal(runtime.parity.fullRowsStable, true);
    assert.deepEqual(runtime.parity.rowIds, ['readableStreamBatch4', 'syncIterableBatch4']);
    for (const row of runtime.variants) {
      assert.equal(row.fullStringParity, true);
      assert.equal(row.sampleCount, 2);
      assert.equal(row.stableResult, true);
      assert.equal(row.counterexampleFound, false);
    }
  }

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /fresh runtime processes/);
  assert.match(markdown, /public event-object full-string checksum contract/);
  assert.match(markdown, /Runtime: deno/);
  assert.match(markdown, /Deno:/);
  assert.match(markdown, /Full rows stable across processes: yes/);
  assert.match(markdown, /sync-iterable-source-headroom/);
});
