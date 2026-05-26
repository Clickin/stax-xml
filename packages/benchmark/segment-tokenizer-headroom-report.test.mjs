import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'segment-tokenizer-headroom-report-test');
const jsonOut = join(tmpDir, 'segment-tokenizer-headroom.json');
const mdOut = join(tmpDir, 'segment-tokenizer-headroom.md');

test('segment tokenizer headroom report compares concat and no-concat token boundary probes', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'segment-tokenizer-headroom.mjs'),
    '--file',
    join(__dirname, 'test-data', 'runtime-comparison-16mib.xml'),
    '--chunk-kib',
    '16',
    '--batch-size',
    '4',
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
  assert.equal(report.objective, 'segment-tokenizer-headroom');
  assert.equal(report.contract, 'file-backed-xml-token-boundary-headroom');
  assert.match(report.note, /Benchmark-only probe/);
  assert.match(report.note, /partial headroom evidence/);
  assert.equal(report.options.chunkKiB, 16);
  assert.equal(report.options.batchSize, 4);
  assert.equal(report.summary.rowCount, 3);
  assert.equal(report.summary.counterexamples200MiB, 0);
  assert.equal(typeof report.summary.groupedSegmentVsConcatRatio, 'number');
  assert.deepEqual(report.rows.map(row => row.id), [
    'singleton-segment-tokenize',
    'grouped-concat-tokenize',
    'grouped-segment-tokenize',
  ]);

  const first = report.rows[0];
  for (const row of report.rows) {
    assert.equal(row.fullStringParity, false);
    assert.equal(row.contractScope, 'xml-token-boundary-no-string-materialization');
    assert.equal(row.parserInput, 'synchronous Iterable<Uint8Array[]>');
    assert.equal(row.demandDrivenSource, true);
    assert.equal(row.directReadableStream, false);
    assert.equal(row.fullArrayBufferParserInput, false);
    assert.equal(row.eventCount, first.eventCount);
    assert.equal(row.startElementCount, first.startElementCount);
    assert.equal(row.endElementCount, first.endElementCount);
    assert.equal(row.textEventCount, first.textEventCount);
    assert.equal(row.attributeCount, first.attributeCount);
    assert.equal(row.checksum, first.checksum);
    assert.equal(row.boundedMemory, true);
    assert.equal(row.sampleCount, 1);
    assert.equal(row.sampleSpreadRatio, 0);
    assert.equal(row.memory.maxRssBytes > 0, true);
  }
  assert.equal(first.eventCount > 0, true);
  assert.equal(first.startElementCount > 0, true);
  assert.equal(first.endElementCount > 0, true);
  assert.equal(first.attributeCount > 0, true);

  const concat = report.rows.find(row => row.id === 'grouped-concat-tokenize');
  const segmented = report.rows.find(row => row.id === 'grouped-segment-tokenize');
  assert.equal(concat.concatBeforeTokenize, true);
  assert.equal(concat.segmentAwareTokenize, false);
  assert.equal(segmented.concatBeforeTokenize, false);
  assert.equal(segmented.segmentAwareTokenize, true);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Segment Tokenizer Headroom/);
  assert.match(markdown, /Grouped segment \/ concat ratio/);
  assert.match(markdown, /same-token-boundary-contract/);
  assert.match(markdown, /segment-tokenizer-headroom/);
  assert.match(markdown, /partial-not-stax-counterexample/);
  assert.match(markdown, /source-contract/);
  assert.match(markdown, /XML token-boundary probe only/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }
}
