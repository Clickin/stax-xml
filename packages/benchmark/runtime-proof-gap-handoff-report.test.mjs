import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const auditJsonOut = join(tmpDir, 'runtime-proof-gap-handoff-audit-test.json');
const auditMdOut = join(tmpDir, 'runtime-proof-gap-handoff-audit-test.md');
const jsonOut = join(tmpDir, 'runtime-proof-gap-handoff-report-test.json');
const mdOut = join(tmpDir, 'runtime-proof-gap-handoff-report-test.md');

test('runtime proof gap handoff tracks current open coverage obligations', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [auditJsonOut, auditMdOut, jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const auditResult = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
    '--json-out',
    auditJsonOut,
    '--md-out',
    auditMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(auditResult.status, 0, auditResult.stderr || auditResult.stdout);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-gap-handoff.mjs'),
    '--audit-json',
    auditJsonOut,
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

  const audit = JSON.parse(readFileSync(auditJsonOut, 'utf8'));
  const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
  const activeObligations = audit.obligations.filter(obligation => obligation.status !== 'covered');
  assert.equal(report.objective, 'runtime-proof-gap-handoff');
  assert.equal(report.contract, 'external-proof-gap-runbook-linked-to-coverage-audit');
  assert.equal(report.summary.activeObligationCount, activeObligations.length);
  assert.equal(report.summary.handoffCount, 2);
  assert.equal(report.summary.unhandledObligationCount, 0);
  assert.equal(report.summary.localClosureCount, 2);
  assert.equal(report.summary.externalRunRequiredCount, 2);
  assert.equal(report.summary.localRunnableCount, 0);
  assert.deepEqual(report.summary.localStatusCounts, { 'external-run-required': 2 });
  assert.deepEqual(report.summary.handoffClassificationCounts, { EXTERNAL_RUN_REQUIRED: 2 });
  assert.equal(report.summary.sourceConsumptionPrimary, 'synchronous Iterable<Uint8Array[]> byte batches');
  assert.equal(report.summary.directReadableStreamScope, 'separate source-overhead evidence only');
  assert.equal(report.summary.directReadableStreamBackpressureRequired, true);
  assert.equal(report.summary.conclusionAllowed, false);
  assert.match(report.summary.conclusionBlocker, /external runtime evidence/);
  assert.equal(report.auditSummary.artifactCount, audit.scannedArtifacts.length);
  assert.equal(report.auditSummary.measuredRows, audit.summary.measuredRowCount);
  assert.deepEqual(
    report.auditSummary.activeObligations.map(obligation => obligation.id),
    activeObligations.map(obligation => obligation.id),
  );
  assert.deepEqual(report.unhandledObligations, []);
  assert.ok(report.findings.some(finding =>
    finding.id === 'handoff-coverage' && finding.classification === 'CONTRACT_FACT'
  ));

  const safari = report.handoffs.find(handoff => handoff.id === 'safari-webkit-browser-row-handoff');
  const spiderMonkey = report.handoffs.find(handoff => handoff.id === 'spidermonkey-codegen-handoff');
  assert.ok(safari);
  assert.ok(spiderMonkey);
  assert.deepEqual(safari.obligationIds, ['safari-jsc-source-and-browser-rows-open']);
  assert.deepEqual(spiderMonkey.obligationIds, ['codegen-traces-open']);
  assert.equal(safari.localClosure.localStatus, 'external-run-required');
  assert.equal(safari.localClosure.localRunnable, false);
  assert.deepEqual(safari.localClosure.evidenceArtifacts, ['safari-webkit-availability-audit.json']);
  assert.ok(safari.localClosure.blockers.some(item => /Current host cannot run Safari\/WebKit browser rows/.test(item)));
  assert.match(safari.localClosure.scopeGuard, /not a Safari\/WebKit benchmark row/);
  assert.equal(spiderMonkey.localClosure.localStatus, 'external-run-required');
  assert.equal(spiderMonkey.localClosure.localRunnable, false);
  assert.deepEqual(spiderMonkey.localClosure.evidenceArtifacts, [
    'firefox-spidermonkey-diagnostic-dump-audit.json',
    'firefox-spidermonkey-js-shell-availability-audit.json',
  ]);
  assert.ok(spiderMonkey.localClosure.blockers.some(item => /emitted no JIT diagnostic dump/.test(item)));
  assert.ok(spiderMonkey.localClosure.blockers.some(item => /No local SpiderMonkey JS shell was found/.test(item)));
  assert.match(spiderMonkey.localClosure.scopeGuard, /not emitted SpiderMonkey JIT IR/);
  assert.match(safari.sourceConsumptionContract.primaryParserInput, /StreamReaderSync over a synchronous Iterable<Uint8Array\[\]>/);
  assert.match(safari.sourceConsumptionContract.demandDrivenSource, /per parser pull/);
  assert.match(safari.sourceConsumptionContract.demandDrivenSource, /must not pass one full XML ArrayBuffer/);
  assert.match(safari.sourceConsumptionContract.directReadableStreamScope, /source-overhead evidence only/);
  assert.match(safari.sourceConsumptionContract.backpressureRequirement, /backpressure is respected/);
  assert.match(safari.sourceBoundaryContract.browserBuildIdentity, /exact Safari version/);
  assert.match(safari.sourceBoundaryContract.stringBoundary, /exact tested build/);
  assert.match(safari.sourceBoundaryContract.textDecoderBoundary, /TextDecoder\/UTF-8 decode source lines/);
  assert.match(safari.sourceBoundaryContract.bunWebKitScopeGuard, /Bun\/JSC and Bun-patched WebKit source pins are not Safari/);
  assert.ok(safari.commands.some(command => /browser-candidate-headroom-cross-process\.mjs/.test(command.command)));
  assert.ok(safari.commands.some(command => /--harness safari-webdriver/.test(command.command)));
  assert.ok(safari.commands.some(command => /same-contract-runtime-comparison\.mjs/.test(command.command)));
  assert.ok(safari.commands.some(command => /runtime-limit-proof-obligation-gate\.mjs/.test(command.command)));
  assert.ok(safari.expectedEvidence.some(item => /fullStringParity/.test(item)));
  assert.ok(safari.expectedEvidence.some(item => /synchronous Iterable<Uint8Array\[\]> source contract/.test(item)));
  assert.ok(safari.expectedEvidence.some(item => /source-boundary status/.test(item)));
  assert.ok(safari.scopeGuards.some(item => /direct ReadableStream throughput/.test(item)));
  assert.ok(safari.scopeGuards.some(item => /must not be reused as Safari source-boundary evidence/.test(item)));
  assert.ok(spiderMonkey.commands.some(command => /firefox-spidermonkey-diagnostic-dump-audit\.mjs/.test(command.command)));
  assert.ok(spiderMonkey.commands.some(command => /FIREFOX_PATH=/.test(command.command)));
  assert.ok(spiderMonkey.expectedEvidence.some(item => /JIT IR/.test(item)));
  assert.ok(spiderMonkey.scopeGuards.some(item => /no-dump diagnostic audit is a negative result for the installed browser build only/.test(item)));
  assert.ok(spiderMonkey.scopeGuards.some(item => /JS shell availability is environment evidence only/.test(item)));
  assert.match(report.note, /not benchmark evidence/);
  assert.match(report.note, /not a runtime-limit conclusion/);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /Runtime Proof Gap Handoff/);
  assert.match(markdown, /## Summary/);
  assert.match(markdown, /Handoffs: 2/);
  assert.match(markdown, /Unhandled obligations: 0/);
  assert.match(markdown, /External-run required closures: 2/);
  assert.match(markdown, /Locally runnable closures: 0/);
  assert.match(markdown, new RegExp(`Audit artifacts: ${audit.scannedArtifacts.length}`));
  assert.match(markdown, new RegExp(`Audit measured rows: ${audit.summary.measuredRowCount}`));
  assert.match(markdown, /Primary source consumption: synchronous Iterable<Uint8Array\[\]> byte batches/);
  assert.match(markdown, /Direct ReadableStream scope: separate source-overhead evidence only/);
  assert.match(markdown, /Direct ReadableStream backpressure required: yes/);
  assert.match(markdown, /Runtime-limit conclusion allowed: no/);
  assert.match(markdown, /safari-webkit-browser-row-handoff/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
  assert.match(markdown, /Local closure status: external-run-required/);
  assert.match(markdown, /Locally runnable now: no/);
  assert.match(markdown, /Current host cannot run Safari\/WebKit browser rows/);
  assert.match(markdown, /Installed Firefox diagnostic dump audit emitted no JIT diagnostic dump/);
  assert.match(markdown, /No local SpiderMonkey JS shell was found/);
  assert.match(markdown, /safaridriver/);
  assert.match(markdown, /Source consumption contract/);
  assert.match(markdown, /StreamReaderSync over a synchronous Iterable<Uint8Array\[\]>/);
  assert.match(markdown, /backpressure is respected/);
  assert.match(markdown, /Source boundary contract/);
  assert.match(markdown, /Bun\/JSC and Bun-patched WebKit source pins are not Safari browser JSC source pins/);
  assert.match(markdown, /same-contract-runtime-comparison/);
  assert.match(markdown, /firefox-spidermonkey-diagnostic-dump-audit/);
  assert.match(markdown, /negative result for the installed browser build only/);
  assert.match(markdown, /environment evidence only until a dump or IR artifact is captured/);
  assert.match(markdown, /not itself benchmark, allocation, or codegen evidence/);
});
