import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'runtime-counterexample-scan-report-test');
const jsonOut = join(tmpDir, 'runtime-counterexample-scan.json');
const mdOut = join(tmpDir, 'runtime-counterexample-scan.md');

test('runtime counterexample scan applies the broad 200 MiB/s rule mechanically', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-counterexample-scan.mjs'),
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
  assert.equal(report.objective, 'runtime-counterexample-scan');
  assert.equal(report.contract, 'release-json-recognized-row-counterexample-search');
  assert.equal(report.summary.counterexampleCount, 0);
  assert.equal(report.summary.conclusionAllowed, false);
  assert.equal(report.summary.parseErrorCount, 0);
  assert.equal(report.summary.scannedArtifactCount, 144);
  assert.ok(report.scannedArtifacts.includes('concat-buffer-reuse-negative-result.json'));
  assert.ok(report.scannedArtifacts.includes('file-backed-materialization-profile.json'));
  assert.ok(report.scannedArtifacts.includes('file-backed-long-ascii-text-candidate.json'));
  assert.equal(report.summary.measuredRowCount, 780);
  assert.equal(report.summary.aggregateRowCount, 89);
  assert.equal(report.summary.largeJsFullRowCount, 482);
  assert.equal(report.summary.largeJsFullAggregateRowCount, 69);
  assert.equal(report.summary.sourceModeRowCount, 203);
  assert.equal(report.summary.largeJsFullSourceModeRowCount, 152);
  assert.equal(report.summary.partialHeadroomRowCount, 23);
  assert.equal(report.summary.textMaterializationHeadroomRowCount, 3);
  assert.equal(report.summary.rowClassificationCompleteness.unknownFullStringParityRows, 0);
  assert.equal(report.summary.rowClassificationCompleteness.unknownBoundedMemoryRows, 20);
  assert.equal(report.summary.unboundedOrUnknownLargeFullRowCount, 91);
  assert.deepEqual(report.summary.largeFullMemoryRejectionBreakdown, {
    total: 91,
    explicitNotBounded: 91,
    boundedFlagWithoutRowMemoryProof: 0,
    unknownBoundedFlag: 0,
    missingRowMemoryProof: 48,
  });
  assert.deepEqual(report.summary.unknownBoundedMemoryBreakdown, {
    total: 20,
    jsRows: 4,
    fullStringRows: 20,
    jsFullStringRows: 4,
    largeJsFullStringRows: 0,
    rowsWithMemoryCounter: 10,
  });
  assert.equal(report.summary.fastestLargeFullRowWithMemoryProof.hasMemoryProof, true);
  assert.equal(report.summary.fastestLargeFullRowWithMemoryProof.boundedMemory, true);
  assert.equal(report.summary.fastestLargeFullRowWithMemoryProof.sourceArtifact, 'access-shape-candidate-cross-process.json');
  assert.equal(report.summary.fastestLargeFullRowWithMemoryProof.id, 'rawFrameNameId');
  assert.equal(report.summary.fastestLargeFullRowWithMemoryProof.mibPerSec, 179.7);
  assert.ok(report.summary.fastestLargeFullRowWithMemoryProof.mibPerSec < 200);
  assert.equal(report.summary.fastestLargeFullAggregateRowWithMemoryProof.sourceArtifact, 'access-shape-candidate-cross-process.json');
  assert.equal(report.summary.fastestLargeFullAggregateRowWithMemoryProof.runtimeLabel, 'Bun/JSC');
  assert.equal(report.summary.fastestLargeFullAggregateRowWithMemoryProof.id, 'rawFrameNameId');
  assert.equal(report.summary.fastestLargeFullAggregateRowWithMemoryProof.mibPerSec, 177.34);
  assert.equal(report.summary.fastestLargeFullAggregateRowWithMemoryProof.sampleCount, 3);
  assert.equal(report.summary.fastestLargeFullAggregateRowWithMemoryProof.spreadPercent, 3.23);
  assert.equal(report.summary.fastestPartialHeadroomRow.fullStringParity, false);
  assert.equal(report.summary.fastestPartialHeadroomRow.sourceArtifact, 'candidate-headroom-cross-process-books-corpus-partial.json');
  assert.equal(report.summary.fastestPartialHeadroomRow.id, 'scanAllNoDecode');
  assert.equal(report.summary.fastestPartialHeadroomRow.mibPerSec, 326.65);
  assert.ok(report.summary.fastestPartialHeadroomRow.mibPerSec >= 200);
  assert.equal(report.summary.fastestTextMaterializationHeadroomRow.sourceArtifact, 'long-text-cache-materialization-candidate.json');
  assert.equal(report.summary.fastestTextMaterializationHeadroomRow.id, 'withoutTextStrings');
  assert.equal(report.summary.fastestTextMaterializationHeadroomRow.mibPerSec, 229.15);
  assert.equal(report.summary.fastestTextMaterializationHeadroomRow.fullStringParity, false);
  assert.ok(report.ignoredArtifacts.includes('runtime-limit-proof-obligation-gate.json'));
  assert.ok(report.ignoredArtifacts.includes('same-contract-runtime-comparison.json'));
  assert.ok(report.scannedArtifacts.includes('event-reader-byte-batch.json'));
  assert.ok(report.scannedArtifacts.includes('attribute-value-branch-order-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('attribute-value-index-accessor-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('attribute-value-public-fast-path-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('medium-ascii-decode-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('bun-event-reader-byte-batch.json'));
  assert.ok(report.scannedArtifacts.includes('deno-event-reader-byte-batch.json'));
  assert.ok(report.scannedArtifacts.includes('deno-textdecoder-source-pin-audit.json'));
  assert.ok(report.scannedArtifacts.includes('deno-v8-codegen-trace.json'));
  assert.ok(report.scannedArtifacts.includes('deno-v8-allocation-sampling.json'));
  assert.ok(report.scannedArtifacts.includes('firefox-spidermonkey-profiler-trace.json'));
  assert.ok(report.scannedArtifacts.includes('firefox-spidermonkey-jitspew-source-pin-audit.json'));
  assert.ok(report.scannedArtifacts.includes('firefox-spidermonkey-diagnostic-dump-audit.json'));
  assert.ok(report.scannedArtifacts.includes('firefox-spidermonkey-js-shell-availability-audit.json'));
  assert.ok(report.scannedArtifacts.includes('runtime-proof-gap-handoff.json'));
  assert.ok(report.scannedArtifacts.includes('candidate-headroom-cross-process-books-corpus-batch16.json'));
  assert.ok(report.scannedArtifacts.includes('candidate-headroom-cross-process-books-corpus-partial.json'));
  assert.ok(report.scannedArtifacts.includes('multi-chunk-batch-shape-audit.json'));
  assert.ok(report.scannedArtifacts.includes('raw-batch-kind-shape-audit.json'));
  assert.ok(report.scannedArtifacts.includes('materialization-category-drop-sweep.json'));
  assert.ok(report.scannedArtifacts.includes('fold-trimmed-text-candidate-stability.json'));
  assert.ok(report.scannedArtifacts.includes('long-ascii-text-materialization-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('long-ascii-text-materialization-candidate-stability.json'));
  assert.ok(report.scannedArtifacts.includes('text-cache-materialization-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('text-cache-materialization-candidate-stability.json'));
  assert.ok(report.scannedArtifacts.includes('long-text-cache-materialization-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('text-cdata-cost-decomposition.json'));
  assert.ok(report.scannedArtifacts.includes('stax-event-public-object-shape-audit.json'));
  assert.ok(report.scannedArtifacts.includes('external-baseline-1024mib-file-sync-batches.json'));
  assert.ok(report.scannedArtifacts.includes('file-backed-fold-trim-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('file-backed-string-cache-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('file-backed-source-sweep.json'));
  assert.ok(report.scannedArtifacts.includes('file-backed-core-decomposition.json'));
  assert.ok(report.scannedArtifacts.includes('file-backed-batch-size-sweep.json'));
  assert.ok(report.scannedArtifacts.includes('file-backed-materialization-category-drop-sweep.json'));
  assert.ok(report.scannedArtifacts.includes('file-backed-public-consumer-shape-sweep.json'));
  assert.ok(report.scannedArtifacts.includes('file-backed-v8-codegen-trace.json'));
  assert.ok(report.scannedArtifacts.includes('stream-reader-4gb-shapes.json'));
  assert.ok(report.scannedArtifacts.includes('stream-source-consumption-shapes.json'));
  assert.ok(report.scannedArtifacts.includes('event-reader-byte-batch-corpus.json'));
  assert.ok(report.scannedArtifacts.includes('bun-event-reader-byte-batch-corpus.json'));
  assert.ok(report.scannedArtifacts.includes('deno-event-reader-byte-batch-corpus.json'));
  assert.ok(report.scannedArtifacts.includes('event-reader-byte-batch-cross-process-corpus.json'));
  assert.ok(report.scannedArtifacts.includes('browser-fetch-readable-stream-books-corpus.json'));
  assert.ok(report.scannedArtifacts.includes('access-shape-candidate-cross-process.json'));
  assert.ok(report.scannedArtifacts.includes('access-shape-candidate-stability.json'));
  assert.ok(report.scannedArtifacts.includes('firefox-fetch-readable-stream-timeout-audit.json'));
  assert.ok(report.scannedArtifacts.includes('deno-textdecoder-span-variants.json'));
  assert.ok(report.scannedArtifacts.includes('deno-textdecoder-span-variants-corpus.json'));
  assert.ok(report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'candidate-headroom-cross-process-books-corpus-partial.json'
    && row.runtimeLabel === 'Bun/JSC'
    && row.id === 'scanAllNoDecode'
    && row.mibPerSec === 326.65
    && row.fullStringParity === false
    && row.contractScope === 'event-types-and-attribute-counts-only'
  ));
  assert.ok(!report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'candidate-headroom-cross-process-books-corpus-partial.json'
    && row.id === 'attrNameStringOnly'
    && row.mibPerSec >= 200
  ));
  assert.ok(report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'bun-candidate-headroom-projection-large.json'
    && row.id === 'scanAllNoDecode'
    && row.fullStringParity === false
  ));
  assert.ok(report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'browser-candidate-headroom-books-corpus.json'
    && row.id === 'scanAllNoDecode'
    && row.mibPerSec === 206.76
    && row.fullStringParity === false
  ));
  assert.ok(!report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'materialization-category-drop-sweep.json'
    && row.id === 'withoutTextStrings'
  ));
  assert.ok(report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'file-backed-core-decomposition.json'
    && row.id === 'stax-scan-all-no-decode'
    && row.mibPerSec === 234.57
    && row.fullStringParity === false
    && row.contractScope === 'partial-scan-no-string-materialization'
  ));
  assert.ok(report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'file-backed-core-decomposition.json'
    && row.id === 'stax-raw-frame-span-stats'
    && row.mibPerSec === 240.08
    && row.fullStringParity === false
    && row.contractScope === 'partial-raw-frame-span-metadata-no-string-materialization'
  ));
  assert.ok(!report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'text-cache-materialization-candidate.json'
    && row.id === 'withoutTextStrings'
  ));
  assert.equal(report.textMaterializationHeadroomRows.length, 3);
  assert.ok(report.textMaterializationHeadroomRows.some(row =>
    row.sourceArtifact === 'long-text-cache-materialization-candidate.json'
    && row.id === 'withoutTextStrings'
    && row.mibPerSec === 229.15
    && row.fullStringParity === false
    && row.contractScope === 'full-materialization-minus-text-cdata'
    && row.checksum === 1372281363
  ));
  assert.ok(report.textMaterializationHeadroomRows.some(row =>
    row.sourceArtifact === 'text-cdata-cost-decomposition.json'
    && row.id === 'withoutTextStrings'
    && row.mibPerSec === 219.85
    && row.fullStringParity === false
    && row.contractScope === 'full-materialization-minus-text-cdata'
    && row.checksum === 1372281363
  ));
  assert.ok(report.textMaterializationHeadroomRows.some(row =>
    row.sourceArtifact === 'long-ascii-text-materialization-candidate-stability.json'
    && row.id === 'withoutTextStrings'
    && row.mibPerSec === 207.7
    && row.fullStringParity === false
    && row.contractScope === 'full-materialization-minus-text-cdata'
    && row.checksum === 1372281363
  ));
  assert.ok(!report.textMaterializationHeadroomRows.some(row =>
    row.sourceArtifact === 'materialization-category-drop-sweep.json'
    && row.id === 'withoutTextStrings'
  ));
  assert.ok(!report.textMaterializationHeadroomRows.some(row =>
    row.sourceArtifact === 'text-cache-materialization-candidate.json'
    && row.id === 'withoutTextStrings'
  ));
  assert.ok(report.fastestLargeFullRows.some(row =>
    row.sourceArtifact === 'access-shape-candidate-cross-process.json'
    && row.runtimeLabel === 'Bun/JSC'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 179.7
    && row.hasMemoryProof === true
    && row.fullStringParity === true
  ));
  assert.ok(report.fastestLargeFullAggregateRowsWithMemoryProof.some(row =>
    row.sourceArtifact === 'access-shape-candidate-cross-process.json'
    && row.runtimeLabel === 'Bun/JSC'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 177.34
    && row.minMibPerSec === 173.98
    && row.maxMibPerSec === 179.7
    && row.sampleCount === 3
    && row.fullStringParity === true
  ));
  assert.ok(report.sourceModeRows.some(row =>
    row.sourceArtifact === 'access-shape-candidate-cross-process.json'
    && row.id === 'rawFrameNameId'
    && row.runtimeLabel === 'Bun/JSC'
    && row.sourceMode === 'generated-sync-iterable-byte-batches'
    && row.mibPerSec === 179.7
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.demandDrivenSource === true
  ));
  assert.ok(report.sourceModeRows.some(row =>
    row.sourceArtifact === 'bun-event-reader-string-large.json'
    && row.runtimeLabel === 'Bun/JSC'
    && row.sourceMode === 'complete-js-string'
    && row.fullStringParity === true
    && row.boundedMemory === false
    && row.demandDrivenSource === false
  ));
  assert.ok(report.sourceModeRows.some(row =>
    row.sourceArtifact === 'stream-source-consumption-shapes.json'
    && row.id === 'sync-iterable-byte-batches'
    && row.runtimeLabel === 'Node/V8'
    && row.jsRuntime === true
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.mibPerSec === 139.27
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.demandDrivenSource === true
  ));
  assert.ok(report.sourceModeRows.some(row =>
    row.sourceArtifact === 'stream-source-consumption-shapes.json'
    && row.id === 'web-readable-stream-pull'
    && row.runtimeLabel === 'Node/V8'
    && row.jsRuntime === true
    && row.sourceMode === 'web-readable-stream-pull'
    && row.demandDrivenSource === true
    && row.respectsBackpressure === true
    && row.mibPerSec === 143.29
    && row.fullStringParity === true
    && row.boundedMemory === true
  ));
  assert.ok(report.summary.largeJsFullSourceModeBreakdown.some(entry =>
    entry.sourceMode === 'complete-js-string'
    && entry.rowCount === 1
    && entry.boundedFullStringRowCount === 0
    && entry.demandDrivenRows === 0
    && entry.backpressureRows === 0
    && entry.fastestRow.sourceArtifact === 'bun-event-reader-string-large.json'
  ));
  assert.ok(report.summary.largeJsFullSourceModeBreakdown.some(entry =>
    entry.sourceMode === 'sync-iterable-byte-batches'
    && entry.rowCount === 1
    && entry.fastestMiBPerSec === 139.27
    && entry.demandDrivenRows === 1
    && entry.backpressureRows === 0
  ));
  assert.ok(report.summary.largeJsFullSourceModeBreakdown.some(entry =>
    entry.sourceMode === 'generated-sync-iterable-byte-batches'
    && entry.rowCount === 108
    && entry.boundedFullStringRowCount === 99
    && entry.fastestRow.sourceArtifact === 'access-shape-candidate-cross-process.json'
    && entry.fastestRow.runtimeLabel === 'Bun/JSC'
    && entry.fastestRow.id === 'rawFrameNameId'
    && entry.fastestRow.eventCount === 57096514
    && entry.fastestRow.checksum === -540013997
    && entry.fastestMiBPerSec === 179.7
    && entry.demandDrivenRows === 108
  ));
  assert.ok(report.summary.largeJsFullSourceModeBreakdown.some(entry =>
    entry.sourceMode === 'file-backed-sync-iterable-byte-batches'
    && entry.rowCount === 41
    && entry.boundedFullStringRowCount === 40
    && entry.fastestRow.sourceArtifact === 'file-backed-source-sweep.json'
    && entry.fastestRow.id === 'stax-raw-frame-name-id-chunk-32kib'
    && entry.fastestMiBPerSec === 151.7
    && entry.demandDrivenRows === 41
    && entry.backpressureRows === 0
  ));
  assert.ok(report.summary.largeJsFullSourceModeBreakdown.some(entry =>
    entry.sourceMode === 'web-readable-stream-pull'
    && entry.rowCount === 1
    && entry.fastestMiBPerSec === 143.29
    && entry.demandDrivenRows === 1
    && entry.backpressureRows === 1
  ));
  assert.ok(report.fastestLargeFullRows.some(row =>
    row.sourceArtifact === 'bun-candidate-headroom-books-corpus-stability.json'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 178.52
    && row.hasMemoryProof === true
  ));
  assert.ok(report.fastestLargeFullRows.some(row =>
    row.sourceArtifact === 'candidate-headroom-books-corpus-stability.json'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 176.47
    && row.hasMemoryProof === true
    && row.memoryKind === 'process-rss'
  ));
  assert.ok(report.fastestLargeFullRows.some(row =>
    row.sourceArtifact === 'long-ascii-text-materialization-candidate-stability.json'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 172.85
    && row.hasMemoryProof === true
    && row.fullStringParity === true
  ));
  assert.ok(report.fastestLargeFullRows.some(row =>
    row.sourceArtifact === 'text-cache-materialization-candidate-stability.json'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 175.02
    && row.hasMemoryProof === true
    && row.fullStringParity === true
  ));
  assert.ok(report.fastestLargeFullRows.some(row =>
    row.sourceArtifact === 'bun-candidate-headroom-books-corpus-stability.json'
    && row.id === 'stringFull'
    && row.mibPerSec === 171.35
    && row.hasMemoryProof === true
  ));
  assert.ok(!report.fastestLargeFullRows.some(row =>
    row.sourceArtifact === 'materialization-category-drop-sweep.json'
    && row.id === 'rawFrameNameId'
  ));
  assert.ok(report.scannedArtifacts.includes('candidate-headroom-cross-process-large-asset-corpus.json'));
  assert.ok(report.scannedArtifacts.includes('bun-jsc-heap-allocation-profile.json'));
  assert.ok(report.scannedArtifacts.includes('browser-v8-codegen-trace.json'));
  assert.ok(report.scannedArtifacts.includes('bun-jsc-codegen-trace.json'));
  assert.ok(report.scannedArtifacts.includes('firefox-spidermonkey-allocation-profile.json'));
  assert.ok(report.scannedArtifacts.includes('firefox-spidermonkey-memory-api-source-pin-audit.json'));
  assert.ok(report.scannedArtifacts.includes('firefox-spidermonkey-string-source-pin-audit.json'));
  assert.ok(report.scannedArtifacts.includes('safari-webkit-availability-audit.json'));
  assert.ok(report.scannedArtifacts.includes('quick-xml-allocation-count-stability.json'));
  assert.ok(report.scannedArtifacts.includes('woodstox-measured-jfr-allocation-rerun.json'));
  assert.ok(report.unboundedOrUnknownLargeFullRows.some(row =>
    row.sourceArtifact === 'firefox-bidi-candidate-headroom-corpus.json'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 48.15
    && row.memoryKind === 'recorded-unknown-kind'
    && row.boundedMemory === false
  ));
  assert.ok(report.unboundedOrUnknownLargeFullRows.some(row =>
    row.sourceArtifact === 'firefox-bidi-candidate-headroom-projection.json'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 64.24
    && row.memoryKind === 'recorded-unknown-kind'
    && row.boundedMemory === false
  ));
  assert.ok(report.unboundedOrUnknownLargeFullRows.some(row =>
    row.sourceArtifact === 'firefox-bidi-candidate-headroom-cross-process-projection.json'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec >= 69
    && row.mibPerSec < 70
    && row.memoryKind === 'not-recorded'
    && row.boundedMemory === false
  ));
  assert.ok(report.unboundedOrUnknownLargeFullRows.some(row =>
    row.sourceArtifact === 'firefox-bidi-candidate-headroom-cross-process-books-corpus.json'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 76.90
    && row.memoryKind === 'not-recorded'
    && row.boundedMemory === false
  ));
  assert.ok(report.unboundedOrUnknownLargeFullRows.some(row =>
    row.sourceArtifact === 'firefox-bidi-textdecoder-span-variants.json'
    && row.id === 'shortAsciiSubarraySharedDecoder'
    && row.mibPerSec === 46.28
    && row.memoryKind === 'recorded-unknown-kind'
    && row.boundedMemory === false
  ));
  assert.ok(report.unboundedOrUnknownLargeFullRows.some(row =>
    row.sourceArtifact === 'firefox-bidi-textdecoder-span-variants-corpus.json'
    && row.id === 'shortAsciiSubarraySharedDecoder'
    && row.mibPerSec === 68.42
    && row.memoryKind === 'recorded-unknown-kind'
    && row.boundedMemory === false
  ));
  assert.ok(report.unboundedOrUnknownLargeFullRows.some(row =>
    row.sourceArtifact === 'firefox-bidi-textdecoder-span-cross-process.json'
    && row.id === 'shortAsciiSubarraySharedDecoder'
    && row.mibPerSec === 50.24
    && row.memoryKind === 'not-recorded'
    && row.boundedMemory === false
  ));
  assert.ok(report.unboundedOrUnknownLargeFullRows.some(row =>
    row.sourceArtifact === 'firefox-bidi-textdecoder-span-cross-process-corpus.json'
    && row.id === 'shortAsciiSubarraySharedDecoder'
    && row.mibPerSec === 69.98
    && row.memoryKind === 'not-recorded'
    && row.boundedMemory === false
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Runtime Counterexample Scan/);
  assert.match(markdown, /Counterexamples found: 0/);
  assert.match(markdown, /Aggregate rows recognized: 89/);
  assert.match(markdown, /1 GiB\+ JS full-string aggregate rows recognized: 69/);
  assert.match(markdown, /Rows with recognized source mode: 203/);
  assert.match(markdown, /1 GiB\+ JS full-string rows with recognized source mode: 152/);
  assert.match(markdown, /Fastest 1 GiB\+ Full-String JS Rows With Memory Proof/);
  assert.match(markdown, /Fastest 1 GiB\+ Full-String JS Cross-Process Aggregate Rows With Memory Proof/);
  assert.match(markdown, /Source Mode Breakdown For 1 GiB\+ Full-String JS Rows/);
  assert.match(markdown, /Demand-driven rows/);
  assert.match(markdown, /Stream backpressure rows/);
  assert.match(markdown, /\| `generated-sync-iterable-byte-batches` \| 108 \| 108 \| 99 \| 179\.70 \| Bun\/JSC rawFrameNameId from access-shape-candidate-cross-process\.json \| 108 \| 0 \|/);
  assert.match(markdown, /\| `file-backed-sync-iterable-byte-batches` \| 41 \| 41 \| 40 \| 151\.70 \| Node\/V8 stax-raw-frame-name-id stax-raw-frame-name-id-chunk-32kib from file-backed-source-sweep\.json \| 41 \| 0 \|/);
  assert.match(markdown, /\| `complete-js-string` \| 1 \| 1 \| 0 \| \d+\.\d{2} \| Bun\/JSC 3 from bun-event-reader-string-large\.json \| 0 \| 0 \|/);
  assert.match(markdown, /\| `sync-iterable-byte-batches` \| 1 \| 1 \| 1 \| 139\.27 \| Node\/V8 sync-iterable-byte-batches from stream-source-consumption-shapes\.json \| 1 \| 0 \|/);
  assert.match(markdown, /\| `web-readable-stream-pull` \| 1 \| 1 \| 1 \| 143\.29 \| Node\/V8 web-readable-stream-pull from stream-source-consumption-shapes\.json \| 1 \| 1 \|/);
  assert.match(markdown, /Fastest 1 GiB\+ JS full-string aggregate row with memory proof: Bun\/JSC rawFrameNameId from access-shape-candidate-cross-process\.json at avg 177\.34 MiB\/s/);
  assert.match(markdown, /Text\/CDATA Materialization Headroom Rows/);
  assert.match(markdown, /Fastest text\/CDATA materialization headroom row: Node\/V8 withoutTextStrings from long-text-cache-materialization-candidate\.json at 229\.15 MiB\/s/);
  assert.match(markdown, /bun-candidate-headroom-books-corpus\.json/);
  assert.match(markdown, /not full-string StAX counterexamples/);
  assert.match(markdown, /row-level memory evidence/);
  assert.match(markdown, /not an impossibility proof/);
  assert.match(markdown, /Cross-process aggregate rows are reported separately from individual sample rows/);
  assert.match(markdown, /source-consumption-modes-separated/);
  assert.match(markdown, /complete-js-string:1/);
  assert.match(markdown, /web-readable-stream-pull:1/);
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
