import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'bun-jsc-heap-allocation-profile-report-test');
const jsonOut = join(tmpDir, 'bun-jsc-heap-allocation-profile.json');
const mdOut = join(tmpDir, 'bun-jsc-heap-allocation-profile.md');
const rawOut = join(tmpDir, 'raw');

test('Bun/JSC heap allocation profile records retained heap evidence without claiming a census', (t) => {
  if (!hasBun()) {
    t.skip('bun executable was not found.');
    return;
  }

  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'bun-jsc-heap-allocation-profile.mjs'),
    '--size-gib=0.001',
    '--fixture-shape=diverse-cycle',
    '--diverse-cycle-size=64',
    '--cases=stringFull,rawFrameNameId',
    `--output-dir=${rawOut}`,
    `--json-out=${jsonOut}`,
    `--md-out=${mdOut}`,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
  assert.equal(report.objective, 'bun-jsc-heap-allocation-profile');
  assert.equal(report.contract, 'bun-jsc-heap-profile-retained-snapshot');
  assert.equal(report.runtime.runtimeName, 'bun');
  assert.equal(report.runtime.javascriptEngine, 'JavaScriptCore');
  assert.equal(report.fullStringParity.status, 'ok');
  assert.deepEqual(report.cases.map(entry => entry.caseId), ['stringFull', 'rawFrameNameId']);
  assert.ok(report.cases.every(entry => entry.heapProfile.totalHeapBytes > 0));
  assert.ok(report.cases.every(entry => entry.heapProfile.totalObjects > 0));
  assert.ok(report.cases.every(entry => entry.heapProfile.topTypesByRetainedSize.length > 0));
  assert.ok(report.findings.some(finding => finding.classification === 'ALLOCATION_FACT'));
  assert.ok(report.findings.some(finding => finding.id === 'heap-profile-not-allocation-census'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Bun\/JSC Heap Allocation Profile/);
  assert.match(markdown, /bun --heap-prof-md/);
  assert.match(markdown, /not a JavaScriptCore allocation census/);
  assert.match(markdown, /Full String Parity/);
});

function hasBun() {
  const result = spawnSync('bun', ['--revision'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.status === 0;
}

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }
}
