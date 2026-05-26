import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'segment-tokenizer-string-frontier-report-test');
const jsonOut = join(tmpDir, 'segment-tokenizer-string-frontier.json');
const mdOut = join(tmpDir, 'segment-tokenizer-string-frontier.md');

test('segment tokenizer string frontier records TextDecoder materialization cost without full parity claims', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    '--expose-gc',
    join(__dirname, 'segment-tokenizer-string-frontier.mjs'),
    '--file',
    join(__dirname, 'test-data', 'runtime-comparison-16mib.xml'),
    '--chunk-kib',
    '16',
    '--batch-size',
    '4',
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
  assert.equal(report.objective, 'segment-tokenizer-string-frontier');
  assert.equal(report.contract, 'file-backed-segment-tokenizer-string-frontier');
  assert.equal(report.summary.rowCount, 8);
  assert.equal(report.summary.counterexamples200MiB, 0);
  assert.equal(typeof report.summary.allStringsVsTokenOnlyRatio, 'number');
  assert.deepEqual(report.rows.map(row => row.id), [
    'tokenOnly',
    'elementNameStrings',
    'elementNameCachedStrings',
    'elementAndAttributeNameStrings',
    'elementAndAttributeNameCachedStrings',
    'elementAndAttributeStrings',
    'allTokenStringsNoObjects',
    'allTokenStringsNameCachedNoObjects',
  ]);

  const first = report.rows[0];
  for (const row of report.rows) {
    assert.equal(row.fullStringParity, false);
    assert.equal(row.contractScope, 'xml-token-boundary-string-materialization-frontier');
    assert.equal(row.sourceMode, 'file-backed-sync-iterable-byte-batches');
    assert.equal(row.parserInput, 'synchronous Iterable<Uint8Array[]>');
    assert.equal(row.demandDrivenSource, true);
    assert.equal(row.directReadableStream, false);
    assert.equal(row.fullArrayBufferParserInput, false);
    assert.equal(row.usesNodeBuffer, false);
    assert.equal(row.eventCount, first.eventCount);
    assert.equal(row.startElementCount, first.startElementCount);
    assert.equal(row.endElementCount, first.endElementCount);
    assert.equal(row.textEventCount, first.textEventCount);
    assert.equal(row.attributeCount, first.attributeCount);
    assert.equal(row.boundedMemory, true);
    assert.equal(row.sampleCount, 1);
  }

  const tokenOnly = report.rows.find(row => row.id === 'tokenOnly');
  const elementNames = report.rows.find(row => row.id === 'elementNameStrings');
  const cachedElementNames = report.rows.find(row => row.id === 'elementNameCachedStrings');
  const elementAndAttributeNames = report.rows.find(row => row.id === 'elementAndAttributeNameStrings');
  const cachedElementAndAttributeNames = report.rows.find(row => row.id === 'elementAndAttributeNameCachedStrings');
  const allStrings = report.rows.find(row => row.id === 'allTokenStringsNoObjects');
  const cachedAllStrings = report.rows.find(row => row.id === 'allTokenStringsNameCachedNoObjects');
  assert.equal(tokenOnly.usesTextDecoder, false);
  assert.equal(tokenOnly.materializedStringCount, 0);
  assert.equal(elementNames.usesTextDecoder, true);
  assert.equal(elementNames.materializedStringCount, first.startElementCount + first.endElementCount);
  assert.equal(cachedElementNames.cacheNames, true);
  assert.equal(cachedElementNames.checksum, elementNames.checksum);
  assert.equal(cachedElementNames.materializedStringCount, elementNames.materializedStringCount);
  assert.ok(cachedElementNames.decodeCalls < elementNames.decodeCalls);
  assert.ok(cachedElementNames.cachedStringHitCount > 0);
  assert.ok(cachedElementNames.cachedStringMissCount > 0);
  assert.ok(cachedElementNames.cachedNameCount > 0);
  assert.equal(cachedElementAndAttributeNames.cacheNames, true);
  assert.equal(cachedElementAndAttributeNames.checksum, elementAndAttributeNames.checksum);
  assert.ok(cachedElementAndAttributeNames.decodeCalls < elementAndAttributeNames.decodeCalls);
  assert.ok(cachedElementAndAttributeNames.cachedStringHitCount > cachedElementNames.cachedStringHitCount);
  assert.equal(allStrings.usesTextDecoder, true);
  assert.equal(allStrings.materializedStringCount, first.startElementCount + first.endElementCount + first.attributeCount * 2 + first.textEventCount);
  assert.equal(allStrings.decodedByteCount > elementNames.decodedByteCount, true);
  assert.equal(cachedAllStrings.cacheNames, true);
  assert.equal(cachedAllStrings.checksum, allStrings.checksum);
  assert.equal(cachedAllStrings.materializedStringCount, allStrings.materializedStringCount);
  assert.ok(cachedAllStrings.decodeCalls < allStrings.decodeCalls);
  assert.ok(cachedAllStrings.cachedStringHitCount > 0);
  assert.ok(cachedAllStrings.cachedNameCount > 0);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Segment Tokenizer String Frontier/);
  assert.match(markdown, /TextDecoder string materialization/);
  assert.match(markdown, /same-token-boundary-contract/);
  assert.match(markdown, /string-materialization-frontier/);
  assert.match(markdown, /partial-not-stax-counterexample/);
  assert.match(markdown, /not Node Buffer, native addons, or lazy getters/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }
}
