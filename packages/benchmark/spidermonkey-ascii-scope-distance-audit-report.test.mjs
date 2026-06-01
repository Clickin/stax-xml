import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('SpiderMonkey ASCII scope distance audit narrows materialized js-shell equivalence without closing codegen', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'stax-spidermonkey-ascii-audit-'));
  const jsonOut = join(tmp, 'audit.json');
  const mdOut = join(tmp, 'audit.md');
  try {
    const result = spawnSync(process.execPath, [
      join(__dirname, 'spidermonkey-ascii-scope-distance-audit.mjs'),
      '--self-test',
      '--json-out',
      jsonOut,
      '--md-out',
      mdOut,
    ], {
      cwd: join(__dirname, '..', '..'),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.ok(existsSync(jsonOut));
    assert.ok(existsSync(mdOut));
    const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
    assert.equal(report.objective, 'spidermonkey-ascii-scope-distance-audit');
    assert.equal(report.summary.corpusFileCount, 2);
    assert.equal(report.summary.allCorpusFilesAscii, false);
    assert.equal(report.summary.materializedCorpusSeedAscii, true);
    assert.equal(report.summary.closesCodegenObligation, false);
    assert.ok(report.corpusRows.some(row =>
      row.basename === 'ascii.xml'
      && row.nonAsciiByteCount === 0
      && row.asciiByteToStringEquivalentToUtf8 === true
    ));
    assert.ok(report.corpusRows.some(row =>
      row.basename === 'non-ascii.xml'
      && row.nonAsciiByteCount > 0
      && row.asciiByteToStringEquivalentToUtf8 === false
    ));
    assert.ok(report.findings.some(finding =>
      finding.id === 'spidermonkey-materialized-ascii-utf8-equivalence'
      && finding.classification === 'SOURCE_FACT'
    ));
    const markdown = readFileSync(mdOut, 'utf8');
    assert.match(markdown, /Closes emitted-code obligation: no/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
