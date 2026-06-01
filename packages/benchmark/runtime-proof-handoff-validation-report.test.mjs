import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'runtime-proof-handoff-validation-report-test');
const jsonOut = join(tmpDir, 'runtime-proof-handoff-validation.json');
const mdOut = join(tmpDir, 'runtime-proof-handoff-validation.md');

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
  assert.equal(report.summary.commandCount, 9);
  assert.equal(report.summary.scriptsReferenced, 13);
  assert.equal(report.summary.missingScriptCount, 0);
  assert.equal(report.summary.releaseOutputPathCount, 36);
  assert.equal(report.summary.nonReleaseOutputPathCount, 0);
  assert.equal(report.summary.rawOutputPathCount, 2);
  assert.equal(report.summary.rawOutputPathPolicyViolationCount, 0);
  assert.equal(report.summary.allRequiredFlagsPresent, true);
  assert.equal(report.summary.allContractsPresent, true);
  assert.equal(report.summary.unhandledObligationCount, 0);
  assert.equal(report.summary.conclusionAllowed, false);

  const safari = report.handoffChecks.find(row => row.id === 'safari-webkit-browser-row-handoff');
  const spiderMonkey = report.handoffChecks.find(row => row.id === 'spidermonkey-codegen-handoff');
  assert.ok(safari);
  assert.ok(spiderMonkey);
  assert.equal(safari.commandCount, 4);
  assert.equal(safari.requiredFlagsPresent, true);
  assert.equal(safari.contractsPresent, true);
  assert.equal(spiderMonkey.commandCount, 5);
  assert.equal(spiderMonkey.requiredFlagsPresent, true);
  assert.equal(spiderMonkey.contractsPresent, true);
  assert.ok(safari.requiredFlagPatterns.some(pattern => pattern.includes('--harness safari-webdriver')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('directReadableStreamFullStringRowsRecorded')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('must not substitute for primarySyncByteBatchRowsRecorded')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('backpressure is respected')));
  assert.ok(spiderMonkey.requiredFlagPatterns.some(pattern => pattern.includes('FIREFOX_PATH')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('checksum parity')));

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
  const postSafariAudits = report.commandChecks.find(check => check.id === 'post-safari-audits');
  assert.ok(postSafariAudits);
  assert.match(postSafariAudits.command, /source-consumption-shape-audit\.mjs/);
  assert.ok(
    postSafariAudits.command.indexOf('source-consumption-shape-audit.mjs')
      < postSafariAudits.command.indexOf('runtime-limit-proof-obligation-gate.mjs'),
    'post-safari audits must refresh source-consumption-shape-audit before the runtime-limit gate',
  );
  const postSpiderMonkeyAudits = report.commandChecks.find(check => check.id === 'post-spidermonkey-audits');
  assert.ok(postSpiderMonkeyAudits);
  assert.match(postSpiderMonkeyAudits.command, /runtime-proof-coverage-audit\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /source-consumption-shape-audit\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /runtime-limit-proof-obligation-gate\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /runtime-proof-gap-handoff\.mjs/);
  assert.ok(
    postSpiderMonkeyAudits.command.indexOf('runtime-proof-coverage-audit.mjs')
      < postSpiderMonkeyAudits.command.indexOf('source-consumption-shape-audit.mjs')
      && postSpiderMonkeyAudits.command.indexOf('source-consumption-shape-audit.mjs')
        < postSpiderMonkeyAudits.command.indexOf('runtime-limit-proof-obligation-gate.mjs')
      && postSpiderMonkeyAudits.command.indexOf('runtime-limit-proof-obligation-gate.mjs')
        < postSpiderMonkeyAudits.command.indexOf('runtime-proof-gap-handoff.mjs'),
    'post-spidermonkey audits must refresh coverage, source audit, gate, and handoff in order',
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
  assert.match(markdown, /Commands checked: 9/);
  assert.match(markdown, /Scripts referenced: 13/);
  assert.match(markdown, /Missing scripts: 0/);
  assert.match(markdown, /Release output paths: 36/);
  assert.match(markdown, /Raw output path policy violations: 0/);
  assert.match(markdown, /\| `safari-webkit-browser-row-handoff` \| external-run-required \| 4 \| yes \| yes \|/);
  assert.match(markdown, /\| `spidermonkey-codegen-handoff` \| external-run-required \| 5 \| yes \| yes \|/);
  assert.match(markdown, /\| `safari-webkit-browser-row-handoff` \| `safari-books-corpus-cross-process` \| .*? \| yes \| yes \| yes \|/);
  assert.match(markdown, /\| `spidermonkey-codegen-handoff` \| `firefox-diagnostic-installed-or-debug-build` \| .*? \| yes \| yes \| yes \|/);
  assert.match(markdown, /source-consumption-shape-audit\.mjs/);
  assert.match(markdown, /cannot close Safari\/WebKit browser rows or SpiderMonkey emitted IR obligations/);
  assert.match(markdown, /No external benchmark command is executed by this audit/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
}
