import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'source-consumption-shape-audit-report-test.json');
const mdOut = join(tmpDir, 'source-consumption-shape-audit-report-test.md');

test('source consumption shape audit classifies ArrayBuffer and ReadableStream scope', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'source-consumption-shape-audit.mjs'),
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
  assert.equal(report.objective, 'source-consumption-shape-audit');
  assert.equal(report.contract, 'large-js-full-string-rows-are-not-full-arraybuffer-parser-input');
  assert.equal(report.summary.status, 'classified');
  assert.equal(report.summary.aggregateRowCount, 289);
  assert.equal(report.summary.jsLargeFullRowCount, 239);
  assert.equal(report.summary.largeJsFullSourceModeRows, 233);
  assert.equal(report.summary.notFullArrayBufferRows, 233);
  assert.equal(report.summary.fullArrayBufferRows, 0);
  assert.equal(report.summary.unknownArrayBufferRows, 0);
  assert.equal(report.summary.directReadableStreamRows, 1);
  assert.equal(report.summary.corpusSeedReplayRows, 150);
  assert.equal(report.summary.fileBackedSyncIterableRows, 36);
  assert.equal(report.summary.syncIterableRows, 195);
  assert.equal(report.summary.asyncOrReadableRowsRespectBackpressure, true);
  assert.equal(report.summary.browserLiveRowsRespectBackpressure, true);

  assert.deepEqual(report.summary.sourceModes, [
    'fetch-async-iterable-byte-batches',
    'fetch-readable-stream-pull',
    'file-backed-sync-iterable-byte-batches',
    'sync-iterable-byte-batches',
  ]);
  assert.ok(report.sourceModeBreakdown.some(entry =>
    entry.sourceMode === 'sync-iterable-byte-batches'
    && entry.rows === 195
    && entry.notFullArrayBufferRows === 195
    && entry.fullArrayBufferRows === 0
    && entry.directReadableStreamRows === 0
    && entry.fastestRow.caseId === 'rawFrameNameId'
    && entry.fastestRow.rateMiBPerSec === 185.5
  ));
  assert.ok(report.sourceModeBreakdown.some(entry =>
    entry.sourceMode === 'fetch-readable-stream-pull'
    && entry.rows === 1
    && entry.directReadableStreamRows === 1
    && entry.notFullArrayBufferRows === 1
  ));
  assert.equal(report.sourceConsumptionFrontier.fastestSyncIterable.id, 'sync-iterable-byte-batches-batch-8');
  assert.equal(report.sourceConsumptionFrontier.fastestSyncIterable.rateMiBPerSec, 71.96);
  assert.equal(report.sourceConsumptionFrontier.fastestReadableStream.id, 'web-readable-stream-raw-frame-ascii-batch-8');
  assert.equal(report.sourceConsumptionFrontier.fastestReadableStream.rateMiBPerSec, 76.53);
  assert.equal(report.sourceConsumptionFrontier.fastestReadableStreamRatioToFastestSyncIterable, 1.06);
  assert.equal(report.sourceConsumptionFrontier.backpressureRowsRespected, 6);
  assert.equal(report.sourceConsumptionFrontier.backpressureRows, 6);
  assert.equal(report.browserLiveSourceFrontier.fetchReadableStreamRow.id, 'fetchReadableStreamFull');
  assert.equal(report.browserLiveSourceFrontier.fetchAsyncByteBatchRow.id, 'fetchAsyncByteBatchFull');
  assert.equal(report.browserLiveSourceFrontier.liveRowsBackpressureRespected, 2);
  assert.equal(report.browserLiveSourceFrontier.liveRows, 2);
  assert.equal(report.browserLiveSourceFrontier.liveRowsFullArrayBufferInput, 0);
  assert.ok(report.findings.some(entry => entry.id === 'source-contract-classified'));
  assert.ok(report.findings.some(entry => entry.id === 'direct-readable-stream-separated'));
  assert.ok(report.findings.some(entry => entry.id === 'backpressure-respected'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Source Consumption Shape Audit/);
  assert.match(markdown, /Rows not using full ArrayBuffer parser input: 233\/233/);
  assert.match(markdown, /Full ArrayBuffer parser-input rows: 0/);
  assert.match(markdown, /Direct ReadableStream rows: 1/);
  assert.match(markdown, /Sync Iterable<Uint8Array\[\]> rows: 195/);
  assert.match(markdown, /Backpressure rows respected: 6\/6/);
  assert.match(markdown, /Live rows respecting backpressure: 2\/2/);
  assert.match(markdown, /directReadableStream=true, fullArrayBufferParserInput=false, respectsBackpressure=true/);
  assert.match(markdown, /Direct ReadableStream rows are counted separately from synchronous byte-batch parser rows/);
});
