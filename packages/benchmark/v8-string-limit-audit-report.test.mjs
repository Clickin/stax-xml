import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { constants as bufferConstants } from 'node:buffer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'v8-string-limit-audit-report-test.json');
const mdOut = join(tmpDir, 'v8-string-limit-audit-report-test.md');

test('v8 string limit audit pins EventReaderSync complete-string ceiling', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'v8-string-limit-audit.mjs'),
    '--sizes-mib',
    '512,1024',
    '--fixture-shape',
    'diverse-cycle',
    '--diverse-cycle-size',
    '4096',
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
  assert.equal(report.objective, 'v8-string-limit-audit');
  assert.equal(report.contract, 'node-v8-complete-js-string-input-boundary');
  assert.equal(report.environment.node, process.version);
  assert.equal(report.environment.v8, process.versions.v8);
  assert.equal(report.runtimeMaxStringLength.value, bufferConstants.MAX_STRING_LENGTH);
  assert.equal(report.runtimeMaxStringLength.formula64Bit, '(1 << 29) - 24');
  assert.equal(report.runtimeMaxStringLength.formula64BitValue, (1 << 29) - 24);
  assert.equal(report.runtimeMaxStringLength.matches64BitFormula, true);
  assert.equal(report.overLimitProbe.status, 'throws');
  assert.equal(report.overLimitProbe.errorName, 'RangeError');
  assert.equal(report.overLimitProbe.errorMessage, 'Invalid string length');
  assert.equal(report.eventReaderRelease.status, 'loaded');
  assert.equal(report.eventReaderRelease.largestSuccessfulSizeMiB, 512);
  assert.ok(report.eventReaderRelease.largestSuccessfulStringCodeUnits < bufferConstants.MAX_STRING_LENGTH);
  assert.equal(report.eventReaderRelease.releaseFailure.error, 'Invalid string length');

  const projected1024 = report.fixtureProjections.find((row) => row.sizeMiB === 1024);
  assert.ok(projected1024, 'missing 1024 MiB projection');
  assert.ok(projected1024.stringCodeUnits > bufferConstants.MAX_STRING_LENGTH);
  assert.equal(projected1024.exceedsMaxStringLength, true);
  assert.equal(projected1024.constructingCompleteStringIsExpectedToFail, true);

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# V8 String Limit Audit/);
  assert.match(markdown, /MAX_STRING_LENGTH/);
  assert.match(markdown, /RangeError: Invalid string length/);
  assert.match(markdown, /EventReaderSync/);
  assert.match(markdown, /not a byte-batch runtime ceiling/);
  assert.match(markdown, /not a 200 MiB\/s impossibility proof/);
  assert.match(markdown, /nodejs\/node\/blob\/v24\.15\.0\/deps\/v8\/include\/v8-primitive\.h#L126/);
});
