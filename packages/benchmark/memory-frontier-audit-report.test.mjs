import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'memory-frontier-audit-report-test.json');
const mdOut = join(tmpDir, 'memory-frontier-audit-report-test.md');
const badComparisonOut = join(tmpDir, 'memory-frontier-missing-bounded-proof-comparison.json');
const badJsonOut = join(tmpDir, 'memory-frontier-missing-bounded-proof.json');
const badMdOut = join(tmpDir, 'memory-frontier-missing-bounded-proof.md');

test('memory frontier audit keeps memory kinds and bounded rows explicit', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'memory-frontier-audit.mjs'),
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
  assert.equal(report.objective, 'memory-frontier-audit');
  assert.equal(report.contract, 'same-contract-1gib-plus-js-full-string-memory-frontier');
  assert.equal(report.summary.status, 'classified');
  assert.equal(report.summary.rows, 239);
  assert.equal(report.summary.jsLargeFullRowCount, 239);
  assert.equal(report.summary.boundedRows, 222);
  assert.equal(report.summary.unboundedRows, 17);
  assert.equal(report.summary.unboundedRowsAtOrAbove200MiBPerSec, 0);
  assert.equal(report.summary.fastestUnboundedRow.runtimeLabel, 'Bun/JSC');
  assert.equal(report.summary.fastestUnboundedRow.caseId, 'stringFull');
  assert.equal(report.summary.fastestUnboundedRow.rateMiBPerSec, 99.71);
  assert.equal(report.summary.fastestUnboundedRow.memoryKind, 'process-rss');
  assert.equal(report.summary.fastestUnboundedRow.maxMiB, 1956.69);
  assert.deepEqual(report.summary.memoryKinds, [
    'browser-js-heap',
    'browser-js-heap-unavailable',
    'process-rss',
  ]);
  assert.deepEqual(report.buckets.map(bucket => ({
    kind: bucket.kind,
    rows: bucket.rows,
    boundedRows: bucket.boundedRows,
    unboundedRows: bucket.unboundedRows,
    maxMiB: bucket.maxMiB,
    fastestRowRuntime: bucket.fastestRow?.runtimeLabel ?? null,
    fastestBoundedRuntime: bucket.fastestBoundedRow?.runtimeLabel ?? null,
  })), [
    {
      kind: 'browser-js-heap',
      rows: 20,
      boundedRows: 20,
      unboundedRows: 0,
      maxMiB: 358.37,
      fastestRowRuntime: 'Chrome/V8 browser',
      fastestBoundedRuntime: 'Chrome/V8 browser',
    },
    {
      kind: 'browser-js-heap-unavailable',
      rows: 9,
      boundedRows: 0,
      unboundedRows: 9,
      maxMiB: null,
      fastestRowRuntime: 'Firefox/SpiderMonkey browser',
      fastestBoundedRuntime: null,
    },
    {
      kind: 'process-rss',
      rows: 210,
      boundedRows: 202,
      unboundedRows: 8,
      maxMiB: 1956.69,
      fastestRowRuntime: 'Node/V8',
      fastestBoundedRuntime: 'Node/V8',
    },
  ]);
  assert.equal(report.summary.fastestBoundedRow.runtimeLabel, 'Node/V8');
  assert.equal(report.summary.fastestBoundedRow.caseId, 'rawFrameNameId');
  assert.equal(report.summary.fastestBoundedRow.rateMiBPerSec, 185.5);
  assert.equal(report.summary.fastestBoundedRow.memoryKind, 'process-rss');
  assert.equal(report.summary.fastestBoundedRow.maxMiB, 60.45);
  assert.equal(report.summary.fastestProcessRssUnder128MiB.maxMiB, 60.45);
  assert.equal(report.summary.fastestBrowserJsHeapRow.runtimeLabel, 'Chrome/V8 browser');
  assert.equal(report.summary.fastestBrowserJsHeapRow.rateMiBPerSec, 69.9);
  assert.equal(report.summary.fastestBrowserJsHeapRow.maxMiB, 39.55);
  assert.equal(report.summary.sameFixture1024MiBProcessRssSnapshot.fastestJs.maxRssMiB, 61.77);
  assert.equal(report.summary.sameFixture1024MiBProcessRssSnapshot.woodstox.maxRssMiB, 312.71);
  assert.equal(report.summary.sameFixture1024MiBProcessRssSnapshot.quickXml.maxRssMiB, 4.78);
  assert.match(report.summary.sameFixture1024MiBProcessRssSnapshot.caveat, /not allocation-model equivalence/);
  assert.ok(report.findings.some(entry => entry.id === 'memory-frontier-classified'));
  assert.ok(report.findings.some(entry => entry.id === 'memory-kinds-not-normalized'));
  assert.ok(report.findings.some(entry => entry.id === 'firefox-heap-unavailable-not-bounded-proof'));
  assert.ok(report.findings.some(entry => entry.id === 'same-fixture-rss-snapshot-not-allocation-model'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Memory Frontier Audit/);
  assert.match(markdown, /Rows classified: 239/);
  assert.match(markdown, /Bounded rows: 222/);
  assert.match(markdown, /Unbounded or unproven rows: 17/);
  assert.match(markdown, /Unbounded or unproven rows at or above 200 MiB\/s: 0/);
  assert.match(markdown, /Fastest unbounded or unproven row: Bun\/JSC `stringFull` 99\.71 MiB\/s/);
  assert.match(markdown, /Memory kinds: browser-js-heap, browser-js-heap-unavailable, process-rss/);
  assert.match(markdown, /\| browser-js-heap \| 20 \| 20 \| 0 \| 358\.37 MiB \| Chrome\/V8 browser `rawFrameNameId` 69\.90 MiB\/s/);
  assert.match(markdown, /\| browser-js-heap-unavailable \| 9 \| 0 \| 9 \| n\/a \| Firefox\/SpiderMonkey browser `rawFrameNameId` 64\.24 MiB\/s/);
  assert.match(markdown, /\| process-rss \| 210 \| 202 \| 8 \| 1956\.69 MiB \| Node\/V8 `rawFrameNameId` 185\.50 MiB\/s/);
  assert.match(markdown, /JavaScript: Node\/V8 `stax-raw-frame-name-id-batch-8` 152\.11 MiB\/s, process RSS 61\.77 MiB/);
  assert.match(markdown, /Woodstox: Java\/Woodstox `woodstox` 351\.56 MiB\/s, process RSS 312\.71 MiB/);
  assert.match(markdown, /quick-xml: Rust\/quick-xml `quick-xml` 274\.63 MiB\/s, process RSS 4\.78 MiB/);
  assert.match(markdown, /Process RSS, browser JS heap, and browser host-probe-only rows remain separate memory kinds/);
  assert.match(markdown, /Firefox\/SpiderMonkey browser rows without page JS heap counters remain unbounded or unproven/);
});

