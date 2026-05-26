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

test('stream source consumption shapes report separates sync batches from direct ReadableStream source shape', () => {
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
    '--sync-batch-sizes',
    '1,4',
    '--async-batch-sizes',
    '1,4',
    '--readable-batch-sizes',
    '1,4',
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
  assert.match(report.sourceContract.fullChecksumConsumer, /full-string checksum parity/);
  assert.match(report.sourceContract.fullChecksumConsumer, /different access surfaces/);
  assert.match(report.sourceContract.syncIterableInput, /StreamReaderSync over a synchronous Iterable<Uint8Array\[\]>/);
  assert.match(report.sourceContract.syncIterableInput, /one grouped batch per parser pull/);
  assert.match(report.sourceContract.asyncIterableInput, /StreamReader over an AsyncIterable<Uint8Array\[\]>/);
  assert.match(report.sourceContract.asyncIterableInput, /one pre-grouped byte batch per parser pull/);
  assert.match(report.sourceContract.primaryLargeComparisonInput, /--stax-stream-source file-sync-batches/);
  assert.match(report.sourceContract.primaryLargeComparisonInput, /directReadableStream=false/);
  assert.match(report.sourceContract.readableStreamInput, /ReadableStream<Uint8Array>/);
  assert.match(report.sourceContract.readableStreamAsyncBoundary, /await reader\.read\(\) boundary/);
  assert.match(report.sourceContract.readableStreamAsyncBoundary, /batchSize controls/);
  assert.match(report.sourceContract.readableStreamAsyncBoundary, /not a parser\/runtime ceiling/);
  assert.match(report.sourceContract.readableStreamBackpressure, /reads only inside pull\(\)/);
  assert.match(report.sourceContract.readableStreamBackpressure, /bounded by consumer demand/);
  assert.match(report.sourceContract.arrayBufferConsumption, /Neither measured row constructs one full XML string/);
  assert.match(report.sourceContract.arrayBufferConsumption, /one repeated 1 GiB ArrayBuffer parser input/);
  assert.equal(report.sourceContract.chunkBytes, 64 * 1024);
  assert.equal(report.sourceContract.syncBatchSize, 1);
  assert.deepEqual(report.sourceContract.syncBatchSizes, [1, 4]);
  assert.deepEqual(report.sourceContract.asyncBatchSizes, [1, 4]);
  assert.deepEqual(report.sourceContract.readableBatchSizes, [1, 4]);
  assert.equal(report.sourceFacts.status, 'source-facts-confirmed');
  assert.ok(report.sourceFacts.facts.some(fact => fact.id === 'sync-iterable-byte-batches'));
  assert.ok(report.sourceFacts.facts.some(fact => fact.id === 'stream-reader-single-chunk-push'));
  assert.ok(report.sourceFacts.facts.some(fact => fact.id === 'stream-reader-async-byte-batches'));
  assert.ok(report.sourceFacts.facts.some(fact => fact.id === 'stream-reader-async-raw-batches'));
  assert.ok(report.sourceFacts.facts.some(fact => fact.id === 'benchmark-readable-stream-backpressure'));
  assert.ok(report.sourceFacts.facts.some(fact => fact.id === 'file-backed-release-sync-batches'));
  assert.equal(report.summary.rowCount, 14);
  assert.equal(report.summary.counterexamples200MiB, 0);
  assert.equal(typeof report.summary.asyncIterableRatioToSyncIterable, 'number');
  assert.equal(typeof report.summary.fastestAsyncIterableRatioToFastestSyncIterable, 'number');
  assert.equal(typeof report.summary.readableStreamRatioToSyncIterable, 'number');
  assert.equal(typeof report.summary.readableStreamRatioToFastestSyncIterable, 'number');
  assert.equal(typeof report.summary.fastestReadableStreamRatioToFastestSyncIterable, 'number');
  assert.match(report.summary.fastestSyncIterable.id, /sync-iterable-byte-batches/);
  assert.match(report.summary.fastestAsyncIterable.id, /async-iterable/);
  assert.match(report.summary.fastestReadableStream.id, /web-readable-stream/);
  assert.deepEqual(report.rows.map(row => row.id), [
    'sync-iterable-byte-batches',
    'sync-iterable-byte-batches-batch-4',
    'async-iterable-byte-batches',
    'async-iterable-byte-batches-batch-4',
    'async-iterable-raw-frame',
    'async-iterable-raw-frame-batch-4',
    'async-iterable-raw-frame-ascii',
    'async-iterable-raw-frame-ascii-batch-4',
    'web-readable-stream-pull',
    'web-readable-stream-pull-batch-4',
    'web-readable-stream-raw-frame',
    'web-readable-stream-raw-frame-batch-4',
    'web-readable-stream-raw-frame-ascii',
    'web-readable-stream-raw-frame-ascii-batch-4',
  ]);
  for (const row of report.rows) {
    assert.equal(row.fullStringParity, true);
    assert.equal(row.eventCount, 967967);
    assert.equal(row.checksum, -746772258);
    assert.equal(row.boundedMemory, true);
    assert.equal(row.demandDrivenSource, true);
    assert.equal(row.sampleCount, 1);
    assert.equal(row.sampleSpreadRatio, 0);
    assert.equal(row.memory.maxRssBytes > 0, true);
  }
  const readableRow = report.rows.find(row => row.id === 'web-readable-stream-pull');
  const readableBatch4Row = report.rows.find(row => row.id === 'web-readable-stream-pull-batch-4');
  const syncRow = report.rows.find(row => row.id === 'sync-iterable-byte-batches');
  const syncBatch4Row = report.rows.find(row => row.id === 'sync-iterable-byte-batches-batch-4');
  const asyncRow = report.rows.find(row => row.id === 'async-iterable-byte-batches');
  const asyncBatch4Row = report.rows.find(row => row.id === 'async-iterable-byte-batches-batch-4');
  const asyncRawRow = report.rows.find(row => row.id === 'async-iterable-raw-frame');
  const asyncRawAsciiRow = report.rows.find(row => row.id === 'async-iterable-raw-frame-ascii');
  const readableRawRow = report.rows.find(row => row.id === 'web-readable-stream-raw-frame');
  const readableRawAsciiRow = report.rows.find(row => row.id === 'web-readable-stream-raw-frame-ascii');
  assert.equal(syncRow.parserInput, 'synchronous Iterable<Uint8Array[]>');
  assert.equal(syncRow.sourceMode, 'sync-iterable-byte-batches');
  assert.equal(syncRow.directReadableStream, false);
  assert.equal(syncRow.batchSize, 1);
  assert.equal(syncRow.fullArrayBufferParserInput, false);
  assert.equal(syncBatch4Row.parserInput, 'synchronous Iterable<Uint8Array[]>');
  assert.equal(syncBatch4Row.sourceMode, 'sync-iterable-byte-batches');
  assert.equal(syncBatch4Row.directReadableStream, false);
  assert.equal(syncBatch4Row.batchSize, 4);
  assert.equal(syncBatch4Row.fullArrayBufferParserInput, false);
  assert.equal(asyncRow.parserInput, 'async Iterable<Uint8Array[]>');
  assert.equal(asyncRow.sourceMode, 'async-iterable-byte-batches');
  assert.equal(asyncRow.directReadableStream, false);
  assert.equal(asyncRow.batchSize, 1);
  assert.equal(asyncRow.fullArrayBufferParserInput, false);
  assert.equal(asyncRow.respectsBackpressure, true);
  assert.equal(asyncBatch4Row.parserInput, 'async Iterable<Uint8Array[]>');
  assert.equal(asyncBatch4Row.sourceMode, 'async-iterable-byte-batches');
  assert.equal(asyncBatch4Row.directReadableStream, false);
  assert.equal(asyncBatch4Row.batchSize, 4);
  assert.equal(asyncBatch4Row.fullArrayBufferParserInput, false);
  assert.equal(asyncBatch4Row.respectsBackpressure, true);
  assert.equal(asyncRawRow.parserInput, 'async Iterable<Uint8Array[]>');
  assert.equal(asyncRawRow.sourceMode, 'async-iterable-byte-batches');
  assert.equal(asyncRawRow.accessMode, 'raw-frame');
  assert.equal(asyncRawRow.directReadableStream, false);
  assert.equal(asyncRawRow.fullArrayBufferParserInput, false);
  assert.equal(asyncRawRow.respectsBackpressure, true);
  assert.equal(asyncRawAsciiRow.parserInput, 'async Iterable<Uint8Array[]>');
  assert.equal(asyncRawAsciiRow.sourceMode, 'async-iterable-byte-batches');
  assert.equal(asyncRawAsciiRow.accessMode, 'raw-frame-short-ascii');
  assert.equal(asyncRawAsciiRow.directReadableStream, false);
  assert.equal(asyncRawAsciiRow.fullArrayBufferParserInput, false);
  assert.equal(asyncRawAsciiRow.respectsBackpressure, true);
  assert.equal(readableRow.parserInput, 'Web ReadableStream<Uint8Array>');
  assert.equal(readableRow.batchSize, 1);
  assert.equal(readableRow.directReadableStream, true);
  assert.equal(readableRow.fullArrayBufferParserInput, false);
  assert.equal(readableRow.respectsBackpressure, true);
  assert.equal(readableBatch4Row.parserInput, 'Web ReadableStream<Uint8Array>');
  assert.equal(readableBatch4Row.sourceMode, 'web-readable-stream-pull');
  assert.equal(readableBatch4Row.batchSize, 4);
  assert.equal(readableBatch4Row.directReadableStream, true);
  assert.equal(readableBatch4Row.fullArrayBufferParserInput, false);
  assert.equal(readableBatch4Row.respectsBackpressure, true);
  assert.equal(readableRawRow.parserInput, 'Web ReadableStream<Uint8Array>');
  assert.equal(readableRawRow.sourceMode, 'web-readable-stream-pull');
  assert.equal(readableRawRow.accessMode, 'raw-frame');
  assert.equal(readableRawRow.directReadableStream, true);
  assert.equal(readableRawRow.fullArrayBufferParserInput, false);
  assert.equal(readableRawRow.respectsBackpressure, true);
  assert.equal(readableRawAsciiRow.parserInput, 'Web ReadableStream<Uint8Array>');
  assert.equal(readableRawAsciiRow.sourceMode, 'web-readable-stream-pull');
  assert.equal(readableRawAsciiRow.accessMode, 'raw-frame-short-ascii');
  assert.equal(readableRawAsciiRow.directReadableStream, true);
  assert.equal(readableRawAsciiRow.fullArrayBufferParserInput, false);
  assert.equal(readableRawAsciiRow.respectsBackpressure, true);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Stream Source Consumption Shapes/);
  assert.match(markdown, /## Source Contract/);
  assert.match(markdown, /## Source Facts/);
  assert.match(markdown, /source-facts-confirmed/);
  assert.match(markdown, /Sync Iterable input: sync-iterable-byte-batches uses StreamReaderSync over a synchronous Iterable<Uint8Array\[\]>/);
  assert.match(markdown, /Async Iterable input: async-iterable-byte-batches uses StreamReader over an AsyncIterable<Uint8Array\[\]>/);
  assert.match(markdown, /Sync batch sizes: 1, 4/);
  assert.match(markdown, /Async batch sizes: 1, 4/);
  assert.match(markdown, /ReadableStream batch sizes: 1, 4/);
  assert.match(markdown, /Primary large comparison input: The file-backed release comparison rows call external-baseline with --stax-stream-source file-sync-batches/);
  assert.match(markdown, /ReadableStream async boundary: The direct ReadableStream rows include the public StreamReader await reader\.read\(\) boundary/);
  assert.match(markdown, /sync-iterable-byte-batches \(SOURCE_FACT\)/);
  assert.match(markdown, /stream-reader-single-chunk-push \(SOURCE_FACT\)/);
  assert.match(markdown, /stream-reader-async-byte-batches \(SOURCE_FACT\)/);
  assert.match(markdown, /stream-reader-async-raw-batches \(SOURCE_FACT\)/);
  assert.match(markdown, /benchmark-readable-stream-backpressure \(SOURCE_FACT\)/);
  assert.match(markdown, /file-backed-release-sync-batches \(SOURCE_FACT\)/);
  assert.match(markdown, /ReadableStream backpressure: The ReadableStream source reads only inside pull\(\)/);
  assert.match(markdown, /Demand-driven/);
  assert.match(markdown, /Stream backpressure/);
  assert.match(markdown, /Samples/);
  assert.match(markdown, /Spread/);
  assert.match(markdown, /current-release-source-shape/);
  assert.match(markdown, /sync-batch-size-headroom/);
  assert.match(markdown, /async-byte-batch-source-shape/);
  assert.match(markdown, /async-raw-frame-source-shape/);
  assert.match(markdown, /readable-stream-direct-source-shape/);
  assert.match(markdown, /readable-stream-raw-frame-source-shape/);
  assert.match(markdown, /readable-stream-batch-size-headroom/);
  assert.match(markdown, /backpressure-respected/);
  assert.match(markdown, /not the current release comparison source and not a JavaScript runtime ceiling proof/);
  assert.match(markdown, /rather than a global async-overhead conclusion/);
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
