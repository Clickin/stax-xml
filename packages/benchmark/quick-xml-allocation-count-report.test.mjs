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
  assert.deepEqual(report.allocation.phaseSummary.map(row => row.phase), [
    'attribute-collection',
    'text-decode',
  ]);
  assert.equal(report.allocation.dominantPhase.phase, 'attribute-collection');
  assert.equal(report.allocation.shapeSummary.totalDecodeCount, 43);
  assert.equal(report.allocation.shapeSummary.totalBorrowedCount, 43);
  assert.equal(report.allocation.shapeSummary.totalOwnedCount, 0);
  assert.equal(report.allocation.shapeSummary.attributeCollectionCount, 10);
  assert.equal(report.allocation.shapeSummary.attributeVecNonEmptyCount, 9);
  assert.equal(report.allocation.shapeSummary.attributeItemCount, 18);
  assert.equal(report.allocation.shapeSummary.attributeVecCapacitySum, 36);
  assert.equal(report.allocation.shapeSummary.attributeVecMaxCapacity, 4);
  assert.equal(report.variants.length, 4);
  assert.deepEqual(report.variants.map(variant => variant.id), [
    'escaped-utf8',
    'nonascii-utf8',
    'cdata-utf8',
    'utf8-bom',
  ]);
  assert.ok(report.variants.every(variant => variant.allocation.shapeSummary.totalOwnedCount === 0));
  assert.ok(report.findings.some(entry => entry.id === 'same-contract-result' && entry.classification === 'BENCH_FACT'));
  assert.ok(report.findings.some(entry => entry.id === 'measured-allocation-counters' && entry.classification === 'TRACE_FACT'));
  assert.ok(report.findings.some(entry => entry.id === 'cow-ownership-counters' && entry.classification === 'TRACE_FACT'));
  assert.ok(report.findings.some(entry => entry.id === 'attribute-vec-shape-counters' && entry.classification === 'TRACE_FACT'));
  assert.ok(report.findings.some(entry => entry.id === 'phase-allocation-attribution' && entry.classification === 'TRACE_FACT'));
  assert.ok(report.findings.some(entry => entry.id === 'variant-cow-ownership-counters' && entry.classification === 'TRACE_FACT'));
  assert.ok(report.findings.some(entry => entry.id === 'not-stack-or-lifetime-proof'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# quick-xml Measured Allocation Count/);
  assert.match(markdown, /TRACE_FACT/);
  assert.match(markdown, /same high-level data\/checksum contract/);
  assert.match(markdown, /not a JavaScript object-shape row/);
  assert.match(markdown, /Cow Ownership Counts/);
  assert.match(markdown, /Attribute Vec Shape Counts/);
  assert.match(markdown, /comparator-local `Vec`/);
  assert.match(markdown, /attributeCollectionCount/);
  assert.match(markdown, /Phase Allocation Attribution/);
  assert.match(markdown, /attribute-collection/);
  assert.match(markdown, /direct comparator phase guards/);
  assert.match(markdown, /Generated Fixture Variants/);
  assert.match(markdown, /escaped-utf8/);
  assert.match(markdown, /nonascii-utf8/);
  assert.match(markdown, /cdata-utf8/);
  assert.match(markdown, /utf8-bom/);
  assert.match(markdown, /totalBorrowedCount/);
  assert.match(markdown, /measured `consume\(\)` windows after warmup/);
  assert.match(markdown, /not a speed baseline/);
  assert.doesNotMatch(markdown, /JavaScript runtimes cannot exceed 200 MiB\/s/i);
});
