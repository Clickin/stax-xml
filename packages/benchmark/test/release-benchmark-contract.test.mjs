import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  createReleaseRunId,
  createReleaseSnapshotPlan,
  releaseManifestForOptions,
  renderReleaseHistoryMarkdown,
} from '../update-release-benchmarks.mjs';
import { buildNodeStringReturnGate } from '../node-string-return.mjs';
import { STAX_PARSER_SURFACE_SCENARIOS } from '../common/parser-scenarios.mjs';

const repoRoot = join(import.meta.dirname, '..', '..', '..');

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

test('release manifest keeps 4GiB traversal as opt-in stress coverage', () => {
  const defaultIds = releaseManifestForOptions().map((entry) => entry.id);
  const stressIds = releaseManifestForOptions({ includeStress: true }).map((entry) => entry.id);
  const onlyStressIds = releaseManifestForOptions({ only: new Set(['async-file-4gb']) }).map((entry) => entry.id);

  assert.equal(defaultIds.includes('async-file-4gb'), false);
  assert.equal(stressIds.includes('async-file-4gb'), true);
  assert.deepEqual(onlyStressIds, ['async-file-4gb']);
});

test('98MB parser release suite uses bounded mitata samples', () => {
  const source = readFileSync(join(repoRoot, 'packages', 'benchmark', 'update-release-benchmarks.mjs'), 'utf8');

  assert.match(source, /parser98MbMitataOptions/);
  assert.match(source, /min_samples:\s*3/);
});

