import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'spidermonkey-codegen-closure-audit-test');
const jsonOut = join(tmpDir, 'spidermonkey-codegen-closure-audit.json');
const mdOut = join(tmpDir, 'spidermonkey-codegen-closure-audit.md');

test('SpiderMonkey codegen closure audit keeps diagnostic artifacts out of same-contract closure', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'spidermonkey-codegen-closure-audit.mjs'),
    '--self-test',
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
  assert.equal(report.objective, 'spidermonkey-codegen-closure-audit');
  assert.equal(report.contract, 'spidermonkey-emitted-codegen-same-contract-closure-matrix');
  assert.equal(report.inputs.comparisonGeneratedAt, 'self-test-comparison-generated-at');
  assert.equal(report.inputs.comparisonRowCount, 1);
  assert.equal(report.summary.candidateCount, 7);
  assert.equal(report.summary.emittedCodegenSurfaceCount, 5);
  assert.equal(report.summary.sameContractStaxRowCount, 3);
  assert.equal(report.summary.profiledFullStringParityCount, 1);
  assert.equal(report.summary.unchangedRunnableCount, 3);
  assert.equal(report.summary.selectedRowMetadataCount, 4);
  assert.equal(report.summary.diagnosticWorkloadMetadataCount, 1);
  assert.equal(report.summary.nonComparableDiagnosticWorkloadMetadataCount, 1);
  assert.equal(report.summary.selectedRowComparisonMatchCount, 2);
  assert.equal(report.summary.selectedRowComparisonMismatchCount, 2);
  assert.equal(report.summary.selectedRowComparisonMissingCount, 3);
  assert.equal(report.summary.qualifiedClosureCount, 1);
  assert.equal(report.summary.contradictedClosureClaimCount, 3);
  assert.deepEqual(report.summary.selectedRowIdentityStatusCounts, {
    'closing-row-identity-missing-or-mismatched': 2,
    'not-claimed-non-stax-diagnostic': 4,
    'same-contract-stax-row': 1,
  });
  assert.deepEqual(report.summary.selectedRowMetadataMissingFieldCounts, {
    selectedChecksum: 3,
    selectedEventCount: 3,
    selectedRowId: 3,
  });
  assert.deepEqual(report.summary.closingMetadataMissingFieldCounts, {
    diagnosticFlags: 2,
    emittedDumpMetadata: 2,
    runtimeBuildIdentity: 2,
  });
  assert.deepEqual(report.summary.evidenceClassCounts, {
    'bytecode-diagnostic-only': 1,
    'current-debug-codegen-scope-guard': 1,
    'current-debug-materialized-codegen-scope-guard': 1,
    'gecko-profiler-scope-guard': 1,
    'same-contract-spidermonkey-codegen': 2,
    unknown: 1,
  });
  assert.deepEqual(report.summary.disallowedEvidenceClassCounts, {
    'bytecode-diagnostic-only': 1,
    'current-debug-codegen-scope-guard': 1,
    'current-debug-materialized-codegen-scope-guard': 1,
    'gecko-profiler-scope-guard': 1,
    unknown: 1,
  });
  assert.equal(report.summary.minimumBlockedRequirementCount, 1);
  assert.equal(report.summary.closestBlockedCandidateCount, 2);
  assert.equal(report.summary.conclusionAllowed, false);
  assert.deepEqual(report.missingRequirementHistogram, {
    closingMetadata: 2,
    emittedCodegenSurface: 2,
    evidenceClassAllowed: 5,
    selectedRowMatchesCurrentComparison: 2,
    sameContractStaxRow: 4,
    selectedRowMetadata: 3,
    unchangedRunnable: 4,
  });
  assert.equal(report.contradictedClosureClaims.length, 3);
  const contradicted = report.contradictedClosureClaims.find(candidate =>
    candidate.sourceArtifact === 'spidermonkey-contradicted-closure.json'
  );
  assert.ok(contradicted);
  assert.deepEqual(contradicted.unmetRequirements, [
    'sameContractStaxRow',
    'unchangedRunnable',
    'selectedRowMetadata',
    'evidenceClassAllowed',
  ]);
  const unknownClass = report.contradictedClosureClaims.find(candidate =>
    candidate.sourceArtifact === 'spidermonkey-unknown-closure-class.json'
  );
  assert.ok(unknownClass);
  assert.deepEqual(unknownClass.unmetRequirements, [
    'evidenceClassAllowed',
  ]);
  const mismatch = report.contradictedClosureClaims.find(candidate =>
    candidate.sourceArtifact === 'spidermonkey-mismatched-comparison-row.json'
  );
  assert.ok(mismatch);
  assert.deepEqual(mismatch.unmetRequirements, [
    'selectedRowMatchesCurrentComparison',
  ]);
  assert.equal(report.closestBlockedCandidates.length, 2);
  assert.ok(report.closestBlockedCandidates.some(candidate =>
    candidate.sourceArtifact === 'spidermonkey-unknown-closure-class.json'
  ));
  assert.ok(report.closestBlockedCandidates.some(candidate =>
    candidate.sourceArtifact === 'spidermonkey-mismatched-comparison-row.json'
  ));
  assert.ok(report.closestBlockedCandidates.every(candidate =>
    candidate.unmetRequirementCount === 1
  ));

  const blocked = report.candidates.find(candidate =>
    candidate.sourceArtifact === 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json'
  );
  assert.ok(blocked);
  assert.equal(blocked.qualifiedClosure, false);
  assert.equal(blocked.selectedRowIdentityStatus, 'not-claimed-non-stax-diagnostic');
  assert.deepEqual(blocked.closingMetadataMissingFields, []);
  assert.deepEqual(blocked.selectedRowMetadataMissingFields, [
    'selectedRowId',
    'selectedEventCount',
    'selectedChecksum',
  ]);
  assert.deepEqual(blocked.diagnosticWorkloadMetadata, {
    eventCount: 12,
    checksum: 34,
    fullStringParity: true,
    sameContractStaxRow: false,
  });
  assert.equal(blocked.diagnosticWorkloadMetadataComparable, false);
  assert.ok(blocked.unmetRequirements.includes('sameContractStaxRow'));
  assert.ok(blocked.unmetRequirements.includes('unchangedRunnable'));
  assert.ok(blocked.unmetRequirements.includes('selectedRowMetadata'));
  assert.ok(blocked.unmetRequirements.includes('evidenceClassAllowed'));

  const profiler = report.candidates.find(candidate =>
    candidate.sourceArtifact === 'firefox-spidermonkey-profiler-trace.json'
  );
  assert.ok(profiler);
  assert.equal(profiler.evidenceClass, 'gecko-profiler-scope-guard');
  assert.equal(profiler.qualifiedClosure, false);
  assert.equal(profiler.selectedRowIdentityStatus, 'not-claimed-non-stax-diagnostic');
  assert.equal(profiler.selectedRowMatchesCurrentComparison, false);
  assert.deepEqual(profiler.selectedRowMetadataMissingFields, []);
  assert.deepEqual(profiler.unmetRequirements, [
    'emittedCodegenSurface',
    'sameContractStaxRow',
    'unchangedRunnable',
    'selectedRowMatchesCurrentComparison',
    'closingMetadata',
    'evidenceClassAllowed',
  ]);

  const bytecodeOnly = report.candidates.find(candidate =>
    candidate.sourceArtifact === 'firefox-spidermonkey-release-jsshell-availability-audit.json'
  );
  assert.ok(bytecodeOnly);
  assert.equal(bytecodeOnly.evidenceClass, 'bytecode-diagnostic-only');
  assert.equal(bytecodeOnly.qualifiedClosure, false);
  assert.equal(bytecodeOnly.selectedRowIdentityStatus, 'not-claimed-non-stax-diagnostic');
  assert.deepEqual(bytecodeOnly.unmetRequirements, [
    'emittedCodegenSurface',
    'sameContractStaxRow',
    'unchangedRunnable',
    'selectedRowMetadata',
    'closingMetadata',
    'evidenceClassAllowed',
  ]);

  const closure = report.candidates.find(candidate => candidate.sourceArtifact === 'spidermonkey-same-contract-closure.json');
  assert.ok(closure);
  assert.equal(closure.qualifiedClosure, true);
  assert.equal(closure.selectedRowIdentityStatus, 'same-contract-stax-row');
  assert.equal(closure.selectedRowMatchesCurrentComparison, true);
  assert.deepEqual(closure.selectedRowMetadataMissingFields, []);
  assert.deepEqual(closure.closingMetadataMissingFields, []);
  assert.deepEqual(closure.unmetRequirements, []);

  const mismatchedClosure = report.candidates.find(candidate => candidate.sourceArtifact === 'spidermonkey-mismatched-comparison-row.json');
  assert.ok(mismatchedClosure);
  assert.equal(mismatchedClosure.qualifiedClosure, false);
  assert.equal(mismatchedClosure.selectedRowMatchesCurrentComparison, false);
  assert.deepEqual(mismatchedClosure.unmetRequirements, [
    'selectedRowMatchesCurrentComparison',
  ]);

  const unknownClosureClass = report.candidates.find(candidate => candidate.sourceArtifact === 'spidermonkey-unknown-closure-class.json');
  assert.ok(unknownClosureClass);
  assert.equal(unknownClosureClass.qualifiedClosure, false);
  assert.equal(unknownClosureClass.evidenceClass, 'unknown');
  assert.deepEqual(unknownClosureClass.unmetRequirements, [
    'evidenceClassAllowed',
  ]);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# SpiderMonkey Codegen Closure Audit/);
  assert.match(markdown, /Qualified closures: 1/);
  assert.match(markdown, /Contradicted closure claims: 3/);
  assert.match(markdown, /Selected row identity statuses: closing-row-identity-missing-or-mismatched=2, not-claimed-non-stax-diagnostic=4, same-contract-stax-row=1/);
  assert.match(markdown, /Selected row comparison matches: matched=2, mismatched=2, missing=3/);
  assert.match(markdown, /Profiled full-string parity count: 1/);
  assert.match(markdown, /Comparison generated: self-test-comparison-generated-at/);
  assert.match(markdown, /Comparison rows checked: 1/);
  assert.match(markdown, /Selected row metadata missing fields: selectedChecksum=3, selectedEventCount=3, selectedRowId=3/);
  assert.match(markdown, /Diagnostic workload metadata count: 1/);
  assert.match(markdown, /Non-comparable diagnostic workload metadata count: 1/);
  assert.match(markdown, /Closing metadata missing fields: diagnosticFlags=2, emittedDumpMetadata=2, runtimeBuildIdentity=2/);
  assert.match(markdown, /Diagnostic workload metadata is recorded for 1 non-closure artifact/);
  assert.match(markdown, /Evidence classes: bytecode-diagnostic-only=1, current-debug-codegen-scope-guard=1, current-debug-materialized-codegen-scope-guard=1, gecko-profiler-scope-guard=1, same-contract-spidermonkey-codegen=2, unknown=1/);
  assert.match(markdown, /Disallowed evidence classes: bytecode-diagnostic-only=1, current-debug-codegen-scope-guard=1, current-debug-materialized-codegen-scope-guard=1, gecko-profiler-scope-guard=1, unknown=1/);
  assert.match(markdown, /Closest blocked candidate count: 2/);
  assert.match(markdown, /selectedRowMatchesCurrentComparison: 2/);
  assert.match(markdown, /sameContractStaxRow: 4/);
  assert.match(markdown, /firefox-spidermonkey-profiler-trace\.json/);
  assert.match(markdown, /spidermonkey-contradicted-closure\.json/);
  assert.match(markdown, /spidermonkey-unknown-closure-class\.json/);
  assert.match(markdown, /sameContractStaxRow/);
});

function resetTmp() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
}
