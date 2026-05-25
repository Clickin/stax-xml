import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(__dirname, 'results', 'release', 'attribute-value-branch-order-candidate.json');
const mdPath = join(__dirname, 'results', 'release', 'attribute-value-branch-order-candidate.md');

test('attribute value branch-order candidate is recorded as a rejected probe', () => {
  const report = JSON.parse(readFileSync(jsonPath, 'utf8'));
  assert.equal(report.objective, 'attribute-value-branch-order-candidate');
  assert.equal(report.summary.classification, 'NEGATIVE_RESULT');
  assert.equal(report.summary.candidateRetained, false);
  assert.equal(report.summary.candidateCounterexamples200MiB, 0);
  assert.equal(report.candidateChange.retainedInSource, false);
  assert.equal(report.sourceContract.sourceMode, 'file-backed-sync-iterable-byte-batches');
  assert.equal(report.baselineArtifactBeforeCandidate.rows[0].throughputMiBPerSec, 130.37);
  assert.equal(report.candidateMeasurement.rows[0].throughputMiBPerSec, 125.95);
  assert.ok(report.findings.some(finding =>
    finding.id === 'branch-order-not-headroom'
    && finding.classification === 'NEGATIVE_RESULT'
  ));

  const markdown = readFileSync(mdPath, 'utf8');
  assert.match(markdown, /# Attribute Value Branch Order Candidate/);
  assert.match(markdown, /Retained in source: no/);
  assert.match(markdown, /NEGATIVE_RESULT/);
  assert.match(markdown, /not a JavaScript runtime ceiling proof/);
});
