import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'candidate-headroom-large-report-test.json');
const mdOut = join(tmpDir, 'candidate-headroom-large-report-test.md');
const stabilityJsonOut = join(tmpDir, 'candidate-headroom-large-stability-report-test.json');
const stabilityMdOut = join(tmpDir, 'candidate-headroom-large-stability-report-test.md');
const filteredJsonOut = join(tmpDir, 'candidate-headroom-large-filtered-report-test.json');
const filteredMdOut = join(tmpDir, 'candidate-headroom-large-filtered-report-test.md');

test('large candidate headroom matrix preserves bounded byte-batch contract', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'candidate-headroom-large.mjs'),
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
  assert.equal(report.objective, 'candidate-headroom-large');
  assert.equal(report.contract, 'generated-byte-batch-mixed-materialization-headroom-matrix');
  assert.equal(report.environment.gcStrategy, 'globalThis.gc');
  assert.equal(report.fixture.generated, true);
  assert.equal(report.fixture.shape, 'diverse-cycle');
  assert.equal(report.fixture.rowCycleSize, 64);
  assert.equal(report.woodstoxTarget.baselineTool, 'woodstox');
  assert.equal(report.woodstoxTarget.goalRatio, 0.9);
  assert.match(report.sourceContract.parserInput, /Iterable<Uint8Array\[\]>/);
  assert.match(report.sourceContract.arrayBufferConsumption, /synchronous Iterable<Uint8Array\[\]>/);
  assert.match(report.sourceContract.arrayBufferConsumption, /not one full 1 GiB ArrayBuffer parser input/);
  assert.match(report.sourceContract.batchBackpressure, /one grouped Uint8Array\[\] batch per synchronous parser pull/);
  assert.match(report.sourceContract.multiChunkBatchCost, /single Uint8Array batch item as a view/);
  assert.match(report.sourceContract.multiChunkBatchCost, /concatenated into one parser buffer/);
  assert.match(report.sourceContract.readableStreamScope, /does not consume a pure ReadableStream directly/);
  assert.match(report.sourceContract.corpusScope, /generated fixtures/);
  assert.equal(report.eventCountParity.status, 'ok');
  assert.equal(report.fullStringParity.status, 'ok');
  assert.deepEqual(report.variants.map(entry => entry.id), [
    'scanAllNoDecode',
    'nameStringOnly',
    'textStringOnly',
    'attrNameStringOnly',
    'attrValueStringOnly',
    'withoutElementNameStrings',
    'withoutTextStrings',
    'withoutAttributeNameStrings',
    'withoutAttributeValueStrings',
    'stringFull',
    'eventObjectFull',
    'cursorAccessor',
    'rawFrameDirect',
    'rawFrameNameId',
    'rawFrameNameIdLongAsciiText',
    'rawFrameNameIdTextCache',
    'rawFrameNameIdTrimGuard',
    'rawFrameNameIdAsciiPreTrim',
    'rawFrameNameIdLongTextCache',
    'rawFrameNameIdFoldTrim',
    'rawFrameSemanticChecksum',
    'rawFrameStringCache',
  ]);

  const partialRows = report.variants.filter(entry => !entry.fullStringParity);
  const fullRows = report.variants.filter(entry => entry.fullStringParity);
  assert.ok(partialRows.every(entry =>
    entry.family === 'partial-upper-bound'
    || entry.family === 'near-full-upper-bound'
    || entry.family === 'semantic-upper-bound'
  ));
  assert.ok(fullRows.every(entry => entry.family === 'full-stax-js'));
  assert.ok(report.variants.every(entry => entry.eventCount === report.eventCountParity.eventCount));
  assert.ok(fullRows.every(entry => entry.eventCount === report.fullStringParity.eventCount));
  assert.ok(fullRows.every(entry => entry.checksum === report.fullStringParity.checksum));
  assert.ok(report.variants.every(entry => entry.boundedMemory === true));
  assert.ok(report.variants.every(entry => entry.counterexampleStatus === 'not-found'));
  assert.ok(report.variants.every(entry => entry.runtimeLimitCounterexampleEligible === false));

  const scan = report.variants.find(entry => entry.id === 'scanAllNoDecode');
  const stringFull = report.variants.find(entry => entry.id === 'stringFull');
  const eventObjectFull = report.variants.find(entry => entry.id === 'eventObjectFull');
  const rawDirect = report.variants.find(entry => entry.id === 'rawFrameDirect');
  const rawNameId = report.variants.find(entry => entry.id === 'rawFrameNameId');
  const rawNameIdLongAsciiText = report.variants.find(entry => entry.id === 'rawFrameNameIdLongAsciiText');
  const rawNameIdTextCache = report.variants.find(entry => entry.id === 'rawFrameNameIdTextCache');
  const rawNameIdTrimGuard = report.variants.find(entry => entry.id === 'rawFrameNameIdTrimGuard');
  const rawNameIdAsciiPreTrim = report.variants.find(entry => entry.id === 'rawFrameNameIdAsciiPreTrim');
  const rawNameIdLongTextCache = report.variants.find(entry => entry.id === 'rawFrameNameIdLongTextCache');
  const rawNameIdFoldTrim = report.variants.find(entry => entry.id === 'rawFrameNameIdFoldTrim');
  const rawSemanticChecksum = report.variants.find(entry => entry.id === 'rawFrameSemanticChecksum');
  const rawStringCache = report.variants.find(entry => entry.id === 'rawFrameStringCache');
  const withoutText = report.variants.find(entry => entry.id === 'withoutTextStrings');

  assert.equal(scan.materializationCounters.stringFieldReads, 0);
  assert.equal(scan.materializationCounters.rawSpanMaterializations, 0);
  assert.ok(stringFull.materializationCounters.stringFieldReads > 0);
  assert.equal(withoutText.family, 'near-full-upper-bound');
  assert.equal(withoutText.fullStringParity, false);
  assert.ok(withoutText.materializationCounters.stringFieldReads < stringFull.materializationCounters.stringFieldReads);
  assert.ok(withoutText.materializationCounters.textStringReads === 0);
  assert.ok(withoutText.materializationCounters.nameStringReads > 0);
  assert.ok(withoutText.materializationCounters.attrNameStringReads > 0);
  assert.ok(withoutText.materializationCounters.attrValueStringReads > 0);
  assert.ok(eventObjectFull.fullStringParity);
  assert.equal(eventObjectFull.materializationCounters.eventObjects, eventObjectFull.eventCount);
  assert.equal(eventObjectFull.checksum, report.fullStringParity.checksum);
  assert.ok(rawDirect.materializationCounters.rawSpanMaterializations > 0);
  assert.ok(rawNameId.materializationCounters.rawNameCacheHits > 0);
  assert.ok(rawNameId.materializationCounters.rawSpanMaterializations < rawDirect.materializationCounters.rawSpanMaterializations);
  assert.equal(rawNameIdLongAsciiText.fullStringParity, true);
  assert.equal(rawNameIdLongAsciiText.checksum, report.fullStringParity.checksum);
  assert.equal(rawNameIdLongAsciiText.materializationCounters.stringFieldReads, rawNameId.materializationCounters.stringFieldReads);
  assert.equal(rawNameIdLongAsciiText.materializationCounters.rawSpanMaterializations, rawNameId.materializationCounters.rawSpanMaterializations);
  assert.equal(typeof rawNameIdLongAsciiText.materializationCounters.longAsciiTextHits, 'number');
  assert.equal(typeof rawNameIdLongAsciiText.materializationCounters.longAsciiTextFallbacks, 'number');
  assert.equal(rawNameIdTextCache.fullStringParity, true);
  assert.equal(rawNameIdTextCache.checksum, report.fullStringParity.checksum);
  assert.equal(rawNameIdTextCache.materializationCounters.stringFieldReads, rawNameId.materializationCounters.stringFieldReads);
  assert.ok(rawNameIdTextCache.materializationCounters.rawValueCacheHits > 0);
  assert.ok(rawNameIdTextCache.materializationCounters.rawValueCacheMisses > 0);
  assert.equal(rawNameIdTrimGuard.fullStringParity, true);
  assert.equal(rawNameIdTrimGuard.checksum, report.fullStringParity.checksum);
  assert.equal(rawNameIdTrimGuard.materializationCounters.stringFieldReads, rawNameId.materializationCounters.stringFieldReads);
  assert.ok(rawNameIdTrimGuard.materializationCounters.textTrimGuardSkips > 0);
  assert.ok(rawNameIdTrimGuard.materializationCounters.textTrimGuardFallbacks > 0);
  assert.equal(rawNameIdAsciiPreTrim.fullStringParity, true);
  assert.equal(rawNameIdAsciiPreTrim.checksum, report.fullStringParity.checksum);
  assert.equal(rawNameIdAsciiPreTrim.materializationCounters.stringFieldReads, rawNameId.materializationCounters.stringFieldReads);
  assert.ok(rawNameIdAsciiPreTrim.materializationCounters.textAsciiPreTrimSkips > 0);
  assert.ok(rawNameIdAsciiPreTrim.materializationCounters.textAsciiPreTrimFallbacks > 0);
  assert.equal(rawNameIdLongTextCache.fullStringParity, true);
  assert.equal(rawNameIdLongTextCache.checksum, report.fullStringParity.checksum);
  assert.equal(rawNameIdLongTextCache.materializationCounters.stringFieldReads, rawNameId.materializationCounters.stringFieldReads);
  assert.ok(rawNameIdLongTextCache.materializationCounters.rawValueCacheHits > 0);
  assert.ok(rawNameIdLongTextCache.materializationCounters.rawValueCacheMisses > 0);
  assert.ok(rawNameIdLongTextCache.materializationCounters.rawValueCacheHits < rawNameIdTextCache.materializationCounters.rawValueCacheHits);
  assert.equal(rawNameIdFoldTrim.fullStringParity, true);
  assert.equal(rawNameIdFoldTrim.checksum, report.fullStringParity.checksum);
  assert.equal(rawNameIdFoldTrim.materializationCounters.stringFieldReads, rawNameId.materializationCounters.stringFieldReads);
  assert.equal(rawNameIdFoldTrim.materializationCounters.rawSpanMaterializations, rawNameId.materializationCounters.rawSpanMaterializations);
  assert.equal(rawSemanticChecksum.fullStringParity, false);
  assert.equal(rawSemanticChecksum.checksum, report.fullStringParity.checksum);
  assert.equal(rawSemanticChecksum.materializationCounters.stringFieldReads, 0);
  assert.ok(rawSemanticChecksum.materializationCounters.semanticByteFoldFields > 0);
  assert.ok(rawStringCache.materializationCounters.rawNameCacheHits > 0);
  assert.ok(rawStringCache.materializationCounters.rawValueCacheHits > 0);
  assert.ok(rawStringCache.materializationCounters.rawSpanMaterializations <= rawNameId.materializationCounters.rawSpanMaterializations);
  assert.ok(report.findings.some(entry => entry.id === 'source-consumption-contract'));
  assert.ok(report.findings.some(entry => entry.id === 'multi-chunk-batch-cost'));
  assert.ok(report.findings.some(entry => entry.id === 'near-full-category-drop-scope'));
  assert.ok(report.findings.some(entry => entry.id === 'long-ascii-text-materialization-candidate'));
  assert.ok(report.findings.some(entry => entry.id === 'text-only-cache-candidate'));
  assert.ok(report.findings.some(entry => entry.id === 'text-trim-guard-candidate'));
  assert.ok(report.findings.some(entry => entry.id === 'ascii-pre-trim-text-candidate'));
  assert.ok(report.findings.some(entry => entry.id === 'fold-trim-text-checksum-candidate'));
  assert.ok(!report.omittedRows.some(entry => entry.id === 'eventObjectFull'));
  assert.ok(report.omittedRows.some(entry => entry.id === 'projectionLowSelectivity'));
  assert.ok(report.omittedRows.some(entry => entry.id === 'projectionHighSelectivity'));

  for (const entry of report.variants) {
    assert.equal(typeof entry.memory?.avgHeapUsedDeltaBytes, 'number');
    assert.equal(typeof entry.memory?.avgRssDeltaBytes, 'number');
    assert.equal(typeof entry.memory?.maxHeapUsedBytes, 'number');
    assert.equal(typeof entry.memory?.maxRssBytes, 'number');
    assert.equal(entry.memory.samples.length, 1);
    assert.equal(typeof entry.materializationCounters?.attributePairs, 'number');
  }

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Large Candidate Headroom Matrix/);
  assert.match(markdown, /1 GiB\+ bounded-memory counterexample search/);
  assert.match(markdown, /generated `Uint8Array` batches/);
  assert.match(markdown, /## Source Consumption/);
  assert.match(markdown, /ArrayBuffer consumption:/);
  assert.match(markdown, /Multi-chunk batch cost:/);
  assert.match(markdown, /synchronous Iterable<Uint8Array\[\]>/);
  assert.match(markdown, /does not consume a pure ReadableStream directly/);
  assert.match(markdown, /Partial rows intentionally skip/);
  assert.match(markdown, /Full rows preserve/);
  assert.match(markdown, /Node `Buffer\.toString\(\)`/);
  assert.match(markdown, /lazy getters/);
  assert.match(markdown, /## Omitted Rows/);
  assert.match(markdown, /eventObjectFull/);
  assert.doesNotMatch(markdown, /eventObjectFull: EventReaderSync requires a complete XML string input/);
  assert.match(markdown, /Projection rows require a separate selector contract/);
  assert.match(markdown, /Full-string parity rows: ok/);
});

