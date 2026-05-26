import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'raw-span-shape-audit-report-test');
const jsonOut = join(tmpDir, 'raw-span-shape-audit.json');
const mdOut = join(tmpDir, 'raw-span-shape-audit.md');

test('raw span shape audit records corpus-cycle span buckets without throughput rows', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'raw-span-shape-audit.mjs'),
    '--size-gib',
    '0.001',
    '--corpus-file',
    join(__dirname, 'assets', 'books.xml'),
    '--batch-size',
    '1',
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
  assert.equal(report.objective, 'raw-span-shape-audit');
  assert.equal(report.contract, 'raw-frame-span-length-and-ascii-distribution');
  assert.equal(report.fixture.shape, 'corpus-cycle');
  assert.equal(report.fixture.batchSize, 1);
  assert.equal(report.sourceConsumption.parserInput, 'synchronous Iterable<Uint8Array[]>');
  assert.equal(report.sourceConsumption.directReadableStream, false);
  assert.equal(report.summary.eventCount, 57114);
  assert.equal(report.summary.totalMaterializedStringSpans, 62776);
  assert.equal(report.summary.explicitAttrValueMediumAsciiCount, 0);
  assert.equal(report.summary.textMediumAsciiCount, 2832);
  assert.equal(report.summary.textLongOrNonAsciiCount, 3540);
  assert.equal(report.spans.attrValueExplicit.count, 2832);
  assert.equal(report.spans.attrValueExplicit.shortAsciiCount, 2832);
  assert.equal(report.spans.attrValueExplicit.mediumAsciiCount, 0);
  assert.equal(report.spans.attrValueExplicit.maxBytes, 5);
  assert.equal(report.spans.text.count, 16992);
  assert.equal(report.spans.text.mediumAsciiCount, 2832);
  assert.equal(report.spans.text.longOrNonAsciiCount, 3540);
  assert.equal(report.spans.text.nonAsciiCount, 0);
  assert.ok(!JSON.stringify(report).includes('"mibPerSec"'));
  assert.ok(report.findings.some(finding =>
    finding.id === 'attr-value-medium-ascii-pocket-absent'
    && finding.classification === 'NEGATIVE_RESULT'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'source-shape-separated-from-stream-overhead'
    && finding.classification === 'SCOPE_GUARD'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Raw Span Shape Audit/);
  assert.match(markdown, /Parser input: synchronous Iterable<Uint8Array\[\]>/);
  assert.match(markdown, /Direct ReadableStream: no/);
  assert.match(markdown, /Explicit attr-value medium ASCII spans: 0/);
  assert.match(markdown, /Text\/CDATA medium ASCII spans: 2,832/);
  assert.match(markdown, /attr-value-medium-ascii-pocket-absent/);
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
