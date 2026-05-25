import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'bun-jsc-textdecoder-codegen-trace');
const jsonOut = join(tmpDir, 'bun-jsc-textdecoder-codegen-trace.json');
const mdOut = join(tmpDir, 'bun-jsc-textdecoder-codegen-trace.md');

test('Bun/JSC TextDecoder codegen trace records DFG facts without claiming native Zig proof', () => {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath, { recursive: true, force: true });
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'bun-jsc-textdecoder-codegen-trace.mjs'),
    '--self-test',
    '--json-out',
    jsonOut,
    '--md-out',
    mdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
  assert.equal(report.objective, 'bun-jsc-textdecoder-codegen-trace');
  assert.equal(report.contract, 'bun-jsc-textdecoder-span-bytecode-dfg-trace');
  assert.equal(report.environment.runtime.runtimeName, 'bun');
  assert.equal(report.environment.runtime.javascriptEngine, 'JavaScriptCore');
  assert.equal(report.rawArtifacts.committed, false);
  assert.equal(report.fullStringParity.status, 'ok');
  assert.equal(report.fullStringParity.fullRowCount, 5);
  assert.ok(report.variants.every(row => row.fullStringParity === true));
  assert.ok(report.variants.every(row => row.decodeStrategy.usesTextDecoder === true));
  assert.ok(report.trace.generatedDfgLineCount >= 2);
  assert.ok(report.trace.bytecodeLineCount >= 1);
  assert.ok(report.trace.dfgNodeLineCount >= 1);
  assert.ok(report.trace.targetMentions.TextDecoder >= 1);
  assert.equal(report.findings.find(finding => finding.id === 'bun-jsc-textdecoder-bytecode-dfg-trace-visible').classification, 'TRACE_FACT');
  assert.equal(report.findings.find(finding => finding.id === 'not-native-zig-codegen-or-safari-proof').classification, 'SCOPE_GUARD');

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Bun\/JSC TextDecoder Codegen Trace/);
  assert.match(markdown, /Full-string parity status: ok/);
  assert.match(markdown, /JSC_dumpBytecodeAtDFGTime=true/);
  assert.match(markdown, /not native Bun Zig generated-code proof/);
  assert.match(markdown, /not Safari\/browser evidence/);
  assert.match(markdown, /not a runtime ceiling proof/);
});
