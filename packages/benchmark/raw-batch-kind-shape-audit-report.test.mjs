import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'raw-batch-kind-shape-audit-report-test');
const jsonOut = join(tmpDir, 'raw-batch-kind-shape-audit.json');
const mdOut = join(tmpDir, 'raw-batch-kind-shape-audit.md');

test('raw batch kind shape audit distinguishes declared types from runtime kinds', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'raw-batch-kind-shape-audit.mjs'),
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
  assert.equal(report.objective, 'raw-batch-kind-shape-audit');
  assert.equal(report.contract, 'runtime-and-source-raw-batch-kind-shape');
  assert.deepEqual(report.declaredKinds, ['frame', 'soa-string-arena', 'word-table']);
  assert.deepEqual(report.observedKinds, ['frame']);
  assert.deepEqual(report.returnedKindLiterals, ['frame']);
  assert.deepEqual(report.summary.unavailableDeclaredKinds, ['soa-string-arena', 'word-table']);
  assert.equal(report.summary.wordTableAvailable, false);
  assert.equal(report.summary.soaStringArenaAvailable, false);
  assert.ok(report.findings.some(finding =>
    finding.id === 'word-table-string-arena-unavailable'
    && finding.classification === 'NEGATIVE_RESULT'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Raw Batch Kind Shape Audit/);
  assert.match(markdown, /word-table available: no/);
  assert.match(markdown, /soa-string-arena available: no/);
  assert.match(markdown, /not evidence that those layouts would be slow/);
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
