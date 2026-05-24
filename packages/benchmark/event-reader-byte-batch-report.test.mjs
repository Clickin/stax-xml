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

test('EventReader byte-batch report compares ReadableStream, async byte-batch, and sync iterable byte-batch sources', () => {
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
    'syncIterableBatch1',
    'syncIterableBatch4',
  ]);

  const readable = report.variants.find(row => row.id === 'readableStreamBatch4');
  const asyncBatch = report.variants.find(row => row.id === 'asyncByteBatch4');
  const syncBatch = report.variants.find(row => row.id === 'syncIterableBatch4');
  assert.ok(readable);
  assert.ok(asyncBatch);
  assert.ok(syncBatch);
  assert.equal(readable.fullStringParity, true);
  assert.equal(asyncBatch.fullStringParity, true);
  assert.equal(syncBatch.fullStringParity, true);
  assert.equal(asyncBatch.eventCount, readable.eventCount);
  assert.equal(asyncBatch.checksum, readable.checksum);
  assert.equal(syncBatch.eventCount, readable.eventCount);
  assert.equal(syncBatch.checksum, readable.checksum);
  assert.ok(asyncBatch.sourceBatches < asyncBatch.sourceReads);
  assert.ok(syncBatch.sourceBatches < syncBatch.sourceReads);
  assert.ok(report.findings.some(row => row.id === 'backpressure-preserved'));
  assert.ok(report.findings.some(row => row.id === 'async-byte-batch-headroom'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /EventReader Byte Batch Benchmark/);
  assert.match(markdown, /ReadableStream/);
  assert.match(markdown, /AsyncIterable<Uint8Array\[\]>/);
  assert.match(markdown, /Iterable<Uint8Array\[\]>/);
  assert.match(markdown, /Runtime: Node\/V8 test/);
  assert.match(markdown, /asyncByteBatch4/);
  assert.match(markdown, /syncIterableBatch4/);
});

test('EventReader byte-batch report supports a corpus-cycle fixture seed', () => {
  mkdirSync(tmpDir, { recursive: true });
  const corpusJsonOut = join(tmpDir, 'event-reader-byte-batch-corpus-report-test.json');
  const corpusMdOut = join(tmpDir, 'event-reader-byte-batch-corpus-report-test.md');
  for (const filePath of [corpusJsonOut, corpusMdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const corpusFile = join(__dirname, 'assets', 'books.xml');
  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'event-reader-byte-batch.mjs'),
    '--size-gib',
    '0.0001',
    '--runs',
    '1',
    '--warmups',
    '0',
    '--fixture-shape',
    'corpus-cycle',
    '--corpus-file',
    corpusFile,
    '--corpus-chunk-kib',
    '1',
    '--batch-sizes',
    '1,4',
    '--runtime-label',
    'Node/V8 corpus test',
    '--json-out',
    corpusJsonOut,
    '--md-out',
    corpusMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(corpusJsonOut, 'utf8'));
  assert.equal(report.fixture.source, 'corpus-cycle');
  assert.equal(report.options.fixtureShape, 'corpus-cycle');
  assert.equal(report.options.corpusFile, corpusFile);
  assert.equal(report.options.corpusChunkKiB, 1);
  assert.ok(report.fixture.rows > 1);
  assert.ok(report.fixture.sourceBytes > 0);
  assert.equal(report.fixture.chunkBytes, 1024);

  const readable = report.variants.find(row => row.id === 'readableStreamBatch4');
  const asyncBatch = report.variants.find(row => row.id === 'asyncByteBatch4');
  const syncBatch = report.variants.find(row => row.id === 'syncIterableBatch4');
  assert.ok(readable);
  assert.ok(asyncBatch);
  assert.ok(syncBatch);
  assert.equal(asyncBatch.eventCount, readable.eventCount);
  assert.equal(asyncBatch.checksum, readable.checksum);
  assert.equal(syncBatch.eventCount, readable.eventCount);
  assert.equal(syncBatch.checksum, readable.checksum);
  assert.ok(asyncBatch.sourceBatches < asyncBatch.sourceReads);
  assert.ok(syncBatch.sourceBatches < syncBatch.sourceReads);

  const markdown = readFileSync(corpusMdOut, 'utf8');
  assert.match(markdown, /Fixture shape: corpus-cycle/);
  assert.match(markdown, /Corpus file:/);
  assert.match(markdown, /Corpus chunk KiB: 1/);
});
