import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'file-backed-materialization-profile-report-test');
const jsonOut = join(tmpDir, 'file-backed-materialization-profile.json');
const mdOut = join(tmpDir, 'file-backed-materialization-profile.md');

test('file-backed materialization profile records deterministic full-string work counters', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'file-backed-materialization-profile.mjs'),
    '--file',
    join(__dirname, 'test-data', 'runtime-comparison-16mib.xml'),
    '--chunk-kib',
    '32',
    '--batch-size',
    '4',
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
  assert.match(result.stdout, /file-backed-materialization-profile:/);

  const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
  assert.equal(report.objective, 'file-backed-materialization-profile');
  assert.equal(report.contract, 'same-file-backed-raw-frame-name-id-full-string-checksum');
  assert.equal(report.sourceContract.parserInput, 'StreamReaderSync over a synchronous Iterable<Uint8Array[]>');
  assert.equal(report.sourceContract.sourceMode, 'file-backed-sync-iterable-byte-batches');
  assert.equal(report.sourceContract.chunkBytes, 32 * 1024);
  assert.equal(report.sourceContract.batchSize, 4);
  assert.equal(report.sourceContract.preMaterializesFullXml, false);
  assert.equal(report.sourceContract.directReadableStream, false);
  assert.equal(report.sourceContract.nativeAddon, false);
  assert.equal(report.sourceContract.nodeBufferStringDecode, false);
  assert.equal(report.result.eventCount, 967967);
  assert.equal(report.result.checksum, -746772258);
  assert.equal(report.result.fullStringParity, true);
  assert.equal(report.eventShape.startElements, 341635);
  assert.equal(report.eventShape.endElements, 341635);
  assert.equal(report.eventShape.textEvents, 284695);
  assert.equal(report.eventShape.attributePairs, 284695);
  assert.equal(report.materialization.decodeSpanCalls.byKind.name, 10);
  assert.equal(report.materialization.decodeSpanCalls.byKind.text, 284695);
  assert.equal(report.materialization.decodeSpanCalls.byKind.attrValue, 284695);
  assert.equal(report.materialization.textDecoderCalls.byKind.name, 0);
  assert.equal(report.materialization.textDecoderCalls.byKind.attrValue, 0);
  assert.equal(report.materialization.textDecoderCalls.byKind.text, 113878);
  assert.equal(report.materialization.textDecoderCalls.nonNameShare, 1);
  assert.equal(report.materialization.nameCache.misses, 10);
  assert.equal(report.materialization.nameCache.uniqueNames, 10);
  assert.equal(report.materialization.nameCache.hits, 967955);
  assert.equal(report.materialization.textTrim.calls, 284695);
  assert.ok(report.findings.some(finding => finding.id === 'non-name-strings-dominate-decoder-work'));
  assert.ok(report.findings.some(finding => finding.id === 'not-runtime-ceiling-proof'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# File-Backed Materialization Profile/);
  assert.match(markdown, /Parser input: StreamReaderSync over a synchronous Iterable<Uint8Array\[\]>/);
  assert.match(markdown, /Node Buffer string decode: no/);
  assert.match(markdown, /Non-name TextDecoder share: 100\.00%/);
  assert.match(markdown, /non-name-strings-dominate-decoder-work \(HEADROOM_EVIDENCE\)/);
  assert.match(markdown, /not-runtime-ceiling-proof \(TRACE_FACT_LIMIT\)/);
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
