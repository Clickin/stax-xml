import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(__dirname, 'results', 'release', 'attribute-value-index-accessor-candidate.json');
const mdPath = join(__dirname, 'results', 'release', 'attribute-value-index-accessor-candidate.md');

test('attribute value index accessor candidate is recorded as a rejected API probe', () => {
  const report = JSON.parse(readFileSync(jsonPath, 'utf8'));
  assert.equal(report.objective, 'attribute-value-index-accessor-candidate');
  assert.equal(report.summary.classification, 'NEGATIVE_RESULT');
  assert.equal(report.summary.candidateRetained, false);
  assert.equal(report.summary.candidateCounterexamples200MiB, 0);
  assert.equal(report.candidateChange.retainedInSource, false);
  assert.equal(report.sourceContract.sourceMode, 'file-backed-sync-iterable-byte-batches');
  assert.equal(report.summary.publicBaselineThroughputMiBPerSec, 132.56);
  assert.equal(report.summary.candidateThroughputMiBPerSec, 131.83);
  assert.ok(report.findings.some(finding =>
    finding.id === 'numeric-only-accessor-not-headroom'
    && finding.classification === 'NEGATIVE_RESULT'
  ));

  const markdown = readFileSync(mdPath, 'utf8');
  assert.match(markdown, /# Attribute Value Index Accessor Candidate/);
  assert.match(markdown, /Retained in source: no/);
  assert.match(markdown, /NEGATIVE_RESULT/);
  assert.match(markdown, /not a JavaScript runtime ceiling proof/);
});
