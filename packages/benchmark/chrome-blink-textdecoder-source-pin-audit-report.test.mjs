import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'chrome-blink-textdecoder-source-pin-fixture');
const jsonOut = join(__dirname, 'results', 'tmp', 'chrome-blink-textdecoder-source-pin-audit-test.json');
const mdOut = join(__dirname, 'results', 'tmp', 'chrome-blink-textdecoder-source-pin-audit-test.md');

test('Chrome/Blink TextDecoder source-pin audit records host API and UTF-8 codec boundaries', () => {
  rmSync(tmpDir, { recursive: true, force: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }
  mkdirSync(join(tmpDir, 'third_party', 'blink', 'renderer', 'modules', 'encoding'), { recursive: true });
  mkdirSync(join(tmpDir, 'third_party', 'blink', 'renderer', 'platform', 'wtf', 'text'), { recursive: true });

  writeFileSync(join(tmpDir, 'third_party', 'blink', 'renderer', 'modules', 'encoding', 'text_decoder.cc'), [
    'String TextDecoder::decode(std::optional<base::span<const uint8_t>> input, const TextDecodeOptions* options, ExceptionState& exception_state) {',
    '  return Decode(input_span, options, exception_state);',
    '}',
    'String TextDecoder::Decode(base::span<const uint8_t> input, const TextDecodeOptions* options, ExceptionState& exception_state) {',
    '  codec_ = NewTextCodec(encoding_);',
    '  FlushBehavior flush = do_not_flush_ ? FlushBehavior::kDoNotFlush : FlushBehavior::kDataEOF;',
    '  String s = codec_->Decode(input, flush, fatal_, saw_error);',
    '  exception_state.ThrowTypeError("The encoded data was not valid.");',
    '  s.erase(0, 1);',
    '  return s;',
    '}',
  ].join('\n'));

  writeFileSync(join(tmpDir, 'third_party', 'blink', 'renderer', 'modules', 'encoding', 'text_decoder.h'), [
    'class TextDecoder {',
    ' private:',
    '  std::unique_ptr<TextCodec> codec_;',
    '};',
  ].join('\n'));

  writeFileSync(join(tmpDir, 'third_party', 'blink', 'renderer', 'platform', 'wtf', 'text', 'text_codec_utf8.cc'), [
    'std::unique_ptr<TextCodec> TextCodecUtf8::Create(const TextEncoding&) { return base::WrapUnique(new TextCodecUtf8()); }',
    'String TextCodecUtf8::Decode(base::span<const uint8_t> bytes, FlushBehavior flush, bool stop_on_error, bool& saw_error) {',
    '  InlinedStringBuffer<LChar> buffer(bytes.size());',
    '  // Fast path for ASCII. Most UTF-8 text will be ASCII.',
    '  CopyAsciiMachineWord(chunk, destination.take_first<sizeof(MachineWord)>().data());',
    '  return std::move(buffer).ToString(characters_decoded);',
    'upConvertTo16Bit:',
    '  InlinedStringBuffer<UChar> buffer16(bytes.size());',
    '  destination16 = AppendCharacter(destination16, character);',
    '  return std::move(buffer16).ToString(characters_decoded);',
    '}',
  ].join('\n'));

  const result = spawnSync(process.execPath, [
    join(__dirname, 'chrome-blink-textdecoder-source-pin-audit.mjs'),
    '--source-dir',
    tmpDir,
    '--revision',
    'refs/tags/148.0.7778.179-test',
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
  assert.equal(report.objective, 'chrome-blink-textdecoder-source-pin-audit');
  assert.equal(report.contract, 'chrome-blink-exact-revision-textdecoder-source-lines');
  assert.equal(report.environment.browserVersion, 'Chrome/148.0.7778.179');
  assert.equal(report.environment.v8Version, '14.8.178.22');
  assert.equal(report.source.revision, 'refs/tags/148.0.7778.179-test');
  assert.equal(report.anchors.textDecoderDecode.status, 'found');
  assert.equal(report.anchors.codecDecodeCall.status, 'found');
  assert.equal(report.anchors.textCodecUtf8Decode.status, 'found');
  assert.equal(report.anchors.copyAsciiMachineWord.status, 'found');
  assert.equal(report.anchors.utf16ToString.status, 'found');
  assert.ok(report.findings.some(entry => entry.id === 'chrome-blink-textdecoder-host-api-source-pin'));
  assert.ok(report.findings.some(entry => entry.id === 'chrome-blink-source-pin-scope-guard'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Chrome\/Blink TextDecoder Source Pin Audit/);
  assert.match(markdown, /TextDecoder\.decode\(\)/);
  assert.match(markdown, /TextCodec::Decode/);
  assert.match(markdown, /TextCodecUtf8::Decode/);
  assert.match(markdown, /InlinedStringBuffer<LChar>/);
  assert.match(markdown, /InlinedStringBuffer<UChar>/);
  assert.match(markdown, /not Safari\/JSC or Firefox\/SpiderMonkey coverage/);
  assert.match(markdown, /not a runtime-ceiling proof/);
});
