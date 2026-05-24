import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'bun-jsc-codegen-trace-report-test.json');
const mdOut = join(tmpDir, 'bun-jsc-codegen-trace-report-test.md');

test('Bun/JSC codegen trace report records bytecode and DFG facts without claiming a ceiling', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath, { recursive: true, force: true });
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'bun-jsc-codegen-trace.mjs'),
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
  assert.equal(report.objective, 'bun-jsc-codegen-trace');
  assert.equal(report.contract, 'jsc-bytecode-dfg-disassembly-trace');
  assert.equal(report.environment.runtime.runtimeName, 'bun');
  assert.equal(report.environment.runtime.javascriptEngine, 'JavaScriptCore');
  assert.equal(report.rawArtifacts.committed, false);
  assert.equal(report.fullStringParity.status, 'ok');
  assert.ok(report.trace.generatedDfgLineCount >= 3);
  assert.ok(report.trace.bytecodeLineCount >= 1);
  assert.ok(report.trace.dfgNodeLineCount >= 1);
  assert.ok(report.trace.totalTargetMentions >= 3);
  assert.equal(report.findings.find(finding => finding.id === 'bun-jsc-bytecode-dfg-trace-visible').classification, 'TRACE_FACT');
  assert.equal(report.findings.find(finding => finding.id === 'not-safari-or-runtime-ceiling-proof').classification, 'SCOPE_GUARD');

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Bun\/JSC Codegen Trace/);
  assert.match(markdown, /TRACE_FACT/);
  assert.match(markdown, /JSC_dumpBytecodeAtDFGTime=true/);
  assert.match(markdown, /Generated DFG JIT lines/);
  assert.match(markdown, /not Safari\/browser evidence/);
  assert.match(markdown, /not a runtime ceiling proof/);
});
