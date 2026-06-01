import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'source-consumption-shape-audit-report-test.json');
const mdOut = join(tmpDir, 'source-consumption-shape-audit-report-test.md');
const badComparisonOut = join(tmpDir, 'source-consumption-bad-backpressure-comparison.json');
const badJsonOut = join(tmpDir, 'source-consumption-bad-backpressure.json');
const badMdOut = join(tmpDir, 'source-consumption-bad-backpressure.md');

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
  assert.equal(report.summary.primarySourceContract, 'primary-sync-iterable-byte-batches');
  assert.equal(report.summary.primaryParserInput, 'synchronous Iterable<Uint8Array[]>');
  assert.equal(report.summary.primarySourceBoundary, 'demand-driven StreamReaderSync parser pulls');
  assert.match(report.summary.primaryArrayBufferParserInput, /full-target ArrayBuffer parser input is excluded/);
  assert.match(report.summary.primaryBackpressureContract, /one grouped Uint8Array\[\] batch per parser pull/);
  assert.equal(report.summary.primarySyncByteBatchRows, 231);
  assert.equal(report.summary.primaryExcludedRows, 8);
  assert.equal(report.summary.primaryDirectReadableStreamRows, 0);
  assert.equal(report.summary.primaryAsyncSourceRows, 0);
  assert.equal(report.summary.primaryFullArrayBufferRows, 0);
  assert.equal(report.summary.primaryUnknownSourceModeRows, 0);
  assert.deepEqual(report.summary.primarySourceModes, [
    'file-backed-sync-iterable-byte-batches',
    'sync-iterable-byte-batches',
  ]);
  assert.equal(report.summary.primaryFastestRow.caseId, 'rawFrameNameId');
  assert.equal(report.summary.primaryFastestRow.rateMiBPerSec, 185.5);
  assert.equal(report.summary.primaryFastestRow.sourceArtifact, 'text-trim-cost-decomposition.json');
  assert.equal(report.summary.asyncOrReadableRowsRespectBackpressure, true);
  assert.equal(report.summary.browserLiveRowsRespectBackpressure, true);
  assert.equal(report.coverageCrosscheck.status, 'consistent');
  assert.equal(report.coverageCrosscheck.sourceArtifact, 'runtime-proof-coverage-audit.json');
  assert.equal(report.coverageCrosscheck.sourceModeRows, 474);
  assert.equal(report.coverageCrosscheck.notFullArrayBufferRows, 474);
  assert.equal(report.coverageCrosscheck.fullArrayBufferRows, 0);
  assert.equal(report.coverageCrosscheck.directReadableStreamRows, 17);
  assert.equal(report.coverageCrosscheck.demandDrivenRows, 473);
  assert.ok(report.coverageCrosscheck.sourceModeBreakdown.some(entry =>
    entry.sourceMode === 'generated-sync-iterable-byte-batches'
    && entry.rows === 382
    && entry.notFullArrayBufferRows === 382
    && entry.fullArrayBufferRows === 0
  ));
  assert.ok(report.coverageCrosscheck.sourceModeBreakdown.some(entry =>
    entry.sourceMode === 'web-readable-stream-pull'
    && entry.rows === 15
    && entry.directReadableStreamRows === 15
  ));

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
  assert.ok(report.primaryExcludedBreakdown.some(entry =>
    entry.reason === 'async-source-boundary'
    && entry.rows === 1
    && entry.fastestRow.caseId === 'fetchAsyncByteBatchFull'
    && entry.fastestRow.rateMiBPerSec === 9.77
  ));
  assert.ok(report.primaryExcludedBreakdown.some(entry =>
    entry.reason === 'direct-readable-stream'
    && entry.rows === 1
    && entry.fastestRow.caseId === 'fetchReadableStreamFull'
    && entry.fastestRow.rateMiBPerSec === 9.68
  ));
  assert.ok(report.primaryExcludedBreakdown.some(entry =>
    entry.reason === 'unknown-source-mode'
    && entry.rows === 6
    && entry.fastestRow.caseId === 'shortAsciiSubarraySharedDecoder'
    && entry.fastestRow.rateMiBPerSec === 51.6
    && entry.fastestRow.sourceArtifact === 'textdecoder-span-variants.json'
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
  assert.equal(report.summary.representativeStreamRowsRespectBackpressure, true);
  assert.ok(report.findings.some(entry => entry.id === 'source-contract-classified'));
  assert.ok(report.findings.some(entry => entry.id === 'direct-readable-stream-separated'));
  assert.ok(report.findings.some(entry => entry.id === 'primary-frontier-sync-byte-batches-only'));
  assert.ok(report.findings.some(entry => entry.id === 'backpressure-respected'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Source Consumption Shape Audit/);
  assert.match(markdown, /Rows not using full ArrayBuffer parser input: 233\/233/);
  assert.match(markdown, /Full ArrayBuffer parser-input rows: 0/);
  assert.match(markdown, /Direct ReadableStream rows: 1/);
  assert.match(markdown, /Sync Iterable<Uint8Array\[\]> rows: 195/);
  assert.match(markdown, /Primary source contract: primary-sync-iterable-byte-batches/);
  assert.match(markdown, /Primary parser input: synchronous Iterable<Uint8Array\[\]>/);
  assert.match(markdown, /Primary source boundary: demand-driven StreamReaderSync parser pulls/);
  assert.match(markdown, /Primary ArrayBuffer parser input: full-target ArrayBuffer parser input is excluded/);
  assert.match(markdown, /Primary backpressure contract: Primary sync rows yield one grouped Uint8Array\[\] batch per parser pull/);
  assert.match(markdown, /Primary sync byte-batch rows: 231/);
  assert.match(markdown, /Primary excluded rows: 8/);
  assert.match(markdown, /Primary direct ReadableStream rows: 0/);
  assert.match(markdown, /Primary async source rows: 0/);
  assert.match(markdown, /Primary full ArrayBuffer parser-input rows: 0/);
  assert.match(markdown, /Primary unknown source-mode rows: 0/);
  assert.match(markdown, /Primary fastest row: Node\/V8 `rawFrameNameId` 185\.50 MiB\/s from `text-trim-cost-decomposition\.json`/);
  assert.match(markdown, /Coverage source-mode rows: 474/);
  assert.match(markdown, /Coverage not-full-ArrayBuffer rows: 474\/474/);
  assert.match(markdown, /Coverage direct ReadableStream rows: 17/);
  assert.match(markdown, /`generated-sync-iterable-byte-batches` \| 382 \| 382 \| 0/);
  assert.match(markdown, /`web-readable-stream-pull` \| 15 \| 15 \| 0 \| 0 \| 15 \| 15/);
  assert.match(markdown, /`direct-readable-stream` \| 1 \| Chrome\/V8 browser `fetchReadableStreamFull` 9\.68 MiB\/s/);
  assert.match(markdown, /Backpressure rows respected: 6\/6/);
  assert.match(markdown, /Live rows respecting backpressure: 2\/2/);
  assert.match(markdown, /Representative stream rows respect backpressure: true/);
  assert.match(markdown, /directReadableStream=true, fullArrayBufferParserInput=false, respectsBackpressure=true/);
  assert.match(markdown, /Direct ReadableStream rows are counted separately from synchronous byte-batch parser rows/);
  assert.match(markdown, /Primary JavaScript frontier is restricted to synchronous Iterable<Uint8Array\[\]> byte-batch rows/);
});

test('source consumption shape audit downgrades if representative stream rows lose backpressure proof', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [badComparisonOut, badJsonOut, badMdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const comparison = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'same-contract-runtime-comparison.json'), 'utf8'));
  comparison.summary.sourceConsumptionFrontier.fastestReadableStream.respectsBackpressure = false;
  comparison.summary.browserLiveSourceFrontier.fetchReadableStreamRow.respectsBackpressure = false;
  writeFileSync(badComparisonOut, `${JSON.stringify(comparison, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'source-consumption-shape-audit.mjs'),
    '--comparison-json',
    badComparisonOut,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.status, 'partial');
  assert.equal(report.sourceConsumptionFrontier.fastestReadableStream.respectsBackpressure, false);
  assert.equal(report.browserLiveSourceFrontier.fetchReadableStreamRow.respectsBackpressure, false);
  assert.ok(report.findings.some(entry =>
    entry.id === 'backpressure-respected'
    && entry.classification === 'HYPOTHESIS'
  ));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Status: partial/);
  assert.match(markdown, /Representative stream rows respect backpressure: false/);
});
