import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'materialization-contract-audit-report-test.json');
const mdOut = join(tmpDir, 'materialization-contract-audit-report-test.md');

test('materialization contract audit separates semantic parity from object-shape parity', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'materialization-contract-audit.mjs'),
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
  assert.equal(report.objective, 'materialization-contract-audit');
  assert.equal(report.contract, 'semantic-materialization-not-object-shape');
  assert.equal(report.parity.status, 'same-semantic-fields');
  assert.equal(report.parity.notSameObjectShape, true);

  const woodstox = report.consumers.find(entry => entry.id === 'woodstox');
  const quickXml = report.consumers.find(entry => entry.id === 'quick-xml');
  const staxEvent = report.consumers.find(entry => entry.id === 'stax-event');
  assert.equal(woodstox.runtimeShape, 'java-xmlstreamreader-cursor');
  assert.equal(woodstox.perEventPublicObject, false);
  assert.equal(quickXml.runtimeShape, 'rust-enum-event-with-buffer-lifetime');
  assert.equal(quickXml.perEventPublicObject, false);
  assert.equal(staxEvent.runtimeShape, 'js-public-event-object');
  assert.equal(staxEvent.perEventPublicObject, true);

  assert.ok(report.findings.some(entry => entry.id === 'same-semantic-materialization-contract'));
  assert.ok(report.findings.some(entry => entry.id === 'not-same-object-shape'));
  assert.ok(report.findings.some(entry => entry.id === 'runtime-limit-still-unproven'));
  assert.ok(report.findings.some(entry => entry.id === 'lazy-getters-remain-rejected'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Materialization Contract Audit/);
  assert.match(markdown, /same semantic fields/);
  assert.match(markdown, /not the same object shape/);
  assert.match(markdown, /Woodstox uses `XMLStreamReader` cursor\/accessor calls/);
  assert.match(markdown, /quick-xml uses Rust enum events tied to a reused buffer/);
  assert.match(markdown, /`EventReaderSync` public event objects/);
  assert.match(markdown, /Lazy getters remain a recorded negative result/);
  assert.match(markdown, /does not prove a JavaScript runtime ceiling/);
});
