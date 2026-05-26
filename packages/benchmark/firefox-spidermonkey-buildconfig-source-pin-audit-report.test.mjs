import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'firefox-spidermonkey-buildconfig-source-pin-audit-test');
const jsonOut = join(tmpDir, 'firefox-spidermonkey-buildconfig-source-pin-audit.json');
const mdOut = join(tmpDir, 'firefox-spidermonkey-buildconfig-source-pin-audit.md');

test('Firefox SpiderMonkey buildconfig audit records JitSpew build flag boundary', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-spidermonkey-buildconfig-source-pin-audit.mjs'),
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
  assert.equal(report.objective, 'firefox-spidermonkey-buildconfig-source-pin-audit');
  assert.equal(report.contract, 'installed-firefox-buildconfig-jitspew-boundary');
  assert.equal(report.summary.version, '143.0.1');
  assert.equal(report.summary.sourceStamp, '644b498d517849c3fb95679e2017e965fe62b77a');
  assert.equal(report.summary.aboutBuildconfigCompleted, true);
  assert.equal(report.summary.configureMentionsEnableJsShell, false);
  assert.equal(report.summary.configureMentionsMozPackageJsShell, false);
  assert.equal(report.summary.configureMentionsEnableJitSpew, false);
  assert.equal(report.summary.configureMentionsJsJitSpew, false);
  assert.equal(report.summary.configureMentionsStructuredSpew, false);
  assert.ok(report.findings.some(finding =>
    finding.id === 'installed-firefox-source-stamp-pinned'
    && finding.classification === 'SOURCE_FACT'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'installed-firefox-buildconfig-does-not-mention-jitspew'
    && finding.classification === 'NEGATIVE_RESULT'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'buildconfig-audit-scope'
    && finding.classification === 'SCOPE_GUARD'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /Firefox\/SpiderMonkey Buildconfig Source Pin Audit/);
  assert.match(markdown, /Mentions --enable-js-shell: no/);
  assert.match(markdown, /Mentions MOZ_PACKAGE_JSSHELL=1: no/);
  assert.match(markdown, /Mentions --enable-jitspew: no/);
  assert.match(markdown, /not emitted SpiderMonkey JIT IR/);
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
