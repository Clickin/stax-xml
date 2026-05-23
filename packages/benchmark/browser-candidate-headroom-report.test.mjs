import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'browser-candidate-headroom-report-test.json');
const mdOut = join(tmpDir, 'browser-candidate-headroom-report-test.md');

test('browser candidate headroom matrix records the same byte-batch contract', (t) => {
  const browserExecutable = findBrowserExecutable();
  if (!browserExecutable) {
    t.skip('Chrome or Edge executable was not found.');
    return;
  }

  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'browser-candidate-headroom.mjs'),
    '--browser-executable',
    browserExecutable,
    '--size-gib',
    '0.0001',
    '--fixture-shape',
    'diverse-cycle',
    '--diverse-cycle-size',
    '16',
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
    timeout: 120_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
  assert.equal(report.objective, 'browser-candidate-headroom');
  assert.equal(report.contract, 'browser-byte-batch-mixed-materialization-headroom-matrix');
  assert.equal(report.environment.runtimeName, 'browser');
  assert.equal(report.environment.javascriptEngine, 'V8');
  assert.match(report.environment.userAgent, /Chrome|Edg/);
  assert.equal(report.environment.gcStrategy, 'window.gc');
  assert.equal(report.fixture.generated, true);
  assert.equal(report.fixture.shape, 'diverse-cycle');
  assert.equal(report.fixture.rowCycleSize, 16);
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
  assert.ok(report.variants.every(entry => entry.eventCount === report.eventCountParity.eventCount));
  assert.ok(report.variants.filter(entry => entry.fullStringParity).every(entry => entry.checksum === report.fullStringParity.checksum));
  assert.ok(report.variants.every(entry => entry.memory?.scope === 'browser-js-heap'));

  const scan = report.variants.find(entry => entry.id === 'scanAllNoDecode');
  const rawNameId = report.variants.find(entry => entry.id === 'rawFrameNameId');
  assert.equal(scan.materializationCounters.stringFieldReads, 0);
  assert.ok(rawNameId.materializationCounters.rawNameCacheHits > 0);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Browser Candidate Headroom Matrix/);
  assert.match(markdown, /browser `Uint8Array` batches/);
  assert.match(markdown, /Memory is browser JS heap only/);
  assert.match(markdown, /Full-string parity rows: ok/);
});

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  return candidates.find(candidate => existsSync(candidate));
}
