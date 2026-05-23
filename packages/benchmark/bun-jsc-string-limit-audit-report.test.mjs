import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'bun-jsc-string-limit-audit-report-test.json');
const mdOut = join(tmpDir, 'bun-jsc-string-limit-audit-report-test.md');

function readBunVersion() {
  const result = spawnSync('bun', ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

test('bun jsc string limit audit separates JSC source limit from V8 failure', { skip: !readBunVersion() }, () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'bun-jsc-string-limit-audit.mjs'),
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
  assert.equal(report.objective, 'bun-jsc-string-limit-audit');
  assert.equal(report.contract, 'bun-jsc-complete-js-string-input-boundary');
  assert.equal(report.runtime.bunVersion, readBunVersion());
  assert.match(report.runtime.webkitCommit, /^[0-9a-f]{40}$/);
  assert.equal(report.jscMaxStringLength.value, 2_147_483_647);
  assert.equal(report.jscMaxStringLength.formula, 'std::numeric_limits<int32_t>::max()');
  assert.equal(report.overLimitProbe.status, 'throws');
  assert.equal(report.overLimitProbe.errorName, 'RangeError');
  assert.match(report.overLimitProbe.errorMessage, /Out of memory/);

  const projected1024 = report.fixtureProjections.find((row) => row.sizeMiB === 1024);
  assert.ok(projected1024, 'missing 1024 MiB projection');
  assert.equal(projected1024.stringCodeUnits, 1_072_245_626);
  assert.equal(projected1024.exceedsJscMaxStringLength, false);
  assert.equal(projected1024.jscCodeUnitHeadroom, 1_075_238_021);
  assert.equal(projected1024.constructingCompleteStringIsExpectedToFailByJscLength, false);

  assert.equal(report.eventReaderRelease.status, 'loaded');
  assert.equal(report.eventReaderRelease.v8ReleaseFailure.sizeMiB, 1024);
  assert.equal(report.eventReaderRelease.v8ReleaseFailure.error, 'Invalid string length');
  assert.equal(report.findings.find((finding) => finding.id === 'jsc-limit-does-not-explain-1gib-v8-failure').status, 'counterexample-to-porting-v8-limit');

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Bun\/JSC String Limit Audit/);
  assert.match(markdown, /StringImpl::MaxLength/);
  assert.match(markdown, /std::numeric_limits<int32_t>::max\(\)/);
  assert.match(markdown, /1024 MiB projection is below the JSC string-length limit/);
  assert.match(markdown, /not a 1 GiB JSC string-length failure/);
  assert.match(markdown, /not a byte-batch runtime ceiling/);
  assert.match(markdown, /oven-sh\/webkit\/blob\/[0-9a-f]{40}\/Source\/WTF\/wtf\/text\/StringImpl\.h#L153/);
});
