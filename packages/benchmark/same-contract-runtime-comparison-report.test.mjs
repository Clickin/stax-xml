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
  assert.equal(report.summary.rowCount, 31);
  assert.equal(report.summary.jsLargeFullRowCount, 27);
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRow.caseId, 'eventObjectFull');
  assert.equal(report.summary.fastestBoundedJsLargePublicEventRow.boundedMemory, true);
  assert.ok(report.summary.fastestBoundedJsLargePublicEventRow.mibPerSec < 200);
  assert.ok(report.summary.externalBaseline16MiB.woodstoxMiBPerSec > 300);
  assert.ok(report.summary.externalBaseline16MiB.quickXmlWoodstoxRatio > 0.9);
  assert.deepEqual(report.summary.memoryMetricKinds, ['browser-js-heap', 'browser-js-heap-unavailable', 'not-recorded', 'process-rss']);

  assert.ok(report.comparisonRows.some(row =>
    row.sourceArtifact === 'external-baseline.json'
    && row.runtimeId === 'woodstox-jvm'
    && row.fullStringParity === true
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
    row.sourceArtifact === 'bun-candidate-headroom-corpus.json'
    && row.caseId === 'eventObjectFull'
    && row.boundedMemory === false
  ));
  assert.ok(report.allocationEvidence.some(item =>
    item.sourceArtifact === 'quick-xml-allocation-count.json'
    && item.memory.primaryKind === 'total-allocator-traffic'
    && item.shapeSummary.totalOwnedCount === 0
  ));
  assert.ok(report.allocationEvidence.some(item =>
    item.sourceArtifact === 'woodstox-jfr-allocation.json'
    && item.memory.primaryKind === 'jfr-sampled-allocation'
    && item.memory.stringBoundaryEventCount > 0
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Same-Contract Runtime Comparison/);
  assert.match(markdown, /does not assert identical object shape/);
  assert.match(markdown, /Fastest bounded 1 GiB\+ JS public event-object row/);
  assert.match(markdown, /200 MiB\/s\+ bounded-memory JavaScript counterexamples found: 0/);
  assert.match(markdown, /Woodstox JFR rows are sampled allocation evidence/);
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
