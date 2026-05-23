import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const outputDir = join(tmpDir, 'bun-jsc-cpu-profile-report-test');
const jsonOut = join(tmpDir, 'bun-jsc-cpu-profile-report-test.json');
const mdOut = join(tmpDir, 'bun-jsc-cpu-profile-report-test.md');

function readBunVersion() {
  const result = spawnSync('bun', ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

test('Bun/JSC CPU profile report records profiler trace facts without claiming codegen proof', { skip: !readBunVersion() }, () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut, outputDir]) {
    if (existsSync(filePath)) {
      rmSync(filePath, { recursive: true, force: true });
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'bun-jsc-cpu-profile.mjs'),
    '--size-gib',
    '0.001',
    '--fixture-shape',
    'diverse-cycle',
    '--diverse-cycle-size',
    '64',
    '--cases',
    'scanAllNoDecode,rawFrameNameId,eventObjectFull',
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
    timeout: 120_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
  assert.equal(report.objective, 'bun-jsc-cpu-profile');
  assert.equal(report.contract, 'profiler-trace-fact-only');
  assert.equal(report.runtime.runtimeName, 'bun');
  assert.equal(report.runtime.javascriptEngine, 'JavaScriptCore');
  assert.equal(report.rawArtifacts.committed, false);
  assert.deepEqual(report.cases.map((entry) => entry.caseId), [
    'scanAllNoDecode',
    'rawFrameNameId',
    'eventObjectFull',
  ]);
  assert.ok(report.profileTotals.sampleCount > 0);
  assert.ok(report.profileTotals.profiledDurationMs > 0);
  assert.equal(report.fullStringParity.status, 'ok');
  assert.equal(report.findings.find((finding) => finding.id === 'bun-cpu-profiler-trace-visible').classification, 'TRACE_FACT');
  assert.equal(report.findings.find((finding) => finding.id === 'not-codegen-or-ceiling-proof').classification, 'SCOPE_GUARD');

  const fullRows = report.cases.filter((entry) => entry.result.fullStringParity);
  assert.equal(fullRows.length, 2);
  assert.equal(fullRows[0].result.checksum, fullRows[1].result.checksum);
  for (const entry of report.cases) {
    assert.ok(entry.profile.sampleCount > 0);
    assert.ok(entry.profile.topSelfFunctions.length > 0);
    assert.equal(typeof entry.profile.staxXmlSelfPercent, 'number');
    assert.equal(typeof entry.profile.benchmarkSelfPercent, 'number');
    assert.equal(typeof entry.profile.nativeSelfPercent, 'number');
  }

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Bun\/JSC CPU Profile/);
  assert.match(markdown, /TRACE_FACT/);
  assert.match(markdown, /scanAllNoDecode/);
  assert.match(markdown, /rawFrameNameId/);
  assert.match(markdown, /eventObjectFull/);
  assert.match(markdown, /Committed: no/);
  assert.match(markdown, /not a codegen trace/);
  assert.match(markdown, /not a 200 MiB\/s ceiling proof/);
});
