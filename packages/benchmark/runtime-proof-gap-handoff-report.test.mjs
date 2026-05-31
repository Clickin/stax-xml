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
  assert.equal(report.summary.sourceConsumptionEvidenceStatus, 'classified');
  assert.equal(report.summary.memoryFrontierEvidenceStatus, 'classified');
  assert.equal(report.summary.externalTargetEvidenceStatus, 'classified');
  assert.equal(report.summary.textMaterializationEvidenceStatus, 'classified');
  assert.equal(report.summary.conclusionAllowed, false);
  assert.match(report.summary.conclusionBlocker, /external runtime evidence/);
  assert.match(report.inputs.comparisonJson, /same-contract-runtime-comparison\.json/);
  assert.equal(report.inputs.comparisonObjective, 'same-contract-runtime-comparison');
  assert.equal(report.inputs.comparisonContract, 'same-full-string-checksum-contract-not-same-object-shape');
  assert.equal(report.sourceConsumptionEvidence.status, 'classified');
  assert.equal(report.sourceConsumptionEvidence.sourceArtifact, 'same-contract-runtime-comparison.json');
  assert.equal(report.sourceConsumptionEvidence.rowCount, 237);
  assert.deepEqual(report.sourceConsumptionEvidence.sourceModes, [
    'fetch-async-iterable-byte-batches',
    'fetch-readable-stream-pull',
    'file-backed-sync-iterable-byte-batches',
    'sync-iterable-byte-batches',
  ]);
  assert.deepEqual(report.sourceConsumptionEvidence.sourceShapeSafety, {
    largeJsFullSourceModeRows: 198,
    notFullArrayBufferRows: 198,
    fullArrayBufferRows: 0,
    unknownArrayBufferRows: 0,
    corpusSeedReplayRows: 121,
    fileBackedSyncIterableRows: 36,
    directReadableStreamRows: 1,
    sourceModeBreakdown: [
      {
        sourceMode: 'fetch-async-iterable-byte-batches',
        rows: 1,
        notFullArrayBufferRows: 1,
        fullArrayBufferRows: 0,
        unknownArrayBufferRows: 0,
        directReadableStreamRows: 0,
        corpusSeedReplayRows: 1,
        fastestRow: {
          sourceArtifact: 'browser-fetch-readable-stream-books-corpus.json',
          runtimeLabel: 'Chrome/V8 browser',
          caseId: 'fetchAsyncByteBatchFull',
          mibPerSec: 9.77,
          fullStringParity: true,
          boundedMemory: true,
        },
      },
      {
        sourceMode: 'fetch-readable-stream-pull',
        rows: 1,
        notFullArrayBufferRows: 1,
        fullArrayBufferRows: 0,
        unknownArrayBufferRows: 0,
        directReadableStreamRows: 1,
        corpusSeedReplayRows: 1,
        fastestRow: {
          sourceArtifact: 'browser-fetch-readable-stream-books-corpus.json',
          runtimeLabel: 'Chrome/V8 browser',
          caseId: 'fetchReadableStreamFull',
          mibPerSec: 9.68,
          fullStringParity: true,
          boundedMemory: true,
        },
      },
      {
        sourceMode: 'file-backed-sync-iterable-byte-batches',
        rows: 36,
        notFullArrayBufferRows: 36,
        fullArrayBufferRows: 0,
        unknownArrayBufferRows: 0,
        directReadableStreamRows: 0,
        corpusSeedReplayRows: 0,
        fastestRow: {
          sourceArtifact: 'file-backed-batch-size-sweep.json',
          runtimeLabel: 'Node/V8',
          caseId: 'stax-raw-frame-name-id-batch-8',
          mibPerSec: 152.11,
          fullStringParity: true,
          boundedMemory: true,
        },
      },
      {
        sourceMode: 'sync-iterable-byte-batches',
        rows: 160,
        notFullArrayBufferRows: 160,
        fullArrayBufferRows: 0,
        unknownArrayBufferRows: 0,
        directReadableStreamRows: 0,
        corpusSeedReplayRows: 119,
        fastestRow: {
          sourceArtifact: 'text-trim-cost-decomposition.json',
          runtimeLabel: 'Node/V8',
          caseId: 'rawFrameNameId',
          mibPerSec: 185.5,
          fullStringParity: true,
          boundedMemory: true,
        },
      },
    ],
  });
  assert.equal(report.sourceConsumptionEvidence.sourceConsumptionFrontier.fastestSyncIterable, 'sync-iterable-byte-batches-batch-8');
  assert.equal(report.sourceConsumptionEvidence.sourceConsumptionFrontier.fastestSyncIterableMiBPerSec, 67.94);
  assert.equal(report.sourceConsumptionEvidence.sourceConsumptionFrontier.fastestReadableStream, 'web-readable-stream-raw-frame-ascii-batch-8');
  assert.equal(report.sourceConsumptionEvidence.sourceConsumptionFrontier.fastestReadableStreamMiBPerSec, 75.98);
  assert.equal(report.sourceConsumptionEvidence.sourceConsumptionFrontier.fastestReadableStreamRatioToFastestSyncIterable, 1.12);
  assert.equal(report.sourceConsumptionEvidence.sourceConsumptionFrontier.backpressureRowsRespected, 6);
  assert.equal(report.sourceConsumptionEvidence.sourceConsumptionFrontier.backpressureRows, 6);
  assert.equal(report.sourceConsumptionEvidence.sourceConsumptionFrontier.fullArrayBufferRows, 0);
  assert.equal(report.sourceConsumptionEvidence.browserLiveSourceFrontier.fetchReadableStreamRow, 'fetchReadableStreamFull');
  assert.equal(report.sourceConsumptionEvidence.browserLiveSourceFrontier.fetchReadableStreamMiBPerSec, 9.68);
  assert.equal(report.sourceConsumptionEvidence.browserLiveSourceFrontier.fetchAsyncByteBatchRow, 'fetchAsyncByteBatchFull');
  assert.equal(report.sourceConsumptionEvidence.browserLiveSourceFrontier.fetchAsyncByteBatchMiBPerSec, 9.77);
  assert.equal(report.sourceConsumptionEvidence.browserLiveSourceFrontier.liveRowsBackpressureRespected, 2);
  assert.equal(report.sourceConsumptionEvidence.browserLiveSourceFrontier.liveRows, 2);
  assert.equal(report.sourceConsumptionEvidence.browserLiveSourceFrontier.liveRowsFullArrayBufferInput, 0);
  assert.equal(report.memoryFrontierEvidence.status, 'classified');
  assert.equal(report.memoryFrontierEvidence.sourceArtifact, 'same-contract-runtime-comparison.json');
  assert.equal(report.memoryFrontierEvidence.contract, '1gib-plus-js-full-string-memory-frontier');
  assert.equal(report.memoryFrontierEvidence.rows, 204);
  assert.equal(report.memoryFrontierEvidence.boundedRows, 187);
  assert.equal(report.memoryFrontierEvidence.unboundedRows, 17);
  assert.deepEqual(report.memoryFrontierEvidence.memoryKinds, [
    'browser-js-heap',
    'browser-js-heap-unavailable',
    'process-rss',
  ]);
  assert.equal(report.memoryFrontierEvidence.fastestBoundedRow.runtimeLabel, 'Node/V8');
  assert.equal(report.memoryFrontierEvidence.fastestBoundedRow.caseId, 'rawFrameNameId');
  assert.equal(report.memoryFrontierEvidence.fastestBoundedRow.mibPerSec, 185.5);
  assert.equal(report.memoryFrontierEvidence.fastestBoundedRow.memoryKind, 'process-rss');
  assert.equal(report.memoryFrontierEvidence.fastestBoundedRow.maxMiB, 60.45);
  assert.equal(report.memoryFrontierEvidence.fastestProcessRssUnder128MiB.maxMiB, 60.45);
  assert.equal(report.memoryFrontierEvidence.fastestBrowserJsHeapRow.runtimeLabel, 'Chrome/V8 browser');
  assert.equal(report.memoryFrontierEvidence.fastestBrowserJsHeapRow.caseId, 'rawFrameNameId');
  assert.equal(report.memoryFrontierEvidence.fastestBrowserJsHeapRow.mibPerSec, 69.9);
  assert.equal(report.memoryFrontierEvidence.fastestBrowserJsHeapRow.memoryKind, 'browser-js-heap');
  assert.equal(report.memoryFrontierEvidence.fastestBrowserJsHeapRow.maxMiB, 39.55);
  assert.deepEqual(
    report.memoryFrontierEvidence.buckets.map(bucket => ({
      kind: bucket.kind,
      rows: bucket.rows,
      boundedRows: bucket.boundedRows,
      unboundedRows: bucket.unboundedRows,
      maxMiB: bucket.maxMiB,
      fastestRow: bucket.fastestRow?.caseId ?? null,
      fastestBoundedRow: bucket.fastestBoundedRow?.caseId ?? null,
    })),
    [
      {
        kind: 'browser-js-heap',
        rows: 20,
        boundedRows: 20,
        unboundedRows: 0,
        maxMiB: 358.37,
        fastestRow: 'rawFrameNameId',
        fastestBoundedRow: 'rawFrameNameId',
      },
      {
        kind: 'browser-js-heap-unavailable',
        rows: 9,
        boundedRows: 0,
        unboundedRows: 9,
        maxMiB: null,
        fastestRow: 'rawFrameNameId',
        fastestBoundedRow: null,
      },
      {
        kind: 'process-rss',
        rows: 175,
        boundedRows: 167,
        unboundedRows: 8,
        maxMiB: 1956.69,
        fastestRow: 'rawFrameNameId',
        fastestBoundedRow: 'rawFrameNameId',
      },
    ],
  );
  assert.match(report.memoryFrontierEvidence.interpretation, /not normalized into one allocation model/);
  assert.equal(report.externalTargetEvidence.status, 'classified');
  assert.equal(report.externalTargetEvidence.sourceArtifact, 'same-contract-runtime-comparison.json');
  assert.equal(report.externalTargetEvidence.contract, 'woodstox-and-quickxml-0.9x-target-distance');
  assert.equal(report.externalTargetEvidence.fastestJsLargeFullRow.caseId, 'rawFrameNameId');
  assert.equal(report.externalTargetEvidence.fastestJsLargeFullRow.mibPerSec, 185.5);
  assert.equal(report.externalTargetEvidence.fastestJsLargeFullRowTo200MiBPerSec.ratio, 0.93);
  assert.equal(report.externalTargetEvidence.fastestJsLargeFullRowTo200MiBPerSec.remainingMiBPerSec, 14.5);
  assert.equal(report.externalTargetEvidence.fastestJsLargeFullRowTo1024MiBWoodstoxReference.ratio, 0.55);
  assert.equal(report.externalTargetEvidence.fastestJsLargeFullRowTo1024MiBWoodstoxReference.remainingTo90PercentMiBPerSec, 118.67);
  assert.equal(report.externalTargetEvidence.sameFixture1024MiBWoodstoxTarget.fastestJsCaseId, 'stax-raw-frame-name-id-batch-8');
  assert.equal(report.externalTargetEvidence.sameFixture1024MiBWoodstoxTarget.fastestJsMiBPerSec, 152.11);
  assert.equal(report.externalTargetEvidence.sameFixture1024MiBWoodstoxTarget.woodstoxMiBPerSec, 351.56);
  assert.equal(report.externalTargetEvidence.sameFixture1024MiBWoodstoxTarget.target90MiBPerSec, 316.4);
  assert.equal(report.externalTargetEvidence.sameFixture1024MiBWoodstoxTarget.remainingTo90PercentMiBPerSec, 164.29);
  assert.equal(report.externalTargetEvidence.sameFixture1024MiBWoodstoxTarget.targetMet, false);
  assert.equal(report.externalTargetEvidence.sameFixture1024MiBQuickXmlTarget.quickXmlMiBPerSec, 274.63);
  assert.equal(report.externalTargetEvidence.sameFixture1024MiBQuickXmlTarget.target90MiBPerSec, 247.17);
  assert.equal(report.externalTargetEvidence.sameFixture1024MiBQuickXmlTarget.remainingTo90PercentMiBPerSec, 95.06);
  assert.equal(report.externalTargetEvidence.sameFixture1024MiBQuickXmlTarget.targetMet, false);
  assert.equal(report.externalTargetEvidence.externalBaseline1024MiBFileSyncBatches.woodstoxMiBPerSec, 337.97);
  assert.equal(report.externalTargetEvidence.externalBaseline1024MiBFileSyncBatches.quickXmlMiBPerSec, 270.26);
  assert.equal(report.externalTargetEvidence.sameFixture1024MiBProcessRssSnapshot.fastestJs.maxRssMiB, 61.77);
  assert.equal(report.externalTargetEvidence.sameFixture1024MiBProcessRssSnapshot.woodstox.maxRssMiB, 312.71);
  assert.equal(report.externalTargetEvidence.sameFixture1024MiBProcessRssSnapshot.quickXml.maxRssMiB, 4.78);
  assert.match(report.externalTargetEvidence.interpretation, /not same object-shape comparators/);
  assert.equal(report.textMaterializationEvidence.status, 'classified');
  assert.equal(report.textMaterializationEvidence.sourceArtifact, 'same-contract-runtime-comparison.json');
  assert.equal(report.textMaterializationEvidence.frontierArtifact, 'text-materialization-frontier.json');
  assert.equal(report.textMaterializationEvidence.contract, 'text-materialization-frontier-counterexample-boundary');
  assert.equal(report.textMaterializationEvidence.targetMiBPerSec, 200);
  assert.equal(report.textMaterializationEvidence.fastestFull.id, 'rawFrameNameId');
  assert.equal(report.textMaterializationEvidence.fastestFull.mibPerSec, 185.5);
  assert.equal(report.textMaterializationEvidence.fastestFull.fullStringParity, true);
  assert.equal(report.textMaterializationEvidence.fastestWithoutText.id, 'withoutTextStrings');
  assert.equal(report.textMaterializationEvidence.fastestWithoutText.mibPerSec, 252.36);
  assert.equal(report.textMaterializationEvidence.fastestWithoutText.fullStringParity, false);
  assert.equal(report.textMaterializationEvidence.fastestNoTrim.id, 'rawFrameNameIdNoTrim');
  assert.equal(report.textMaterializationEvidence.fastestNoTrim.mibPerSec, 186.97);
  assert.equal(report.textMaterializationEvidence.fastestFoldTrim.id, 'rawFrameNameIdFoldTrim');
  assert.equal(report.textMaterializationEvidence.fastestFoldTrim.mibPerSec, 148.58);
  assert.equal(report.textMaterializationEvidence.fastestFullToTargetRatio, 0.93);
  assert.equal(report.textMaterializationEvidence.fastestFullRemainingMiBPerSec, 14.5);
  assert.equal(report.textMaterializationEvidence.requiredSpeedupToTarget, 1.08);
  assert.equal(report.textMaterializationEvidence.fastestWithoutTextToFullRatio, 1.36);
  assert.equal(report.textMaterializationEvidence.fullRowsCrossTarget, 0);
  assert.equal(report.textMaterializationEvidence.noTextRowsCrossTarget, 4);
  assert.equal(report.textMaterializationEvidence.negativeCandidateCount, 21);
  assert.match(report.textMaterializationEvidence.interpretation, /Text\/CDATA omission crosses the target/);
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
  assert.ok(safari.localClosure.blockers.some(item => /No Safari\/WebKit benchmark row is recorded/.test(item)));
  assert.ok(safari.localClosure.blockers.some(item => /No exact Safari\/WebKit source-boundary pin is recorded/.test(item)));
  assert.match(safari.localClosure.scopeGuard, /not a Safari\/WebKit benchmark row/);
  assert.equal(spiderMonkey.localClosure.localStatus, 'external-run-required');
  assert.equal(spiderMonkey.localClosure.localRunnable, false);
  assert.deepEqual(spiderMonkey.localClosure.evidenceArtifacts, [
    'firefox-spidermonkey-diagnostic-dump-audit.json',
    'firefox-spidermonkey-js-shell-availability-audit.json',
    'firefox-spidermonkey-release-jsshell-availability-audit.json',
    'firefox-spidermonkey-nightly-jsshell-availability-audit.json',
    'firefox-spidermonkey-buildconfig-source-pin-audit.json',
  ]);
  assert.ok(spiderMonkey.localClosure.blockers.some(item => /emitted no JIT diagnostic dump/.test(item)));
  assert.ok(spiderMonkey.localClosure.blockers.some(item => /No local SpiderMonkey JS shell was found/.test(item)));
  assert.ok(spiderMonkey.localClosure.blockers.some(item => /Official Firefox release jsshell is executable/.test(item)));
  assert.ok(spiderMonkey.localClosure.blockers.some(item => /Official Firefox nightly jsshell is executable/.test(item)));
  assert.ok(spiderMonkey.localClosure.blockers.some(item => /release jsshell.*bytecode dump status is no-bytecode-output/.test(item)));
  assert.ok(spiderMonkey.localClosure.blockers.some(item => /nightly jsshell.*bytecode dump status is no-bytecode-output/.test(item)));
  assert.ok(spiderMonkey.localClosure.blockers.some(item => /about:buildconfig records --enable-js-shell/.test(item)));
  assert.match(spiderMonkey.localClosure.scopeGuard, /official-shell diagnostic availability facts/);
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
  assert.ok(safari.closureChecks.some(item => /coverage\.safariWebKitStatus\.evidenceClass/.test(item)));
  assert.ok(safari.closureChecks.some(item => /benchmarkRowsRecorded must be greater than 0/.test(item)));
  assert.ok(safari.closureChecks.some(item => /closesSafariObligation must be true/.test(item)));
  assert.ok(safari.closureChecks.some(item => /200 MiB\/s\+ bounded-memory row as a counterexample/.test(item)));
  assert.ok(safari.scopeGuards.some(item => /direct ReadableStream throughput/.test(item)));
  assert.ok(safari.scopeGuards.some(item => /must not be reused as Safari source-boundary evidence/.test(item)));
  assert.ok(spiderMonkey.commands.some(command => /firefox-spidermonkey-diagnostic-dump-audit\.mjs/.test(command.command)));
  assert.ok(spiderMonkey.commands.some(command => /firefox-spidermonkey-buildconfig-source-pin-audit\.mjs/.test(command.command)));
  assert.ok(spiderMonkey.commands.some(command => /--package-kind release/.test(command.command)));
  assert.ok(spiderMonkey.commands.some(command => /--package-kind nightly/.test(command.command)));
  assert.ok(spiderMonkey.commands.some(command => /FIREFOX_PATH=/.test(command.command)));
  assert.ok(spiderMonkey.expectedEvidence.some(item => /JIT IR/.test(item)));
  assert.ok(spiderMonkey.closureChecks.some(item => /emittedIrEvidenceCount must be greater than 0/.test(item)));
  assert.ok(spiderMonkey.closureChecks.some(item => /missingIrSurfaceCount must be 0/.test(item)));
  assert.ok(spiderMonkey.closureChecks.some(item => /jit-status-only/.test(item)));
  assert.ok(spiderMonkey.closureChecks.some(item => /emitted IR or optimized-code dump metadata/.test(item)));
  assert.ok(spiderMonkey.scopeGuards.some(item => /no-dump diagnostic audit is a negative result for the installed browser build only/.test(item)));
  assert.ok(spiderMonkey.scopeGuards.some(item => /JS shell and official jsshell availability are environment evidence only/.test(item)));
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
  assert.match(markdown, /Source consumption evidence status: classified/);
  assert.match(markdown, /Memory frontier evidence status: classified/);
  assert.match(markdown, /External target evidence status: classified/);
  assert.match(markdown, /Text materialization evidence status: classified/);
  assert.match(markdown, /## Source Consumption Evidence/);
  assert.match(markdown, /Source modes: fetch-async-iterable-byte-batches, fetch-readable-stream-pull, file-backed-sync-iterable-byte-batches, sync-iterable-byte-batches/);
  assert.match(markdown, /1 GiB\+ JS full-string source-mode rows not using full ArrayBuffer parser input: 198\/198/);
  assert.match(markdown, /Full ArrayBuffer parser-input rows: 0/);
  assert.match(markdown, /Unknown parser-input rows: 0/);
  assert.match(markdown, /File-backed sync Iterable<Uint8Array\[\]> rows: 36/);
  assert.match(markdown, /Direct ReadableStream rows: 1/);
  assert.match(markdown, /\| file-backed-sync-iterable-byte-batches \| 36 \| 36 \| 0 \| 0 \| Node\/V8 stax-raw-frame-name-id-batch-8 152\.11 MiB\/s from file-backed-batch-size-sweep\.json \|/);
  assert.match(markdown, /\| sync-iterable-byte-batches \| 160 \| 160 \| 0 \| 119 \| Node\/V8 rawFrameNameId 185\.50 MiB\/s from text-trim-cost-decomposition\.json \|/);
  assert.match(markdown, /\| fetch-readable-stream-pull \| 1 \| 1 \| 1 \| 1 \| Chrome\/V8 browser fetchReadableStreamFull 9\.68 MiB\/s from browser-fetch-readable-stream-books-corpus\.json \|/);
  assert.match(markdown, /Node source frontier: sync-iterable-byte-batches-batch-8 67\.94 MiB\/s vs web-readable-stream-raw-frame-ascii-batch-8 75\.98 MiB\/s \(1\.12x\); backpressure 6\/6; fullArrayBufferRows=0/);
  assert.match(markdown, /Browser live fetch frontier: fetchReadableStreamFull 9\.68 MiB\/s; fetchAsyncByteBatchFull 9\.77 MiB\/s; backpressure 2\/2; fullArrayBufferRows=0/);
  assert.match(markdown, /## Memory Frontier Evidence/);
  assert.match(markdown, /1 GiB\+ JS full-string memory rows: 204/);
  assert.match(markdown, /Bounded rows: 187/);
  assert.match(markdown, /Unbounded or unproven rows: 17/);
  assert.match(markdown, /Memory kinds: browser-js-heap, browser-js-heap-unavailable, process-rss/);
  assert.match(markdown, /Fastest bounded row: Node\/V8 rawFrameNameId 185\.50 MiB\/s \(process-rss max 60\.45 MiB\)/);
  assert.match(markdown, /Fastest browser JS heap row: Chrome\/V8 browser rawFrameNameId 69\.90 MiB\/s \(browser-js-heap max 39\.55 MiB\)/);
  assert.match(markdown, /\| browser-js-heap-unavailable \| 9 \| 0 \| 9 \| n\/a MiB \| Firefox\/SpiderMonkey browser rawFrameNameId 64\.24 MiB\/s \(browser-js-heap-unavailable\) \| none \|/);
  assert.match(markdown, /## External Target Evidence/);
  assert.match(markdown, /Fastest JS full row vs 200 MiB\/s: 0\.93x, 14\.50 MiB\/s remaining/);
  assert.match(markdown, /Fastest JS full row vs 1024 MiB Woodstox reference: 0\.55x, 118\.67 MiB\/s below 0\.9x target/);
  assert.match(markdown, /Same-fixture Woodstox target: stax-raw-frame-name-id-batch-8 152\.11 MiB\/s vs Woodstox 351\.56 MiB\/s; 0\.9x target 316\.40 MiB\/s; remaining 164\.29 MiB\/s; targetMet=no/);
  assert.match(markdown, /Same-fixture quick-xml target: stax-raw-frame-name-id-batch-8 152\.11 MiB\/s vs quick-xml 274\.63 MiB\/s; 0\.9x target 247\.17 MiB\/s; remaining 95\.06 MiB\/s; targetMet=no/);
  assert.match(markdown, /Same-fixture process RSS: JS 61\.77 MiB; Woodstox 312\.71 MiB; quick-xml 4\.78 MiB/);
  assert.match(markdown, /## Text Materialization Evidence/);
  assert.match(markdown, /Fastest full-string row: rawFrameNameId from text-trim-cost-decomposition\.json at 185\.50 MiB\/s \(fullStringParity=yes, boundedMemory=yes\)/);
  assert.match(markdown, /Fastest without text\/CDATA strings row: withoutTextStrings from text-trim-cost-decomposition-4gib\.json at 252\.36 MiB\/s \(fullStringParity=no, boundedMemory=yes\)/);
  assert.match(markdown, /Fastest full row target distance: 0\.93x target, 14\.50 MiB\/s remaining, 1\.08x speedup required/);
  assert.match(markdown, /Rows crossing target: full=0, withoutText=4, noTrim=0, foldTrim=0/);
  assert.match(markdown, /Runtime-limit conclusion allowed: no/);
  assert.match(markdown, /safari-webkit-browser-row-handoff/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
  assert.match(markdown, /Local closure status: external-run-required/);
  assert.match(markdown, /Locally runnable now: no/);
  assert.match(markdown, /Current host cannot run Safari\/WebKit browser rows/);
  assert.match(markdown, /No Safari\/WebKit benchmark row is recorded/);
  assert.match(markdown, /No exact Safari\/WebKit source-boundary pin is recorded/);
  assert.match(markdown, /Installed Firefox diagnostic dump audit emitted no JIT diagnostic dump/);
  assert.match(markdown, /No local SpiderMonkey JS shell was found/);
  assert.match(markdown, /Official Firefox release jsshell is executable/);
  assert.match(markdown, /Official Firefox nightly jsshell is executable/);
  assert.match(markdown, /bytecode dump status is no-bytecode-output/);
  assert.match(markdown, /Installed Firefox about:buildconfig records --enable-js-shell/);
  assert.match(markdown, /safaridriver/);
  assert.match(markdown, /Source consumption contract/);
  assert.match(markdown, /StreamReaderSync over a synchronous Iterable<Uint8Array\[\]>/);
  assert.match(markdown, /backpressure is respected/);
  assert.match(markdown, /Source boundary contract/);
  assert.match(markdown, /Bun\/JSC and Bun-patched WebKit source pins are not Safari browser JSC source pins/);
  assert.match(markdown, /same-contract-runtime-comparison/);
  assert.match(markdown, /Closure checks:/);
  assert.match(markdown, /coverage\.safariWebKitStatus\.closesSafariObligation must be true/);
  assert.match(markdown, /coverage\.spiderMonkeyDiagnostics\.emittedIrEvidenceCount must be greater than 0/);
  assert.match(markdown, /evidenceClass jit-status-only/);
  assert.match(markdown, /firefox-spidermonkey-diagnostic-dump-audit/);
  assert.match(markdown, /firefox-spidermonkey-buildconfig-source-pin-audit/);
  assert.match(markdown, /negative result for the installed browser build only/);
  assert.match(markdown, /installed buildconfig audit explains the local diagnostic surface/);
  assert.match(markdown, /environment evidence only until a dump or IR artifact is captured/);
  assert.match(markdown, /not itself benchmark, allocation, or codegen evidence/);
});
