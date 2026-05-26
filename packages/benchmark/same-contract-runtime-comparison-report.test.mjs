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
  assert.equal(report.summary.rowCount, 138);
  assert.equal(report.summary.jsLargeFullRowCount, 121);
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
  assert.equal(report.summary.fastestJsLargeFullRowTo1024MiBWoodstoxReference.ratio, 0.97);
  assert.equal(report.summary.fastestJsLargeFullRowTo1024MiBWoodstoxReference.remainingTo90PercentMiBPerSec, -13.85);
  assert.match(report.summary.fastestJsLargeFullRowTo1024MiBWoodstoxReference.caveat, /different corpus fixture/);
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRow.caseId, 'eventObjectFull');
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRow.boundedMemory, true);
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRow.sourceArtifact, 'candidate-headroom-books-corpus-stability.json');
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRow.mibPerSec, 141.62);
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRow.sampleCount, 3);
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRow.sourceMode, 'sync-iterable-byte-batches');
  assert.ok(report.summary.fastestBoundedJsLargePublicEventRow.mibPerSec < 200);
  assert.equal(report.summary.externalBaseline16MiB.woodstoxMiBPerSec, 303.1);
  assert.equal(report.summary.externalBaseline16MiB.quickXmlMiBPerSec, 243.43);
  assert.equal(report.summary.externalBaseline16MiB.quickXmlWoodstoxRatio, 0.8);
  assert.equal(report.summary.externalBaseline1024MiBFileSyncBatches.staxStreamMiBPerSec, 72.72);
  assert.ok(report.summary.externalBaseline1024MiBFileSyncBatches.staxStreamWoodstoxRatio > 0.3);
  assert.ok(report.summary.externalBaseline1024MiBFileSyncBatches.staxStreamWoodstoxRatio < 0.4);
  assert.equal(report.summary.externalBaseline1024MiBFileSyncBatches.rawFrameNameIdMiBPerSec, 76.13);
  assert.ok(report.summary.externalBaseline1024MiBFileSyncBatches.rawFrameNameIdWoodstoxRatio >= 0.4);
  assert.ok(report.summary.externalBaseline1024MiBFileSyncBatches.rawFrameNameIdWoodstoxRatio < 0.5);
  assert.equal(report.summary.externalBaseline1024MiBFileSyncBatches.woodstoxMiBPerSec, 190.72);
  assert.equal(report.summary.externalBaseline1024MiBFileSyncBatches.quickXmlMiBPerSec, 150.24);
  assert.equal(report.summary.externalBaseline1024MiBFileSyncBatches.quickXmlWoodstoxRatio, 0.79);
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
  assert.equal(report.summary.sameFixture1024MiBProcessRssSnapshot.fastestJs.maxRssMiB, 61.77);
  assert.equal(report.summary.sameFixture1024MiBProcessRssSnapshot.fastestJs.sourceArtifact, 'file-backed-batch-size-sweep.json');
  assert.equal(report.summary.sameFixture1024MiBProcessRssSnapshot.woodstox.maxRssMiB, 312.71);
  assert.equal(report.summary.sameFixture1024MiBProcessRssSnapshot.woodstox.sourceArtifact, 'file-backed-trim-boundary-check-candidate.json');
  assert.equal(report.summary.sameFixture1024MiBProcessRssSnapshot.quickXml.maxRssMiB, 4.78);
  assert.equal(report.summary.sameFixture1024MiBProcessRssSnapshot.quickXml.sourceArtifact, 'file-backed-short-attr-value-cache-candidate.json');
  assert.match(report.summary.sameFixture1024MiBProcessRssSnapshot.caveat, /not allocation-model equivalence/);
  assert.equal(report.summary.fastestJsLargeFullRowTo1024MiBWoodstoxReference.comparableFixture, false);
  assert.deepEqual(report.summary.memoryMetricKinds, ['browser-js-heap', 'browser-js-heap-unavailable', 'process-rss']);
  assert.deepEqual(report.summary.sourceModes, ['file-backed-sync-iterable-byte-batches', 'sync-iterable-byte-batches']);
  assert.deepEqual(report.summary.sourceShapeSafety, {
    largeJsFullSourceModeRows: 115,
    notFullArrayBufferRows: 115,
    fullArrayBufferRows: 0,
    unknownArrayBufferRows: 0,
    corpusSeedReplayRows: 57,
    maxCorpusSeedMiB: 100.26,
    maxCorpusSeedToTargetRatio: 0.09,
  });
  assert.ok(report.comparisonRows
    .filter(row => row.jsRuntime && row.fullStringParity && (row.fixture?.sizeGiB ?? 0) >= 0.999 && row.sourceMode)
    .every(row => row.fullArrayBufferParserInput === false));
  assert.ok(report.comparisonRows
    .filter(row => row.corpusSeedReplay)
    .every(row => row.fullArrayBufferParserInput === false && row.corpusSeedBytes > 0));

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
    row.group === 'access-shape-cross-process-books-corpus'
    && row.sourceArtifact === 'access-shape-candidate-cross-process.json'
    && row.runtimeId === 'bun-jsc'
    && row.caseId === 'rawFrameNameId'
    && row.mibPerSec === 177.34
    && row.sampleMinMiBPerSec === 173.98
    && row.sampleMaxMiBPerSec === 179.7
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
    row.group === 'access-shape-cross-process-books-corpus'
    && row.sourceArtifact === 'access-shape-candidate-cross-process.json'
    && row.runtimeId === 'node-v8'
    && row.caseId === 'cursorAccessor'
    && row.mibPerSec === 161.48
    && row.fullStringParity === true
    && row.boundedMemory === true
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
    row.sourceArtifact === 'browser-candidate-headroom-large.json'
    && row.caseId === 'eventObjectFull'
    && row.memory.primaryKind === 'browser-js-heap'
    && row.memory.hostProcessTree
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
  assert.match(markdown, /Fastest JS full-string row vs 200 MiB\/s: 0\.93x, 14\.50 MiB\/s remaining/);
  assert.match(markdown, /Fastest JS full-string row vs 1024 MiB Woodstox reference: 0\.97x Woodstox, -13\.85 MiB\/s below 0\.9x reference target/);
  assert.match(markdown, /Same-fixture 1024 MiB JS row vs Woodstox target: stax-raw-frame-name-id-batch-8 at 0\.43x Woodstox, 164\.29 MiB\/s below 0\.9x target/);
  assert.match(markdown, /Same-fixture 1024 MiB process RSS snapshot: JS 61\.77 MiB, Woodstox 312\.71 MiB, quick-xml 4\.78 MiB/);
  assert.match(markdown, /Recognized JS source modes: file-backed-sync-iterable-byte-batches, sync-iterable-byte-batches/);
  assert.match(markdown, /1 GiB\+ JS full-string source-mode rows not using full ArrayBuffer parser input: 115\/115/);
  assert.match(markdown, /1 GiB\+ source-mode rows replaying a corpus seed buffer: 57 \(max seed 100\.26 MiB, max seed\/target 0\.09\)/);
  assert.match(markdown, /\| 1 GiB\+ JS full-string rows with source mode metadata \| 115 \| 115 \| 0 \| 0 \| 57 \| 100\.26 MiB \|/);
  assert.match(markdown, /different corpus fixtures/);
  assert.match(markdown, /access-shape-cross-process-books-corpus/);
  assert.match(markdown, /books-corpus-stability/);
  assert.match(markdown, /text-cache-negative-stability/);
  assert.match(markdown, /long-ascii-text-negative-stability/);
  assert.match(markdown, /fold-trimmed-text-negative-stability/);
  assert.match(markdown, /text-trim-cost-decomposition/);
  assert.match(markdown, /file-backed-batch-size-sweep/);
  assert.match(markdown, /file-backed-source-sweep/);
  assert.match(markdown, /file-backed-short-attr-value-cache-candidate/);
  assert.match(markdown, /file-backed-trim-boundary-check-candidate/);
  assert.match(markdown, /`sync-iterable-byte-batches`/);
  assert.match(markdown, /cross-process-books-corpus/);
  assert.match(markdown, /1024 MiB file-backed stax-stream baseline/);
  assert.match(markdown, /1024 MiB file-backed rawFrameNameId baseline/);
  assert.match(markdown, /200 MiB\/s\+ bounded-memory JavaScript counterexamples found: 0/);
  assert.match(markdown, /Woodstox JFR rows are sampled allocation evidence/);
  assert.match(markdown, /dominantPhase=attribute-collection/);
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
