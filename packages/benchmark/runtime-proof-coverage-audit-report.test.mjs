import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
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
  assert.equal(report.summary.scannedArtifactCount, 144);
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'file-backed-materialization-profile.json'
    && artifact.objective === 'file-backed-materialization-profile'
  ));
  assert.ok(report.scannedArtifacts.some(artifact =>
    artifact.sourceArtifact === 'file-backed-long-ascii-text-candidate.json'
    && artifact.measuredRowCount === 4
    && artifact.runtimes.includes('node-v8')
  ));
  assert.equal(report.summary.measuredRowCount, 784);
  assert.equal(report.summary.largeJsFullRowCount, 486);
  assert.equal(report.summary.rowClassificationCompleteness.unknownFullStringParityRows, 0);
  assert.equal(report.summary.rowClassificationCompleteness.unknownBoundedMemoryRows, 20);
  assert.deepEqual(report.summary.unknownBoundedMemoryBreakdown, {
    total: 20,
    jsRows: 4,
    fullStringRows: 20,
    jsFullStringRows: 4,
    largeJsFullStringRows: 0,
    rowsWithMemoryCounter: 10,
  });
  assert.equal(report.unknownBoundedMemoryRows.length, 20);
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
  assert.equal(report.summary.corpusSeedCount, 3);
  assert.equal(report.summary.openObligationCount, 2);
  assert.equal(report.summary.benchmarkArtifactCount, 102);
  assert.equal(report.summary.sourceArtifactCount, 16);
  assert.equal(report.summary.traceArtifactCount, 10);
  assert.equal(report.summary.allocationArtifactCount, 15);
  assert.equal(report.summary.environmentArtifactCount, 2);
  assert.equal(report.summary.negativeArtifactCount, 11);
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

  assert.equal(report.coverage.browser.chromeBenchmarkRows.length, 98);
  assert.equal(report.coverage.browser.firefoxBenchmarkRows.length, 82);
  assert.equal(report.coverage.browser.safariBenchmarkRows.length, 0);
  assert.equal(report.coverage.browser.nonV8BenchmarkRows.length, 82);
  assert.deepEqual(report.coverage.corpusSeeds, ['books.xml', 'large.xml', 'treebank_e.xml']);
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
    row.sourceArtifact === 'external-baseline-1024mib-file-sync-batches.json'
    && row.runtimes.includes('node-v8')
    && row.runtimes.includes('woodstox-jvm')
    && row.runtimes.includes('quick-xml-rust')
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
    && row.measuredRowCount === 4
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
    && row.measuredRowCount === 2
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
    && row.measuredRowCount === 312
    && row.largeFullStringRowCount === 192
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
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'access-shape-candidate-cross-process.json'
    && row.runtimes.includes('node-v8')
    && row.runtimes.includes('bun-jsc')
    && row.measuredRowCount === 18
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
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.measuredRowCount === 0
    && row.outcome.status === 'not-found'
    && row.outcome.foundCount === 0
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
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'deno-v8'
    && row.allocationArtifacts.includes('deno-v8-allocation-sampling.json')
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
  assert.match(markdown, /not an impossibility proof/);
  assert.match(markdown, /82 Firefox\/SpiderMonkey browser benchmark rows found/);
  assert.match(markdown, /Firefox benchmark rows and exact tested-build JS string, TextDecoder, and page memory API source pins are now present/);
  assert.match(markdown, /no Safari\/WebKit browser benchmark row was found/);
  assert.match(markdown, /Local Safari\/WebKit availability audit is present/);
  assert.match(markdown, /Run same-contract Safari\/WebKit rows on a macOS host/);
  assert.match(markdown, /Bun\/JSC evidence is not Safari\/browser JSC evidence/);
  assert.match(markdown, /Bun\/JSC allocation evidence present/);
  assert.match(markdown, /Bun\/JSC codegen\/IR evidence present/);
  assert.match(markdown, /Chrome\/V8 browser codegen trace evidence present/);
  assert.match(markdown, /Firefox\/SpiderMonkey Gecko Profiler trace evidence present/);
  assert.match(markdown, /Firefox\/SpiderMonkey JitSpew\/IONFLAGS source gate evidence present, but it is not emitted JIT IR/);
  assert.match(markdown, /Firefox\/SpiderMonkey diagnostic dump audit was attempted and emitted no JIT diagnostic dump from this installed browser build \(status=no-dump-emitted, dumpFiles=0\)/);
  assert.match(markdown, /Firefox\/SpiderMonkey local js-shell availability audit present \(status=not-found, found=0\); no emitted JIT IR is recorded by that audit/);
  assert.match(markdown, /Firefox\/SpiderMonkey JIT IR or optimized-code dump missing/);
  assert.match(markdown, /15 allocation\/profile artifacts found/);
  assert.match(markdown, /Environment artifacts: 2/);
  assert.match(markdown, /\| Node\/V8 \| 63 \| 312 \| 192 \|/);
  assert.match(markdown, /\| Java\/Woodstox \| 11 \| 12 \| 4 \|/);
  assert.match(markdown, /\| Rust\/quick-xml \| 10 \| 18 \| 4 \|/);
  assert.doesNotMatch(markdown, /\| unknown \|/);
  assert.match(markdown, /Non-V8 browser allocation evidence present/);
  assert.match(markdown, /Non-V8 browser benchmark rows: 82/);
  assert.match(markdown, /Current release corpus seeds: `books\.xml`, `large\.xml`, `treebank_e\.xml`/);
  assert.match(markdown, /2 proof obligation\(s\) remain open or partial/);
  assert.match(markdown, /Missing evidence is not evidence that optimization is impossible/);
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