test('node string-return gate keeps performance warnings separate when full-spec floor passes', () => {
  const report = {
    tiers: [
      {
        id: 'count-only',
        scenarios: [
          scenario('neutral', 'count-only', 100, 100, 1),
          scenario('stream-reader-native', 'count-only', 120, 100, 1),
          scenario('native-addon-full-spec', 'count-only', 130, 100, 11),
        ],
      },
      {
        id: 'full-string',
        scenarios: [
          scenario('neutral', 'full-string', 100, 200, 2),
          scenario('stream-reader-native', 'full-string', 120, 200, 2),
          scenario('native-addon-full-spec', 'full-string', 135, 200, 22),
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

test('node string-return gate fails below 0.90x native addon full spec', () => {
  const report = {
    tiers: [
      {
        id: 'full-string',
        scenarios: [
          scenario('neutral', 'full-string', 130, 200, 2),
          scenario('stream-reader-native', 'full-string', 112, 200, 2),
          scenario('native-addon-full-spec', 'full-string', 100, 200, 22),
        ],
      },
    ],
  };

  const gate = buildNodeStringReturnGate(report);

  assert.equal(gate.status, 'fail');
  assert.match(gate.failures.join('\n'), /0\.89x/);
  assert.match(gate.failures.join('\n'), /0\.90x native addon full spec/);
});

test('node string-return gate still fails checksum mismatches', () => {
  const report = {
    tiers: [
      {
        id: 'count-only',
        scenarios: [
          scenario('neutral', 'count-only', 100, 100, 1),
          scenario('stream-reader-native', 'count-only', 99, 101, 1),
          scenario('native-addon-full-spec', 'count-only', 100, 101, 11),
        ],
      },
      {
        id: 'full-string',
        scenarios: [
          scenario('neutral', 'full-string', 100, 200, 2),
          scenario('stream-reader-native', 'full-string', 99, 200, 3),
          scenario('native-addon-full-spec', 'full-string', 100, 200, 22),
        ],
      },
    ],
  };

  const gate = buildNodeStringReturnGate(report);

  assert.equal(gate.status, 'fail');
  assert.match(gate.failures.join('\n'), /mismatch/);
});

test('node string-return benchmark carries the native addon full-spec control row', () => {
  const source = readFileSync(join(repoRoot, 'packages', 'benchmark', 'node-string-return.mjs'), 'utf8');
  const crossRuntimeSource = readFileSync(join(repoRoot, 'packages', 'benchmark', 'cross-runtime-comparison.mjs'), 'utf8');

  assert.match(source, /NATIVE_ADDON_FULL_SPEC_MIN_RATIO\s*=\s*0\.9/);
  assert.match(source, /@stax-xml\/native-aggregate-probe/);
  assert.match(source, /native-addon-full-spec/);
  assert.match(source, /parseAggregateFile/);
  assert.match(crossRuntimeSource, /native addon full spec control/);
  assert.match(crossRuntimeSource, /Relative to native full spec/);
});

test('node string-return benchmark gates StreamReaderSync and keeps EventReaderSync as reference', () => {
  const source = readFileSync(join(repoRoot, 'packages', 'benchmark', 'node-string-return.mjs'), 'utf8');

  assert.match(source, /StreamReaderSync/);
  assert.match(source, /StreamEventType/);
  assert.match(source, /nodeFileByteBatchesSync/);
  assert.match(source, /stream-reader-native/);
  assert.match(source, /event-reader-native/);
  assert.match(source, /PUBLIC_NATIVE_WRAPPER_ID\s*=\s*'stream-reader-native'/);
});

test('published parser surface scenarios use public stream reader for native rows', () => {
  const labels = STAX_PARSER_SURFACE_SCENARIOS.map((scenario) => scenario.label);
  assert.ok(labels.includes('stax-xml StreamReaderSync (native)'), labels.join('\n'));
  assert.ok(labels.includes('stax-xml EventReaderSync (native reference)'), labels.join('\n'));
  assert.equal(labels.some((label) => /native addon|aggregate/i.test(label)), false);

  const parserScenarioSource = readFileSync(join(repoRoot, 'packages', 'benchmark', 'common', 'parser-scenarios.mjs'), 'utf8');
  assert.doesNotMatch(parserScenarioSource, /native-aggregate-probe|parse_aggregate_/);
});

test('published native benchmark comparators do not call the native aggregate addon directly', () => {
  for (const relativePath of [
    join('packages', 'benchmark', 'common', 'parser-scenarios.mjs'),
    join('packages', 'benchmark', 'cross-runtime-comparison.mjs'),
    join('packages', 'benchmark', 'simdxml-upstream-comparison.mjs'),
  ]) {
    const source = readFileSync(join(repoRoot, relativePath), 'utf8');
    assert.doesNotMatch(source, /@stax-xml\/native-aggregate-probe|parse_aggregate_/);
    assert.match(source, /StreamReaderSync|EventReader/);
  }
});

test('published native reader benchmarks require native optimized table capabilities', () => {
  for (const relativePath of [
    join('packages', 'benchmark', 'common', 'parser-scenarios.mjs'),
    join('packages', 'benchmark', 'cross-runtime-comparison.mjs'),
    join('packages', 'benchmark', 'simdxml-upstream-comparison.mjs'),
  ]) {
    const source = readFileSync(join(repoRoot, relativePath), 'utf8');
    assert.match(source, /streamingEventBatches/);
  }
  const parserScenarioSource = readFileSync(
    join(repoRoot, 'packages', 'benchmark', 'common', 'parser-scenarios.mjs'),
    'utf8',
  );
  assert.match(parserScenarioSource, /documentNodesProjection/);
});

test('published converter benchmark uses the public projection fast surface', () => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, 'packages', 'stax-xml', 'package.json'), 'utf8'));
  assert.deepEqual(packageJson.exports['./projection'], {
    types: './dist/projection.d.ts',
    import: './dist/projection.js',
  });

  const benchmarkSource = readFileSync(
    join(repoRoot, 'packages', 'benchmark', 'converter-plain-output-benchmark.mjs'),
    'utf8',
  );
  assert.match(benchmarkSource, /initStaxXml/);
  assert.match(benchmarkSource, /converter api compiled native byte projection/);
  assert.match(benchmarkSource, /ProjectionReader native object rows/);
  assert.doesNotMatch(benchmarkSource, /@stax-xml\/native-aggregate-probe|parse_aggregate_/);

  const processorSource = readFileSync(
    join(repoRoot, 'packages', 'stax-xml', 'src', 'converter', 'CompiledRootProcessor.ts'),
    'utf8',
  );
  assert.match(processorSource, /\.\.\/projection\/index\.js/);
  assert.doesNotMatch(processorSource, /capabilities\.(objectRowsProjection|itemRowsProjection)/);
});

test('published package subpaths share initialized native runtime', async () => {
  const staxXml = await import('stax-xml');
  const runtimeApi = await import('stax-xml/runtime');
  const projection = await import('stax-xml/projection');

  try {
    const parseDocumentNodesUint8Array = (input) => ({
      inputBytes: input.byteLength,
      nodeCount: 1,
      json: '[{"tagName":"root","attributes":{},"children":[{"tagName":"item","attributes":{},"children":[]}]}]',
    });
    const runtime = await staxXml.initStaxXml({
      backend: 'native',
      fallbackOnLoadError: false,
      platform: { platform: 'linux', arch: 'x64', libc: 'gnu' },
      importPackage: async () => ({ parseDocumentNodesUint8Array }),
    });
    assert.equal(runtime.backend.kind, 'native');
    assert.equal(typeof runtime.capabilities.documentNodesProjection, 'function');

    assert.deepEqual(
      projection.parseXmlNodesSync(Buffer.from('<root><item/></root>'), { backend: 'native' }),
      [{ tagName: 'root', attributes: {}, children: [{ tagName: 'item', attributes: {}, children: [] }] }],
    );
  } finally {
    runtimeApi.resetStaxXmlRuntimeForTests();
  }
});

test('XPath 1.0 conformance matrix is documented for the public converter surface', () => {
  const matrix = readFileSync(
    join(repoRoot, 'packages', 'docs', 'src', 'content', 'docs', 'converter', 'xpath-1-conformance.md'),
    'utf8',
  );

  for (const feature of [
    '13 axes',
    'Core function library',
    'Variable references',
    'DTD ID typing',
    'Unicode character semantics',
  ]) {
    assert.match(matrix, new RegExp(feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
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
