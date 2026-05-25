import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'file-backed-public-consumer-shape-sweep-report-test');
const jsonOut = join(tmpDir, 'file-backed-public-consumer-shape-sweep.json');
const mdOut = join(tmpDir, 'file-backed-public-consumer-shape-sweep.md');

test('file-backed public consumer shape sweep preserves full-string checksum contract', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'file-backed-public-consumer-shape-sweep.mjs'),
    '--file',
    join(__dirname, 'test-data', 'runtime-comparison-16mib.xml'),
    '--variants',
    'public-baseline,public-no-optional-text,public-switch-dispatch',
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
  assert.equal(report.objective, 'file-backed-public-consumer-shape-sweep');
  assert.equal(report.contract, 'same-full-string-checksum-public-streambatch-consumer-shapes');
  assert.equal(report.summary.rowCount, 3);
  assert.equal(report.summary.counterexamples200MiB, 0);
  assert.deepEqual(report.summary.eventCountSet, [967967]);
  assert.deepEqual(report.summary.checksumSet, [-746772258]);
  assert.deepEqual(report.rows.map(row => row.id), [
    'public-baseline',
    'public-no-optional-text',
    'public-switch-dispatch',
  ]);
  for (const row of report.rows) {
    assert.equal(row.fullStringParity, true);
    assert.equal(row.eventCount, 967967);
    assert.equal(row.checksum, -746772258);
    assert.equal(row.boundedMemory, true);
    assert.equal(row.memory.maxRssBytes > 0, true);
  }

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# File-Backed Public Consumer Shape Sweep/);
  assert.match(markdown, /consumer-shape-headroom/);
  assert.match(markdown, /200 MiB\/s bounded full-string counterexamples: 0/);
  assert.match(markdown, /not a JavaScript runtime ceiling proof/);
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
