import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'v8-allocation-sampling-report-test.json');
const mdOut = join(tmpDir, 'v8-allocation-sampling-report-test.md');
const outputDir = join(tmpDir, 'v8-allocation-sampling-report-test-raw');

test('V8 allocation sampling report records per-shape allocation evidence without claiming a runtime ceiling', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'v8-allocation-sampling.mjs'),
    '--self-test',
    '--output-dir',
    outputDir,
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
  assert.equal(report.objective, 'v8-allocation-sampling');
  assert.equal(report.contract, 'inspector-heapprofiler-sampling');
  assert.equal(report.rawArtifacts.committed, false);
  assert.deepEqual(report.cases.map(entry => entry.caseId), [
    'public-accessor',
    'raw-frame-direct-decode',
    'raw-frame-name-id-cache',
  ]);
  assert.ok(report.cases.every(entry => entry.eventCount === report.parity.eventCount));
  assert.ok(report.cases.every(entry => entry.checksum === report.parity.checksum));
  assert.ok(report.cases.every(entry => entry.sampledBytes >= 0));
  assert.ok(report.findings.some(entry => entry.id === 'allocation-sampling-not-ceiling-proof'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# V8 Allocation Sampling/);
  assert.match(markdown, /TRACE_FACT/);
  assert.match(markdown, /HeapProfiler/);
  assert.match(markdown, /not a proof that JavaScript runtimes have no further headroom/);
});
