import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit-test');
const jsonOut = join(tmpDir, 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json');
const mdOut = join(tmpDir, 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.md');

test('Taskcluster SpiderMonkey debug js-shell materialized codegen audit records strings and objects without closing unchanged StAX', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.mjs'),
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
  assert.equal(report.objective, 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit');
  assert.equal(report.contract, 'current-taskcluster-debug-spidermonkey-materialized-string-object-codegen-surface-not-unchanged-stax');
  assert.equal(report.outcome.hasMaterializedStringObjectCodegenOutput, true);
  assert.equal(report.outcome.hasCodegenDumpOutput, true);
  assert.equal(report.outcome.hasIrDumpSurface, true);
  assert.equal(report.outcome.hasNativeDisassemblySurface, true);
  assert.equal(report.outcome.nativeDumpComplete, true);
  assert.equal(report.outcome.scopeComparableToCurrentFirefox, true);
  assert.equal(report.outcome.sameSemanticChecksumFields, true);
  assert.equal(report.outcome.fullStringParity, true);
  assert.equal(report.outcome.sameContractStaxRow, false);
  assert.equal(report.outcome.unchangedStaxBenchmark, false);
  assert.equal(report.outcome.canRunCurrentStaxFullStringBenchmark, false);
  assert.equal(report.outcome.closesEmittedIrObligation, false);
  assert.equal(report.shell.version.value, 'JavaScript-C153.0a1');
  assert.equal(report.shell.provenance.taskId, 'bzK0wWZvQoOguMjTIbRJ_g');
  assert.equal(report.shell.provenance.targetTxt.buildId, '20260531212007');
  assert.equal(report.shell.provenance.targetTxt.sourceRevision, '71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7');
  assert.equal(report.materializedWorkload.contractScope, 'ascii-js-string-and-public-event-object-materialization');
  assert.equal(report.materializedWorkload.fullStringParity, true);
  assert.equal(report.materializedWorkload.sameContractStaxRow, false);
  assert.equal(report.materializedWorkload.eventCount, 1000);
  assert.equal(report.materializedWorkload.checksum, -456789);
  assert.ok(report.materializedWorkload.materializedStringCount > 0);
  assert.ok(report.materializedWorkload.materializedObjectCount > 0);
  assert.equal(report.shell.materializedCodegenProbe.status, 'materialized-string-object-codegen-output-emitted');
  assert.ok(report.shell.materializedCodegenProbe.codegenMarkerCount > 0);
  assert.ok(report.shell.materializedCodegenProbe.ionScriptMarkerCount > 0);
  assert.ok(report.shell.materializedCodegenProbe.assemblyMnemonicCount > 0);
  assert.deepEqual(report.shell.apiProbe.missingGlobals, ['TextDecoder', 'TextEncoder', 'ReadableStream', 'fetch']);
  assert.ok(report.findings.some(finding =>
    finding.id === 'taskcluster-debug-jsshell-materialized-codegen-emitted'
    && finding.classification === 'TRACE_FACT'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'taskcluster-debug-jsshell-materialized-stax-scope-gap'
    && finding.classification === 'SCOPE_GUARD'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'taskcluster-debug-jsshell-stax-api-gap'
    && finding.classification === 'NEGATIVE_RESULT'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /SpiderMonkey Taskcluster Debug JS Shell Materialized Codegen Audit/);
  assert.match(markdown, /Materialized string\/object codegen output emitted: true/);
  assert.match(markdown, /Same semantic checksum fields: true/);
  assert.match(markdown, /Full-string parity: true/);
  assert.match(markdown, /Same-contract StAX row: false/);
  assert.match(markdown, /Unchanged StAX benchmark: false/);
  assert.match(markdown, /Materialized string count: 1800/);
  assert.match(markdown, /Materialized object count: 1000/);
  assert.match(markdown, /Missing globals: TextDecoder, TextEncoder, ReadableStream, fetch/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
}
