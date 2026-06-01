import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'spidermonkey-materialized-scope-distance-audit-test');
const jsonOut = join(tmpDir, 'spidermonkey-materialized-scope-distance-audit.json');
const mdOut = join(tmpDir, 'spidermonkey-materialized-scope-distance-audit.md');

test('SpiderMonkey materialized scope-distance audit records equivalence and closure blockers separately', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'spidermonkey-materialized-scope-distance-audit.mjs'),
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
  assert.equal(report.objective, 'spidermonkey-materialized-scope-distance-audit');
  assert.equal(report.contract, 'materialized-js-shell-workload-equivalence-and-scope-distance');
  assert.equal(report.summary.allChecksPass, true);
  assert.equal(report.summary.semanticEquivalentForAsciiFields, true);
  assert.equal(report.summary.materializesJsStringsAndObjects, true);
  assert.equal(report.summary.closesDiagnosticSurfaceObligation, true);
  assert.equal(report.summary.closesCodegenObligation, false);
  assert.equal(report.summary.sameContractStaxRow, false);
  assert.equal(report.summary.unchangedStaxBenchmark, false);
  assert.equal(report.workloadComparison.token.fullStringParity, false);
  assert.equal(report.workloadComparison.materialized.fullStringParity, true);
  assert.equal(report.workloadComparison.materialized.materializedStringCount, 61289);
  assert.equal(report.workloadComparison.materialized.materializedObjectCount, 55759);
  assert.ok(report.checks.every(check => check.status === 'pass'));
  assert.ok(report.findings.some(finding =>
    finding.id === 'materialized-js-shell-semantic-equivalence-bounded'
    && finding.classification === 'SOURCE_FACT'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'materialized-js-shell-not-unchanged-stax'
    && finding.classification === 'SCOPE_GUARD'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'materialized-js-shell-closure-negative'
    && finding.classification === 'NEGATIVE_RESULT'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /SpiderMonkey Materialized Scope Distance Audit/);
  assert.match(markdown, /Semantic-equivalent for ASCII fields: true/);
  assert.match(markdown, /Closes codegen obligation: false/);
  assert.match(markdown, /Token workload: xml-token-boundary-no-string-materialization, fullStringParity=false/);
  assert.match(markdown, /Materialized workload: ascii-js-string-and-public-event-object-materialization, fullStringParity=true/);
  assert.match(markdown, /unchanged-stax-host-api-gap-remains: pass/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
}
