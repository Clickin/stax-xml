import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'runtime-proof-coverage-audit-report-test');
const jsonOut = join(tmpDir, 'runtime-proof-coverage-audit.json');
const mdOut = join(tmpDir, 'runtime-proof-coverage-audit.md');

test('runtime proof coverage audit keeps open proof obligations explicit', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-proof-coverage-audit.mjs'),
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
  assert.equal(report.objective, 'runtime-proof-coverage-audit');
  assert.equal(report.contract, 'static-release-artifact-proof-coverage');
  assert.equal(report.summary.conclusionAllowed, false);
  assert.equal(report.summary.parseErrorCount, 0);
  assert.equal(report.summary.scannedArtifactCount, 106);
  assert.equal(report.summary.measuredRowCount, 642);
  assert.equal(report.summary.largeJsFullRowCount, 393);
  assert.equal(report.summary.corpusSeedCount, 3);
  assert.equal(report.summary.openObligationCount, 2);
  assert.equal(report.summary.benchmarkArtifactCount, 74);
  assert.equal(report.summary.sourceArtifactCount, 14);
  assert.equal(report.summary.traceArtifactCount, 7);
  assert.equal(report.summary.allocationArtifactCount, 13);
  assert.equal(report.summary.environmentArtifactCount, 2);
  assert.equal(report.summary.negativeArtifactCount, 4);

  const runtimeIds = report.coverage.runtimes.map(row => row.runtimeId);
  assert.ok(runtimeIds.includes('node-v8'));
  assert.ok(runtimeIds.includes('bun-jsc'));
  assert.ok(runtimeIds.includes('deno-v8'));
  assert.ok(runtimeIds.includes('chrome-v8-browser'));
  assert.ok(runtimeIds.includes('firefox-spidermonkey-browser'));
  assert.ok(runtimeIds.includes('safari-jsc-browser'));
  assert.ok(runtimeIds.includes('quick-xml-rust'));
  assert.ok(runtimeIds.includes('woodstox-jvm'));

  assert.equal(report.coverage.browser.chromeBenchmarkRows.length, 98);
  assert.equal(report.coverage.browser.firefoxBenchmarkRows.length, 82);
  assert.equal(report.coverage.browser.safariBenchmarkRows.length, 0);
  assert.equal(report.coverage.browser.nonV8BenchmarkRows.length, 82);
  assert.deepEqual(report.coverage.corpusSeeds, ['books.xml', 'large.xml', 'treebank_e.xml']);
  assert.ok(report.coverage.sourcePins.some(pin =>
    pin.runtimeId === 'firefox-spidermonkey-browser'
    && pin.sourceArtifact === 'firefox-spidermonkey-textdecoder-source-pin-audit.json'
  ));
  assert.ok(report.coverage.sourcePins.some(pin =>
    pin.runtimeId === 'firefox-spidermonkey-browser'
    && pin.sourceArtifact === 'firefox-spidermonkey-string-source-pin-audit.json'
    && pin.kind === 'SpiderMonkey JS string source boundary'
  ));
  assert.ok(report.coverage.sourcePins.some(pin =>
    pin.runtimeId === 'firefox-spidermonkey-browser'
    && pin.sourceArtifact === 'firefox-spidermonkey-memory-api-source-pin-audit.json'
    && pin.kind === 'Firefox page memory API boundary'
  ));
  assert.ok(report.coverage.sourcePins.some(pin =>
    pin.runtimeId === 'firefox-spidermonkey-browser'
    && pin.sourceArtifact === 'firefox-spidermonkey-jitspew-source-pin-audit.json'
    && pin.kind === 'SpiderMonkey JitSpew source boundary'
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'deno-event-reader-byte-batch.json'
    && row.runtimes.includes('deno-v8')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'deno-event-reader-byte-batch-corpus.json'
    && row.runtimes.includes('deno-v8')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'event-reader-byte-batch-cross-process-corpus.json'
    && row.runtimes.includes('node-v8')
    && row.runtimes.includes('bun-jsc')
    && row.runtimes.includes('deno-v8')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'candidate-headroom-cross-process-books-corpus-batch16.json'
    && row.runtimes.includes('node-v8')
    && row.runtimes.includes('bun-jsc')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'multi-chunk-batch-shape-audit.json'
    && row.evidenceKinds.includes('SOURCE_FACT')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'browser-fetch-readable-stream-books-corpus.json'
    && row.runtimes.includes('chrome-v8-browser')
    && row.measuredRowCount === 3
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'firefox-fetch-readable-stream-timeout-audit.json'
    && row.runtimes.includes('firefox-spidermonkey-browser')
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.measuredRowCount === 0
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'firefox-spidermonkey-diagnostic-dump-audit.json'
    && row.runtimes.includes('firefox-spidermonkey-browser')
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.measuredRowCount === 1
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'firefox-spidermonkey-js-shell-availability-audit.json'
    && row.runtimes.includes('firefox-spidermonkey-browser')
    && row.evidenceKinds.includes('ENVIRONMENT_FACT')
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
    && row.measuredRowCount === 0
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'materialization-contract-audit.json'
    && row.evidenceKinds.includes('NEGATIVE_RESULT')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'deno-textdecoder-source-pin-audit.json'
    && row.runtimes.includes('deno-v8')
  ));
  assert.ok(report.coverage.sourcePins.some(pin =>
    pin.runtimeId === 'deno-v8'
    && pin.sourceArtifact === 'deno-textdecoder-source-pin-audit.json'
    && pin.kind === 'Deno TextDecoder source boundary'
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'deno-textdecoder-span-variants.json'
    && row.runtimes.includes('deno-v8')
  ));
  assert.ok(report.scannedArtifacts.some(row =>
    row.sourceArtifact === 'deno-textdecoder-span-variants-corpus.json'
    && row.runtimes.includes('deno-v8')
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'bun-jsc'
    && row.allocationArtifacts.includes('bun-jsc-memory-allocation-profile.json')
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'bun-jsc'
    && row.traceArtifacts.includes('bun-jsc-codegen-trace.json')
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'chrome-v8-browser'
    && row.traceArtifacts.includes('browser-v8-codegen-trace.json')
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'deno-v8'
    && row.traceArtifacts.includes('deno-v8-codegen-trace.json')
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'deno-v8'
    && row.allocationArtifacts.includes('deno-v8-allocation-sampling.json')
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'firefox-spidermonkey-browser'
    && row.allocationArtifacts.includes('firefox-spidermonkey-allocation-profile.json')
  ));
  assert.ok(report.coverage.runtimes.some(row =>
    row.runtimeId === 'firefox-spidermonkey-browser'
    && row.traceArtifacts.includes('firefox-spidermonkey-profiler-trace.json')
  ));
  assert.ok(report.coverage.environmentArtifacts.some(row =>
    row.sourceArtifact === 'safari-webkit-availability-audit.json'
    && row.runtimes.includes('safari-jsc-browser')
  ));

  assertObligation(report, 'firefox-browser-rows-open', 'covered');
  assertObligation(report, 'safari-jsc-source-and-browser-rows-open', 'open');
  assertObligation(report, 'codegen-traces-open', 'partial');
  assertObligation(report, 'allocation-profiles-open', 'covered');
  assertObligation(report, 'non-v8-browser-coverage-open', 'covered');
  assertObligation(report, 'independent-corpus-suite-open', 'covered');
  assertObligation(report, 'counterexample-rule-present', 'covered');

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Runtime Proof Coverage Audit/);
  assert.match(markdown, /not an impossibility proof/);
  assert.match(markdown, /82 Firefox\/SpiderMonkey browser benchmark rows found/);
  assert.match(markdown, /Firefox benchmark rows and exact tested-build JS string, TextDecoder, and page memory API source pins are now present/);
  assert.match(markdown, /no Safari\/WebKit browser benchmark row was found/);
  assert.match(markdown, /Local Safari\/WebKit availability audit is present/);
  assert.match(markdown, /Run same-contract Safari\/WebKit rows on a macOS host/);
  assert.match(markdown, /Bun\/JSC evidence is not Safari\/browser JSC evidence/);
  assert.match(markdown, /Bun\/JSC allocation evidence present/);
  assert.match(markdown, /Bun\/JSC codegen\/IR evidence present/);
  assert.match(markdown, /Chrome\/V8 browser codegen trace evidence present/);
  assert.match(markdown, /Firefox\/SpiderMonkey Gecko Profiler trace evidence present/);
  assert.match(markdown, /Firefox\/SpiderMonkey JitSpew\/IONFLAGS source gate evidence present, but it is not emitted JIT IR/);
  assert.match(markdown, /Firefox\/SpiderMonkey diagnostic dump audit was attempted and emitted no JIT diagnostic dump/);
  assert.match(markdown, /Firefox\/SpiderMonkey local js-shell availability audit present; no emitted JIT IR is recorded by that audit/);
  assert.match(markdown, /Firefox\/SpiderMonkey JIT IR or optimized-code dump missing/);
  assert.match(markdown, /13 allocation\/profile artifacts found/);
  assert.match(markdown, /Environment artifacts: 2/);
  assert.match(markdown, /Non-V8 browser allocation evidence present/);
  assert.match(markdown, /Non-V8 browser benchmark rows: 82/);
  assert.match(markdown, /Current release corpus seeds: `books\.xml`, `large\.xml`, `treebank_e\.xml`/);
  assert.match(markdown, /2 proof obligation\(s\) remain open or partial/);
  assert.match(markdown, /Missing evidence is not evidence that optimization is impossible/);
});

function assertObligation(report, id, status) {
  const row = report.obligations.find(item => item.id === id);
  assert.ok(row, `missing obligation: ${id}`);
  assert.equal(row.status, status);
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