test('large candidate headroom matrix supports a corpus-cycle fixture seed', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'candidate-headroom-large.mjs'),
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
  assert.equal(report.objective, 'candidate-headroom-large');
  assert.equal(report.contract, 'byte-batch-mixed-materialization-headroom-matrix');
  assert.equal(report.environment.gcStrategy, 'globalThis.gc');
  assert.equal(report.fixture.generated, false);
  assert.equal(report.fixture.source, 'corpus-file');
  assert.equal(report.fixture.shape, 'corpus-cycle');
  assert.equal(report.fixture.rowCycleSize, 1);
  assert.equal(report.fixture.batchSize, 1);
  assert.match(report.sourceContract.arrayBufferConsumption, /seed buffer/);
  assert.match(report.sourceContract.arrayBufferConsumption, /not one full 1 GiB ArrayBuffer parser input/);
  assert.match(report.sourceContract.corpusScope, /loads one corpus seed with readFileSync/);
  assert.match(report.fixture.sourceFile, /books\.xml$/);
  assert.equal(report.eventCountParity.status, 'ok');
  assert.equal(report.fullStringParity.status, 'ok');
  assert.ok(report.variants.every(entry => entry.boundedMemory === true));
  assert.ok(report.variants.some(entry => entry.fullStringParity));
  assert.ok(report.findings.some(entry => entry.id === 'corpus-cycle-fixture'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /corpus-backed `Uint8Array` batches/);
  assert.match(markdown, /Fixture source: corpus-file/);
  assert.match(markdown, /Source file: .*books\.xml/);
  assert.match(markdown, /corpus-cycle-fixture/);
});

