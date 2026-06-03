import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(__dirname, 'results', 'release', 'spidermonkey-jsshell-stax-primary-byte-batch.json');
const mdPath = join(__dirname, 'results', 'release', 'spidermonkey-jsshell-stax-primary-byte-batch.md');

test('SpiderMonkey js-shell StAX primary byte-batch row separates host encoding blockers', () => {
  const report = JSON.parse(readFileSync(jsonPath, 'utf8'));

  assert.equal(report.objective, 'spidermonkey-jsshell-stax-primary-byte-batch');
  assert.equal(report.contract, 'current-stax-stream-reader-sync-primary-byte-batch-full-string-js-shell-row');
  assert.equal(report.fixture.generated, true);
  assert.equal(report.fixture.shape, 'generated-single-root-corpus-repetition');
  assert.equal(report.sourceContract.sourceMode, 'sync-iterable-byte-batches');
  assert.deepEqual(report.sourceContract.primarySyncByteBatchMissingGlobals, []);
  assert.equal(report.sourceContract.primaryPathRunnableWithoutHostEncoding, true);

  assert.equal(report.summary.rowCount, 2);
  assert.equal(report.summary.allRowsFullStringParity, true);
  assert.equal(report.summary.allRowsPrimaryByteBatch, true);
  assert.equal(report.summary.allRowsMissingHostEncodingGlobals, true);
  assert.equal(report.summary.counterexampleCount, 0);
  assert.equal(report.summary.conclusionAllowed, false);

  for (const row of report.variants) {
    assert.equal(row.runtime.id, 'spidermonkey-jsshell');
    assert.equal(row.fullStringParity, true);
    assert.equal(row.currentStaxPrimaryByteBatchRow, true);
    assert.equal(row.canRunCurrentStaxPrimaryByteBatchBenchmark, true);
    assert.equal(row.canRunCurrentStaxFullStringBenchmark, false);
    assert.deepEqual(row.blockedUnchangedHarnessGlobals, ['TextEncoder', 'ReadableStream', 'fetch']);
    assert.equal(row.globals.TextDecoder, 'undefined');
    assert.equal(row.globals.TextEncoder, 'undefined');
    assert.equal(row.boundedMemory, null);
    assert.equal(row.memory.primaryKind, 'not-recorded');
    assert.ok(row.mibPerSec > 0);
  }

  const markdown = readFileSync(mdPath, 'utf8');
  assert.match(markdown, /SpiderMonkey js-shell StAX Primary Byte-Batch Row/);
  assert.match(markdown, /Missing host encoding globals: yes/);
  assert.match(markdown, /Runtime-limit conclusion allowed: no/);
});
