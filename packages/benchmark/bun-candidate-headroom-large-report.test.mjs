import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'bun-candidate-headroom-large-report-test.json');
const mdOut = join(tmpDir, 'bun-candidate-headroom-large-report-test.md');

function readBunVersion() {
  const result = spawnSync('bun', ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

test('bun large candidate headroom matrix records JSC bounded byte-batch rows', { skip: readBunVersion() ? false : 'bun is not installed' }, () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync('bun', [
    join(__dirname, 'candidate-headroom-large.mjs'),
    '--size-gib',
    '0.001',
    '--fixture-shape',
    'diverse-cycle',
    '--diverse-cycle-size',
    '64',
    '--runs',
    '1',
    '--warmups',
    '0',
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
  assert.equal(report.objective, 'candidate-headroom-large');
  assert.equal(report.contract, 'generated-byte-batch-mixed-materialization-headroom-matrix');
  assert.equal(report.environment.runtimeName, 'bun');
  assert.equal(report.environment.bunVersion, readBunVersion());
  assert.match(report.environment.webkitCommit, /^[0-9a-f]{40}$/);
  assert.equal(report.environment.javascriptEngine, 'JavaScriptCore');
  assert.equal(report.fixture.generated, true);
  assert.equal(report.fixture.shape, 'diverse-cycle');
  assert.equal(report.fixture.rowCycleSize, 64);
  assert.equal(report.eventCountParity.status, 'ok');
  assert.equal(report.fullStringParity.status, 'ok');
  assert.deepEqual(report.variants.map(entry => entry.id), [
    'scanAllNoDecode',
    'nameStringOnly',
    'textStringOnly',
    'attrNameStringOnly',
    'attrValueStringOnly',
    'stringFull',
    'cursorAccessor',
    'rawFrameDirect',
    'rawFrameNameId',
  ]);

  const fullRows = report.variants.filter(entry => entry.fullStringParity);
  assert.ok(fullRows.every(entry => entry.eventCount === report.fullStringParity.eventCount));
  assert.ok(fullRows.every(entry => entry.checksum === report.fullStringParity.checksum));
  assert.ok(report.variants.every(entry => entry.boundedMemory === true));
  assert.ok(report.variants.every(entry => entry.counterexampleStatus === 'not-found'));
  assert.ok(report.variants.every(entry => entry.runtimeLimitCounterexampleEligible === false));

  const rawDirect = report.variants.find(entry => entry.id === 'rawFrameDirect');
  const rawNameId = report.variants.find(entry => entry.id === 'rawFrameNameId');
  assert.ok(rawDirect.materializationCounters.rawSpanMaterializations > 0);
  assert.ok(rawNameId.materializationCounters.rawNameCacheHits > 0);
  assert.ok(rawNameId.materializationCounters.rawSpanMaterializations < rawDirect.materializationCounters.rawSpanMaterializations);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Large Candidate Headroom Matrix/);
  assert.match(markdown, /Runtime: Bun/);
  assert.match(markdown, /JavaScriptCore/);
  assert.match(markdown, /1 GiB\+ bounded-memory counterexample search/);
  assert.match(markdown, /generated `Uint8Array` batches/);
  assert.match(markdown, /`Uint8Array` plus `TextDecoder`/);
  assert.match(markdown, /Node `Buffer\.toString\(\)`/);
  assert.match(markdown, /lazy getters/);
  assert.match(markdown, /Full-string parity rows: ok/);
});
