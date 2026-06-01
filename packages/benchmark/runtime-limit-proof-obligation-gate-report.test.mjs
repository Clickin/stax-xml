import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'runtime-limit-proof-obligation-gate');
const goodLedger = join(tmpDir, 'good-proof-ledger.md');
const badLedger = join(tmpDir, 'bad-proof-ledger.md');
const goodJsonOut = join(tmpDir, 'good-runtime-limit-proof-obligation-gate.json');
const goodMdOut = join(tmpDir, 'good-runtime-limit-proof-obligation-gate.md');
const badJsonOut = join(tmpDir, 'bad-runtime-limit-proof-obligation-gate.json');
const badMdOut = join(tmpDir, 'bad-runtime-limit-proof-obligation-gate.md');
const counterexampleJsonOut = join(tmpDir, 'counterexample-runtime-limit-proof-obligation-gate.json');
const counterexampleMdOut = join(tmpDir, 'counterexample-runtime-limit-proof-obligation-gate.md');
const badSourceAuditJsonOut = join(tmpDir, 'source-audit-mixed-primary-source.json');
const badSourceAuditGateJsonOut = join(tmpDir, 'source-audit-runtime-limit-proof-obligation-gate.json');
const badSourceAuditGateMdOut = join(tmpDir, 'source-audit-runtime-limit-proof-obligation-gate.md');
const badSourceAuditBackpressureJsonOut = join(tmpDir, 'source-audit-bad-representative-backpressure.json');
const badSourceAuditBackpressureGateJsonOut = join(tmpDir, 'source-audit-backpressure-runtime-limit-proof-obligation-gate.json');
const badSourceAuditBackpressureGateMdOut = join(tmpDir, 'source-audit-backpressure-runtime-limit-proof-obligation-gate.md');
const badMemoryFrontierJsonOut = join(tmpDir, 'memory-frontier-unbounded-counterexample.json');
const badMemoryFrontierGateJsonOut = join(tmpDir, 'memory-frontier-runtime-limit-proof-obligation-gate.json');
const badMemoryFrontierGateMdOut = join(tmpDir, 'memory-frontier-runtime-limit-proof-obligation-gate.md');
const badTargetDistanceJsonOut = join(tmpDir, 'target-distance-bad-js-contract.json');
const badTargetDistanceGateJsonOut = join(tmpDir, 'target-distance-runtime-limit-proof-obligation-gate.json');
const badTargetDistanceGateMdOut = join(tmpDir, 'target-distance-runtime-limit-proof-obligation-gate.md');
const badTextBoundaryJsonOut = join(tmpDir, 'text-boundary-trim-crosses-target.json');
const badTextBoundaryGateJsonOut = join(tmpDir, 'text-boundary-runtime-limit-proof-obligation-gate.json');
const badTextBoundaryGateMdOut = join(tmpDir, 'text-boundary-runtime-limit-proof-obligation-gate.md');
const badHandoffJsonOut = join(tmpDir, 'handoff-missing-safari-comparison-check.json');
const badHandoffGateJsonOut = join(tmpDir, 'handoff-runtime-limit-proof-obligation-gate.json');
const badHandoffGateMdOut = join(tmpDir, 'handoff-runtime-limit-proof-obligation-gate.md');
const badHandoffValidationJsonOut = join(tmpDir, 'handoff-validation-failed.json');
const badHandoffValidationGateJsonOut = join(tmpDir, 'handoff-validation-runtime-limit-proof-obligation-gate.json');
const badHandoffValidationGateMdOut = join(tmpDir, 'handoff-validation-runtime-limit-proof-obligation-gate.md');
const badCoverageJsonOut = join(tmpDir, 'coverage-missing-spidermonkey-identity-counts.json');
const badCoverageGateJsonOut = join(tmpDir, 'coverage-runtime-limit-proof-obligation-gate.json');
const badCoverageGateMdOut = join(tmpDir, 'coverage-runtime-limit-proof-obligation-gate.md');

