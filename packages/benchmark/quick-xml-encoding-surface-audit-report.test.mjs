import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'quick-xml-encoding-surface-audit-test');
const jsonOut = join(tmpDir, 'quick-xml-encoding-surface-audit.json');
const mdOut = join(tmpDir, 'quick-xml-encoding-surface-audit.md');

test('quick-xml encoding surface audit records current non-UTF-8 comparator boundary', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'quick-xml-encoding-surface-audit.mjs'),
    '--self-test',
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
  assert.equal(report.objective, 'quick-xml-encoding-surface-audit');
  assert.equal(report.contract, 'rust-quick-xml-comparator-encoding-surface');
  assert.equal(report.comparator.hasEncodingFeature, false);
  assert.equal(report.utf16Probe.status, 'rejected');
  assert.equal(report.utf16Probe.exitCode, 1);
  assert.match(report.utf16Probe.stderr, /UTF-8|utf-8/);
  assert.ok(report.findings.some(finding =>
    finding.id === 'quick-xml-current-feature-surface'
    && finding.classification === 'SOURCE_FACT'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'quick-xml-utf16-probe-rejected'
    && finding.classification === 'NEGATIVE_RESULT'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'encoding-surface-scope'
    && finding.classification === 'SCOPE_GUARD'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /quick-xml Encoding Surface Audit/);
  assert.match(markdown, /quick-xml encoding feature active: no/);
  assert.match(markdown, /Status: rejected/);
  assert.match(markdown, /UTF-16 XML probe is rejected/);
  assert.match(markdown, /Do not treat existing quick-xml allocation counters as non-UTF-8 evidence/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
}
