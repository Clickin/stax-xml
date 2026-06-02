import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'text-materialization-frontier-coverage-audit-report-test.json');
const mdOut = join(tmpDir, 'text-materialization-frontier-coverage-audit-report-test.md');

test('text materialization frontier coverage audit pins required negative candidate groups', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'text-materialization-frontier-coverage-audit.mjs'),
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
  assert.equal(report.objective, 'text-materialization-frontier-coverage-audit');
  assert.equal(report.contract, 'same-contract-materialization-negative-coverage');
  assert.equal(report.summary.status, 'classified');
  assert.equal(report.summary.requiredGroupCount, 8);
  assert.equal(report.summary.requiredCandidateCount, 11);
  assert.equal(report.summary.coveredCandidateCount, 11);
  assert.equal(report.summary.missingCandidateCount, 0);
  assert.equal(report.summary.coveredCandidatesCrossTarget, 0);
  assert.equal(report.summary.frontierNegativeCandidateCount, 38);
  assert.equal(report.summary.frontierFullParityNegativeCandidateCount, 34);
  assert.equal(report.summary.conclusionAllowed, false);

  const bun = report.requiredGroups.find(group => group.group === 'bun-cache-candidates-books-corpus');
  assert.ok(bun);
  assert.equal(bun.comparisonRowCount, 5);
  assert.deepEqual(bun.requiredCaseIds, [
    'rawFrameNameIdAttrValueCache',
    'rawFrameNameIdOffsetTextCache',
    'rawFrameNameIdUnrolledMediumAsciiText',
  ]);
  assert.ok(bun.candidates.every(candidate =>
    candidate.rowPresentInComparison === true
    && candidate.runtime?.id === 'bun-jsc'
    && candidate.fullStringParity === true
    && candidate.boundedMemory === true
    && candidate.coveredByFrontier === true
    && candidate.belowTarget === true
  ));

  assert.ok(report.findings.some(finding =>
    finding.id === 'required-materialization-candidates-covered'
    && finding.classification === 'SOURCE_FACT'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'covered-candidates-remain-below-target'
    && finding.classification === 'NEGATIVE_RESULT'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Text Materialization Frontier Coverage Audit/);
  assert.match(markdown, /Required candidates: 11/);
  assert.match(markdown, /Missing candidates: 0/);
  assert.match(markdown, /\| `bun-cache-candidates-books-corpus` \| 3 \| 3 \| 0 \|/);
});