test('large candidate headroom matrix includes projection rows on projection fixtures', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'candidate-headroom-large.mjs'),
    '--size-gib',
    '0.001',
    '--fixture-shape',
    'projection-cycle',
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
  assert.equal(report.objective, 'candidate-headroom-large');
  assert.equal(report.fixture.shape, 'projection-cycle');
  assert.deepEqual(report.variants.map(entry => entry.id), [
    'scanAllNoDecode',
    'nameStringOnly',
    'textStringOnly',
    'attrNameStringOnly',
    'attrValueStringOnly',
    'withoutElementNameStrings',
    'withoutTextStrings',
    'withoutAttributeNameStrings',
    'withoutAttributeValueStrings',
    'stringFull',
    'eventObjectFull',
    'cursorAccessor',
    'rawFrameDirect',
    'rawFrameNameId',
    'rawFrameNameIdLongAsciiText',
    'rawFrameNameIdTextCache',
    'rawFrameNameIdTrimGuard',
    'rawFrameNameIdAsciiPreTrim',
    'rawFrameNameIdLongTextCache',
    'rawFrameNameIdFoldTrim',
    'rawFrameSemanticChecksum',
    'rawFrameStringCache',
    'projectionLowSelectivity',
    'projectionHighSelectivity',
  ]);
  assert.ok(!report.omittedRows.some(entry => entry.id === 'projectionLowSelectivity'));
  assert.ok(!report.omittedRows.some(entry => entry.id === 'projectionHighSelectivity'));
  assert.equal(report.projectionParity.status, 'ok');
  assert.deepEqual(report.projectionParity.rowIds, ['projectionLowSelectivity', 'projectionHighSelectivity']);

  const streamRows = report.variants.filter(entry => entry.eventCountKind === 'stream-events');
  assert.ok(streamRows.every(entry => entry.eventCount === report.eventCountParity.eventCount));

  const low = report.variants.find(entry => entry.id === 'projectionLowSelectivity');
  const high = report.variants.find(entry => entry.id === 'projectionHighSelectivity');
  assert.equal(low.family, 'projection-js');
  assert.equal(high.family, 'projection-js');
  assert.equal(low.eventCountKind, 'projected-records');
  assert.equal(high.eventCountKind, 'projected-records');
  assert.equal(low.fullStringParity, false);
  assert.equal(high.fullStringParity, false);
  assert.ok(low.eventCount > 0);
  assert.ok(high.eventCount > low.eventCount);
  assert.equal(low.materializationCounters.projectedRecords, low.eventCount);
  assert.equal(high.materializationCounters.projectedRecords, high.eventCount);
  assert.equal(low.materializationCounters.projectionFieldReads, low.eventCount * 2);
  assert.equal(high.materializationCounters.projectionFieldReads, high.eventCount * 2);
  assert.equal(low.materializationCounters.attrValueStringReads, low.eventCount);
  assert.equal(high.materializationCounters.attrValueStringReads, high.eventCount);
  assert.equal(low.materializationCounters.textStringReads, low.eventCount);
  assert.equal(high.materializationCounters.textStringReads, high.eventCount);
  assert.equal(low.runtimeLimitCounterexampleEligible, false);
  assert.equal(high.runtimeLimitCounterexampleEligible, false);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /projectionLowSelectivity/);
  assert.match(markdown, /projectionHighSelectivity/);
  assert.match(markdown, /Projection rows report projected record counts/);
  assert.match(markdown, /selects `\/root\/book\[@code="7"\]`/);
  assert.match(markdown, /selects every `\/root\/book`/);
});

