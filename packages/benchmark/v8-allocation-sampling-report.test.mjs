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
const diverseJsonOut = join(tmpDir, 'v8-allocation-sampling-diverse-test.json');
const diverseMdOut = join(tmpDir, 'v8-allocation-sampling-diverse-test.md');
const diverseOutputDir = join(tmpDir, 'v8-allocation-sampling-diverse-test-raw');
const projectionJsonOut = join(tmpDir, 'v8-allocation-sampling-projection-test.json');
const projectionMdOut = join(tmpDir, 'v8-allocation-sampling-projection-test.md');
const projectionOutputDir = join(tmpDir, 'v8-allocation-sampling-projection-test-raw');

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
    'event-reader-object',
    'raw-frame-direct-decode',
    'raw-frame-name-id-cache',
  ]);
  assert.ok(report.cases.every(entry => entry.eventCount === report.parity.eventCount));
  assert.ok(report.cases.every(entry => entry.checksum === report.parity.checksum));
  assert.ok(report.cases.every(entry => entry.sampledBytes >= 0));
  assert.ok(report.findings.some(entry => entry.id === 'sampling-attribution-limit'));
  assert.ok(report.findings.some(entry => entry.id === 'allocation-sampling-not-ceiling-proof'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# V8 Allocation Sampling/);
  assert.match(markdown, /TRACE_FACT/);
  assert.match(markdown, /HeapProfiler/);
  assert.match(markdown, /not a proof that JavaScript runtimes have no further headroom/);
});

test('V8 allocation sampling supports generated diverse fixtures for stronger public event-object sampling', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [diverseJsonOut, diverseMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'v8-allocation-sampling.mjs'),
    '--generated-fixture',
    'diverse',
    '--size-mib',
    '1',
    '--cases',
    'public-accessor,event-reader-object',
    '--warmups',
    '0',
    '--iterations',
    '1',
    '--sampling-interval',
    '1024',
    '--output-dir',
    diverseOutputDir,
    '--json-out',
    diverseJsonOut,
    '--md-out',
    diverseMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(diverseJsonOut, 'utf8'));
  assert.equal(report.fixture.source, 'generated');
  assert.equal(report.fixture.shape, 'diverse');
  assert.ok(report.fixture.byteLength >= 0.95 * 1024 * 1024);
  assert.deepEqual(report.cases.map(entry => entry.caseId), [
    'public-accessor',
    'event-reader-object',
  ]);
  assert.ok(report.cases.every(entry => entry.eventCount === report.parity.eventCount));
  assert.ok(report.cases.every(entry => entry.checksum === report.parity.checksum));

  const markdown = readFileSync(diverseMdOut, 'utf8');
  assert.match(markdown, /Fixture shape: diverse/);
  assert.match(markdown, /less-repetitive generated fixture/);
});

test('V8 allocation sampling separates projection record evidence from stream parity', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [projectionJsonOut, projectionMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'v8-allocation-sampling.mjs'),
    '--generated-fixture',
    'projection-cycle',
    '--size-mib',
    '1',
    '--cases',
    'raw-frame-name-id-cache,projection-low-selectivity,projection-high-selectivity',
    '--warmups',
    '0',
    '--iterations',
    '1',
    '--sampling-interval',
    '1024',
    '--output-dir',
    projectionOutputDir,
    '--json-out',
    projectionJsonOut,
    '--md-out',
    projectionMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(projectionJsonOut, 'utf8'));
  assert.equal(report.fixture.source, 'generated');
  assert.equal(report.fixture.shape, 'projection-cycle');
  assert.deepEqual(report.cases.map(entry => entry.caseId), [
    'raw-frame-name-id-cache',
    'projection-low-selectivity',
    'projection-high-selectivity',
  ]);
  assert.equal(report.parity.status, 'ok');
  assert.deepEqual(report.parity.rowIds, ['raw-frame-name-id-cache']);
  assert.equal(report.projectionParity.status, 'ok');
  assert.deepEqual(report.projectionParity.rowIds, ['projection-low-selectivity', 'projection-high-selectivity']);

  const low = report.cases.find(entry => entry.caseId === 'projection-low-selectivity');
  const high = report.cases.find(entry => entry.caseId === 'projection-high-selectivity');
  assert.equal(low.eventCountKind, 'projected-records');
  assert.equal(high.eventCountKind, 'projected-records');
  assert.ok(low.eventCount > 0);
  assert.ok(high.eventCount > low.eventCount);
  assert.ok(low.sampledBytes >= 0);
  assert.ok(high.sampledBytes >= 0);
  assert.ok(report.findings.some(entry => entry.id === 'projection-selected-field-sampling'));

  const markdown = readFileSync(projectionMdOut, 'utf8');
  assert.match(markdown, /Fixture shape: projection-cycle/);
  assert.match(markdown, /Projection rows report projected record counts/);
  assert.match(markdown, /projection-low-selectivity/);
  assert.match(markdown, /projection-high-selectivity/);
});
