import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'quick-xml-allocation-count-report-test.json');
const mdOut = join(tmpDir, 'quick-xml-allocation-count-report-test.md');

test('quick-xml allocation count report records measured allocator counters without claiming a runtime limit', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'quick-xml-allocation-count.mjs'),
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
  assert.equal(report.objective, 'quick-xml-allocation-count');
  assert.equal(report.contract, 'measured-consume-global-allocator-count');
  assert.equal(report.benchmark.eventCount, 967967);
  assert.equal(report.benchmark.checksum, -746772258);
  assert.equal(report.allocation.samples.length, 1);
  assert.equal(report.allocation.summary.allocationOperations, 10);
  assert.equal(report.allocation.summary.totalAllocatedBytes, 1148416);
  assert.equal(report.allocation.averagePerRun.netAllocatedBytes, 768);
  assert.ok(report.findings.some(entry => entry.id === 'same-contract-result' && entry.classification === 'BENCH_FACT'));
  assert.ok(report.findings.some(entry => entry.id === 'measured-allocation-counters' && entry.classification === 'TRACE_FACT'));
  assert.ok(report.findings.some(entry => entry.id === 'not-stack-or-lifetime-proof'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# quick-xml Measured Allocation Count/);
  assert.match(markdown, /TRACE_FACT/);
  assert.match(markdown, /same high-level data\/checksum contract/);
  assert.match(markdown, /not a JavaScript object-shape row/);
  assert.match(markdown, /measured `consume\(\)` windows after warmup/);
  assert.match(markdown, /not a speed baseline/);
  assert.doesNotMatch(markdown, /JavaScript runtimes cannot exceed 200 MiB\/s/i);
});
