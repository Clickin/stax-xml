import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'firefox-spidermonkey-textdecoder-source-pin-fixture');
const jsonOut = join(__dirname, 'results', 'tmp', 'firefox-spidermonkey-textdecoder-source-pin-audit-test.json');
const mdOut = join(__dirname, 'results', 'tmp', 'firefox-spidermonkey-textdecoder-source-pin-audit-test.md');

test('Firefox/SpiderMonkey TextDecoder source-pin audit records Gecko and encoding_rs boundaries', () => {
  rmSync(tmpDir, { recursive: true, force: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
  mkdirSync(join(tmpDir, 'dom', 'encoding'), { recursive: true });
  mkdirSync(join(tmpDir, 'intl'), { recursive: true });

  writeFileSync(join(tmpDir, 'dom', 'encoding', 'TextDecoder.cpp'), [
    'void TextDecoder::Init(const nsAString& aLabel, const TextDecoderOptions& aOptions, ErrorResult& aRv) {',
    '  auto encoding = Encoding::ForLabelNoReplacement(aLabel);',
    '}',
    'void TextDecoder::InitWithEncoding(NotNull<const Encoding*> aEncoding, const TextDecoderOptions& aOptions) {',
    '  aEncoding->Name(mEncoding);',
    '  mFatal = aOptions.mFatal;',
    '  mDecoder = aEncoding->NewDecoderWithoutBOMHandling();',
    '  mDecoder = aEncoding->NewDecoderWithBOMRemoval();',
    '}',
    'void TextDecoderCommon::DecodeNative(const Maybe<Span<const uint8_t>>& aInput, bool aStream, nsAString& aOutDecodedString, ErrorResult& aRv) {',
    '  aOutDecodedString.Truncate();',
    '  auto needed = mDecoder->MaxUTF16BufferLength(aInput.Length());',
    '  auto output = aOutDecodedString.GetMutableData(needed.value(), fallible);',
    '  auto result = mDecoder->DecodeToUTF16WithoutReplacement(aInput, *output, !aStream);',
    '  auto written = mDecoder->DecodeToUTF16(aInput, *output, !aStream);',
    '  aOutDecodedString.SetLength(written, fallible);',
    '  aEncoding->NewDecoderWithoutBOMHandlingInto(*mDecoder);',
    '  aEncoding->NewDecoderWithBOMRemovalInto(*mDecoder);',
    '}',
    'void TextDecoder::Decode(const Optional<ArrayBufferViewOrArrayBuffer>& aInput, const TextDecodeOptions& aOptions, nsAString& aOutDecodedString, ErrorResult& aRv) {',
    '  DecodeNative(nullptr, aOptions.mStream, aOutDecodedString, aRv);',
    '  ProcessTypedArrays(aInput.Value(), [&](const Span<uint8_t>& aData) {',
    '    DecodeNative(aData, aOptions.mStream, aOutDecodedString, aRv);',
    '  });',
    '}',
    'void TextDecoderCommon::GetEncoding(nsAString& aEncoding) {}',
  ].join('\n'));

  writeFileSync(join(tmpDir, 'dom', 'encoding', 'TextDecoder.h'), [
    '#include "mozilla/dom/TextDecoderBinding.h"',
    '#include "mozilla/Encoding.h"',
    'class TextDecoderCommon {',
    '  void DecodeNative(mozilla::Span<const uint8_t> aInput, bool aStream, nsAString& aOutDecodedString, ErrorResult& aRv);',
    '  mozilla::UniquePtr<mozilla::Decoder> mDecoder;',
    '  nsCString mEncoding;',
    '};',
    'class TextDecoder final : public TextDecoderCommon {',
    '  static UniquePtr<TextDecoder> Constructor(const GlobalObject& aGlobal, const nsAString& aLabel, const TextDecoderOptions& aOptions, ErrorResult& aRv);',
    '  JSObject* WrapObject(JSContext* aCx, JS::Handle<JSObject*> aGivenProto) override { return TextDecoder_Binding::Wrap(aCx, this, aGivenProto); }',
    '  void Init(const nsAString& aLabel, const TextDecoderOptions& aOptions, ErrorResult& aRv);',
    '  void InitWithEncoding(NotNull<const Encoding*> aEncoding, const TextDecoderOptions& aOptions);',
    '  void Decode(const Optional<BufferSource>& aBuffer, const TextDecodeOptions& aOptions, nsAString& aOutDecodedString, ErrorResult& aRv);',
    '};',
  ].join('\n'));

  writeFileSync(join(tmpDir, 'intl', 'Encoding.h'), [
    '// Adapted from third_party/rust/encoding_c/include/encoding_rs_cpp.h',
    '// third_party/rust/encoding_c/.',
    'void mozilla_encoding_decode_to_nsstring(const uint8_t*, size_t, nsAString*);',
    'void mozilla_encoding_decode_to_nsstring_with_bom_removal(const uint8_t*, size_t, nsAString*);',
    'void mozilla_encoding_decode_to_nsstring_without_bom_handling(const uint8_t*, size_t, nsAString*);',
    'void mozilla_encoding_decode_to_nsstring_without_bom_handling_and_without_replacement(const uint8_t*, size_t, nsAString*);',
    'class Encoding final {',
    '  static inline const Encoding* ForLabel(Span<const char> aLabel);',
    '  static inline const Encoding* ForLabel(const nsAString& aLabel);',
    '  static inline const Encoding* ForLabelNoReplacement(Span<const char> aLabel);',
    '  static const Encoding* ForLabelNoReplacement(const nsAString& aLabel);',
    '  void Name(nsACString& aName);',
    '  void DecodeWithBOMRemoval(Span<const uint8_t> aBytes, nsAString& aOutput) const { mozilla_encoding_decode_to_nsstring_with_bom_removal(nullptr, 0, &aOutput); }',
    '  void DecodeWithoutBOMHandling(Span<const uint8_t> aBytes, nsAString& aOutput) const { mozilla_encoding_decode_to_nsstring_without_bom_handling(nullptr, 0, &aOutput); }',
    '  inline nsresult DecodeWithoutBOMHandlingAndWithoutReplacement(Span<const uint8_t> aBytes, nsAString& aOutput) const { mozilla_encoding_decode_to_nsstring_without_bom_handling_and_without_replacement(nullptr, 0, &aOutput); }',
    '  UniquePtr<Decoder> NewDecoder() const { return UniquePtr<Decoder>(encoding_new_decoder(this)); }',
    '  UniquePtr<Decoder> NewDecoderWithBOMRemoval() const { return UniquePtr<Decoder>(encoding_new_decoder_with_bom_removal(this)); }',
    '  void NewDecoderWithBOMRemovalInto(Decoder& aDecoder) const { encoding_new_decoder_with_bom_removal_into(this, &aDecoder); }',
    '  UniquePtr<Decoder> NewDecoderWithoutBOMHandling() const { return UniquePtr<Decoder>(encoding_new_decoder_without_bom_handling(this)); }',
    '  void NewDecoderWithoutBOMHandlingInto(Decoder& aDecoder) const { encoding_new_decoder_without_bom_handling_into(this, &aDecoder); }',
    '};',
    'class Decoder final {',
    '  NotNull<const mozilla::Encoding*> Encoding() const;',
    '  CheckedInt<size_t> MaxUTF16BufferLength(size_t aU16Length) const { return decoder_max_utf16_buffer_length(this, aU16Length); }',
    '  inline std::tuple<uint32_t, size_t, size_t, bool> DecodeToUTF16(Span<const uint8_t> aSrc, Span<char16_t> aDst, bool aLast) { decoder_decode_to_utf16(this, aSrc, aDst, aLast); return {}; }',
    '  inline std::tuple<uint32_t, size_t, size_t> DecodeToUTF16WithoutReplacement(Span<const uint8_t> aSrc, Span<char16_t> aDst, bool aLast) { decoder_decode_to_utf16_without_replacement(this, aSrc, aDst, aLast); return {}; }',
    '  // Do not use this unless you are supporting SpiderMonkey-style string storage optimizations.',
    '  inline mozilla::Maybe<size_t> Latin1ByteCompatibleUpTo(Span<const uint8_t> aBuffer) const;',
    '};',
  ].join('\n'));

  const result = spawnSync(process.execPath, [
    join(__dirname, 'firefox-spidermonkey-textdecoder-source-pin-audit.mjs'),
    '--source-dir',
    tmpDir,
    '--revision',
    '644b498d517849c3fb95679e2017e965fe62b77a-test',
    '--firefox-version',
    '143.0.1 build 20250918214338 test snapshot',
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
  assert.equal(report.objective, 'firefox-spidermonkey-textdecoder-source-pin-audit');
  assert.equal(report.contract, 'gecko-exact-revision-textdecoder-source-lines');
  assert.equal(report.environment.firefoxVersion, '143.0.1 build 20250918214338 test snapshot');
  assert.equal(report.source.repository, 'https://hg.mozilla.org/releases/mozilla-release');
  assert.equal(report.source.revision, '644b498d517849c3fb95679e2017e965fe62b77a-test');
  assert.equal(report.anchors.textDecoderInit.status, 'found');
  assert.equal(report.anchors.textDecoderForLabelNoReplacement.status, 'found');
  assert.equal(report.anchors.decodeNative.status, 'found');
  assert.equal(report.anchors.decodeToUtf16.status, 'found');
  assert.equal(report.anchors.decoderDecodeToUtf16Ffi.status, 'found');
  assert.equal(report.anchors.latin1ByteCompatibleUpTo.status, 'found');
  assert.ok(report.findings.some(entry => entry.id === 'gecko-textdecoder-host-api-source-pin'));
  assert.ok(report.findings.some(entry => entry.id === 'gecko-spidermonkey-string-optimization-scope-guard'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Firefox\/SpiderMonkey TextDecoder Source Pin Audit/);
  assert.match(markdown, /TextDecoder\.decode\(\)/);
  assert.match(markdown, /hg\.mozilla\.org\/releases\/mozilla-release/);
  assert.match(markdown, /TextDecoderCommon::DecodeNative/);
  assert.match(markdown, /DecodeToUTF16/);
  assert.match(markdown, /encoding_rs/);
  assert.match(markdown, /Latin1ByteCompatibleUpTo/);
  assert.match(markdown, /not a Firefox benchmark row/);
  assert.match(markdown, /not a runtime-ceiling proof/);
});
