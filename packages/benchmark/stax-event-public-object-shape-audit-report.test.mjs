import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'stax-event-public-object-shape-audit-report-test');
const jsonOut = join(tmpDir, 'stax-event-public-object-shape-audit.json');
const mdOut = join(tmpDir, 'stax-event-public-object-shape-audit.md');

test('stax-event public object audit separates source shape from 1 GiB file-backed comparator rows', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'stax-event-public-object-shape-audit.mjs'),
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
  assert.equal(report.objective, 'stax-event-public-object-shape-audit');
  assert.equal(report.contract, 'source-public-object-row-vs-file-backed-low-memory-scope');
  assert.equal(report.summary.sourcePublicObjectPathPresent, true);
  assert.equal(report.summary.releaseOneGiBRowPresent, false);
  assert.equal(report.summary.releaseOneGiBRowOmittedForLowMemoryComparison, true);
  assert.equal(report.sourceFacts.staxEventUsesFullUtf8StringInput, true);
  assert.equal(report.sourceFacts.staxEventUsesEventReaderSyncPublicObjects, true);
  assert.equal(report.sourceFacts.fileBackedStreamRowsUseByteBatches, true);
  assert.equal(report.materializationAudit.staxEventRuntimeShape, 'js-public-event-object');
  assert.equal(report.materializationAudit.staxEventPerEventPublicObject, true);
  assert.ok(report.findings.some(finding =>
    finding.id === 'not-file-backed-low-memory-row'
    && finding.classification === 'SCOPE_GUARD'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# StAX Event Public Object Shape Audit/);
  assert.match(markdown, /Public object source path present: yes/);
  assert.match(markdown, /1 GiB materialization audit row present: no/);
  assert.match(markdown, /full-string preload memory cost/);
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
