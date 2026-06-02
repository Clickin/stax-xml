import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'text-materialization-boundary-audit-report-test.json');
const mdOut = join(tmpDir, 'text-materialization-boundary-audit-report-test.md');

test('text materialization boundary audit separates partial headroom from full-string counterexamples', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'text-materialization-boundary-audit.mjs'),
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
  assert.equal(report.objective, 'text-materialization-boundary-audit');
  assert.equal(report.contract, 'text-cdata-materialization-headroom-is-not-full-string-counterexample');
  assert.equal(report.summary.status, 'classified');
  assert.equal(report.summary.conclusionAllowed, false);
  assert.equal(report.inputs.frontierArtifact, 'text-materialization-frontier.json');
  assert.equal(report.summary.targetMiBPerSec, 200);

  assert.deepEqual(report.summary.fastestFull, {
    id: 'rawFrameNameId',
    sourceArtifact: 'text-trim-cost-decomposition.json',
    rateMiBPerSec: 185.5,
    boundedMemory: true,
    fullStringParity: true,
    textStringReads: 16987392,
    stringFieldReads: 62758976,
  });
  assert.deepEqual(report.summary.fastestWithoutText, {
    id: 'withoutTextStrings',
    sourceArtifact: 'text-trim-cost-decomposition-4gib.json',
    rateMiBPerSec: 252.36,
    boundedMemory: true,
    fullStringParity: false,
    textStringReads: 0,
    stringFieldReads: 183085948,
  });
  assert.equal(report.summary.fastestNoTrim.id, 'rawFrameNameIdNoTrim');
  assert.equal(report.summary.fastestNoTrim.rateMiBPerSec, 186.97);
  assert.equal(report.summary.fastestNoTrim.boundedMemory, true);
  assert.equal(report.summary.fastestNoTrim.fullStringParity, false);
  assert.equal(report.summary.fastestFoldTrim.id, 'rawFrameNameIdFoldTrim');
  assert.equal(report.summary.fastestFoldTrim.rateMiBPerSec, 148.58);
  assert.equal(report.summary.fastestFoldTrim.boundedMemory, true);
  assert.equal(report.summary.fastestFoldTrim.fullStringParity, true);
  assert.equal(report.summary.fastestFullToTargetRatio, 0.93);
  assert.equal(report.summary.fastestFullRemainingMiBPerSec, 14.5);
  assert.equal(report.summary.requiredSpeedupToTarget, 1.08);
  assert.equal(report.summary.fastestWithoutTextToFullRatio, 1.36);
  assert.equal(report.summary.fastestNoTrimToFullRatio, 1.01);
  assert.equal(report.summary.fastestFoldTrimToFullRatio, 0.8);
  assert.equal(report.summary.noTextRowsCrossTarget, 4);
  assert.equal(report.summary.fullRowsCrossTarget, 0);
  assert.equal(report.summary.noTrimRowsCrossTarget, 0);
  assert.equal(report.summary.foldTrimRowsCrossTarget, 0);
  assert.equal(report.summary.negativeCandidateCount, 35);
  assert.match(report.interpretation, /Text\/CDATA omission crosses the target as headroom evidence/);
  assert.ok(report.findings.some(entry => entry.id === 'full-string-target-not-crossed'));
  assert.ok(report.findings.some(entry => entry.id === 'without-text-is-partial-headroom'));
  assert.ok(report.findings.some(entry => entry.id === 'trim-only-not-counterexample'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Text Materialization Boundary Audit/);
  assert.match(markdown, /Target: 200\.00 MiB\/s/);
  assert.match(markdown, /Fastest full-string row: `rawFrameNameId` 185\.50 MiB\/s from `text-trim-cost-decomposition\.json` \(boundedMemory=true, fullStringParity=true, textStringReads=16987392, stringFieldReads=62758976\)/);
  assert.match(markdown, /Fastest without-text row: `withoutTextStrings` 252\.36 MiB\/s from `text-trim-cost-decomposition-4gib\.json` \(boundedMemory=true, fullStringParity=false, textStringReads=0, stringFieldReads=183085948\)/);
  assert.match(markdown, /Fastest no-trim row: `rawFrameNameIdNoTrim` 186\.97 MiB\/s from `text-trim-cost-decomposition-8gib\.json` \(boundedMemory=true, fullStringParity=false, textStringReads=135898776, stringFieldReads=502070478\)/);
  assert.match(markdown, /Fastest fold-trim row: `rawFrameNameIdFoldTrim` 148\.58 MiB\/s from `text-trim-cost-decomposition-2gib\.json` \(boundedMemory=true, fullStringParity=true, textStringReads=33974712, stringFieldReads=125517686\)/);
  assert.match(markdown, /Full-string remaining to target: 14\.50 MiB\/s/);
  assert.match(markdown, /Required full-string speedup: 1\.08x/);
  assert.match(markdown, /Full-string rows crossing target: 0/);
  assert.match(markdown, /Without-text rows crossing target: 4/);
  assert.match(markdown, /No-trim rows crossing target: 0/);
  assert.match(markdown, /Fold-trim rows crossing target: 0/);
  assert.match(markdown, /Text\/CDATA omission crosses the target in 4 rows but is not full-string parity/);
});
