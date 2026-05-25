import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'stream-reader-large-shape-report-test.json');
const mdOut = join(tmpDir, 'stream-reader-large-shape-report-test.md');
const allocationJsonOut = join(tmpDir, 'stream-reader-large-shape-allocation-report-test.json');
const allocationMdOut = join(tmpDir, 'stream-reader-large-shape-allocation-report-test.md');
const allocationOutputDir = join(tmpDir, 'stream-reader-large-shape-allocation-raw');
const diverseNoAllocationJsonOut = join(tmpDir, 'stream-reader-large-shape-diverse-no-allocation-report-test.json');
const diverseNoAllocationMdOut = join(tmpDir, 'stream-reader-large-shape-diverse-no-allocation-report-test.md');
const diverseJsonOut = join(tmpDir, 'stream-reader-large-shape-diverse-report-test.json');
const diverseMdOut = join(tmpDir, 'stream-reader-large-shape-diverse-report-test.md');
const diverseOutputDir = join(tmpDir, 'stream-reader-large-shape-diverse-raw');

test('large stream-reader shape report records parity, memory, and materialization counters', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'stream-reader-4gb-consumption.mjs'),
    '--size-gib',
    '0.001',
    '--style',
    'shapes',
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
  assert.equal(report.objective, 'stream-reader-large-shape');
  assert.equal(report.contract, 'generated-byte-batch-full-string');
  assert.equal(report.parity.status, 'ok');
  assert.deepEqual(report.results.map(entry => entry.style), [
    'index-for',
    'raw-frame-direct',
    'raw-frame-name-id',
  ]);
  assert.ok(report.results.every(entry => entry.events === report.parity.events));
  assert.ok(report.results.every(entry => entry.checksum === report.parity.checksum));
  assert.ok(report.results.every(entry => entry.mibPerSec === entry.avgMiBs));
  assert.ok(report.results.every(entry => entry.fullStringParity === true));
  assert.ok(report.results.every(entry => entry.contractScope === 'full-string-materialization'));
  assert.ok(report.results.every(entry => entry.sourceMode === 'generated-sync-iterable-byte-batches'));
  assert.ok(report.results.every(entry => typeof entry.boundedMemory === 'boolean'));
  assert.ok(report.results.every(entry => entry.materialization.stringFieldReads > 0));
  assert.ok(report.results.every(entry => entry.materialization.eventObjects === 0));
  assert.equal(report.results.find(entry => entry.style === 'index-for').materialization.rawSpanMaterializations, 0);
  assert.ok(report.results.find(entry => entry.style === 'raw-frame-direct').materialization.rawSpanMaterializations > 0);
  assert.ok(report.results.find(entry => entry.style === 'raw-frame-name-id').materialization.rawNameCacheHits > 0);
  for (const entry of report.results) {
    assert.equal(typeof entry.memory?.avgHeapUsedDeltaBytes, 'number');
    assert.equal(typeof entry.memory?.avgRssDeltaBytes, 'number');
    assert.equal(typeof entry.memory?.maxRssBytes, 'number');
  }

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# StreamReaderSync Large Shape Benchmark/);
  assert.match(markdown, /## Materialization Counters/);
  assert.match(markdown, /Raw span materializations/);
  assert.match(markdown, /Name cache hit\/miss/);
  assert.match(markdown, /## Parity/);
});

test('large stream-reader shape report can include V8 allocation sampling without changing parity', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [allocationJsonOut, allocationMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'stream-reader-4gb-consumption.mjs'),
    '--size-gib',
    '0.001',
    '--style',
    'shapes',
    '--runs',
    '1',
    '--warmups',
    '0',
    '--allocation-sampling',
    '--allocation-sampling-interval',
    '1024',
    '--allocation-output-dir',
    allocationOutputDir,
    '--json-out',
    allocationJsonOut,
    '--md-out',
    allocationMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(allocationJsonOut, 'utf8'));
  assert.equal(report.objective, 'stream-reader-large-shape-allocation');
  assert.equal(report.contract, 'generated-byte-batch-full-string-allocation-sampling');
  assert.equal(report.allocationSampling.enabled, true);
  assert.equal(report.allocationSampling.rawArtifacts.committed, false);
  assert.ok(report.results.every(entry => entry.allocation));
  assert.ok(report.results.every(entry => entry.events === report.parity.events));
  assert.ok(report.results.every(entry => entry.checksum === report.parity.checksum));
  assert.ok(report.results.every(entry => entry.allocation.sampledBytes >= 0));

  const markdown = readFileSync(allocationMdOut, 'utf8');
  assert.match(markdown, /## V8 Allocation Sampling/);
  assert.match(markdown, /not a deterministic allocation census/);
});

test('large stream-reader shape report supports repeated diverse rows without allocation sampling', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [diverseNoAllocationJsonOut, diverseNoAllocationMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'stream-reader-4gb-consumption.mjs'),
    '--size-gib',
    '0.001',
    '--style',
    'shapes',
    '--runs',
    '2',
    '--warmups',
    '0',
    '--fixture-shape',
    'diverse-cycle',
    '--diverse-cycle-size',
    '64',
    '--json-out',
    diverseNoAllocationJsonOut,
    '--md-out',
    diverseNoAllocationMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(diverseNoAllocationJsonOut, 'utf8'));
  assert.equal(report.objective, 'stream-reader-large-shape');
  assert.equal(report.contract, 'generated-byte-batch-full-string');
  assert.equal(report.options.runs, 2);
  assert.equal(report.allocationSampling.enabled, false);
  assert.equal(report.fixture.shape, 'diverse-cycle');
  assert.equal(report.fixture.rowCycleSize, 64);
  assert.ok(report.fixture.minRowBytes < report.fixture.maxRowBytes);
  assert.ok(report.results.every(entry => entry.events === report.parity.events));
  assert.ok(report.results.every(entry => entry.checksum === report.parity.checksum));
  assert.ok(report.results.every(entry => entry.avgMiBs > 0));
  assert.ok(report.results.every(entry => entry.minMs <= entry.maxMs));
  assert.ok(report.results.every(entry => entry.allocation === undefined));

  const markdown = readFileSync(diverseNoAllocationMdOut, 'utf8');
  assert.match(markdown, /Fixture shape: diverse-cycle/);
  assert.match(markdown, /Row cycle size: 64/);
  assert.match(markdown, /Runs: warmups=0, runs=2/);
  assert.doesNotMatch(markdown, /## V8 Allocation Sampling/);
});

test('large stream-reader allocation report supports a bounded diverse row cycle', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [diverseJsonOut, diverseMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'stream-reader-4gb-consumption.mjs'),
    '--size-gib',
    '0.001',
    '--style',
    'shapes',
    '--runs',
    '1',
    '--warmups',
    '0',
    '--fixture-shape',
    'diverse-cycle',
    '--diverse-cycle-size',
    '64',
    '--allocation-sampling',
    '--allocation-sampling-interval',
    '1024',
    '--allocation-output-dir',
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
  assert.equal(report.fixture.shape, 'diverse-cycle');
  assert.equal(report.fixture.rowCycleSize, 64);
  assert.ok(report.fixture.minRowBytes < report.fixture.maxRowBytes);
  assert.ok(report.results.every(entry => entry.events === report.parity.events));
  assert.ok(report.results.every(entry => entry.checksum === report.parity.checksum));
  assert.ok(report.results.every(entry => entry.allocation.sampledBytes >= 0));

  const markdown = readFileSync(diverseMdOut, 'utf8');
  assert.match(markdown, /Fixture shape: diverse-cycle/);
  assert.match(markdown, /Row cycle size: 64/);
});
