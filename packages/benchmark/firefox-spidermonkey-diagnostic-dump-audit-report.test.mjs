import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'firefox-spidermonkey-diagnostic-dump-audit-test.json');
const mdOut = join(tmpDir, 'firefox-spidermonkey-diagnostic-dump-audit-test.md');

test('Firefox diagnostic dump audit records no-dump as a scoped negative result', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-spidermonkey-diagnostic-dump-audit.mjs'),
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
  assert.equal(report.objective, 'firefox-spidermonkey-diagnostic-dump-audit');
  assert.equal(report.contract, 'firefox-browser-spidermonkey-diagnostic-dump-availability');
  assert.equal(report.outcome.status, 'no-dump-emitted');
  assert.equal(report.outcome.emittedDump, false);
  assert.ok(report.findings.some(entry =>
    entry.id === 'spidermonkey-diagnostic-dump-not-emitted'
    && entry.classification === 'NEGATIVE_RESULT'
  ));
  assert.ok(report.findings.some(entry =>
    entry.id === 'diagnostic-dump-audit-scope'
    && entry.classification === 'SCOPE_GUARD'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /Firefox\/SpiderMonkey Diagnostic Dump Audit/);
  assert.match(markdown, /Emitted dump: no/);
  assert.match(markdown, /keep the codegen proof obligation open/);
});
