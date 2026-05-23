import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'runtime-matrix-report-test.json');
const mdOut = join(tmpDir, 'runtime-matrix-report-test.md');

test('runtime matrix reports compare runtimes within each workload', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'runtime-matrix.mjs'),
    '--runtimes',
    'node',
    '--runs',
    '1',
    '--warmups',
    '0',
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
  assert.ok(Array.isArray(report.comparisons), 'expected workload comparison entries');
  assert.ok(report.comparisons.length > 0, 'expected at least one workload comparison');

  const publicFullString = report.comparisons.find(entry => entry.workload === 'public-sync-full-string');
  assert.ok(publicFullString, 'expected public-sync-full-string workload comparison');
  assert.equal(publicFullString.parity.eventCount, 967967);
  assert.equal(publicFullString.parity.checksum, -746772258);
  assert.deepEqual(publicFullString.runtimes.map(entry => entry.runtime), ['node']);
  assert.equal(publicFullString.runtimes[0].relativeToBaseline, 1);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /## Runtime Comparisons/);
  assert.match(markdown, /\| Workload \| Runtime \| Version \| Throughput \| Relative to baseline \| Average \| Events \| Checksum \| Peak heap \| Status \|/);
  assert.doesNotMatch(markdown, /\| Runtime \| Version \| Scenario \|/);
});
