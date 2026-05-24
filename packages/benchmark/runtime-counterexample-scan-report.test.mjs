import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'runtime-counterexample-scan-report-test');
const jsonOut = join(tmpDir, 'runtime-counterexample-scan.json');
const mdOut = join(tmpDir, 'runtime-counterexample-scan.md');

test('runtime counterexample scan applies the broad 200 MiB/s rule mechanically', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-counterexample-scan.mjs'),
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
  assert.equal(report.objective, 'runtime-counterexample-scan');
  assert.equal(report.contract, 'release-json-recognized-row-counterexample-search');
  assert.equal(report.summary.counterexampleCount, 0);
  assert.equal(report.summary.conclusionAllowed, false);
  assert.equal(report.summary.parseErrorCount, 0);
  assert.equal(report.summary.scannedArtifactCount, 62);
  assert.equal(report.summary.measuredRowCount, 353);
  assert.equal(report.summary.largeJsFullRowCount, 150);
  assert.ok(report.summary.partialHeadroomRowCount >= 1);
  assert.ok(report.summary.unboundedOrUnknownLargeFullRowCount >= 1);
  assert.equal(report.summary.fastestLargeFullRowWithMemoryProof.hasMemoryProof, true);
  assert.equal(report.summary.fastestLargeFullRowWithMemoryProof.boundedMemory, true);
  assert.ok(report.summary.fastestLargeFullRowWithMemoryProof.mibPerSec < 200);
  assert.equal(report.summary.fastestPartialHeadroomRow.fullStringParity, false);
  assert.ok(report.summary.fastestPartialHeadroomRow.mibPerSec >= 200);
  assert.ok(report.ignoredArtifacts.includes('runtime-limit-proof-obligation-gate.json'));
  assert.ok(report.ignoredArtifacts.includes('same-contract-runtime-comparison.json'));
  assert.ok(report.partialHeadroomRows.some(row =>
    row.sourceArtifact === 'bun-candidate-headroom-projection-large.json'
    && row.id === 'scanAllNoDecode'
    && row.fullStringParity === false
  ));
  assert.ok(report.fastestLargeFullRows.some(row =>
    row.hasMemoryProof === false
    && row.boundedMemory === true
  ));
  assert.ok(report.unboundedOrUnknownLargeFullRows.some(row =>
    row.sourceArtifact === 'firefox-bidi-candidate-headroom-corpus.json'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 48.15
    && row.memoryKind === 'recorded-unknown-kind'
    && row.boundedMemory === false
  ));
  assert.ok(report.unboundedOrUnknownLargeFullRows.some(row =>
    row.sourceArtifact === 'firefox-bidi-candidate-headroom-projection.json'
    && row.id === 'rawFrameNameId'
    && row.mibPerSec === 64.24
    && row.memoryKind === 'recorded-unknown-kind'
    && row.boundedMemory === false
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Runtime Counterexample Scan/);
  assert.match(markdown, /Counterexamples found: 0/);
  assert.match(markdown, /Fastest 1 GiB\+ Full-String JS Rows With Memory Proof/);
  assert.match(markdown, /flag-only/);
  assert.match(markdown, /not full-string StAX counterexamples/);
  assert.match(markdown, /row-level memory evidence/);
  assert.match(markdown, /not an impossibility proof/);
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
