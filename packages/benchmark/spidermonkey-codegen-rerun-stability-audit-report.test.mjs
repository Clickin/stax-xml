import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'spidermonkey-codegen-rerun-stability-audit-test');
const jsonOut = join(tmpDir, 'spidermonkey-codegen-rerun-stability-audit.json');
const mdOut = join(tmpDir, 'spidermonkey-codegen-rerun-stability-audit.md');

test('SpiderMonkey codegen rerun stability audit proves reproducibility without closing the obligation', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'spidermonkey-codegen-rerun-stability-audit.mjs'),
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
  assert.equal(report.objective, 'spidermonkey-codegen-rerun-stability-audit');
  assert.equal(report.contract, 'spidermonkey-debug-jsshell-codegen-rerun-reproducibility-not-closure');
  assert.equal(report.summary.pairCount, 2);
  assert.equal(report.summary.reproduciblePairs, 2);
  assert.equal(report.summary.sameTaskclusterBuildPairs, 2);
  assert.equal(report.summary.sameCodegenMarkerPairs, 2);
  assert.equal(report.summary.allReproducible, true);
  assert.equal(report.summary.allRemainNonClosure, true);
  assert.equal(report.summary.throughputCountsAsTargetEvidence, false);
  assert.equal(report.summary.qualifiedClosureCount, 0);
  assert.equal(report.summary.conclusionAllowed, false);
  assert.ok(report.findings.some(finding => finding.classification === 'TRACE_FACT'));
  assert.ok(report.findings.some(finding => finding.classification === 'NEGATIVE_RESULT'));
  assert.ok(report.findings.some(finding => finding.classification === 'SCOPE_GUARD'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# SpiderMonkey Codegen Rerun Stability Audit/);
  assert.match(markdown, /Reproducible pairs: 2/);
  assert.match(markdown, /Same Taskcluster build pairs: 2/);
  assert.match(markdown, /Same codegen marker-count pairs: 2/);
  assert.match(markdown, /Closure audit qualified closures: 0/);
  assert.match(markdown, /Throughput counts as target evidence: no/);
});

function resetTmp() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
}
