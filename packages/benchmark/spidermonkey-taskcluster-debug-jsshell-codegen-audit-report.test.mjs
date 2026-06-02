import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'spidermonkey-taskcluster-debug-jsshell-codegen-audit-test');
const jsonOut = join(tmpDir, 'spidermonkey-taskcluster-debug-jsshell-codegen-audit.json');
const mdOut = join(tmpDir, 'spidermonkey-taskcluster-debug-jsshell-codegen-audit.md');

test('Taskcluster SpiderMonkey debug js-shell codegen audit stays scoped away from same-contract StAX closure', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'spidermonkey-taskcluster-debug-jsshell-codegen-audit.mjs'),
    '--self-test',
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
  assert.equal(report.objective, 'spidermonkey-taskcluster-debug-jsshell-codegen-audit');
  assert.equal(report.contract, 'current-taskcluster-debug-spidermonkey-codegen-surface-not-same-contract-stax');
  assert.equal(report.outcome.hasCodegenDumpOutput, true);
  assert.equal(report.outcome.hasIrDumpSurface, true);
  assert.equal(report.outcome.hasNativeDisassemblySurface, true);
  assert.equal(report.outcome.nativeDumpComplete, true);
  assert.equal(report.outcome.scopeComparableToCurrentFirefox, true);
  assert.equal(report.outcome.sameContractStaxRow, false);
  assert.equal(report.outcome.canRunCurrentStaxFullStringBenchmark, false);
  assert.equal(report.outcome.closesDiagnosticSurfaceObligation, true);
  assert.equal(report.outcome.closesEmittedIrObligation, false);
  assert.equal(report.shell.version.value, 'JavaScript-C153.0a1');
  assert.equal(report.shell.provenance.taskId, 'bzK0wWZvQoOguMjTIbRJ_g');
  assert.equal(report.shell.provenance.route, 'gecko.v2.mozilla-central.latest.firefox.win64-debug');
  assert.equal(report.shell.provenance.artifactBytes, 24836220);
  assert.equal(report.shell.provenance.targetTxt.buildId, '20260531212007');
  assert.equal(report.shell.provenance.targetTxt.sourceRevision, '71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7');
  assert.equal(report.shell.provenance.mozinfo.debug, true);
  assert.equal(report.shell.provenance.mozinfo.official, true);
  assert.equal(report.shell.provenance.mozinfo.opt, false);
  assert.equal(report.shell.codegenProbe.status, 'codegen-output-emitted');
  assert.equal(report.shell.codegenProbe.checksum, 5050);
  assert.ok(report.shell.codegenProbe.codegenMarkerCount > 0);
  assert.ok(report.shell.codegenProbe.ionScriptMarkerCount > 0);
  assert.ok(report.shell.codegenProbe.assemblyMnemonicCount > 0);
  assert.deepEqual(report.shell.apiProbe.missingGlobals, ['TextDecoder', 'TextEncoder', 'ReadableStream', 'fetch']);
  assert.ok(report.findings.some(finding =>
    finding.id === 'taskcluster-debug-jsshell-stax-api-gap'
    && finding.classification === 'NEGATIVE_RESULT'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'taskcluster-debug-jsshell-scope-guard'
    && finding.classification === 'SCOPE_GUARD'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /SpiderMonkey Taskcluster Debug JS Shell Codegen Audit/);
  assert.match(markdown, /Version: JavaScript-C153\.0a1/);
  assert.match(markdown, /Task ID: bzK0wWZvQoOguMjTIbRJ_g/);
  assert.match(markdown, /Route: gecko\.v2\.mozilla-central\.latest\.firefox\.win64-debug/);
  assert.match(markdown, /Build ID: 20260531212007/);
  assert.match(markdown, /Source revision: 71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7/);
  assert.match(markdown, /Debug build: true/);
  assert.match(markdown, /Official build: true/);
  assert.match(markdown, /Codegen dump output emitted: true/);
  assert.match(markdown, /Scope comparable to current Firefox: true/);
  assert.match(markdown, /Same-contract StAX row: false/);
  assert.match(markdown, /Can run current StAX full-string benchmark: false/);
  assert.match(markdown, /Closes diagnostic surface obligation: true/);
  assert.match(markdown, /Closes emitted IR obligation: false/);
  assert.match(markdown, /Missing globals: TextDecoder, TextEncoder, ReadableStream, fetch/);
});

test('Taskcluster SpiderMonkey debug js-shell codegen audit derives artifact URL from task and artifact name', () => {
  resetTmp();
  const taskId = 'task-for-custom-codegen-artifact';
  const artifactName = 'public/build/custom.jsshell.zip';
  const result = spawnSync(process.execPath, [
    join(__dirname, 'spidermonkey-taskcluster-debug-jsshell-codegen-audit.mjs'),
    '--self-test',
    '--task-id',
    taskId,
    '--artifact-name',
    artifactName,
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
  assert.equal(report.parameters.taskId, taskId);
  assert.equal(report.parameters.artifactName, artifactName);
  assert.equal(report.parameters.artifactUrl, `https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/${taskId}/artifacts/${artifactName}`);
  assert.equal(report.shell.provenance.artifactUrl, report.parameters.artifactUrl);
});

test('Taskcluster SpiderMonkey debug js-shell codegen audit preserves explicit artifact URL', () => {
  resetTmp();
  const explicitArtifactUrl = 'https://example.invalid/custom-js-shell.zip';
  const result = spawnSync(process.execPath, [
    join(__dirname, 'spidermonkey-taskcluster-debug-jsshell-codegen-audit.mjs'),
    '--self-test',
    '--artifact-url',
    explicitArtifactUrl,
    '--task-id',
    'task-that-must-not-rewrite-url',
    '--artifact-name',
    'public/build/ignored.jsshell.zip',
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
  assert.equal(report.parameters.artifactUrl, explicitArtifactUrl);
  assert.equal(report.shell.provenance.artifactUrl, explicitArtifactUrl);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
}
