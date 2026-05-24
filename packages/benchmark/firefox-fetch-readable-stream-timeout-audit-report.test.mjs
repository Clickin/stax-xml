import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'firefox-fetch-readable-stream-timeout-audit-test.json');
const mdOut = join(tmpDir, 'firefox-fetch-readable-stream-timeout-audit-test.md');

test('Firefox fetch ReadableStream timeout audit records an explicit negative result', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-fetch-readable-stream-timeout-audit.mjs'),
    '--self-test',
    '--size-gib',
    '1',
    '--child-timeout-ms',
    '300000',
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
  assert.equal(report.objective, 'firefox-fetch-readable-stream-timeout-audit');
  assert.equal(report.contract, 'firefox-browser-fetch-readable-stream-full-event-object-timeout');
  assert.equal(report.outcome.status, 'timeout');
  assert.equal(report.outcome.completedWithinTimeout, false);
  assert.equal(report.outcome.impliedThroughputUpperBoundMiBPerSec < 4, true);
  assert.ok(report.findings.some(entry => entry.id === 'firefox-fetch-readable-stream-timeout'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /Firefox Fetch ReadableStream Timeout Audit/);
  assert.match(markdown, /Completed within timeout: no/);
  assert.match(markdown, /Implied throughput upper bound:/);
});
