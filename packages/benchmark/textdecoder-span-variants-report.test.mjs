import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'textdecoder-span-variants-report-test.json');
const mdOut = join(tmpDir, 'textdecoder-span-variants-report-test.md');
const corpusJsonOut = join(tmpDir, 'textdecoder-span-variants-corpus-report-test.json');
const corpusMdOut = join(tmpDir, 'textdecoder-span-variants-corpus-report-test.md');

test('TextDecoder span variants stay on the same full-string contract', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'textdecoder-span-variants.mjs'),
    '--size-gib',
    '0.001',
    '--fixture-shape',
    'diverse-cycle',
    '--diverse-cycle-size',
    '64',
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
  assert.equal(report.objective, 'textdecoder-span-variants');
  assert.equal(report.contract, 'full-string-textdecoder-span-variant-headroom');
  assert.equal(report.fixture.generated, true);
  assert.equal(report.fixture.shape, 'diverse-cycle');
  assert.equal(report.fullStringParity.status, 'ok');
  assert.equal(report.eventCountParity.status, 'ok');
  assert.deepEqual(report.variants.map(entry => entry.id), [
    'subarraySharedDecoder',
    'viewSharedDecoder',
    'sliceCopySharedDecoder',
    'subarrayNewDecoder',
    'shortAsciiSubarraySharedDecoder',
  ]);

  for (const entry of report.variants) {
    assert.equal(entry.family, 'full-stax-js');
    assert.equal(entry.contractScope, 'full-string-materialization');
    assert.equal(entry.fullStringParity, true);
    assert.equal(entry.eventCount, report.fullStringParity.eventCount);
    assert.equal(entry.checksum, report.fullStringParity.checksum);
    assert.equal(entry.decodeStrategy.usesTextDecoder, true);
    assert.equal(entry.decodeStrategy.nodeBufferSpecific, false);
    assert.equal(entry.decodeStrategy.nativeAddon, false);
    assert.equal(entry.decodeStrategy.lazyGetter, false);
    assert.equal(
      entry.runtimeLimitCounterexampleEligible,
      report.fixture.actualBytes >= 1024 * 1024 * 1024 && entry.mibPerSec >= 200 && entry.boundedMemory,
    );
    assert.ok(entry.materializationCounters.stringFieldReads > 0);
    assert.ok(entry.materializationCounters.rawSpanMaterializations > 0);
    assert.equal(entry.materializationCounters.decodeSpanCalls, entry.materializationCounters.rawSpanMaterializations);
    assert.equal(typeof entry.memory.maxRssBytes, 'number');
  }

  assert.ok(report.findings.some(entry => entry.id === 'same-full-string-contract'));
  assert.ok(report.findings.some(entry => entry.id === 'textdecoder-variants-are-headroom-search'));
  assert.ok(report.findings.some(entry => entry.id === 'runtime-limit-still-unproven'));
  assert.ok(report.findings.some(entry => entry.id === 'no-buffer-native-or-lazy-getter-path'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# TextDecoder Span Variant Matrix/);
  assert.match(markdown, /same full-string checksum contract/);
  assert.match(markdown, /does not use Node `Buffer\.toString\(\)`/);
  assert.match(markdown, /does not use native addons/);
  assert.match(markdown, /does not use lazy getters/);
  assert.match(markdown, /not a proof that JavaScript runtimes have no further headroom/);
  assert.match(markdown, /Any 200 MiB\/s\+ bounded-memory full-string row remains a counterexample/);
});

test('TextDecoder span variants support a corpus-cycle fixture seed', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [corpusJsonOut, corpusMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'textdecoder-span-variants.mjs'),
    '--size-gib',
    '0.001',
    '--fixture-shape',
    'corpus-cycle',
    '--corpus-file',
    join(__dirname, 'assets', 'books.xml'),
    '--runs',
    '1',
    '--warmups',
    '0',
    '--json-out',
    corpusJsonOut,
    '--md-out',
    corpusMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(corpusJsonOut, 'utf8'));
  assert.equal(report.objective, 'textdecoder-span-variants');
  assert.equal(report.fixture.generated, false);
  assert.equal(report.fixture.source, 'corpus-file');
  assert.equal(report.fixture.shape, 'corpus-cycle');
  assert.equal(report.fixture.rowCycleSize, 1);
  assert.equal(report.fixture.batchSize, 1);
  assert.match(report.fixture.sourceFile, /books\.xml$/);
  assert.equal(report.fullStringParity.status, 'ok');
  assert.equal(report.eventCountParity.status, 'ok');
  assert.ok(report.variants.every(entry => entry.fullStringParity));
  assert.ok(report.findings.some(entry => entry.id === 'corpus-cycle-fixture'));

  const markdown = readFileSync(corpusMdOut, 'utf8');
  assert.match(markdown, /corpus-backed `Uint8Array` batches/);
  assert.match(markdown, /Fixture source: corpus-file/);
  assert.match(markdown, /Source file: .*books\.xml/);
  assert.match(markdown, /corpus-cycle-fixture/);
});
