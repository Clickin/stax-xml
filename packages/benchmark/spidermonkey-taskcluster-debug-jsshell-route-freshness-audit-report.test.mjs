import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'spidermonkey-taskcluster-debug-jsshell-route-freshness-audit-test');
const jsonOut = join(tmpDir, 'spidermonkey-taskcluster-debug-jsshell-route-freshness-audit.json');
const mdOut = join(tmpDir, 'spidermonkey-taskcluster-debug-jsshell-route-freshness-audit.md');
const releaseDir = join(tmpDir, 'release');

test('Taskcluster route freshness audit ties current route to expected debug shell identity', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'spidermonkey-taskcluster-debug-jsshell-route-freshness-audit.mjs'),
    '--self-test',
    '--expected-task-id',
    'aJLr1DFjQ7urQTpRiIsfRQ',
    '--expected-build-id',
    '20260602093330',
    '--expected-source-revision',
    '253b8523586577438a3ddf86d67436719feaf6d8',
    '--release-dir',
    releaseDir,
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
  assert.equal(report.objective, 'spidermonkey-taskcluster-debug-jsshell-route-freshness-audit');
  assert.equal(report.contract, 'taskcluster-latest-route-current-debug-jsshell-identity-freshness');
  assert.equal(report.summary.status, 'fresh');
  assert.equal(report.summary.routeFresh, true);
  assert.equal(report.summary.expectedIdentityMatchesRoute, true);
  assert.equal(report.summary.artifactIdentityMatchesRoute, true);
  assert.equal(report.summary.checkedArtifactCount, 5);
  assert.deepEqual(report.summary.mismatchedArtifacts, []);
  assert.equal(report.route.route, 'gecko.v2.mozilla-central.latest.firefox.win64-debug');
  assert.equal(report.route.taskId, 'aJLr1DFjQ7urQTpRiIsfRQ');
  assert.equal(report.expected.taskId, 'aJLr1DFjQ7urQTpRiIsfRQ');
  assert.equal(report.expected.buildId, '20260602093330');
  assert.equal(report.expected.sourceRevision, '253b8523586577438a3ddf86d67436719feaf6d8');
  assert.equal(report.findings[0].classification, 'ENVIRONMENT_FACT');
  assert.equal(report.findings[1].classification, 'SCOPE_GUARD');
  assert.equal(report.artifacts.length, 5);
  assert.ok(report.artifacts.every(artifact => artifact.matchesRoute === true));
  assert.ok(report.artifacts.every(artifact => artifact.matchesExpectedBuildIdentity === true));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /SpiderMonkey Taskcluster Debug JS Shell Route Freshness Audit/);
  assert.match(markdown, /Route fresh: true/);
  assert.match(markdown, /Expected identity matches route: true/);
  assert.match(markdown, /Artifact identity matches route: true/);
  assert.match(markdown, /Checked artifacts: 5/);
  assert.match(markdown, /Mismatched artifacts: none/);
  assert.match(markdown, /Task ID: aJLr1DFjQ7urQTpRiIsfRQ/);
  assert.match(markdown, /Build ID: 20260602093330/);
  assert.match(markdown, /Source revision: 253b8523586577438a3ddf86d67436719feaf6d8/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(releaseDir, { recursive: true });
  for (const fileName of [
    'spidermonkey-taskcluster-debug-jsshell-codegen-audit.json',
    'spidermonkey-taskcluster-debug-jsshell-codegen-rerun.json',
    'spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit.json',
    'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json',
    'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun.json',
  ]) {
    writeFileSync(join(releaseDir, fileName), JSON.stringify({
      objective: 'test-taskcluster-artifact',
      shell: {
        provenance: {
          taskId: 'aJLr1DFjQ7urQTpRiIsfRQ',
          targetTxt: {
            buildId: '20260602093330',
            sourceRevision: '253b8523586577438a3ddf86d67436719feaf6d8',
          },
        },
      },
    }, null, 2));
  }
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
}
