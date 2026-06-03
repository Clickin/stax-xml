import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'firefox-spidermonkey-jsshell-stax-api-gap-audit-test');
const jsonOut = join(tmpDir, 'firefox-spidermonkey-jsshell-stax-api-gap-audit.json');
const mdOut = join(tmpDir, 'firefox-spidermonkey-jsshell-stax-api-gap-audit.md');

test('Firefox SpiderMonkey js-shell StAX API gap audit pins unchanged harness blockers', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-spidermonkey-jsshell-stax-api-gap-audit.mjs'),
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
  assert.equal(report.objective, 'firefox-spidermonkey-jsshell-stax-api-gap-audit');
  assert.equal(report.contract, 'spidermonkey-jsshell-current-stax-full-string-api-surface-gap');
  assert.equal(report.summary.status, 'blocked-by-host-api-surface');
  assert.equal(report.summary.shellCount, 2);
  assert.equal(report.summary.availableShellCount, 2);
  assert.equal(report.summary.jitStatusShellCount, 2);
  assert.equal(report.summary.binaryReadableShellCount, 2);
  assert.equal(report.summary.unchangedRunnableShellCount, 0);
  assert.deepEqual(report.summary.commonMissingGlobals, [
    'TextEncoder',
    'ReadableStream',
    'fetch',
  ]);
  assert.deepEqual(report.summary.unchangedHarnessMissingGlobals, [
    'TextEncoder',
    'ReadableStream',
    'fetch',
  ]);
  assert.equal(report.summary.unchangedHarnessMissingGlobalCount, 3);
  assert.deepEqual(report.summary.primarySyncByteBatchMissingGlobals, []);
  assert.equal(report.summary.primarySyncByteBatchMissingGlobalCount, 0);
  assert.equal(report.summary.primaryPathRunnableWithoutHostEncoding, true);
  assert.deepEqual(report.summary.nonPrimaryHarnessMissingGlobals, [
    'TextEncoder',
    'ReadableStream',
    'fetch',
  ]);
  assert.equal(report.summary.nonPrimaryHarnessMissingGlobalCount, 3);
  assert.equal(report.summary.blockedSurfaceCount, 3);
  assert.equal(report.summary.directUnchangedHarnessAttemptCount, 10);
  assert.equal(report.summary.blockedDirectUnchangedHarnessAttemptCount, 6);
  assert.equal(report.summary.runnableDirectUnchangedHarnessAttemptCount, 4);
  assert.equal(report.summary.canCloseEmittedIrObligation, false);
  assert.equal(report.summary.conclusionAllowed, false);
  assert.deepEqual(report.requiredSurfaces.map(surface => surface.id), [
    'sync-byte-batch-full-string',
    'sync-corpus-byte-batch-full-string',
    'async-byte-batch-full-string',
    'readable-stream-full-string',
    'browser-fetch-live-source',
  ]);
  assert.equal(report.blockedSurfaces.find(surface => surface.id === 'sync-byte-batch-full-string').blockedShellCount, 2);
  assert.equal(report.blockedSurfaces.find(surface => surface.id === 'sync-corpus-byte-batch-full-string').blockedShellCount, 0);
  assert.equal(report.blockedSurfaces.find(surface => surface.id === 'async-byte-batch-full-string').blockedShellCount, 0);
  assert.equal(report.blockedSurfaces.find(surface => surface.id === 'readable-stream-full-string').blockedShellCount, 2);
  assert.equal(report.blockedSurfaces.find(surface => surface.id === 'browser-fetch-live-source').blockedShellCount, 2);
  assert.equal(report.directUnchangedHarnessAttempts.length, 10);
  assert.equal(report.directUnchangedHarnessAttempts.filter(attempt => attempt.status === 'blocked-before-stax-load').length, 6);
  assert.equal(report.directUnchangedHarnessAttempts.filter(attempt => attempt.status === 'runnable-prerequisites-present').length, 4);
  assert.ok(report.directUnchangedHarnessAttempts.every(attempt => attempt.unchangedHarnessSurface === true));
  assert.deepEqual(
    report.directUnchangedHarnessAttempts.find(attempt =>
      attempt.packageKind === 'release'
      && attempt.surfaceId === 'sync-corpus-byte-batch-full-string'
    ).missingGlobals,
    [],
  );
  assert.equal(
    report.directUnchangedHarnessAttempts.find(attempt =>
      attempt.packageKind === 'nightly'
      && attempt.surfaceId === 'browser-fetch-live-source'
    ).firstBlockingGlobal,
    'ReadableStream',
  );
  assert.deepEqual(
    report.blockedSurfaces.find(surface => surface.id === 'sync-byte-batch-full-string').shellBlockers[0].missingGlobals,
    ['TextEncoder'],
  );
  assert.deepEqual(
    report.blockedSurfaces.find(surface => surface.id === 'sync-corpus-byte-batch-full-string').shellBlockers[0].missingGlobals,
    [],
  );
  assert.deepEqual(
    report.blockedSurfaces.find(surface => surface.id === 'async-byte-batch-full-string').shellBlockers[0].missingGlobals,
    [],
  );
  assert.deepEqual(
    report.blockedSurfaces.find(surface => surface.id === 'readable-stream-full-string').shellBlockers[0].missingGlobals,
    ['ReadableStream'],
  );
  assert.deepEqual(
    report.blockedSurfaces.find(surface => surface.id === 'browser-fetch-live-source').shellBlockers[0].missingGlobals,
    ['ReadableStream', 'fetch'],
  );
  assert.equal(report.shells.length, 2);
  assert.ok(report.shells.every(shell =>
    shell.status === 'available'
    && shell.hasJitExecutionStatus === true
    && shell.canReadBinaryInput === true
    && shell.canRunCurrentStaxFullStringBenchmark === false
    && shell.apiSurface.Uint8Array === 'function'
    && shell.apiSurface.TextEncoder === 'undefined'
    && shell.apiSurface.ReadableStream === 'undefined'
    && shell.apiSurface.fetch === 'undefined'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'spidermonkey-jsshell-api-gap'
    && finding.classification === 'NEGATIVE_RESULT'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'spidermonkey-jsshell-api-gap-scope'
    && finding.classification === 'SCOPE_GUARD'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /Firefox\/SpiderMonkey JS Shell StAX API Gap Audit/);
  assert.match(markdown, /Status: blocked-by-host-api-surface/);
  assert.match(markdown, /Unchanged harness missing globals: TextEncoder, ReadableStream, fetch/);
  assert.match(markdown, /Primary sync byte-batch missing globals: none/);
  assert.match(markdown, /Primary sync byte-batch runnable without host encoding globals: yes/);
  assert.match(markdown, /Non-primary harness missing globals: TextEncoder, ReadableStream, fetch/);
  assert.match(markdown, /Blocked current StAX surfaces: 3\/5/);
  assert.match(markdown, /Direct unchanged harness attempts blocked before StAX load: 6\/10/);
  assert.match(markdown, /Unchanged current StAX full-string runnable shells: 0/);
  assert.match(markdown, /\| release \| JavaScript-C143\.0\.1 \| yes \| ok \| TextEncoder, ReadableStream, fetch \| no \|/);
  assert.match(markdown, /\| nightly \| JavaScript-C153\.0a1 \| yes \| ok \| TextEncoder, ReadableStream, fetch \| no \|/);
  assert.match(markdown, /## Blocked StAX Surfaces/);
  assert.match(markdown, /## Direct Unchanged Harness Attempts/);
  assert.match(markdown, /\| release \| sync-corpus-byte-batch-full-string \| runnable-prerequisites-present \| none \| none \|/);
  assert.match(markdown, /\| nightly \| browser-fetch-live-source \| blocked-before-stax-load \| ReadableStream \| ReadableStream, fetch \|/);
  assert.match(markdown, /\| StreamReaderSync generated-fixture Iterable<Uint8Array\[\]> full-string rows \| Generated-fixture same-contract StAX rows over synchronous byte batches\. \| Uint8Array, TextEncoder \| 2\/2 \| TextEncoder \|/);
  assert.match(markdown, /\| StreamReaderSync corpus-file Iterable<Uint8Array\[\]> full-string rows \| Corpus-file same-contract StAX rows over synchronous byte batches\. \| Uint8Array \| 0\/2 \| none \|/);
  assert.match(markdown, /\| createEventReaderFromAsyncByteBatches full-string rows \| Async byte-batch public event rows without direct ReadableStream consumption\. \| Uint8Array \| 0\/2 \| none \|/);
  assert.match(markdown, /\| EventReader ReadableStream<Uint8Array> full-string rows \| Direct Web ReadableStream source-overhead rows\. \| Uint8Array, ReadableStream \| 2\/2 \| ReadableStream \|/);
  assert.match(markdown, /\| browser fetch live-source rows \| Live fetch Response\.body rows such as fetchReadableStreamFull and fetchAsyncByteBatchFull\. \| Uint8Array, ReadableStream, fetch \| 2\/2 \| ReadableStream, fetch \|/);
  assert.match(markdown, /blockedSurfaces=3\/5/);
  assert.match(markdown, /unchangedHarnessMissingGlobals=TextEncoder, ReadableStream, fetch/);
  assert.match(markdown, /primarySyncByteBatchMissingGlobals=none/);
  assert.match(markdown, /primaryPathRunnableWithoutHostEncoding=true/);
  assert.match(markdown, /nonPrimaryHarnessMissingGlobals=TextEncoder, ReadableStream, fetch/);
  assert.match(markdown, /directUnchangedHarnessAttemptsBlocked=6\/10/);
  assert.match(markdown, /UTF-8 primary byte-batch StAX materialization requires only Uint8Array host support/);
  assert.match(markdown, /not a SpiderMonkey throughput limit or emitted-code proof/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
}
