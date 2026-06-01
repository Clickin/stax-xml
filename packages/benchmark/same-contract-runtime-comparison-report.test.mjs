import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'same-contract-runtime-comparison-report-test');
const jsonOut = join(tmpDir, 'same-contract-runtime-comparison.json');
const mdOut = join(tmpDir, 'same-contract-runtime-comparison.md');

test('same-contract runtime comparison aggregates existing rows without normalizing memory models', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'same-contract-runtime-comparison.mjs'),
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
  assert.equal(report.objective, 'same-contract-runtime-comparison');
  assert.equal(report.contract, 'same-full-string-checksum-contract-not-same-object-shape');
  assert.equal(report.summary.jsRuntimeCounterexamples200MiB, 0);
  assert.equal(report.summary.conclusionAllowed, false);
  assert.equal(report.summary.rowCount, 277);
  assert.equal(report.summary.jsLargeFullRowCount, 230);
  assert.equal(report.summary.fastestJsLargeFullRow.sourceArtifact, 'text-trim-cost-decomposition.json');
  assert.equal(report.summary.fastestJsLargeFullRow.runtimeId, 'node-v8');
  assert.equal(report.summary.fastestJsLargeFullRow.caseId, 'rawFrameNameId');
  assert.equal(report.summary.fastestJsLargeFullRow.mibPerSec, 185.5);
  assert.equal(report.summary.fastestJsLargeFullRow.fullArrayBufferParserInput, false);
  assert.equal(report.summary.fastestJsLargeFullRow.sampleCount, 3);
  assert.equal(report.summary.fastestJsLargeFullRow.sampleMinMiBPerSec, 184.09);
  assert.equal(report.summary.fastestJsLargeFullRow.sampleMaxMiBPerSec, 186.66);
  assert.equal(report.summary.fastestJsLargeFullRowTo200MiBPerSec.ratio, 0.93);
  assert.equal(report.summary.fastestJsLargeFullRowTo200MiBPerSec.remainingMiBPerSec, 14.5);
  assert.equal(report.summary.fastestJsLargeFullRowTo1024MiBWoodstoxReference.ratio, 0.55);
  assert.equal(report.summary.fastestJsLargeFullRowTo1024MiBWoodstoxReference.remainingTo90PercentMiBPerSec, 118.67);
  assert.match(report.summary.fastestJsLargeFullRowTo1024MiBWoodstoxReference.caveat, /different corpus fixture/);
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRow.caseId, 'eventObjectFull');
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRow.boundedMemory, true);
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRow.sourceArtifact, 'candidate-headroom-books-corpus-stability.json');
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRow.mibPerSec, 141.62);
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRow.sampleCount, 3);
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRow.sourceMode, 'sync-iterable-byte-batches');
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRow.directReadableStream, false);
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRow.fullArrayBufferParserInput, false);
  assert.ok(report.summary.fastestBoundedJsLargePublicEventRow.mibPerSec < 200);
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRowTo200MiBPerSec.ratio, 0.71);
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRowTo200MiBPerSec.remainingMiBPerSec, 58.38);
  assert.match(report.summary.fastestBoundedJsLargePublicEventRowTo200MiBPerSec.caveat, /public event-object frontier/);
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRowTo1024MiBWoodstoxReference.ratio, 0.42);
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRowTo1024MiBWoodstoxReference.remainingTo90PercentMiBPerSec, 162.55);
  assert.match(report.summary.fastestBoundedJsLargePublicEventRowTo1024MiBWoodstoxReference.caveat, /target distance only/);
  assert.equal(report.summary.externalBaseline16MiB.woodstoxMiBPerSec, 303.1);
  assert.equal(report.summary.externalBaseline16MiB.quickXmlMiBPerSec, 243.43);
  assert.equal(report.summary.externalBaseline16MiB.quickXmlWoodstoxRatio, 0.8);
  assert.equal(report.summary.externalBaseline1024MiBFileSyncBatches.staxStreamMiBPerSec, 124.62);
  assert.ok(report.summary.externalBaseline1024MiBFileSyncBatches.staxStreamWoodstoxRatio > 0.3);
  assert.ok(report.summary.externalBaseline1024MiBFileSyncBatches.staxStreamWoodstoxRatio < 0.4);
  assert.equal(report.summary.externalBaseline1024MiBFileSyncBatches.rawFrameNameIdMiBPerSec, 132.54);
  assert.ok(report.summary.externalBaseline1024MiBFileSyncBatches.rawFrameNameIdWoodstoxRatio >= 0.39);
  assert.ok(report.summary.externalBaseline1024MiBFileSyncBatches.rawFrameNameIdWoodstoxRatio < 0.5);
  assert.equal(report.summary.externalBaseline1024MiBFileSyncBatches.woodstoxMiBPerSec, 337.97);
  assert.equal(report.summary.externalBaseline1024MiBFileSyncBatches.quickXmlMiBPerSec, 270.26);
  assert.equal(report.summary.externalBaseline1024MiBFileSyncBatches.quickXmlWoodstoxRatio, 0.8);
  assert.equal(report.summary.sameFixture1024MiBWoodstoxTarget.group, 'file-backed-batch-size-sweep');
  assert.equal(report.summary.sameFixture1024MiBWoodstoxTarget.sourceArtifact, 'file-backed-batch-size-sweep.json');
  assert.equal(report.summary.sameFixture1024MiBWoodstoxTarget.fastestJsCaseId, 'stax-raw-frame-name-id-batch-8');
  assert.equal(report.summary.sameFixture1024MiBWoodstoxTarget.fastestJsMiBPerSec, 152.11);
  assert.equal(report.summary.sameFixture1024MiBWoodstoxTarget.woodstoxSourceArtifact, 'file-backed-trim-boundary-check-candidate.json');
  assert.equal(report.summary.sameFixture1024MiBWoodstoxTarget.woodstoxMiBPerSec, 351.56);
  assert.equal(report.summary.sameFixture1024MiBWoodstoxTarget.target90MiBPerSec, 316.4);
  assert.equal(report.summary.sameFixture1024MiBWoodstoxTarget.fastestJsWoodstoxRatio, 0.43);
  assert.equal(report.summary.sameFixture1024MiBWoodstoxTarget.remainingTo90PercentMiBPerSec, 164.29);
  assert.equal(report.summary.sameFixture1024MiBWoodstoxTarget.targetMet, false);
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTarget.group, 'file-backed-batch-size-sweep');
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTarget.sourceArtifact, 'file-backed-batch-size-sweep.json');
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTarget.fastestJsCaseId, 'stax-raw-frame-name-id-batch-8');
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTarget.fastestJsMiBPerSec, 152.11);
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTarget.quickXmlSourceArtifact, 'file-backed-short-attr-value-cache-candidate.json');
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTarget.quickXmlMiBPerSec, 274.63);
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTarget.target90MiBPerSec, 247.17);
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTarget.fastestJsQuickXmlRatio, 0.55);
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTarget.remainingTo90PercentMiBPerSec, 95.06);
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTarget.targetMet, false);
  assert.equal(report.summary.sameFixture1024MiBTargetRows.length, 6);
  assert.deepEqual(report.summary.sameFixture1024MiBTargetRows.map(row => row.group), [
    'file-backed-batch-size-sweep',
    'file-backed-source-sweep',
    'file-backed-short-attr-value-cache-candidate',
    'file-backed-trim-boundary-check-candidate',
    'file-backed-long-ascii-text-candidate',
    'external-baseline-1024mib-file-sync-batches',
  ]);
  assert.equal(report.summary.sameFixture1024MiBTargetRows[0].fastestJs.caseId, 'stax-raw-frame-name-id-batch-8');
  assert.equal(report.summary.sameFixture1024MiBTargetRows[0].fastestJs.sourceMode, 'file-backed-sync-iterable-byte-batches');
  assert.equal(report.summary.sameFixture1024MiBTargetRows[0].fastestJs.memory.maxMiB, 61.77);
  assert.equal(report.summary.sameFixture1024MiBTargetRows[0].woodstoxReference.sourceArtifact, 'file-backed-trim-boundary-check-candidate.json');
  assert.equal(report.summary.sameFixture1024MiBTargetRows[0].woodstox90MiBPerSec, 316.4);
  assert.equal(report.summary.sameFixture1024MiBTargetRows[0].remainingTo90PercentMiBPerSec, 164.29);
  assert.equal(report.summary.sameFixture1024MiBTargetRows[0].targetMet, false);
  assert.match(report.summary.sameFixture1024MiBTargetRows[0].caveat, /separate candidate artifact/);
  assert.equal(report.summary.sameFixture1024MiBTargetRows[2].woodstoxReference.sourceArtifact, 'file-backed-short-attr-value-cache-candidate.json');
  assert.equal(report.summary.sameFixture1024MiBTargetRows[2].woodstox90MiBPerSec, 304.33);
  assert.match(report.summary.sameFixture1024MiBTargetRows[2].caveat, /same artifact/);
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTargetRows.length, 6);
  assert.deepEqual(report.summary.sameFixture1024MiBQuickXmlTargetRows.map(row => row.group), [
    'file-backed-batch-size-sweep',
    'file-backed-source-sweep',
    'file-backed-short-attr-value-cache-candidate',
    'file-backed-trim-boundary-check-candidate',
    'file-backed-long-ascii-text-candidate',
    'external-baseline-1024mib-file-sync-batches',
  ]);
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTargetRows[0].fastestJs.caseId, 'stax-raw-frame-name-id-batch-8');
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTargetRows[0].quickXmlReference.sourceArtifact, 'file-backed-short-attr-value-cache-candidate.json');
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTargetRows[0].quickXml90MiBPerSec, 247.17);
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTargetRows[0].remainingTo90PercentMiBPerSec, 95.06);
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTargetRows[0].targetMet, false);
  assert.match(report.summary.sameFixture1024MiBQuickXmlTargetRows[0].caveat, /separate candidate artifact/);
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTargetRows[2].quickXmlReference.sourceArtifact, 'file-backed-short-attr-value-cache-candidate.json');
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTargetRows[2].quickXml90MiBPerSec, 247.17);
  assert.match(report.summary.sameFixture1024MiBQuickXmlTargetRows[2].caveat, /same artifact/);
  assert.equal(report.summary.sameFixture1024MiBProcessRssSnapshot.fastestJs.maxRssMiB, 61.77);
  assert.equal(report.summary.sameFixture1024MiBProcessRssSnapshot.fastestJs.sourceArtifact, 'file-backed-batch-size-sweep.json');
  assert.equal(report.summary.sameFixture1024MiBProcessRssSnapshot.woodstox.maxRssMiB, 312.71);
  assert.equal(report.summary.sameFixture1024MiBProcessRssSnapshot.woodstox.sourceArtifact, 'file-backed-trim-boundary-check-candidate.json');
  assert.equal(report.summary.sameFixture1024MiBProcessRssSnapshot.quickXml.maxRssMiB, 4.78);
  assert.equal(report.summary.sameFixture1024MiBProcessRssSnapshot.quickXml.sourceArtifact, 'file-backed-short-attr-value-cache-candidate.json');
  assert.match(report.summary.sameFixture1024MiBProcessRssSnapshot.caveat, /not allocation-model equivalence/);
  assert.equal(report.summary.fastestJsLargeFullRowTo1024MiBWoodstoxReference.comparableFixture, false);
  assert.equal(report.summary.textMaterializationFrontier.sourceArtifact, 'text-materialization-frontier.json');
  assert.equal(report.summary.textMaterializationFrontier.fastestFull.id, 'rawFrameNameId');
  assert.equal(report.summary.textMaterializationFrontier.fastestFull.mibPerSec, 185.5);
  assert.equal(report.summary.textMaterializationFrontier.fastestFullRemainingMiBPerSec, 14.5);
  assert.equal(report.summary.textMaterializationFrontier.requiredSpeedupToTarget, 1.08);
  assert.equal(report.summary.textMaterializationFrontier.fastestWithoutText.id, 'withoutTextStrings');
  assert.equal(report.summary.textMaterializationFrontier.fastestWithoutText.mibPerSec, 252.36);
  assert.equal(report.summary.textMaterializationFrontier.fastestWithoutText.fullStringParity, false);
  assert.equal(report.summary.textMaterializationFrontier.fastestWithoutTextToFullRatio, 1.36);
  assert.equal(report.summary.textMaterializationFrontier.noTextRowsCrossTarget, 4);
  assert.equal(report.summary.textMaterializationFrontier.fullRowsCrossTarget, 0);
  assert.equal(report.summary.textMaterializationFrontier.negativeCandidateCount, 21);
  assert.equal(report.summary.textMaterializationFrontier.conclusionAllowed, false);
  assert.ok(report.metadata.sourceArtifacts.includes('text-materialization-frontier.json'));
  assert.ok(report.findings.some(finding =>
    finding.id === 'text-materialization-frontier-visible'
    && finding.status === 'HEADROOM_CLASSIFIED'
  ));
  assert.deepEqual(report.summary.memoryMetricKinds, ['browser-js-heap', 'browser-js-heap-unavailable', 'process-rss']);
  assert.equal(report.summary.memoryFrontier.contract, '1gib-plus-js-full-string-memory-frontier');
  assert.equal(report.summary.memoryFrontier.rows, 230);
  assert.equal(report.summary.memoryFrontier.boundedRows, 213);
  assert.equal(report.summary.memoryFrontier.unboundedRows, 17);
  assert.deepEqual(report.summary.memoryFrontier.memoryKinds, ['browser-js-heap', 'browser-js-heap-unavailable', 'process-rss']);
  assert.equal(report.summary.memoryFrontier.fastestBoundedRow.caseId, 'rawFrameNameId');
  assert.equal(report.summary.memoryFrontier.fastestBoundedRow.mibPerSec, 185.5);
  assert.equal(report.summary.memoryFrontier.fastestBoundedRow.memory.primaryKind, 'process-rss');
  assert.equal(report.summary.memoryFrontier.fastestBoundedRow.memory.maxMiB, 60.45);
  assert.equal(report.summary.memoryFrontier.fastestProcessRssUnder128MiB.caseId, 'rawFrameNameId');
  assert.equal(report.summary.memoryFrontier.fastestProcessRssUnder128MiB.memory.maxMiB, 60.45);
  assert.equal(report.summary.memoryFrontier.fastestBrowserJsHeapRow.caseId, 'rawFrameNameId');
  assert.equal(report.summary.memoryFrontier.fastestBrowserJsHeapRow.mibPerSec, 69.9);
  assert.equal(report.summary.memoryFrontier.fastestBrowserJsHeapRow.memory.maxMiB, 39.55);
  assert.deepEqual(report.summary.memoryFrontier.buckets.map(bucket => ({
    kind: bucket.kind,
    rows: bucket.rows,
    boundedRows: bucket.boundedRows,
    unboundedRows: bucket.unboundedRows,
    maxMiB: bucket.maxMiB,
    fastestCase: bucket.fastestRow.caseId,
    fastestBoundedCase: bucket.fastestBoundedRow?.caseId ?? null,
  })), [
    {
      kind: 'browser-js-heap',
      rows: 20,
      boundedRows: 20,
      unboundedRows: 0,
      maxMiB: 358.37,
      fastestCase: 'rawFrameNameId',
      fastestBoundedCase: 'rawFrameNameId',
    },
    {
      kind: 'browser-js-heap-unavailable',
      rows: 9,
      boundedRows: 0,
      unboundedRows: 9,
      maxMiB: null,
      fastestCase: 'rawFrameNameId',
      fastestBoundedCase: null,
    },
      {
        kind: 'process-rss',
        rows: 201,
        boundedRows: 193,
        unboundedRows: 8,
      maxMiB: 1956.69,
      fastestCase: 'rawFrameNameId',
      fastestBoundedCase: 'rawFrameNameId',
    },
  ]);
  assert.match(report.summary.memoryFrontier.interpretation, /same 1 GiB\+ JavaScript full-string row set/);
  assert.ok(report.findings.some(finding =>
    finding.id === 'large-js-full-memory-frontier-visible'
    && finding.status === 'CLASSIFIED'
  ));
  assert.deepEqual(report.summary.sourceModes, [
    'fetch-async-iterable-byte-batches',
    'fetch-readable-stream-pull',
    'file-backed-sync-iterable-byte-batches',
    'sync-iterable-byte-batches',
  ]);
  assert.deepEqual(report.summary.sourceShapeSafety, {
    largeJsFullSourceModeRows: 224,
    notFullArrayBufferRows: 224,
    fullArrayBufferRows: 0,
    unknownArrayBufferRows: 0,
    corpusSeedReplayRows: 141,
    fileBackedSyncIterableRows: 36,
    directReadableStreamRows: 1,
    maxCorpusSeedMiB: 100.26,
    maxCorpusSeedToTargetRatio: 0.09,
    sourceModeBreakdown: [
      {
        sourceMode: 'fetch-async-iterable-byte-batches',
        rows: 1,
        notFullArrayBufferRows: 1,
        fullArrayBufferRows: 0,
        unknownArrayBufferRows: 0,
        directReadableStreamRows: 0,
        corpusSeedReplayRows: 1,
        fastestRow: {
          sourceArtifact: 'browser-fetch-readable-stream-books-corpus.json',
          runtimeLabel: 'Chrome/V8 browser',
          caseId: 'fetchAsyncByteBatchFull',
          mibPerSec: 9.77,
          fullStringParity: true,
          boundedMemory: true,
        },
      },
      {
        sourceMode: 'fetch-readable-stream-pull',
        rows: 1,
        notFullArrayBufferRows: 1,
        fullArrayBufferRows: 0,
        unknownArrayBufferRows: 0,
        directReadableStreamRows: 1,
        corpusSeedReplayRows: 1,
        fastestRow: {
          sourceArtifact: 'browser-fetch-readable-stream-books-corpus.json',
          runtimeLabel: 'Chrome/V8 browser',
          caseId: 'fetchReadableStreamFull',
          mibPerSec: 9.68,
          fullStringParity: true,
          boundedMemory: true,
        },
      },
      {
        sourceMode: 'file-backed-sync-iterable-byte-batches',
        rows: 36,
        notFullArrayBufferRows: 36,
        fullArrayBufferRows: 0,
        unknownArrayBufferRows: 0,
        directReadableStreamRows: 0,
        corpusSeedReplayRows: 0,
        fastestRow: {
          sourceArtifact: 'file-backed-batch-size-sweep.json',
          runtimeLabel: 'Node/V8',
          caseId: 'stax-raw-frame-name-id-batch-8',
          mibPerSec: 152.11,
          fullStringParity: true,
          boundedMemory: true,
        },
      },
      {
        sourceMode: 'sync-iterable-byte-batches',
        rows: 186,
        notFullArrayBufferRows: 186,
        fullArrayBufferRows: 0,
        unknownArrayBufferRows: 0,
        directReadableStreamRows: 0,
        corpusSeedReplayRows: 139,
        fastestRow: {
          sourceArtifact: 'text-trim-cost-decomposition.json',
          runtimeLabel: 'Node/V8',
          caseId: 'rawFrameNameId',
          mibPerSec: 185.5,
          fullStringParity: true,
          boundedMemory: true,
        },
      },
    ],
  });
  assert.ok(report.metadata.sourceArtifacts.includes('no-counter-name-fold-cache-cross-process-books-corpus.json'));
  assert.ok(report.metadata.sourceArtifacts.includes('no-counter-materialization-candidate.json'));
  assert.ok(report.metadata.sourceArtifacts.includes('no-counter-materialization-batch1-candidate.json'));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'no-counter-materialization-negative'
    && row.sourceArtifact === 'no-counter-materialization-candidate.json'
    && row.runtimeId === 'node-v8'
    && row.caseId === 'rawFrameNameIdNoCountersStringFoldCache'
    && row.mibPerSec === 100.43
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.fullArrayBufferParserInput === false
    && row.eventCount === 57096514
    && row.checksum === -540013997
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 83.75
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'no-counter-materialization-batch1-negative'
    && row.sourceArtifact === 'no-counter-materialization-batch1-candidate.json'
    && row.runtimeId === 'node-v8'
    && row.caseId === 'rawFrameNameIdNoCountersNameFoldCache'
    && row.mibPerSec === 94.71
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.fullArrayBufferParserInput === false
    && row.eventCount === 57096514
    && row.checksum === -540013997
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 73.32
  ));
  assert.ok(report.metadata.sourceArtifacts.includes('deno-candidate-headroom-cross-process-books-corpus.json'));
  assert.ok(report.comparisonRows.some(row =>
    row.sourceArtifact === 'deno-candidate-headroom-cross-process-books-corpus.json'
    && row.group === 'deno-cross-process-books-corpus'
    && row.runtimeId === 'deno-v8'
    && row.runtimeLabel === 'Deno/V8'
    && row.caseId === 'stringFull'
    && row.mibPerSec === 81.48
    && row.boundedMemory === true
    && row.fullStringParity === true
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.fullArrayBufferParserInput === false
    && row.sampleCount === 3
  ));
  assert.ok(report.metadata.sourceArtifacts.includes('deno-candidate-headroom-cross-process-midsize-corpus.json'));
  assert.ok(report.comparisonRows.some(row =>
    row.sourceArtifact === 'deno-candidate-headroom-cross-process-midsize-corpus.json'
    && row.group === 'deno-cross-process-midsize-corpus'
    && row.runtimeId === 'deno-v8'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 72.37
    && row.sampleMinMiBPerSec === 71.98
    && row.sampleMaxMiBPerSec === 72.84
    && row.eventCount === 78059522
    && row.checksum === -34487917
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.sampleCount === 3
    && row.memory.primaryKind === 'process-rss'
    && row.sourceMode === 'sync-iterable-byte-batches'
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.sourceArtifact === 'warmup-full-cross-process-books-corpus.json'
    && row.group === 'warmup-full-cross-process-books-corpus'
    && row.caseId === 'rawFrameNameIdNoCounters'
    && row.mibPerSec === 93.96
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 73
    && row.sampleCount === 3
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.sourceArtifact === 'no-counter-name-fold-cache-cross-process-books-corpus.json'
    && row.group === 'no-counter-name-fold-cache-cross-process-books-corpus'
    && row.caseId === 'rawFrameNameIdNoCountersNameFoldCache'
    && row.mibPerSec === 132.06
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 66.67
    && row.sampleCount === 3
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.sourceArtifact === 'text-trim-cost-cross-process-books-corpus.json'
    && row.group === 'text-trim-cost-cross-process-books-corpus'
    && row.runtimeId === 'bun-jsc'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 119.21
    && row.sampleMinMiBPerSec === 118.96
    && row.sampleMaxMiBPerSec === 119.64
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 178.54
    && row.sampleCount === 3
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.sourceArtifact === 'text-trim-cost-cross-process-diverse-cycle.json'
    && row.group === 'text-trim-cost-cross-process-diverse-cycle'
    && row.runtimeId === 'node-v8'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 57.31
    && row.sampleMinMiBPerSec === 56.77
    && row.sampleMaxMiBPerSec === 57.67
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 74.26
    && row.sampleCount === 3
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.fullArrayBufferParserInput === false
  ));
  assert.equal(report.summary.sourceConsumptionFrontier.sourceArtifact, 'stream-source-consumption-backpressure-counters.json');
  assert.equal(report.summary.sourceConsumptionFrontier.fastestSyncIterable.id, 'sync-iterable-byte-batches-batch-8');
  assert.equal(report.summary.sourceConsumptionFrontier.fastestSyncIterable.parserInput, 'synchronous Iterable<Uint8Array[]>');
  assert.equal(report.summary.sourceConsumptionFrontier.fastestSyncIterable.mibPerSec, 71.96);
  assert.equal(report.summary.sourceConsumptionFrontier.fastestSyncIterable.batchCount, 2048);
  assert.equal(report.summary.sourceConsumptionFrontier.fastestSyncIterable.pullCalls, 0);
  assert.equal(report.summary.sourceConsumptionFrontier.fastestAsyncIterable.id, 'async-iterable-raw-frame-ascii-batch-8');
  assert.equal(report.summary.sourceConsumptionFrontier.fastestAsyncIterable.mibPerSec, 77.56);
  assert.equal(report.summary.sourceConsumptionFrontier.fastestAsyncIterableRatioToFastestSyncIterable, 1.08);
  assert.equal(report.summary.sourceConsumptionFrontier.fastestReadableStream.id, 'web-readable-stream-raw-frame-ascii-batch-8');
  assert.equal(report.summary.sourceConsumptionFrontier.fastestReadableStream.parserInput, 'Web ReadableStream<Uint8Array>');
  assert.equal(report.summary.sourceConsumptionFrontier.fastestReadableStream.mibPerSec, 76.53);
  assert.equal(report.summary.sourceConsumptionFrontier.fastestReadableStream.directReadableStream, true);
  assert.equal(report.summary.sourceConsumptionFrontier.fastestReadableStream.pullCalls, 16385);
  assert.equal(report.summary.sourceConsumptionFrontier.fastestReadableStream.enqueueCalls, 16384);
  assert.equal(report.summary.sourceConsumptionFrontier.fastestReadableStreamRatioToFastestSyncIterable, 1.06);
  assert.equal(report.summary.sourceConsumptionFrontier.backpressureRows, 6);
  assert.equal(report.summary.sourceConsumptionFrontier.backpressureRowsRespected, 6);
  assert.equal(report.summary.sourceConsumptionFrontier.fullArrayBufferRows, 0);
  assert.equal(report.summary.sourceConsumptionFrontier.counterexamples200MiB, 0);
  assert.match(report.summary.sourceConsumptionFrontier.primaryLargeComparisonInput, /file-sync-batches/);
  assert.match(report.summary.sourceConsumptionFrontier.interpretation, /direct ReadableStream rows are separate source-shape evidence/);
  assert.ok(report.metadata.sourceArtifacts.includes('stream-source-consumption-backpressure-counters.json'));
  assert.ok(report.findings.some(finding =>
    finding.id === 'source-consumption-frontier-visible'
    && finding.status === 'CLASSIFIED'
  ));
  assert.equal(report.summary.browserLiveSourceFrontier.sourceArtifact, 'browser-fetch-readable-stream-books-corpus.json');
  assert.equal(report.summary.browserLiveSourceFrontier.preparedSeedRow.id, 'eventObjectFull');
  assert.equal(report.summary.browserLiveSourceFrontier.preparedSeedRow.sourceMode, 'sync-iterable-byte-batches');
  assert.equal(report.summary.browserLiveSourceFrontier.preparedSeedRow.mibPerSec, 64.56);
  assert.equal(report.summary.browserLiveSourceFrontier.fetchReadableStreamRow.id, 'fetchReadableStreamFull');
  assert.equal(report.summary.browserLiveSourceFrontier.fetchReadableStreamRow.sourceMode, 'fetch-readable-stream-pull');
  assert.equal(report.summary.browserLiveSourceFrontier.fetchReadableStreamRow.mibPerSec, 9.68);
  assert.equal(report.summary.browserLiveSourceFrontier.fetchReadableStreamRow.directReadableStream, true);
  assert.equal(report.summary.browserLiveSourceFrontier.fetchReadableStreamRow.fullArrayBufferParserInput, false);
  assert.equal(report.summary.browserLiveSourceFrontier.fetchAsyncByteBatchRow.id, 'fetchAsyncByteBatchFull');
  assert.equal(report.summary.browserLiveSourceFrontier.fetchAsyncByteBatchRow.sourceMode, 'fetch-async-iterable-byte-batches');
  assert.equal(report.summary.browserLiveSourceFrontier.fetchAsyncByteBatchRow.mibPerSec, 9.77);
  assert.equal(report.summary.browserLiveSourceFrontier.fastestLiveRow.id, 'fetchAsyncByteBatchFull');
  assert.equal(report.summary.browserLiveSourceFrontier.liveRows, 2);
  assert.equal(report.summary.browserLiveSourceFrontier.liveRowsBackpressureRespected, 2);
  assert.equal(report.summary.browserLiveSourceFrontier.liveRowsFullArrayBufferInput, 0);
  assert.equal(report.summary.browserLiveSourceFrontier.readableToPreparedRatio, 0.15);
  assert.equal(report.summary.browserLiveSourceFrontier.asyncBatchToPreparedRatio, 0.15);
  assert.match(report.summary.browserLiveSourceFrontier.interpretation, /separate from prepared corpus-seed replay rows/);
  assert.ok(report.metadata.sourceArtifacts.includes('browser-fetch-readable-stream-books-corpus.json'));
  assert.ok(report.findings.some(finding =>
    finding.id === 'browser-live-fetch-source-visible'
    && finding.status === 'CLASSIFIED'
  ));
  assert.ok(report.comparisonRows
    .filter(row => row.jsRuntime && row.fullStringParity && (row.fixture?.sizeGiB ?? 0) >= 0.999 && row.sourceMode)
    .every(row => row.fullArrayBufferParserInput === false));
  assert.ok(report.comparisonRows
    .filter(row => row.corpusSeedReplay)
    .every(row => row.fullArrayBufferParserInput === false && row.corpusSeedBytes > 0));

  assert.ok(report.comparisonRows.some(row =>
    row.group === 'name-collision-safe-interning'
    && row.sourceArtifact === 'name-collision-safe-interning-perf.json'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 96.99
    && row.eventCount === 45189256
    && row.checksum === 1421012805
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'generated-1gib-candidate'
    && row.sourceArtifact === 'candidate-headroom-large.json'
    && row.runtimeId === 'node-v8'
    && row.caseId === 'rawFrameDirect'
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.sourceArtifact === 'external-baseline.json'
    && row.runtimeId === 'woodstox-jvm'
    && row.fullStringParity === true
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.sourceArtifact === 'external-baseline-1024mib-file-sync-batches.json'
    && row.caseId === 'stax-stream'
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.sourceMode === 'file-backed-sync-iterable-byte-batches'
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'file-backed-short-attr-value-cache-candidate'
    && row.sourceArtifact === 'file-backed-short-attr-value-cache-candidate.json'
    && row.caseId === 'stax-raw-frame-short-attr-value-cache'
    && row.mibPerSec === 140.15
    && row.eventCount === 61236571
    && row.checksum === -716099804
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 67.01
    && row.sourceMode === 'file-backed-sync-iterable-byte-batches'
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'file-backed-trim-boundary-check-candidate'
    && row.sourceArtifact === 'file-backed-trim-boundary-check-candidate.json'
    && row.caseId === 'stax-raw-frame-name-id-trim-boundary-check'
    && row.mibPerSec === 130.27
    && row.eventCount === 61236571
    && row.checksum === -716099804
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 67.22
    && row.sourceMode === 'file-backed-sync-iterable-byte-batches'
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'file-backed-long-ascii-text-candidate'
    && row.sourceArtifact === 'file-backed-long-ascii-text-candidate.json'
    && row.caseId === 'stax-raw-frame-name-id-long-ascii-text'
    && row.mibPerSec === 77.52
    && row.eventCount === 61236571
    && row.checksum === -716099804
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 99.57
    && row.sourceMode === 'file-backed-sync-iterable-byte-batches'
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'access-shape-rerun-cross-process-books-corpus'
    && row.sourceArtifact === 'access-shape-rerun-cross-process-books-corpus.json'
    && row.runtimeId === 'bun-jsc'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 93.33
    && row.sampleMinMiBPerSec === 92.52
    && row.sampleMaxMiBPerSec === 94.04
    && row.eventCount === 57096514
    && row.checksum === -540013997
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.sampleCount === 3
    && row.memory.primaryKind === 'process-rss'
    && row.sourceMode === 'sync-iterable-byte-batches'
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'books-corpus-stability'
    && row.sourceArtifact === 'bun-candidate-headroom-books-corpus-stability.json'
    && row.runtimeId === 'bun-jsc'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 178.52
    && row.sampleCount === 3
    && row.sampleMinMiBPerSec === 177.26
    && row.sampleMaxMiBPerSec === 180.1
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.sourceMode === 'sync-iterable-byte-batches'
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'books-corpus-stability'
    && row.sourceArtifact === 'candidate-headroom-books-corpus-stability.json'
    && row.runtimeId === 'node-v8'
    && row.caseId === 'rawFrameStringCache'
    && row.mibPerSec === 129.28
    && row.fullStringParity === true
    && row.boundedMemory === true
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'text-cache-negative-stability'
    && row.sourceArtifact === 'text-cache-materialization-candidate-stability.json'
    && row.caseId === 'rawFrameNameIdTextCache'
    && row.mibPerSec === 129.31
    && row.fullStringParity === true
    && row.boundedMemory === true
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'offset-text-cache-negative'
    && row.sourceArtifact === 'offset-text-cache-materialization-candidate.json'
    && row.caseId === 'rawFrameNameIdOffsetTextCache'
    && row.mibPerSec === 105.41
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'medium-ascii-text-negative'
    && row.sourceArtifact === 'medium-ascii-text-materialization-candidate.json'
    && row.caseId === 'rawFrameNameIdMediumAsciiText'
    && row.mibPerSec === 170.16
    && row.fullStringParity === true
    && row.boundedMemory === true
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'unrolled-medium-ascii-text-negative'
    && row.sourceArtifact === 'unrolled-medium-ascii-text-materialization-candidate.json'
    && row.caseId === 'rawFrameNameIdUnrolledMediumAsciiText'
    && row.mibPerSec === 170.59
    && row.fullStringParity === true
    && row.boundedMemory === true
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'unrolled-medium-ascii-text-trim-guard-negative'
    && row.sourceArtifact === 'unrolled-medium-ascii-text-trim-guard-candidate.json'
    && row.caseId === 'rawFrameNameIdUnrolledMediumAsciiTextTrimGuard'
    && row.mibPerSec === 164.14
    && row.fullStringParity === true
    && row.boundedMemory === true
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'attr-value-cache-negative'
    && row.sourceArtifact === 'attr-value-cache-materialization-candidate.json'
    && row.caseId === 'rawFrameNameIdAttrValueCache'
    && row.mibPerSec === 158.96
    && row.fullStringParity === true
    && row.boundedMemory === true
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'bun-cache-candidates-books-corpus'
    && row.sourceArtifact === 'bun-cache-candidates-books-corpus.json'
    && row.runtimeId === 'bun-jsc'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 169.07
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.sourceMode === 'sync-iterable-byte-batches'
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'long-ascii-text-negative-stability'
    && row.sourceArtifact === 'long-ascii-text-materialization-candidate-stability.json'
    && row.caseId === 'rawFrameNameIdLongAsciiText'
    && row.mibPerSec === 71.21
    && row.fullStringParity === true
    && row.boundedMemory === true
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'fold-trimmed-text-negative-stability'
    && row.sourceArtifact === 'fold-trimmed-text-candidate-stability.json'
    && row.caseId === 'rawFrameNameIdFoldTrim'
    && row.mibPerSec === 103.26
    && row.fullStringParity === true
    && row.boundedMemory === true
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'text-trim-cost-decomposition'
    && row.sourceArtifact === 'text-trim-cost-decomposition.json'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 185.5
    && row.sampleMinMiBPerSec === 184.09
    && row.sampleMaxMiBPerSec === 186.66
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 60.45
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'text-trim-cost-decomposition-2gib'
    && row.sourceArtifact === 'text-trim-cost-decomposition-2gib.json'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 184.92
    && row.sampleMinMiBPerSec === 183.28
    && row.sampleMaxMiBPerSec === 186.06
    && row.eventCount === 114192784
    && row.checksum === 1903859545
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 66.48
    && row.sourceMode === 'sync-iterable-byte-batches'
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'text-trim-cost-decomposition-4gib'
    && row.sourceArtifact === 'text-trim-cost-decomposition-4gib.json'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 178.86
    && row.sampleMinMiBPerSec === 169.74
    && row.sampleMaxMiBPerSec === 185.11
    && row.eventCount === 228385566
    && row.checksum === -1067702969
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 66.07
    && row.sourceMode === 'sync-iterable-byte-batches'
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'text-trim-cost-decomposition-8gib'
    && row.sourceArtifact === 'text-trim-cost-decomposition-8gib.json'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 184.03
    && row.sampleMinMiBPerSec === 182.97
    && row.sampleMaxMiBPerSec === 185.52
    && row.eventCount === 456770888
    && row.checksum === 734413569
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 76.94
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'text-checksum-consumer-decomposition'
    && row.sourceArtifact === 'text-checksum-consumer-decomposition.json'
    && row.caseId === 'rawFrameNameIdTextNoFold'
    && row.mibPerSec === 99.39
    && row.fullStringParity === false
    && row.boundedMemory === true
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'semantic-checksum-upper-bound'
    && row.sourceArtifact === 'semantic-checksum-upper-bound.json'
    && row.caseId === 'rawFrameSemanticChecksum'
    && row.mibPerSec === 94.11
    && row.eventCount === 57096514
    && row.checksum === -540013997
    && row.fullStringParity === false
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 72.68
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'access-shape-rerun-cross-process-books-corpus'
    && row.sourceArtifact === 'access-shape-rerun-cross-process-books-corpus.json'
    && row.runtimeId === 'node-v8'
    && row.caseId === 'cursorAccessor'
    && row.mibPerSec === 107.04
    && row.fullStringParity === true
    && row.boundedMemory === true
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'raw-frame-nameid-alone-cross-process-books-corpus'
    && row.sourceArtifact === 'raw-frame-nameid-alone-cross-process-books-corpus.json'
    && row.runtimeId === 'bun-jsc'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 118.58
    && row.sampleMinMiBPerSec === 117.42
    && row.sampleMaxMiBPerSec === 120.77
    && row.eventCount === 57096514
    && row.checksum === -540013997
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.sampleCount === 3
    && row.memory.primaryKind === 'process-rss'
    && row.sourceMode === 'sync-iterable-byte-batches'
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'cross-process-books-corpus'
    && row.sourceArtifact === 'candidate-headroom-cross-process-books-corpus.json'
    && row.runtimeId === 'bun-jsc'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 97.84
    && row.eventCount === 57096514
    && row.checksum === -540013997
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.sampleCount === 3
    && row.sampleMaxMiBPerSec === 99.46
    && row.memory.primaryKind === 'process-rss'
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'file-backed-batch-size-sweep'
    && row.sourceArtifact === 'file-backed-batch-size-sweep.json'
    && row.runtimeId === 'node-v8'
    && row.caseId === 'stax-raw-frame-name-id-batch-8'
    && row.mibPerSec === 152.11
    && row.eventCount === 61236571
    && row.checksum === -716099804
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 61.77
    && row.sourceMode === 'file-backed-sync-iterable-byte-batches'
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'file-backed-batch-size-sweep'
    && row.sourceArtifact === 'file-backed-batch-size-sweep.json'
    && row.runtimeId === 'node-v8'
    && row.caseId === 'stax-raw-frame-name-id-batch-64'
    && row.mibPerSec === 148.68
    && row.memory.maxMiB === 87.03
    && row.sourceMode === 'file-backed-sync-iterable-byte-batches'
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'file-backed-source-sweep'
    && row.sourceArtifact === 'file-backed-source-sweep.json'
    && row.runtimeId === 'node-v8'
    && row.caseId === 'stax-raw-frame-name-id-chunk-32kib'
    && row.mibPerSec === 151.7
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.sourceMode === 'file-backed-sync-iterable-byte-batches'
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'cross-process-books-corpus-batch16'
    && row.sourceArtifact === 'candidate-headroom-cross-process-books-corpus-batch16.json'
    && row.runtimeId === 'node-v8'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 99.83
    && row.fullStringParity === true
    && row.boundedMemory === true
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'cross-process-large-asset-corpus'
    && row.sourceArtifact === 'candidate-headroom-cross-process-large-asset-corpus.json'
    && row.runtimeId === 'node-v8'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 146.11
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.sourceMode === 'sync-iterable-byte-batches'
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'cross-process-midsize-corpus'
    && row.sourceArtifact === 'candidate-headroom-cross-process-midsize-corpus.json'
    && row.runtimeId === 'bun-jsc'
    && row.caseId === 'stringFull'
    && row.mibPerSec === 91.17
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.corpusSeedReplay === true
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.sourceArtifact === 'external-baseline-1024mib-file-sync-batches.json'
    && row.caseId === 'stax-raw-frame-name-id'
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.sourceArtifact === 'external-baseline-1024mib-file-sync-batches.json'
    && row.runtimeId === 'woodstox-jvm'
    && row.caseId === 'woodstox'
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.sourceArtifact === 'external-baseline-1024mib-file-sync-batches.json'
    && row.runtimeId === 'quick-xml-rust'
    && row.caseId === 'quick-xml'
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'external-baseline-treebank-wrapper-1024mib-file-sync-batches'
    && row.sourceArtifact === 'external-baseline-treebank-wrapper-1024mib-file-sync-batches.json'
    && row.runtimeId === 'node-v8-stax-raw-frame-name-id'
    && row.caseId === 'stax-raw-frame-name-id'
    && row.mibPerSec === 68.22
    && row.eventCount === 75206128
    && row.checksum === -1234990902
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 74.76
    && row.sourceMode === 'file-backed-sync-iterable-byte-batches'
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'external-baseline-treebank-wrapper-1024mib-file-sync-batches'
    && row.sourceArtifact === 'external-baseline-treebank-wrapper-1024mib-file-sync-batches.json'
    && row.runtimeId === 'woodstox-jvm'
    && row.caseId === 'woodstox'
    && row.mibPerSec === 166.05
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 309.14
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'external-baseline-treebank-wrapper-1024mib-file-sync-batches'
    && row.sourceArtifact === 'external-baseline-treebank-wrapper-1024mib-file-sync-batches.json'
    && row.runtimeId === 'quick-xml-rust'
    && row.caseId === 'quick-xml'
    && row.mibPerSec === 175.82
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.memory.primaryKind === 'process-rss'
    && row.memory.maxMiB === 4.76
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.sourceArtifact === 'browser-candidate-headroom-large.json'
    && row.caseId === 'eventObjectFull'
    && row.memory.primaryKind === 'browser-js-heap'
    && row.memory.hostProcessTree
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'browser-fetch-readable-stream-books-corpus'
    && row.sourceArtifact === 'browser-fetch-readable-stream-books-corpus.json'
    && row.runtimeId === 'chrome-v8-browser'
    && row.caseId === 'fetchReadableStreamFull'
    && row.mibPerSec === 9.68
    && row.eventCount === 57096514
    && row.checksum === -540013997
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.sourceMode === 'fetch-readable-stream-pull'
    && row.demandDrivenSource === true
    && row.directReadableStream === true
    && row.respectsBackpressure === true
    && row.fullArrayBufferParserInput === false
    && row.memory.primaryKind === 'browser-js-heap'
    && row.memory.maxMiB === 34.05
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'browser-fetch-readable-stream-books-corpus'
    && row.sourceArtifact === 'browser-fetch-readable-stream-books-corpus.json'
    && row.runtimeId === 'chrome-v8-browser'
    && row.caseId === 'fetchAsyncByteBatchFull'
    && row.mibPerSec === 9.77
    && row.eventCount === 57096514
    && row.checksum === -540013997
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.sourceMode === 'fetch-async-iterable-byte-batches'
    && row.demandDrivenSource === true
    && row.directReadableStream === false
    && row.respectsBackpressure === true
    && row.fullArrayBufferParserInput === false
    && row.memory.primaryKind === 'browser-js-heap'
    && row.memory.maxMiB === 17.75
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.sourceArtifact === 'firefox-bidi-candidate-headroom.json'
    && row.runtimeId === 'firefox-spidermonkey-browser'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 35.02
    && row.memory.primaryKind === 'browser-js-heap-unavailable'
    && row.memory.hostProcessTreeProbe?.maxWorkingSetMiB > 700
    && row.boundedMemory === false
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.sourceArtifact === 'firefox-bidi-candidate-headroom-corpus.json'
    && row.runtimeId === 'firefox-spidermonkey-browser'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 48.15
    && row.eventCount === 75206126
    && row.checksum === -925527041
    && row.memory.primaryKind === 'browser-js-heap-unavailable'
    && row.memory.hostProcessTreeProbe?.maxWorkingSetMiB > 1000
    && row.boundedMemory === false
    && row.corpusSeedReplay === true
    && row.corpusSeedBytes === 89565617
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.group === 'projection-1gib-full'
    && row.sourceArtifact === 'firefox-bidi-candidate-headroom-projection.json'
    && row.runtimeId === 'firefox-spidermonkey-browser'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 64.24
    && row.eventCount === 60416563
    && row.checksum === 1441552024
    && row.memory.primaryKind === 'browser-js-heap-unavailable'
    && row.memory.hostProcessTreeProbe?.maxWorkingSetMiB > 700
    && row.boundedMemory === false
  ));
  assert.ok(report.comparisonRows.some(row =>
    row.sourceArtifact === 'bun-candidate-headroom-corpus.json'
    && row.caseId === 'eventObjectFull'
    && row.boundedMemory === false
  ));
  assert.ok(report.allocationEvidence.some(item =>
    item.sourceArtifact === 'quick-xml-allocation-count.json'
    && item.memory.primaryKind === 'total-allocator-traffic'
    && item.shapeSummary.totalOwnedCount === 0
    && item.dominantPhase.phase === 'attribute-collection'
  ));
  assert.ok(report.allocationEvidence.some(item =>
    item.sourceArtifact === 'quick-xml-allocation-count-stability.json'
    && item.evidenceKind === 'global-allocator-counters-stability'
    && item.memory.primaryKind === 'total-allocator-traffic'
    && item.shapeSummary.totalOwnedCount === 0
    && item.dominantPhase.phase === 'attribute-collection'
  ));
  assert.ok(report.allocationEvidence.some(item =>
    item.sourceArtifact === 'woodstox-jfr-allocation.json'
    && item.memory.primaryKind === 'jfr-sampled-allocation'
    && item.memory.stringBoundaryEventCount > 0
  ));
  assert.ok(report.allocationEvidence.some(item =>
    item.sourceArtifact === 'woodstox-measured-jfr-allocation-rerun.json'
    && item.memory.primaryKind === 'measured-window-jfr-sampled-allocation-rerun'
    && item.memory.stringBoundaryEventCount > 0
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Same-Contract Runtime Comparison/);
  assert.match(markdown, /does not assert identical object shape/);
  assert.match(markdown, /Fastest bounded 1 GiB\+ JS public event-object row/);
  assert.match(markdown, /Fastest bounded public event-object row vs 200 MiB\/s: 0\.71x, 58\.38 MiB\/s remaining/);
  assert.match(markdown, /Fastest bounded public event-object row vs 1024 MiB Woodstox reference: 0\.42x Woodstox, 162\.55 MiB\/s below 0\.9x reference target/);
  assert.match(markdown, /## Public Event-Object Frontier/);
  assert.match(markdown, /public event-object API frontier separate from raw-frame, cursor-style, and direct ReadableStream rows/);
  assert.match(markdown, /consumes synchronous `Iterable<Uint8Array\[\]>` byte batches/);
  assert.match(markdown, /\| Fastest bounded public event-object row \| `eventObjectFull` \| 141\.62 \| `sync-iterable-byte-batches` \| no \| no \| yes \| `candidate-headroom-books-corpus-stability\.json` \| 58\.38 MiB\/s below 200 MiB\/s; 162\.55 MiB\/s below 0\.9x 1024 MiB Woodstox reference target \|/);
  assert.match(markdown, /not asserting identical object layout or allocation behavior/);
  assert.match(markdown, /Fastest JS full-string row vs 200 MiB\/s: 0\.93x, 14\.50 MiB\/s remaining/);
  assert.match(markdown, /Fastest JS full-string row vs 1024 MiB Woodstox reference: 0\.55x Woodstox, 118\.67 MiB\/s below 0\.9x reference target/);
  assert.match(markdown, /Same-fixture 1024 MiB JS row vs Woodstox target: stax-raw-frame-name-id-batch-8 at 0\.43x Woodstox, 164\.29 MiB\/s below 0\.9x target/);
  assert.match(markdown, /Same-fixture 1024 MiB JS row vs quick-xml target: stax-raw-frame-name-id-batch-8 at 0\.55x quick-xml, 95\.06 MiB\/s below 0\.9x target/);
  assert.match(markdown, /Same-fixture 1024 MiB process RSS snapshot: JS 61\.77 MiB, Woodstox 312\.71 MiB, quick-xml 4\.78 MiB/);
  assert.match(markdown, /1 GiB\+ JS full-string memory frontier: 213\/230 bounded rows; fastest bounded row Node\/V8 rawFrameNameId at 185\.50 MiB\/s \(process RSS max 60\.45 MiB\)/);
  assert.match(markdown, /Text materialization frontier: fastest full row rawFrameNameId at 185\.50 MiB\/s, 14\.50 MiB\/s below 200 MiB\/s; without-text rows crossing target: 4; negative candidates: 21/);
  assert.match(markdown, /Source consumption frontier: sync byte batches sync-iterable-byte-batches-batch-8 at 71\.96 MiB\/s; direct ReadableStream web-readable-stream-raw-frame-ascii-batch-8 at 76\.53 MiB\/s \(1\.06x sync\); backpressure rows 6\/6/);
  assert.match(markdown, /1024 MiB Books Fixture Woodstox 0\.9x Target Distances/);
  assert.match(markdown, /\| `file-backed-batch-size-sweep` \| `stax-raw-frame-name-id-batch-8` \| 152\.11 \| process RSS max 61\.77 MiB \| `file-backed-sync-iterable-byte-batches` \| 351\.56 \| 316\.40 \| 164\.29 \| 0\.43 \| no \| `file-backed-trim-boundary-check-candidate\.json` \| same books 1024 MiB fixture family/);
  assert.match(markdown, /\| `external-baseline-1024mib-file-sync-batches` \| `stax-raw-frame-name-id` \| 132\.54 \| process RSS max 67\.59 MiB \| `file-backed-sync-iterable-byte-batches` \| 337\.97 \| 304\.17 \| 171\.63 \| 0\.39 \| no \| `external-baseline-1024mib-file-sync-batches\.json` \| same artifact Woodstox reference \|/);
  assert.match(markdown, /1024 MiB Books Fixture quick-xml 0\.9x Target Distances/);
  assert.match(markdown, /\| `file-backed-batch-size-sweep` \| `stax-raw-frame-name-id-batch-8` \| 152\.11 \| process RSS max 61\.77 MiB \| `file-backed-sync-iterable-byte-batches` \| 274\.63 \| 247\.17 \| 95\.06 \| 0\.55 \| no \| `file-backed-short-attr-value-cache-candidate\.json` \| same books 1024 MiB fixture family/);
  assert.match(markdown, /\| `external-baseline-1024mib-file-sync-batches` \| `stax-raw-frame-name-id` \| 132\.54 \| process RSS max 67\.59 MiB \| `file-backed-sync-iterable-byte-batches` \| 270\.26 \| 243\.23 \| 110\.69 \| 0\.49 \| no \| `external-baseline-1024mib-file-sync-batches\.json` \| same artifact quick-xml reference \|/);
  assert.match(markdown, /Recognized JS source modes: fetch-async-iterable-byte-batches, fetch-readable-stream-pull, file-backed-sync-iterable-byte-batches, sync-iterable-byte-batches/);
  assert.match(markdown, /1 GiB\+ JS full-string source-mode rows not using full ArrayBuffer parser input: 224\/224/);
  assert.match(markdown, /1 GiB\+ source-mode rows replaying a corpus seed buffer: 141 \(max seed 100\.26 MiB, max seed\/target 0\.09\)/);
  assert.match(markdown, /\| 1 GiB\+ JS full-string rows with source mode metadata \| 224 \| 224 \| 0 \| 0 \| 36 \| 1 \| 141 \| 100\.26 MiB \|/);
  assert.match(markdown, /\| `file-backed-sync-iterable-byte-batches` \| 36 \| 36 \| 0 \| 0 \| 0 \| 0 \| Node\/V8 `stax-raw-frame-name-id-batch-8` 152\.11 MiB\/s from `file-backed-batch-size-sweep\.json` \|/);
  assert.match(markdown, /\| `sync-iterable-byte-batches` \| 186 \| 186 \| 0 \| 0 \| 0 \| 139 \| Node\/V8 `rawFrameNameId` 185\.50 MiB\/s from `text-trim-cost-decomposition\.json` \|/);
  assert.match(markdown, /\| `fetch-readable-stream-pull` \| 1 \| 1 \| 0 \| 0 \| 1 \| 1 \| Chrome\/V8 browser `fetchReadableStreamFull` 9\.68 MiB\/s from `browser-fetch-readable-stream-books-corpus\.json` \|/);
  assert.match(markdown, /## Text Materialization Frontier/);
  assert.match(markdown, /\| Fastest full row \| `rawFrameNameId` \| 185\.50 \| yes \| yes \| `text-trim-cost-decomposition\.json` \| 14\.50 MiB\/s below 200 MiB\/s; 1\.08x speedup required \|/);
  assert.match(markdown, /\| Fastest without text\/CDATA strings \| `withoutTextStrings` \| 252\.36 \| no \| yes \| `text-trim-cost-decomposition-4gib\.json` \| 1\.36x fastest full row; 4 row\(s\) cross 200 MiB\/s \|/);
  assert.match(markdown, /Interpretation: Text\/CDATA omission crosses the target as headroom evidence, while trim-only, fold-trim, cache, and ASCII candidates remain negative for the current full-string contract\./);
  assert.match(markdown, /## Source Consumption Frontier/);
  assert.match(markdown, /This separates the current large-file Iterable<Uint8Array\[\]> baseline from direct ReadableStream consumption/);
  assert.match(markdown, /\| Fastest sync byte batches \| `sync-iterable-byte-batches-batch-8` \| synchronous Iterable<Uint8Array\[\]> \| 71\.96 \| 74\.51 MiB \| 8 \| no \| no \| n\/a \| reads=16385, batches=2048, pulls=0, enqueues=0 \|/);
  assert.match(markdown, /\| Fastest direct ReadableStream \| `web-readable-stream-raw-frame-ascii-batch-8` \| Web ReadableStream<Uint8Array> \| 76\.53 \| 110\.88 MiB \| 8 \| yes \| no \| yes \| reads=16385, batches=0, pulls=16385, enqueues=16384 \|/);
  assert.match(markdown, /Backpressure-respecting async\/readable rows: 6\/6/);
  assert.match(markdown, /Full ArrayBuffer parser-input rows in source-consumption artifact: 0/);
  assert.match(markdown, /Browser live fetch source frontier: fetch ReadableStream fetchReadableStreamFull at 9\.68 MiB\/s; fetch async byte batches fetchAsyncByteBatchFull at 9\.77 MiB\/s; live backpressure rows 2\/2/);
  assert.match(markdown, /## Browser Live Fetch Source Frontier/);
  assert.match(markdown, /This keeps Chrome fetch Response\.body rows separate from prepared corpus-seed replay rows/);
  assert.match(markdown, /\| Fetch ReadableStream \| `fetchReadableStreamFull` \| `fetch-readable-stream-pull` \| 9\.68 \| 34\.05 MiB \| yes \| no \| yes \| 57096514 \| -540013997 \|/);
  assert.match(markdown, /\| Fetch async byte batches \| `fetchAsyncByteBatchFull` \| `fetch-async-iterable-byte-batches` \| 9\.77 \| 17\.75 MiB \| no \| no \| yes \| 57096514 \| -540013997 \|/);
  assert.match(markdown, /Live fetch rows respecting backpressure: 2\/2/);
  assert.match(markdown, /Live fetch rows with full ArrayBuffer parser input: 0/);
  assert.match(markdown, /## Memory Frontier/);
  assert.match(markdown, /This classifies memory only within the same 1 GiB\+ JavaScript full-string row set used by the counterexample scan/);
  assert.match(markdown, /Rows classified: 230/);
  assert.match(markdown, /Bounded rows: 213/);
  assert.match(markdown, /Unbounded or unproven rows: 17/);
  assert.match(markdown, /Fastest bounded process RSS row under 128 MiB: Node\/V8 rawFrameNameId at 185\.50 MiB\/s \(process RSS max 60\.45 MiB\)/);
  assert.match(markdown, /Fastest bounded browser JS heap row: Chrome\/V8 browser rawFrameNameId at 69\.90 MiB\/s \(JS heap max 39\.55 MiB; host working set 500\.10 MiB\)/);
  assert.match(markdown, /\| browser-js-heap \| 20 \| 20 \| 0 \| 358\.37 MiB \| Chrome\/V8 browser rawFrameNameId at 69\.90 MiB\/s/);
  assert.match(markdown, /\| browser-js-heap-unavailable \| 9 \| 0 \| 9 \| n\/a MiB \| Firefox\/SpiderMonkey browser rawFrameNameId at 64\.24 MiB\/s/);
  assert.match(markdown, /\| process-rss \| 201 \| 193 \| 8 \| 1956\.69 MiB \| Node\/V8 rawFrameNameId at 185\.50 MiB\/s/);
  assert.match(markdown, /large-js-full-memory-frontier-visible \(CLASSIFIED\)/);
  assert.match(markdown, /different corpus fixtures/);
  assert.match(markdown, /access-shape-rerun-cross-process-books-corpus/);
  assert.match(markdown, /raw-frame-nameid-alone-cross-process-books-corpus/);
  assert.match(markdown, /books-corpus-stability/);
  assert.match(markdown, /text-cache-negative-stability/);
  assert.match(markdown, /offset-text-cache-negative/);
  assert.match(markdown, /medium-ascii-text-negative/);
  assert.match(markdown, /bun-cache-candidates-books-corpus/);
  assert.match(markdown, /long-ascii-text-negative-stability/);
  assert.match(markdown, /fold-trimmed-text-negative-stability/);
  assert.match(markdown, /text-trim-cost-decomposition/);
  assert.match(markdown, /text-checksum-consumer-decomposition/);
  assert.match(markdown, /semantic-checksum-upper-bound/);
  assert.match(markdown, /file-backed-batch-size-sweep/);
  assert.match(markdown, /file-backed-source-sweep/);
  assert.match(markdown, /file-backed-short-attr-value-cache-candidate/);
  assert.match(markdown, /file-backed-trim-boundary-check-candidate/);
  assert.match(markdown, /`sync-iterable-byte-batches`/);
  assert.match(markdown, /cross-process-books-corpus/);
  assert.match(markdown, /external-baseline-treebank-wrapper-1024mib-file-sync-batches/);
  assert.match(markdown, /1024 MiB file-backed stax-stream baseline/);
  assert.match(markdown, /1024 MiB file-backed rawFrameNameId baseline/);
  assert.match(markdown, /200 MiB\/s\+ bounded-memory JavaScript counterexamples found: 0/);
  assert.match(markdown, /Woodstox JFR rows are sampled allocation evidence/);
  assert.match(markdown, /dominantPhase=attribute-collection/);
  assert.match(markdown, /text-materialization-frontier-visible \(HEADROOM_CLASSIFIED\)/);
  assert.match(markdown, /source-consumption-frontier-visible \(CLASSIFIED\)/);
  assert.match(markdown, /browser-live-fetch-source-visible \(CLASSIFIED\)/);
  assert.match(markdown, /fresh-browser per-variant Windows host process-tree probes/);
  assert.match(markdown, /not proof that JavaScript runtimes have no remaining headroom/);
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
