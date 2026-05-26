import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'safari-webkit-availability-audit-test.json');
const mdOut = join(tmpDir, 'safari-webkit-availability-audit-test.md');

test('Safari/WebKit availability audit records local execution gap without claiming a runtime ceiling', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath, { recursive: true, force: true });
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'safari-webkit-availability-audit.mjs'),
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
  assert.equal(report.objective, 'safari-webkit-availability-audit');
  assert.equal(report.contract, 'local-safari-webkit-browser-row-availability');
  assert.equal(report.environment.runtimeName, 'browser');
  assert.equal(report.environment.browserName, 'Safari/WebKit');
  assert.equal(report.environment.javascriptEngine, 'JavaScriptCore');
  assert.equal(report.summary.currentHarnessSupportsSafari, true);
  assert.equal(report.summary.canRunSafariBrowserRows, false);
  assert.equal(report.summary.safariBenchmarkRowsRecorded, false);
  assert.equal(report.summary.exactSafariBuildIdentityRecorded, false);
  assert.equal(report.summary.safariSourceBoundaryPinned, false);
  assert.equal(report.summary.openObligationRemains, true);
  assert.ok(report.probes.commands.some(probe => probe.name === 'safaridriver'));
  assert.ok(report.probes.paths.some(probe => probe.label === 'macOS Safari app'));
  assert.ok(report.probes.environmentVariables.some(probe => probe.name === 'SAFARI_PATH'));
  assert.ok(report.probes.harnessSupport.entryPoints.some(entry =>
    entry.label === 'safari smoke harness'
    && entry.exists === true
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'safari-row-obligation-remains'
    && finding.classification === 'OPEN'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Safari\/WebKit Availability Audit/);
  assert.match(markdown, /ENVIRONMENT_FACT_LIMIT/);
  assert.match(markdown, /not a benchmark row/);
  assert.match(markdown, /does not prove Safari\/WebKit cannot exceed/);
  assert.match(markdown, /Current harness supports Safari\/WebKit: yes/);
  assert.match(markdown, /Safari benchmark rows recorded: no/);
  assert.match(markdown, /Exact Safari build identity recorded: no/);
  assert.match(markdown, /Safari source boundary pinned: no/);
  assert.match(markdown, /## Environment Probes/);
  assert.match(markdown, /SAFARI_PATH/);
  assert.match(markdown, /safari smoke harness/);
  assert.match(markdown, /Open obligation remains: yes/);
});
