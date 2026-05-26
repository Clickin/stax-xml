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
  assert.equal(report.summary.scannedArtifactCount, 180);
  assert.ok(report.scannedArtifacts.includes('concat-buffer-reuse-negative-result.json'));
  assert.ok(report.scannedArtifacts.includes('file-backed-materialization-profile.json'));
  assert.ok(report.scannedArtifacts.includes('file-backed-long-ascii-text-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('unrolled-medium-ascii-text-materialization-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('unrolled-medium-ascii-text-cross-process-books-corpus.json'));
  assert.ok(report.scannedArtifacts.includes('unrolled-medium-ascii-text-trim-guard-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('offset-text-cache-materialization-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('attr-value-cache-materialization-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('bun-cache-candidates-books-corpus.json'));
  assert.ok(report.scannedArtifacts.includes('segment-tokenizer-full-checksum-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('stream-source-consumption-backpressure-counters.json'));
  assert.ok(report.scannedArtifacts.includes('candidate-headroom-cross-process-midsize-corpus.json'));
  assert.ok(report.scannedArtifacts.includes('event-reader-byte-batch-cross-process-midsize-corpus.json'));
  assert.equal(report.summary.measuredRowCount, 988);
  assert.equal(report.summary.aggregateRowCount, 117);
  assert.equal(report.summary.largeJsFullRowCount, 645);
  assert.equal(report.summary.largeJsFullAggregateRowCount, 95);
  assert.equal(report.summary.sourceModeRowCount, 373);
  assert.equal(report.summary.largeJsFullSourceModeRowCount, 279);
  assert.equal(report.summary.partialHeadroomRowCount, 38);
  assert.equal(report.summary.textMaterializationHeadroomRowCount, 13);
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
  assert.equal(report.summary.fastestLargeFullRowWithMemoryProof.sourceArtifact, 'text-trim-cost-decomposition.json');
  assert.equal(report.summary.fastestLargeFullRowWithMemoryProof.id, 'rawFrameNameId');
  assert.equal(report.summary.fastestLargeFullRowWithMemoryProof.mibPerSec, 185.5);
  assert.ok(report.summary.fastestLargeFullRowWithMemoryProof.mibPerSec < 200);
  assert.equal(report.summary.fastestLargeFullAggregateRowWithMemoryProof.sourceArtifact, 'access-shape-candidate-cross-process.json');
  assert.equal(report.summary.fastestLargeFullAggregateRowWithMemoryProof.runtimeLabel, 'Bun/JSC');
  assert.equal(report.summary.fastestLargeFullAggregateRowWithMemoryProof.id, 'rawFrameNameId');
  assert.equal(report.summary.fastestLargeFullAggregateRowWithMemoryProof.mibPerSec, 177.34);
  assert.equal(report.summary.fastestLargeFullAggregateRowWithMemoryProof.sampleCount, 3);
  assert.equal(report.summary.fastestLargeFullAggregateRowWithMemoryProof.spreadPercent, 3.23);
  assert.equal(report.summary.fastestPartialHeadroomRow.fullStringParity, false);
  assert.equal(report.summary.fastestPartialHeadroomRow.sourceArtifact, 'segment-scan-headroom.json');
  assert.equal(report.summary.fastestPartialHeadroomRow.id, 'grouped-segment-scan');
  assert.equal(report.summary.fastestPartialHeadroomRow.mibPerSec, 682.83);
  assert.ok(report.summary.fastestPartialHeadroomRow.mibPerSec >= 200);
  assert.equal(report.summary.fastestTextMaterializationHeadroomRow.sourceArtifact, 'text-trim-cost-decomposition-4gib.json');
  assert.equal(report.summary.fastestTextMaterializationHeadroomRow.id, 'withoutTextStrings');
  assert.equal(report.summary.fastestTextMaterializationHeadroomRow.mibPerSec, 252.36);
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
  assert.ok(report.scannedArtifacts.includes('raw-span-shape-audit.json'));
  assert.ok(report.scannedArtifacts.includes('materialization-category-drop-sweep.json'));
  assert.ok(report.scannedArtifacts.includes('fold-trimmed-text-candidate-stability.json'));
  assert.ok(report.scannedArtifacts.includes('long-ascii-text-materialization-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('medium-ascii-text-materialization-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('medium-ascii-attr-value-materialization-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('long-ascii-text-materialization-candidate-stability.json'));
  assert.ok(report.scannedArtifacts.includes('text-cache-materialization-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('text-cache-materialization-candidate-stability.json'));
  assert.ok(report.scannedArtifacts.includes('long-text-cache-materialization-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('text-cdata-cost-decomposition.json'));
  assert.ok(report.scannedArtifacts.includes('text-trim-cost-decomposition.json'));
  assert.ok(report.scannedArtifacts.includes('text-trim-cost-decomposition-2gib.json'));
  assert.ok(report.scannedArtifacts.includes('text-trim-cost-decomposition-4gib.json'));
  assert.ok(report.scannedArtifacts.includes('text-trim-cost-decomposition-8gib.json'));
  assert.ok(report.scannedArtifacts.includes('text-materialization-frontier.json'));
  assert.ok(report.scannedArtifacts.includes('semantic-checksum-upper-bound.json'));
  assert.ok(report.scannedArtifacts.includes('text-trim-guard-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('text-ascii-pretrim-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('all-ascii-span-materialization-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('name-collision-safe-interning-perf.json'));
  assert.ok(report.scannedArtifacts.includes('sync-byte-batch-shape-batch1.json'));
  assert.ok(report.scannedArtifacts.includes('sync-byte-batch-shape-batch16.json'));
  assert.ok(report.scannedArtifacts.includes('stax-event-public-object-shape-audit.json'));
  assert.ok(report.scannedArtifacts.includes('external-baseline-1024mib-file-sync-batches.json'));
  assert.ok(report.scannedArtifacts.includes('external-baseline-treebank-wrapper-1024mib-file-sync-batches.json'));
  assert.ok(report.scannedArtifacts.includes('external-baseline-1024mib-file-sync-batches-split-singletons.json'));
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
  assert.ok(report.scannedArtifacts.includes('access-shape-candidate-cross-process-batch8.json'));
  assert.ok(report.scannedArtifacts.includes('access-shape-candidate-stability.json'));
  assert.ok(report.scannedArtifacts.includes('firefox-fetch-readable-stream-timeout-audit.json'));
  assert.ok(report.scannedArtifacts.includes('deno-textdecoder-span-variants.json'));
  assert.ok(report.scannedArtifacts.includes('deno-textdecoder-span-variants-corpus.json'));
  assert.ok(report.scannedArtifacts.includes('segment-scan-headroom.json'));
  assert.ok(report.scannedArtifacts.includes('segment-tokenizer-headroom.json'));
  assert.ok(report.scannedArtifacts.includes('segment-tokenizer-string-frontier.json'));
  assert.ok(report.scannedArtifacts.includes('segment-tokenizer-full-checksum-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('materialization-span-distribution-books-corpus.json'));
  assert.ok(report.scannedArtifacts.includes('materialization-span-distribution-large-corpus.json'));
  assert.ok(report.scannedArtifacts.includes('materialization-span-distribution-treebank-corpus.json'));
  assert.ok(report.scannedArtifacts.includes('medium-ascii-text-treebank-corpus.json'));
  assert.ok(report.scannedArtifacts.includes('text-checksum-consumer-decomposition.json'));
  assert.ok(report.aggregateRows.some(row =>
    row.sourceArtifact === 'unrolled-medium-ascii-text-cross-process-books-corpus.json'
    && row.runtimeLabel === 'Node/V8'
    && row.id === 'rawFrameNameIdUnrolledMediumAsciiText'
    && row.mibPerSec === 89.82
    && row.fullStringParity === true
    && row.boundedMemory === true
  ));
  assert.ok(report.aggregateRows.some(row =>
    row.sourceArtifact === 'unrolled-medium-ascii-text-cross-process-books-corpus.json'
    && row.runtimeLabel === 'Bun/JSC'
    && row.id === 'rawFrameNameIdUnrolledMediumAsciiText'
    && row.mibPerSec === 92.68
    && row.fullStringParity === true
    && row.boundedMemory === true
  ));
  assert.ok(report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'segment-scan-headroom.json'
    && row.runtimeLabel === 'Node/V8'
    && row.id === 'grouped-segment-scan'
    && row.mibPerSec === 682.83
    && row.fullStringParity === false
    && row.contractScope === 'delimiter-byte-scan-no-xml-parse-no-string-materialization'
    && row.demandDrivenSource === true
    && row.directReadableStream === false
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'segment-scan-headroom.json'
    && row.id === 'grouped-concat-scan'
    && row.mibPerSec === 589.23
    && row.fullStringParity === false
  ));
  assert.ok(report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'segment-tokenizer-headroom.json'
    && row.runtimeLabel === 'Node/V8'
    && row.id === 'singleton-segment-tokenize'
    && row.mibPerSec === 236.55
    && row.fullStringParity === false
    && row.contractScope === 'xml-token-boundary-no-string-materialization'
    && row.demandDrivenSource === true
    && row.directReadableStream === false
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(!report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'segment-tokenizer-headroom.json'
    && row.id === 'grouped-segment-tokenize'
    && row.mibPerSec >= 200
  ));
  assert.ok(report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'segment-tokenizer-string-frontier.json'
    && row.runtimeLabel === 'Node/V8'
    && row.id === 'tokenOnly'
    && row.mibPerSec === 234.3
    && row.fullStringParity === false
    && row.contractScope === 'xml-token-boundary-string-materialization-frontier'
    && row.demandDrivenSource === true
    && row.directReadableStream === false
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(!report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'segment-tokenizer-string-frontier.json'
    && row.id === 'elementNameStrings'
    && row.mibPerSec >= 200
  ));
  assert.ok(report.sourceModeRows.some(row =>
    row.sourceArtifact === 'segment-tokenizer-full-checksum-candidate.json'
    && row.id === 'allTokenStringsDocumentEventsNoObjects'
    && row.mibPerSec === 42.58
    && row.eventCount === 61236571
    && row.checksum === -716099804
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.contractScope === 'full-string-checksum-no-public-objects'
    && row.demandDrivenSource === true
    && row.directReadableStream === false
    && row.fullArrayBufferParserInput === false
  ));
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
    && row.mibPerSec === 216.08
    && row.fullStringParity === false
    && row.contractScope === 'partial-scan-no-string-materialization'
  ));
  assert.ok(report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'file-backed-core-decomposition.json'
    && row.id === 'stax-raw-frame-span-stats'
    && row.mibPerSec === 210.19
    && row.fullStringParity === false
    && row.contractScope === 'partial-raw-frame-span-metadata-no-string-materialization'
  ));
  assert.ok(!report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'text-cache-materialization-candidate.json'
    && row.id === 'withoutTextStrings'
  ));
  assert.equal(report.textMaterializationHeadroomRows.length, 13);
  assert.ok(report.textMaterializationHeadroomRows.some(row =>
    row.sourceArtifact === 'text-trim-cost-decomposition.json'
    && row.id === 'withoutTextStrings'
    && row.mibPerSec === 249.13
    && row.fullStringParity === false
    && row.contractScope === 'full-materialization-minus-text-cdata'
    && row.checksum === 1372281363
  ));
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
  assert.ok(report.textMaterializationHeadroomRows.some(row =>
    row.sourceArtifact === 'medium-ascii-text-materialization-candidate.json'
    && row.id === 'withoutTextStrings'
    && row.mibPerSec === 222.28
    && row.fullStringParity === false
    && row.contractScope === 'full-materialization-minus-text-cdata'
    && row.checksum === 1372281363
  ));
  assert.ok(report.textMaterializationHeadroomRows.some(row =>
    row.sourceArtifact === 'medium-ascii-attr-value-materialization-candidate.json'
    && row.id === 'withoutTextStrings'
    && row.mibPerSec === 213.11
    && row.fullStringParity === false
    && row.contractScope === 'full-materialization-minus-text-cdata'
    && row.checksum === 1372281363
  ));
  assert.ok(report.textMaterializationHeadroomRows.some(row =>
    row.sourceArtifact === 'unrolled-medium-ascii-text-materialization-candidate.json'
    && row.id === 'withoutTextStrings'
    && row.mibPerSec === 214.41
    && row.fullStringParity === false
    && row.contractScope === 'full-materialization-minus-text-cdata'
    && row.checksum === 1372281363
  ));
  assert.ok(report.textMaterializationHeadroomRows.some(row =>
    row.sourceArtifact === 'unrolled-medium-ascii-text-trim-guard-candidate.json'
    && row.id === 'withoutTextStrings'
    && row.mibPerSec === 215.7
    && row.fullStringParity === false
    && row.contractScope === 'full-materialization-minus-text-cdata'
    && row.checksum === 1372281363
  ));
  assert.ok(report.textMaterializationHeadroomRows.some(row =>
    row.sourceArtifact === 'offset-text-cache-materialization-candidate.json'
    && row.id === 'withoutTextStrings'
    && row.mibPerSec === 216.04
    && row.fullStringParity === false
    && row.contractScope === 'full-materialization-minus-text-cdata'
    && row.checksum === 1372281363
  ));
  assert.ok(report.textMaterializationHeadroomRows.some(row =>
    row.sourceArtifact === 'bun-cache-candidates-books-corpus.json'
    && row.id === 'withoutTextStrings'
    && row.runtimeLabel === 'Bun/JSC'
    && row.mibPerSec === 213.15
    && row.fullStringParity === false
    && row.contractScope === 'full-materialization-minus-text-cdata'
    && row.checksum === 1372281363
  ));
  assert.ok(report.textMaterializationHeadroomRows.some(row =>
    row.sourceArtifact === 'text-trim-cost-decomposition-2gib.json'
    && row.id === 'withoutTextStrings'
    && row.mibPerSec === 243.31
    && row.fullStringParity === false
    && row.contractScope === 'full-materialization-minus-text-cdata'
    && row.checksum === 223378117
  ));
  assert.ok(report.textMaterializationHeadroomRows.some(row =>
    row.sourceArtifact === 'text-trim-cost-decomposition-4gib.json'
    && row.id === 'withoutTextStrings'
    && row.mibPerSec === 252.36
    && row.fullStringParity === false
    && row.contractScope === 'full-materialization-minus-text-cdata'
    && row.checksum === -933264309
  ));
  assert.ok(report.textMaterializationHeadroomRows.some(row =>
    row.sourceArtifact === 'text-trim-cost-decomposition-8gib.json'
    && row.id === 'withoutTextStrings'
    && row.mibPerSec === 237.38
    && row.fullStringParity === false
    && row.contractScope === 'full-materialization-minus-text-cdata'
    && row.checksum === 999272277
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
    row.sourceArtifact === 'text-trim-cost-decomposition.json'
    && row.runtimeLabel === 'Node/V8'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 185.5
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
  assert.ok(report.fastestLargeFullAggregateRowsWithMemoryProof.some(row =>
    row.sourceArtifact === 'access-shape-candidate-cross-process-batch8.json'
    && row.runtimeLabel === 'Node/V8'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 172.66
    && row.minMibPerSec === 169.86
    && row.maxMibPerSec === 175.09
    && row.sampleCount === 3
    && row.fullStringParity === true
  ));
  assert.ok(report.sourceModeRows.some(row =>
    row.sourceArtifact === 'text-trim-cost-decomposition.json'
    && row.id === 'rawFrameNameId'
    && row.runtimeLabel === 'Node/V8'
    && row.sourceMode === 'generated-sync-iterable-byte-batches'
    && row.mibPerSec === 185.5
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.demandDrivenSource === true
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.sourceModeRows.some(row =>
    row.sourceArtifact === 'bun-event-reader-string-large.json'
    && row.runtimeLabel === 'Bun/JSC'
    && row.sourceMode === 'complete-js-string'
    && row.fullStringParity === true
    && row.boundedMemory === false
    && row.demandDrivenSource === false
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.sourceModeRows.some(row =>
    row.sourceArtifact === 'stream-source-consumption-shapes.json'
    && row.id === 'sync-iterable-byte-batches'
    && row.runtimeLabel === 'Node/V8'
    && row.jsRuntime === true
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.mibPerSec === 75.36
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.demandDrivenSource === true
    && row.directReadableStream === false
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.sourceModeRows.some(row =>
    row.sourceArtifact === 'semantic-checksum-upper-bound.json'
    && row.id === 'rawFrameSemanticChecksum'
    && row.runtimeLabel === 'Node/V8'
    && row.jsRuntime === true
    && row.sourceMode === 'generated-sync-iterable-byte-batches'
    && row.mibPerSec === 94.11
    && row.fullStringParity === false
    && row.boundedMemory === true
    && row.demandDrivenSource === true
    && row.fullArrayBufferParserInput === false
    && row.eventCount === 57096514
    && row.checksum === -540013997
  ));
  assert.ok(report.sourceModeRows.some(row =>
    row.sourceArtifact === 'stream-source-consumption-shapes.json'
    && row.id === 'sync-iterable-byte-batches-batch-8'
    && row.runtimeLabel === 'Node/V8'
    && row.jsRuntime === true
    && row.sourceMode === 'sync-iterable-byte-batches'
    && row.mibPerSec === 74.8
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.demandDrivenSource === true
    && row.directReadableStream === false
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.sourceModeRows.some(row =>
    row.sourceArtifact === 'stream-source-consumption-shapes.json'
    && row.id === 'async-iterable-raw-frame-ascii-batch-8'
    && row.runtimeLabel === 'Node/V8'
    && row.jsRuntime === true
    && row.sourceMode === 'async-iterable-byte-batches'
    && row.mibPerSec === 76.2
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.demandDrivenSource === true
    && row.directReadableStream === false
    && row.respectsBackpressure === true
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.sourceModeRows.some(row =>
    row.sourceArtifact === 'external-baseline-1024mib-file-sync-batches-split-singletons.json'
    && row.id === 'stax-raw-frame-name-id'
    && row.runtimeLabel === 'Node/V8 stax-raw-frame-name-id'
    && row.sourceMode === 'file-backed-sync-iterable-byte-batches'
    && row.mibPerSec === 129.34
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.demandDrivenSource === true
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.sourceModeRows.some(row =>
    row.sourceArtifact === 'stream-source-consumption-shapes.json'
    && row.id === 'web-readable-stream-raw-frame-ascii-batch-8'
    && row.runtimeLabel === 'Node/V8'
    && row.jsRuntime === true
    && row.sourceMode === 'web-readable-stream-pull'
    && row.demandDrivenSource === true
    && row.directReadableStream === true
    && row.respectsBackpressure === true
    && row.mibPerSec === 76.87
    && row.fullStringParity === true
    && row.boundedMemory === true
    && row.fullArrayBufferParserInput === false
  ));
  assert.ok(report.summary.largeJsFullSourceModeBreakdown.some(entry =>
    entry.sourceMode === 'complete-js-string'
    && entry.rowCount === 1
    && entry.boundedFullStringRowCount === 0
    && entry.demandDrivenRows === 0
    && entry.directReadableStreamRows === 0
    && entry.backpressureRows === 0
    && entry.notFullArrayBufferRows === 1
    && entry.fullArrayBufferRows === 0
    && entry.unknownArrayBufferRows === 0
    && entry.fastestRow.sourceArtifact === 'bun-event-reader-string-large.json'
  ));
  assert.ok(report.summary.largeJsFullSourceModeBreakdown.some(entry =>
    entry.sourceMode === 'sync-iterable-byte-batches'
    && entry.rowCount === 4
    && entry.fastestMiBPerSec === 90.56
    && entry.fastestRow.sourceArtifact === 'stream-source-consumption-backpressure-counters.json'
    && entry.fastestRow.id === 'sync-iterable-byte-batches-batch-8'
    && entry.demandDrivenRows === 4
    && entry.directReadableStreamRows === 0
    && entry.backpressureRows === 0
    && entry.notFullArrayBufferRows === 4
  ));
  assert.ok(report.summary.largeJsFullSourceModeBreakdown.some(entry =>
    entry.sourceMode === 'async-iterable-byte-batches'
    && entry.rowCount === 13
    && entry.fastestMiBPerSec === 76.2
    && entry.fastestRow.id === 'async-iterable-raw-frame-ascii-batch-8'
    && entry.demandDrivenRows === 13
    && entry.directReadableStreamRows === 0
    && entry.backpressureRows === 13
    && entry.notFullArrayBufferRows === 13
  ));
  assert.ok(report.summary.largeJsFullSourceModeBreakdown.some(entry =>
    entry.sourceMode === 'generated-sync-iterable-byte-batches'
    && entry.rowCount === 198
    && entry.boundedFullStringRowCount === 189
    && entry.fastestRow.sourceArtifact === 'text-trim-cost-decomposition.json'
    && entry.fastestRow.runtimeLabel === 'Node/V8'
    && entry.fastestRow.id === 'rawFrameNameId'
    && entry.fastestRow.eventCount === 57096514
    && entry.fastestRow.checksum === -540013997
    && entry.fastestMiBPerSec === 185.5
    && entry.demandDrivenRows === 198
    && entry.directReadableStreamRows === 0
    && entry.notFullArrayBufferRows === 198
    && entry.fullArrayBufferRows === 0
    && entry.unknownArrayBufferRows === 0
  ));
  assert.ok(report.summary.largeJsFullSourceModeBreakdown.some(entry =>
    entry.sourceMode === 'file-backed-sync-iterable-byte-batches'
    && entry.rowCount === 50
    && entry.boundedFullStringRowCount === 49
    && entry.fastestRow.sourceArtifact === 'file-backed-batch-size-sweep.json'
    && entry.fastestRow.id === 'stax-raw-frame-name-id-batch-8'
    && entry.fastestMiBPerSec === 152.11
    && entry.demandDrivenRows === 50
    && entry.directReadableStreamRows === 0
    && entry.backpressureRows === 0
    && entry.notFullArrayBufferRows === 50
  ));
  assert.ok(report.summary.largeJsFullSourceModeBreakdown.some(entry =>
    entry.sourceMode === 'web-readable-stream-pull'
    && entry.rowCount === 13
    && entry.fastestMiBPerSec === 76.87
    && entry.fastestRow.id === 'web-readable-stream-raw-frame-ascii-batch-8'
    && entry.demandDrivenRows === 13
    && entry.directReadableStreamRows === 13
    && entry.backpressureRows === 13
    && entry.notFullArrayBufferRows === 13
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
    row.sourceArtifact === 'text-trim-cost-decomposition-4gib.json'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 178.86
    && row.hasMemoryProof === true
    && row.fullStringParity === true
    && row.eventCount === 228385566
    && row.checksum === -1067702969
  ));
  assert.ok(report.fastestLargeFullRows.some(row =>
    row.sourceArtifact === 'text-cache-materialization-candidate-stability.json'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 175.02
    && row.hasMemoryProof === true
    && row.fullStringParity === true
  ));
  assert.ok(report.fastestLargeFullRows.some(row =>
    row.sourceArtifact === 'text-trim-cost-decomposition-2gib.json'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 184.92
    && row.eventCount === 114192784
    && row.checksum === 1903859545
    && row.hasMemoryProof === true
    && row.fullStringParity === true
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
  assert.match(markdown, /Scanned artifacts: 180/);
  assert.match(markdown, /Measured rows recognized: 988/);
  assert.match(markdown, /Aggregate rows recognized: 117/);
  assert.match(markdown, /1 GiB\+ JS full-string aggregate rows recognized: 95/);
  assert.match(markdown, /Rows with recognized source mode: 373/);
  assert.match(markdown, /Partial\/projection threshold rows: 38/);
  assert.match(markdown, /1 GiB\+ JS full-string rows with recognized source mode: 279/);
  assert.match(markdown, /Fastest 1 GiB\+ Full-String JS Rows With Memory Proof/);
  assert.match(markdown, /Fastest partial\/projection threshold row: Node\/V8 grouped-segment-scan from segment-scan-headroom\.json at 682\.83 MiB\/s/);
  assert.match(markdown, /Fastest 1 GiB\+ Full-String JS Cross-Process Aggregate Rows With Memory Proof/);
  assert.match(markdown, /Source Mode Breakdown For 1 GiB\+ Full-String JS Rows/);
  assert.match(markdown, /Demand-driven rows/);
  assert.match(markdown, /Direct ReadableStream rows/);
  assert.match(markdown, /Stream backpressure rows/);
  assert.match(markdown, /Not full ArrayBuffer rows/);
  assert.match(markdown, /\| `generated-sync-iterable-byte-batches` \| 198 \| 198 \| 189 \| 185\.50 \| Node\/V8 rawFrameNameId from text-trim-cost-decomposition\.json \| 198 \| 0 \| 0 \| 198 \|/);
  assert.match(markdown, /\| `file-backed-sync-iterable-byte-batches` \| 50 \| 50 \| 49 \| 152\.11 \| Node\/V8 stax-raw-frame-name-id stax-raw-frame-name-id-batch-8 from file-backed-batch-size-sweep\.json \| 50 \| 0 \| 0 \| 50 \|/);
  assert.match(markdown, /\| `complete-js-string` \| 1 \| 1 \| 0 \| \d+\.\d{2} \| Bun\/JSC 3 from bun-event-reader-string-large\.json \| 0 \| 0 \| 0 \| 1 \|/);
  assert.match(markdown, /\| `async-iterable-byte-batches` \| 13 \| 13 \| 13 \| 76\.20 \| Node\/V8 async-iterable-raw-frame-ascii-batch-8 from stream-source-consumption-shapes\.json \| 13 \| 0 \| 13 \| 13 \|/);
  assert.match(markdown, /\| `web-readable-stream-pull` \| 13 \| 13 \| 13 \| 76\.87 \| Node\/V8 web-readable-stream-raw-frame-ascii-batch-8 from stream-source-consumption-shapes\.json \| 13 \| 13 \| 13 \| 13 \|/);
  assert.match(markdown, /\| `sync-iterable-byte-batches` \| 4 \| 4 \| 4 \| 90\.56 \| Node\/V8 sync-iterable-byte-batches-batch-8 from stream-source-consumption-backpressure-counters\.json \| 4 \| 0 \| 0 \| 4 \|/);
  assert.match(markdown, /Fastest 1 GiB\+ JS full-string aggregate row with memory proof: Bun\/JSC rawFrameNameId from access-shape-candidate-cross-process\.json at avg 177\.34 MiB\/s/);
  assert.match(markdown, /Text\/CDATA Materialization Headroom Rows/);
  assert.match(markdown, /Fastest text\/CDATA materialization headroom row: Node\/V8 withoutTextStrings from text-trim-cost-decomposition-4gib\.json at 252\.36 MiB\/s/);
  assert.match(markdown, /bun-candidate-headroom-books-corpus\.json/);
  assert.match(markdown, /not full-string StAX counterexamples/);
  assert.match(markdown, /row-level memory evidence/);
  assert.match(markdown, /not an impossibility proof/);
  assert.match(markdown, /Cross-process aggregate rows are reported separately from individual sample rows/);
  assert.match(markdown, /source-consumption-modes-separated/);
  assert.match(markdown, /complete-js-string:1/);
  assert.match(markdown, /async-iterable-byte-batches:13/);
  assert.match(markdown, /web-readable-stream-pull:13/);
  assert.match(markdown, /sync-iterable-byte-batches:4/);
  assert.match(markdown, /not-full-ArrayBuffer parser-input rows are generated-sync-iterable-byte-batches:198\/198, file-backed-sync-iterable-byte-batches:50\/50, async-iterable-byte-batches:13\/13/);
  assert.match(markdown, /web-readable-stream-pull:13\/13/);
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
