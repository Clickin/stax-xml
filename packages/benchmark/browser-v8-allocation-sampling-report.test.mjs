import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'browser-v8-allocation-sampling-report-test.json');
const mdOut = join(tmpDir, 'browser-v8-allocation-sampling-report-test.md');

test('browser V8 allocation sampling records same-contract HeapProfiler evidence without claiming a ceiling', (t) => {
  const browserExecutable = findBrowserExecutable();
  if (!browserExecutable) {
    t.skip('Chrome or Edge executable was not found.');
    return;
  }

  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'browser-v8-allocation-sampling.mjs'),
    '--browser-executable',
    browserExecutable,
    '--size-mib',
    '0.001',
    '--fixture-shape',
    'diverse-cycle',
    '--diverse-cycle-size',
    '16',
    '--cases',
    'stringFull,eventObjectFull,rawFrameNameId',
    '--sampling-interval',
    '8192',
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
  assert.equal(report.objective, 'browser-v8-allocation-sampling');
  assert.equal(report.contract, 'browser-v8-heap-profiler-allocation-sampling');
  assert.equal(report.environment.runtimeName, 'browser');
  assert.equal(report.environment.javascriptEngine, 'V8');
  assert.match(report.environment.userAgent, /Chrome|Edg/);
  assert.match(report.environment.cdpVersion['V8-Version'], /\d/);
  assert.equal(report.fixture.generated, true);
  assert.equal(report.fixture.shape, 'diverse-cycle');
  assert.equal(report.fixture.rowCycleSize, 16);
  assert.ok(report.fixture.actualBytes > 0);
  assert.deepEqual(report.variants.map(entry => entry.id), [
    'stringFull',
    'eventObjectFull',
    'rawFrameNameId',
  ]);
  assert.equal(report.eventCountParity.status, 'ok');
  assert.equal(report.fullStringParity.status, 'ok');

  for (const entry of report.variants) {
    assert.equal(entry.profile.scope, 'browser-v8-heap-profiler');
    assert.equal(entry.eventCount, report.eventCountParity.eventCount);
    assert.equal(entry.checksum, report.fullStringParity.checksum);
    assert.ok(entry.profile.sampledBytes >= 0);
    assert.ok(entry.profile.sampleCount >= 0);
    assert.ok(Array.isArray(entry.profile.topFunctions));
    assert.equal(entry.memory.scope, 'browser-js-heap');
    assert.equal(entry.fullStringParity, true);
  }

  assert.ok(report.findings.some(entry => entry.id === 'browser-allocation-sampling-not-ceiling-proof'));
  assert.ok(report.findings.some(entry => entry.id === 'browser-memory-scope'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Browser V8 Allocation Sampling/);
  assert.match(markdown, /HeapProfiler/);
  assert.match(markdown, /browser JS heap/);
  assert.match(markdown, /not a proof/i);
});

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  return candidates.find(candidate => existsSync(candidate));
}
