import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'browser-v8-codegen-trace-test');
const jsonOut = join(tmpDir, 'browser-v8-codegen-trace.json');
const mdOut = join(tmpDir, 'browser-v8-codegen-trace.md');

test('browser V8 codegen trace report records trace-opt evidence without claiming a ceiling', () => {
  resetTmp();
  const result = spawnSync(process.execPath, [
    join(__dirname, 'browser-v8-codegen-trace.mjs'),
    '--self-test',
    `--json-out=${jsonOut}`,
    `--md-out=${mdOut}`,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
  assert.equal(report.objective, 'browser-v8-codegen-trace');
  assert.equal(report.contract, 'browser-v8-trace-opt-deopt-same-contract-reader-shapes');
  assert.equal(report.environment.javascriptEngine, 'V8');
  assert.equal(report.optimizationStatus.available, true);
  assert.ok(report.optimizationStatus.functions.some(hit => hit.functionName === 'consumeBrowserStringFull' && hit.status > 0));
  assert.ok(report.findings.some(finding => finding.id === 'browser-v8-trace-opt-captured'));
  assert.ok(report.findings.some(finding => finding.id === 'browser-v8-trace-scope-limit'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Browser V8 Codegen Trace/);
  assert.match(markdown, /--allow-natives-syntax/);
  assert.match(markdown, /not a runtime ceiling proof/);
  assert.match(markdown, /consumeBrowserStringFull/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
}
