import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'firefox-spidermonkey-js-shell-availability-audit-test');
const jsonOut = join(tmpDir, 'firefox-spidermonkey-js-shell-availability-audit.json');
const mdOut = join(tmpDir, 'firefox-spidermonkey-js-shell-availability-audit.md');

test('Firefox SpiderMonkey JS shell availability audit records missing shell as scoped negative result', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-spidermonkey-js-shell-availability-audit.mjs'),
    '--self-test',
    'missing',
    '--candidates',
    'js,jsshell',
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
  assert.equal(report.objective, 'firefox-spidermonkey-js-shell-availability-audit');
  assert.equal(report.contract, 'local-spidermonkey-js-shell-codegen-surface-availability');
  assert.equal(report.outcome.status, 'not-found');
  assert.equal(report.outcome.foundCount, 0);
  assert.deepEqual(report.parameters.candidates, ['js', 'jsshell']);
  assert.ok(Array.isArray(report.parameters.searchRoots));
  assert.ok(report.probes.every(probe => probe.status === 'missing'));
  assert.ok(report.findings.some(finding =>
    finding.id === 'spidermonkey-js-shell-not-found'
    && finding.classification === 'NEGATIVE_RESULT'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'js-shell-availability-scope'
    && finding.classification === 'SCOPE_GUARD'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /Firefox\/SpiderMonkey JS Shell Availability Audit/);
  assert.match(markdown, /Status: not-found/);
  assert.match(markdown, /Search roots:/);
  assert.match(markdown, /No local SpiderMonkey JavaScript shell candidate was found/);
  assert.match(markdown, /not emitted JIT IR/);
});

test('Firefox SpiderMonkey JS shell availability audit records filesystem root probes', () => {
  resetTmp();
  const missingRoot = join(tmpDir, 'missing-root');
  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-spidermonkey-js-shell-availability-audit.mjs'),
    '--candidates',
    'js',
    '--search-roots',
    missingRoot,
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
  assert.deepEqual(report.parameters.searchRoots, [missingRoot]);
  assert.ok(report.probes.some(probe =>
    probe.source === 'filesystem-root'
    && probe.candidate === missingRoot
    && probe.status === 'root-missing'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'spidermonkey-js-shell-not-found'
    && /filesystem search roots/.test(finding.summary)
    && finding.evidence.some(entry => entry.includes(`searchRoots=${missingRoot}`))
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /filesystem-root/);
  assert.match(markdown, /root-missing/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }
}