test('runtime-limit proof-obligation gate permits only a conservative non-conclusion ledger', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--json-out',
    goodJsonOut,
    '--md-out',
    goodMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(goodJsonOut, 'utf8'));
  assert.equal(report.objective, 'runtime-limit-proof-obligation-gate');
  assert.equal(report.contract, 'static-ledger-proof-obligations');
  assert.equal(report.gate.pass, true);
  assert.equal(report.gate.status, 'incomplete-proof-correctly-blocked');
  assert.equal(report.conclusionAllowed, false);
  assert.equal(report.runtimeClaim.markedConclusion, false);
  assert.equal(report.metadata.coverageLoaded, true);
  assert.equal(report.metadata.comparisonLoaded, true);
  assert.equal(report.metadata.counterexampleScanLoaded, true);
  assert.equal(report.metadata.handoffLoaded, true);
  assert.equal(report.metadata.handoffValidationLoaded, true);
  assert.equal(report.metadata.sourceAuditLoaded, true);
  assert.equal(report.metadata.memoryFrontierLoaded, true);
  assert.equal(report.metadata.targetDistanceLoaded, true);
  assert.equal(report.metadata.textMaterializationBoundaryLoaded, true);
  assert.equal(report.summary.currentCounterexamples, 0);
  assert.equal(report.summary.satisfiedCounterexampleScanGuards, report.summary.requiredCounterexampleScanGuards);
  assert.equal(report.summary.satisfiedHandoffGuards, report.summary.requiredHandoffGuards);
  assert.equal(report.summary.satisfiedHandoffValidationGuards, report.summary.requiredHandoffValidationGuards);
  assert.equal(report.summary.satisfiedSourceAuditGuards, report.summary.requiredSourceAuditGuards);
  assert.equal(report.summary.satisfiedFrontierAuditGuards, report.summary.requiredFrontierAuditGuards);
  assert.equal(report.counterexampleSnapshot.comparisonCounterexampleCount, 0);
  assert.equal(report.counterexampleSnapshot.comparisonObjective, 'same-contract-runtime-comparison');
  assert.equal(report.counterexampleSnapshot.comparisonContractId, 'same-full-string-checksum-contract-not-same-object-shape');
  assert.equal(report.counterexampleSnapshot.comparisonObjectShapeEquivalence, false);
  assert.equal(report.counterexampleSnapshot.comparisonTargetDistanceOnly, true);
  assert.equal(report.counterexampleSnapshot.comparisonPrimaryJsPublicEventCase, 'eventObjectFull');
  assert.match(report.counterexampleSnapshot.comparisonPrimaryJsSourceContract, /synchronous Iterable<Uint8Array\[\]> byte batches/);
  assert.match(report.counterexampleSnapshot.comparisonPrimaryJsSourceContract, /exclude direct ReadableStream/);
  assert.equal(report.counterexampleSnapshot.comparisonMemoryEquivalence, false);
  assert.deepEqual(report.counterexampleSnapshot.comparisonExternalBaselineRuntimeIds, ['woodstox-jvm', 'quick-xml-rust']);
  assert.equal(report.counterexampleSnapshot.comparisonSummaryRowCount, report.counterexampleSnapshot.comparisonRowCount);
  assert.ok(report.counterexampleSnapshot.comparisonJsLargeFullRowCount > 0);
  assert.equal(report.counterexampleSnapshot.scanCounterexampleCount, 0);
  assert.equal(report.counterexampleSnapshot.currentCounterexampleCount, 0);
  assert.equal(report.counterexampleSnapshot.thresholdMiBPerSec, 200);
  assert.equal(report.counterexampleSnapshot.minSizeGiB, 0.999);
  assert.equal(report.counterexampleSnapshot.scanParseErrorCount, 0);
  assert.equal(report.counterexampleSnapshot.scanScannedArtifactCount, report.counterexampleSnapshot.coverageScannedArtifactCount);
  assert.equal(report.counterexampleSnapshot.scanMeasuredRowCount, report.counterexampleSnapshot.coverageMeasuredRowCount);
  assert.ok(report.counterexampleSnapshot.guards.some(item => item.id === 'same-contract-comparison-loaded' && item.satisfied));
  assert.ok(report.counterexampleSnapshot.guards.some(item => item.id === 'same-contract-comparison-contract' && item.satisfied));
  assert.ok(report.counterexampleSnapshot.guards.some(item => item.id === 'same-contract-comparison-row-count' && item.satisfied));
  assert.ok(report.counterexampleSnapshot.guards.some(item => item.id === 'same-contract-comparison-large-js-rows' && item.satisfied));
  assert.ok(report.counterexampleSnapshot.guards.some(item => item.id === 'counterexample-scan-loaded' && item.satisfied));
  assert.ok(report.counterexampleSnapshot.guards.some(item => item.id === 'counterexample-scan-parameters' && item.satisfied));
  assert.ok(report.counterexampleSnapshot.guards.some(item => item.id === 'counterexample-scan-no-parse-errors' && item.satisfied));
  assert.ok(report.counterexampleSnapshot.guards.some(item => item.id === 'counterexample-scan-current-coverage-shape' && item.satisfied));
  assert.ok(report.sourceAuditSnapshot.loaded);
  assert.equal(report.sourceAuditSnapshot.coverageCrosscheckStatus, 'consistent');
  assert.equal(report.sourceAuditSnapshot.coverageSourceModeRows, 474);
  assert.equal(report.sourceAuditSnapshot.coverageNotFullArrayBufferRows, 474);
  assert.equal(report.sourceAuditSnapshot.coverageFullArrayBufferRows, 0);
  assert.equal(report.sourceAuditSnapshot.coverageDirectReadableStreamRows, 17);
  assert.equal(report.sourceAuditSnapshot.primaryParserInput, 'synchronous Iterable<Uint8Array[]>');
  assert.equal(report.sourceAuditSnapshot.primarySyncByteBatchRows, 231);
  assert.equal(report.sourceAuditSnapshot.primaryDirectReadableStreamRows, 0);
  assert.equal(report.sourceAuditSnapshot.primaryAsyncSourceRows, 0);
  assert.equal(report.sourceAuditSnapshot.primaryFullArrayBufferRows, 0);
  assert.equal(report.sourceAuditSnapshot.representativeStreamRowsRespectBackpressure, true);
  assert.ok(report.sourceAuditSnapshot.guards.some(item => item.id === 'source-audit-loaded' && item.satisfied));
  assert.ok(report.sourceAuditSnapshot.guards.some(item => item.id === 'coverage-crosscheck-consistent' && item.satisfied));
  assert.ok(report.sourceAuditSnapshot.guards.some(item => item.id === 'coverage-crosscheck-not-full-arraybuffer' && item.satisfied));
  assert.ok(report.sourceAuditSnapshot.guards.some(item => item.id === 'coverage-crosscheck-readable-stream-separated' && item.satisfied));
  assert.ok(report.sourceAuditSnapshot.guards.some(item => item.id === 'primary-source-sync-byte-batches-only' && item.satisfied));
  assert.ok(report.sourceAuditSnapshot.guards.some(item => item.id === 'representative-stream-backpressure-proven' && item.satisfied));
  assert.ok(report.frontierAuditSnapshot.memory.loaded);
  assert.equal(report.frontierAuditSnapshot.memory.status, 'classified');
  assert.equal(report.frontierAuditSnapshot.memory.fastestBoundedRateMiBPerSec, 185.5);
  assert.equal(report.frontierAuditSnapshot.memory.fastestBoundedMaxMiB, 60.45);
  assert.equal(report.frontierAuditSnapshot.memory.unboundedRows, 17);
  assert.equal(report.frontierAuditSnapshot.memory.boundedRowsWithoutNumericMemoryProof, 0);
  assert.equal(report.frontierAuditSnapshot.memory.unboundedRowsAtOrAbove200MiBPerSec, 0);
  assert.ok(report.frontierAuditSnapshot.targetDistance.loaded);
  assert.equal(report.frontierAuditSnapshot.targetDistance.woodstoxTargetMet, false);
  assert.equal(report.frontierAuditSnapshot.targetDistance.quickXmlTargetMet, false);
  assert.equal(report.frontierAuditSnapshot.targetDistance.sharedFastestJsTargetRow, true);
  assert.equal(report.frontierAuditSnapshot.targetDistance.woodstoxRemainingMiBPerSec, 164.29);
  assert.equal(report.frontierAuditSnapshot.targetDistance.quickXmlRemainingMiBPerSec, 95.06);
  assert.equal(report.frontierAuditSnapshot.targetDistance.fastestJsSourceMode, 'file-backed-sync-iterable-byte-batches');
  assert.equal(report.frontierAuditSnapshot.targetDistance.fastestJsDirectReadableStream, false);
  assert.equal(report.frontierAuditSnapshot.targetDistance.fastestJsFullArrayBufferParserInput, false);
  assert.equal(report.frontierAuditSnapshot.targetDistance.fastestJsBoundedMemory, true);
  assert.equal(report.frontierAuditSnapshot.targetDistance.fastestJsMemoryKind, 'process-rss');
  assert.equal(report.frontierAuditSnapshot.targetDistance.fastestJsMaxRssMiB, 61.77);
  assert.ok(report.frontierAuditSnapshot.textMaterialization.loaded);
  assert.equal(report.frontierAuditSnapshot.textMaterialization.fastestFullRateMiBPerSec, 185.5);
  assert.equal(report.frontierAuditSnapshot.textMaterialization.fullRowsCrossTarget, 0);
  assert.equal(report.frontierAuditSnapshot.textMaterialization.noTextRowsCrossTarget, 4);
  assert.equal(report.frontierAuditSnapshot.textMaterialization.noTrimRowsCrossTarget, 0);
  assert.equal(report.frontierAuditSnapshot.textMaterialization.foldTrimRowsCrossTarget, 0);
  assert.equal(report.frontierAuditSnapshot.textMaterialization.fastestWithoutTextFullStringParity, false);
  assert.ok(report.frontierAuditSnapshot.guards.some(item => item.id === 'memory-frontier-classified' && item.satisfied));
  assert.ok(report.frontierAuditSnapshot.guards.some(item => item.id === 'memory-frontier-no-unbounded-target-row' && item.satisfied));
  assert.ok(report.frontierAuditSnapshot.guards.some(item => item.id === 'target-distance-not-met' && item.satisfied));
  assert.ok(report.frontierAuditSnapshot.guards.some(item => item.id === 'target-distance-js-contract-primary-bounded' && item.satisfied));
  assert.ok(report.frontierAuditSnapshot.guards.some(item => item.id === 'text-frontier-no-full-counterexample' && item.satisfied));
  assert.ok(report.frontierAuditSnapshot.guards.some(item => item.id === 'text-frontier-trim-variants-below-target' && item.satisfied));
  assert.ok(report.coverageSnapshot.loaded);
  assert.deepEqual(report.coverageSnapshot.activeObligationIds, [
    'safari-jsc-source-and-browser-rows-open',
    'codegen-traces-open',
  ]);
  assert.deepEqual(report.coverageSnapshot.spiderMonkeyDiagnostics.selectedRowIdentityStatusCounts, {
    'not-claimed': 4,
    'not-claimed-non-stax-diagnostic': 7,
  });
  assert.ok(report.coverageSnapshot.guards.some(item => item.id === 'coverage-loaded' && item.satisfied));
  assert.ok(report.coverageSnapshot.guards.some(item => item.id === 'spidermonkey-identity-status-counts-present' && item.satisfied));
  assert.ok(report.coverageSnapshot.guards.some(item => item.id === 'spidermonkey-non-stax-diagnostic-rows-visible' && item.satisfied));
  assert.equal(report.coverageSnapshot.byId['allocation-profiles-open'].status, 'covered');
  assert.equal(report.coverageSnapshot.byId['independent-corpus-suite-open'].status, 'covered');
  assert.equal(report.summary.satisfiedClaimGuards, report.summary.requiredClaimGuards);
  assert.equal(report.summary.presentArtifactMentions, report.summary.requiredArtifactMentions);
  assert.equal(report.summary.disclosedOpenObligations, report.summary.requiredOpenObligations);
  assert.equal(report.summary.satisfiedProofRules, report.summary.requiredProofRules);
  assert.ok(report.openObligations.some(item => item.id === 'safari-jsc-source-and-browser-rows-open' && item.disclosed));
  assert.ok(report.openObligations.some(item => item.id === 'safari-jsc-source-and-browser-rows-open' && item.coverageStatus === 'open'));
  assert.ok(report.openObligations.some(item => item.id === 'codegen-traces-open' && item.coverageStatus === 'partial'));
  assert.ok(report.openObligations.some(item => item.id === 'allocation-profiles-open' && item.coverageStatus === 'covered'));
  assert.ok(report.openObligations.some(item => item.id === 'independent-corpus-suite-open' && item.coverageStatus === 'covered'));
  assert.ok(report.artifactMentions.some(item => item.file === 'firefox-spidermonkey-textdecoder-source-pin-audit.md' && item.present));
  assert.ok(report.artifactMentions.some(item => item.file === 'firefox-bidi-candidate-headroom.md' && item.present));
  assert.ok(report.artifactMentions.some(item => item.file === 'stream-source-consumption-backpressure-counters.md' && item.present));
  assert.ok(report.artifactMentions.some(item => item.file === 'runtime-proof-gap-handoff.md' && item.present));
  assert.ok(report.artifactMentions.some(item => item.file === 'segment-scan-headroom.md' && item.present));
  assert.ok(report.artifactMentions.some(item => item.file === 'segment-tokenizer-headroom.md' && item.present));
  assert.ok(report.artifactMentions.some(item => item.file === 'segment-tokenizer-string-frontier.md' && item.present));
  assert.ok(report.proofRules.some(item => item.id === 'target-contract-not-object-shape' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'lazy-getters-reopen-burden' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'source-shapes-separated' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'byte-batches-not-full-arraybuffer' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'byte-batch-backpressure-preserved' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'raw-frame-source-shapes-backpressure-counted' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'handoff-source-consumption-classified' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'handoff-external-target-distance-classified' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'handoff-text-materialization-frontier-classified' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'segment-headroom-not-stax-counterexample' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'segment-string-frontier-below-threshold' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'woodstox-reference-not-identical-input' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'same-fixture-woodstox-target-unmet' && item.satisfied));
  assert.ok(report.handoffSnapshot.loaded);
  assert.deepEqual(report.handoffSnapshot.activeObligationIds, [
    'safari-jsc-source-and-browser-rows-open',
    'codegen-traces-open',
  ]);
  assert.deepEqual(report.handoffSnapshot.handoffIds, [
    'safari-webkit-browser-row-handoff',
    'spidermonkey-codegen-handoff',
  ]);
  assert.ok(report.handoffSnapshot.guards.some(item => item.id === 'handoff-loaded' && item.satisfied));
  assert.ok(report.handoffSnapshot.guards.some(item => item.id === 'safari-primary-byte-batch-contract' && item.satisfied));
  assert.ok(report.handoffSnapshot.guards.some(item => item.id === 'safari-closure-checks-primary-bounded' && item.satisfied));
  assert.ok(report.handoffSnapshot.guards.some(item => item.id === 'safari-closure-checks-same-contract-comparison' && item.satisfied));
  assert.ok(report.handoffSnapshot.guards.some(item => item.id === 'safari-closure-checks-1gib-primary' && item.satisfied));
  assert.ok(report.handoffSnapshot.guards.some(item => item.id === 'safari-local-availability-blocker' && item.satisfied));
  assert.ok(report.handoffSnapshot.guards.some(item => item.id === 'spidermonkey-emitted-ir-required' && item.satisfied));
  assert.ok(report.handoffSnapshot.guards.some(item => item.id === 'spidermonkey-materialized-scope-not-enough' && item.satisfied));
  assert.ok(report.handoffSnapshot.guards.some(item => item.id === 'spidermonkey-unchanged-stax-required' && item.satisfied));
  assert.ok(report.handoffSnapshot.guards.some(item => item.id === 'spidermonkey-same-contract-comparison-required' && item.satisfied));
  assert.ok(report.handoffSnapshot.guards.some(item => item.id === 'spidermonkey-closing-metadata-required' && item.satisfied));
  assert.ok(report.handoffSnapshot.guards.some(item => item.id === 'spidermonkey-diagnostic-row-identity-blocker' && item.satisfied));
  assert.ok(report.handoffSnapshot.guards.some(item => item.id === 'spidermonkey-closure-frontier-blockers' && item.satisfied));
  assert.ok(report.handoffSnapshot.guards.some(item => item.id === 'spidermonkey-contradicted-closure-claims-clear' && item.satisfied));
  assert.ok(report.handoffValidationSnapshot.loaded);
  assert.equal(report.handoffValidationSnapshot.pass, true);
  assert.equal(report.handoffValidationSnapshot.allContractsPresent, true);
  assert.equal(report.handoffValidationSnapshot.unhandledObligationCount, 0);
  assert.equal(report.handoffValidationSnapshot.validatedHandoffGeneratedAt, report.handoffSnapshot.generatedAt);
  assert.equal(report.handoffValidationSnapshot.currentHandoffGeneratedAt, report.handoffSnapshot.generatedAt);
  assert.ok(report.handoffValidationSnapshot.guards.some(item => item.id === 'handoff-validation-loaded' && item.satisfied));
  assert.ok(report.handoffValidationSnapshot.guards.some(item => item.id === 'handoff-validation-pass' && item.satisfied));
  assert.ok(report.handoffValidationSnapshot.guards.some(item => item.id === 'handoff-validation-contracts-present' && item.satisfied));
  assert.ok(report.handoffValidationSnapshot.guards.some(item => item.id === 'handoff-validation-current-handoff' && item.satisfied));

  const markdown = readFileSync(goodMdOut, 'utf8');
  assert.match(markdown, /# Runtime-Limit Proof Obligation Gate/);
  assert.match(markdown, /Gate pass: yes/);
  assert.match(markdown, /Conclusion allowed: no/);
  assert.match(markdown, /runtime-limit-remains-hypothesis/);
  assert.match(markdown, /safari-jsc-source-and-browser-rows-open/);
  assert.match(markdown, /## Coverage Snapshot/);
  assert.match(markdown, /Active coverage obligations: safari-jsc-source-and-browser-rows-open, codegen-traces-open/);
  assert.match(markdown, /allocation-profiles-open, non-v8-browser-coverage-open, independent-corpus-suite-open/);
  assert.match(markdown, /SpiderMonkey selected row identity statuses: not-claimed=4, not-claimed-non-stax-diagnostic=7/);
  assert.match(markdown, /spidermonkey-identity-status-counts-present/);
  assert.match(markdown, /spidermonkey-non-stax-diagnostic-rows-visible/);
  assert.match(markdown, /## Counterexample Snapshot/);
  assert.match(markdown, /Same-contract comparison contract: same-full-string-checksum-contract-not-same-object-shape/);
  assert.match(markdown, /objectShapeEquivalence=false; memoryEquivalence=false/);
  assert.match(markdown, /Same-contract comparison rows: 289\/289; largeFullJsRows=239/);
  assert.match(markdown, /Same-contract comparison counterexamples: 0/);
  assert.match(markdown, /same-contract-comparison-contract/);
  assert.match(markdown, /same-contract-comparison-row-count/);
  assert.match(markdown, /Counterexample scan contract: threshold=200\.00 MiB\/s, minSizeGiB=1\.00, parseErrors=0/);
  assert.match(markdown, /Counterexample scan coverage shape: artifacts=224\/224, measuredRows=1255\/1255/);
  assert.match(markdown, /counterexample-scan-current-coverage-shape/);
  assert.match(markdown, /Runtime counterexample scan counterexamples: 0/);
  assert.match(markdown, /Current release counterexamples: 0/);
  assert.match(markdown, /## Handoff Snapshot/);
  assert.match(markdown, /Handoff IDs: safari-webkit-browser-row-handoff, spidermonkey-codegen-handoff/);
  assert.match(markdown, /safari-primary-byte-batch-contract/);
  assert.match(markdown, /safari-closure-checks-same-contract-comparison/);
  assert.match(markdown, /safari-closure-checks-1gib-primary/);
  assert.match(markdown, /safari-local-availability-blocker/);
  assert.match(markdown, /spidermonkey-materialized-scope-not-enough/);
  assert.match(markdown, /spidermonkey-unchanged-stax-required/);
  assert.match(markdown, /spidermonkey-same-contract-comparison-required/);
  assert.match(markdown, /spidermonkey-closing-metadata-required/);
  assert.match(markdown, /spidermonkey-diagnostic-row-identity-blocker/);
  assert.match(markdown, /spidermonkey-closure-frontier-blockers/);
  assert.match(markdown, /spidermonkey-contradicted-closure-claims-clear/);
  assert.match(markdown, /## Handoff Validation Snapshot/);
  assert.match(markdown, /Handoff validation loaded: yes/);
  assert.match(markdown, /Handoff validation target handoff generatedAt:/);
  assert.match(markdown, /Handoff validation pass: yes/);
  assert.match(markdown, /handoff-validation-contracts-present/);
  assert.match(markdown, /handoff-validation-current-handoff/);
  assert.match(markdown, /## Source Audit Snapshot/);
  assert.equal(report.sourceAuditSnapshot.inputComparisonGeneratedAt, report.counterexampleSnapshot.comparisonGeneratedAt);
  assert.equal(report.sourceAuditSnapshot.currentComparisonGeneratedAt, report.counterexampleSnapshot.comparisonGeneratedAt);
  assert.equal(report.sourceAuditSnapshot.inputCoverageGeneratedAt, report.coverageSnapshot.generatedAt);
  assert.equal(report.sourceAuditSnapshot.currentCoverageGeneratedAt, report.coverageSnapshot.generatedAt);
  assert.ok(report.sourceAuditSnapshot.guards.some(item => item.id === 'source-audit-current-inputs' && item.satisfied));
  assert.match(markdown, /Source audit inputs: comparison=/);
  assert.match(markdown, /Primary parser input: synchronous Iterable<Uint8Array\[\]>/);
  assert.match(markdown, /Primary sync byte-batch rows: 231/);
  assert.match(markdown, /Primary direct ReadableStream rows: 0/);
  assert.match(markdown, /Coverage source-mode rows: 474/);
  assert.match(markdown, /coverage-crosscheck-not-full-arraybuffer/);
  assert.match(markdown, /coverage-crosscheck-readable-stream-separated/);
  assert.match(markdown, /primary-source-sync-byte-batches-only/);
  assert.match(markdown, /## Frontier Audit Snapshot/);
  assert.equal(report.frontierAuditSnapshot.memory.inputComparisonGeneratedAt, report.counterexampleSnapshot.comparisonGeneratedAt);
  assert.equal(report.frontierAuditSnapshot.targetDistance.inputComparisonGeneratedAt, report.counterexampleSnapshot.comparisonGeneratedAt);
  assert.equal(report.frontierAuditSnapshot.textMaterialization.inputComparisonGeneratedAt, report.counterexampleSnapshot.comparisonGeneratedAt);
  assert.ok(report.frontierAuditSnapshot.guards.some(item => item.id === 'frontier-audits-current-comparison' && item.satisfied));
  assert.match(markdown, /Frontier audit comparison inputs:/);
  assert.match(markdown, /Fastest bounded JS row: 185\.50 MiB\/s at 60\.45 MiB/);
  assert.match(markdown, /Unbounded rows at or above 200 MiB\/s: 0/);
  assert.match(markdown, /Bounded rows without numeric memory proof: 0/);
  assert.match(markdown, /Woodstox 0\.9x target met: no/);
  assert.match(markdown, /quick-xml 0\.9x target met: no/);
  assert.match(markdown, /Shared JS target row: yes/);
  assert.match(markdown, /Target JS contract: sourceMode=file-backed-sync-iterable-byte-batches, directReadableStream=no, fullArrayBufferParserInput=no, boundedMemory=yes, memoryKind=process-rss, maxRssMiB=61\.77/);
  assert.match(markdown, /Full-string rows crossing 200 MiB\/s: 0/);
  assert.match(markdown, /No-trim rows crossing 200 MiB\/s: 0/);
  assert.match(markdown, /Fold-trim rows crossing 200 MiB\/s: 0/);
  assert.match(markdown, /Without-text full-string parity: no/);
  assert.match(markdown, /## Proof Rules/);
  assert.match(markdown, /target-contract-not-object-shape/);
  assert.match(markdown, /lazy-getters-reopen-burden/);
  assert.match(markdown, /source-shapes-separated/);
  assert.match(markdown, /byte-batch-backpressure-preserved/);
  assert.match(markdown, /raw-frame-source-shapes-backpressure-counted/);
  assert.match(markdown, /Representative stream rows respect backpressure: yes/);
  assert.match(markdown, /handoff-source-consumption-classified/);
  assert.match(markdown, /handoff-external-target-distance-classified/);
  assert.match(markdown, /handoff-text-materialization-frontier-classified/);
  assert.match(markdown, /segment-headroom-not-stax-counterexample/);
  assert.match(markdown, /segment-string-frontier-below-threshold/);
  assert.match(markdown, /woodstox-reference-not-identical-input/);
  assert.match(markdown, /same-fixture-woodstox-target-unmet/);
  assert.match(markdown, /Current coverage audit blockers: safari-jsc-source-and-browser-rows-open, codegen-traces-open/);
  assert.match(markdown, /Static disclosure guards may include evidence families that the latest coverage audit already marks covered/);
  assert.match(markdown, /A future 200 MiB\/s\+ bounded-memory full-string JavaScript row remains a counterexample/);
});

test('runtime-limit proof-obligation gate fails if coverage omits SpiderMonkey identity status counts', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const coverage = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-coverage-audit.json'), 'utf8'));
  delete coverage.coverage.spiderMonkeyDiagnostics.selectedRowIdentityStatusCounts;
  writeFileSync(badCoverageJsonOut, `${JSON.stringify(coverage, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--coverage-json',
    badCoverageJsonOut,
    '--json-out',
    badCoverageGateJsonOut,
    '--md-out',
    badCoverageGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(badCoverageGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.ok(report.coverageSnapshot.guards.some(item =>
    item.id === 'spidermonkey-identity-status-counts-present'
    && !item.satisfied
  ));
  assert.ok(report.coverageSnapshot.guards.some(item =>
    item.id === 'spidermonkey-non-stax-diagnostic-rows-visible'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error => /selectedRowIdentityStatusCounts/.test(error)));

  const markdown = readFileSync(badCoverageGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /SpiderMonkey selected row identity statuses: none/);
  assert.match(markdown, /spidermonkey-identity-status-counts-present/);
});

test('runtime-limit proof-obligation gate fails if Safari handoff omits same-contract comparison closure check', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const safari = handoff.handoffs.find(item => item.id === 'safari-webkit-browser-row-handoff');
  safari.closureChecks = safari.closureChecks.filter(item => !/primaryRowsInSameContractComparison/.test(item));
  writeFileSync(badHandoffJsonOut, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--handoff-json',
    badHandoffJsonOut,
    '--json-out',
    badHandoffGateJsonOut,
    '--md-out',
    badHandoffGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(badHandoffGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.ok(report.handoffSnapshot.guards.some(item =>
    item.id === 'safari-closure-checks-same-contract-comparison'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error => /primaryRowsInSameContractComparison/.test(error)));

  const markdown = readFileSync(badHandoffGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /primaryRowsInSameContractComparison/);
});

test('runtime-limit proof-obligation gate fails if Safari handoff omits 1GiB primary closure checks', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const safari = handoff.handoffs.find(item => item.id === 'safari-webkit-browser-row-handoff');
  safari.closureChecks = safari.closureChecks.filter(item =>
    !/largeBoundedPrimarySyncByteBatchRowsRecorded/.test(item)
    && !/largePrimaryRowsInSameContractComparison/.test(item)
  );
  writeFileSync(badHandoffJsonOut, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--handoff-json',
    badHandoffJsonOut,
    '--json-out',
    badHandoffGateJsonOut,
    '--md-out',
    badHandoffGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(badHandoffGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.ok(report.handoffSnapshot.guards.some(item =>
    item.id === 'safari-closure-checks-1gib-primary'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error => /largeBoundedPrimarySyncByteBatchRowsRecorded/.test(error)));
  assert.ok(report.gate.errors.some(error => /largePrimaryRowsInSameContractComparison/.test(error)));

  const markdown = readFileSync(badHandoffGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /largeBoundedPrimarySyncByteBatchRowsRecorded/);
  assert.match(markdown, /largePrimaryRowsInSameContractComparison/);
});

test('runtime-limit proof-obligation gate fails if Safari handoff omits local availability blocker', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const safari = handoff.handoffs.find(item => item.id === 'safari-webkit-browser-row-handoff');
  safari.localClosure.blockers = safari.localClosure.blockers
    .filter(item =>
      !/Current host cannot run Safari\/WebKit browser rows/.test(item)
      && !/Safari\/WebKit closure audit checks candidateRows=0/.test(item)
    );
  writeFileSync(badHandoffJsonOut, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--handoff-json',
    badHandoffJsonOut,
    '--json-out',
    badHandoffGateJsonOut,
    '--md-out',
    badHandoffGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(badHandoffGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.ok(report.handoffSnapshot.guards.some(item =>
    item.id === 'safari-local-availability-blocker'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error => /local Safari availability blocker/.test(error)));

  const markdown = readFileSync(badHandoffGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /safari-local-availability-blocker/);
});

test('runtime-limit proof-obligation gate fails if SpiderMonkey handoff omits same-contract comparison closure check', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(item => item.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.closureChecks = spiderMonkey.closureChecks.filter(item => !/selected row id must match a current same-contract/.test(item));
  writeFileSync(badHandoffJsonOut, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--handoff-json',
    badHandoffJsonOut,
    '--json-out',
    badHandoffGateJsonOut,
    '--md-out',
    badHandoffGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(badHandoffGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.ok(report.handoffSnapshot.guards.some(item =>
    item.id === 'spidermonkey-same-contract-comparison-required'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error => /selected row id/.test(error)));

  const markdown = readFileSync(badHandoffGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /selected row id/);
});

test('runtime-limit proof-obligation gate fails if SpiderMonkey handoff omits diagnostic row identity blockers', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(item => item.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .map(item => item.replace(/, and selectedRowIdentityStatus=not-claimed-non-stax-diagnostic/g, ''));
  writeFileSync(badHandoffJsonOut, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--handoff-json',
    badHandoffJsonOut,
    '--json-out',
    badHandoffGateJsonOut,
    '--md-out',
    badHandoffGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(badHandoffGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.ok(report.handoffSnapshot.guards.some(item =>
    item.id === 'spidermonkey-diagnostic-row-identity-blocker'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error => /selectedRowIdentityStatus=not-claimed-non-stax-diagnostic/.test(error)));

  const markdown = readFileSync(badHandoffGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /selectedRowIdentityStatus=not-claimed-non-stax-diagnostic/);
});

test('runtime-limit proof-obligation gate fails if SpiderMonkey handoff omits closing metadata requirements', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(item => item.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.closureChecks = spiderMonkey.closureChecks.filter(item => !/closing artifact must include runtime\/build identity/.test(item));
  writeFileSync(badHandoffJsonOut, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--handoff-json',
    badHandoffJsonOut,
    '--json-out',
    badHandoffGateJsonOut,
    '--md-out',
    badHandoffGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(badHandoffGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.ok(report.handoffSnapshot.guards.some(item =>
    item.id === 'spidermonkey-closing-metadata-required'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error => /diagnostic flags/.test(error)));

  const markdown = readFileSync(badHandoffGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /diagnostic flags/);
});

test('runtime-limit proof-obligation gate fails if SpiderMonkey handoff omits closure frontier blockers', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(item => item.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .filter(item => !/SpiderMonkey codegen closure frontier has closestBlockedCandidateCount/.test(item));
  writeFileSync(badHandoffJsonOut, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--handoff-json',
    badHandoffJsonOut,
    '--json-out',
    badHandoffGateJsonOut,
    '--md-out',
    badHandoffGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(badHandoffGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.ok(report.handoffSnapshot.guards.some(item =>
    item.id === 'spidermonkey-closure-frontier-blockers'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error => /closest blocked candidates/.test(error)));

  const markdown = readFileSync(badHandoffGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /spidermonkey-closure-frontier-blockers/);
});

test('runtime-limit proof-obligation gate fails if SpiderMonkey handoff omits contradicted closure claim count', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(item => item.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .map(item => item.replace(/, contradictedClosureClaimCount=0/g, ''));
  writeFileSync(badHandoffJsonOut, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--handoff-json',
    badHandoffJsonOut,
    '--json-out',
    badHandoffGateJsonOut,
    '--md-out',
    badHandoffGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(badHandoffGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.ok(report.handoffSnapshot.guards.some(item =>
    item.id === 'spidermonkey-contradicted-closure-claims-clear'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error => /contradictedClosureClaimCount=0/.test(error)));

  const markdown = readFileSync(badHandoffGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /spidermonkey-contradicted-closure-claims-clear/);
});

test('runtime-limit proof-obligation gate fails if handoff validation does not pass', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const validation = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-handoff-validation.json'), 'utf8'));
  validation.summary.pass = false;
  validation.summary.allContractsPresent = false;
  validation.handoffChecks = validation.handoffChecks.map(check =>
    check.id === 'spidermonkey-codegen-handoff'
      ? { ...check, contractsPresent: false }
      : check
  );
  writeFileSync(badHandoffValidationJsonOut, `${JSON.stringify(validation, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--handoff-validation-json',
    badHandoffValidationJsonOut,
    '--json-out',
    badHandoffValidationGateJsonOut,
    '--md-out',
    badHandoffValidationGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(badHandoffValidationGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.ok(report.handoffValidationSnapshot.guards.some(item =>
    item.id === 'handoff-validation-pass'
    && !item.satisfied
  ));
  assert.ok(report.handoffValidationSnapshot.guards.some(item =>
    item.id === 'handoff-validation-contracts-present'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error => /runtime-proof-handoff-validation\.json summary\.pass/.test(error)));
  assert.ok(report.gate.errors.some(error => /all required contracts/.test(error)));

  const markdown = readFileSync(badHandoffValidationGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /Handoff validation pass: no/);
  assert.match(markdown, /handoff-validation-contracts-present/);
});

test('runtime-limit proof-obligation gate fails if handoff validation targets stale handoff', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  handoff.generatedAt = '2026-06-01T00:00:00.000Z';
  writeFileSync(badHandoffJsonOut, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--handoff-json',
    badHandoffJsonOut,
    '--json-out',
    badHandoffValidationGateJsonOut,
    '--md-out',
    badHandoffValidationGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(badHandoffValidationGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.notEqual(report.handoffValidationSnapshot.validatedHandoffGeneratedAt, report.handoffValidationSnapshot.currentHandoffGeneratedAt);
  assert.ok(report.handoffValidationSnapshot.guards.some(item =>
    item.id === 'handoff-validation-current-handoff'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error => /currently loaded runtime-proof-gap-handoff\.json generatedAt/.test(error)));

  const markdown = readFileSync(badHandoffValidationGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /handoff-validation-current-handoff/);
});

test('runtime-limit proof-obligation gate fails if current artifacts contain a counterexample', () => {
  resetTmp();
  const comparisonJson = join(tmpDir, 'same-contract-runtime-comparison-counterexample.json');
  const scanJson = join(tmpDir, 'runtime-counterexample-scan-counterexample.json');
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  writeFileSync(comparisonJson, `${JSON.stringify({
    generatedAt: '2026-06-01T00:00:00.000Z',
    objective: 'same-contract-runtime-comparison',
    summary: {
      jsRuntimeCounterexamples200MiB: 1,
    },
  }, null, 2)}\n`);
  writeFileSync(scanJson, `${JSON.stringify({
    generatedAt: '2026-06-01T00:00:01.000Z',
    objective: 'runtime-counterexample-scan',
    summary: {
      counterexampleCount: 0,
    },
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--comparison-json',
    comparisonJson,
    '--counterexample-scan-json',
    scanJson,
    '--json-out',
    counterexampleJsonOut,
    '--md-out',
    counterexampleMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(counterexampleJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.equal(report.conclusionAllowed, false);
  assert.equal(report.summary.currentCounterexamples, 1);
  assert.equal(report.counterexampleSnapshot.comparisonCounterexampleCount, 1);
  assert.equal(report.counterexampleSnapshot.scanCounterexampleCount, 0);
  assert.ok(report.gate.errors.some(error => /Current release artifacts contain 1 bounded full-string JavaScript counterexample/.test(error)));

  const markdown = readFileSync(counterexampleMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /Current release artifacts contain 1 bounded full-string JavaScript counterexample/);
  assert.match(markdown, /Same-contract comparison counterexamples: 1/);
  assert.match(markdown, /Runtime counterexample scan counterexamples: 0/);
  assert.match(markdown, /Current release counterexamples: 1/);
});

test('runtime-limit proof-obligation gate fails if same-contract comparison semantics drift', () => {
  resetTmp();
  const comparisonJson = join(tmpDir, 'same-contract-runtime-comparison-bad-contract.json');
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const comparison = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'same-contract-runtime-comparison.json'), 'utf8'));
  comparison.contract = 'same-object-shape';
  comparison.comparisonContract.objectShapeEquivalence = true;
  comparison.comparisonContract.targetDistanceOnly = false;
  comparison.comparisonContract.primaryJsPublicEventCase = 'rawFrameNameId';
  comparison.comparisonContract.primaryJsSourceContract = 'direct ReadableStream rows are equivalent';
  comparison.comparisonContract.memoryEquivalence = true;
  comparison.summary.rowCount += 1;
  writeFileSync(comparisonJson, `${JSON.stringify(comparison, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--comparison-json',
    comparisonJson,
    '--json-out',
    counterexampleJsonOut,
    '--md-out',
    counterexampleMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(counterexampleJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.equal(report.counterexampleSnapshot.comparisonContractId, 'same-object-shape');
  assert.equal(report.counterexampleSnapshot.comparisonObjectShapeEquivalence, true);
  assert.equal(report.counterexampleSnapshot.comparisonMemoryEquivalence, true);
  assert.notEqual(report.counterexampleSnapshot.comparisonSummaryRowCount, report.counterexampleSnapshot.comparisonRowCount);
  assert.ok(report.counterexampleSnapshot.guards.some(item =>
    item.id === 'same-contract-comparison-contract'
    && !item.satisfied
  ));
  assert.ok(report.counterexampleSnapshot.guards.some(item =>
    item.id === 'same-contract-comparison-row-count'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error => /same-contract-comparison-contract/.test(error)));
  assert.ok(report.gate.errors.some(error => /same-contract-comparison-row-count/.test(error)));

  const markdown = readFileSync(counterexampleMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /Same-contract comparison contract: same-object-shape/);
  assert.match(markdown, /objectShapeEquivalence=true; memoryEquivalence=true/);
  assert.match(markdown, /same-contract-comparison-contract/);
  assert.match(markdown, /same-contract-comparison-row-count/);
});

test('runtime-limit proof-obligation gate fails if counterexample scan contract or coverage shape is stale', () => {
  resetTmp();
  const scanJson = join(tmpDir, 'runtime-counterexample-scan-stale-shape.json');
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const scan = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-counterexample-scan.json'), 'utf8'));
  scan.parameters.thresholdMiBPerSec = 250;
  scan.summary.parseErrorCount = 1;
  scan.summary.scannedArtifactCount -= 1;
  scan.summary.measuredRowCount -= 1;
  writeFileSync(scanJson, `${JSON.stringify(scan, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--counterexample-scan-json',
    scanJson,
    '--json-out',
    counterexampleJsonOut,
    '--md-out',
    counterexampleMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(counterexampleJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.equal(report.counterexampleSnapshot.thresholdMiBPerSec, 250);
  assert.equal(report.counterexampleSnapshot.scanParseErrorCount, 1);
  assert.notEqual(report.counterexampleSnapshot.scanScannedArtifactCount, report.counterexampleSnapshot.coverageScannedArtifactCount);
  assert.notEqual(report.counterexampleSnapshot.scanMeasuredRowCount, report.counterexampleSnapshot.coverageMeasuredRowCount);
  assert.ok(report.counterexampleSnapshot.guards.some(item =>
    item.id === 'counterexample-scan-parameters'
    && !item.satisfied
  ));
  assert.ok(report.counterexampleSnapshot.guards.some(item =>
    item.id === 'counterexample-scan-no-parse-errors'
    && !item.satisfied
  ));
  assert.ok(report.counterexampleSnapshot.guards.some(item =>
    item.id === 'counterexample-scan-current-coverage-shape'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error => /counterexample-scan-current-coverage-shape/.test(error)));

  const markdown = readFileSync(counterexampleMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /counterexample-scan-parameters/);
  assert.match(markdown, /counterexample-scan-no-parse-errors/);
  assert.match(markdown, /counterexample-scan-current-coverage-shape/);
});

test('runtime-limit proof-obligation gate fails if primary source audit mixes async or direct stream rows', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const sourceAudit = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'source-consumption-shape-audit.json'), 'utf8'));
  sourceAudit.summary.primarySourceContract = 'mixed-async-source-boundary';
  sourceAudit.summary.primaryParserInput = 'Web ReadableStream<Uint8Array>';
  sourceAudit.summary.primarySourceBoundary = 'async reader.read() parser loop';
  sourceAudit.summary.primarySyncByteBatchRows = 0;
  sourceAudit.summary.primaryDirectReadableStreamRows = 1;
  sourceAudit.summary.primaryAsyncSourceRows = 1;
  sourceAudit.summary.primaryFullArrayBufferRows = 1;
  sourceAudit.summary.primaryUnknownSourceModeRows = 0;
  writeFileSync(badSourceAuditJsonOut, `${JSON.stringify(sourceAudit, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--source-audit-json',
    badSourceAuditJsonOut,
    '--json-out',
    badSourceAuditGateJsonOut,
    '--md-out',
    badSourceAuditGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badSourceAuditGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.equal(report.sourceAuditSnapshot.primaryParserInput, 'Web ReadableStream<Uint8Array>');
  assert.equal(report.sourceAuditSnapshot.primarySyncByteBatchRows, 0);
  assert.equal(report.sourceAuditSnapshot.primaryDirectReadableStreamRows, 1);
  assert.equal(report.sourceAuditSnapshot.primaryAsyncSourceRows, 1);
  assert.equal(report.sourceAuditSnapshot.primaryFullArrayBufferRows, 1);
  assert.ok(report.sourceAuditSnapshot.guards.some(item =>
    item.id === 'primary-source-sync-byte-batches-only'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error =>
    /Missing source audit guard primary-source-sync-byte-batches-only/.test(error)
  ));

  const markdown = readFileSync(badSourceAuditGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /Primary parser input: Web ReadableStream<Uint8Array>/);
  assert.match(markdown, /primary-source-sync-byte-batches-only/);
});

test('runtime-limit proof-obligation gate fails if source audit targets stale comparison or coverage', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const sourceAudit = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'source-consumption-shape-audit.json'), 'utf8'));
  sourceAudit.inputs.comparisonGeneratedAt = '2026-06-01T00:00:00.000Z';
  sourceAudit.inputs.coverageGeneratedAt = '2026-06-01T00:00:01.000Z';
  writeFileSync(badSourceAuditJsonOut, `${JSON.stringify(sourceAudit, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--source-audit-json',
    badSourceAuditJsonOut,
    '--json-out',
    badSourceAuditGateJsonOut,
    '--md-out',
    badSourceAuditGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badSourceAuditGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.notEqual(report.sourceAuditSnapshot.inputComparisonGeneratedAt, report.sourceAuditSnapshot.currentComparisonGeneratedAt);
  assert.notEqual(report.sourceAuditSnapshot.inputCoverageGeneratedAt, report.sourceAuditSnapshot.currentCoverageGeneratedAt);
  assert.ok(report.sourceAuditSnapshot.guards.some(item =>
    item.id === 'source-audit-current-inputs'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error =>
    /Missing source audit guard source-audit-current-inputs/.test(error)
  ));

  const markdown = readFileSync(badSourceAuditGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /Source audit inputs: comparison=/);
  assert.match(markdown, /source-audit-current-inputs/);
});

test('runtime-limit proof-obligation gate fails if representative stream rows lose backpressure proof', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const sourceAudit = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'source-consumption-shape-audit.json'), 'utf8'));
  sourceAudit.summary.representativeStreamRowsRespectBackpressure = false;
  writeFileSync(badSourceAuditBackpressureJsonOut, `${JSON.stringify(sourceAudit, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--source-audit-json',
    badSourceAuditBackpressureJsonOut,
    '--json-out',
    badSourceAuditBackpressureGateJsonOut,
    '--md-out',
    badSourceAuditBackpressureGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badSourceAuditBackpressureGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.equal(report.sourceAuditSnapshot.representativeStreamRowsRespectBackpressure, false);
  assert.ok(report.sourceAuditSnapshot.guards.some(item =>
    item.id === 'representative-stream-backpressure-proven'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error =>
    /Missing source audit guard representative-stream-backpressure-proven/.test(error)
  ));

  const markdown = readFileSync(badSourceAuditBackpressureGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /Representative stream rows respect backpressure: no/);
  assert.match(markdown, /representative-stream-backpressure-proven/);
});

test('runtime-limit proof-obligation gate fails if unbounded memory rows cross the target', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const memoryFrontier = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'memory-frontier-audit.json'), 'utf8'));
  memoryFrontier.summary.unboundedRowsAtOrAbove200MiBPerSec = 1;
  memoryFrontier.summary.fastestUnboundedRow = {
    runtimeLabel: 'Synthetic JS',
    caseId: 'unboundedFastFull',
    rateMiBPerSec: 201,
    memoryKind: 'process-rss',
    maxMiB: 2048,
    sourceArtifact: 'synthetic-memory-frontier.json',
    boundedMemory: false,
  };
  writeFileSync(badMemoryFrontierJsonOut, `${JSON.stringify(memoryFrontier, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--memory-frontier-json',
    badMemoryFrontierJsonOut,
    '--json-out',
    badMemoryFrontierGateJsonOut,
    '--md-out',
    badMemoryFrontierGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badMemoryFrontierGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.equal(report.frontierAuditSnapshot.memory.unboundedRowsAtOrAbove200MiBPerSec, 1);
  assert.ok(report.frontierAuditSnapshot.guards.some(item =>
    item.id === 'memory-frontier-no-unbounded-target-row'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error =>
    /Missing frontier audit guard memory-frontier-no-unbounded-target-row/.test(error)
  ));

  const markdown = readFileSync(badMemoryFrontierGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /Unbounded rows at or above 200 MiB\/s: 1/);
  assert.match(markdown, /memory-frontier-no-unbounded-target-row/);
});

test('runtime-limit proof-obligation gate fails if frontier audits target stale comparison', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const textBoundary = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'text-materialization-boundary-audit.json'), 'utf8'));
  textBoundary.inputs.comparisonGeneratedAt = '2026-06-01T00:00:00.000Z';
  writeFileSync(badTextBoundaryJsonOut, `${JSON.stringify(textBoundary, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--text-materialization-boundary-json',
    badTextBoundaryJsonOut,
    '--json-out',
    badTextBoundaryGateJsonOut,
    '--md-out',
    badTextBoundaryGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badTextBoundaryGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.notEqual(report.frontierAuditSnapshot.textMaterialization.inputComparisonGeneratedAt, report.frontierAuditSnapshot.textMaterialization.currentComparisonGeneratedAt);
  assert.ok(report.frontierAuditSnapshot.guards.some(item =>
    item.id === 'frontier-audits-current-comparison'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error =>
    /Missing frontier audit guard frontier-audits-current-comparison/.test(error)
  ));

  const markdown = readFileSync(badTextBoundaryGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /Frontier audit comparison inputs:/);
  assert.match(markdown, /frontier-audits-current-comparison/);
});

test('runtime-limit proof-obligation gate fails if target-distance JS row is not primary bounded sync input', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const targetDistance = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'target-distance-audit.json'), 'utf8'));
  targetDistance.summary.sameFixtureFastestJsContract.sourceMode = 'fetch-readable-stream-pull';
  targetDistance.summary.sameFixtureFastestJsContract.directReadableStream = true;
  targetDistance.summary.sameFixtureFastestJsContract.fullArrayBufferParserInput = true;
  targetDistance.summary.sameFixtureFastestJsContract.boundedMemory = false;
  targetDistance.summary.sameFixtureFastestJsContract.memoryKind = 'browser-js-heap-unavailable';
  targetDistance.summary.sameFixtureFastestJsContract.maxRssMiB = null;
  writeFileSync(badTargetDistanceJsonOut, `${JSON.stringify(targetDistance, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--target-distance-json',
    badTargetDistanceJsonOut,
    '--json-out',
    badTargetDistanceGateJsonOut,
    '--md-out',
    badTargetDistanceGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badTargetDistanceGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.equal(report.frontierAuditSnapshot.targetDistance.fastestJsSourceMode, 'fetch-readable-stream-pull');
  assert.equal(report.frontierAuditSnapshot.targetDistance.fastestJsDirectReadableStream, true);
  assert.equal(report.frontierAuditSnapshot.targetDistance.fastestJsFullArrayBufferParserInput, true);
  assert.equal(report.frontierAuditSnapshot.targetDistance.fastestJsBoundedMemory, false);
  assert.ok(report.frontierAuditSnapshot.guards.some(item =>
    item.id === 'target-distance-js-contract-primary-bounded'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error =>
    /Missing frontier audit guard target-distance-js-contract-primary-bounded/.test(error)
  ));

  const markdown = readFileSync(badTargetDistanceGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /Target JS contract: sourceMode=fetch-readable-stream-pull, directReadableStream=yes, fullArrayBufferParserInput=yes, boundedMemory=no/);
  assert.match(markdown, /target-distance-js-contract-primary-bounded/);
});

test('runtime-limit proof-obligation gate fails if trim variants cross the text target', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));
  const textBoundary = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'text-materialization-boundary-audit.json'), 'utf8'));
  textBoundary.summary.noTrimRowsCrossTarget = 1;
  textBoundary.summary.foldTrimRowsCrossTarget = 1;
  textBoundary.summary.fastestWithoutText.fullStringParity = true;
  writeFileSync(badTextBoundaryJsonOut, `${JSON.stringify(textBoundary, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--text-materialization-boundary-json',
    badTextBoundaryJsonOut,
    '--json-out',
    badTextBoundaryGateJsonOut,
    '--md-out',
    badTextBoundaryGateMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badTextBoundaryGateJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.equal(report.frontierAuditSnapshot.textMaterialization.noTrimRowsCrossTarget, 1);
  assert.equal(report.frontierAuditSnapshot.textMaterialization.foldTrimRowsCrossTarget, 1);
  assert.equal(report.frontierAuditSnapshot.textMaterialization.fastestWithoutTextFullStringParity, true);
  assert.ok(report.frontierAuditSnapshot.guards.some(item =>
    item.id === 'text-frontier-trim-variants-below-target'
    && !item.satisfied
  ));
  assert.ok(report.gate.errors.some(error =>
    /Missing frontier audit guard text-frontier-trim-variants-below-target/.test(error)
  ));

  const markdown = readFileSync(badTextBoundaryGateMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /No-trim rows crossing 200 MiB\/s: 1/);
  assert.match(markdown, /Fold-trim rows crossing 200 MiB\/s: 1/);
  assert.match(markdown, /Without-text full-string parity: yes/);
  assert.match(markdown, /text-frontier-trim-variants-below-target/);
});

test('runtime-limit proof-obligation gate fails if the broad claim is upgraded too early', () => {
  resetTmp();
  writeFileSync(badLedger, createLedgerFixture('`CONCLUSION`'));

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    badLedger,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.equal(report.gate.status, 'ledger-guard-failed');
  assert.equal(report.conclusionAllowed, false);
  assert.equal(report.runtimeClaim.markedConclusion, true);
  assert.ok(report.gate.errors.some(error => error.includes('marked CONCLUSION')));
  assert.ok(report.claimGuards.some(item => item.id === 'runtime-limit-remains-hypothesis' && !item.satisfied));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /marked CONCLUSION/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [goodJsonOut, goodMdOut, badJsonOut, badMdOut, counterexampleJsonOut, counterexampleMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }
}

function createLedgerFixture(runtimeStatus) {
  return [
    '# stax-api Performance Proof Ledger',
    '',
    '## Proof Vocabulary',
    '',
    'Rules:',
    '',
    '- `ENGINE_INVARIANT` about JS strings is not by itself a performance impossibility proof.',
    '- `NEGATIVE_RESULT` for lazy getters, Buffer lanes, or value caches does not prove that all JavaScript runtime headroom is exhausted.',
    '',
    '## Runtime-Limit Conclusion Gate',
    '',
    'Define the target shape as a full-string StAX-like reader contract, not as identical object shape across languages.',
    'Treat any 200 MiB/s+ bounded-memory full-string JavaScript row as a counterexample.',
    '',
    '## Current Claims',
    '',
    '| ID | Claim | Status | Current evidence | Missing proof or counterexample search |',
    '| --- | --- | --- | --- | --- |',
    `| \`CLAIM-JS-RUNTIME-LIMIT-200MIB\` | A JS-runtime StAX reader cannot exceed 200 MiB/s with acceptable memory. | ${runtimeStatus} | Current rows are slow. | Must expand Safari/browser JSC rows, codegen traces, allocation profiles, and additional independent corpus fixtures. |`,
    '| `CLAIM-WOODSTOX-SAME-JS-OBJECTS` | Woodstox creates the same object shape as the JavaScript public event path. | `COUNTEREXAMPLE` | materialization-contract-audit.md | None; this claim is rejected. Future text must say "same high-level data/checksum contract", not "same object shape". |',
    '| `CLAIM-QUICKXML-SAME-JS-OBJECTS` | quick-xml creates the same object shape as the JavaScript public event path. | `COUNTEREXAMPLE` | quick-xml-shape-audit.md | None; this claim is rejected. Future text must say "same high-level data/checksum contract", not "same object shape". |',
    '| `CLAIM-LAZY-GETTERS` | Lazy event getters are not a candidate. | `NEGATIVE_RESULT` | materialization-contract-audit.md | This rejection can be revisited only with a benchmark that proves full-string or real StAX consumer improvement, bounded memory, and no cache-shape regression. |',
    '| `CLAIM-NODE-BUFFER-PRIMARY` | Node Buffer is not neutral primary. | `NEGATIVE_RESULT` | textdecoder-span-variants.md | Keep neutral browser lane. |',
    '| `CLAIM-NODE-TEXTDECODER-SOURCE-BOUNDARY` | Node TextDecoder source boundary. | `SOURCE_FACT` | node-textdecoder-source-pin-audit.md | Not codegen. |',
    '| `CLAIM-CHROME-BLINK-TEXTDECODER-SOURCE-BOUNDARY` | Chrome/Blink TextDecoder source boundary. | `SOURCE_FACT` | chrome-blink-textdecoder-source-pin-audit.md | Not codegen. |',
    '| `CLAIM-BUN-WEBKIT-TEXTDECODER-SOURCE-BOUNDARY` | Bun WebKit source boundary. | `SOURCE_FACT` | bun-webkit-textdecoder-source-pin-audit.md | Not dispatch proof. |',
    '| `CLAIM-BUN-TEXTDECODER-DISPATCH-SOURCE-BOUNDARY` | Bun dispatch source boundary. | `SOURCE_FACT` + `COUNTEREXAMPLE` | bun-textdecoder-dispatch-source-pin-audit.md | Not throughput. |',
    '| `CLAIM-FIREFOX-SPIDERMONKEY-TEXTDECODER-SOURCE-BOUNDARY` | Firefox/Gecko source boundary. | `SOURCE_FACT` | firefox-spidermonkey-textdecoder-source-pin-audit.md | Not heap/allocation, not generated-code evidence. |',
    '',
    'Artifacts: same-contract-runtime-comparison.md, runtime-counterexample-scan.md, runtime-proof-coverage-audit.md, quick-xml-allocation-count.md, quick-xml-allocation-count-stability.md, woodstox-hotspot-trace.md, woodstox-jfr-allocation.md, woodstox-measured-jfr-allocation.md, woodstox-measured-jfr-allocation-rerun.md, candidate-headroom-large.md, bun-candidate-headroom-large.md, browser-candidate-headroom-large.md, firefox-bidi-candidate-headroom.md, text-cdata-cost-decomposition.md, text-materialization-frontier.md, text-trim-guard-candidate.md, text-ascii-pretrim-candidate.md, all-ascii-span-materialization-candidate.md, sync-byte-batch-shape-batch1.md, sync-byte-batch-shape-batch16.md, bun-textdecoder-span-variants.md, browser-textdecoder-span-variants.md, stax-public-reader-host-api-boundary-audit.md, bun-jsc-partial-codegen-trace.md, bun-jsc-textdecoder-codegen-trace.md, stream-source-consumption-shapes.md, stream-source-consumption-backpressure-counters.md, event-reader-byte-batch-cross-process-corpus.md, segment-scan-headroom.md, segment-tokenizer-headroom.md, segment-tokenizer-string-frontier.md, runtime-proof-gap-handoff.md, runtime-proof-handoff-validation.md.',
    '',
    'Source-shape rules: direct ReadableStream overhead evidence stays',
    'distinct from synchronous byte-batch rows. The current large matrix does not prebuild one repeated 1 GiB ArrayBuffer parser input. The byte-batch rows preserve backpressure by pulling at most the next batch on demand.',
    'The focused audit now includes seven source-shape rows: async `nextRawBatch()` raw-frame rows and direct `ReadableStream` `nextRawBatch()` raw-frame rows under the same backpressure counter contract.',
    'The handoff source-consumption evidence status is `classified`: all 182 JavaScript 1 GiB+ full-string rows with source-mode metadata are not full `ArrayBuffer` parser-input rows, browser live fetch frontier records `fetchReadableStreamFull` at 9.68 MiB/s and `fetchAsyncByteBatchFull` at 9.77 MiB/s, and Safari/WebKit browser rows and SpiderMonkey emitted IR remain active obligations.',
    'The handoff also carries external target-distance evidence from the same aggregate: the fastest aggregated JavaScript full-string row is 0.93x of the 200 MiB/s threshold and 0.55x of the 1024 MiB Woodstox reference, still 118.67 MiB/s below the 0.9x Woodstox target. Woodstox is 351.56 MiB/s with a 316.40 MiB/s 0.9x target, and quick-xml is 274.63 MiB/s with a 247.17 MiB/s 0.9x target. This is target-distance evidence under the same checksum contract, not object-shape equivalence.',
    'The handoff also carries the text-materialization frontier: the fastest full-string row remains `rawFrameNameId` from `text-trim-cost-decomposition.json` at 185.50 MiB/s, 14.50 MiB/s below the 200 MiB/s threshold and requiring a 1.08x speedup. The fastest no-text row, `withoutTextStrings` from `text-trim-cost-decomposition-4gib.json`, reaches 252.36 MiB/s but is not full-string parity; four no-text rows cross 200 MiB/s while zero full-string, no-trim, or fold-trim rows do.',
    'Segment headroom rules: segment-scan-headroom.md records grouped segment-aware scan reached 682.83 MiB/s, while segment-tokenizer-headroom.md records grouped segment-aware tokenization reached 196.26 MiB/s; these rows are partial headroom evidence and not a full StAX counterexample. segment-tokenizer-string-frontier.md records tokenOnly reached 234.30 MiB/s, allTokenStringsNoObjects reached 66.58 MiB/s, and 200 MiB/s bounded full-string counterexamples: 0.',
    '',
    'Woodstox target rules: the fastest aggregated JS row and the 1024 MiB Woodstox reference can come from different corpus fixtures. Same-fixture 1024 MiB JS row vs Woodstox target: stax-raw-frame-name-id-chunk-32kib at 0.80x Woodstox, 19.95 MiB/s below 0.9x target.',
    '',
    'Open work: Safari/browser JSC source pins and rows, Firefox/SpiderMonkey codegen/allocation evidence, broader allocation evidence, codegen traces, and a broad corpus suite remain open.',
    '',
  ].join('\n');
}
