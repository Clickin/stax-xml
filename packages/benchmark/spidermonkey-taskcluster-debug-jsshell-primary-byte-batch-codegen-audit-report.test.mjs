import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const releaseJson = join(__dirname, 'results', 'release', 'spidermonkey-taskcluster-debug-jsshell-primary-byte-batch-codegen-audit.json');

test('SpiderMonkey primary byte-batch codegen artifact closes the same-contract codegen obligation', () => {
  const report = JSON.parse(readFileSync(releaseJson, 'utf8'));

  assert.equal(report.objective, 'spidermonkey-taskcluster-debug-jsshell-primary-byte-batch-codegen-audit');
  assert.equal(report.contract, 'spidermonkey-taskcluster-debug-jsshell-current-stax-primary-byte-batch-same-contract-codegen');

  assert.equal(report.selectedComparisonRow.id, 'nightly-spidermonkey-stax-stream-reader-sync-primary-byte-batch');
  assert.equal(report.selectedComparisonRow.eventCount, 894724);
  assert.equal(report.selectedComparisonRow.checksum, -1087917522);

  assert.equal(report.shell.provenance.taskId, 'azB5UO80Q3KJPPyXD0C8tA');
  assert.equal(report.shell.provenance.route, 'gecko.v2.mozilla-central.latest.firefox.win64-debug');
  assert.equal(report.shell.provenance.targetTxt.buildId, '20260602214419');
  assert.equal(report.shell.provenance.targetTxt.sourceRevision, 'e4f9cbec72268c8efc0137a1d593e24af3df0712');

  assert.equal(report.shell.codegenProbe.status, 'primary-byte-batch-codegen-output-emitted');
  assert.equal(report.shell.codegenProbe.flags, 'codegen');
  assert.equal(report.shell.codegenProbe.nativeDumpComplete, true);
  assert.ok(report.shell.codegenProbe.codegenMarkerCount > 0);
  assert.ok(report.shell.codegenProbe.assemblyMnemonicCount > 0);
  assert.equal(report.shell.codegenProbe.payload.result.eventCount, 894724);
  assert.equal(report.shell.codegenProbe.payload.result.checksum, -1087917522);
  assert.deepEqual(report.shell.codegenProbe.payload.globals, {
    TextDecoder: 'undefined',
    TextEncoder: 'undefined',
    ReadableStream: 'undefined',
    fetch: 'undefined',
    Uint8Array: 'function',
    read: 'function',
  });

  assert.equal(report.outcome.hasCodegenDumpOutput, true);
  assert.equal(report.outcome.nativeDumpComplete, true);
  assert.equal(report.outcome.sameContractStaxRow, true);
  assert.equal(report.outcome.unchangedStaxBenchmark, true);
  assert.equal(report.outcome.canRunCurrentStaxFullStringBenchmark, true);
  assert.equal(report.outcome.selectedRowMatchesCurrentComparison, true);
  assert.equal(report.outcome.selectedRowIdentityStatus, 'same-contract-stax-row');
  assert.equal(report.outcome.evidenceClass, 'same-contract-spidermonkey-codegen');
  assert.equal(report.outcome.closesEmittedIrObligation, true);
  assert.equal(report.outcome.conclusionAllowed, true);

  assert.ok(report.findings.some(finding =>
    finding.id === 'not-runtime-limit-counterexample'
    && finding.classification === 'SCOPE_GUARD'
  ));
});
