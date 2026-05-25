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
  assert.equal(report.summary.scannedArtifactCount, 127);
  assert.equal(report.summary.measuredRowCount, 716);
  assert.equal(report.summary.largeJsFullRowCount, 422);
  assert.equal(report.summary.partialHeadroomRowCount, 19);
  assert.equal(report.summary.textMaterializationHeadroomRowCount, 0);
  assert.equal(report.summary.unboundedOrUnknownLargeFullRowCount, 90);
  assert.equal(report.summary.fastestLargeFullRowWithMemoryProof.hasMemoryProof, true);
  assert.equal(report.summary.fastestLargeFullRowWithMemoryProof.boundedMemory, true);
  assert.equal(report.summary.fastestLargeFullRowWithMemoryProof.sourceArtifact, 'candidate-headroom-cross-process-books-corpus.json');
  assert.equal(report.summary.fastestLargeFullRowWithMemoryProof.id, 'rawFrameNameId');
  assert.equal(report.summary.fastestLargeFullRowWithMemoryProof.mibPerSec, 180.08);
  assert.ok(report.summary.fastestLargeFullRowWithMemoryProof.mibPerSec < 200);
  assert.equal(report.summary.fastestPartialHeadroomRow.fullStringParity, false);
  assert.equal(report.summary.fastestPartialHeadroomRow.sourceArtifact, 'candidate-headroom-cross-process-books-corpus-partial.json');
  assert.equal(report.summary.fastestPartialHeadroomRow.id, 'scanAllNoDecode');
  assert.equal(report.summary.fastestPartialHeadroomRow.mibPerSec, 326.65);
  assert.ok(report.summary.fastestPartialHeadroomRow.mibPerSec >= 200);
  assert.equal(report.summary.fastestTextMaterializationHeadroomRow, null);
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
  assert.ok(report.scannedArtifacts.includes('long-ascii-text-materialization-candidate.json'));
  assert.ok(report.scannedArtifacts.includes('text-cache-materialization-candidate.json'));
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
    && row.mibPerSec === 214.79
    && row.fullStringParity === false
    && row.contractScope === 'partial-scan-no-string-materialization'
  ));
  assert.ok(!report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'text-cache-materialization-candidate.json'
    && row.id === 'withoutTextStrings'
  ));
  assert.equal(report.textMaterializationHeadroomRows.length, 0);
  assert.ok(!report.textMaterializationHeadroomRows.some(row =>
    row.sourceArtifact === 'materialization-category-drop-sweep.json'
    && row.id === 'withoutTextStrings'
  ));
  assert.ok(!report.textMaterializationHeadroomRows.some(row =>
    row.sourceArtifact === 'text-cache-materialization-candidate.json'
    && row.id === 'withoutTextStrings'
  ));
  assert.ok(report.fastestLargeFullRows.some(row =>
    row.sourceArtifact === 'candidate-headroom-cross-process-books-corpus.json'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 180.08
    && row.hasMemoryProof === true
  ));
  assert.ok(report.fastestLargeFullRows.some(row =>
    row.sourceArtifact === 'candidate-headroom-cross-process-books-corpus.json'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 176.61
    && row.hasMemoryProof === true
    && row.memoryKind === 'process-rss'
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
  assert.match(markdown, /Fastest 1 GiB\+ Full-String JS Rows With Memory Proof/);
  assert.match(markdown, /Text\/CDATA Materialization Headroom Rows/);
  assert.match(markdown, /Fastest text\/CDATA materialization headroom row: none/);
  assert.match(markdown, /bun-candidate-headroom-books-corpus\.json/);
  assert.match(markdown, /not full-string StAX counterexamples/);
  assert.match(markdown, /row-level memory evidence/);
  assert.match(markdown, /not an impossibility proof/);
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
