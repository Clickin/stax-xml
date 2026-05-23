import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'candidate-headroom-cross-process-test.json');
const mdOut = join(tmpDir, 'candidate-headroom-cross-process-test.md');
const outputDir = join(tmpDir, 'candidate-headroom-cross-process-raw');

test('candidate headroom cross-process report separates projection rows from full parity', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'candidate-headroom-cross-process.mjs'),
    '--runtimes',
    'node',
    '--process-runs',
    '2',
    '--size-gib',
    '0.0001',
    '--fixture-shape',
    'projection-cycle',
    '--diverse-cycle-size',
    '16',
    '--cases',
    'stringFull,rawFrameNameId,projectionLowSelectivity,projectionHighSelectivity',
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
  assert.equal(report.objective, 'candidate-headroom-cross-process');
  assert.equal(report.contract, 'independent-process-candidate-headroom-stability');
  assert.deepEqual(report.options.runtimes, ['node']);
  assert.equal(report.options.processRuns, 2);
  assert.deepEqual(report.options.cases, [
    'stringFull',
    'rawFrameNameId',
    'projectionLowSelectivity',
    'projectionHighSelectivity',
  ]);
  assert.equal(report.runtimes.length, 1);
  assert.equal(report.runtimes[0].runtime, 'node');
  assert.equal(report.runtimes[0].sampleCount, 2);
  assert.equal(report.runtimes[0].childReports.length, 2);
  assert.deepEqual(report.runtimes[0].parity.streamAndFullRowIds, ['stringFull', 'rawFrameNameId']);
  assert.deepEqual(report.runtimes[0].parity.projectionRowIds, ['projectionLowSelectivity', 'projectionHighSelectivity']);
  assert.equal(report.runtimes[0].parity.streamAndFullRowsStable, true);
  assert.equal(report.runtimes[0].parity.projectionRowsStable, true);
  assert.ok(report.findings.some(entry => entry.id === 'independent-process-rerun'));
  assert.ok(report.findings.some(entry => entry.id === 'projection-contract-separated'));

  const full = report.runtimes[0].variants.find(entry => entry.id === 'rawFrameNameId');
  const low = report.runtimes[0].variants.find(entry => entry.id === 'projectionLowSelectivity');
  assert.equal(full.fullStringParity, true);
  assert.equal(low.fullStringParity, false);
  assert.equal(low.eventCountKind, 'projected-records');
  assert.equal(full.sampleCount, 2);
  assert.equal(low.sampleCount, 2);
  assert.equal(full.stableResult, true);
  assert.equal(low.stableResult, true);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /fresh runtime processes/);
  assert.match(markdown, /not a proof that JavaScript runtimes have no further headroom/);
  assert.match(markdown, /Projection rows report projected record counts/);
  assert.match(markdown, /Stream\/full rows stable across processes: yes/);
  assert.match(markdown, /Projection rows stable across processes: yes/);
});