test('large candidate headroom matrix can filter cases without mixing projection parity', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [filteredJsonOut, filteredMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'candidate-headroom-large.mjs'),
    '--size-gib',
    '0.001',
    '--fixture-shape',
    'projection-cycle',
    '--diverse-cycle-size',
    '64',
    '--runs',
    '1',
    '--warmups',
    '0',
    '--cases',
    'stringFull,rawFrameNameId,rawFrameNameIdNoTrim,projectionLowSelectivity,projectionHighSelectivity',
    '--json-out',
    filteredJsonOut,
    '--md-out',
    filteredMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(filteredJsonOut, 'utf8'));
  assert.deepEqual(report.options.cases, [
    'stringFull',
    'rawFrameNameId',
    'rawFrameNameIdNoTrim',
    'projectionLowSelectivity',
    'projectionHighSelectivity',
  ]);
  assert.deepEqual(report.variants.map(entry => entry.id), report.options.cases);
  assert.equal(report.eventCountParity.status, 'ok');
  assert.deepEqual(report.eventCountParity.rowIds, ['stringFull', 'rawFrameNameId', 'rawFrameNameIdNoTrim']);
  assert.equal(report.fullStringParity.status, 'ok');
  assert.deepEqual(report.fullStringParity.rowIds, ['stringFull', 'rawFrameNameId']);
  const noTrim = report.variants.find(entry => entry.id === 'rawFrameNameIdNoTrim');
  assert.equal(noTrim.fullStringParity, false);
  assert.equal(noTrim.contractScope, 'full-materialization-minus-text-trim');
  assert.equal(noTrim.materializationCounters.stringFieldReads, report.variants.find(entry => entry.id === 'rawFrameNameId').materializationCounters.stringFieldReads);
  assert.equal(report.projectionParity.status, 'ok');
  assert.deepEqual(report.projectionParity.rowIds, ['projectionLowSelectivity', 'projectionHighSelectivity']);

  const markdown = readFileSync(filteredMdOut, 'utf8');
  assert.match(markdown, /Cases: stringFull, rawFrameNameId, rawFrameNameIdNoTrim, projectionLowSelectivity, projectionHighSelectivity/);
  assert.match(markdown, /Projection rows report projected record counts/);
});

test('large candidate headroom matrix renders multi-run timing stability', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [stabilityJsonOut, stabilityMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'candidate-headroom-large.mjs'),
    '--size-gib',
    '0.0001',
    '--fixture-shape',
    'diverse-cycle',
    '--diverse-cycle-size',
    '16',
    '--runs',
    '2',
    '--warmups',
    '0',
    '--json-out',
    stabilityJsonOut,
    '--md-out',
    stabilityMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(stabilityJsonOut, 'utf8'));
  assert.equal(report.options.runs, 2);
  assert.ok(report.variants.every(entry => entry.samplesMs.length === 2));

  const markdown = readFileSync(stabilityMdOut, 'utf8');
  assert.match(markdown, /## Timing Stability/);
  assert.match(markdown, /Rows with `runs > 1` report same-process timing spread/);
  assert.match(markdown, /\| eventObjectFull \| 2 \|/);
  assert.match(markdown, /\| rawFrameNameId \| 2 \|/);
});
