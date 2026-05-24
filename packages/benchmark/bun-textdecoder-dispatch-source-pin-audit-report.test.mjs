import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'bun-textdecoder-dispatch-source-pin-fixture');
const jsonOut = join(__dirname, 'results', 'tmp', 'bun-textdecoder-dispatch-source-pin-audit-test.json');
const mdOut = join(__dirname, 'results', 'tmp', 'bun-textdecoder-dispatch-source-pin-audit-test.md');

test('Bun TextDecoder dispatch source-pin audit records native UTF-8 and WebKit other-encoding boundary', () => {
  rmSync(tmpDir, { recursive: true, force: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  writeFixture('src/bun.js/webcore/encoding.classes.ts', [
    'export default [',
    '  define({',
    '    name: "TextDecoder",',
    '    proto: {',
    '      decode: {',
    '        fn: "decode",',
    '        DOMJIT: {',
    '          returns: "JSString",',
    '          args: ["JSUint8Array"],',
    '        },',
    '      },',
    '    },',
    '  }),',
    '];',
  ]);

  writeFixture('src/bun.js/webcore/TextDecoder.zig', [
    'encoding: EncodingLabel = EncodingLabel.@"UTF-8",',
    'pub const js = jsc.Codegen.JSTextDecoder;',
    'pub fn decode(this: *TextDecoder, globalThis: *jsc.JSGlobalObject, callframe: *jsc.CallFrame) bun.JSError!JSValue {',
    '    return this.decodeSlice(globalThis, input_slice, false);',
    '}',
    'pub fn decodeWithoutTypeChecks(this: *TextDecoder, globalThis: *jsc.JSGlobalObject, uint8array: *jsc.JSUint8Array) bun.JSError!JSValue {',
    '    return this.decodeSlice(globalThis, uint8array.slice(), false);',
    '}',
    'fn decodeSlice(this: *TextDecoder, globalThis: *jsc.JSGlobalObject, buffer_slice: []const u8, comptime flush: bool) bun.JSError!JSValue {',
    '    switch (this.encoding) {',
    '        EncodingLabel.latin1 => {',
    '            return ZigString.init(buffer_slice).toJS(globalThis);',
    '            return ZigString.toExternalU16(bytes.ptr, out.written, globalThis);',
    '        },',
    '        EncodingLabel.@"UTF-8" => {',
    '            const maybe_decode_result = strings.toUTF16AllocMaybeBuffered(bun.default_allocator, input, false, flush);',
    '            return ZigString.toExternalU16(decoded.ptr, decoded.len, globalThis);',
    '            return ZigString.init(input).toJS(globalThis);',
    '        },',
    '        inline .@"UTF-16LE", .@"UTF-16BE" => |utf16_encoding| {',
    '            return output.toJS(globalThis);',
    '        },',
    "        // Handle all other encodings using WebKit's TextCodec",
    '        else => {',
    '            const codec = TextCodec.create(encoding_name);',
    '            const result = codec.decode(buffer_slice, flush, this.fatal);',
    '        },',
    '    }',
    '}',
  ]);

  writeFixture('src/bun.js/bindings/TextEncodingRegistry.cpp', [
    'static void buildBaseTextCodecMaps()',
    '{',
    '    // Native UTF-8, UTF-16, Latin1 support in Bun - not registering here',
    '}',
    'std::unique_ptr<TextCodec> newTextCodec(const TextEncoding& encoding)',
    '{',
    '    return nullptr; // UTF-8 handled natively in Bun',
    '}',
  ]);

  writeFixture('src/bun.js/bindings/TextEncoding.cpp', [
    'String TextEncoding::decode(std::span<const uint8_t> data, bool stopOnError, bool& sawError) const',
    '{',
    '    return newTextCodec(*this)->decode(data, true, stopOnError, sawError);',
    '}',
  ]);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'bun-textdecoder-dispatch-source-pin-audit.mjs'),
    '--source-dir',
    tmpDir,
    '--bun-tag',
    'bun-v1.test',
    '--bun-commit',
    'test-bun-commit',
    '--bun-version',
    '1.test',
    '--bun-revision',
    '1.test+abcdef',
    '--webkit-commit',
    'test-webkit-commit',
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
  assert.equal(report.objective, 'bun-textdecoder-dispatch-source-pin-audit');
  assert.equal(report.contract, 'bun-exact-revision-textdecoder-dispatch-source-lines');
  assert.equal(report.runtime.bunRevision, '1.test+abcdef');
  assert.equal(report.runtime.webkitCommit, 'test-webkit-commit');
  assert.equal(report.source.repository, 'oven-sh/bun');
  assert.equal(report.source.revision, 'test-bun-commit');
  assert.equal(report.anchors.utf8Branch.status, 'found');
  assert.equal(report.anchors.utf8DecodeAlloc.status, 'found');
  assert.equal(report.anchors.otherEncodingsWebKitComment.status, 'found');
  assert.equal(report.anchors.otherEncodingsDecode.status, 'found');
  assert.equal(report.findings.find((finding) => finding.id === 'bun-textdecoder-webkit-only-other-encodings').classification, 'COUNTEREXAMPLE');
  assert.equal(report.findings.find((finding) => finding.id === 'bun-textdecoder-dispatch-scope-guard').classification, 'SCOPE_GUARD');

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Bun TextDecoder Dispatch Source Pin Audit/);
  assert.match(markdown, /implemented by `src\/bun\.js\/webcore\/TextDecoder\.zig`/);
  assert.match(markdown, /default `UTF-8` branch/);
  assert.match(markdown, /WebKit `TextCodec` path is still present/);
  assert.match(markdown, /all other encodings/);
  assert.match(markdown, /not a runtime-ceiling proof/);
});

function writeFixture(relativePath, lines) {
  const filePath = join(tmpDir, ...relativePath.split('/'));
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${lines.join('\n')}\n`);
}
