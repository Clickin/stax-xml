import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'spidermonkey-jsshell-diagnostic-flag-sweep-test');
const jsonOut = join(tmpDir, 'spidermonkey-jsshell-diagnostic-flag-sweep.json');
const mdOut = join(tmpDir, 'spidermonkey-jsshell-diagnostic-flag-sweep.md');

test('SpiderMonkey js-shell diagnostic flag sweep stays negative and scoped', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'spidermonkey-jsshell-diagnostic-flag-sweep.mjs'),
    '--self-test',
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
  assert.equal(report.objective, 'spidermonkey-jsshell-diagnostic-flag-sweep');
  assert.equal(report.contract, 'public-spidermonkey-jsshell-diagnostic-flag-negative-sweep');
  assert.equal(report.outcome.status, 'available');
  assert.equal(report.outcome.helpAdvertisesDumpBytecode, true);
  assert.equal(report.outcome.helpAdvertisesJitSpewFlag, false);
  assert.equal(report.outcome.bytecodeProbeCount, 4);
  assert.equal(report.outcome.bytecodeOutputProbeCount, 0);
  assert.equal(report.outcome.irOrCodegenProbeCount, 0);
  assert.equal(report.outcome.hasBytecodeDumpOutput, false);
  assert.equal(report.outcome.hasIrOrCodegenDumpOutput, false);
  assert.equal(report.outcome.hasDiagnosticPrefSurface, false);
  assert.equal(report.outcome.closesEmittedIrObligation, false);
  assert.ok(report.shell.probes.every(probe => probe.emittedBytecodeDump === false));
  assert.ok(report.shell.probes.every(probe => probe.emittedIrOrCodegenDump === false));
  assert.ok(report.findings.some(finding =>
    finding.id === 'public-jsshell-dump-bytecode-no-output'
    && finding.classification === 'NEGATIVE_RESULT'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'public-jsshell-diagnostic-sweep-scope'
    && finding.classification === 'SCOPE_GUARD'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /SpiderMonkey JS Shell Diagnostic Flag Sweep/);
  assert.match(markdown, /Help advertises --dump-bytecode: true/);
  assert.match(markdown, /Bytecode-output probes: 0/);
  assert.match(markdown, /IR\/codegen-output probes: 0/);
  assert.match(markdown, /Diagnostic pref surface: false/);
  assert.match(markdown, /Closes emitted IR obligation: false/);
  assert.match(markdown, /\| dump-bytecode-inline \| 0 \| 210 \| 13 \| 0 \| 0 \| no \| no \|/);
  assert.match(markdown, /A diagnostic-capable SpiderMonkey build is still required/);
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
