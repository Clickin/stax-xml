import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'bun-webkit-textdecoder-source-pin-fixture');
const jsonOut = join(__dirname, 'results', 'tmp', 'bun-webkit-textdecoder-source-pin-audit-test.json');
const mdOut = join(__dirname, 'results', 'tmp', 'bun-webkit-textdecoder-source-pin-audit-test.md');

test('Bun-patched WebKit TextDecoder source-pin audit records host API and UTF-8 codec boundaries', () => {
  rmSync(tmpDir, { recursive: true, force: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  writeFixture('Source/WebCore/dom/TextDecoder.cpp', [
    'ExceptionOr<String> TextDecoder::decode(std::optional<BufferSource::VariantType> input, DecodeOptions options)',
    '{',
    '    std::span<const uint8_t> data;',
    '    data = inputBuffer->span();',
    '    m_codec = newTextCodec(m_textEncoding);',
    '    m_codec->stripByteOrderMark();',
    '    String result = m_codec->decode(data, !options.stream, m_options.fatal, sawError);',
    '    return Exception { ExceptionCode::TypeError };',
    '    return result;',
    '}',
  ]);

  writeFixture('Source/WebCore/dom/TextDecoder.h', [
    'class TextDecoder final : public RefCounted<TextDecoder> {',
    '    std::unique_ptr<PAL::TextCodec> m_codec;',
    '};',
  ]);

  writeFixture('Source/WebCore/PAL/pal/text/TextCodec.h', [
    'class TextCodec {',
    '    virtual String decode(std::span<const uint8_t> data, bool flush, bool stopOnError, bool& sawError) = 0;',
    '};',
  ]);

  writeFixture('Source/WebCore/PAL/pal/text/TextEncodingRegistry.cpp', [
    'void buildBaseTextCodecMaps()',
    '{',
    '    TextCodecUTF8::registerCodecs(addToTextCodecMap);',
    '}',
    'std::unique_ptr<TextCodec> newTextCodec(const TextEncoding& encoding)',
    '{',
    '    return TextCodecUTF8::codec();',
    '}',
  ]);

  writeFixture('Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp', [
    'void TextCodecUTF8::registerEncodingNames(EncodingNameRegistrar registrar)',
    '{',
    '    registrar("UTF-8"_s, "UTF-8"_s);',
    '}',
    'std::unique_ptr<TextCodecUTF8> TextCodecUTF8::codec()',
    '{',
    '    return makeUnique<TextCodecUTF8>();',
    '}',
    'void TextCodecUTF8::registerCodecs(TextCodecRegistrar registrar)',
    '{',
    '    registrar("UTF-8"_s, [] { return codec(); });',
    '}',
    'String TextCodecUTF8::decode(std::span<const uint8_t> bytes, bool flush, bool stopOnError, bool& sawError)',
    '{',
    '    StringBuffer<Latin1Character> buffer(bufferSize);',
    '    // Fast path for ASCII. Most UTF-8 text will be ASCII.',
    '    copyASCIIMachineWord(destination, source);',
    '    return String::adopt(WTF::move(buffer));',
    'upConvertTo16Bit:',
    '    StringBuffer<char16_t> buffer16(bufferSize);',
    '    destination16 = appendCharacter(destination16, character);',
    '    return String::adopt(WTF::move(buffer16));',
    '}',
  ]);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'bun-webkit-textdecoder-source-pin-audit.mjs'),
    '--source-dir',
    tmpDir,
    '--webkit-commit',
    'test-webkit-commit',
    '--bun-version',
    '1.3.test',
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
  assert.equal(report.objective, 'bun-webkit-textdecoder-source-pin-audit');
  assert.equal(report.contract, 'bun-patched-webkit-exact-revision-textdecoder-source-lines');
  assert.equal(report.runtime.bunVersion, '1.3.test');
  assert.equal(report.runtime.webkitCommit, 'test-webkit-commit');
  assert.equal(report.source.repository, 'oven-sh/webkit');
  assert.equal(report.anchors.textDecoderDecode.status, 'found');
  assert.equal(report.anchors.codecDecodeCall.status, 'found');
  assert.equal(report.anchors.textCodecUtf8Decode.status, 'found');
  assert.equal(report.anchors.copyAsciiMachineWord.status, 'found');
  assert.equal(report.anchors.utf16StringAdopt.status, 'found');
  assert.ok(report.findings.some(entry => entry.id === 'bun-patched-webkit-textdecoder-host-api-source-pin'));
  assert.ok(report.findings.some(entry => entry.id === 'bun-webkit-source-pin-scope-guard'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Bun-Patched WebKit TextDecoder Source Pin Audit/);
  assert.match(markdown, /TextDecoder\.decode\(\)/);
  assert.match(markdown, /TextCodec::decode/);
  assert.match(markdown, /TextCodecUTF8::decode/);
  assert.match(markdown, /StringBuffer<Latin1Character>/);
  assert.match(markdown, /StringBuffer<char16_t>/);
  assert.match(markdown, /not a Bun runtime dispatch proof/);
  assert.match(markdown, /not a runtime-ceiling proof/);
});

function writeFixture(relativePath, lines) {
  const filePath = join(tmpDir, ...relativePath.split('/'));
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${lines.join('\n')}\n`);
}
