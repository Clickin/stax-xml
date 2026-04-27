import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createReleaseRunId,
  createReleaseSnapshotPlan,
  renderReleaseHistoryMarkdown,
} from '../update-release-benchmarks.mjs';
import { buildNodeStringReturnGate } from '../node-string-return.mjs';

test('release run id is safe for filesystem history paths', () => {
  const runId = createReleaseRunId(new Date('2026-04-27T09:08:07.006Z'));

  assert.equal(runId, '2026-04-27T09-08-07-006Z');
  assert.doesNotMatch(runId, /[:.]/);
});

test('release snapshot plan captures public benchmark markdown and json outputs', () => {
  const plan = createReleaseSnapshotPlan('2026-04-27T09-08-07-006Z');

  assert.deepEqual(
    plan.artifacts.map((artifact) => artifact.id),
    [
      'benchmark-markdown',
      'latest-summary-json',
      'runtime-matrix-json',
      'runtime-matrix-markdown',
      'cross-runtime-json',
      'cross-runtime-markdown',
      'simdxml-upstream-json',
      'simdxml-upstream-markdown',
      'writer-1gb-raw-json',
    ],
  );
  assert.ok(plan.runDir.endsWith('packages\\benchmark\\results\\release\\history\\2026-04-27T09-08-07-006Z')
    || plan.runDir.endsWith('packages/benchmark/results/release/history/2026-04-27T09-08-07-006Z'));
  for (const artifact of plan.artifacts) {
    assert.equal(artifact.target.startsWith(plan.runDir), true, artifact.target);
    assert.doesNotMatch(artifact.target, /raw[\\/](parser|writer-small|writer-big|writer-async|converter-parity)/);
  }
});

test('release history markdown renders newest benchmark runs first', () => {
  const markdown = renderReleaseHistoryMarkdown([
    {
      runId: '2026-04-27T09-08-07-006Z',
      generatedAt: '2026-04-27T09:08:07.006Z',
      environment: { runtime: 'node', version: 'v24.15.0', arch: 'x64-win32' },
    },
    {
      runId: '2026-04-26T13-51-29-069Z',
      generatedAt: '2026-04-26T13:51:29.069Z',
      environment: { runtime: 'node', version: 'v24.15.0', arch: 'x64-win32' },
    },
  ]);

  assert.match(markdown, /^# Release Benchmark History\n/);
  assert.ok(
    markdown.indexOf('2026-04-27T09-08-07-006Z') < markdown.indexOf('2026-04-26T13-51-29-069Z'),
    markdown,
  );
  assert.match(markdown, /\[BENCHMARK\.md\]\(\.\/2026-04-27T09-08-07-006Z\/BENCHMARK\.md\)/);
  assert.match(markdown, /\[summary JSON\]\(\.\/2026-04-27T09-08-07-006Z\/latest-summary\.json\)/);
});

test('node string-return gate fails only correctness mismatches', () => {
  const report = {
    tiers: [
      {
        id: 'count-only',
        scenarios: [
          scenario('neutral', 'count-only', 100, 100, 1),
          scenario('node', 'count-only', 120, 100, 1),
        ],
      },
      {
        id: 'full-string',
        scenarios: [
          scenario('neutral', 'full-string', 100, 200, 2),
          scenario('node', 'full-string', 120, 200, 2),
        ],
      },
    ],
  };

  const gate = buildNodeStringReturnGate(report);

  assert.equal(gate.status, 'pass');
  assert.equal(gate.performanceStatus, 'warn');
  assert.deepEqual(gate.failures, []);
  assert.match(gate.performanceFailures.join('\n'), /count-only regression/);
  assert.match(gate.performanceFailures.join('\n'), /full-string improvement/);
});

test('node string-return gate still fails checksum mismatches', () => {
  const report = {
    tiers: [
      {
        id: 'count-only',
        scenarios: [
          scenario('neutral', 'count-only', 100, 100, 1),
          scenario('node', 'count-only', 99, 101, 1),
        ],
      },
      {
        id: 'full-string',
        scenarios: [
          scenario('neutral', 'full-string', 100, 200, 2),
          scenario('node', 'full-string', 99, 200, 3),
        ],
      },
    ],
  };

  const gate = buildNodeStringReturnGate(report);

  assert.equal(gate.status, 'fail');
  assert.match(gate.failures.join('\n'), /mismatch/);
});

function scenario(id, tier, avgMs, eventCount, checksum) {
  return {
    id,
    status: 'ok',
    tier,
    avgMs,
    mibPerSec: 16 / (avgMs / 1000),
    eventCount,
    checksum,
  };
}
