import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'firefox-spidermonkey-release-jsshell-availability-audit-test');
const jsonOut = join(tmpDir, 'firefox-spidermonkey-release-jsshell-availability-audit.json');
const mdOut = join(tmpDir, 'firefox-spidermonkey-release-jsshell-availability-audit.md');

test('Firefox SpiderMonkey release jsshell audit records JIT status without closing emitted IR', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-spidermonkey-release-jsshell-availability-audit.mjs'),
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
  assert.equal(report.objective, 'firefox-spidermonkey-release-jsshell-availability-audit');
  assert.equal(report.contract, 'official-firefox-release-jsshell-jit-status-and-diagnostic-surface');
  assert.equal(report.parameters.packageKind, 'release');
  assert.equal(report.outcome.status, 'available');
  assert.equal(report.outcome.packageVerified, true);
  assert.equal(report.outcome.hasJitExecutionStatus, true);
  assert.equal(report.outcome.hasIrDumpSurface, false);
  assert.equal(report.outcome.hasNativeDisassemblySurface, false);
  assert.equal(report.outcome.nativeDumpComplete, false);
  assert.equal(report.outcome.canReadBinaryInput, true);
  assert.equal(report.outcome.canRunCurrentStaxFullStringBenchmark, false);
  assert.equal(report.outcome.closesEmittedIrObligation, false);
  assert.equal(report.shell.builtinProbe.hasDisnativeBuiltin, true);
  assert.equal(report.shell.builtinProbe.hasDisblicBuiltin, true);
  assert.equal(report.shell.builtinProbe.hasDisassemblerValue, 'false');
  assert.equal(report.shell.jitProbe.ionHits, 4988);
  assert.equal(report.shell.jitProbe.checksum, 12502500);
  assert.equal(report.shell.nativeDumpProbe.fileCreated, true);
  assert.equal(report.shell.nativeDumpProbe.fileBytes, 93);
  assert.match(report.shell.nativeDumpProbe.disnativeWriteError, /Did not write all function bytes/);
  assert.equal(report.shell.apiProbe.TextDecoder, 'undefined');
  assert.equal(report.shell.apiProbe.ReadableStream, 'undefined');
  assert.equal(report.shell.apiProbe.Uint8Array, 'function');
  assert.equal(report.shell.binaryInputProbe.status, 'ok');
  assert.equal(report.shell.binaryInputProbe.byteLength, 4551);
  assert.equal(report.shell.help.hasIonEager, true);
  assert.equal(report.shell.help.hasJitSpewFlag, false);
  assert.ok(report.findings.some(finding =>
    finding.id === 'spidermonkey-release-jsshell-no-ir-dump-surface'
    && finding.classification === 'NEGATIVE_RESULT'
  ));
  assert.ok(report.findings.some(finding =>
    finding.id === 'release-jsshell-scope'
    && finding.classification === 'SCOPE_GUARD'
  ));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /Firefox SpiderMonkey Release JS Shell Availability Audit/);
  assert.match(markdown, /JIT execution status observed: true/);
  assert.match(markdown, /IR dump surface present: false/);
  assert.match(markdown, /Native disassembly surface present: false/);
  assert.match(markdown, /Native dump complete: false/);
  assert.match(markdown, /Binary XML input readable: true/);
  assert.match(markdown, /Can run current stax full-string benchmark unchanged: false/);
  assert.match(markdown, /Closes emitted IR obligation: false/);
  assert.match(markdown, /Ion hits: 4988/);
  assert.match(markdown, /has disnative builtin: true/);
  assert.match(markdown, /hasDisassembler\(\): false/);
  assert.match(markdown, /File bytes: 93/);
  assert.match(markdown, /Did not write all function bytes/);
  assert.match(markdown, /TextDecoder: undefined/);
  assert.match(markdown, /ReadableStream: undefined/);
  assert.match(markdown, /Binary Input Probe/);
  assert.match(markdown, /Byte length: 4551/);
  assert.match(markdown, /does not close the emitted JIT IR obligation/);
});

test('Firefox SpiderMonkey jsshell audit records package kind in objective and findings', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-spidermonkey-release-jsshell-availability-audit.mjs'),
    '--self-test',
    '--package-kind',
    'nightly',
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
  assert.equal(report.objective, 'firefox-spidermonkey-nightly-jsshell-availability-audit');
  assert.equal(report.contract, 'official-firefox-nightly-jsshell-jit-status-and-diagnostic-surface');
  assert.equal(report.parameters.packageKind, 'nightly');
  assert.ok(report.findings.some(finding => finding.id === 'official-nightly-jsshell-available'));
  assert.ok(report.findings.some(finding => finding.id === 'spidermonkey-nightly-jsshell-no-ir-dump-surface'));
  assert.ok(report.findings.some(finding => finding.id === 'spidermonkey-nightly-jsshell-stax-api-gap'));
  assert.ok(report.findings.some(finding => finding.id === 'nightly-jsshell-scope'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /Firefox SpiderMonkey Nightly JS Shell Availability Audit/);
  assert.match(markdown, /official Firefox nightly SpiderMonkey JavaScript shell package/);
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
