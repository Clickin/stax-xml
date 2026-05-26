import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'woodstox-hotspot-trace-report-test.json');
const mdOut = join(tmpDir, 'woodstox-hotspot-trace-report-test.md');
const rawOut = join(tmpDir, 'woodstox-hotspot-trace-report-test.log');

test('Woodstox HotSpot trace report records inlining facts without claiming allocation proof', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut, rawOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'woodstox-hotspot-trace.mjs'),
    '--self-test',
    '--json-out',
    jsonOut,
    '--md-out',
    mdOut,
    '--raw-out',
    rawOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
  assert.equal(report.objective, 'woodstox-hotspot-trace');
  assert.equal(report.contract, 'hotspot-printcompilation-printinlining');
  assert.equal(report.rawArtifact.committed, false);
  assert.equal(report.benchmark.eventCount, 276);
  assert.equal(report.benchmark.checksum, 812383466);
  assert.equal(report.benchmark.shapeStats.elementLocalNameReadCount, 92);
  assert.equal(report.benchmark.shapeStats.attributeValueReadCount, 92);
  assert.equal(report.benchmark.shapeStats.textReadCount, 46);
  assert.ok(report.analysis.hasPrintInliningEvidence);
  assert.ok(report.analysis.keyCounts.consume > 0);
  assert.ok(report.analysis.keyCounts.getLocalName > 0);
  assert.ok(report.analysis.keyCounts.getAttributeValue > 0);
  assert.ok(report.findings.some(entry => entry.id === 'woodstox-accessor-shape-counters'));
  assert.ok(report.findings.some(entry => entry.id === 'allocation-still-missing'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Woodstox HotSpot Trace/);
  assert.match(markdown, /TRACE_FACT/);
  assert.match(markdown, /PrintCompilation/);
  assert.match(markdown, /PrintInlining/);
  assert.match(markdown, /Comparator Shape Counters/);
  assert.match(markdown, /Attribute value reads/);
  assert.match(markdown, /not an allocation profile/);
});
