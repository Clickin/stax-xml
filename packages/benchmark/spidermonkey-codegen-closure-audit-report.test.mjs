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
  assert.equal(report.summary.candidateCount, 3);
  assert.equal(report.summary.emittedCodegenSurfaceCount, 3);
  assert.equal(report.summary.sameContractStaxRowCount, 1);
  assert.equal(report.summary.unchangedRunnableCount, 1);
  assert.equal(report.summary.qualifiedClosureCount, 1);
  assert.equal(report.summary.contradictedClosureClaimCount, 1);
  assert.deepEqual(report.summary.selectedRowIdentityStatusCounts, {
    'not-claimed-non-stax-diagnostic': 2,
    'same-contract-stax-row': 1,
  });
  assert.equal(report.summary.minimumBlockedRequirementCount, 4);
  assert.equal(report.summary.closestBlockedCandidateCount, 2);
  assert.equal(report.summary.conclusionAllowed, false);
  assert.deepEqual(report.missingRequirementHistogram, {
    sameContractStaxRow: 2,
    unchangedRunnable: 2,
    selectedRowMetadata: 2,
    evidenceClassAllowed: 2,
  });
  assert.equal(report.contradictedClosureClaims.length, 1);
  assert.equal(report.contradictedClosureClaims[0].sourceArtifact, 'spidermonkey-contradicted-closure.json');
  assert.deepEqual(report.contradictedClosureClaims[0].unmetRequirements, [
    'sameContractStaxRow',
    'unchangedRunnable',
    'selectedRowMetadata',
    'evidenceClassAllowed',
  ]);
  assert.equal(report.closestBlockedCandidates.length, 2);
  assert.ok(report.closestBlockedCandidates.some(candidate =>
    candidate.sourceArtifact === 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json'
  ));
  assert.ok(report.closestBlockedCandidates.every(candidate =>
    candidate.unmetRequirementCount === 4
  ));

  const blocked = report.candidates.find(candidate =>
    candidate.sourceArtifact === 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json'
  );
  assert.ok(blocked);
  assert.equal(blocked.qualifiedClosure, false);
  assert.equal(blocked.selectedRowIdentityStatus, 'not-claimed-non-stax-diagnostic');
  assert.ok(blocked.unmetRequirements.includes('sameContractStaxRow'));
  assert.ok(blocked.unmetRequirements.includes('unchangedRunnable'));
  assert.ok(blocked.unmetRequirements.includes('selectedRowMetadata'));
  assert.ok(blocked.unmetRequirements.includes('evidenceClassAllowed'));

  const closure = report.candidates.find(candidate => candidate.sourceArtifact === 'spidermonkey-same-contract-closure.json');
  assert.ok(closure);
  assert.equal(closure.qualifiedClosure, true);
  assert.equal(closure.selectedRowIdentityStatus, 'same-contract-stax-row');
  assert.deepEqual(closure.unmetRequirements, []);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# SpiderMonkey Codegen Closure Audit/);
  assert.match(markdown, /Qualified closures: 1/);
  assert.match(markdown, /Contradicted closure claims: 1/);
  assert.match(markdown, /Selected row identity statuses: not-claimed-non-stax-diagnostic=2, same-contract-stax-row=1/);
  assert.match(markdown, /Closest blocked candidate count: 2/);
  assert.match(markdown, /sameContractStaxRow: 2/);
  assert.match(markdown, /spidermonkey-contradicted-closure\.json/);
  assert.match(markdown, /sameContractStaxRow/);
});

function resetTmp() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
}
