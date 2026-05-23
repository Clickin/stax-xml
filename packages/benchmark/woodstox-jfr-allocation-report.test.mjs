import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'woodstox-jfr-allocation-report-test.json');
const mdOut = join(tmpDir, 'woodstox-jfr-allocation-report-test.md');
const rawJfrOut = join(tmpDir, 'woodstox-jfr-allocation-report-test.jfr');
const rawEventsJsonOut = join(tmpDir, 'woodstox-jfr-allocation-report-test-events.json');
const measuredJsonOut = join(tmpDir, 'woodstox-measured-jfr-allocation-report-test.json');
const measuredMdOut = join(tmpDir, 'woodstox-measured-jfr-allocation-report-test.md');

test('Woodstox JFR allocation report records sampled allocation facts without claiming a census', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut, rawJfrOut, rawEventsJsonOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'woodstox-jfr-allocation.mjs'),
    '--self-test',
    '--json-out',
    jsonOut,
    '--md-out',
    mdOut,
    '--raw-jfr-out',
    rawJfrOut,
    '--raw-events-json-out',
    rawEventsJsonOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
  assert.equal(report.objective, 'woodstox-jfr-allocation');
  assert.equal(report.contract, 'jfr-allocation-sampling');
  assert.equal(report.rawArtifacts.jfr.committed, false);
  assert.equal(report.rawArtifacts.allocationEventsJson.committed, false);
  assert.equal(report.benchmark.eventCount, 276);
  assert.equal(report.benchmark.checksum, 812383466);
  assert.equal(report.jfrSummary.allocationEventCounts.ObjectAllocationInNewTLAB, 4);
  assert.equal(report.allocation.eventCount, 4);
  assert.equal(report.allocation.consumeStackEventCount, 3);
  assert.equal(report.allocation.stringBoundaryEventCount, 2);
  assert.ok(report.allocation.topConsumeClasses.some(entry => entry.objectClass === 'char[]'));
  assert.ok(report.allocation.topConsumeClasses.some(entry => entry.objectClass === 'java.lang.String'));
  assert.ok(report.findings.some(entry => entry.id === 'string-materialization-stack-visible'));
  assert.ok(report.findings.some(entry => entry.id === 'not-deterministic-census'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Woodstox JFR Allocation Sampling/);
  assert.match(markdown, /TRACE_FACT/);
  assert.match(markdown, /ObjectAllocationInNewTLAB/);
  assert.match(markdown, /sampled process-level evidence/);
  assert.match(markdown, /not a deterministic allocation census/);
  assert.match(markdown, /TextBuffer::contentsAsString/);
  assert.match(markdown, /BasicStreamReader::getAttributeValue/);
});

test('Woodstox measured-run JFR allocation report records the narrower recording boundary', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [measuredJsonOut, measuredMdOut, rawJfrOut, rawEventsJsonOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'woodstox-jfr-allocation.mjs'),
    '--self-test',
    '--recording-mode',
    'measured',
    '--json-out',
    measuredJsonOut,
    '--md-out',
    measuredMdOut,
    '--raw-jfr-out',
    rawJfrOut,
    '--raw-events-json-out',
    rawEventsJsonOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(measuredJsonOut, 'utf8'));
  assert.equal(report.objective, 'woodstox-measured-jfr-allocation');
  assert.equal(report.contract, 'jfr-measured-allocation-sampling');
  assert.equal(report.options.recordingMode, 'measured');
  assert.equal(report.allocation.consumeStackEventCount, 3);
  assert.equal(report.allocation.stringBoundaryEventCount, 2);
  assert.ok(report.findings.some(entry => entry.evidence.some(line => /after warmups/.test(line))));

  const markdown = readFileSync(measuredMdOut, 'utf8');
  assert.match(markdown, /# Woodstox Measured-Run JFR Allocation Sampling/);
  assert.match(markdown, /Recording mode: measured/);
  assert.match(markdown, /measured-run sampled evidence/);
  assert.match(markdown, /not a deterministic allocation census/);
});
