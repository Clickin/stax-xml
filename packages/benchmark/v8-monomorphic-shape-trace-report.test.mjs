import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const outputDir = join(tmpDir, 'v8-monomorphic-shape-trace-report-test');
const jsonOut = join(tmpDir, 'v8-monomorphic-shape-trace-report-test.json');
const mdOut = join(tmpDir, 'v8-monomorphic-shape-trace-report-test.md');

test('V8 monomorphic shape trace report records trace facts without raw log commits', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut, outputDir]) {
    if (existsSync(filePath)) {
      rmSync(filePath, { recursive: true, force: true });
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'v8-monomorphic-shape-trace.mjs'),
    '--quick',
    '--skip-opt-code',
    '--cases',
    'all',
    '--output-dir',
    outputDir,
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
  assert.equal(report.objective, 'v8-monomorphic-shape-trace');
  assert.equal(report.contract, 'trace-fact-only');
  assert.equal(report.rawArtifacts.committed, false);
  assert.deepEqual(report.cases.map(entry => entry.caseId), [
    'public-accessor',
    'raw-frame-direct-decode',
    'raw-frame-name-id-cache',
  ]);
  const first = report.cases[0].result;
  assert.ok(first.eventCount > 0);
  for (const entry of report.cases) {
    assert.equal(entry.result.eventCount, first.eventCount);
    assert.equal(entry.result.checksum, first.checksum);
    assert.equal(typeof entry.status, 'string');
    assert.equal(typeof entry.postWarmupDeoptCount, 'number');
    assert.equal(typeof entry.patternCounts.TextDecoderDecode, 'number');
  }

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# V8 Monomorphic Shape Trace/);
  assert.match(markdown, /TRACE_FACT/);
  assert.match(markdown, /## Trace Gate/);
  assert.match(markdown, /raw-frame-name-id-cache/);
  assert.match(markdown, /Committed: no/);
});
