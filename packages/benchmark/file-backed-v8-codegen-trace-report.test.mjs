import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'file-backed-v8-codegen-trace-report-test');
const outputDir = join(tmpDir, 'raw');
const jsonOut = join(tmpDir, 'file-backed-v8-codegen-trace.json');
const mdOut = join(tmpDir, 'file-backed-v8-codegen-trace.md');

test('file-backed V8 codegen trace records source-shape trace facts without raw log commits', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'file-backed-v8-codegen-trace.mjs'),
    '--file',
    join(__dirname, 'test-data', 'runtime-comparison-16mib.xml'),
    '--cases',
    'scan-all-no-decode,stream-full-string',
    '--warmups',
    '4',
    '--iterations',
    '1',
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
  assert.equal(report.objective, 'file-backed-v8-codegen-trace');
  assert.equal(report.contract, 'node-v8-trace-opt-deopt-file-backed-reader-shapes');
  assert.equal(report.rawArtifacts.committed, false);
  assert.equal(report.fixture.source, 'file-backed');
  assert.equal(report.summary.caseCount, 2);
  assert.equal(report.summary.sameEventCount, true);
  assert.deepEqual(report.cases.map(entry => entry.caseId), [
    'scan-all-no-decode',
    'stream-full-string',
  ]);
  for (const entry of report.cases) {
    assert.equal(entry.result.eventCount, 967967);
    assert.equal(typeof entry.result.checksum, 'number');
    assert.equal(typeof entry.status, 'string');
    assert.equal(typeof entry.postWarmupDeoptCount, 'number');
    assert.equal(entry.traceLogBytes > 0, true);
  }

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# File-Backed V8 Codegen Trace/);
  assert.match(markdown, /TRACE_FACT/);
  assert.match(markdown, /demand-driven file-backed Iterable<Uint8Array\[\]>/);
  assert.match(markdown, /Committed: no/);
  assert.match(markdown, /not a new throughput benchmark/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut, outputDir]) {
    if (existsSync(filePath)) {
      rmSync(filePath, { recursive: true, force: true });
    }
  }
}