test('memory frontier audit downgrades bounded rows without numeric memory proof', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [badComparisonOut, badJsonOut, badMdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const comparison = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'same-contract-runtime-comparison.json'), 'utf8'));
  const row = comparison.comparisonRows.find(entry =>
    entry.jsRuntime
    && entry.fullStringParity === true
    && (entry.fixture?.sizeGiB ?? 0) >= 0.999
    && entry.boundedMemory === true
    && entry.caseId === 'rawFrameNameId'
  );
  assert.ok(row, 'expected a bounded rawFrameNameId row in the comparison fixture');
  row.memory.maxMiB = null;
  writeFileSync(badComparisonOut, `${JSON.stringify(comparison, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'memory-frontier-audit.mjs'),
    '--comparison-json',
    badComparisonOut,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.summary.status, 'partial');
  assert.equal(report.summary.boundedRowsWithoutNumericMemoryProof, 1);
  assert.equal(report.summary.unboundedRowsAtOrAbove200MiBPerSec, 0);
  assert.ok(report.findings.some(entry => entry.id === 'bounded-memory-proof-missing'));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Status: partial/);
  assert.match(markdown, /Bounded rows without numeric memory proof: 1/);
  assert.match(markdown, /boundedMemory=true but lack row-level numeric memory proof/);
});
