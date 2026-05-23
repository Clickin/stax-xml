import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'node-textdecoder-source-pin-fixture');
const jsonOut = join(__dirname, 'results', 'tmp', 'node-textdecoder-source-pin-audit-test.json');
const mdOut = join(__dirname, 'results', 'tmp', 'node-textdecoder-source-pin-audit-test.md');

test('Node TextDecoder source-pin audit records the UTF-8 string boundary without claiming a ceiling', () => {
  rmSync(tmpDir, { recursive: true, force: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
  mkdirSync(join(tmpDir, 'lib', 'internal'), { recursive: true });
  mkdirSync(join(tmpDir, 'src'), { recursive: true });

  writeFileSync(join(tmpDir, 'lib', 'internal', 'encoding.js'), [
    'class TextDecoder {',
    '  decode(input = empty, options = kEmptyObject) {',
    '    if (this[kUTF8FastPath]) {',
    '      const ignoreBom = this[kIgnoreBOM] || this[kBOMSeen];',
    '      if (!this[kChunk]) return decodeUTF8(input, ignoreBom, this[kFatal]);',
    '      const res = decodeUTF8(u, ignoreBom || prefix, this[kFatal]);',
    '      return res;',
    '    }',
    '  }',
    '}',
    'function parseInput(input) {',
    '  if (isArrayBufferView(input)) {',
    '    return new FastBuffer(input.buffer, input.byteOffset, input.byteLength);',
    '  }',
    '}',
  ].join('\n'));

  writeFileSync(join(tmpDir, 'src', 'encoding_binding.cc'), [
    'void BindingData::DecodeUTF8(const FunctionCallbackInfo<Value>& args) {',
    '  ArrayBufferViewContents<char> buffer(args[0]);',
    '  if (!simdutf::validate_ascii_with_errors(data, length).error) {}',
    '  Local<Value> ret;',
    '  if (StringBytes::Encode(env->isolate(), data, length, UTF8).ToLocal(&ret)) {}',
    '}',
  ].join('\n'));

  writeFileSync(join(tmpDir, 'src', 'string_bytes.cc'), [
    'MaybeLocal<Value> StringBytes::Encode(Isolate* isolate, const char* buf, size_t buflen, enum encoding encoding) {',
    '  switch (encoding) {',
    '    case UTF8: {',
    '      // ASCII fast path',
    '      return ExternOneByteString::NewFromCopy(isolate, buf, buflen);',
    '      size_t utf16len = simdutf::convert_valid_utf8_to_utf16(buf, buflen, reinterpret_cast<char16_t*>(dst));',
    '      return ExternTwoByteString::New(isolate, dst, utf16len);',
    '      val = String::NewFromUtf8(isolate, buf, v8::NewStringType::kNormal, buflen);',
    '    }',
    '  }',
    '}',
    'memcpy(new_data, data, length * sizeof(*new_data));',
    'String::NewFromOneByte(isolate, reinterpret_cast<const uint8_t*>(data), v8::NewStringType::kNormal, length);',
    'String::NewFromTwoByte(isolate, data, v8::NewStringType::kNormal, length);',
  ].join('\n'));

  const result = spawnSync(process.execPath, [
    join(__dirname, 'node-textdecoder-source-pin-audit.mjs'),
    '--source-dir',
    tmpDir,
    '--revision',
    'v24.15.0-test',
    '--node-version',
    'v24.15.0',
    '--v8-version',
    '13.6.233.17-node.48',
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
  assert.equal(report.objective, 'node-textdecoder-source-pin-audit');
  assert.equal(report.contract, 'node-exact-revision-textdecoder-string-boundary-source-lines');
  assert.equal(report.environment.nodeVersion, 'v24.15.0');
  assert.equal(report.environment.v8Version, '13.6.233.17-node.48');
  assert.equal(report.source.revision, 'v24.15.0-test');
  assert.equal(report.anchors.textDecoderDecode.status, 'found');
  assert.equal(report.anchors.directDecodeUtf8.status, 'found');
  assert.equal(report.anchors.arrayBufferViewContents.status, 'found');
  assert.equal(report.anchors.bindingStringBytesEncodeUtf8.status, 'found');
  assert.equal(report.anchors.stringBytesEncode.status, 'found');
  assert.equal(report.anchors.asciiFastPathCopy.status, 'found');
  assert.equal(report.anchors.newFromUtf8Fallback.status, 'found');
  assert.ok(report.findings.some(entry => entry.id === 'node-textdecoder-v8-string-creation-source-pin'));
  assert.ok(report.findings.some(entry => entry.id === 'node-textdecoder-source-pin-scope-guard'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Node TextDecoder Source Pin Audit/);
  assert.match(markdown, /TextDecoder\.decode\(\)/);
  assert.match(markdown, /decodeUTF8/);
  assert.match(markdown, /StringBytes::Encode/);
  assert.match(markdown, /String::NewFromUtf8/);
  assert.match(markdown, /not browser TextDecoder coverage/);
  assert.match(markdown, /not a runtime-ceiling proof/);
});
