import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'runtime-proof-handoff-validation-report-test');
const jsonOut = join(tmpDir, 'runtime-proof-handoff-validation.json');
const mdOut = join(tmpDir, 'runtime-proof-handoff-validation.md');
const badHandoffJson = join(tmpDir, 'runtime-proof-gap-handoff-missing-safari-comparison.json');
const badJsonOut = join(tmpDir, 'runtime-proof-handoff-validation-bad.json');
const badMdOut = join(tmpDir, 'runtime-proof-handoff-validation-bad.md');

test('runtime proof handoff validation pins external runbook command and contract shape', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
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
  assert.equal(report.objective, 'runtime-proof-handoff-validation');
  assert.equal(report.contract, 'external-run-handoff-command-and-contract-static-validation');
  assert.equal(report.summary.pass, true);
  assert.equal(report.summary.handoffCount, 2);
  assert.equal(report.summary.requiredHandoffsPresent, true);
  assert.equal(report.summary.commandCount, 15);
  assert.equal(report.summary.scriptsReferenced, 23);
  assert.equal(report.summary.missingScriptCount, 0);
  assert.equal(report.summary.releaseOutputPathCount, 78);
  assert.equal(report.summary.nonReleaseOutputPathCount, 0);
  assert.equal(report.summary.rawOutputPathCount, 2);
  assert.equal(report.summary.rawOutputPathPolicyViolationCount, 0);
  assert.equal(report.summary.allRequiredFlagsPresent, true);
  assert.equal(report.summary.allContractsPresent, true);
  assert.equal(report.summary.allExternalRunRequired, true);
  assert.equal(report.summary.externalRunRequiredCount, 2);
  assert.equal(report.summary.localRunnableCount, 0);
  assert.equal(report.summary.unhandledObligationCount, 0);
  assert.equal(report.summary.conclusionAllowed, false);

  const safari = report.handoffChecks.find(row => row.id === 'safari-webkit-browser-row-handoff');
  const spiderMonkey = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.ok(safari);
  assert.ok(spiderMonkey);
  assert.equal(safari.commandCount, 5);
  assert.equal(safari.requiredFlagsPresent, true);
  assert.equal(safari.contractsPresent, true);
  assert.equal(safari.classification, 'EXTERNAL_RUN_REQUIRED');
  assert.equal(safari.localStatus, 'external-run-required');
  assert.equal(safari.localRunnable, false);
  assert.equal(safari.externalRunRequired, true);
  assert.equal(spiderMonkey.commandCount, 10);
  assert.equal(spiderMonkey.requiredFlagsPresent, true);
  assert.equal(spiderMonkey.contractsPresent, true);
  assert.equal(spiderMonkey.classification, 'EXTERNAL_RUN_REQUIRED');
  assert.equal(spiderMonkey.localStatus, 'external-run-required');
  assert.equal(spiderMonkey.localRunnable, false);
  assert.equal(spiderMonkey.externalRunRequired, true);
  assert.ok(safari.requiredFlagPatterns.some(pattern => pattern.includes('--harness safari-webdriver')));
  assert.ok(safari.requiredFlagPatterns.some(pattern => pattern.includes('safari-webkit-closure-audit')));
  assert.ok(safari.requiredFlagPatterns.some(pattern => pattern.includes('target-distance-audit')));
  assert.ok(safari.requiredFlagPatterns.some(pattern => pattern.includes('text-materialization-frontier-coverage-audit')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('directReadableStreamFullStringRowsRecorded')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('must not substitute for primarySyncByteBatchRowsRecorded')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('primaryRowsInSameContractComparison')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('largeBoundedPrimarySyncByteBatchRowsRecorded')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('largePrimaryRowsInSameContractComparison')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('same-contract-runtime-comparison')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('safari-webkit-closure-audit')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('summary\\.qualifiedClosureCount')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('qualifiedClosureCount=0')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('Safari\\/WebKit closure audit checks')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('Current host cannot run Safari')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('candidateRows=0')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('backpressure is respected')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('Memory evidence is classified explicitly')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('missing Safari JS heap counters')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('runtime-counterexample-scan')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('200 MiB')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('target-distance-audit')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('Woodstox and quick-xml')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('evidenceIntakeContract')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('safari-webdriver-candidate-headroom-cross-process-books-corpus')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('runtimeId=safari-jsc-browser')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('parserInput=synchronous Iterable')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('coverage\\.safariWebKitStatus\\.closesSafariObligation')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('Reject rows whose parser input is a full XML ArrayBuffer')));
  assert.ok(spiderMonkey.requiredFlagPatterns.some(pattern => pattern.includes('FIREFOX_PATH')));
  assert.ok(spiderMonkey.requiredFlagPatterns.some(pattern => pattern.includes('stax-public-reader-host-api-boundary-audit')));
  assert.ok(spiderMonkey.requiredFlagPatterns.some(pattern => pattern.includes('spidermonkey-jsshell-tokenizer-headroom')));
  assert.ok(spiderMonkey.requiredFlagPatterns.some(pattern => pattern.includes('spidermonkey-jsshell-materialized-headroom')));
  assert.ok(spiderMonkey.requiredFlagPatterns.some(pattern => pattern.includes('spidermonkey-codegen-closure-audit')));
  assert.ok(spiderMonkey.requiredFlagPatterns.some(pattern => pattern.includes('text-materialization-frontier-coverage-audit')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('diagnostic flags')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('selected row id')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('closesEmittedIrObligation=true')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('sameContractStaxRow=true')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('canRunCurrentStaxFullStringBenchmark=true')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('selectedRowMatchesCurrentComparison=true')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('evidenceClassAllowed=true')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('selectedRowIdentityStatus')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('selectedRowIdentityStatusCounts')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('spidermonkey-ascii-scope-distance-audit')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('ASCII scope-distance audit pins')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('materialized scope-distance audit pins')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('direct unchanged harness attempts blocked before StAX load')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('primarySyncByteBatchMissingGlobals=none')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('asciiTextDecoderEquivalent=true')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('stax-public-reader-host-api-boundary-audit')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('alternateDecoderWouldBeUnchangedClosure')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('utf8FallbackDecoder=true')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('nonUtf8RequiresTextDecoder=true')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('spidermonkey-jsshell-tokenizer-headroom')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('spidermonkey-jsshell-materialized-headroom')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('sameSemanticChecksumFields')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('memoryProofRows=0')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('spidermonkey-codegen-closure-audit')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('spidermonkey-codegen-rerun-stability-audit')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('selectedRowMetadataMissingFieldCounts selectedChecksum')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('diagnosticWorkloadMetadataCount')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('nonComparableDiagnosticWorkloadMetadataCount')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('closingMetadataMissingFieldCounts diagnosticFlags')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('disallowedEvidenceClassCounts')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('selectedRowIdentityStatusCounts')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('qualifiedClosureCount=0')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('contradictedClosureClaimCount=0')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('closestBlockedCandidateCount')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('minimumBlockedRequirementCount')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('closestBlockedCandidates=')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('same-contract-runtime-comparison')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('checksum parity')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('emitted IR or optimized-code dump metadata')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('bytecode-diagnostic-only')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('evidenceIntakeContract')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('spidermonkey-emitted-codegen-or-optimized-code artifact')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('runtimeId=firefox-spidermonkey')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('selectedRowId')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('coverage\\.spiderMonkeyDiagnostics\\.emittedIrEvidenceCount')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('spidermonkey-codegen-closure-audit\\.summary\\.qualifiedClosureCount')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('Reject jit-status-only and bytecode-diagnostic-only evidence classes')));

  assert.ok(report.commandChecks.every(check =>
    check.scriptPaths.every(script => script.exists)
  ));
  assert.ok(report.commandChecks.every(check =>
    check.releaseOutputPaths.every(output => output.underRelease)
  ));
  assert.ok(report.commandChecks.every(check =>
    check.rawOutputPaths.every(output => output.underRawOrCrossProcess)
  ));
  assert.ok(report.commandChecks.some(check =>
    check.id === 'safari-books-corpus-cross-process'
    && check.rawOutputPaths.some(output => output.path === 'packages/benchmark/results/cross-process/safari-webdriver-books-corpus')
  ));
  assert.ok(report.commandChecks.some(check =>
    check.id === 'firefox-diagnostic-installed-or-debug-build'
    && check.rawOutputPaths.some(output => output.path === 'packages/benchmark/results/firefox-spidermonkey-diagnostic-dump-audit')
  ));
  assert.ok(report.commandChecks.some(check =>
    check.id === 'stax-public-reader-host-api-boundary'
    && /stax-public-reader-host-api-boundary-audit\.mjs/.test(check.command)
  ));
  assert.ok(report.commandChecks.some(check =>
    check.id === 'spidermonkey-jsshell-tokenizer-headroom'
    && /spidermonkey-jsshell-tokenizer-headroom\.mjs/.test(check.command)
  ));
  assert.ok(report.commandChecks.some(check =>
    check.id === 'spidermonkey-jsshell-materialized-headroom'
    && /spidermonkey-jsshell-materialized-headroom\.mjs/.test(check.command)
  ));
  assert.ok(report.commandChecks.some(check =>
    check.id === 'spidermonkey-codegen-closure-audit'
    && /spidermonkey-codegen-closure-audit\.mjs/.test(check.command)
  ));
  assert.ok(report.commandChecks.some(check =>
    check.id === 'spidermonkey-codegen-rerun-stability-audit'
    && /spidermonkey-codegen-rerun-stability-audit\.mjs/.test(check.command)
  ));
  assert.ok(report.commandChecks.some(check =>
    check.id === 'safari-webkit-closure-audit'
    && /safari-webkit-closure-audit\.mjs/.test(check.command)
  ));
  const postSafariAudits = report.commandChecks.find(check => check.id === 'post-safari-audits');
  assert.ok(postSafariAudits);
  assert.match(postSafariAudits.command, /safari-webkit-closure-audit\.mjs/);
  assert.match(postSafariAudits.command, /source-consumption-shape-audit\.mjs/);
  assert.match(postSafariAudits.command, /memory-frontier-audit\.mjs/);
  assert.match(postSafariAudits.command, /target-distance-audit\.mjs/);
  assert.match(postSafariAudits.command, /text-materialization-boundary-audit\.mjs/);
  assert.match(postSafariAudits.command, /text-materialization-frontier-coverage-audit\.mjs/);
  assert.ok(
    postSafariAudits.command.indexOf('same-contract-runtime-comparison.mjs')
      < postSafariAudits.command.indexOf('safari-webkit-closure-audit.mjs')
      && postSafariAudits.command.indexOf('safari-webkit-closure-audit.mjs')
        < postSafariAudits.command.indexOf('runtime-counterexample-scan.mjs')
      && postSafariAudits.command.indexOf('runtime-counterexample-scan.mjs')
        < postSafariAudits.command.indexOf('runtime-proof-coverage-audit.mjs')
      && postSafariAudits.command.indexOf('runtime-proof-coverage-audit.mjs')
        < postSafariAudits.command.indexOf('source-consumption-shape-audit.mjs')
      && postSafariAudits.command.indexOf('source-consumption-shape-audit.mjs')
        < postSafariAudits.command.indexOf('memory-frontier-audit.mjs')
      && postSafariAudits.command.indexOf('memory-frontier-audit.mjs')
        < postSafariAudits.command.indexOf('target-distance-audit.mjs')
      && postSafariAudits.command.indexOf('target-distance-audit.mjs')
        < postSafariAudits.command.indexOf('text-materialization-boundary-audit.mjs')
      && postSafariAudits.command.indexOf('text-materialization-boundary-audit.mjs')
        < postSafariAudits.command.indexOf('text-materialization-frontier-coverage-audit.mjs')
      && postSafariAudits.command.indexOf('text-materialization-frontier-coverage-audit.mjs')
        < postSafariAudits.command.indexOf('runtime-limit-proof-obligation-gate.mjs'),
    'post-safari audits must refresh comparison, Safari closure, counterexample, coverage, source, frontier, gate, and handoff in order',
  );
  const postSpiderMonkeyAudits = report.commandChecks.find(check => check.id === 'post-spidermonkey-audits');
  assert.ok(postSpiderMonkeyAudits);
  assert.match(postSpiderMonkeyAudits.command, /stax-public-reader-host-api-boundary-audit\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /spidermonkey-jsshell-tokenizer-headroom\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /spidermonkey-jsshell-materialized-headroom\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /spidermonkey-codegen-closure-audit\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /spidermonkey-codegen-rerun-stability-audit\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /runtime-counterexample-scan\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /runtime-proof-coverage-audit\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /source-consumption-shape-audit\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /memory-frontier-audit\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /target-distance-audit\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /text-materialization-boundary-audit\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /text-materialization-frontier-coverage-audit\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /runtime-limit-proof-obligation-gate\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /runtime-proof-gap-handoff\.mjs/);
  assert.ok(
    postSpiderMonkeyAudits.command.indexOf('stax-public-reader-host-api-boundary-audit.mjs')
      < postSpiderMonkeyAudits.command.indexOf('spidermonkey-jsshell-tokenizer-headroom.mjs')
      && postSpiderMonkeyAudits.command.indexOf('spidermonkey-jsshell-tokenizer-headroom.mjs')
        < postSpiderMonkeyAudits.command.indexOf('spidermonkey-jsshell-materialized-headroom.mjs')
      && postSpiderMonkeyAudits.command.indexOf('spidermonkey-jsshell-materialized-headroom.mjs')
        < postSpiderMonkeyAudits.command.indexOf('spidermonkey-codegen-closure-audit.mjs')
      && postSpiderMonkeyAudits.command.indexOf('spidermonkey-codegen-closure-audit.mjs')
        < postSpiderMonkeyAudits.command.indexOf('spidermonkey-codegen-rerun-stability-audit.mjs')
      && postSpiderMonkeyAudits.command.indexOf('spidermonkey-codegen-rerun-stability-audit.mjs')
        < postSpiderMonkeyAudits.command.indexOf('runtime-counterexample-scan.mjs')
      && postSpiderMonkeyAudits.command.indexOf('runtime-counterexample-scan.mjs')
        < postSpiderMonkeyAudits.command.indexOf('runtime-proof-coverage-audit.mjs')
      && postSpiderMonkeyAudits.command.indexOf('runtime-proof-coverage-audit.mjs')
        < postSpiderMonkeyAudits.command.indexOf('source-consumption-shape-audit.mjs')
      && postSpiderMonkeyAudits.command.indexOf('source-consumption-shape-audit.mjs')
        < postSpiderMonkeyAudits.command.indexOf('memory-frontier-audit.mjs')
      && postSpiderMonkeyAudits.command.indexOf('memory-frontier-audit.mjs')
        < postSpiderMonkeyAudits.command.indexOf('target-distance-audit.mjs')
      && postSpiderMonkeyAudits.command.indexOf('target-distance-audit.mjs')
        < postSpiderMonkeyAudits.command.indexOf('text-materialization-boundary-audit.mjs')
      && postSpiderMonkeyAudits.command.indexOf('text-materialization-boundary-audit.mjs')
        < postSpiderMonkeyAudits.command.indexOf('text-materialization-frontier-coverage-audit.mjs')
      && postSpiderMonkeyAudits.command.indexOf('text-materialization-frontier-coverage-audit.mjs')
        < postSpiderMonkeyAudits.command.indexOf('runtime-limit-proof-obligation-gate.mjs')
      && postSpiderMonkeyAudits.command.indexOf('runtime-limit-proof-obligation-gate.mjs')
        < postSpiderMonkeyAudits.command.indexOf('runtime-proof-gap-handoff.mjs'),
    'post-spidermonkey audits must refresh host boundary, tokenizer headroom, materialized headroom, counterexample scan, coverage, source audit, frontier audits, gate, and handoff in order',
  );
  assert.ok(report.findings.some(finding =>
    finding.id === 'handoff-static-validation'
    && finding.classification === 'CONTRACT_FACT'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'handoff-scope-guard'
    && finding.classification === 'SCOPE_GUARD'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Runtime Proof Handoff Validation/);
  assert.match(markdown, /Pass: yes/);
  assert.match(markdown, /Commands checked: 15/);
  assert.match(markdown, /Scripts referenced: 23/);
  assert.match(markdown, /Missing scripts: 0/);
  assert.match(markdown, /Release output paths: 78/);
  assert.match(markdown, /Raw output path policy violations: 0/);
  assert.match(markdown, /External-run status pinned: yes/);
  assert.match(markdown, /External-run required handoffs: 2/);
  assert.match(markdown, /Locally runnable handoffs: 0/);
  assert.match(markdown, /\| `safari-webkit-browser-row-handoff` \| EXTERNAL_RUN_REQUIRED \| external-run-required \| no \| 5 \| yes \| yes \| yes \|/);
  assert.match(markdown, /\| `spidermonkey-codegen-handoff` \| EXTERNAL_RUN_REQUIRED \| external-run-required \| no \| 10 \| yes \| yes \| yes \|/);
  assert.match(markdown, /\| `safari-webkit-browser-row-handoff` \| `safari-books-corpus-cross-process` \| .*? \| yes \| yes \| yes \|/);
  assert.match(markdown, /\| `safari-webkit-browser-row-handoff` \| `safari-webkit-closure-audit` \| .*? \| yes \| yes \| none \|/);
  assert.match(markdown, /\| `spidermonkey-codegen-handoff` \| `firefox-diagnostic-installed-or-debug-build` \| .*? \| yes \| yes \| yes \|/);
  assert.match(markdown, /\| `spidermonkey-codegen-handoff` \| `spidermonkey-jsshell-tokenizer-headroom` \| .*? \| yes \| yes \| none \|/);
  assert.match(markdown, /\| `spidermonkey-codegen-handoff` \| `spidermonkey-jsshell-materialized-headroom` \| .*? \| yes \| yes \| none \|/);
  assert.match(markdown, /\| `spidermonkey-codegen-handoff` \| `spidermonkey-codegen-closure-audit` \| .*? \| yes \| yes \| none \|/);
  assert.match(markdown, /\| `spidermonkey-codegen-handoff` \| `spidermonkey-codegen-rerun-stability-audit` \| .*? \| yes \| yes \| none \|/);
  assert.match(markdown, /\| `spidermonkey-codegen-handoff` \| `stax-public-reader-host-api-boundary` \| .*? \| yes \| yes \| none \|/);
  assert.match(markdown, /spidermonkey-jsshell-materialized-headroom\.mjs/);
  assert.match(markdown, /spidermonkey-codegen-closure-audit\.mjs/);
  assert.match(markdown, /spidermonkey-codegen-rerun-stability-audit\.mjs/);
  assert.match(markdown, /spidermonkey-jsshell-tokenizer-headroom\.mjs/);
  assert.match(markdown, /stax-public-reader-host-api-boundary-audit\.mjs/);
  assert.match(markdown, /safari-webkit-closure-audit\.mjs/);
  assert.match(markdown, /source-consumption-shape-audit\.mjs/);
  assert.match(markdown, /memory-frontier-audit\.mjs/);
  assert.match(markdown, /target-distance-audit\.mjs/);
  assert.match(markdown, /text-materialization-boundary-audit\.mjs/);
  assert.match(markdown, /text-materialization-frontier-coverage-audit\.mjs/);
  assert.match(markdown, /cannot close Safari\/WebKit browser rows or SpiderMonkey emitted IR obligations/);
  assert.match(markdown, /No external benchmark command is executed by this audit/);
});

