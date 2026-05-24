import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'firefox-spidermonkey-allocation-profile-report-test.json');
const mdOut = join(tmpDir, 'firefox-spidermonkey-allocation-profile-report-test.md');

test('Firefox/SpiderMonkey allocation profile records host process-tree evidence without claiming JS heap proof', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath, { recursive: true, force: true });
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-spidermonkey-allocation-profile.mjs'),
    '--json-out',
    jsonOut,
    '--md-out',
    mdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
  assert.equal(report.objective, 'firefox-spidermonkey-allocation-profile');
  assert.equal(report.contract, 'non-v8-browser-host-process-memory-allocation-evidence');
  assert.equal(report.environment.runtimeName, 'browser');
  assert.equal(report.environment.javascriptEngine, 'SpiderMonkey');
  assert.equal(report.environment.browserName, 'Firefox');
  assert.ok(report.summary.scannedFirefoxArtifacts >= 3);
  assert.ok(report.summary.variantHostMemoryRowCount >= 3);
  assert.ok(report.summary.aggregateHostMemoryRowCount >= 3);
  assert.ok(report.summary.fullStringProbeRowCount >= 3);
  assert.ok(report.summary.maxWorkingSetBytes > 0);
  assert.ok(report.summary.maxPrivateBytes > 0);
  assert.ok(report.sourceArtifacts.some(entry => entry.sourceArtifact === 'firefox-bidi-candidate-headroom.json'));
  assert.ok(report.variantHostMemoryRows.some(row => row.caseId === 'rawFrameNameId' && row.fullStringParity === true));
  assert.equal(report.findings.find(finding => finding.id === 'firefox-host-process-memory-evidence-present').classification, 'ALLOCATION_FACT_LIMIT');
  assert.equal(report.findings.find(finding => finding.id === 'not-js-heap-or-portable-rss').classification, 'SCOPE_GUARD');

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Firefox\/SpiderMonkey Allocation Profile/);
  assert.match(markdown, /ALLOCATION_FACT_LIMIT/);
  assert.match(markdown, /host process-tree memory evidence/);
  assert.match(markdown, /not row-level JS heap proof/);
  assert.match(markdown, /not portable browser RSS/);
  assert.match(markdown, /does not cover Safari\/WebKit browser rows/);
});
