import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'spidermonkey-taskcluster-debug-jsshell-ascii-stax-codegen-audit-test');
const jsonOut = join(tmpDir, 'spidermonkey-taskcluster-debug-jsshell-ascii-stax-codegen-audit.json');
const mdOut = join(tmpDir, 'spidermonkey-taskcluster-debug-jsshell-ascii-stax-codegen-audit.md');

test('Taskcluster SpiderMonkey debug js-shell ASCII StAX codegen audit stays scoped away from full-string closure', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'spidermonkey-taskcluster-debug-jsshell-ascii-stax-codegen-audit.mjs'),
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
  assert.equal(report.objective, 'spidermonkey-taskcluster-debug-jsshell-ascii-stax-codegen-audit');
  assert.equal(report.contract, 'current-taskcluster-debug-spidermonkey-ascii-primary-stax-codegen-scope-guard');
  assert.equal(report.outcome.hasCodegenDumpOutput, true);
  assert.equal(report.outcome.hasAsciiCurrentStaxCodegenOutput, true);
  assert.equal(report.outcome.currentStaxAsciiPrimaryByteBatchRow, true);
  assert.equal(report.outcome.sameContractStaxRow, false);
  assert.equal(report.outcome.unchangedStaxBenchmark, false);
  assert.equal(report.outcome.canRunCurrentStaxFullStringBenchmark, false);
  assert.equal(report.outcome.canRunAsciiPrimaryByteBatchBenchmark, true);
  assert.equal(report.outcome.evidenceClass, 'current-debug-ascii-stax-codegen-scope-guard');
  assert.equal(report.outcome.selectedRowIdentityStatus, 'not-claimed-ascii-stax-diagnostic');
  assert.equal(report.outcome.closesDiagnosticSurfaceObligation, true);
  assert.equal(report.outcome.closesEmittedIrObligation, false);
  assert.equal(report.asciiStaxWorkload.eventCount, 4);
  assert.equal(report.asciiStaxWorkload.materializedFields.name, 'root');
  assert.equal(report.asciiStaxWorkload.materializedFields.attrName, 'a');
  assert.equal(report.asciiStaxWorkload.materializedFields.attrValue, 'b');
  assert.equal(report.asciiStaxWorkload.materializedFields.text, 'text');
  assert.deepEqual(report.shell.apiProbe.missingGlobals, ['TextDecoder', 'TextEncoder', 'ReadableStream', 'fetch']);
  assert.ok(report.findings.some(finding =>
    finding.id === 'taskcluster-debug-jsshell-ascii-stax-codegen-emitted'
    && finding.classification === 'TRACE_FACT'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'taskcluster-debug-jsshell-ascii-stax-host-api-narrowing'
    && finding.classification === 'SCOPE_GUARD'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /SpiderMonkey Taskcluster Debug JS Shell ASCII StAX Codegen Audit/);
  assert.match(markdown, /Current StAX ASCII primary byte-batch row: true/);
  assert.match(markdown, /Same-contract StAX row: false/);
  assert.match(markdown, /Can run current StAX full-string benchmark: false/);
  assert.match(markdown, /Can run ASCII primary byte-batch benchmark: true/);
  assert.match(markdown, /Evidence class: current-debug-ascii-stax-codegen-scope-guard/);
  assert.match(markdown, /Closes emitted IR obligation: false/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
}