test('runtime proof handoff validation fails if an active handoff is no longer pinned as external-run-required', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const safari = handoff.handoffs.find(row => row.id === 'safari-webkit-browser-row-handoff');
  safari.localClosure.localStatus = 'locally-runnable';
  safari.localClosure.localRunnable = true;
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allExternalRunRequired, false);
  assert.equal(report.summary.externalRunRequiredCount, 1);
  assert.equal(report.summary.localRunnableCount, 1);
  const safariCheck = report.handoffChecks.find(row => row.id === 'safari-webkit-browser-row-handoff');
  assert.equal(safariCheck.externalRunRequired, false);
  assert.equal(safariCheck.localRunnable, true);

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /External-run status pinned: no/);
  assert.match(markdown, /\| `safari-webkit-browser-row-handoff` \| EXTERNAL_RUN_REQUIRED \| locally-runnable \| yes \| 5 \| yes \| yes \| no \|/);
});

test('runtime proof handoff validation fails if SpiderMonkey omits diagnostic row identity blockers', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .map(item => item.replace(/, and selectedRowIdentityStatus=not-claimed-non-stax-diagnostic/g, ''));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /selectedRowIdentityStatus/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey omits Taskcluster source revision', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .map(item => item.replace(/, sourceRevision=[0-9a-f]{40}/g, ''));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /sourceRevision/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey omits Taskcluster artifact URL identity', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .map(item => item.replace(/, artifactName=public\/build\/target\.jsshell\.zip, artifactUrl=https:\/\/firefox-ci-tc\.services\.mozilla\.com\/api\/queue\/v1\/task\/[A-Za-z0-9_-]+\/artifacts\/public\/build\/target\.jsshell\.zip/g, ''));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /artifactUrl/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey omits diagnostic identity status counts', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  delete spiderMonkey.localClosure.diagnosticIdentityStatusCounts;
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .filter(item => !/selectedRowIdentityStatusCounts/.test(item));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /selectedRowIdentityStatusCounts/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey omits ASCII scope-distance boundary', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.evidenceArtifacts = spiderMonkey.localClosure.evidenceArtifacts
    .filter(item => item !== 'spidermonkey-ascii-scope-distance-audit.json');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .filter(item => !/ASCII scope-distance audit/.test(item));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /spidermonkey-ascii-scope-distance-audit/.test(pattern)));
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /ASCII scope-distance audit pins/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey omits materialized UTF-8 fallback boundary', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .filter(item => !/materialized scope-distance audit pins/.test(item));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /materialized scope-distance audit pins/.test(pattern)));
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /primarySyncByteBatchMissingGlobals=none/.test(pattern)));
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /asciiTextDecoderEquivalent=true/.test(pattern)));
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /utf8FallbackDecoder=true/.test(pattern)));
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /nonUtf8RequiresTextDecoder=true/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if Safari closure omits same-contract comparison check', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const safari = handoff.handoffs.find(row => row.id === 'safari-webkit-browser-row-handoff');
  safari.closureChecks = safari.closureChecks.filter(item => !/primaryRowsInSameContractComparison/.test(item));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const safariCheck = report.handoffChecks.find(row => row.id === 'safari-webkit-browser-row-handoff');
  assert.equal(safariCheck.contractsPresent, false);
  assert.ok(safariCheck.requiredContractPatterns.some(pattern => /primaryRowsInSameContractComparison/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /safari-webkit-browser-row-handoff/);
});

