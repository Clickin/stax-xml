import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const outputDir = join(__dirname, 'results', 'tmp', 'machine-code-comparison-test');

test('machine-code comparison report records static evidence and rejected hypotheses', () => {
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true });
  }
  mkdirSync(outputDir, { recursive: true });

  const result = spawnSync(process.execPath, [
    join(__dirname, 'machine-code-comparison.mjs'),
    '--',
    '--self-test',
    '--output-dir',
    outputDir,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(join(outputDir, 'comparison-summary.json'), 'utf8'));
  assert.equal(report.constraints.nativeAddon, 'excluded-until-stable-js-event-and-string-generation');
  assert.ok(report.staticEvidence.v8.bytecode.patterns.Runtime >= 1);
  assert.ok(report.staticEvidence.jsc.jit.patterns.Baseline >= 1);
  assert.ok(report.staticEvidence.jvm.bytecode.patterns.invoke >= 1);
  assert.ok(report.staticEvidence.quickXml.asm.patterns.memchr >= 1);
  assert.ok(report.rejectedHypotheses.some(entry => entry.id === 'native-addon-tokenizer-only'));
  assert.ok(report.findings.every(entry => entry.evidence.length > 0));

  const markdown = readFileSync(join(outputDir, 'machine-code-comparison.md'), 'utf8');
  assert.match(markdown, /## Static Evidence/);
  assert.match(markdown, /JSC \/ Bun/);
  assert.match(markdown, /native addon is excluded/);
  assert.match(markdown, /## Rejected Hypotheses/);
});
