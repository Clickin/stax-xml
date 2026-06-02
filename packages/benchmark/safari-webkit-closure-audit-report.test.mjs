import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'safari-webkit-closure-audit-test');
const jsonOut = join(tmpDir, 'safari-webkit-closure-audit.json');
const mdOut = join(tmpDir, 'safari-webkit-closure-audit.md');

test('Safari/WebKit closure audit separates primary rows from direct stream rows', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'safari-webkit-closure-audit.mjs'),
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
  assert.equal(report.objective, 'safari-webkit-closure-audit');
  assert.equal(report.contract, 'safari-webkit-same-contract-browser-row-closure-matrix');
  assert.equal(report.inputs.comparisonGeneratedAt, 'self-test');
  assert.equal(report.inputs.comparisonRowCount, 2);
  assert.equal(report.summary.candidateCount, 3);
  assert.equal(report.summary.primarySyncByteBatchRows, 2);
  assert.equal(report.summary.largeBoundedPrimaryRows, 2);
  assert.equal(report.summary.rowsInSameContractComparison, 2);
  assert.equal(report.summary.rowLevelSourceBoundaryPinnedRows, 2);
  assert.equal(report.summary.qualifiedClosureCount, 1);
  assert.equal(report.summary.conclusionAllowed, true);

  const direct = report.candidates.find(candidate => candidate.id === 'safari-direct-stream');
  assert.ok(direct);
  assert.equal(direct.qualifiedClosure, false);
  assert.ok(direct.unmetRequirements.includes('primarySyncByteBatch'));
  assert.ok(direct.unmetRequirements.includes('sameContractComparison'));

  const valid = report.candidates.find(candidate => candidate.id === 'safari-valid');
  assert.ok(valid);
  assert.equal(valid.qualifiedClosure, true);
  assert.deepEqual(valid.unmetRequirements, []);

  const genericSourcePin = report.candidates.find(candidate => candidate.id === 'safari-generic-source-pin');
  assert.ok(genericSourcePin);
  assert.equal(genericSourcePin.qualifiedClosure, false);
  assert.ok(genericSourcePin.requirements.sameContractComparison.met);
  assert.ok(genericSourcePin.requirements.measuredExactBuildIdentity.met);
  assert.ok(genericSourcePin.unmetRequirements.includes('rowLevelSourceBoundaryPinned'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Safari\/WebKit Closure Audit/);
  assert.match(markdown, /Comparison generatedAt: self-test/);
  assert.match(markdown, /Comparison row count: 2/);
  assert.match(markdown, /Qualified closures: 1/);
  assert.match(markdown, /Rows with row-level Safari\/WebKit source pins: 2/);
  assert.match(markdown, /Primary sync byte-batch/);
});

function resetTmp() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
}
