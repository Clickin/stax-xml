import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const sourceFile = join(tmpDir, 'chrome-v8-source-pin-fixture.h');
const jsonOut = join(tmpDir, 'chrome-v8-source-pin-audit-test.json');
const mdOut = join(tmpDir, 'chrome-v8-source-pin-audit-test.md');

test('Chrome V8 source-pin audit records exact string boundary lines without turning them into throughput proof', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [sourceFile, jsonOut, mdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }
  writeFileSync(sourceFile, [
    'class String {',
    ' public:',
    '  static constexpr int kMaxLength =',
    '      internal::kApiSystemPointerSize == 4 ? (1 << 28) - 16 : (1 << 29) - 24;',
    '  static V8_WARN_UNUSED_RESULT MaybeLocal<String> NewFromUtf8(Isolate* isolate, const char* data, NewStringType type = NewStringType::kNormal, int length = -1);',
    '  class ExternalStringResourceBase {',
    '   public:',
    '    virtual void Dispose();',
    '  };',
    '  static MaybeLocal<String> NewExternalOneByte(Isolate* isolate, ExternalOneByteStringResource* resource);',
    '};',
  ].join('\n'));

  const result = spawnSync(process.execPath, [
    join(__dirname, 'chrome-v8-source-pin-audit.mjs'),
    '--source-file',
    sourceFile,
    '--revision',
    'test-revision',
    '--browser-version',
    'Chrome/148.0.7778.179',
    '--v8-version',
    '14.8.178.22',
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
  assert.equal(report.objective, 'chrome-v8-source-pin-audit');
  assert.equal(report.contract, 'chrome-v8-exact-revision-string-boundary-source-lines');
  assert.equal(report.environment.browserVersion, 'Chrome/148.0.7778.179');
  assert.equal(report.environment.v8Version, '14.8.178.22');
  assert.equal(report.source.revision, 'test-revision');
  assert.match(report.source.url, /source-file:/);
  assert.equal(report.anchors.kMaxLength.status, 'found');
  assert.equal(report.anchors.kMaxLength.lineNumber, 3);
  assert.ok(report.anchors.kMaxLength.context.some(line => line.text.includes('(1 << 29) - 24')));
  assert.equal(report.anchors.newFromUtf8.status, 'found');
  assert.equal(report.anchors.externalResourceDispose.status, 'found');
  assert.equal(report.anchors.newExternalOneByte.status, 'found');
  assert.ok(report.findings.some(entry => entry.id === 'browser-v8-string-max-length-source-pin'));
  assert.ok(report.findings.some(entry => entry.id === 'source-pin-not-throughput-proof'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Chrome V8 Source Pin Audit/);
  assert.match(markdown, /Chrome\/148\.0\.7778\.179/);
  assert.match(markdown, /14\.8\.178\.22/);
  assert.match(markdown, /String::kMaxLength/);
  assert.match(markdown, /NewFromUtf8/);
  assert.match(markdown, /external-string API|ExternalStringResourceBase/);
  assert.match(markdown, /not a throughput proof/);
});
