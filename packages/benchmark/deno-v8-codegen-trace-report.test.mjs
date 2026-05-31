import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'deno-v8-codegen-trace');
const jsonOut = join(tmpDir, 'deno-v8-codegen-trace.json');
const mdOut = join(tmpDir, 'deno-v8-codegen-trace.md');

test('Deno V8 codegen trace report records optimization and scope guards', { skip: !hasDeno() }, () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'deno-v8-codegen-trace.mjs'),
    '--quick',
    '--cases',
    'raw-frame-name-id-cache',
    '--fixture-file',
    join(__dirname, 'assets', 'books.xml'),
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
  assert.equal(report.objective, 'deno-v8-codegen-trace');
  assert.equal(report.contract, 'trace-fact-only');
  assert.match(report.environment.denoVersion, /^2\./);
  assert.match(report.environment.v8Version, /^\d+\./);
  assert.deepEqual(report.options.cases, ['raw-frame-name-id-cache']);
  assert.equal(report.options.fixtureFile, join(__dirname, 'assets', 'books.xml'));
  assert.equal(report.fixture.source, 'corpus-file');
  assert.equal(report.fixture.file, join(__dirname, 'assets', 'books.xml'));
  assert.equal(report.fixture.byteLength, 4551);
  assert.equal(report.cases.length, 1);

  const [row] = report.cases;
  assert.equal(row.caseId, 'raw-frame-name-id-cache');
  assert.equal(row.result.fixtureFile, join(__dirname, 'assets', 'books.xml'));
  assert.equal(row.result.fixtureBytes, 4551);
  assert.ok(row.result.eventCount > 0);
  assert.ok(row.targetOptimizedFunctions.length > 0);
  assert.ok(row.compilationTargets.length > 0);
  assert.ok(Number.isInteger(row.postWarmupDeoptCount));
  assert.ok(row.postWarmupDeoptCount >= 0);
  assert.ok(report.findings.some(finding => finding.id === 'deno-v8-optimization-seen'));
  assert.ok(report.findings.some(finding => finding.id === 'scope-guard'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /Deno V8 Codegen Trace/);
  assert.match(markdown, /TRACE_FACT/);
  assert.match(markdown, /not a throughput benchmark/);
  assert.match(markdown, /corpus-file/);
  assert.match(markdown, /books\.xml/);
  assert.match(markdown, /raw-frame-name-id-cache/);
});

function hasDeno() {
  const result = spawnSync('deno', ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return result.status === 0;
}
