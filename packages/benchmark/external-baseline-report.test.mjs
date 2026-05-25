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
  assert.match(markdown, /\| Tool \| Implementation \| Throughput \| Peak RSS \| Woodstox ratio \| 0\.9x target \| Average \| Events \| Checksum \| Status \|/);
});

test('external baseline reports raw-frame fold-trim as a same-checksum candidate', () => {
  const foldJsonOut = join(tmpDir, 'external-baseline-fold-trim-test.json');
  const foldMdOut = join(tmpDir, 'external-baseline-fold-trim-test.md');
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [foldJsonOut, foldMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'external-baseline.mjs'),
    '--file',
    join(__dirname, 'test-data', 'runtime-comparison-16mib.xml'),
    '--tools',
    'stax-raw-frame-name-id,stax-raw-frame-name-id-fold-trim',
    '--runs',
    '1',
    '--warmups',
    '0',
    '--skip-build',
    '--stax-stream-source',
    'file-sync-batches',
    '--json-out',
    foldJsonOut,
    '--md-out',
    foldMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(foldJsonOut, 'utf8'));
  assert.deepEqual(report.results.map(row => row.tool), [
    'stax-raw-frame-name-id',
    'stax-raw-frame-name-id-fold-trim',
  ]);
  for (const row of report.results) {
    assert.equal(row.workload, 'full-string-checksum');
    assert.equal(row.eventCount, 967967);
    assert.equal(row.checksum, -746772258);
    assert.equal(row.boundedMemory, true);
    assert.equal(row.sourceMode, 'file-backed-sync-iterable-byte-batches');
    assert.equal(row.demandDrivenSource, true);
    assert.equal(row.respectsBackpressure, null);
    assert.equal(row.sourceConsumption.parserInput, 'synchronous Iterable<Uint8Array[]>');
    assert.equal(row.sourceConsumption.preMaterializesFullXml, false);
    assert.equal(row.sourceConsumption.directReadableStream, false);
    assert.equal(row.sourceConsumption.chunkBytes, 64 * 1024);
    assert.equal(row.sourceConsumption.batchSize, 1);
  }

  const markdown = readFileSync(foldMdOut, 'utf8');
  assert.match(markdown, /stax-raw-frame-name-id-fold-trim/);
  assert.match(markdown, /file-sync-batches mode/);
});

test('external baseline reports bounded value-cache as a same-checksum candidate', () => {
  const cacheJsonOut = join(tmpDir, 'external-baseline-string-cache-test.json');
  const cacheMdOut = join(tmpDir, 'external-baseline-string-cache-test.md');
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [cacheJsonOut, cacheMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'external-baseline.mjs'),
    '--file',
    join(__dirname, 'test-data', 'runtime-comparison-16mib.xml'),
    '--tools',
    'stax-raw-frame-name-id,stax-raw-frame-string-cache',
    '--runs',
    '1',
    '--warmups',
    '0',
    '--skip-build',
    '--stax-stream-source',
    'file-sync-batches',
    '--json-out',
    cacheJsonOut,
    '--md-out',
    cacheMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(cacheJsonOut, 'utf8'));
  assert.deepEqual(report.results.map(row => row.tool), [
    'stax-raw-frame-name-id',
    'stax-raw-frame-string-cache',
  ]);
  for (const row of report.results) {
    assert.equal(row.workload, 'full-string-checksum');
    assert.equal(row.eventCount, 967967);
    assert.equal(row.checksum, -746772258);
    assert.equal(row.boundedMemory, true);
    assert.equal(row.sourceMode, 'file-backed-sync-iterable-byte-batches');
    assert.equal(row.sourceConsumption.parserInput, 'synchronous Iterable<Uint8Array[]>');
    assert.equal(row.sourceConsumption.preMaterializesFullXml, false);
    assert.equal(row.sourceConsumption.directReadableStream, false);
  }

  const markdown = readFileSync(cacheMdOut, 'utf8');
  assert.match(markdown, /stax-raw-frame-string-cache/);
  assert.match(markdown, /file-sync-batches mode/);
});
