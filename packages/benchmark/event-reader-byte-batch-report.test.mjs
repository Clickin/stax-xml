import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'event-reader-byte-batch-report-test.json');
const mdOut = join(tmpDir, 'event-reader-byte-batch-report-test.md');

test('EventReader byte-batch report compares ReadableStream and async byte-batch sources', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'event-reader-byte-batch.mjs'),
    '--size-gib',
    '0.0001',
    '--runs',
    '1',
    '--warmups',
    '0',
    '--diverse-cycle-size',
    '16',
    '--batch-sizes',
    '1,4',
    '--runtime-label',
    'Node/V8 test',
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
  assert.equal(report.objective, 'event-reader-byte-batch');
  assert.equal(report.contract, 'public-event-object-full-string-checksum');
  assert.equal(report.options.runtimeLabel, 'Node/V8 test');
  assert.equal(report.environment.runtimeLabel, 'Node/V8 test');
  assert.deepEqual(report.options.batchSizes, [1, 4]);
  assert.deepEqual(report.variants.map(row => row.id), [
    'readableStreamBatch1',
    'readableStreamBatch4',
    'asyncByteBatch4',
  ]);

  const readable = report.variants.find(row => row.id === 'readableStreamBatch4');
  const asyncBatch = report.variants.find(row => row.id === 'asyncByteBatch4');
  assert.ok(readable);
  assert.ok(asyncBatch);
  assert.equal(readable.fullStringParity, true);
  assert.equal(asyncBatch.fullStringParity, true);
  assert.equal(asyncBatch.eventCount, readable.eventCount);
  assert.equal(asyncBatch.checksum, readable.checksum);
  assert.ok(asyncBatch.sourceBatches < asyncBatch.sourceReads);
  assert.ok(report.findings.some(row => row.id === 'backpressure-preserved'));
  assert.ok(report.findings.some(row => row.id === 'async-byte-batch-headroom'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /EventReader Byte Batch Benchmark/);
  assert.match(markdown, /ReadableStream/);
  assert.match(markdown, /AsyncIterable<Uint8Array\[\]>/);
  assert.match(markdown, /Runtime: Node\/V8 test/);
  assert.match(markdown, /asyncByteBatch4/);
});
