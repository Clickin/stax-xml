import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'object-shape-parity-report-test.json');
const mdOut = join(tmpDir, 'object-shape-parity-report-test.md');

test('object shape parity report preserves full materialization across shapes', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'object-shape-parity.mjs'),
    '--self-test',
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
  assert.equal(report.contract, 'full-string-materialization');
  assert.equal(report.objective, 'object-shape-parity');
  assert.equal(report.parity.status, 'ok');
  assert.deepEqual(report.variants.map(entry => entry.id), [
    'stream-batch-index',
    'stream-event-view',
    'cursor-adapter',
    'event-reader-object',
    'raw-frame-name-id',
  ]);
  assert.ok(report.variants.every(entry => entry.eventCount === report.parity.eventCount));
  assert.ok(report.variants.every(entry => entry.checksum === report.parity.checksum));
  assert.ok(report.variants.every(entry => entry.materialization === 'full-string'));
  assert.ok(report.variants.every(entry => typeof entry.objectShape === 'string'));
  assert.ok(report.variants.some(entry => entry.perEventObject === true));
  assert.ok(report.variants.some(entry => entry.perEventObject === false));
  for (const entry of report.variants) {
    assert.equal(typeof entry.memory?.avgHeapUsedDeltaBytes, 'number');
    assert.equal(typeof entry.memory?.avgRssDeltaBytes, 'number');
    assert.equal(typeof entry.memory?.maxRssBytes, 'number');
  }

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Object Shape Parity/);
  assert.match(markdown, /stream-batch-index/);
  assert.match(markdown, /event-reader-object/);
  assert.match(markdown, /raw-frame-name-id/);
  assert.match(markdown, /Per-event object/);
  assert.match(markdown, /## Memory/);
});
