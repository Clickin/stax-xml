import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'file-backed-materialization-category-drop-sweep-report-test');
const jsonOut = join(tmpDir, 'file-backed-materialization-category-drop-sweep.json');
const mdOut = join(tmpDir, 'file-backed-materialization-category-drop-sweep.md');

test('file-backed materialization category drop sweep separates full and near-full rows', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'file-backed-materialization-category-drop-sweep.mjs'),
    '--file',
    join(__dirname, 'test-data', 'runtime-comparison-16mib.xml'),
    '--variants',
    'stringFull,withoutTextStrings,withoutAttributeValueStrings',
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
  assert.equal(report.objective, 'file-backed-materialization-category-drop-sweep');
  assert.equal(report.contract, 'file-backed-full-materialization-category-drop-headroom');
  assert.equal(report.summary.rowCount, 3);
  assert.equal(report.summary.counterexamples200MiB, 0);
  assert.deepEqual(report.summary.eventCountSet, [967967]);
  assert.deepEqual(report.rows.map(row => row.id), [
    'stringFull',
    'withoutTextStrings',
    'withoutAttributeValueStrings',
  ]);

  const full = report.rows.find(row => row.id === 'stringFull');
  const withoutText = report.rows.find(row => row.id === 'withoutTextStrings');
  const withoutAttributeValue = report.rows.find(row => row.id === 'withoutAttributeValueStrings');
  assert.equal(full.fullStringParity, true);
  assert.equal(full.checksum, -746772258);
  assert.equal(full.materializationCounters.textStrings > 0, true);
  assert.equal(withoutText.fullStringParity, false);
  assert.equal(withoutText.materializationCounters.textStrings, 0);
  assert.equal(withoutText.contractScope, 'full-materialization-minus-text-cdata');
  assert.equal(withoutAttributeValue.fullStringParity, false);
  assert.equal(withoutAttributeValue.materializationCounters.attributeValueStrings, 0);
  for (const row of report.rows) {
    assert.equal(row.sourceMode, 'file-backed-sync-iterable-byte-batches');
    assert.equal(row.boundedMemory, true);
    assert.equal(row.memory.maxRssBytes > 0, true);
  }

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# File-Backed Materialization Category Drop Sweep/);
  assert.match(markdown, /category-drop-headroom/);
  assert.match(markdown, /Near-full rows intentionally omit one string category/);
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
