import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'spidermonkey-materialized-scope-distance-audit-test');
const jsonOut = join(tmpDir, 'spidermonkey-materialized-scope-distance-audit.json');
const mdOut = join(tmpDir, 'spidermonkey-materialized-scope-distance-audit.md');
const closureClaimMaterializedJson = join(tmpDir, 'spidermonkey-materialized-contradictory-closure-claim.json');
const closureClaimJsonOut = join(tmpDir, 'spidermonkey-materialized-contradictory-closure-claim-audit.json');
const closureClaimMdOut = join(tmpDir, 'spidermonkey-materialized-contradictory-closure-claim-audit.md');

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
  assert.equal(report.summary.closureRequirementsMet, 3);
  assert.equal(report.summary.closureRequirementsBlocked, 3);
  assert.equal(report.summary.sourceArtifactDeclaresClosure, false);
  assert.equal(report.summary.closureClaimContradictedByScope, false);
  assert.equal(report.summary.closesCodegenObligation, false);
  assert.equal(report.summary.throughputCountsAsTargetEvidence, false);
  assert.equal(report.summary.sameContractStaxRow, false);
  assert.equal(report.summary.unchangedStaxBenchmark, false);
  assert.equal(report.workloadComparison.token.fullStringParity, false);
  assert.equal(report.workloadComparison.materialized.fullStringParity, true);
  assert.equal(report.workloadComparison.materialized.diagnosticThroughputMiBPerSec, 0.49);
  assert.equal(report.workloadComparison.materialized.diagnosticThroughputClass, 'debug-jitspew-diagnostic-not-frontier');
  assert.equal(report.workloadComparison.materialized.throughputCountsAsTargetEvidence, false);
  assert.equal(report.workloadComparison.materialized.materializedStringCount, 61289);
  assert.equal(report.workloadComparison.materialized.materializedObjectCount, 55759);
  assert.deepEqual(report.hostApiSurface.primarySyncByteBatchMissingGlobals, []);
  assert.deepEqual(report.hostApiSurface.nonPrimaryHarnessMissingGlobals, ['TextEncoder', 'ReadableStream', 'fetch']);
  assert.equal(report.asciiScopeDistance.reducesScopeDistance, true);
  assert.equal(report.asciiScopeDistance.materializedCorpusSeedAscii, true);
  assert.equal(report.asciiScopeDistance.asciiByteToStringEquivalentToUtf8, true);
  assert.deepEqual(
    report.closureMatrix.map(item => ({ id: item.id, status: item.status })),
    [
      { id: 'emitted-codegen-surface', status: 'met' },
      { id: 'full-string-semantic-materialization', status: 'met' },
      { id: 'same-contract-stax-row', status: 'blocked' },
      { id: 'unchanged-stax-benchmark', status: 'blocked' },
      { id: 'host-api-surface', status: 'met' },
      { id: 'closure-declared-by-source-artifact', status: 'blocked' },
    ],
  );
  assert.match(
    report.closureMatrix.find(item => item.id === 'host-api-surface').observed,
    /missingGlobals=TextEncoder, ReadableStream, fetch/,
  );
  assert.match(
    report.closureMatrix.find(item => item.id === 'host-api-surface').observed,
    /primarySyncByteBatchMissingGlobals=none/,
  );
  assert.ok(report.checks.every(check => check.status === 'pass'));
  assert.ok(report.findings.some(finding =>
    finding.id === 'materialized-js-shell-ascii-textdecoder-equivalence'
    && finding.classification === 'SOURCE_FACT'
  ));
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
  assert.ok(report.findings.some(finding =>
    finding.id === 'materialized-js-shell-diagnostic-throughput-not-frontier'
    && finding.classification === 'SCOPE_GUARD'
    && finding.evidence.includes('throughputCountsAsTargetEvidence=false')
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /SpiderMonkey Materialized Scope Distance Audit/);
  assert.match(markdown, /Semantic-equivalent for ASCII fields: true/);
  assert.match(markdown, /Closure requirements met: 3/);
  assert.match(markdown, /Closure requirements blocked: 3/);
  assert.match(markdown, /Source artifact declares emitted-IR closure: false/);
  assert.match(markdown, /Closure claim contradicted by scope: false/);
  assert.match(markdown, /Closes codegen obligation: false/);
  assert.match(markdown, /Diagnostic throughput MiB\/s: 0\.49/);
  assert.match(markdown, /Diagnostic throughput class: debug-jitspew-diagnostic-not-frontier/);
  assert.match(markdown, /Throughput counts as target evidence: false/);
  assert.match(markdown, /Primary sync byte-batch missing globals: none/);
  assert.match(markdown, /Non-primary harness missing globals: TextEncoder, ReadableStream, fetch/);
  assert.match(markdown, /ASCII TextDecoder equivalence reduces scope distance: true/);
  assert.match(markdown, /Token workload: xml-token-boundary-no-string-materialization, fullStringParity=false/);
  assert.match(markdown, /Materialized workload: ascii-js-string-and-public-event-object-materialization, fullStringParity=true, diagnosticThroughputMiBPerSec=0\.49, throughputCountsAsTargetEvidence=false/);
  assert.match(markdown, /\| `same-contract-stax-row` \| blocked \| The emitted codegen corresponds to the unchanged same-contract StAX benchmark row\. \| sameContractStaxRow=false \|/);
  assert.match(markdown, /\| `host-api-surface` \| met \| The js-shell can run the current UTF-8 primary byte-batch StAX materialization path without host API substitution\. \| canRunCurrentStaxFullStringBenchmark=false, missingGlobals=TextEncoder, ReadableStream, fetch, primarySyncByteBatchMissingGlobals=none \|/);
  assert.match(markdown, /unchanged-stax-non-primary-harness-gap-remains: pass/);
});

test('SpiderMonkey materialized scope-distance audit rejects contradictory closure claims', () => {
  resetTmp();
  const materialized = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json'), 'utf8'));
  materialized.outcome.closesEmittedIrObligation = true;
  writeFileSync(closureClaimMaterializedJson, `${JSON.stringify(materialized, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'spidermonkey-materialized-scope-distance-audit.mjs'),
    '--materialized-json',
    closureClaimMaterializedJson,
    '--json-out',
    closureClaimJsonOut,
    '--md-out',
    closureClaimMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(closureClaimJsonOut, 'utf8'));
  assert.equal(report.summary.sourceArtifactDeclaresClosure, true);
  assert.equal(report.summary.closureRequirementsMet, 4);
  assert.equal(report.summary.closureRequirementsBlocked, 2);
  assert.equal(report.summary.closureClaimContradictedByScope, true);
  assert.equal(report.summary.closesCodegenObligation, false);
  assert.ok(report.closureMatrix.some(item =>
    item.id === 'closure-declared-by-source-artifact'
    && item.status === 'met'
  ));
  assert.ok(report.closureMatrix.some(item =>
    item.id === 'same-contract-stax-row'
    && item.status === 'blocked'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'materialized-js-shell-contradictory-closure-claim'
    && finding.classification === 'SCOPE_GUARD'
  ));

  const markdown = readFileSync(closureClaimMdOut, 'utf8');
  assert.match(markdown, /Source artifact declares emitted-IR closure: true/);
  assert.match(markdown, /Closure claim contradicted by scope: true/);
  assert.match(markdown, /Closes codegen obligation: false/);
  assert.match(markdown, /materialized-js-shell-contradictory-closure-claim/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut, closureClaimMaterializedJson, closureClaimJsonOut, closureClaimMdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
}
