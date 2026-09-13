import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { FIXTURE_IDS, FIXTURE_SEED, PROCESS_ORDER_SEED, createSyntheticFixture, scanEntityStats } from '../entity-single-eval/fixtures.mjs';
import { canonicalEvent, consumeSync, digestTranscript } from '../entity-single-eval/consume.mjs';
import { bootstrapCI, geometricMean, median } from '../entity-single-eval/analyze.mjs';
import { fingerprintDist } from '../entity-single-eval.mjs';

const apiPromise = import('../../stax-xml/dist/index.js');

test('fixture catalog is complete, seeded, and density counts values rather than bytes', () => {
  assert.deepEqual(FIXTURE_IDS, ['ascii-none', 'unicode-none', 'astral-none', 'rare', 'named-attr', 'numeric-attr', 'custom-attr', 'named-text', 'mixed', 'xmlns']);
  const first = createSyntheticFixture('mixed', { seed: FIXTURE_SEED, targetBytes: 32 * 1024 });
  const second = createSyntheticFixture('mixed', { seed: FIXTURE_SEED, targetBytes: 32 * 1024 });
  assert.equal(first.sha256, second.sha256);
  assert.equal(first.bytes.byteLength, second.bytes.byteLength);
  assert.equal(first.entityStats.targetValues, first.entityStats.attributeValues + first.entityStats.textValues);
  assert.equal(first.entityStats.valuesWithEntities, first.entityStats.entityAttributeValues + first.entityStats.entityTextValues);
  assert.equal(PROCESS_ORDER_SEED, 90317);
});

test('entity density scanner distinguishes occurrence count from values containing entities', () => {
  const stats = scanEntityStats('<root id=\'root\' xmlns="urn:x&amp;y"><r a="&amp;&amp;" b=\'plain\'><x>all &lt; text</x></r></root>');
  assert.equal(stats.targetValues, 3);
  assert.equal(stats.valuesWithEntities, 2);
  assert.equal(stats.rawOccurrences, 4);
  assert.equal(stats.targetRawOccurrences, 3);
  assert.equal(stats.entityDensity, 2 / 3);
  assert.equal(stats.namespaceValues, 1);
  assert.equal(stats.idValues, 1);
});

test('synthetic entity groups have exact target density, references, lengths, and unique values', () => {
  const rare = createSyntheticFixture('rare', { seed: FIXTURE_SEED, targetBytes: 64 * 1024 });
  assert.equal(rare.entityStats.remainderValues, 0);
  assert.equal(rare.entityStats.valuesWithEntities * 100, rare.entityStats.targetValues);
  assert.equal(rare.entityStats.entityAttributeValues + rare.entityStats.entityTextValues, rare.entityStats.valuesWithEntities);
  assert.equal(rare.entityStats.uniqueValueCount, rare.entityStats.targetValues);
  assert.equal(rare.entityStats.invalidSurrogates, 0);
  for (const length of [8, 32, 128]) assert.ok(rare.entityStats.semanticValueLengths[length] > 0);

  const mixed = createSyntheticFixture('mixed', { seed: FIXTURE_SEED, targetBytes: 64 * 1024 });
  assert.equal(mixed.entityStats.remainderValues, 0);
  assert.equal(mixed.entityStats.valuesWithEntities * 10, mixed.entityStats.targetValues);
  assert.equal(mixed.entityStats.uniqueValueCount, mixed.entityStats.targetValues);
  assert.equal(mixed.entityStats.invalidSurrogates, 0);

  const named = createSyntheticFixture('named-attr', { targetBytes: 32 * 1024 });
  const namedAttrs = [...named.source.matchAll(/\sa\d+="([^"]*)"/gu)].map((match) => match[1]);
  assert.ok(namedAttrs.length > 0);
  for (const value of namedAttrs) {
    assert.equal((value.match(/&amp;/gu) ?? []).length, 1);
    assert.equal((value.match(/&lt;/gu) ?? []).length, 1);
    assert.equal((value.match(/&gt;/gu) ?? []).length, 1);
    assert.equal((value.match(/&quot;/gu) ?? []).length, 1);
    assert.equal((value.match(/&apos;/gu) ?? []).length, 1);
  }
  assert.equal(named.entityStats.rawOccurrences, namedAttrs.length * 5);

  const numeric = createSyntheticFixture('numeric-attr', { targetBytes: 32 * 1024 });
  const numericAttrs = [...numeric.source.matchAll(/\sa\d+="([^"]*)"/gu)].map((match) => match[1]);
  assert.ok(numericAttrs.length > 0);
  for (const value of numericAttrs) {
    assert.equal((value.match(/&#(?:60|62);/gu) ?? []).length, 1);
    assert.equal((value.match(/&#x(?:3c|3e);/giu) ?? []).length, 1);
  }
  assert.equal(numeric.entityStats.rawOccurrences, numericAttrs.length * 2);
});

test('xmlns fixture has escaped URI bindings without duplicate declarations', () => {
  const fixture = createSyntheticFixture('xmlns', { targetBytes: 32 * 1024 });
  assert.equal(fixture.entityStats.namespaceValues, fixture.rows * 2 + 3);
  assert.equal(fixture.entityStats.namespaceRawOccurrences, fixture.rows + 3);
  assert.equal((fixture.source.match(/xmlns:p=/gu) ?? []).length, fixture.rows + 1);
  assert.equal((fixture.source.match(/xmlns=/gu) ?? []).length, fixture.rows + 1);
  assert.equal((fixture.source.match(/xmlns:q=/gu) ?? []).length, 1);
  for (const tag of fixture.source.matchAll(/<r\b[^>]*>/gu)) {
    assert.equal((tag[0].match(/xmlns:p=/gu) ?? []).length, 1);
    assert.equal((tag[0].match(/xmlns=/gu) ?? []).length, 1);
  }
  assert.ok(fixture.source.includes('&amp;'));
  assert.equal(fixture.entityStats.uniqueValueCount, fixture.entityStats.targetValues);
});

test('dist fingerprint includes sorted relative paths and file bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'entity-single-fingerprint-'));
  mkdirSync(join(root, 'nested'));
  writeFileSync(join(root, 'z.js'), 'z');
  writeFileSync(join(root, 'nested', 'a.js'), 'a');
  const first = fingerprintDist(root);
  writeFileSync(join(root, 'z.js'), 'changed');
  const second = fingerprintDist(root);
  assert.deepEqual(first.entries.map((entry) => entry.path), ['nested/a.js', 'z.js']);
  assert.notEqual(first.sha256, second.sha256);
});

test('paired bootstrap is deterministic and uses geometric block ratios', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(geometricMean([1, 4]), 2);
  const one = bootstrapCI([0.9, 1, 1.1], { iterations: 200, seed: 7 });
  const two = bootstrapCI([0.9, 1, 1.1], { iterations: 200, seed: 7 });
  assert.deepEqual(one, two);
  assert.equal(one.iterations, 200);
});

test('public consumer records full event transcript and stable string digest', async () => {
  const api = await apiPromise;
  const fixture = createSyntheticFixture('named-attr', { targetBytes: 4096 });
  const result = consumeSync(api, fixture.bytes, { kind: 'event-sync', canonical: true, ...fixture.options });
  assert.equal(result.error, undefined);
  assert.ok(result.eventCount > 0);
  assert.equal(result.transcriptDigest, digestTranscript(result.events));
  assert.equal(result.events[0].type, 'START_DOCUMENT');
  assert.equal(canonicalEvent(result.events.at(-1)).type, 'END_DOCUMENT');
  assert.ok(result.outputCodeUnits > 0);
});


