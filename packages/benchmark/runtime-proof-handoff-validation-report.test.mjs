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
  assert.equal(report.summary.commandCount, 9);
  assert.equal(report.summary.scriptsReferenced, 16);
  assert.equal(report.summary.missingScriptCount, 0);
  assert.equal(report.summary.releaseOutputPathCount, 48);
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
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('primaryRowsInSameContractComparison')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('largeBoundedPrimarySyncByteBatchRowsRecorded')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('largePrimaryRowsInSameContractComparison')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('same-contract-runtime-comparison')));
  assert.ok(safari.requiredContractPatterns.some(pattern => pattern.includes('backpressure is respected')));
  assert.ok(spiderMonkey.requiredFlagPatterns.some(pattern => pattern.includes('FIREFOX_PATH')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('diagnostic flags')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('selected row id')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('selectedRowIdentityStatus')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('selectedRowIdentityStatusCounts')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('spidermonkey-ascii-scope-distance-audit')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('ASCII scope-distance audit pins')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('same-contract-runtime-comparison')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('checksum parity')));
  assert.ok(spiderMonkey.requiredContractPatterns.some(pattern => pattern.includes('emitted IR or optimized-code dump metadata')));

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
  assert.match(postSafariAudits.command, /memory-frontier-audit\.mjs/);
  assert.match(postSafariAudits.command, /target-distance-audit\.mjs/);
  assert.match(postSafariAudits.command, /text-materialization-boundary-audit\.mjs/);
  assert.ok(
    postSafariAudits.command.indexOf('source-consumption-shape-audit.mjs')
      < postSafariAudits.command.indexOf('memory-frontier-audit.mjs')
      && postSafariAudits.command.indexOf('memory-frontier-audit.mjs')
        < postSafariAudits.command.indexOf('target-distance-audit.mjs')
      && postSafariAudits.command.indexOf('target-distance-audit.mjs')
        < postSafariAudits.command.indexOf('text-materialization-boundary-audit.mjs')
      && postSafariAudits.command.indexOf('text-materialization-boundary-audit.mjs')
        < postSafariAudits.command.indexOf('runtime-limit-proof-obligation-gate.mjs'),
    'post-safari audits must refresh source and frontier audits before the runtime-limit gate',
  );
  const postSpiderMonkeyAudits = report.commandChecks.find(check => check.id === 'post-spidermonkey-audits');
  assert.ok(postSpiderMonkeyAudits);
  assert.match(postSpiderMonkeyAudits.command, /runtime-proof-coverage-audit\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /source-consumption-shape-audit\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /memory-frontier-audit\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /target-distance-audit\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /text-materialization-boundary-audit\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /runtime-limit-proof-obligation-gate\.mjs/);
  assert.match(postSpiderMonkeyAudits.command, /runtime-proof-gap-handoff\.mjs/);
  assert.ok(
    postSpiderMonkeyAudits.command.indexOf('runtime-proof-coverage-audit.mjs')
      < postSpiderMonkeyAudits.command.indexOf('source-consumption-shape-audit.mjs')
      && postSpiderMonkeyAudits.command.indexOf('source-consumption-shape-audit.mjs')
        < postSpiderMonkeyAudits.command.indexOf('memory-frontier-audit.mjs')
      && postSpiderMonkeyAudits.command.indexOf('memory-frontier-audit.mjs')
        < postSpiderMonkeyAudits.command.indexOf('target-distance-audit.mjs')
      && postSpiderMonkeyAudits.command.indexOf('target-distance-audit.mjs')
        < postSpiderMonkeyAudits.command.indexOf('text-materialization-boundary-audit.mjs')
      && postSpiderMonkeyAudits.command.indexOf('text-materialization-boundary-audit.mjs')
        < postSpiderMonkeyAudits.command.indexOf('runtime-limit-proof-obligation-gate.mjs')
      && postSpiderMonkeyAudits.command.indexOf('runtime-limit-proof-obligation-gate.mjs')
        < postSpiderMonkeyAudits.command.indexOf('runtime-proof-gap-handoff.mjs'),
    'post-spidermonkey audits must refresh coverage, source audit, frontier audits, gate, and handoff in order',
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
  assert.match(markdown, /Scripts referenced: 16/);
  assert.match(markdown, /Missing scripts: 0/);
  assert.match(markdown, /Release output paths: 48/);
  assert.match(markdown, /Raw output path policy violations: 0/);
  assert.match(markdown, /\| `safari-webkit-browser-row-handoff` \| external-run-required \| 4 \| yes \| yes \|/);
  assert.match(markdown, /\| `spidermonkey-codegen-handoff` \| external-run-required \| 5 \| yes \| yes \|/);
  assert.match(markdown, /\| `safari-webkit-browser-row-handoff` \| `safari-books-corpus-cross-process` \| .*? \| yes \| yes \| yes \|/);
  assert.match(markdown, /\| `spidermonkey-codegen-handoff` \| `firefox-diagnostic-installed-or-debug-build` \| .*? \| yes \| yes \| yes \|/);
  assert.match(markdown, /source-consumption-shape-audit\.mjs/);
  assert.match(markdown, /memory-frontier-audit\.mjs/);
  assert.match(markdown, /target-distance-audit\.mjs/);
  assert.match(markdown, /text-materialization-boundary-audit\.mjs/);
  assert.match(markdown, /cannot close Safari\/WebKit browser rows or SpiderMonkey emitted IR obligations/);
  assert.match(markdown, /No external benchmark command is executed by this audit/);
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

test('runtime proof handoff validation fails if SpiderMonkey closure omits same-contract comparison check', () => {
  resetTmp();
  const handoff = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json'), 'utf8'));
  const spiderMonkey = handoff.handoffs.find(row => row.id === 'spidermonkey-codegen-handoff');
  spiderMonkey.closureChecks = spiderMonkey.closureChecks.filter(item => !/selected row id must match a current same-contract/.test(item));
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

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut, badHandoffJson, badJsonOut, badMdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
}
