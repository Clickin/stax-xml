import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  createHostProcessMemoryUnavailable,
  createWebDriverBenchmarkScript,
  parseArgs,
  unwrapWebDriverValue,
} from './safari-webdriver-candidate-headroom.mjs';

test('Safari WebDriver harness exposes a same-contract runner without claiming local availability', () => {
  const script = createWebDriverBenchmarkScript(12_000);
  assert.match(script, /__staxBrowserBenchmarkResult/);
  assert.match(script, /done\(JSON\.stringify\(value\)\)/);
  assert.match(script, /Timed out waiting for Safari benchmark runner/);
  assert.doesNotMatch(script, /Buffer\.toString/);
  assert.doesNotMatch(script, /Playwright|Selenium|CDP/);

  const hostMemory = createHostProcessMemoryUnavailable();
  assert.equal(hostMemory.scope, 'not-recorded');
  assert.match(hostMemory.note, /does not record portable browser process RSS/);
  assert.equal(hostMemory.maxWorkingSetBytes, null);
});

test('Safari WebDriver argument parser requires an explicit safaridriver path on hosts without one', () => {
  assert.throws(() => parseArgs([]), /safaridriver executable was not found/);
  assert.throws(() => parseArgs(['--driver-executable', 'definitely-missing-safaridriver']), /safaridriver executable was not found/);
});

test('Safari WebDriver argument parser preserves benchmark contract options with an explicit driver path', () => {
  const nodeExecutable = process.execPath;
  const options = parseArgs([
    '--driver-executable',
    nodeExecutable,
    '--size-gib',
    '1',
    '--fixture-shape',
    'projection-cycle',
    '--diverse-cycle-size',
    '4096',
    '--cases',
    'stringFull,eventObjectFull,rawFrameNameId',
    '--json-out',
    'tmp/safari.json',
    '--md-out',
    'tmp/safari.md',
  ]);

  assert.equal(options.driverExecutable, nodeExecutable);
  assert.equal(options.sizeGiB, 1);
  assert.equal(options.fixtureShape, 'projection-cycle');
  assert.equal(options.diverseCycleSize, 4096);
  assert.deepEqual(options.cases, ['stringFull', 'eventObjectFull', 'rawFrameNameId']);
  assert.equal(options.jsonOut, resolve(process.cwd(), 'tmp/safari.json'));
  assert.equal(options.mdOut, resolve(process.cwd(), 'tmp/safari.md'));
});

test('Safari WebDriver value unwrapping accepts W3C and legacy response shapes', () => {
  assert.deepEqual(unwrapWebDriverValue({ value: { ok: true } }), { ok: true });
  assert.deepEqual(unwrapWebDriverValue({ ok: true }), { ok: true });
});
