import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'multi-chunk-batch-shape-audit-test.json');
const mdOut = join(tmpDir, 'multi-chunk-batch-shape-audit-test.md');

test('multi-chunk batch shape audit pins current concat and single-buffer assumptions', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'multi-chunk-batch-shape-audit.mjs'),
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
  assert.equal(report.objective, 'multi-chunk-batch-shape-audit');
  assert.equal(report.contract, 'sync-uint8array-byte-batch-buffer-shape');
  assert.equal(report.summary.status, 'source-shape-confirmed');
  assert.equal(report.summary.missingFactCount, 0);
  assert.equal(report.summary.sourceFileCount, 2);
  assert.ok(report.sourceFiles.some(file => file.path.endsWith('IterableReader.ts')));
  assert.ok(report.sourceFiles.some(file => file.path.endsWith('Uint8ArrayCurrentCursor.ts')));

  const single = report.findings.find(finding => finding.id === 'single-item-batch-direct-view');
  const multi = report.findings.find(finding => finding.id === 'multi-item-batch-concat');
  const model = report.findings.find(finding => finding.id === 'single-buffer-span-model');
  const scope = report.findings.find(finding => finding.id === 'no-concat-prototype-scope');
  assert.ok(single);
  assert.ok(multi);
  assert.ok(model);
  assert.ok(scope);
  assert.equal(scope.classification, 'SCOPE_GUARD');
  assert.deepEqual(single.missingPatterns, []);
  assert.deepEqual(multi.missingPatterns, []);
  assert.deepEqual(model.missingPatterns, []);
  assert.ok(single.evidence.some(item => /batch\.length === 1/.test(item)));
  assert.ok(multi.evidence.some(item => /concatUint8Arrays/.test(item)));
  assert.ok(model.evidence.some(item => /currentBuffer/.test(item)));
  assert.match(scope.summary, /segmented-buffer abstraction/);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /Multi-Chunk Batch Shape Audit/);
  assert.match(markdown, /Status: source-shape-confirmed/);
  assert.match(markdown, /single-item-batch-direct-view/);
  assert.match(markdown, /multi-item-batch-concat/);
  assert.match(markdown, /no-concat multi-chunk batch path/);
});
