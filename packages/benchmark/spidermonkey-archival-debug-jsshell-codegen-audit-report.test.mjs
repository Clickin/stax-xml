import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'spidermonkey-archival-debug-jsshell-codegen-audit-test');
const jsonOut = join(tmpDir, 'spidermonkey-archival-debug-jsshell-codegen-audit.json');
const mdOut = join(tmpDir, 'spidermonkey-archival-debug-jsshell-codegen-audit.md');

test('archival SpiderMonkey debug js-shell codegen audit stays scoped away from current StAX closure', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'spidermonkey-archival-debug-jsshell-codegen-audit.mjs'),
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
  assert.equal(report.objective, 'spidermonkey-archival-debug-jsshell-codegen-audit');
  assert.equal(report.contract, 'archival-debug-spidermonkey-codegen-surface-not-current-stax-evidence');
  assert.equal(report.outcome.hasCodegenDumpOutput, true);
  assert.equal(report.outcome.hasIrDumpSurface, true);
  assert.equal(report.outcome.hasNativeDisassemblySurface, true);
  assert.equal(report.outcome.scopeComparableToCurrentFirefox, false);
  assert.equal(report.outcome.sameContractStaxRow, false);
  assert.equal(report.outcome.canRunCurrentStaxFullStringBenchmark, false);
  assert.equal(report.outcome.closesEmittedIrObligation, false);
  assert.equal(report.shell.buildInfo.buildId, '20150102133716');
  assert.equal(report.shell.buildInfo.sourceRevision, 'b6b89746c58b');
  assert.equal(report.shell.codegenProbe.status, 'codegen-output-emitted');
  assert.equal(report.shell.codegenProbe.checksum, 5050);
  assert.ok(report.shell.codegenProbe.codegenMarkerCount > 0);
  assert.ok(report.shell.codegenProbe.ionScriptMarkerCount > 0);
  assert.ok(report.shell.codegenProbe.assemblyMnemonicCount > 0);
  assert.ok(report.findings.some(finding =>
    finding.id === 'archival-debug-jsshell-scope-guard'
    && finding.classification === 'SCOPE_GUARD'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /SpiderMonkey Archival Debug JS Shell Codegen Audit/);
  assert.match(markdown, /Version: JavaScript-C36\.0a2/);
  assert.match(markdown, /Build ID: 20150102133716/);
  assert.match(markdown, /Source revision: b6b89746c58b/);
  assert.match(markdown, /Codegen dump output emitted: true/);
  assert.match(markdown, /Scope comparable to current Firefox: false/);
  assert.match(markdown, /Same-contract StAX row: false/);
  assert.match(markdown, /Closes emitted IR obligation: false/);
  assert.match(markdown, /Codegen marker count: 1800/);
  assert.match(markdown, /Created IonScript/);
  assert.match(markdown, /current diagnostic-capable Firefox\/SpiderMonkey build is still required/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
}
