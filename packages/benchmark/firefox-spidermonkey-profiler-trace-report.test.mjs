import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'firefox-spidermonkey-profiler-trace-test');
const jsonOut = join(tmpDir, 'firefox-spidermonkey-profiler-trace.json');
const mdOut = join(tmpDir, 'firefox-spidermonkey-profiler-trace.md');
const outputDir = join(tmpDir, 'raw');

test('Firefox SpiderMonkey profiler trace records Gecko profile evidence', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-spidermonkey-profiler-trace.mjs'),
    '--size-gib',
    '0.0001',
    '--fixture-shape',
    'diverse-cycle',
    '--diverse-cycle-size',
    '16',
    '--cases',
    'rawFrameNameId',
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
  assert.equal(report.objective, 'firefox-spidermonkey-profiler-trace');
  assert.equal(report.contract, 'gecko-profiler-same-contract-browser-reader-shapes');
  assert.equal(report.environment.javascriptEngine, 'SpiderMonkey');
  assert.equal(report.variants.length, 1);
  assert.equal(report.variants[0].id, 'rawFrameNameId');
  assert.equal(report.variants[0].fullStringParity, true);
  assert.ok(report.profile.threadCount > 0);
  assert.ok(report.profile.totalSamples > 0);
  assert.ok(report.profile.totalFrames > 0);
  assert.ok(report.profile.features.includes('js'));
  assert.ok(report.profile.targetTermHits.some(row => row.term === 'consumeRawFrame'));
  assert.ok(report.findings.some(row => row.id === 'gecko-profiler-profile-captured'));
  assert.ok(report.findings.some(row => row.id === 'not-jit-ir-or-runtime-ceiling-proof'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /Firefox\/SpiderMonkey Profiler Trace/);
  assert.match(markdown, /Gecko Profiler startup\/shutdown profile/);
  assert.match(markdown, /not JIT IR/);
  assert.match(markdown, /Target Term Hits/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
}
