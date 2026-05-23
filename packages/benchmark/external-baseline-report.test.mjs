import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'external-baseline-report-test.json');
const mdOut = join(tmpDir, 'external-baseline-report-test.md');

test('external baseline report keeps the Woodstox target visible', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'external-baseline.mjs'),
    '--tools',
    'stax-stream',
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
  assert.equal(report.target.baselineTool, 'woodstox');
  assert.equal(report.target.goalRatio, 0.9);
  assert.ok(Array.isArray(report.results), 'expected benchmark results');
  assert.equal(report.results[0].tool, 'stax-stream');
  assert.equal(report.results[0].workload, 'full-string-checksum');
  assert.equal(report.results[0].eventCount, 967967);
  assert.equal(report.results[0].checksum, -746772258);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /## Woodstox Target/);
  assert.match(markdown, /\| Tool \| Implementation \| Throughput \| Woodstox ratio \| 0\.9x target \| Average \| Events \| Checksum \| Status \|/);
});
