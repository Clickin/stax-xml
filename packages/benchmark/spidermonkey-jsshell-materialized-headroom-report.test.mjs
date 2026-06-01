import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'spidermonkey-jsshell-materialized-headroom-test');
const jsonOut = join(tmpDir, 'spidermonkey-jsshell-materialized-headroom.json');
const mdOut = join(tmpDir, 'spidermonkey-jsshell-materialized-headroom.md');

test('SpiderMonkey js-shell materialized headroom report stays partial and non-StAX', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'spidermonkey-jsshell-materialized-headroom.mjs'),
    '--self-test',
    '--target-mib',
    '1',
    '--runs',
    '1',
    '--warmups',
    '0',
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
  assert.equal(report.objective, 'spidermonkey-jsshell-materialized-headroom');
  assert.equal(report.contract, 'spidermonkey-jsshell-ascii-materialized-string-object-headroom-not-stax');
  assert.equal(report.environment.runtimeName, 'spidermonkey-jsshell');
  assert.equal(report.fixture.source, 'ascii-corpus-seed-replay');
  assert.equal(report.summary.rowCount, 2);
  assert.equal(report.summary.counterexamples200MiB, 0);
  assert.equal(report.summary.memoryProofRows, 0);
  assert.equal(report.summary.sameSemanticChecksumRows, 2);

  for (const row of report.rows) {
    assert.equal(row.runtime.id, 'spidermonkey-jsshell');
    assert.equal(row.family, 'partial-spidermonkey-materialized-headroom');
    assert.equal(row.contractScope, 'ascii-materialized-string-object-no-textdecoder');
    assert.equal(row.sameSemanticChecksumFields, true);
    assert.equal(row.fullStringParity, false);
    assert.equal(row.boundedMemory, null);
    assert.equal(row.memory.primaryKind, 'not-recorded');
    assert.equal(row.sourceMode, 'corpus-seed-replay-sync-byte-loop');
    assert.equal(row.demandDrivenSource, true);
    assert.equal(row.directReadableStream, false);
    assert.equal(row.fullArrayBufferParserInput, false);
    assert.equal(row.corpusSeedReplay, true);
    assert.equal(typeof row.materializedStringCount, 'number');
    assert.equal(typeof row.materializedObjectCount, 'number');
    assert.equal(row.shellFacts.hasJitExecutionStatus, true);
    assert.equal(row.shellFacts.canReadBinaryInput, true);
    assert.equal(row.shellFacts.canRunCurrentStaxFullStringBenchmark, false);
  }

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# SpiderMonkey JS Shell Materialized Headroom/);
  assert.match(markdown, /materializes JS string primitives and event-shaped objects/);
  assert.match(markdown, /Full StAX parity/);
  assert.match(markdown, /200 MiB\/s bounded full-string counterexamples: 0/);
  assert.match(markdown, /Rows with memory proof: 0/);
  assert.match(markdown, /materialized-headroom-not-stax-counterexample/);
  assert.match(markdown, /TextDecoder\/ReadableStream\/public StAX reader unchanged execution remains blocked/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
}