test('runtime proof handoff validation fails if Safari omits local host and harness runability details', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const safari = handoff.handoffs.find(row => row.id === 'safari-webkit-browser-row-handoff');
  safari.localClosure.blockers = safari.localClosure.blockers
    .map(item => item.replace(/ \(hostPlatform=[^\)]+\)/g, ''));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const safariCheck = report.handoffChecks.find(row => row.id === 'safari-webkit-browser-row-handoff');
  assert.equal(safariCheck.contractsPresent, false);
  assert.ok(safariCheck.requiredContractPatterns.some(pattern => /hostPlatform/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /safari-webkit-browser-row-handoff/);
});

test('runtime proof handoff validation fails if Safari closure omits 1GiB primary row checks', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const safari = handoff.handoffs.find(row => row.id === 'safari-webkit-browser-row-handoff');
  safari.closureChecks = safari.closureChecks.filter(item =>
    !/largeBoundedPrimarySyncByteBatchRowsRecorded/.test(item)
    && !/largePrimaryRowsInSameContractComparison/.test(item)
  );
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const safariCheck = report.handoffChecks.find(row => row.id === 'safari-webkit-browser-row-handoff');
  assert.equal(safariCheck.contractsPresent, false);
  assert.ok(safariCheck.requiredContractPatterns.some(pattern => /largeBoundedPrimarySyncByteBatchRowsRecorded/.test(pattern)));
  assert.ok(safariCheck.requiredContractPatterns.some(pattern => /largePrimaryRowsInSameContractComparison/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /safari-webkit-browser-row-handoff/);
});

