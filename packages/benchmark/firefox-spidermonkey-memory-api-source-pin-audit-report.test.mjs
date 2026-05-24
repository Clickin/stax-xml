import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'firefox-spidermonkey-memory-api-source-pin-audit-test');
const jsonOut = join(tmpDir, 'firefox-spidermonkey-memory-api-source-pin-audit.json');
const mdOut = join(tmpDir, 'firefox-spidermonkey-memory-api-source-pin-audit.md');

test('Firefox memory API audit records page heap API absence without claiming allocation proof', (t) => {
  if (!hasFirefox()) {
    t.skip('Firefox executable was not found.');
    return;
  }

  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-spidermonkey-memory-api-source-pin-audit.mjs'),
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
  assert.equal(report.objective, 'firefox-spidermonkey-memory-api-source-pin-audit');
  assert.equal(report.contract, 'firefox-bidi-page-memory-api-boundary');
  assert.equal(report.runtime.runtimeName, 'browser');
  assert.equal(report.runtime.javascriptEngine, 'SpiderMonkey');
  assert.match(report.runtime.userAgent, /Firefox/);
  assert.equal(report.probes.page.pageApis.performanceMemory, 'undefined');
  assert.equal(report.probes.page.pageApis.measureUserAgentSpecificMemory, 'undefined');
  assert.equal(report.probes.page.components.classesType, 'undefined');
  assert.ok(report.findings.some(finding => finding.id === 'host-counter-boundary'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Firefox\/SpiderMonkey Memory API Source Pin Audit/);
  assert.match(markdown, /performance\.memory: undefined/);
  assert.match(markdown, /not an allocation profile/);
  assert.match(markdown, /host process-tree evidence/);
});

function hasFirefox() {
  return existsSync('C:\\Program Files\\Mozilla Firefox\\firefox.exe')
    || existsSync('C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe');
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
