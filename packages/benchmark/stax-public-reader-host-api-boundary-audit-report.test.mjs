import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'stax-public-reader-host-api-boundary-audit');
const jsonOut = join(tmpDir, 'stax-public-reader-host-api-boundary-audit.json');
const mdOut = join(tmpDir, 'stax-public-reader-host-api-boundary-audit.md');

function resetTmp() {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
  mkdirSync(tmpDir, { recursive: true });
}

test('stax public reader host API boundary audit pins current TextDecoder surface', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'stax-public-reader-host-api-boundary-audit.mjs'),
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
  assert.equal(report.objective, 'stax-public-reader-host-api-boundary-audit');
  assert.equal(report.contract, 'current-stax-public-reader-host-api-boundary');
  assert.equal(report.summary.allChecksPass, true);
  assert.equal(report.summary.primarySyncByteBatchRequiresTextDecoder, true);
  assert.equal(report.summary.directReadableStreamRequiresReadableStream, true);
  assert.equal(report.summary.stringInputRequiresTextEncoder, true);
  assert.equal(report.summary.rootImportRequiresTextEncoder, false);
  assert.equal(report.summary.alternateDecoderWouldBeUnchangedClosure, false);
  assert.deepEqual(report.summary.primarySyncByteBatchRequiredGlobals, ['Uint8Array', 'TextDecoder']);
  assert.deepEqual(report.summary.directReadableStreamRequiredGlobals, ['Uint8Array', 'TextDecoder', 'ReadableStream']);
  assert.deepEqual(report.summary.stringInputRequiredGlobals, ['TextEncoder', 'TextDecoder']);
  assert.deepEqual(report.summary.rootImportRequiredGlobals, []);
  assert.ok(report.checks.every(check => check.matched));
  assert.ok(report.checks.some(check => check.id === 'iterable-reader-decodes-non-ascii-spans'));
  assert.ok(report.checks.some(check => check.id === 'stream-batch-public-accessors-call-copy-methods'));
  assert.ok(report.checks.some(check => check.id === 'root-import-no-top-level-textencoder'));
  assert.ok(report.findings.some(finding =>
    finding.id === 'stax-primary-sync-byte-batch-textdecoder-boundary'
    && finding.classification === 'SOURCE_FACT'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'stax-host-api-substitution-scope-guard'
    && finding.classification === 'SCOPE_GUARD'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'stax-root-import-textencoder-not-primary-blocker'
    && finding.classification === 'SOURCE_FACT'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# StAX Public Reader Host API Boundary Audit/);
  assert.match(markdown, /Primary sync byte-batch requires TextDecoder: true/);
  assert.match(markdown, /Direct ReadableStream requires ReadableStream: true/);
  assert.match(markdown, /Root import requires TextEncoder: false/);
  assert.match(markdown, /Alternate decoder is unchanged closure: false/);
  assert.match(markdown, /iterable-reader-decodes-non-ascii-spans/);
  assert.match(markdown, /stream-batch-public-accessors-call-copy-methods/);
  assert.match(markdown, /root-import-no-top-level-textencoder/);
});
