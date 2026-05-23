import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'event-reader-string-large-report-test.json');
const mdOut = join(tmpDir, 'event-reader-string-large-report-test.md');

test('event reader string-input large report records object-path memory boundary', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'event-reader-string-large.mjs'),
    '--sizes-mib',
    '1',
    '--fixture-shape',
    'diverse-cycle',
    '--diverse-cycle-size',
    '64',
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
  assert.equal(report.objective, 'event-reader-string-large');
  assert.equal(report.contract, 'event-reader-sync-string-input-full-object-materialization');
  assert.equal(report.woodstoxTarget.baselineTool, 'woodstox');
  assert.equal(report.woodstoxTarget.goalRatio, 0.9);
  assert.deepEqual(report.options.sizesMiB, [1]);
  assert.equal(report.rows.length, 1);

  const row = report.rows[0];
  assert.equal(row.status, 'ok');
  assert.equal(row.fixture.generated, true);
  assert.equal(row.fixture.shape, 'diverse-cycle');
  assert.equal(row.fixture.rowCycleSize, 64);
  assert.ok(row.fixture.actualUtf8Bytes >= 1_048_576);
  assert.ok(row.fixture.estimatedUtf16Bytes >= row.fixture.stringCodeUnits);
  assert.ok(row.generation.delta.heapUsedBytes > 0);
  assert.ok(row.eventCount > 0);
  assert.ok(row.materializationCounters.eventObjects === row.eventCount);
  assert.ok(row.materializationCounters.stringFieldReads > 0);
  assert.ok(row.materializationCounters.attributePairs > 0);
  assert.equal(typeof row.memory.peakRssBytes, 'number');
  assert.equal(typeof row.memory.peakHeapUsedBytes, 'number');
  assert.equal(row.memory.samples.length, 1);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# EventReaderSync String-Input Large Benchmark/);
  assert.match(markdown, /complete XML string/);
  assert.match(markdown, /reference object path/);
  assert.match(markdown, /isolated child processes/);
  assert.match(markdown, /Estimated UTF-16 input/);
  assert.match(markdown, /## Generation Memory/);
  assert.match(markdown, /## Parse Memory/);
  assert.match(markdown, /event-object-materialization/);
});