test('runtime proof handoff validation fails if Safari omits memory and counterexample requirements', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const safari = handoff.handoffs.find(row => row.id === 'safari-webkit-browser-row-handoff');
  safari.expectedEvidence = safari.expectedEvidence.filter(item => !/Memory evidence is classified explicitly/.test(item));
  safari.closureChecks = safari.closureChecks.filter(item => !/runtime-counterexample-scan\.json/.test(item));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const safariCheck = report.handoffChecks.find(row => row.id === 'safari-webkit-browser-row-handoff');
  assert.equal(safariCheck.contractsPresent, false);
  assert.ok(safariCheck.requiredContractPatterns.some(pattern => /Memory evidence is classified explicitly/.test(pattern)));
  assert.ok(safariCheck.requiredContractPatterns.some(pattern => /runtime-counterexample-scan/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /safari-webkit-browser-row-handoff/);
});

test('runtime proof handoff validation fails if Safari omits target-distance refresh', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const safari = handoff.handoffs.find(row => row.id === 'safari-webkit-browser-row-handoff');
  safari.closureChecks = safari.closureChecks.filter(item => !/target-distance-audit\.json/.test(item));
  safari.commands = safari.commands.map(command =>
    command.id === 'post-safari-audits'
      ? { ...command, command: command.command.replace(/ && node packages\/benchmark\/target-distance-audit\.mjs[^&]+/g, '') }
      : command
  );
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allRequiredFlagsPresent, false);
  assert.equal(report.summary.allContractsPresent, false);
  const safariCheck = report.handoffChecks.find(row => row.id === 'safari-webkit-browser-row-handoff');
  assert.equal(safariCheck.requiredFlagsPresent, false);
  assert.equal(safariCheck.contractsPresent, false);
  assert.ok(safariCheck.requiredFlagPatterns.some(pattern => /target-distance-audit/.test(pattern)));
  assert.ok(safariCheck.requiredContractPatterns.some(pattern => /target-distance-audit/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /safari-webkit-browser-row-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey closure omits same-contract comparison check', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.closureChecks = spiderMonkey.closureChecks.filter(item => !/selected row id must match a current same-contract/.test(item));
  spiderMonkey.expectedEvidence = spiderMonkey.expectedEvidence.filter(item => !/selectedRowMatchesCurrentComparison=true/.test(item));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /selected row id/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey closure omits closing metadata requirements', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.closureChecks = spiderMonkey.closureChecks.filter(item => !/closing artifact must include runtime\/build identity/.test(item));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /diagnostic flags/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey expected evidence omits closure artifact schema', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.expectedEvidence = spiderMonkey.expectedEvidence.filter(item =>
    !/closesEmittedIrObligation=true|selectedRowMatchesCurrentComparison=true|evidenceClassAllowed=true/.test(item)
  );
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /closesEmittedIrObligation=true/.test(pattern)));
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /selectedRowMatchesCurrentComparison=true/.test(pattern)));
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /evidenceClassAllowed=true/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey closure omits selected-row metadata missing field counts', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .map(item => item.replace(/, selectedRowMetadataMissingFieldCounts selectedChecksum=\d+, selectedEventCount=\d+, selectedRowId=\d+/g, ''));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /selectedRowMetadataMissingFieldCounts/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey closure omits selected-row comparison match counts', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .map(item => item.replace(/, selectedRowComparisonMatchCount=\d+, selectedRowComparisonMismatchCount=\d+, selectedRowComparisonMissingCount=\d+/g, ''));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /selectedRowComparisonMatchCount/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey closure omits diagnostic workload metadata counts', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .map(item => item.replace(/, diagnosticWorkloadMetadataCount=\d+, nonComparableDiagnosticWorkloadMetadataCount=\d+/g, ''));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /diagnosticWorkloadMetadataCount/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey closure omits codegen comparison freshness', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .map(item => item.replace(/ against same-contract comparison generatedAt=[^,]+, comparisonRowCount=\d+/g, ''));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /same-contract comparison generatedAt/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey closure omits closing metadata missing field counts', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .map(item => item.replace(/, closingMetadataMissingFieldCounts diagnosticFlags=\d+, emittedDumpMetadata=\d+, runtimeBuildIdentity=\d+/g, ''));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /closingMetadataMissingFieldCounts/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey closure omits disallowed evidence class counts', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .map(item => item.replace(/, disallowedEvidenceClassCounts .*?, selectedRowIdentityStatusCounts/g, ', selectedRowIdentityStatusCounts'));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /disallowedEvidenceClassCounts/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey handoff omits bytecode-only disallowed class', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .map(item => item.replace(/, bytecode-diagnostic-only=\d+/g, ''));
  spiderMonkey.closureChecks = spiderMonkey.closureChecks
    .map(item => item.replace(/, bytecode-diagnostic-only/g, ''));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /bytecode-diagnostic-only/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey closure omits closure audit identity status counts', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .map(item => item.replace(/, selectedRowIdentityStatusCounts (?:not-claimed-ascii-stax-diagnostic=\d+, )?not-claimed-non-stax-diagnostic=\d+/g, ''));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /selectedRowIdentityStatusCounts/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey closure omits contradicted closure claim count', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .map(item => item.replace(/, contradictedClosureClaimCount=0/g, ''));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /contradictedClosureClaimCount=0/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey closure omits named closest blocked candidates', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .map(item => item.replace(/, closestBlockedCandidates=[^,]+(?:, `[^`]+`){4}/g, ''));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /closestBlockedCandidates=/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

test('runtime proof handoff validation fails if SpiderMonkey closure omits frontier evidence-class blocker', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.localClosure.blockers = spiderMonkey.localClosure.blockers
    .map(item => item.replace(/, evidenceClassAllowed=\d+/g, ''));
  writeFileSync(badHandoffJson, `${JSON.stringify(handoff, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-handoff-validation.mjs'),
    '--handoff-json',
    badHandoffJson,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.allContractsPresent, false);
  const spiderMonkeyCheck = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.equal(spiderMonkeyCheck.contractsPresent, false);
  assert.ok(spiderMonkeyCheck.requiredContractPatterns.some(pattern => /evidenceClassAllowed=/.test(pattern)));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Pass: no/);
  assert.match(markdown, /spidermonkey-codegen-handoff/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut, badHandoffJson, badJsonOut, badMdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
}
