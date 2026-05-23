import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'browser-string-limit-audit-report-test.json');
const mdOut = join(tmpDir, 'browser-string-limit-audit-report-test.md');

test('browser string-limit audit records EventReaderSync control and over-limit complete-string failure', (t) => {
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
    join(__dirname, 'browser-string-limit-audit.mjs'),
    '--browser-executable',
    browserExecutable,
    '--sizes-mib',
    '0.001,1024',
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
    timeout: 180_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
  assert.equal(report.objective, 'browser-string-limit-audit');
  assert.equal(report.contract, 'browser-v8-complete-js-string-input-boundary');
  assert.equal(report.environment.runtimeName, 'browser');
  assert.equal(report.environment.javascriptEngine, 'V8');
  assert.match(report.environment.userAgent, /Chrome|Edg/);
  assert.equal(report.options.fixtureShape, 'diverse-cycle');
  assert.deepEqual(report.options.sizesMiB, [0.001, 1024]);

  const control = report.rows.find(entry => entry.sizeMiB === 0.001);
  assert.equal(control.status, 'ok');
  assert.equal(control.eventCount > 0, true);
  assert.equal(control.materializationCounters.eventObjects, control.eventCount);
  assert.equal(control.memory.scope, 'browser-js-heap');
  assert.equal(control.fixture.stringCodeUnits > 0, true);

  const overLimit = report.rows.find(entry => entry.sizeMiB === 1024);
  assert.equal(overLimit.status, 'string-construction-failed');
  assert.equal(overLimit.stringConstructionProbe.status, 'throws');
  assert.equal(overLimit.stringConstructionProbe.errorName, 'RangeError');
  assert.match(overLimit.stringConstructionProbe.errorMessage, /Invalid string length|string/i);
  assert.equal(overLimit.fixture.constructingCompleteStringIsExpectedToFail, true);
  assert.equal(overLimit.fixture.stringCodeUnits > control.fixture.stringCodeUnits, true);
  assert.equal(overLimit.parsed, false);

  assert.ok(report.findings.some(entry => entry.id === 'browser-complete-string-boundary'));
  assert.ok(report.findings.some(entry => entry.id === 'browser-string-input-control'));
  assert.ok(report.findings.some(entry => entry.id === 'not-byte-batch-runtime-ceiling'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Browser String-Limit Audit/);
  assert.match(markdown, /EventReaderSync complete XML string/);
  assert.match(markdown, /string-construction-failed/);
  assert.match(markdown, /RangeError/);
  assert.match(markdown, /not a byte-batch runtime ceiling/);
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
