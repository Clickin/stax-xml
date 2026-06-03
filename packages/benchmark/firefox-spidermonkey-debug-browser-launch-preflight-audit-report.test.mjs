import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'firefox-spidermonkey-debug-browser-launch-preflight-audit-test.json');
const mdOut = join(tmpDir, 'firefox-spidermonkey-debug-browser-launch-preflight-audit-test.md');

test('Taskcluster debug Firefox browser launch preflight records startup failure as non-closure evidence', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-spidermonkey-debug-browser-launch-preflight-audit.mjs'),
    '--self-test',
    '--browser-executable',
    join(tmpDir, 'self-test-firefox.exe'),
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
  assert.equal(report.objective, 'firefox-spidermonkey-taskcluster-debug-browser-launch-preflight-audit');
  assert.equal(report.contract, 'taskcluster-debug-firefox-browser-launch-preflight-not-same-contract-stax');
  assert.equal(report.outcome.status, 'blocked-by-dll-blocklist-interceptor');
  assert.equal(report.outcome.canStartDebugBrowser, false);
  assert.equal(report.outcome.sameContractStaxRow, false);
  assert.equal(report.outcome.closesEmittedIrObligation, false);
  assert.equal(report.outcome.emittedDump, false);
  assert.equal(report.outcome.evidenceClass, 'negative-diagnostic-surface');
  assert.equal(report.outcome.disableDllBlocklistChangedFailure, false);
  assert.equal(report.attempts.length, 2);
  assert.ok(report.attempts.every(attempt => attempt.dllBlocklistFailure));
  assert.ok(report.attempts.every(attempt => attempt.interceptorAssertion));
  assert.ok(report.findings.some(finding =>
    finding.id === 'taskcluster-debug-firefox-preflight-blocked'
    && finding.classification === 'NEGATIVE_RESULT'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'debug-browser-preflight-scope'
    && finding.classification === 'SCOPE_GUARD'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /Taskcluster Debug Browser Launch Preflight Audit/);
  assert.match(markdown, /MOZ_DISABLE_DLL_BLOCKLIST changed failure: no/);
  assert.match(markdown, /Closes emitted IR obligation: no/);
});
