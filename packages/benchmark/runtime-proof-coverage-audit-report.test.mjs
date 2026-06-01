import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'runtime-proof-coverage-audit-report-test');
const jsonOut = join(tmpDir, 'runtime-proof-coverage-audit.json');
const mdOut = join(tmpDir, 'runtime-proof-coverage-audit.md');

test('runtime proof coverage audit keeps open proof obligations explicit', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
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
  assert.equal(report.objective, 'runtime-proof-coverage-audit');
  assert.equal(report.contract, 'static-release-artifact-proof-coverage');
  assert.equal(report.summary.conclusionAllowed, false);
  assert.equal(report.summary.parseErrorCount, 0);
  assert.equal(report.summary.scannedArtifactCount, 217);
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'runtime-proof-handoff-validation.json'
    && artifact.objective === 'runtime-proof-handoff-validation'
    && artifact.measuredRowCount === 0
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'firefox-spidermonkey-nightly-jsshell-availability-audit.json'
    && artifact.objective === 'firefox-spidermonkey-nightly-jsshell-availability-audit'
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'firefox-spidermonkey-jsshell-stax-api-gap-audit.json'
    && artifact.objective === 'firefox-spidermonkey-jsshell-stax-api-gap-audit'
    && artifact.measuredRowCount === 0
    && artifact.evidenceKinds.includes('NEGATIVE_RESULT')
    && artifact.evidenceKinds.includes('SCOPE_GUARD')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'spidermonkey-jsshell-tokenizer-headroom.json'
    && artifact.objective === 'spidermonkey-jsshell-tokenizer-headroom'
    && artifact.measuredRowCount === 2
    && artifact.runtimes.includes('spidermonkey-jsshell')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'spidermonkey-archival-debug-jsshell-codegen-audit.json'
    && artifact.objective === 'spidermonkey-archival-debug-jsshell-codegen-audit'
    && artifact.measuredRowCount === 0
    && artifact.evidenceKinds.includes('TRACE_FACT')
    && artifact.outcome.hasCodegenDumpOutput === true
    && artifact.outcome.scopeComparableToCurrentFirefox === false
    && artifact.outcome.closesEmittedIrObligation === false
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'spidermonkey-taskcluster-debug-jsshell-codegen-audit.json'
    && artifact.objective === 'spidermonkey-taskcluster-debug-jsshell-codegen-audit'
    && artifact.measuredRowCount === 0
    && artifact.evidenceKinds.includes('TRACE_FACT')
    && artifact.evidenceKinds.includes('NEGATIVE_RESULT')
    && artifact.outcome.hasCodegenDumpOutput === true
    && artifact.outcome.scopeComparableToCurrentFirefox === true
    && artifact.outcome.sameContractStaxRow === false
    && artifact.outcome.canRunCurrentStaxFullStringBenchmark === false
    && artifact.outcome.closesEmittedIrObligation === false
    && artifact.shell.provenance.taskId === 'bzK0wWZvQoOguMjTIbRJ_g'
    && artifact.shell.provenance.buildId === '20260531212007'
    && artifact.shell.provenance.sourceRevision === '71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7'
  ));
  assert.ok(report.coverage.spiderMonkeyDiagnostics.rows.some(row =>
    row.id === 'taskcluster-debug-jsshell-codegen'
    && row.selectedRowIdentityStatus === 'not-claimed-non-stax-diagnostic'
    && row.diagnosticFlagsRecorded === true
    && row.emittedDumpMetadataRecorded === true
    && row.selectedRowMetadataComplete === false
    && row.selectedRowMatchesCurrentComparison === null
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit.json'
    && artifact.objective === 'spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit'
    && artifact.measuredRowCount === 1
    && artifact.evidenceKinds.includes('TRACE_FACT')
    && artifact.evidenceKinds.includes('NEGATIVE_RESULT')
    && artifact.evidenceKinds.includes('SCOPE_GUARD')
    && artifact.outcome.hasXmlWorkloadCodegenOutput === true
    && artifact.outcome.hasCodegenDumpOutput === true
    && artifact.outcome.scopeComparableToCurrentFirefox === true
    && artifact.outcome.sameContractStaxRow === false
    && artifact.outcome.canRunCurrentStaxFullStringBenchmark === false
    && artifact.outcome.closesEmittedIrObligation === false
    && artifact.shell.provenance.taskId === 'bzK0wWZvQoOguMjTIbRJ_g'
    && artifact.shell.provenance.buildId === '20260531212007'
    && artifact.shell.provenance.sourceRevision === '71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7'
  ));
  assert.ok(report.coverage.spiderMonkeyDiagnostics.rows.some(row =>
    row.id === 'taskcluster-debug-jsshell-xml-codegen'
    && row.selectedRowIdentityStatus === 'not-claimed-non-stax-diagnostic'
    && row.diagnosticFlagsRecorded === true
    && row.emittedDumpMetadataRecorded === true
    && row.selectedRowMetadataComplete === false
    && row.selectedRowMatchesCurrentComparison === null
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json'
    && artifact.objective === 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit'
    && artifact.measuredRowCount === 0
    && artifact.evidenceKinds.includes('TRACE_FACT')
    && artifact.evidenceKinds.includes('NEGATIVE_RESULT')
    && artifact.evidenceKinds.includes('SCOPE_GUARD')
    && artifact.outcome.hasMaterializedStringObjectCodegenOutput === true
    && artifact.outcome.hasCodegenDumpOutput === true
    && artifact.outcome.scopeComparableToCurrentFirefox === true
    && artifact.outcome.sameContractStaxRow === false
    && artifact.outcome.canRunCurrentStaxFullStringBenchmark === false
    && artifact.outcome.closesEmittedIrObligation === false
    && artifact.shell.provenance.taskId === 'bzK0wWZvQoOguMjTIbRJ_g'
    && artifact.shell.provenance.buildId === '20260531212007'
    && artifact.shell.provenance.sourceRevision === '71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7'
  ));
  assert.ok(report.coverage.spiderMonkeyDiagnostics.rows.some(row =>
    row.id === 'taskcluster-debug-jsshell-materialized-codegen'
    && row.selectedRowIdentityStatus === 'not-claimed-non-stax-diagnostic'
    && row.diagnosticFlagsRecorded === true
    && row.emittedDumpMetadataRecorded === true
    && row.selectedRowMetadataComplete === false
    && row.selectedRowMatchesCurrentComparison === null
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'spidermonkey-materialized-scope-distance-audit.json'
    && artifact.objective === 'spidermonkey-materialized-scope-distance-audit'
    && artifact.measuredRowCount === 0
    && artifact.evidenceKinds.includes('SOURCE_FACT')
    && artifact.evidenceKinds.includes('SCOPE_GUARD')
    && artifact.evidenceKinds.includes('NEGATIVE_RESULT')
    && artifact.summary.semanticEquivalentForAsciiFields === true
    && artifact.summary.closureRequirementsMet === 2
    && artifact.summary.closureRequirementsBlocked === 4
    && artifact.summary.closesCodegenObligation === false
    && artifact.summary.diagnosticThroughputMiBPerSec === 0.4909373604499916
    && artifact.summary.diagnosticThroughputClass === 'debug-jitspew-diagnostic-not-frontier'
    && artifact.summary.throughputCountsAsTargetEvidence === false
    && artifact.summary.conclusionAllowed === false
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'spidermonkey-ascii-scope-distance-audit.json'
    && artifact.objective === 'spidermonkey-ascii-scope-distance-audit'
    && artifact.measuredRowCount === 0
    && artifact.evidenceKinds.includes('SOURCE_FACT')
    && artifact.evidenceKinds.includes('SCOPE_GUARD')
    && artifact.summary.closesCodegenObligation === false
    && artifact.summary.conclusionAllowed === false
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'spidermonkey-jsshell-diagnostic-flag-sweep.json'
    && artifact.objective === 'spidermonkey-jsshell-diagnostic-flag-sweep'
    && artifact.measuredRowCount === 0
    && artifact.evidenceKinds.includes('NEGATIVE_RESULT')
    && artifact.outcome.bytecodeProbeCount === 4
    && artifact.outcome.bytecodeOutputProbeCount === 0
    && artifact.outcome.hasDiagnosticPrefSurface === false
    && artifact.outcome.closesEmittedIrObligation === false
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'file-backed-materialization-profile.json'
    && artifact.objective === 'file-backed-materialization-profile'
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'file-backed-long-ascii-text-candidate.json'
    && artifact.measuredRowCount === 4
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'text-trim-cost-decomposition-2gib.json'
    && artifact.measuredRowCount === 4
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'unrolled-medium-ascii-text-materialization-candidate.json'
    && artifact.measuredRowCount === 4
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'unrolled-medium-ascii-text-trim-guard-candidate.json'
    && artifact.measuredRowCount === 5
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'medium-ascii-text-treebank-corpus.json'
    && artifact.measuredRowCount === 4
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'offset-text-cache-materialization-candidate.json'
    && artifact.measuredRowCount === 4
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'attr-value-cache-materialization-candidate.json'
    && artifact.measuredRowCount === 4
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'bun-cache-candidates-books-corpus.json'
    && artifact.measuredRowCount === 5
    && artifact.runtimes.includes('bun-jsc')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'text-checksum-consumer-decomposition.json'
    && artifact.measuredRowCount === 4
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'instrumentation-overhead-candidate.json'
    && artifact.measuredRowCount === 2
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'no-counter-fold-trim-candidate.json'
    && artifact.measuredRowCount === 3
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'no-counter-value-cache-candidate.json'
    && artifact.measuredRowCount === 4
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'no-counter-name-fold-cache-candidate.json'
    && artifact.measuredRowCount === 3
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'no-counter-string-fold-cache-candidate.json'
    && artifact.measuredRowCount === 4
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'no-counter-name-fold-cache-fold-trim-candidate.json'
    && artifact.measuredRowCount === 4
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'no-counter-name-fold-cache-cross-process-books-corpus.json'
    && artifact.objective === 'candidate-headroom-cross-process'
    && artifact.measuredRowCount === 9
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'no-counter-materialization-candidate.json'
    && artifact.objective === 'candidate-headroom-large'
    && artifact.measuredRowCount === 8
    && artifact.evidenceKinds.includes('BENCH_FACT')
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'no-counter-materialization-batch1-candidate.json'
    && artifact.objective === 'candidate-headroom-large'
    && artifact.measuredRowCount === 8
    && artifact.evidenceKinds.includes('BENCH_FACT')
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'no-counter-materialization-batch1-cross-runtime-books-corpus.json'
    && artifact.objective === 'candidate-headroom-cross-process'
    && artifact.measuredRowCount === 36
    && artifact.evidenceKinds.includes('BENCH_FACT')
    && artifact.runtimes.includes('node-v8')
    && artifact.runtimes.includes('bun-jsc')
    && artifact.runtimes.includes('deno-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'warmup-full-cross-process-books-corpus.json'
    && artifact.objective === 'candidate-headroom-cross-process'
    && artifact.measuredRowCount === 6
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'text-trim-cost-cross-process-books-corpus.json'
    && artifact.objective === 'candidate-headroom-cross-process'
    && artifact.measuredRowCount === 36
    && artifact.runtimes.includes('node-v8')
    && artifact.runtimes.includes('bun-jsc')
    && artifact.runtimes.includes('deno-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'text-trim-cost-cross-process-diverse-cycle.json'
    && artifact.objective === 'candidate-headroom-cross-process'
    && artifact.measuredRowCount === 36
    && artifact.runtimes.includes('node-v8')
    && artifact.runtimes.includes('bun-jsc')
    && artifact.runtimes.includes('deno-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'semantic-checksum-upper-bound.json'
    && artifact.measuredRowCount === 3
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'text-folding-cost-candidate.json'
    && artifact.measuredRowCount === 4
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'segment-tokenizer-full-checksum-candidate.json'
    && artifact.measuredRowCount === 3
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'stream-source-consumption-backpressure-counters.json'
    && artifact.measuredRowCount === 7
    && artifact.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'source-consumption-shape-audit.json'
    && artifact.objective === 'source-consumption-shape-audit'
    && artifact.measuredRowCount === 0
    && artifact.evidenceKinds.length === 1
    && artifact.evidenceKinds.includes('SOURCE_FACT')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'memory-frontier-audit.json'
    && artifact.objective === 'memory-frontier-audit'
    && artifact.measuredRowCount === 0
    && artifact.evidenceKinds.length === 1
    && artifact.evidenceKinds.includes('SOURCE_FACT')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'target-distance-audit.json'
    && artifact.objective === 'target-distance-audit'
    && artifact.measuredRowCount === 0
    && artifact.evidenceKinds.length === 1
    && artifact.evidenceKinds.includes('SOURCE_FACT')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'text-materialization-boundary-audit.json'
    && artifact.objective === 'text-materialization-boundary-audit'
    && artifact.measuredRowCount === 0
    && artifact.evidenceKinds.length === 1
    && artifact.evidenceKinds.includes('SOURCE_FACT')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'candidate-headroom-cross-process-midsize-corpus.json'
    && artifact.measuredRowCount === 18
    && artifact.runtimes.includes('node-v8')
    && artifact.runtimes.includes('bun-jsc')
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'event-reader-byte-batch-cross-process-midsize-corpus.json'
    && artifact.measuredRowCount === 36
    && artifact.runtimes.includes('node-v8')
    && artifact.runtimes.includes('bun-jsc')
    && artifact.runtimes.includes('deno-v8')
  ));
  assert.equal(report.summary.measuredRowCount, 1253);
  assert.equal(report.summary.largeJsFullRowCount, 848);
  assert.deepEqual(
    {
      rows: report.summary.largeJsFullSourceInputSafety.rows,
      sourceModeRows: report.summary.largeJsFullSourceInputSafety.sourceModeRows,
      notFullArrayBufferRows: report.summary.largeJsFullSourceInputSafety.notFullArrayBufferRows,
      fullArrayBufferRows: report.summary.largeJsFullSourceInputSafety.fullArrayBufferRows,
      unknownArrayBufferRows: report.summary.largeJsFullSourceInputSafety.unknownArrayBufferRows,
      directReadableStreamRows: report.summary.largeJsFullSourceInputSafety.directReadableStreamRows,
      demandDrivenRows: report.summary.largeJsFullSourceInputSafety.demandDrivenRows,
    },
    {
      rows: 848,
      sourceModeRows: 474,
      notFullArrayBufferRows: 474,
      fullArrayBufferRows: 0,
      unknownArrayBufferRows: 0,
      directReadableStreamRows: 17,
      demandDrivenRows: 473,
    },
  );
  assert.ok(report.summary.largeJsFullSourceInputSafety.sourceModeBreakdown.some(entry =>
    entry.sourceMode === 'generated-sync-iterable-byte-batches'
    && entry.rows === 382
    && entry.notFullArrayBufferRows === 382
    && entry.directReadableStreamRows === 0
    && entry.fastestRow.id === 'rawFrameNameId'
    && entry.fastestRow.mibPerSec === 185.5
  ));
  assert.ok(report.summary.largeJsFullSourceInputSafety.sourceModeBreakdown.some(entry =>
    entry.sourceMode === 'file-backed-sync-iterable-byte-batches'
    && entry.rows === 53
    && entry.notFullArrayBufferRows === 53
    && entry.directReadableStreamRows === 0
    && entry.fastestRow.id === 'stax-raw-frame-name-id-batch-8'
    && entry.fastestRow.mibPerSec === 152.11
  ));
  assert.ok(report.summary.largeJsFullSourceInputSafety.sourceModeBreakdown.some(entry =>
    entry.sourceMode === 'web-readable-stream-pull'
    && entry.rows === 15
    && entry.directReadableStreamRows === 15
    && entry.notFullArrayBufferRows === 15
  ));
  assert.ok(report.summary.largeJsFullSourceInputSafety.sourceModeBreakdown.some(entry =>
    entry.sourceMode === 'complete-js-string'
    && entry.rows === 1
    && entry.demandDrivenRows === 0
  ));
  assert.equal(report.summary.rowClassificationCompleteness.unknownFullStringParityRows, 0);
  assert.equal(report.summary.rowClassificationCompleteness.unknownBoundedMemoryRows, 23);
  assert.deepEqual(report.summary.unknownBoundedMemoryBreakdown, {
    total: 23,
    jsRows: 7,
    fullStringRows: 20,
    jsFullStringRows: 4,
    largeJsFullStringRows: 0,
    counterexampleRelevantRows: 0,
    smallOrDiagnosticJsRows: 7,
    nonJsAllocatorCounterRows: 10,
    nonJsNoPeakMemoryRows: 6,
    rowsWithMemoryCounter: 10,
  });
  assert.equal(report.unknownBoundedMemoryRows.length, 23);
  assert.equal(report.unknownBoundedMemoryRows.filter(row => row.memoryKind === 'allocator-counters').length, 10);
  assert.ok(report.unknownBoundedMemoryRows
    .filter(row => row.sourceArtifact.startsWith('quick-xml-allocation-count'))
    .every(row => row.memoryKind === 'allocator-counters'));
  assert.ok(!report.unknownBoundedMemoryRows.some(row =>
    isJsRuntime(row.runtimeId)
    && row.fullStringParity === true
    && row.sizeGiB !== null
    && row.sizeGiB >= 0.999
  ));
  assertUnknownBoundedMemoryRow(report, 'browser-v8-codegen-trace.json', 'stringFull');
  assertNoUnknownBoundedMemoryRow(report, 'external-baseline-1024mib-file-sync-batches.json', 'woodstox');
  assertNoUnknownBoundedMemoryRow(report, 'external-baseline-1024mib-file-sync-batches.json', 'quick-xml');
  assertKnownBoundedMemoryRow(report, 'file-backed-trim-boundary-check-candidate.json', 'woodstox');
  assertKnownBoundedMemoryRow(report, 'file-backed-short-attr-value-cache-candidate.json', 'quick-xml');
  assertNoUnknownBoundedMemoryRow(report, 'external-baseline.json', 'stax-stream');
  assertNoUnknownBoundedMemoryRow(report, 'external-baseline.json', 'woodstox');
  assertNoUnknownBoundedMemoryRow(report, 'materialization-contract-audit.json', 'stax-stream');
  assertUnknownBoundedMemoryRow(report, 'quick-xml-allocation-count-stability.json', 'benchmark', 'allocator-counters');
  assertUnknownBoundedMemoryRow(report, 'quick-xml-allocation-count.json', 'benchmark', 'allocator-counters');
  assertUnknownBoundedMemoryRow(report, 'firefox-spidermonkey-diagnostic-dump-audit.json', 'rawFrameNameId');
  assert.equal(report.summary.corpusSeedCount, 4);
  assert.equal(report.summary.openObligationCount, 2);
  assert.equal(report.summary.benchmarkArtifactCount, 155);
  assert.equal(report.summary.sourceArtifactCount, 24);
  assert.equal(report.summary.traceArtifactCount, 15);
  assert.equal(report.summary.allocationArtifactCount, 16);
  assert.equal(report.summary.environmentArtifactCount, 4);
  assert.equal(report.summary.negativeArtifactCount, 24);
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'firefox-spidermonkey-js-shell-availability-audit.json'
    && artifact.evidenceKinds.includes('ENVIRONMENT_FACT')
    && !artifact.evidenceKinds.includes('NEGATIVE_RESULT')
    && artifact.outcome.status === 'available'
    && artifact.outcome.foundCount === 2
    && artifact.parameters.searchRoots.length === 2
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'firefox-spidermonkey-release-jsshell-availability-audit.json'
    && artifact.evidenceKinds.includes('ENVIRONMENT_FACT')
    && artifact.evidenceKinds.includes('NEGATIVE_RESULT')
    && artifact.outcome.status === 'available'
    && artifact.outcome.packageVerified === true
    && artifact.outcome.hasJitExecutionStatus === true
    && artifact.outcome.hasIrDumpSurface === false
    && artifact.outcome.hasNativeDisassemblySurface === false
    && artifact.outcome.nativeDumpComplete === false
    && artifact.outcome.canReadBinaryInput === true
    && artifact.outcome.canRunCurrentStaxFullStringBenchmark === false
    && artifact.outcome.closesEmittedIrObligation === false
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'firefox-spidermonkey-nightly-jsshell-availability-audit.json'
    && artifact.evidenceKinds.includes('ENVIRONMENT_FACT')
    && artifact.evidenceKinds.includes('NEGATIVE_RESULT')
    && artifact.outcome.status === 'available'
    && artifact.outcome.packageVerified === false
    && artifact.outcome.hasJitExecutionStatus === true
    && artifact.outcome.hasIrDumpSurface === false
    && artifact.outcome.hasNativeDisassemblySurface === false
    && artifact.outcome.nativeDumpComplete === false
    && artifact.outcome.canReadBinaryInput === true
    && artifact.outcome.canRunCurrentStaxFullStringBenchmark === false
    && artifact.outcome.closesEmittedIrObligation === false
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'concat-buffer-reuse-negative-result.json'
    && artifact.measuredRowCount === 0
    && artifact.evidenceKinds.includes('NEGATIVE_RESULT')
  ));

  const runtimeIds = report.coverage.runtimes.map(row => row.runtimeId);
  assert.ok(runtimeIds.includes('node-v8'));
  assert.ok(runtimeIds.includes('bun-jsc'));
  assert.ok(runtimeIds.includes('deno-v8'));
  assert.ok(runtimeIds.includes('chrome-v8-browser'));
  assert.ok(runtimeIds.includes('firefox-spidermonkey-browser'));
  assert.ok(runtimeIds.includes('safari-jsc-browser'));
  assert.ok(runtimeIds.includes('quick-xml-rust'));
  assert.ok(runtimeIds.includes('woodstox-jvm'));
  assert.ok(!runtimeIds.includes('unknown'));
  assert.ok(report.coverage.runtimes.find(row => row.runtimeId === 'node-v8').artifactCount >= 59);

  assert.equal(report.coverage.browser.chromeBenchmarkRows.length, 100);
  assert.equal(report.coverage.browser.firefoxBenchmarkRows.length, 82);
  assert.equal(report.coverage.browser.safariBenchmarkRows.length, 0);
  assert.equal(report.coverage.browser.nonV8BenchmarkRows.length, 82);
  assert.deepEqual(report.coverage.corpusSeeds, ['books.xml', 'large.xml', 'midsize.xml', 'treebank_e.xml']);
  assert.ok(report.coverage.sourcePins.some(pin =>
    pin.runtimeId === 'firefox-spidermonkey-browser'
    && pin.sourceArtifact === 'firefox-spidermonkey-textdecoder-source-pin-audit.json'
  ));
  assert.ok(report.coverage.sourcePins.some(pin =>
    pin.runtimeId === 'firefox-spidermonkey-browser'
    && pin.sourceArtifact === 'firefox-spidermonkey-string-source-pin-audit.json'
    && pin.kind === 'SpiderMonkey JS string source boundary'
  ));
  assert.ok(report.coverage.sourcePins.some(pin =>
    pin.runtimeId === 'firefox-spidermonkey-browser'
    && pin.sourceArtifact === 'firefox-spidermonkey-memory-api-source-pin-audit.json'
    && pin.kind === 'Firefox page memory API boundary'
  ));
  assert.ok(report.coverage.sourcePins.some(pin =>
    pin.runtimeId === 'firefox-spidermonkey-browser'
    && pin.sourceArtifact === 'firefox-spidermonkey-jitspew-source-pin-audit.json'
    && pin.kind === 'SpiderMonkey JitSpew source boundary'
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'deno-event-reader-byte-batch.json'
    && row.runtimes.includes('deno-v8')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'node-textdecoder-source-pin-audit.json'
    && row.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'projection-benchmark.json'
    && row.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'attribute-value-branch-order-candidate.json'
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.measuredRowCount === 0
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'attribute-value-index-accessor-candidate.json'
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.measuredRowCount === 0
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'attribute-value-public-fast-path-candidate.json'
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.measuredRowCount === 0
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'medium-ascii-decode-candidate.json'
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.measuredRowCount === 0
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'deno-event-reader-byte-batch-corpus.json'
    && row.runtimes.includes('deno-v8')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'event-reader-byte-batch-cross-process-corpus.json'
    && row.runtimes.includes('node-v8')
    && row.runtimes.includes('bun-jsc')
    && row.runtimes.includes('deno-v8')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'event-reader-byte-batch-cross-process-midsize-corpus.json'
    && row.runtimes.includes('node-v8')
    && row.runtimes.includes('bun-jsc')
    && row.runtimes.includes('deno-v8')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'external-baseline-1024mib-file-sync-batches.json'
    && row.runtimes.includes('node-v8')
    && row.runtimes.includes('woodstox-jvm')
    && row.runtimes.includes('quick-xml-rust')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'external-baseline-treebank-wrapper-1024mib-file-sync-batches.json'
    && row.runtimes.includes('node-v8')
    && row.runtimes.includes('woodstox-jvm')
    && row.runtimes.includes('quick-xml-rust')
    && row.measuredRowCount === 4
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'external-baseline-1024mib-file-sync-batches-split-singletons.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 2
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'woodstox-measured-jfr-allocation-rerun.json'
    && row.runtimes.includes('woodstox-jvm')
    && row.evidenceKinds.includes('ALLOCATION_FACT')
    && row.measuredRowCount === 1
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'quick-xml-encoding-surface-audit.json'
    && row.runtimes.includes('quick-xml-rust')
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.measuredRowCount === 0
  ));
  assert.ok(report.coverage.spiderMonkeyDiagnostics.rows.some(row =>
    row.id === 'official-jsshell-stax-api-gap'
    && row.sourceArtifact === 'firefox-spidermonkey-jsshell-stax-api-gap-audit.json'
    && row.status === 'blocked-by-host-api-surface'
    && row.evidenceClass === 'host-api-surface-gap'
    && row.hasJitExecutionStatus === true
    && row.canReadBinaryInput === true
    && row.canRunCurrentStaxFullStringBenchmark === false
    && row.closesEmittedIrObligation === false
    && row.commonMissingGlobals.join(', ') === 'TextDecoder, TextEncoder, ReadableStream, fetch'
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'quick-xml-allocation-count-stability.json'
    && row.runtimes.includes('quick-xml-rust')
    && row.evidenceKinds.includes('ALLOCATION_FACT')
    && row.measuredRowCount === 5
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'file-backed-fold-trim-candidate.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 2
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'file-backed-string-cache-candidate.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 2
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'file-backed-source-sweep.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 12
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'file-backed-core-decomposition.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 5
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'file-backed-batch-size-sweep.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 14
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'file-backed-materialization-category-drop-sweep.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 5
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'file-backed-public-consumer-shape-sweep.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 5
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'file-backed-v8-codegen-trace.json'
    && row.runtimes.includes('node-v8')
    && row.evidenceKinds.includes('TRACE_FACT')
    && row.measuredRowCount === 0
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'stream-source-consumption-shapes.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 27
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'unrolled-medium-ascii-text-cross-process-books-corpus.json'
    && row.runtimes.includes('node-v8')
    && row.runtimes.includes('bun-jsc')
    && row.measuredRowCount === 18
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'materialization-span-distribution-books-corpus.json'
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.evidenceKinds.includes('SCOPE_GUARD')
    && row.measuredRowCount === 0
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'materialization-span-distribution-large-corpus.json'
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.evidenceKinds.includes('SCOPE_GUARD')
    && row.measuredRowCount === 0
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'materialization-span-distribution-treebank-corpus.json'
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.evidenceKinds.includes('SCOPE_GUARD')
    && row.measuredRowCount === 0
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'segment-scan-headroom.json'
    && row.runtimes.includes('node-v8')
    && row.evidenceKinds.includes('BENCH_FACT')
    && row.evidenceKinds.includes('SCOPE_GUARD')
    && row.measuredRowCount === 3
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'segment-tokenizer-headroom.json'
    && row.runtimes.includes('node-v8')
    && row.evidenceKinds.includes('BENCH_FACT')
    && row.evidenceKinds.includes('SCOPE_GUARD')
    && row.measuredRowCount === 3
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'segment-tokenizer-string-frontier.json'
    && row.runtimes.includes('node-v8')
    && row.evidenceKinds.includes('BENCH_FACT')
    && row.evidenceKinds.includes('SCOPE_GUARD')
    && row.measuredRowCount === 10
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'stream-reader-4gb-shapes.json'
    && row.runtimes.includes('node-v8')
    && !row.runtimes.includes('unknown')
    && row.evidenceKinds.includes('BENCH_FACT')
    && row.measuredRowCount === 3
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'node-v8'
    && row.measuredRowCount === 589
    && row.largeFullStringRowCount === 407
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'bun-jsc'
    && row.measuredRowCount === 319
    && row.largeFullStringRowCount === 209
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'deno-v8'
    && row.artifactCount === 17
    && row.measuredRowCount === 128
    && row.largeFullStringRowCount === 104
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'deno-v8-codegen-trace-midsize-corpus.json'
    && row.runtimes.includes('deno-v8')
    && row.evidenceKinds.includes('TRACE_FACT')
    && row.measuredRowCount === 0
    && row.fixture.source === 'corpus-file'
    && row.fixture.sourceFile.endsWith('midsize.xml')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'deno-candidate-headroom-cross-process-books-corpus.json'
    && row.runtimes.includes('deno-v8')
    && row.evidenceKinds.includes('BENCH_FACT')
    && row.measuredRowCount === 15
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'deno-candidate-headroom-cross-process-midsize-corpus.json'
    && row.runtimes.includes('deno-v8')
    && row.evidenceKinds.includes('BENCH_FACT')
    && row.measuredRowCount === 9
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'deno-v8-allocation-sampling-midsize-corpus.json'
    && row.runtimes.includes('deno-v8')
    && row.evidenceKinds.includes('ALLOCATION_FACT')
    && row.measuredRowCount === 0
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'medium-ascii-text-materialization-candidate.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 3
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'medium-ascii-attr-value-materialization-candidate.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 4
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'no-counter-medium-ascii-text-cross-process-books-corpus-warmup.json'
    && row.runtimes.includes('node-v8')
    && row.runtimes.includes('bun-jsc')
    && row.measuredRowCount === 24
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'file-backed-short-attr-value-cache-candidate.json'
    && row.runtimes.includes('node-v8')
    && row.runtimes.includes('woodstox-jvm')
    && row.runtimes.includes('quick-xml-rust')
    && row.measuredRowCount === 4
  ));
  assert.ok(!report.coverage.runtimes.some(row => row.runtimeId === 'unknown'));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'file-backed-trim-boundary-check-candidate.json'
    && row.runtimes.includes('node-v8')
    && row.runtimes.includes('woodstox-jvm')
    && row.runtimes.includes('quick-xml-rust')
    && row.measuredRowCount === 4
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'candidate-headroom-cross-process-books-corpus-partial.json'
    && row.runtimes.includes('node-v8')
    && row.runtimes.includes('bun-jsc')
    && row.measuredRowCount === 24
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'candidate-headroom-cross-process-books-corpus-batch16.json'
    && row.runtimes.includes('node-v8')
    && row.runtimes.includes('bun-jsc')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'access-shape-candidate-stability.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 3
  ));
  assert.ok(report.ignoredArtifacts.includes('access-shape-candidate-cross-process.json'));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'access-shape-rerun-cross-process-books-corpus.json'
    && row.runtimes.includes('node-v8')
    && row.runtimes.includes('bun-jsc')
    && row.measuredRowCount === 18
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'raw-frame-nameid-alone-cross-process-books-corpus.json'
    && row.runtimes.includes('node-v8')
    && row.runtimes.includes('bun-jsc')
    && row.measuredRowCount === 6
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'access-shape-candidate-cross-process-batch8.json'
    && row.runtimes.includes('node-v8')
    && row.runtimes.includes('bun-jsc')
    && row.measuredRowCount === 12
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'multi-chunk-batch-shape-audit.json'
    && row.evidenceKinds.includes('SOURCE_FACT')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'raw-batch-kind-shape-audit.json'
    && row.evidenceKinds.includes('SOURCE_FACT')
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.measuredRowCount === 0
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'raw-span-shape-audit.json'
    && row.evidenceKinds.includes('SOURCE_FACT')
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.evidenceKinds.includes('SCOPE_GUARD')
    && row.measuredRowCount === 0
    && row.runtimes.includes('node-v8')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'stax-event-public-object-shape-audit.json'
    && row.evidenceKinds.includes('SOURCE_FACT')
    && row.measuredRowCount === 0
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'materialization-category-drop-sweep.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 6
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'fold-trimmed-text-candidate-stability.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 2
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'long-ascii-text-materialization-candidate.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 4
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'long-ascii-text-materialization-candidate-stability.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 4
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'text-cache-materialization-candidate.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 5
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'text-cache-materialization-candidate-stability.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 2
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'text-cdata-cost-decomposition.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 4
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'text-trim-cost-decomposition.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 4
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'text-trim-cost-decomposition-2gib.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 4
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'text-trim-cost-decomposition-4gib.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 3
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'text-trim-cost-decomposition-8gib.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 3
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'text-materialization-frontier.json'
    && row.evidenceKinds.includes('BENCH_FACT')
    && row.evidenceKinds.includes('HEADROOM_EVIDENCE_PRESENT')
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.evidenceKinds.includes('SCOPE_GUARD')
    && row.measuredRowCount === 0
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'text-trim-guard-candidate.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 2
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'text-ascii-pretrim-candidate.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 2
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'all-ascii-span-materialization-candidate.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 2
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'name-collision-safe-interning-perf.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 3
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'sync-byte-batch-shape-batch1.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 3
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'sync-byte-batch-shape-batch16.json'
    && row.runtimes.includes('node-v8')
    && row.measuredRowCount === 3
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'browser-fetch-readable-stream-books-corpus.json'
    && row.runtimes.includes('chrome-v8-browser')
    && row.measuredRowCount === 3
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'firefox-fetch-readable-stream-timeout-audit.json'
    && row.runtimes.includes('firefox-spidermonkey-browser')
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.measuredRowCount === 0
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'firefox-spidermonkey-diagnostic-dump-audit.json'
    && row.runtimes.includes('firefox-spidermonkey-browser')
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.measuredRowCount === 1
    && row.outcome.status === 'no-dump-emitted'
    && row.outcome.dumpFileCount === 0
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'firefox-spidermonkey-js-shell-availability-audit.json'
    && row.runtimes.includes('firefox-spidermonkey-browser')
    && row.evidenceKinds.includes('ENVIRONMENT_FACT')
    && !row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.measuredRowCount === 0
    && row.outcome.status === 'available'
    && row.outcome.foundCount === 2
    && row.parameters.searchRoots.length === 2
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'firefox-spidermonkey-buildconfig-source-pin-audit.json'
    && row.runtimes.includes('firefox-spidermonkey-browser')
    && row.evidenceKinds.includes('SOURCE_FACT')
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.measuredRowCount === 0
  ));
  assert.ok(report.coverage.sourcePins.some(pin =>
    pin.runtimeId === 'firefox-spidermonkey-browser'
    && pin.sourceArtifact === 'firefox-spidermonkey-buildconfig-source-pin-audit.json'
    && pin.kind === 'Firefox installed buildconfig JitSpew boundary'
    && /enableJitSpew=false/.test(pin.limitation)
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'materialization-contract-audit.json'
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'deno-textdecoder-source-pin-audit.json'
    && row.runtimes.includes('deno-v8')
  ));
  assert.ok(report.coverage.sourcePins.some(pin =>
    pin.runtimeId === 'deno-v8'
    && pin.sourceArtifact === 'deno-textdecoder-source-pin-audit.json'
    && pin.kind === 'Deno TextDecoder source boundary'
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'deno-textdecoder-span-variants.json'
    && row.runtimes.includes('deno-v8')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'deno-textdecoder-span-variants-corpus.json'
    && row.runtimes.includes('deno-v8')
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'bun-jsc'
    && row.allocationArtifacts.includes('bun-jsc-memory-allocation-profile.json')
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'bun-jsc'
    && row.traceArtifacts.includes('bun-jsc-codegen-trace.json')
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'chrome-v8-browser'
    && row.traceArtifacts.includes('browser-v8-codegen-trace.json')
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'deno-v8'
    && row.traceArtifacts.includes('deno-v8-codegen-trace.json')
    && row.traceArtifacts.includes('deno-v8-codegen-trace-midsize-corpus.json')
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'deno-v8'
    && row.allocationArtifacts.includes('deno-v8-allocation-sampling.json')
    && row.allocationArtifacts.includes('deno-v8-allocation-sampling-midsize-corpus.json')
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'node-v8'
    && row.traceArtifacts.includes('file-backed-v8-codegen-trace.json')
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'firefox-spidermonkey-browser'
    && row.allocationArtifacts.includes('firefox-spidermonkey-allocation-profile.json')
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'firefox-spidermonkey-browser'
    && row.traceArtifacts.includes('firefox-spidermonkey-profiler-trace.json')
  ));
  assert.ok(report.coverage.environmentArtifacts.some(row =>
    row.sourceArtifact === 'safari-webkit-availability-audit.json'
    && row.runtimes.includes('safari-jsc-browser')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'safari-webkit-availability-audit.json'
    && row.availability?.hostIsMacOS === false
    && row.availability?.safariExecutableFound === false
    && row.availability?.safaridriverFound === false
    && row.availability?.currentHarnessSupportsSafari === true
    && row.availability?.canRunSafariBrowserRows === false
    && row.availability?.safariBenchmarkRowsRecorded === false
    && row.availability?.exactSafariBuildIdentityRecorded === false
    && row.availability?.safariSourceBoundaryPinned === false
    && row.availability?.primarySyncByteBatchRowsRecorded === false
    && row.availability?.boundedPrimarySyncByteBatchRowsRecorded === false
    && row.availability?.directReadableStreamRowsAreSeparateEvidence === true
    && row.availability?.closureRequirementsMet === 2
    && row.availability?.closureRequirementsBlocked === 9
    && row.availability?.closesSafariObligation === false
    && row.availability?.openObligationRemains === true
  ));
  assert.deepEqual(report.coverage.safariWebKitStatus, {
    availabilityArtifact: 'safari-webkit-availability-audit.json',
    hostIsMacOS: false,
    safariExecutableFound: false,
    safaridriverFound: false,
    harnessSupportsSafari: true,
    canRunSafariBrowserRows: false,
    benchmarkRowsRecorded: 0,
    availabilitySaysRowsRecorded: false,
    availabilityExactBuildIdentityRecorded: false,
    measuredExactBuildIdentityRowsRecorded: 0,
    largeBoundedPrimarySyncByteBatchRowsWithMeasuredExactBuildIdentity: 0,
    exactBuildIdentityRecorded: false,
    sourceBoundaryPinned: false,
    availabilityPrimarySyncByteBatchRowsRecorded: false,
    availabilityBoundedPrimarySyncByteBatchRowsRecorded: false,
    directReadableStreamRowsAreSeparateEvidence: true,
    availabilityClosureRequirementsMet: 2,
    availabilityClosureRequirementsBlocked: 9,
    availabilityClosesSafariObligation: false,
    openObligationRemains: true,
    fullStringRowsRecorded: 0,
    directReadableStreamFullStringRowsRecorded: 0,
    primarySyncByteBatchRowsRecorded: 0,
    boundedPrimarySyncByteBatchRowsRecorded: 0,
    largeBoundedPrimarySyncByteBatchRowsRecorded: 0,
    boundedPrimarySyncByteBatchRowsInSameContractComparison: 0,
    largeBoundedPrimarySyncByteBatchRowsInSameContractComparison: 0,
    primaryRowsInSameContractComparison: false,
    largePrimaryRowsInSameContractComparison: false,
    evidenceClass: 'environment-availability-only',
    closesSafariObligation: false,
  });
  assert.equal(report.coverage.spiderMonkeyDiagnostics.emittedIrEvidenceCount, 0);
  assert.equal(report.coverage.spiderMonkeyDiagnostics.jitStatusOnlyCount, 2);
  assert.equal(report.coverage.spiderMonkeyDiagnostics.missingIrSurfaceCount, 2);
  assert.deepEqual(report.coverage.spiderMonkeyDiagnostics.selectedRowIdentityStatusCounts, {
    'not-claimed': 4,
    'not-claimed-non-stax-diagnostic': 7,
  });
  assert.ok(report.coverage.spiderMonkeyDiagnostics.rows.some(row =>
    row.id === 'official-release-jsshell'
    && row.status === 'available'
    && row.packageVerified === true
    && row.hasJitExecutionStatus === true
    && row.irDumpSurface === false
    && row.bytecodeDumpOutput === false
    && row.bytecodeDumpStatus === 'no-bytecode-output'
    && row.bytecodeDumpMarkers === 0
    && row.nativeDumpComplete === false
    && row.canReadBinaryInput === true
    && row.canRunCurrentStaxFullStringBenchmark === false
    && row.closesEmittedIrObligation === false
    && row.evidenceClass === 'jit-status-only'
  ));
  assert.ok(report.coverage.spiderMonkeyDiagnostics.rows.some(row =>
    row.id === 'official-nightly-jsshell'
    && row.status === 'available'
    && row.packageVerified === false
    && row.hasJitExecutionStatus === true
    && row.irDumpSurface === false
    && row.bytecodeDumpOutput === false
    && row.bytecodeDumpStatus === 'no-bytecode-output'
    && row.bytecodeDumpMarkers === 0
    && row.nativeDumpComplete === false
    && row.canReadBinaryInput === true
    && row.canRunCurrentStaxFullStringBenchmark === false
    && row.closesEmittedIrObligation === false
    && row.evidenceClass === 'jit-status-only'
  ));
  assert.ok(report.coverage.spiderMonkeyDiagnostics.rows.some(row =>
    row.id === 'installed-browser-diagnostic-dump'
    && row.status === 'no-dump-emitted'
    && row.dumpFileCount === 0
    && row.closesEmittedIrObligation === false
  ));

  assertObligation(report, 'firefox-browser-rows-open', 'covered');
  assertObligation(report, 'safari-jsc-source-and-browser-rows-open', 'open');
  assertObligation(report, 'codegen-traces-open', 'partial');
  assertObligation(report, 'allocation-profiles-open', 'covered');
  assertObligation(report, 'non-v8-browser-coverage-open', 'covered');
  assertObligation(report, 'independent-corpus-suite-open', 'covered');
  assertObligation(report, 'counterexample-rule-present', 'covered');

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Runtime Proof Coverage Audit/);
  assert.match(markdown, /## Unknown Bounded-Memory Rows/);
  assert.match(markdown, /remaining unknowns are auditable/);
  assert.match(markdown, /Unknown bounded-memory counterexample-relevant rows: 0/);
  assert.match(markdown, /Unknown bounded-memory small\/diagnostic JS rows: 7/);
  assert.match(markdown, /Unknown bounded-memory non-JS allocator-counter rows: 10/);
  assert.match(markdown, /Unknown bounded-memory non-JS rows without peak-memory counters: 6/);
  assert.match(markdown, /not an impossibility proof/);
  assert.match(markdown, /1 GiB\+ JS full-string source-mode rows not using full ArrayBuffer parser input: 474\/474/);
  assert.match(markdown, /1 GiB\+ JS full-string separate direct ReadableStream source-overhead rows: 17/);
  assert.match(markdown, /## Source Input Safety/);
  assert.match(markdown, /Direct ReadableStream rows remain source-overhead evidence/);
  assert.match(markdown, /\| `generated-sync-iterable-byte-batches` \| 382 \| 382 \| 0 \| 0 \| 0 \| 382 \| rawFrameNameId 185\.50 MiB\/s from text-trim-cost-decomposition\.json \|/);
  assert.match(markdown, /\| `file-backed-sync-iterable-byte-batches` \| 53 \| 53 \| 0 \| 0 \| 0 \| 53 \| stax-raw-frame-name-id-batch-8 152\.11 MiB\/s from file-backed-batch-size-sweep\.json \|/);
  assert.match(markdown, /\| `web-readable-stream-pull` \| 15 \| 15 \| 0 \| 0 \| 15 \| 15 \| web-readable-stream-raw-frame-ascii-batch-8 77\.86 MiB\/s from stream-source-consumption-shapes\.json \|/);
  assert.match(markdown, /\| `complete-js-string` \| 1 \| 1 \| 0 \| 0 \| 0 \| 0 \| 3 41\.10 MiB\/s from bun-event-reader-string-large\.json \|/);
  assert.match(markdown, /82 Firefox\/SpiderMonkey browser benchmark rows found/);
  assert.match(markdown, /Firefox benchmark rows and exact tested-build JS string, TextDecoder, and page memory API source pins are now present/);
  assert.match(markdown, /no Safari\/WebKit browser benchmark row was found/);
  assert.match(markdown, /Local Safari\/WebKit availability audit is present/);
  assert.match(markdown, /Run same-contract Safari\/WebKit rows on a macOS host/);
  assert.match(markdown, /Bun\/JSC evidence is not Safari\/browser JSC evidence/);
  assert.match(markdown, /## Safari\/WebKit Browser Row Status/);
  assert.match(markdown, /Safari\/WebKit evidence class: environment-availability-only/);
  assert.match(markdown, /Safari\/WebKit availability closure requirements: met=2, blocked=9/);
  assert.match(markdown, /Safari\/WebKit direct ReadableStream rows separate: yes/);
  assert.match(markdown, /Safari\/WebKit primary rows in same-contract comparison: no/);
  assert.match(markdown, /Safari\/WebKit obligation closed: no/);
  assert.match(markdown, /Safari\/WebKit 1 GiB\+ bounded primary rows in same-contract comparison: no/);
  assert.match(markdown, /\| `safari-webkit-availability-audit\.json` \| no \| no \| no \| yes \| no \| 0 \| 0 \| 0 \| 0 \| 0 \| 0 \| 0 \| no \| no \|/);
  assert.match(markdown, /Bun\/JSC allocation evidence present/);
  assert.match(markdown, /Bun\/JSC codegen\/IR evidence present/);
  assert.match(markdown, /Chrome\/V8 browser codegen trace evidence present/);
  assert.match(markdown, /Deno\/V8 codegen trace evidence present \(2 artifacts\)/);
  assert.match(markdown, /## SpiderMonkey Diagnostic Surface/);
  assert.match(markdown, /Emitted SpiderMonkey IR\/codegen evidence artifacts: 0/);
  assert.match(markdown, /Raw SpiderMonkey emitted-IR closure claims: 0/);
  assert.match(markdown, /SpiderMonkey selected row identity statuses: not-claimed=4, not-claimed-non-stax-diagnostic=7/);
  assert.match(markdown, /Selected row identity/);
  assert.match(markdown, /Selected row metadata/);
  assert.match(markdown, /Comparison match/);
  assert.match(markdown, /Closure qualified/);
  assert.match(markdown, /JIT-status-only SpiderMonkey shell artifacts: 2/);
  assert.match(markdown, /\| `official-release-jsshell` \| `firefox-spidermonkey-release-jsshell-availability-audit\.json` \| available \| jit-status-only \| yes \| no \| no \(no-bytecode-output, markers=0\) \| no \| no \| not-claimed-non-stax-diagnostic \| no \| unknown \| no \|/);
  assert.match(markdown, /\| `official-nightly-jsshell` \| `firefox-spidermonkey-nightly-jsshell-availability-audit\.json` \| available \| jit-status-only \| yes \| no \| no \(no-bytecode-output, markers=0\) \| no \| no \| not-claimed-non-stax-diagnostic \| no \| unknown \| no \|/);
  assert.match(markdown, /\| `official-jsshell-diagnostic-flag-sweep` \| `spidermonkey-jsshell-diagnostic-flag-sweep\.json` \| available \| diagnostic-flag-sweep-negative \| unknown \| unknown \| no \(unknown, markers=unknown\) \| unknown \| unknown \| not-claimed \| no \| unknown \| no \|/);
  assert.match(markdown, /\| `taskcluster-debug-jsshell-codegen` \| `spidermonkey-taskcluster-debug-jsshell-codegen-audit\.json` \| available \| current-debug-codegen-scope-guard \| unknown \| yes \| unknown \| yes \| no \| not-claimed-non-stax-diagnostic \| no \| unknown \| no \|/);
  assert.match(markdown, /\| `taskcluster-debug-jsshell-xml-codegen` \| `spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit\.json` \| available \| current-debug-xml-codegen-scope-guard \| unknown \| yes \| unknown \| yes \| no \| not-claimed-non-stax-diagnostic \| no \| unknown \| no \|/);
  assert.match(markdown, /\| `taskcluster-debug-jsshell-materialized-codegen` \| `spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit\.json` \| available \| current-debug-materialized-codegen-scope-guard \| unknown \| yes \| unknown \| yes \| no \| not-claimed-non-stax-diagnostic \| no \| unknown \| no \|/);
  assert.match(markdown, /\| `archival-debug-jsshell-codegen` \| `spidermonkey-archival-debug-jsshell-codegen-audit\.json` \| available \| archival-codegen-scope-guard \| unknown \| yes \| unknown \| yes \| no \| not-claimed-non-stax-diagnostic \| no \| unknown \| no \|/);
  const flagSweep = report.coverage.spiderMonkeyDiagnostics.rows.find(row => row.id === 'official-jsshell-diagnostic-flag-sweep');
  assert.equal(flagSweep.evidenceClass, 'diagnostic-flag-sweep-negative');
  assert.equal(flagSweep.bytecodeProbeCount, 4);
  assert.equal(flagSweep.bytecodeOutputProbeCount, 0);
  assert.equal(flagSweep.hasDiagnosticPrefSurface, false);
  const taskclusterDebug = report.coverage.spiderMonkeyDiagnostics.rows.find(row => row.id === 'taskcluster-debug-jsshell-codegen');
  assert.equal(taskclusterDebug.evidenceClass, 'current-debug-codegen-scope-guard');
  assert.equal(taskclusterDebug.irDumpSurface, true);
  assert.equal(taskclusterDebug.nativeDumpComplete, true);
  assert.equal(taskclusterDebug.sameContractStaxRow, false);
  assert.equal(taskclusterDebug.canRunCurrentStaxFullStringBenchmark, false);
  assert.equal(taskclusterDebug.closesEmittedIrObligation, false);
  assert.equal(taskclusterDebug.taskId, 'bzK0wWZvQoOguMjTIbRJ_g');
  assert.equal(taskclusterDebug.buildId, '20260531212007');
  assert.equal(taskclusterDebug.sourceRevision, '71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7');
  const taskclusterXmlDebug = report.coverage.spiderMonkeyDiagnostics.rows.find(row => row.id === 'taskcluster-debug-jsshell-xml-codegen');
  assert.equal(taskclusterXmlDebug.evidenceClass, 'current-debug-xml-codegen-scope-guard');
  assert.equal(taskclusterXmlDebug.irDumpSurface, true);
  assert.equal(taskclusterXmlDebug.nativeDumpComplete, true);
  assert.equal(taskclusterXmlDebug.sameContractStaxRow, false);
  assert.equal(taskclusterXmlDebug.canRunCurrentStaxFullStringBenchmark, false);
  assert.equal(taskclusterXmlDebug.closesEmittedIrObligation, false);
  assert.equal(taskclusterXmlDebug.taskId, 'bzK0wWZvQoOguMjTIbRJ_g');
  assert.equal(taskclusterXmlDebug.buildId, '20260531212007');
  assert.equal(taskclusterXmlDebug.sourceRevision, '71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7');
  const taskclusterMaterializedDebug = report.coverage.spiderMonkeyDiagnostics.rows.find(row => row.id === 'taskcluster-debug-jsshell-materialized-codegen');
  assert.equal(taskclusterMaterializedDebug.evidenceClass, 'current-debug-materialized-codegen-scope-guard');
  assert.equal(taskclusterMaterializedDebug.irDumpSurface, true);
  assert.equal(taskclusterMaterializedDebug.nativeDumpComplete, true);
  assert.equal(taskclusterMaterializedDebug.sameContractStaxRow, false);
  assert.equal(taskclusterMaterializedDebug.canRunCurrentStaxFullStringBenchmark, false);
  assert.equal(taskclusterMaterializedDebug.closesEmittedIrObligation, false);
  assert.equal(taskclusterMaterializedDebug.taskId, 'bzK0wWZvQoOguMjTIbRJ_g');
  assert.equal(taskclusterMaterializedDebug.buildId, '20260531212007');
  assert.equal(taskclusterMaterializedDebug.sourceRevision, '71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7');
  const archival = report.coverage.spiderMonkeyDiagnostics.rows.find(row => row.id === 'archival-debug-jsshell-codegen');
  assert.equal(archival.evidenceClass, 'archival-codegen-scope-guard');
  assert.equal(archival.irDumpSurface, true);
  assert.equal(archival.nativeDumpComplete, true);
  assert.equal(archival.closesEmittedIrObligation, false);
  assert.match(markdown, /Firefox\/SpiderMonkey Gecko Profiler trace evidence present/);
  assert.match(markdown, /Firefox\/SpiderMonkey JitSpew\/IONFLAGS source gate evidence present, but it is not emitted JIT IR/);
  assert.match(markdown, /Firefox\/SpiderMonkey installed buildconfig source pin present \(buildconfig source pin only; enableJitSpew=false, enableJsShell=true, mozPackageJsShell=true\)/);
  assert.match(markdown, /Firefox\/SpiderMonkey diagnostic dump audit was attempted and emitted no JIT diagnostic dump from this installed browser build \(status=no-dump-emitted, dumpFiles=0\)/);
  assert.match(markdown, /Firefox\/SpiderMonkey local js-shell availability audit present \(status=available, found=2, searchRoots=2\); no emitted JIT IR is recorded by that audit/);
  assert.match(markdown, /Firefox\/SpiderMonkey official release js-shell audit present \(status=available, packageVerified=true, jitStatus=true, irDumpSurface=false, bytecodeDumpOutput=false, bytecodeDumpStatus=no-bytecode-output, nativeDisassemblySurface=false, nativeDumpComplete=false, canReadBinaryInput=true, canRunCurrentStaxFullStringBenchmark=false\); it is JIT-status evidence only, not emitted JIT IR/);
  assert.match(markdown, /Firefox\/SpiderMonkey official nightly js-shell audit present \(status=available, packageVerified=false, jitStatus=true, irDumpSurface=false, bytecodeDumpOutput=false, bytecodeDumpStatus=no-bytecode-output, nativeDisassemblySurface=false, nativeDumpComplete=false, canReadBinaryInput=true, canRunCurrentStaxFullStringBenchmark=false\); it is JIT-status evidence only, not emitted JIT IR/);
  assert.match(markdown, /\| `official-jsshell-stax-api-gap` \| `firefox-spidermonkey-jsshell-stax-api-gap-audit\.json` \| blocked-by-host-api-surface \| host-api-surface-gap \| yes \| unknown \| unknown \| unknown \| no \| not-claimed-non-stax-diagnostic \| no \| unknown \| no \|/);
  assert.match(markdown, /Firefox\/SpiderMonkey js-shell StAX API gap audit present \(status=blocked-by-host-api-surface, unchangedRunnableShells=0\/2, blockedSurfaces=5, commonMissingGlobals=TextDecoder, TextEncoder, ReadableStream, fetch\); it is host API surface evidence only, not emitted JIT IR/);
  assert.match(markdown, /Firefox\/SpiderMonkey public js-shell diagnostic flag sweep present \(bytecodeProbes=4, bytecodeOutputProbes=0, diagnosticPrefSurface=false\); it rules out easy public-shell bytecode\/dump flag paths but is not emitted JIT IR/);
  assert.match(markdown, /Firefox\/SpiderMonkey current Taskcluster debug js-shell codegen audit present \(taskId=bzK0wWZvQoOguMjTIbRJ_g, buildId=20260531212007, sourceRevision=71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7, codegenDump=true, sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=false, selectedRowIdentityStatus=not-claimed-non-stax-diagnostic\); it proves a current diagnostic shell path but is not emitted codegen for a same-contract StAX row/);
  assert.match(markdown, /Firefox\/SpiderMonkey current Taskcluster debug js-shell XML workload codegen audit present \(taskId=bzK0wWZvQoOguMjTIbRJ_g, buildId=20260531212007, sourceRevision=71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7, codegenDump=true, sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=false, selectedRowIdentityStatus=not-claimed-non-stax-diagnostic\); it ties the current diagnostic shell to an XML byte-tokenizer workload but is still not emitted codegen for a same-contract full-string StAX row/);
  assert.match(markdown, /Firefox\/SpiderMonkey current Taskcluster debug js-shell materialized string\/object codegen audit present \(taskId=bzK0wWZvQoOguMjTIbRJ_g, buildId=20260531212007, sourceRevision=71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7, codegenDump=true, sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=false, selectedRowIdentityStatus=not-claimed-non-stax-diagnostic\); it ties the current diagnostic shell to JS string and event-object materialization but is still not the unchanged full-string StAX benchmark/);
  assert.match(markdown, /Firefox\/SpiderMonkey materialized scope-distance audit present \(semanticEquivalentForAsciiFields=true, closureRequirementsMet=2, closureRequirementsBlocked=4, primarySyncByteBatchMissingGlobals=TextDecoder, asciiTextDecoderEquivalent=true, diagnosticThroughputMiBPerSec=0\.4909373604499916, throughputCountsAsTargetEvidence=false, closesCodegenObligation=false\); it records why the materialized js-shell codegen artifact is useful but still not closure evidence/);
  assert.match(markdown, /Firefox\/SpiderMonkey emitted JIT IR or optimized-code dump evidence missing/);
  assert.match(markdown, /16 allocation\/profile artifacts found/);
  assert.match(markdown, /Environment artifacts: 4/);
  assert.match(markdown, /Source artifacts: 24/);
  assert.match(markdown, /Scanned primary artifacts: 217/);
  assert.equal(report.summary.traceArtifactCount, 15);
  assert.match(markdown, /Negative-result artifacts: 24/);
  assert.match(markdown, /\| Node\/V8 \| 111 \| 589 \| 407 \|/);
  assert.match(markdown, /\| Bun\/JSC \| 41 \| 319 \| 209 \|/);
  assert.match(markdown, /\| Deno\/V8 \| 17 \| 128 \| 104 \|/);
  assert.match(markdown, /\| Firefox\/SpiderMonkey browser \| 23 \| 82 \| 70 \|/);
  assert.match(markdown, /\| Java\/Woodstox \| 12 \| 13 \| 5 \|/);
  assert.match(markdown, /\| Rust\/quick-xml \| 11 \| 19 \| 5 \|/);
  assert.doesNotMatch(markdown, /\| unknown \| \d+ \| \d+ \| \d+ \|/);
  assert.match(markdown, /Non-V8 browser allocation evidence present/);
  assert.match(markdown, /Non-V8 browser benchmark rows: 82/);
  assert.match(markdown, /Current release corpus seeds: `books\.xml`, `large\.xml`, `midsize\.xml`, `treebank_e\.xml`/);
  assert.match(markdown, /2 proof obligation\(s\) remain open or partial/);
  assert.match(markdown, /Missing evidence is not evidence that optimization is impossible/);
});

test('runtime proof coverage audit does not close Safari on rows alone', () => {
  const syntheticDir = join(tmpDir, 'safari-row-without-closure');
  const syntheticJsonOut = join(tmpDir, 'safari-row-without-closure.json');
  const syntheticMdOut = join(tmpDir, 'safari-row-without-closure.md');
  resetTmp();
  mkdirSync(syntheticDir, { recursive: true });
  writeFileSync(join(syntheticDir, 'safari-webkit-availability-audit.json'), `${JSON.stringify({
    objective: 'safari-webkit-availability-audit',
    summary: {
      hostIsMacOS: true,
      safariExecutableFound: true,
      safaridriverFound: true,
      currentHarnessSupportsSafari: true,
      canRunSafariBrowserRows: true,
      safariBenchmarkRowsRecorded: true,
      exactSafariBuildIdentityRecorded: false,
      safariSourceBoundaryPinned: false,
      openObligationRemains: true,
    },
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'safari-synthetic-browser-row.json'), `${JSON.stringify({
    objective: 'safari-synthetic-browser-row',
    contract: 'same-full-string-checksum-contract',
    environment: {
      runtimeName: 'browser',
      browserName: 'Safari',
      browserVersion: '18.5',
      javascriptEngine: 'JavaScriptCore',
      userAgent: 'Mozilla/5.0 Version/18.5 Safari/605.1.15',
    },
    fixture: {
      source: 'corpus-file',
      sourceFile: 'books.xml',
      sizeGiB: 1,
    },
    rows: [
      {
        id: 'safariFullString',
        mibPerSec: 150,
        fullStringParity: true,
        boundedMemory: true,
        eventCount: 1,
        checksum: 1,
        contractScope: 'full-string-checksum',
      },
    ],
  }, null, 2)}\n`);
  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--release-dir',
    syntheticDir,
    '--json-out',
    syntheticJsonOut,
    '--md-out',
    syntheticMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(syntheticJsonOut, 'utf8'));
  assert.equal(report.coverage.safariWebKitStatus.evidenceClass, 'browser-row-evidence');
  assert.equal(report.coverage.safariWebKitStatus.benchmarkRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.exactBuildIdentityRecorded, false);
  assert.equal(report.coverage.safariWebKitStatus.sourceBoundaryPinned, false);
  assert.equal(report.coverage.safariWebKitStatus.fullStringRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.directReadableStreamFullStringRowsRecorded, 0);
  assert.equal(report.coverage.safariWebKitStatus.primarySyncByteBatchRowsRecorded, 0);
  assert.equal(report.coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsRecorded, 0);
  assert.equal(report.coverage.safariWebKitStatus.closesSafariObligation, false);
  assertObligation(report, 'safari-jsc-source-and-browser-rows-open', 'partial');
  const obligation = report.obligations.find(item => item.id === 'safari-jsc-source-and-browser-rows-open');
  assert.match(obligation.evidence, /Safari\/WebKit browser benchmark rows found, but the obligation is not closed/);
  assert.match(obligation.evidence, /primarySyncByteBatchRows=0; boundedPrimarySyncByteBatchRows=0/);
  assert.match(obligation.evidence, /closesSafariObligation=false/);
  assert.match(obligation.nextExperiment, /exact Safari\/WebKit build identity and source-boundary pins/);
});

test('runtime proof coverage audit does not close Safari without primary bounded byte-batch rows', () => {
  const syntheticDir = join(tmpDir, 'safari-row-with-closure-metadata-but-unknown-source');
  const syntheticJsonOut = join(tmpDir, 'safari-row-with-closure-metadata-but-unknown-source.json');
  const syntheticMdOut = join(tmpDir, 'safari-row-with-closure-metadata-but-unknown-source.md');
  resetTmp();
  mkdirSync(syntheticDir, { recursive: true });
  writeFileSync(join(syntheticDir, 'safari-webkit-availability-audit.json'), `${JSON.stringify({
    objective: 'safari-webkit-availability-audit',
    summary: {
      hostIsMacOS: true,
      safariExecutableFound: true,
      safaridriverFound: true,
      currentHarnessSupportsSafari: true,
      canRunSafariBrowserRows: true,
      safariBenchmarkRowsRecorded: true,
      exactSafariBuildIdentityRecorded: true,
      safariSourceBoundaryPinned: true,
      directReadableStreamRowsAreSeparateEvidence: true,
      openObligationRemains: false,
    },
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'safari-synthetic-browser-row.json'), `${JSON.stringify({
    objective: 'safari-synthetic-browser-row',
    contract: 'same-full-string-checksum-contract',
    environment: {
      runtimeName: 'browser',
      browserName: 'Safari',
      browserVersion: '18.5',
      javascriptEngine: 'JavaScriptCore',
      userAgent: 'Mozilla/5.0 Version/18.5 Safari/605.1.15',
    },
    fixture: {
      source: 'corpus-file',
      sourceFile: 'books.xml',
      sizeGiB: 1,
    },
    rows: [
      {
        id: 'safariFullStringUnknownSource',
        mibPerSec: 210,
        fullStringParity: true,
        boundedMemory: true,
        eventCount: 1,
        checksum: 1,
        contractScope: 'full-string-checksum',
      },
    ],
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--release-dir',
    syntheticDir,
    '--json-out',
    syntheticJsonOut,
    '--md-out',
    syntheticMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(syntheticJsonOut, 'utf8'));
  assert.equal(report.coverage.safariWebKitStatus.evidenceClass, 'browser-row-evidence');
  assert.equal(report.coverage.safariWebKitStatus.benchmarkRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.exactBuildIdentityRecorded, true);
  assert.equal(report.coverage.safariWebKitStatus.sourceBoundaryPinned, true);
  assert.equal(report.coverage.safariWebKitStatus.fullStringRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.directReadableStreamFullStringRowsRecorded, 0);
  assert.equal(report.coverage.safariWebKitStatus.primarySyncByteBatchRowsRecorded, 0);
  assert.equal(report.coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsRecorded, 0);
  assert.equal(report.coverage.safariWebKitStatus.closesSafariObligation, false);
  assertObligation(report, 'safari-jsc-source-and-browser-rows-open', 'partial');
  const obligation = report.obligations.find(item => item.id === 'safari-jsc-source-and-browser-rows-open');
  assert.match(obligation.evidence, /exactBuildIdentityRecorded=true; sourceBoundaryPinned=true; directReadableStreamRowsAreSeparateEvidence=true; directReadableStreamFullStringRows=0; primarySyncByteBatchRows=0; boundedPrimarySyncByteBatchRows=0; largeBoundedPrimarySyncByteBatchRows=0; primaryRowsInSameContractComparison=false; largePrimaryRowsInSameContractComparison=false; closesSafariObligation=false/);
});

test('runtime proof coverage audit does not close Safari for eager or full ArrayBuffer byte-batch rows', () => {
  const syntheticDir = join(tmpDir, 'safari-row-with-eager-or-full-arraybuffer-source');
  const syntheticJsonOut = join(tmpDir, 'safari-row-with-eager-or-full-arraybuffer-source.json');
  const syntheticMdOut = join(tmpDir, 'safari-row-with-eager-or-full-arraybuffer-source.md');
  resetTmp();
  mkdirSync(syntheticDir, { recursive: true });
  writeFileSync(join(syntheticDir, 'safari-webkit-availability-audit.json'), `${JSON.stringify({
    objective: 'safari-webkit-availability-audit',
    summary: {
      hostIsMacOS: true,
      safariExecutableFound: true,
      safaridriverFound: true,
      currentHarnessSupportsSafari: true,
      canRunSafariBrowserRows: true,
      safariBenchmarkRowsRecorded: true,
      exactSafariBuildIdentityRecorded: true,
      safariSourceBoundaryPinned: true,
      directReadableStreamRowsAreSeparateEvidence: true,
      openObligationRemains: false,
    },
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'safari-synthetic-browser-row.json'), `${JSON.stringify({
    objective: 'safari-synthetic-browser-row',
    contract: 'same-full-string-checksum-contract',
    environment: {
      runtimeName: 'browser',
      browserName: 'Safari',
      browserVersion: '18.5',
      javascriptEngine: 'JavaScriptCore',
      userAgent: 'Mozilla/5.0 Version/18.5 Safari/605.1.15',
    },
    fixture: {
      source: 'corpus-file',
      sourceFile: 'books.xml',
      sizeGiB: 1,
    },
    rows: [
      {
        id: 'safariFullStringFullArrayBuffer',
        mibPerSec: 220,
        fullStringParity: true,
        boundedMemory: true,
        eventCount: 1,
        checksum: 1,
        contractScope: 'full-string-checksum',
        sourceMode: 'generated-sync-iterable-byte-batches',
        demandDrivenSource: true,
        directReadableStream: false,
        fullArrayBufferParserInput: true,
      },
      {
        id: 'safariFullStringEagerBatch',
        mibPerSec: 215,
        fullStringParity: true,
        boundedMemory: true,
        eventCount: 1,
        checksum: 1,
        contractScope: 'full-string-checksum',
        sourceMode: 'generated-sync-iterable-byte-batches',
        demandDrivenSource: false,
        directReadableStream: false,
        fullArrayBufferParserInput: false,
      },
    ],
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--release-dir',
    syntheticDir,
    '--json-out',
    syntheticJsonOut,
    '--md-out',
    syntheticMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(syntheticJsonOut, 'utf8'));
  assert.equal(report.coverage.safariWebKitStatus.evidenceClass, 'browser-row-evidence');
  assert.equal(report.coverage.safariWebKitStatus.benchmarkRowsRecorded, 2);
  assert.equal(report.coverage.safariWebKitStatus.exactBuildIdentityRecorded, true);
  assert.equal(report.coverage.safariWebKitStatus.sourceBoundaryPinned, true);
  assert.equal(report.coverage.safariWebKitStatus.fullStringRowsRecorded, 2);
  assert.equal(report.coverage.safariWebKitStatus.directReadableStreamFullStringRowsRecorded, 0);
  assert.equal(report.coverage.safariWebKitStatus.primarySyncByteBatchRowsRecorded, 0);
  assert.equal(report.coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsRecorded, 0);
  assert.equal(report.coverage.safariWebKitStatus.closesSafariObligation, false);
  assertObligation(report, 'safari-jsc-source-and-browser-rows-open', 'partial');
  const obligation = report.obligations.find(item => item.id === 'safari-jsc-source-and-browser-rows-open');
  assert.match(obligation.evidence, /primarySyncByteBatchRows=0; boundedPrimarySyncByteBatchRows=0; largeBoundedPrimarySyncByteBatchRows=0; primaryRowsInSameContractComparison=false; largePrimaryRowsInSameContractComparison=false; closesSafariObligation=false/);
});

test('runtime proof coverage audit keeps direct Safari ReadableStream rows separate from primary byte-batch closure', () => {
  const syntheticDir = join(tmpDir, 'safari-direct-readable-stream-row');
  const syntheticJsonOut = join(tmpDir, 'safari-direct-readable-stream-row.json');
  const syntheticMdOut = join(tmpDir, 'safari-direct-readable-stream-row.md');
  resetTmp();
  mkdirSync(syntheticDir, { recursive: true });
  writeFileSync(join(syntheticDir, 'safari-webkit-availability-audit.json'), `${JSON.stringify({
    objective: 'safari-webkit-availability-audit',
    summary: {
      hostIsMacOS: true,
      safariExecutableFound: true,
      safaridriverFound: true,
      currentHarnessSupportsSafari: true,
      canRunSafariBrowserRows: true,
      safariBenchmarkRowsRecorded: true,
      exactSafariBuildIdentityRecorded: true,
      safariSourceBoundaryPinned: true,
      directReadableStreamRowsAreSeparateEvidence: true,
      openObligationRemains: false,
    },
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'safari-direct-readable-stream-result.json'), `${JSON.stringify({
    objective: 'safari-synthetic-browser-row',
    contract: 'same-full-string-checksum-contract',
    environment: {
      runtimeName: 'browser',
      browserName: 'Safari',
      browserVersion: '18.5',
      javascriptEngine: 'JavaScriptCore',
      userAgent: 'Mozilla/5.0 Version/18.5 Safari/605.1.15',
    },
    fixture: {
      source: 'corpus-file',
      sourceFile: 'books.xml',
      sizeGiB: 1,
    },
    rows: [
      {
        id: 'safariFullStringDirectReadableStream',
        mibPerSec: 230,
        fullStringParity: true,
        boundedMemory: true,
        maxJsHeapUsedBytes: 100 * 1024 * 1024,
        eventCount: 1,
        checksum: 1,
        contractScope: 'full-string-checksum',
        sourceMode: 'fetch-readable-stream-pull',
        demandDrivenSource: true,
        directReadableStream: true,
        fullArrayBufferParserInput: false,
      },
    ],
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--release-dir',
    syntheticDir,
    '--json-out',
    syntheticJsonOut,
    '--md-out',
    syntheticMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(syntheticJsonOut, 'utf8'));
  assert.equal(report.coverage.safariWebKitStatus.evidenceClass, 'browser-row-evidence');
  assert.equal(report.coverage.safariWebKitStatus.benchmarkRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.exactBuildIdentityRecorded, true);
  assert.equal(report.coverage.safariWebKitStatus.sourceBoundaryPinned, true);
  assert.equal(report.coverage.safariWebKitStatus.fullStringRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.directReadableStreamFullStringRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.primarySyncByteBatchRowsRecorded, 0);
  assert.equal(report.coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsRecorded, 0);
  assert.equal(report.coverage.safariWebKitStatus.closesSafariObligation, false);
  assert.equal(report.summary.largeJsFullSourceInputSafety.directReadableStreamRows, 1);
  assert.ok(report.summary.largeJsFullSourceInputSafety.sourceModeBreakdown.some(entry =>
    entry.sourceMode === 'fetch-readable-stream-pull'
    && entry.rows === 1
    && entry.notFullArrayBufferRows === 1
    && entry.directReadableStreamRows === 1
    && entry.demandDrivenRows === 1
  ));
  assertObligation(report, 'safari-jsc-source-and-browser-rows-open', 'partial');
  const obligation = report.obligations.find(item => item.id === 'safari-jsc-source-and-browser-rows-open');
  assert.match(obligation.evidence, /directReadableStreamFullStringRows=1; primarySyncByteBatchRows=0; boundedPrimarySyncByteBatchRows=0; largeBoundedPrimarySyncByteBatchRows=0; primaryRowsInSameContractComparison=false; largePrimaryRowsInSameContractComparison=false; closesSafariObligation=false/);
});

test('runtime proof coverage audit does not close Safari unless direct stream rows are declared separate evidence', () => {
  const syntheticDir = join(tmpDir, 'safari-row-without-direct-stream-separation-contract');
  const syntheticJsonOut = join(tmpDir, 'safari-row-without-direct-stream-separation-contract.json');
  const syntheticMdOut = join(tmpDir, 'safari-row-without-direct-stream-separation-contract.md');
  resetTmp();
  mkdirSync(syntheticDir, { recursive: true });
  writeFileSync(join(syntheticDir, 'safari-webkit-availability-audit.json'), `${JSON.stringify({
    objective: 'safari-webkit-availability-audit',
    summary: {
      hostIsMacOS: true,
      safariExecutableFound: true,
      safaridriverFound: true,
      currentHarnessSupportsSafari: true,
      canRunSafariBrowserRows: true,
      safariBenchmarkRowsRecorded: true,
      exactSafariBuildIdentityRecorded: true,
      safariSourceBoundaryPinned: true,
      directReadableStreamRowsAreSeparateEvidence: false,
      openObligationRemains: false,
    },
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'safari-synthetic-browser-row.json'), `${JSON.stringify({
    objective: 'safari-synthetic-browser-row',
    contract: 'same-full-string-checksum-contract',
    environment: {
      runtimeName: 'browser',
      browserName: 'Safari',
      browserVersion: '18.5',
      javascriptEngine: 'JavaScriptCore',
      userAgent: 'Mozilla/5.0 Version/18.5 Safari/605.1.15',
    },
    fixture: {
      source: 'corpus-file',
      sourceFile: 'books.xml',
      sizeGiB: 1,
    },
    rows: [
      {
        id: 'safariFullStringPrimary',
        mibPerSec: 210,
        fullStringParity: true,
        boundedMemory: true,
        eventCount: 1,
        checksum: 1,
        contractScope: 'full-string-checksum',
        sourceMode: 'generated-sync-iterable-byte-batches',
        demandDrivenSource: true,
        directReadableStream: false,
        fullArrayBufferParserInput: false,
      },
    ],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'same-contract-runtime-comparison.json'), `${JSON.stringify({
    objective: 'same-contract-runtime-comparison',
    comparisonRows: [
      {
        id: 'safariFullStringPrimary',
        runtimeId: 'safari-jsc-browser',
        jsRuntime: true,
        fullStringParity: true,
        eventCount: 1,
        checksum: 1,
      },
    ],
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--release-dir',
    syntheticDir,
    '--json-out',
    syntheticJsonOut,
    '--md-out',
    syntheticMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(syntheticJsonOut, 'utf8'));
  assert.equal(report.coverage.safariWebKitStatus.evidenceClass, 'browser-row-evidence');
  assert.equal(report.coverage.safariWebKitStatus.benchmarkRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.exactBuildIdentityRecorded, true);
  assert.equal(report.coverage.safariWebKitStatus.sourceBoundaryPinned, true);
  assert.equal(report.coverage.safariWebKitStatus.directReadableStreamRowsAreSeparateEvidence, false);
  assert.equal(report.coverage.safariWebKitStatus.primarySyncByteBatchRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.closesSafariObligation, false);
  assertObligation(report, 'safari-jsc-source-and-browser-rows-open', 'partial');
  const obligation = report.obligations.find(item => item.id === 'safari-jsc-source-and-browser-rows-open');
  assert.match(obligation.evidence, /directReadableStreamRowsAreSeparateEvidence=false/);
});

test('runtime proof coverage audit closes Safari with bounded primary byte-batch rows and source pins', () => {
  const syntheticDir = join(tmpDir, 'safari-row-with-complete-closure');
  const syntheticJsonOut = join(tmpDir, 'safari-row-with-complete-closure.json');
  const syntheticMdOut = join(tmpDir, 'safari-row-with-complete-closure.md');
  resetTmp();
  mkdirSync(syntheticDir, { recursive: true });
  writeFileSync(join(syntheticDir, 'safari-webkit-availability-audit.json'), `${JSON.stringify({
    objective: 'safari-webkit-availability-audit',
    summary: {
      hostIsMacOS: true,
      safariExecutableFound: true,
      safaridriverFound: true,
      currentHarnessSupportsSafari: true,
      canRunSafariBrowserRows: true,
      safariBenchmarkRowsRecorded: true,
      exactSafariBuildIdentityRecorded: true,
      safariSourceBoundaryPinned: true,
      directReadableStreamRowsAreSeparateEvidence: true,
      openObligationRemains: false,
    },
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'safari-synthetic-browser-row.json'), `${JSON.stringify({
    objective: 'safari-synthetic-browser-row',
    contract: 'same-full-string-checksum-contract',
    environment: {
      runtimeName: 'browser',
      browserName: 'Safari',
      browserVersion: '18.5',
      javascriptEngine: 'JavaScriptCore',
      userAgent: 'Mozilla/5.0 Version/18.5 Safari/605.1.15',
    },
    fixture: {
      source: 'corpus-file',
      sourceFile: 'books.xml',
      sizeGiB: 1,
    },
    rows: [
      {
        id: 'safariFullStringPrimary',
        mibPerSec: 210,
        fullStringParity: true,
        boundedMemory: true,
        eventCount: 1,
        checksum: 1,
        contractScope: 'full-string-checksum',
        sourceMode: 'generated-sync-iterable-byte-batches',
        demandDrivenSource: true,
        directReadableStream: false,
        fullArrayBufferParserInput: false,
      },
    ],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'same-contract-runtime-comparison.json'), `${JSON.stringify({
    objective: 'same-contract-runtime-comparison',
    comparisonRows: [
      {
        id: 'safariFullStringPrimary',
        runtimeId: 'safari-jsc-browser',
        jsRuntime: true,
        fullStringParity: true,
        eventCount: 1,
        checksum: 1,
      },
    ],
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--release-dir',
    syntheticDir,
    '--json-out',
    syntheticJsonOut,
    '--md-out',
    syntheticMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(syntheticJsonOut, 'utf8'));
  assert.equal(report.coverage.safariWebKitStatus.evidenceClass, 'browser-row-evidence');
  assert.equal(report.coverage.safariWebKitStatus.benchmarkRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.exactBuildIdentityRecorded, true);
  assert.equal(report.coverage.safariWebKitStatus.sourceBoundaryPinned, true);
  assert.equal(report.coverage.safariWebKitStatus.fullStringRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.directReadableStreamFullStringRowsRecorded, 0);
  assert.equal(report.coverage.safariWebKitStatus.primarySyncByteBatchRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsInSameContractComparison, 1);
  assert.equal(report.coverage.safariWebKitStatus.primaryRowsInSameContractComparison, true);
  assert.equal(report.coverage.safariWebKitStatus.closesSafariObligation, true);
  assertObligation(report, 'safari-jsc-source-and-browser-rows-open', 'covered');
  const obligation = report.obligations.find(item => item.id === 'safari-jsc-source-and-browser-rows-open');
  assert.match(obligation.evidence, /bounded primary sync byte-batch full-string rows/);
});

test('runtime proof coverage audit does not close Safari on sub-1GiB primary rows', () => {
  const syntheticDir = join(tmpDir, 'safari-row-with-small-primary-closure-shape');
  const syntheticJsonOut = join(tmpDir, 'safari-row-with-small-primary-closure-shape.json');
  const syntheticMdOut = join(tmpDir, 'safari-row-with-small-primary-closure-shape.md');
  resetTmp();
  mkdirSync(syntheticDir, { recursive: true });
  writeFileSync(join(syntheticDir, 'safari-webkit-availability-audit.json'), `${JSON.stringify({
    objective: 'safari-webkit-availability-audit',
    summary: {
      hostIsMacOS: true,
      safariExecutableFound: true,
      safaridriverFound: true,
      currentHarnessSupportsSafari: true,
      canRunSafariBrowserRows: true,
      safariBenchmarkRowsRecorded: true,
      exactSafariBuildIdentityRecorded: true,
      safariSourceBoundaryPinned: true,
      directReadableStreamRowsAreSeparateEvidence: true,
      openObligationRemains: false,
    },
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'safari-small-browser-row.json'), `${JSON.stringify({
    objective: 'safari-small-browser-row',
    contract: 'same-full-string-checksum-contract',
    environment: {
      runtimeName: 'browser',
      browserName: 'Safari',
      browserVersion: '18.5',
      javascriptEngine: 'JavaScriptCore',
      userAgent: 'Mozilla/5.0 Version/18.5 Safari/605.1.15',
    },
    fixture: {
      source: 'corpus-file',
      sourceFile: 'books.xml',
      sizeGiB: 0.25,
    },
    rows: [
      {
        id: 'safariSmallFullStringPrimary',
        mibPerSec: 230,
        fullStringParity: true,
        boundedMemory: true,
        eventCount: 1,
        checksum: 1,
        contractScope: 'full-string-checksum',
        sourceMode: 'generated-sync-iterable-byte-batches',
        demandDrivenSource: true,
        directReadableStream: false,
        fullArrayBufferParserInput: false,
      },
    ],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'same-contract-runtime-comparison.json'), `${JSON.stringify({
    objective: 'same-contract-runtime-comparison',
    comparisonRows: [
      {
        id: 'safariSmallFullStringPrimary',
        runtimeId: 'safari-jsc-browser',
        jsRuntime: true,
        fullStringParity: true,
        eventCount: 1,
        checksum: 1,
      },
    ],
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--release-dir',
    syntheticDir,
    '--json-out',
    syntheticJsonOut,
    '--md-out',
    syntheticMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(syntheticJsonOut, 'utf8'));
  assert.equal(report.coverage.safariWebKitStatus.evidenceClass, 'browser-row-evidence');
  assert.equal(report.coverage.safariWebKitStatus.primarySyncByteBatchRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.largeBoundedPrimarySyncByteBatchRowsRecorded, 0);
  assert.equal(report.coverage.safariWebKitStatus.primaryRowsInSameContractComparison, true);
  assert.equal(report.coverage.safariWebKitStatus.largePrimaryRowsInSameContractComparison, false);
  assert.equal(report.coverage.safariWebKitStatus.closesSafariObligation, false);
  assertObligation(report, 'safari-jsc-source-and-browser-rows-open', 'partial');
  const obligation = report.obligations.find(item => item.id === 'safari-jsc-source-and-browser-rows-open');
  assert.match(obligation.evidence, /largeBoundedPrimarySyncByteBatchRows=0/);
  assert.match(obligation.evidence, /largePrimaryRowsInSameContractComparison=false/);
  assert.match(obligation.evidence, /closesSafariObligation=false/);
});

test('runtime proof coverage audit keeps Safari partial when primary rows are missing from same-contract comparison', () => {
  const syntheticDir = join(tmpDir, 'safari-row-without-comparison-closure');
  const syntheticJsonOut = join(tmpDir, 'safari-row-without-comparison-closure.json');
  const syntheticMdOut = join(tmpDir, 'safari-row-without-comparison-closure.md');
  resetTmp();
  mkdirSync(syntheticDir, { recursive: true });
  writeFileSync(join(syntheticDir, 'safari-webkit-availability-audit.json'), `${JSON.stringify({
    objective: 'safari-webkit-availability-audit',
    summary: {
      hostIsMacOS: true,
      safariExecutableFound: true,
      safaridriverFound: true,
      currentHarnessSupportsSafari: true,
      canRunSafariBrowserRows: true,
      safariBenchmarkRowsRecorded: true,
      exactSafariBuildIdentityRecorded: true,
      safariSourceBoundaryPinned: true,
      directReadableStreamRowsAreSeparateEvidence: true,
      openObligationRemains: false,
    },
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'safari-synthetic-browser-row.json'), `${JSON.stringify({
    objective: 'safari-synthetic-browser-row',
    contract: 'same-full-string-checksum-contract',
    environment: {
      runtimeName: 'browser',
      browserName: 'Safari',
      browserVersion: '18.5',
      javascriptEngine: 'JavaScriptCore',
      userAgent: 'Mozilla/5.0 Version/18.5 Safari/605.1.15',
    },
    fixture: {
      source: 'corpus-file',
      sourceFile: 'books.xml',
      sizeGiB: 1,
    },
    rows: [
      {
        id: 'safariFullStringPrimary',
        mibPerSec: 210,
        fullStringParity: true,
        boundedMemory: true,
        eventCount: 1,
        checksum: 1,
        contractScope: 'full-string-checksum',
        sourceMode: 'generated-sync-iterable-byte-batches',
        demandDrivenSource: true,
        directReadableStream: false,
        fullArrayBufferParserInput: false,
      },
    ],
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--release-dir',
    syntheticDir,
    '--json-out',
    syntheticJsonOut,
    '--md-out',
    syntheticMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(syntheticJsonOut, 'utf8'));
  assert.equal(report.coverage.safariWebKitStatus.evidenceClass, 'browser-row-evidence');
  assert.equal(report.coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.primaryRowsInSameContractComparison, false);
  assert.equal(report.coverage.safariWebKitStatus.closesSafariObligation, false);
  assertObligation(report, 'safari-jsc-source-and-browser-rows-open', 'partial');
  const obligation = report.obligations.find(item => item.id === 'safari-jsc-source-and-browser-rows-open');
  assert.match(obligation.evidence, /primaryRowsInSameContractComparison=false/);
});

test('runtime proof coverage audit keeps Safari partial without measured row build identity', () => {
  const syntheticDir = join(tmpDir, 'safari-row-without-measured-build-identity');
  const syntheticJsonOut = join(tmpDir, 'safari-row-without-measured-build-identity.json');
  const syntheticMdOut = join(tmpDir, 'safari-row-without-measured-build-identity.md');
  resetTmp();
  mkdirSync(syntheticDir, { recursive: true });
  writeFileSync(join(syntheticDir, 'safari-webkit-availability-audit.json'), `${JSON.stringify({
    objective: 'safari-webkit-availability-audit',
    summary: {
      hostIsMacOS: true,
      safariExecutableFound: true,
      safaridriverFound: true,
      currentHarnessSupportsSafari: true,
      canRunSafariBrowserRows: true,
      safariBenchmarkRowsRecorded: true,
      exactSafariBuildIdentityRecorded: true,
      safariSourceBoundaryPinned: true,
      directReadableStreamRowsAreSeparateEvidence: true,
      openObligationRemains: false,
    },
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'external-run-result.json'), `${JSON.stringify({
    objective: 'external-browser-row',
    contract: 'same-full-string-checksum-contract',
    environment: {
      runtimeName: 'browser',
      browserName: 'Safari',
      javascriptEngine: 'JavaScriptCore',
    },
    fixture: {
      source: 'corpus-file',
      sourceFile: 'books.xml',
      sizeGiB: 1,
    },
    rows: [
      {
        id: 'externalSafariPrimary',
        mibPerSec: 210,
        fullStringParity: true,
        boundedMemory: true,
        eventCount: 1,
        checksum: 1,
        contractScope: 'full-string-checksum',
        sourceMode: 'generated-sync-iterable-byte-batches',
        demandDrivenSource: true,
        directReadableStream: false,
        fullArrayBufferParserInput: false,
      },
    ],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'same-contract-runtime-comparison.json'), `${JSON.stringify({
    objective: 'same-contract-runtime-comparison',
    comparisonRows: [
      {
        id: 'externalSafariPrimary',
        runtimeId: 'safari-jsc-browser',
        jsRuntime: true,
        fullStringParity: true,
        eventCount: 1,
        checksum: 1,
      },
    ],
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--release-dir',
    syntheticDir,
    '--json-out',
    syntheticJsonOut,
    '--md-out',
    syntheticMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(syntheticJsonOut, 'utf8'));
  assert.equal(report.coverage.safariWebKitStatus.availabilityExactBuildIdentityRecorded, true);
  assert.equal(report.coverage.safariWebKitStatus.measuredExactBuildIdentityRowsRecorded, 0);
  assert.equal(report.coverage.safariWebKitStatus.largeBoundedPrimarySyncByteBatchRowsWithMeasuredExactBuildIdentity, 0);
  assert.equal(report.coverage.safariWebKitStatus.exactBuildIdentityRecorded, false);
  assert.equal(report.coverage.safariWebKitStatus.largePrimaryRowsInSameContractComparison, true);
  assert.equal(report.coverage.safariWebKitStatus.closesSafariObligation, false);
  assertObligation(report, 'safari-jsc-source-and-browser-rows-open', 'partial');
  const obligation = report.obligations.find(item => item.id === 'safari-jsc-source-and-browser-rows-open');
  assert.match(obligation.evidence, /exactBuildIdentityRecorded=false/);
});

test('runtime proof coverage audit recognizes Safari browser rows by environment independent of artifact name', () => {
  const syntheticDir = join(tmpDir, 'safari-env-closure');
  const syntheticJsonOut = join(tmpDir, 'safari-env-closure.json');
  const syntheticMdOut = join(tmpDir, 'safari-env-closure.md');
  resetTmp();
  mkdirSync(syntheticDir, { recursive: true });
  writeFileSync(join(syntheticDir, 'safari-webkit-availability-audit.json'), `${JSON.stringify({
    objective: 'safari-webkit-availability-audit',
    summary: {
      hostIsMacOS: true,
      safariExecutableFound: true,
      safaridriverFound: true,
      currentHarnessSupportsSafari: true,
      canRunSafariBrowserRows: true,
      safariBenchmarkRowsRecorded: true,
      exactSafariBuildIdentityRecorded: true,
      safariSourceBoundaryPinned: true,
      directReadableStreamRowsAreSeparateEvidence: true,
      openObligationRemains: false,
    },
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'external-run-result.json'), `${JSON.stringify({
    objective: 'external-browser-row',
    contract: 'same-full-string-checksum-contract',
    environment: {
      runtimeName: 'browser',
      browserName: 'Safari',
      browserVersion: '18.5',
      javascriptEngine: 'JavaScriptCore',
      userAgent: 'Mozilla/5.0 Version/18.5 Safari/605.1.15',
    },
    fixture: {
      source: 'corpus-file',
      sourceFile: 'books.xml',
      sizeGiB: 1,
    },
    rows: [
      {
        id: 'externalSafariPrimary',
        mibPerSec: 210,
        fullStringParity: true,
        boundedMemory: true,
        eventCount: 1,
        checksum: 1,
        contractScope: 'full-string-checksum',
        sourceMode: 'generated-sync-iterable-byte-batches',
        demandDrivenSource: true,
        directReadableStream: false,
        fullArrayBufferParserInput: false,
      },
    ],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'same-contract-runtime-comparison.json'), `${JSON.stringify({
    objective: 'same-contract-runtime-comparison',
    comparisonRows: [
      {
        id: 'externalSafariPrimary',
        runtimeId: 'safari-jsc-browser',
        jsRuntime: true,
        fullStringParity: true,
        eventCount: 1,
        checksum: 1,
      },
    ],
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--release-dir',
    syntheticDir,
    '--json-out',
    syntheticJsonOut,
    '--md-out',
    syntheticMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(syntheticJsonOut, 'utf8'));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'external-run-result.json'
    && artifact.runtimes.includes('safari-jsc-browser')
  ));
  assert.equal(report.coverage.safariWebKitStatus.evidenceClass, 'browser-row-evidence');
  assert.equal(report.coverage.safariWebKitStatus.benchmarkRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.directReadableStreamFullStringRowsRecorded, 0);
  assert.equal(report.coverage.safariWebKitStatus.primarySyncByteBatchRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.measuredExactBuildIdentityRowsRecorded, 1);
  assert.equal(report.coverage.safariWebKitStatus.largeBoundedPrimarySyncByteBatchRowsWithMeasuredExactBuildIdentity, 1);
  assert.equal(report.coverage.safariWebKitStatus.exactBuildIdentityRecorded, true);
  assert.equal(report.coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsInSameContractComparison, 1);
  assert.equal(report.coverage.safariWebKitStatus.primaryRowsInSameContractComparison, true);
  assert.equal(report.coverage.safariWebKitStatus.closesSafariObligation, true);
  assertObligation(report, 'safari-jsc-source-and-browser-rows-open', 'covered');
});

test('runtime proof coverage audit does not close SpiderMonkey codegen on trace names alone', () => {
  const syntheticDir = join(tmpDir, 'spidermonkey-trace-without-emitted-ir');
  const syntheticJsonOut = join(tmpDir, 'spidermonkey-trace-without-emitted-ir.json');
  const syntheticMdOut = join(tmpDir, 'spidermonkey-trace-without-emitted-ir.md');
  resetTmp();
  mkdirSync(syntheticDir, { recursive: true });
  writeFileSync(join(syntheticDir, 'node-v8-codegen-trace.json'), `${JSON.stringify({
    objective: 'node-v8-codegen-trace',
    runtimes: ['node-v8'],
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'bun-jsc-codegen-trace.json'), `${JSON.stringify({
    objective: 'bun-jsc-codegen-trace',
    runtimes: ['bun-jsc'],
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'browser-v8-codegen-trace.json'), `${JSON.stringify({
    objective: 'browser-v8-codegen-trace',
    environment: { runtimeName: 'browser', browserName: 'Chrome', javascriptEngine: 'V8' },
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'deno-v8-codegen-trace.json'), `${JSON.stringify({
    objective: 'deno-v8-codegen-trace',
    runtimes: ['deno-v8'],
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'deno-v8-codegen-trace-midsize-corpus.json'), `${JSON.stringify({
    objective: 'deno-v8-codegen-trace',
    runtimes: ['deno-v8'],
    fixture: { source: 'corpus-file', file: 'midsize.xml' },
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'firefox-spidermonkey-jit-codegen-trace.json'), `${JSON.stringify({
    objective: 'firefox-spidermonkey-jit-codegen-trace',
    environment: { runtimeName: 'browser', browserName: 'Firefox', javascriptEngine: 'SpiderMonkey' },
    traces: [{ kind: 'jit-status-only' }],
    outcome: {
      status: 'available',
      hasJitExecutionStatus: true,
      hasIrDumpSurface: false,
      nativeDumpComplete: false,
      closesEmittedIrObligation: false,
    },
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--release-dir',
    syntheticDir,
    '--json-out',
    syntheticJsonOut,
    '--md-out',
    syntheticMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(syntheticJsonOut, 'utf8'));
  assert.equal(report.coverage.spiderMonkeyDiagnostics.emittedIrEvidenceCount, 0);
  assertObligation(report, 'codegen-traces-open', 'partial');
  const obligation = report.obligations.find(item => item.id === 'codegen-traces-open');
  assert.match(obligation.evidence, /Node\/V8 trace evidence present/);
  assert.match(obligation.evidence, /Bun\/JSC codegen\/IR evidence present/);
  assert.match(obligation.evidence, /Chrome\/V8 browser codegen trace evidence present/);
  assert.match(obligation.evidence, /Deno\/V8 codegen trace evidence present \(2 artifacts\)/);
  assert.match(obligation.evidence, /Firefox\/SpiderMonkey emitted JIT IR or optimized-code dump evidence missing/);
});

test('runtime proof coverage audit requires Deno codegen before closing runtime codegen coverage', () => {
  const syntheticDir = join(tmpDir, 'codegen-without-deno');
  const syntheticJsonOut = join(tmpDir, 'codegen-without-deno.json');
  const syntheticMdOut = join(tmpDir, 'codegen-without-deno.md');
  resetTmp();
  mkdirSync(syntheticDir, { recursive: true });
  writeFileSync(join(syntheticDir, 'same-contract-runtime-comparison.json'), `${JSON.stringify({
    objective: 'same-contract-runtime-comparison',
    comparisonRows: [
      {
        caseId: 'currentFullStringRow',
        runtimeId: 'spidermonkey-jsshell',
        jsRuntime: true,
        mibPerSec: 201,
        fullStringParity: true,
        eventCount: 1000,
        checksum: 123,
        contractScope: 'full-string-checksum',
        fixture: { source: 'corpus-file', sourceFile: 'books.xml', sizeGiB: 1 },
      },
    ],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'node-v8-codegen-trace.json'), `${JSON.stringify({
    objective: 'node-v8-codegen-trace',
    runtimes: ['node-v8'],
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'bun-jsc-codegen-trace.json'), `${JSON.stringify({
    objective: 'bun-jsc-codegen-trace',
    runtimes: ['bun-jsc'],
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'browser-v8-codegen-trace.json'), `${JSON.stringify({
    objective: 'browser-v8-codegen-trace',
    environment: { runtimeName: 'browser', browserName: 'Chrome', javascriptEngine: 'V8' },
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'spidermonkey-taskcluster-debug-jsshell-codegen-audit.json'), `${JSON.stringify({
    objective: 'firefox-spidermonkey-emitted-ir',
    runtime: { id: 'spidermonkey-jsshell' },
    outcome: {
      status: 'emitted-ir-captured',
      hasJitExecutionStatus: true,
      hasIrDumpSurface: true,
      nativeDumpComplete: true,
      hasCodegenDumpOutput: true,
      closesEmittedIrObligation: true,
      sameContractStaxRow: true,
      canRunCurrentStaxFullStringBenchmark: true,
      selectedRowId: 'currentFullStringRow',
      selectedEventCount: 1000,
      selectedChecksum: 123,
    },
    shell: {
      provenance: {
        taskId: 'task-current',
        route: 'gecko.v2.mozilla-central.latest.firefox.win64-debug',
        buildId: '20260601000000',
        sourceRevision: 'abcdef1234567890',
      },
      codegenProbe: {
        status: 'codegen-output-emitted',
        flags: 'codegen',
        outputBytes: 1024,
        codegenMarkerCount: 4,
      },
    },
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--release-dir',
    syntheticDir,
    '--json-out',
    syntheticJsonOut,
    '--md-out',
    syntheticMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(syntheticJsonOut, 'utf8'));
  assert.equal(report.coverage.spiderMonkeyDiagnostics.emittedIrEvidenceCount, 1);
  assert.equal(report.coverage.spiderMonkeyDiagnostics.emittedIrClaimCount, 1);
  assert.ok(report.coverage.spiderMonkeyDiagnostics.rows.some(row =>
    row.id === 'taskcluster-debug-jsshell-codegen'
    && row.selectedRowMatchesCurrentComparison === true
    && row.closingMetadataComplete === true
    && row.emittedIrClosureQualified === true
  ));
  assertObligation(report, 'codegen-traces-open', 'partial');
  const obligation = report.obligations.find(item => item.id === 'codegen-traces-open');
  assert.match(obligation.evidence, /Node\/V8 trace evidence present/);
  assert.match(obligation.evidence, /Bun\/JSC codegen\/IR evidence present/);
  assert.match(obligation.evidence, /Chrome\/V8 browser codegen trace evidence present/);
  assert.match(obligation.evidence, /Deno\/V8 codegen trace evidence missing/);
  assert.match(obligation.evidence, /Firefox\/SpiderMonkey emitted JIT IR or optimized-code dump evidence present/);
});

test('runtime proof coverage audit rejects SpiderMonkey emitted IR without closing metadata', () => {
  const syntheticDir = join(tmpDir, 'spidermonkey-emitted-ir-without-closing-metadata');
  const syntheticJsonOut = join(tmpDir, 'spidermonkey-emitted-ir-without-closing-metadata.json');
  const syntheticMdOut = join(tmpDir, 'spidermonkey-emitted-ir-without-closing-metadata.md');
  resetTmp();
  mkdirSync(syntheticDir, { recursive: true });
  writeFileSync(join(syntheticDir, 'same-contract-runtime-comparison.json'), `${JSON.stringify({
    objective: 'same-contract-runtime-comparison',
    comparisonRows: [
      {
        id: 'currentFullStringRow',
        runtimeId: 'firefox-spidermonkey-browser',
        jsRuntime: true,
        fullStringParity: true,
        eventCount: 1000,
        checksum: 123,
      },
    ],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'spidermonkey-taskcluster-debug-jsshell-codegen-audit.json'), `${JSON.stringify({
    objective: 'firefox-spidermonkey-emitted-ir',
    runtime: { id: 'spidermonkey-jsshell' },
    outcome: {
      status: 'emitted-ir-captured',
      hasJitExecutionStatus: true,
      hasIrDumpSurface: true,
      nativeDumpComplete: true,
      closesEmittedIrObligation: true,
      sameContractStaxRow: true,
      canRunCurrentStaxFullStringBenchmark: true,
      selectedRowId: 'currentFullStringRow',
      selectedEventCount: 1000,
      selectedChecksum: 123,
    },
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--release-dir',
    syntheticDir,
    '--json-out',
    syntheticJsonOut,
    '--md-out',
    syntheticMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(syntheticJsonOut, 'utf8'));
  assert.equal(report.coverage.spiderMonkeyDiagnostics.emittedIrEvidenceCount, 0);
  assert.equal(report.coverage.spiderMonkeyDiagnostics.emittedIrClaimCount, 1);
  assert.ok(report.coverage.spiderMonkeyDiagnostics.rows.some(row =>
    row.id === 'taskcluster-debug-jsshell-codegen'
    && row.selectedRowMatchesCurrentComparison === true
    && row.closingMetadataComplete === false
    && row.emittedIrClosureQualified === false
    && row.evidenceClass === 'emitted-ir-scope-guard'
  ));
});

test('runtime proof coverage audit rejects SpiderMonkey emitted IR with empty dump metadata', () => {
  const syntheticDir = join(tmpDir, 'spidermonkey-emitted-ir-empty-dump-metadata');
  const syntheticJsonOut = join(tmpDir, 'spidermonkey-emitted-ir-empty-dump-metadata.json');
  const syntheticMdOut = join(tmpDir, 'spidermonkey-emitted-ir-empty-dump-metadata.md');
  resetTmp();
  mkdirSync(syntheticDir, { recursive: true });
  writeFileSync(join(syntheticDir, 'same-contract-runtime-comparison.json'), `${JSON.stringify({
    objective: 'same-contract-runtime-comparison',
    comparisonRows: [
      {
        id: 'currentFullStringRow',
        runtimeId: 'firefox-spidermonkey-browser',
        jsRuntime: true,
        fullStringParity: true,
        eventCount: 1000,
        checksum: 123,
      },
    ],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'spidermonkey-taskcluster-debug-jsshell-codegen-audit.json'), `${JSON.stringify({
    objective: 'firefox-spidermonkey-emitted-ir',
    runtime: { id: 'spidermonkey-jsshell' },
    outcome: {
      status: 'emitted-ir-captured',
      hasJitExecutionStatus: true,
      hasIrDumpSurface: true,
      nativeDumpComplete: true,
      hasCodegenDumpOutput: true,
      closesEmittedIrObligation: true,
      sameContractStaxRow: true,
      canRunCurrentStaxFullStringBenchmark: true,
      selectedRowId: 'currentFullStringRow',
      selectedEventCount: 1000,
      selectedChecksum: 123,
    },
    shell: {
      provenance: {
        taskId: 'task-current',
        route: 'gecko.v2.mozilla-central.latest.firefox.win64-debug',
        buildId: '20260601000000',
        sourceRevision: 'abcdef1234567890',
      },
      codegenProbe: {
        status: 'codegen-output-emitted',
        flags: 'codegen',
        outputBytes: 0,
        codegenMarkerCount: 0,
        ionScriptMarkerCount: 0,
        assemblyMnemonicCount: 0,
      },
    },
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--release-dir',
    syntheticDir,
    '--json-out',
    syntheticJsonOut,
    '--md-out',
    syntheticMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(syntheticJsonOut, 'utf8'));
  assert.equal(report.coverage.spiderMonkeyDiagnostics.emittedIrEvidenceCount, 0);
  assert.equal(report.coverage.spiderMonkeyDiagnostics.emittedIrClaimCount, 1);
  assert.ok(report.coverage.spiderMonkeyDiagnostics.rows.some(row =>
    row.id === 'taskcluster-debug-jsshell-codegen'
    && row.selectedRowMatchesCurrentComparison === true
    && row.emittedDumpMetadataRecorded === false
    && row.closingMetadataComplete === false
    && row.emittedIrClosureQualified === false
    && row.evidenceClass === 'emitted-ir-scope-guard'
  ));
  assertObligation(report, 'codegen-traces-open', 'partial');
});

test('runtime proof coverage audit rejects SpiderMonkey emitted IR without comparison reference rows', () => {
  const syntheticDir = join(tmpDir, 'spidermonkey-emitted-ir-without-comparison-reference');
  const syntheticJsonOut = join(tmpDir, 'spidermonkey-emitted-ir-without-comparison-reference.json');
  const syntheticMdOut = join(tmpDir, 'spidermonkey-emitted-ir-without-comparison-reference.md');
  resetTmp();
  mkdirSync(syntheticDir, { recursive: true });
  writeFileSync(join(syntheticDir, 'node-v8-codegen-trace.json'), `${JSON.stringify({
    objective: 'node-v8-codegen-trace',
    runtimes: ['node-v8'],
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'bun-jsc-codegen-trace.json'), `${JSON.stringify({
    objective: 'bun-jsc-codegen-trace',
    runtimes: ['bun-jsc'],
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'browser-v8-codegen-trace.json'), `${JSON.stringify({
    objective: 'browser-v8-codegen-trace',
    environment: { runtimeName: 'browser', browserName: 'Chrome', javascriptEngine: 'V8' },
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'deno-v8-codegen-trace.json'), `${JSON.stringify({
    objective: 'deno-v8-codegen-trace',
    runtimes: ['deno-v8'],
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'spidermonkey-taskcluster-debug-jsshell-codegen-audit.json'), `${JSON.stringify({
    objective: 'firefox-spidermonkey-emitted-ir',
    runtime: { id: 'spidermonkey-jsshell' },
    outcome: {
      status: 'emitted-ir-captured',
      hasJitExecutionStatus: true,
      hasIrDumpSurface: true,
      nativeDumpComplete: true,
      hasCodegenDumpOutput: true,
      closesEmittedIrObligation: true,
      sameContractStaxRow: true,
      canRunCurrentStaxFullStringBenchmark: true,
      selectedRowId: 'currentFullStringRow',
      selectedEventCount: 1000,
      selectedChecksum: 123,
    },
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--release-dir',
    syntheticDir,
    '--json-out',
    syntheticJsonOut,
    '--md-out',
    syntheticMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(syntheticJsonOut, 'utf8'));
  assert.equal(report.coverage.spiderMonkeyDiagnostics.emittedIrEvidenceCount, 0);
  assert.equal(report.coverage.spiderMonkeyDiagnostics.emittedIrClaimCount, 1);
  assert.ok(report.coverage.spiderMonkeyDiagnostics.rows.some(row =>
    row.id === 'taskcluster-debug-jsshell-codegen'
    && row.evidenceClass === 'emitted-ir-scope-guard'
    && row.selectedRowMatchesCurrentComparison === false
    && row.emittedIrClosureQualified === false
  ));
  assertObligation(report, 'codegen-traces-open', 'partial');
});

test('runtime proof coverage audit rejects SpiderMonkey emitted IR for stale comparison row ids', () => {
  const syntheticDir = join(tmpDir, 'spidermonkey-emitted-ir-stale-row-id');
  const syntheticJsonOut = join(tmpDir, 'spidermonkey-emitted-ir-stale-row-id.json');
  const syntheticMdOut = join(tmpDir, 'spidermonkey-emitted-ir-stale-row-id.md');
  resetTmp();
  mkdirSync(syntheticDir, { recursive: true });
  writeFileSync(join(syntheticDir, 'same-contract-runtime-comparison.json'), `${JSON.stringify({
    objective: 'same-contract-runtime-comparison',
    rows: [
      {
        id: 'currentFullStringRow',
        runtime: { id: 'spidermonkey-jsshell' },
        mibPerSec: 201,
        fullStringParity: true,
        boundedMemory: true,
        maxRssMiB: 64,
        eventCount: 1000,
        checksum: 123,
        contractScope: 'full-string-checksum',
        fixture: { source: 'corpus-file', sourceFile: 'books.xml', sizeGiB: 1 },
      },
    ],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'node-v8-codegen-trace.json'), `${JSON.stringify({
    objective: 'node-v8-codegen-trace',
    runtimes: ['node-v8'],
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'bun-jsc-codegen-trace.json'), `${JSON.stringify({
    objective: 'bun-jsc-codegen-trace',
    runtimes: ['bun-jsc'],
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'browser-v8-codegen-trace.json'), `${JSON.stringify({
    objective: 'browser-v8-codegen-trace',
    environment: { runtimeName: 'browser', browserName: 'Chrome', javascriptEngine: 'V8' },
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'deno-v8-codegen-trace.json'), `${JSON.stringify({
    objective: 'deno-v8-codegen-trace',
    runtimes: ['deno-v8'],
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'spidermonkey-taskcluster-debug-jsshell-codegen-audit.json'), `${JSON.stringify({
    objective: 'firefox-spidermonkey-emitted-ir',
    runtime: { id: 'spidermonkey-jsshell' },
    outcome: {
      status: 'emitted-ir-captured',
      hasJitExecutionStatus: true,
      hasIrDumpSurface: true,
      nativeDumpComplete: true,
      hasCodegenDumpOutput: true,
      closesEmittedIrObligation: true,
      sameContractStaxRow: true,
      canRunCurrentStaxFullStringBenchmark: true,
      selectedRowId: 'staleFullStringRow',
      selectedEventCount: 1000,
      selectedChecksum: 123,
    },
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--release-dir',
    syntheticDir,
    '--json-out',
    syntheticJsonOut,
    '--md-out',
    syntheticMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(syntheticJsonOut, 'utf8'));
  assert.equal(report.coverage.spiderMonkeyDiagnostics.emittedIrEvidenceCount, 0);
  assert.equal(report.coverage.spiderMonkeyDiagnostics.emittedIrClaimCount, 1);
  assert.ok(report.coverage.spiderMonkeyDiagnostics.rows.some(row =>
    row.id === 'taskcluster-debug-jsshell-codegen'
    && row.evidenceClass === 'emitted-ir-scope-guard'
    && row.selectedRowId === 'staleFullStringRow'
    && row.selectedRowMatchesCurrentComparison === false
    && row.emittedIrClosureQualified === false
  ));
  assertObligation(report, 'codegen-traces-open', 'partial');
  const obligation = report.obligations.find(item => item.id === 'codegen-traces-open');
  assert.match(obligation.evidence, /Firefox\/SpiderMonkey emitted JIT IR or optimized-code dump evidence missing/);
});

test('runtime proof coverage audit rejects SpiderMonkey emitted IR that is not same-contract StAX closure', () => {
  const syntheticDir = join(tmpDir, 'spidermonkey-emitted-ir-not-same-contract');
  const syntheticJsonOut = join(tmpDir, 'spidermonkey-emitted-ir-not-same-contract.json');
  const syntheticMdOut = join(tmpDir, 'spidermonkey-emitted-ir-not-same-contract.md');
  resetTmp();
  mkdirSync(syntheticDir, { recursive: true });
  writeFileSync(join(syntheticDir, 'node-v8-codegen-trace.json'), `${JSON.stringify({
    objective: 'node-v8-codegen-trace',
    runtimes: ['node-v8'],
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'bun-jsc-codegen-trace.json'), `${JSON.stringify({
    objective: 'bun-jsc-codegen-trace',
    runtimes: ['bun-jsc'],
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'browser-v8-codegen-trace.json'), `${JSON.stringify({
    objective: 'browser-v8-codegen-trace',
    environment: { runtimeName: 'browser', browserName: 'Chrome', javascriptEngine: 'V8' },
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'deno-v8-codegen-trace.json'), `${JSON.stringify({
    objective: 'deno-v8-codegen-trace',
    runtimes: ['deno-v8'],
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'deno-v8-codegen-trace-midsize-corpus.json'), `${JSON.stringify({
    objective: 'deno-v8-codegen-trace',
    runtimes: ['deno-v8'],
    fixture: { source: 'corpus-file', file: 'midsize.xml' },
    traces: [{ kind: 'codegen' }],
  }, null, 2)}\n`);
  writeFileSync(join(syntheticDir, 'spidermonkey-taskcluster-debug-jsshell-codegen-audit.json'), `${JSON.stringify({
    objective: 'firefox-spidermonkey-emitted-ir',
    runtime: { id: 'spidermonkey-jsshell' },
    outcome: {
      status: 'emitted-ir-captured',
      hasJitExecutionStatus: true,
      hasIrDumpSurface: true,
      nativeDumpComplete: true,
      hasCodegenDumpOutput: true,
      closesEmittedIrObligation: true,
      sameContractStaxRow: false,
      canRunCurrentStaxFullStringBenchmark: false,
    },
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--release-dir',
    syntheticDir,
    '--json-out',
    syntheticJsonOut,
    '--md-out',
    syntheticMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(syntheticJsonOut, 'utf8'));
  assert.equal(report.coverage.spiderMonkeyDiagnostics.emittedIrEvidenceCount, 0);
  assert.equal(report.coverage.spiderMonkeyDiagnostics.emittedIrClaimCount, 1);
  assert.ok(report.coverage.spiderMonkeyDiagnostics.rows.some(row =>
    row.id === 'taskcluster-debug-jsshell-codegen'
    && row.evidenceClass === 'emitted-ir-scope-guard'
    && row.emittedIrClosureQualified === false
  ));
  assertObligation(report, 'codegen-traces-open', 'partial');
  const obligation = report.obligations.find(item => item.id === 'codegen-traces-open');
  assert.match(obligation.evidence, /Firefox\/SpiderMonkey emitted JIT IR or optimized-code dump evidence missing/);
});

function assertObligation(report, id, status) {
  const row = report.obligations.find(item => item.id === id);
  assert.ok(row, `missing obligation: ${id}`);
  assert.equal(row.status, status);
}

function assertUnknownBoundedMemoryRow(report, sourceArtifact, id, memoryKind) {
  assert.ok(report.unknownBoundedMemoryRows.some(row =>
    row.sourceArtifact === sourceArtifact
    && row.id === id
    && (memoryKind === undefined || row.memoryKind === memoryKind)
  ), `missing unknown bounded-memory row: ${sourceArtifact}/${id}`);
}

function assertKnownBoundedMemoryRow(report, sourceArtifact, id) {
  assert.ok(report.coverage.runtimes.some(runtime =>
    runtime.fastestLargeFullStringRow?.sourceArtifact === sourceArtifact
    && runtime.fastestLargeFullStringRow?.id === id
    && runtime.fastestLargeFullStringRow?.boundedMemory === true
    && runtime.fastestLargeFullStringRow?.memoryKind === 'process-rss'
  ), `missing known bounded-memory row: ${sourceArtifact}/${id}`);
}

function assertNoUnknownBoundedMemoryRow(report, sourceArtifact, id) {
  assert.ok(!report.unknownBoundedMemoryRows.some(row =>
    row.sourceArtifact === sourceArtifact
    && row.id === id
  ), `unexpected unknown bounded-memory row: ${sourceArtifact}/${id}`);
}

function isJsRuntime(runtimeId) {
  return [
    'node-v8',
    'bun-jsc',
    'deno-v8',
    'chrome-v8-browser',
    'firefox-spidermonkey-browser',
    'safari-jsc-browser',
  ].includes(runtimeId);
}

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }
}
