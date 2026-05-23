import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'bun-event-reader-string-large-report-test.json');
const mdOut = join(tmpDir, 'bun-event-reader-string-large-report-test.md');

function readBunVersion() {
  const result = spawnSync('bun', ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

test('bun event reader string-input large report records complete-string parse memory', { skip: readBunVersion() ? false : 'bun is not installed' }, () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'bun-event-reader-string-large.mjs'),
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
  assert.equal(report.objective, 'bun-event-reader-string-large');
  assert.equal(report.contract, 'bun-event-reader-sync-string-input-full-object-materialization');
  assert.equal(report.runtime.bunVersion, readBunVersion());
  assert.match(report.runtime.webkitCommit, /^[0-9a-f]{40}$/);
  assert.equal(report.options.fixtureShape, 'diverse-cycle');
  assert.equal(report.options.diverseCycleSize, 64);
  assert.deepEqual(report.options.sizesMiB, [1]);
  assert.equal(report.rows.length, 1);

  const row = report.rows[0];
  assert.equal(row.status, 'ok');
  assert.equal(row.runner, 'bun-child');
  assert.equal(row.fixture.generated, true);
  assert.equal(row.fixture.shape, 'diverse-cycle');
  assert.equal(row.fixture.rowCycleSize, 64);
  assert.ok(row.fixture.actualUtf8Bytes >= 1_048_576);
  assert.ok(row.fixture.stringCodeUnits > 0);
  assert.ok(row.generation.delta.rssBytes > 0);
  assert.ok(row.eventCount > 0);
  assert.equal(row.materializationCounters.eventObjects, row.eventCount);
  assert.ok(row.materializationCounters.stringFieldReads > 0);
  assert.ok(row.materializationCounters.attributePairs > 0);
  assert.equal(typeof row.memory.peakRssBytes, 'number');
  assert.equal(typeof row.memory.peakHeapUsedBytes, 'number');
  assert.equal(row.memory.samples.length, 1);

  assert.equal(report.findings.some((entry) => entry.id === 'bun-complete-string-parse-row'), true);
  assert.equal(report.findings.some((entry) => entry.id === 'not-byte-batch-ceiling'), true);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Bun EventReaderSync String-Input Large Benchmark/);
  assert.match(markdown, /Bun\/JSC/);
  assert.match(markdown, /complete XML string/);
  assert.match(markdown, /public event objects/);
  assert.match(markdown, /not a byte-batch runtime ceiling/);
  assert.match(markdown, /## Generation Memory/);
  assert.match(markdown, /## Parse Memory/);
  assert.match(markdown, /bun-complete-string-parse-row/);
});
