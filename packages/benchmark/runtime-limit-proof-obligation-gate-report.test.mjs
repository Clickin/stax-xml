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
  assert.equal(report.metadata.sourceAuditLoaded, true);
  assert.equal(report.metadata.memoryFrontierLoaded, true);
  assert.equal(report.metadata.targetDistanceLoaded, true);
  assert.equal(report.metadata.textMaterializationBoundaryLoaded, true);
  assert.equal(report.summary.currentCounterexamples, 0);
  assert.equal(report.summary.satisfiedHandoffGuards, report.summary.requiredHandoffGuards);
  assert.equal(report.summary.satisfiedSourceAuditGuards, report.summary.requiredSourceAuditGuards);
  assert.equal(report.summary.satisfiedFrontierAuditGuards, report.summary.requiredFrontierAuditGuards);
  assert.equal(report.counterexampleSnapshot.comparisonCounterexampleCount, 0);
  assert.equal(report.counterexampleSnapshot.scanCounterexampleCount, 0);
  assert.equal(report.counterexampleSnapshot.currentCounterexampleCount, 0);
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
  assert.ok(report.sourceAuditSnapshot.guards.some(item => item.id === 'source-audit-loaded' && item.satisfied));
  assert.ok(report.sourceAuditSnapshot.guards.some(item => item.id === 'coverage-crosscheck-consistent' && item.satisfied));
  assert.ok(report.sourceAuditSnapshot.guards.some(item => item.id === 'coverage-crosscheck-not-full-arraybuffer' && item.satisfied));
  assert.ok(report.sourceAuditSnapshot.guards.some(item => item.id === 'coverage-crosscheck-readable-stream-separated' && item.satisfied));
  assert.ok(report.sourceAuditSnapshot.guards.some(item => item.id === 'primary-source-sync-byte-batches-only' && item.satisfied));
  assert.ok(report.frontierAuditSnapshot.memory.loaded);
  assert.equal(report.frontierAuditSnapshot.memory.status, 'classified');
  assert.equal(report.frontierAuditSnapshot.memory.fastestBoundedRateMiBPerSec, 185.5);
  assert.equal(report.frontierAuditSnapshot.memory.fastestBoundedMaxMiB, 60.45);
  assert.equal(report.frontierAuditSnapshot.memory.unboundedRows, 17);
  assert.ok(report.frontierAuditSnapshot.targetDistance.loaded);
  assert.equal(report.frontierAuditSnapshot.targetDistance.woodstoxTargetMet, false);
  assert.equal(report.frontierAuditSnapshot.targetDistance.quickXmlTargetMet, false);
  assert.equal(report.frontierAuditSnapshot.targetDistance.woodstoxRemainingMiBPerSec, 164.29);
  assert.equal(report.frontierAuditSnapshot.targetDistance.quickXmlRemainingMiBPerSec, 95.06);
  assert.ok(report.frontierAuditSnapshot.textMaterialization.loaded);
  assert.equal(report.frontierAuditSnapshot.textMaterialization.fastestFullRateMiBPerSec, 185.5);
  assert.equal(report.frontierAuditSnapshot.textMaterialization.fullRowsCrossTarget, 0);
  assert.equal(report.frontierAuditSnapshot.textMaterialization.noTextRowsCrossTarget, 4);
  assert.ok(report.frontierAuditSnapshot.guards.some(item => item.id === 'memory-frontier-classified' && item.satisfied));
  assert.ok(report.frontierAuditSnapshot.guards.some(item => item.id === 'target-distance-not-met' && item.satisfied));
  assert.ok(report.frontierAuditSnapshot.guards.some(item => item.id === 'text-frontier-no-full-counterexample' && item.satisfied));
  assert.ok(report.coverageSnapshot.loaded);
  assert.deepEqual(report.coverageSnapshot.activeObligationIds, [
    'safari-jsc-source-and-browser-rows-open',
    'codegen-traces-open',
  ]);
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
  assert.ok(report.handoffSnapshot.guards.some(item => item.id === 'spidermonkey-emitted-ir-required' && item.satisfied));
  assert.ok(report.handoffSnapshot.guards.some(item => item.id === 'spidermonkey-materialized-scope-not-enough' && item.satisfied));
  assert.ok(report.handoffSnapshot.guards.some(item => item.id === 'spidermonkey-unchanged-stax-required' && item.satisfied));

  const markdown = readFileSync(goodMdOut, 'utf8');
  assert.match(markdown, /# Runtime-Limit Proof Obligation Gate/);
  assert.match(markdown, /Gate pass: yes/);
  assert.match(markdown, /Conclusion allowed: no/);
  assert.match(markdown, /runtime-limit-remains-hypothesis/);
  assert.match(markdown, /safari-jsc-source-and-browser-rows-open/);
  assert.match(markdown, /## Coverage Snapshot/);
  assert.match(markdown, /Active coverage obligations: safari-jsc-source-and-browser-rows-open, codegen-traces-open/);
  assert.match(markdown, /allocation-profiles-open, non-v8-browser-coverage-open, independent-corpus-suite-open/);
  assert.match(markdown, /## Counterexample Snapshot/);
  assert.match(markdown, /Same-contract comparison counterexamples: 0/);
  assert.match(markdown, /Runtime counterexample scan counterexamples: 0/);
  assert.match(markdown, /Current release counterexamples: 0/);
  assert.match(markdown, /## Handoff Snapshot/);
  assert.match(markdown, /Handoff IDs: safari-webkit-browser-row-handoff, spidermonkey-codegen-handoff/);
  assert.match(markdown, /safari-primary-byte-batch-contract/);
  assert.match(markdown, /spidermonkey-materialized-scope-not-enough/);
  assert.match(markdown, /spidermonkey-unchanged-stax-required/);
  assert.match(markdown, /## Source Audit Snapshot/);
  assert.match(markdown, /Primary parser input: synchronous Iterable<Uint8Array\[\]>/);
  assert.match(markdown, /Primary sync byte-batch rows: 231/);
  assert.match(markdown, /Primary direct ReadableStream rows: 0/);
  assert.match(markdown, /Coverage source-mode rows: 474/);
  assert.match(markdown, /coverage-crosscheck-not-full-arraybuffer/);
  assert.match(markdown, /coverage-crosscheck-readable-stream-separated/);
  assert.match(markdown, /primary-source-sync-byte-batches-only/);
  assert.match(markdown, /## Frontier Audit Snapshot/);
  assert.match(markdown, /Fastest bounded JS row: 185\.50 MiB\/s at 60\.45 MiB/);
  assert.match(markdown, /Woodstox 0\.9x target met: no/);
  assert.match(markdown, /quick-xml 0\.9x target met: no/);
  assert.match(markdown, /Full-string rows crossing 200 MiB\/s: 0/);
  assert.match(markdown, /## Proof Rules/);
  assert.match(markdown, /target-contract-not-object-shape/);
  assert.match(markdown, /lazy-getters-reopen-burden/);
  assert.match(markdown, /source-shapes-separated/);
  assert.match(markdown, /byte-batch-backpressure-preserved/);
  assert.match(markdown, /raw-frame-source-shapes-backpressure-counted/);
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
    'Artifacts: same-contract-runtime-comparison.md, runtime-counterexample-scan.md, runtime-proof-coverage-audit.md, quick-xml-allocation-count.md, quick-xml-allocation-count-stability.md, woodstox-hotspot-trace.md, woodstox-jfr-allocation.md, woodstox-measured-jfr-allocation.md, woodstox-measured-jfr-allocation-rerun.md, candidate-headroom-large.md, bun-candidate-headroom-large.md, browser-candidate-headroom-large.md, firefox-bidi-candidate-headroom.md, text-cdata-cost-decomposition.md, text-materialization-frontier.md, text-trim-guard-candidate.md, text-ascii-pretrim-candidate.md, all-ascii-span-materialization-candidate.md, sync-byte-batch-shape-batch1.md, sync-byte-batch-shape-batch16.md, bun-textdecoder-span-variants.md, browser-textdecoder-span-variants.md, bun-jsc-partial-codegen-trace.md, bun-jsc-textdecoder-codegen-trace.md, stream-source-consumption-shapes.md, stream-source-consumption-backpressure-counters.md, event-reader-byte-batch-cross-process-corpus.md, segment-scan-headroom.md, segment-tokenizer-headroom.md, segment-tokenizer-string-frontier.md, runtime-proof-gap-handoff.md.',
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
