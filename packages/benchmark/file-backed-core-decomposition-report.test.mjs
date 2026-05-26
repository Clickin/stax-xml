import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'file-backed-core-decomposition-report-test');
const jsonOut = join(tmpDir, 'file-backed-core-decomposition.json');
const mdOut = join(tmpDir, 'file-backed-core-decomposition.md');

test('file-backed core decomposition separates partial and full-string rows', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'file-backed-core-decomposition.mjs'),
    '--file',
    join(__dirname, 'test-data', 'runtime-comparison-16mib.xml'),
    '--tools',
    'stax-scan-all-no-decode,stax-raw-frame-semantic-checksum,stax-stream,stax-raw-frame-name-id',
    '--chunk-kib',
    '64',
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
  assert.equal(report.objective, 'file-backed-core-decomposition');
  assert.equal(report.contract, 'file-backed-parser-core-materialization-decomposition');
  assert.equal(report.summary.rowCount, 4);
  assert.equal(report.summary.counterexamples200MiB, 0);
  assert.ok(['stax-stream', 'stax-raw-frame-name-id'].includes(report.summary.fastestFullString.id));

  const scan = report.rows.find(row => row.id === 'stax-scan-all-no-decode');
  const semantic = report.rows.find(row => row.id === 'stax-raw-frame-semantic-checksum');
  const full = report.rows.find(row => row.id === 'stax-stream');
  const rawNameId = report.rows.find(row => row.id === 'stax-raw-frame-name-id');
  assert.equal(scan.fullStringParity, false);
  assert.equal(scan.family, 'partial-scan');
  assert.equal(semantic.fullStringParity, false);
  assert.equal(semantic.checksum, full.checksum);
  assert.equal(full.fullStringParity, true);
  assert.equal(rawNameId.fullStringParity, true);
  assert.equal(rawNameId.checksum, full.checksum);
  assert.equal(rawNameId.batchSize, 4);
  assert.equal(full.eventCount, 967967);
  assert.equal(full.checksum, -746772258);
  assert.equal(full.boundedMemory, true);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# File-Backed Core Decomposition/);
  assert.match(markdown, /Partial rows expose parser\/frame headroom/);
  assert.match(markdown, /Fastest full-string row/);
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
