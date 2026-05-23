import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'quick-xml-shape-audit-report-test.json');
const mdOut = join(tmpDir, 'quick-xml-shape-audit-report-test.md');

test('quick-xml shape audit records source facts without claiming allocation proof', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'quick-xml-shape-audit.mjs'),
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
  assert.equal(report.objective, 'quick-xml-shape-audit');
  assert.equal(report.contract, 'source-shape-audit');
  assert.equal(report.checks.allSupported, true);
  assert.ok(report.findings.some(entry => entry.id === 'not-js-object-shape'));
  assert.ok(report.findings.some(entry => entry.id === 'attribute-vector-materialization'));
  assert.ok(report.findings.some(entry => entry.id === 'allocation-not-covered-by-source-audit'));
  assert.equal(report.baseline.quickXml.eventCount, 967967);
  assert.equal(report.baseline.quickXml.checksum, -746772258);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# quick-xml Shape Audit/);
  assert.match(markdown, /SOURCE_FACT/);
  assert.match(markdown, /Cow<str>/);
  assert.match(markdown, /not an allocation profile/);
  assert.match(markdown, /quick-xml-allocation-count\.md/);
  assert.match(markdown, /not-js-object-shape/);
});
