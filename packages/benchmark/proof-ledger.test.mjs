import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const ledgerPath = resolve(repoRoot, 'docs', 'plans', '2026-05-23-stax-api-performance-proof-ledger.md');

function readLedger() {
  return readFileSync(ledgerPath, 'utf8');
}

function claimRow(markdown, id) {
  const row = markdown.split(/\r?\n/).find((line) => line.startsWith(`| \`${id}\` |`));
  assert.ok(row, `missing claim row: ${id}`);
  return row;
}

test('proof ledger keeps runtime-limit claims below conclusion strength', () => {
  const markdown = readLedger();
  assert.match(markdown, /## Proof Vocabulary/);
  assert.match(markdown, /## Required Proof Tracks/);
  assert.match(markdown, /## Current Next Experiments/);

  assert.match(claimRow(markdown, 'CLAIM-JS-RUNTIME-LIMIT-200MIB'), /\| `HYPOTHESIS` \|/);
  assert.match(claimRow(markdown, 'CLAIM-WOODSTOX-SAME-JS-OBJECTS'), /\| `COUNTEREXAMPLE` \|/);
  assert.match(claimRow(markdown, 'CLAIM-LAZY-GETTERS'), /\| `NEGATIVE_RESULT` \|/);
  assert.match(claimRow(markdown, 'CLAIM-JS-STRING-ZERO-COPY'), /\| `ENGINE_INVARIANT`/);

  assert.doesNotMatch(markdown, /JavaScript runtimes cannot exceed 200 MiB\/s/i);
  assert.match(markdown, /Any 200 MiB\/s\+ bounded-memory JS row is a counterexample/);
});
