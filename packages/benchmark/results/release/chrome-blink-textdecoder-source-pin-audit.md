# Chrome/Blink TextDecoder Source Pin Audit

Generated: 2026-05-24T00:02:42.876Z

## Scope

This audit pins Chromium/Blink source lines for `TextDecoder.decode()` and the UTF-8 `TextCodec` path used by Chrome browser TextDecoder rows. It is source evidence for Chrome/Blink only. It is not a benchmark, not JIT/codegen evidence, not Safari/JSC or Firefox/SpiderMonkey coverage, and not a runtime-ceiling proof.

## Runtime And Source

- Browser: Chrome/148.0.7778.179
- V8: 14.8.178.22
- Repository: chromium/src
- Revision: refs/tags/148.0.7778.179
- Files: `third_party/blink/renderer/modules/encoding/text_decoder.cc`, `third_party/blink/renderer/modules/encoding/text_decoder.h`, `third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc`

## Anchors

| ID | File | Line | Source | Meaning |
| --- | --- | ---: | --- | --- |
| `textDecoderDecode` | `third_party/blink/renderer/modules/encoding/text_decoder.cc` | 81 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/modules/encoding/text_decoder.cc#81 | TextDecoder::decode |
| `textDecoderDelegatesDecode` | `third_party/blink/renderer/modules/encoding/text_decoder.cc` | 93 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/modules/encoding/text_decoder.cc#93 | decode delegates to Decode |
| `textDecoderPrivateDecode` | `third_party/blink/renderer/modules/encoding/text_decoder.cc` | 96 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/modules/encoding/text_decoder.cc#96 | TextDecoder::Decode |
| `newTextCodec` | `third_party/blink/renderer/modules/encoding/text_decoder.cc` | 108 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/modules/encoding/text_decoder.cc#108 | NewTextCodec |
| `streamFlushBehavior` | `third_party/blink/renderer/modules/encoding/text_decoder.cc` | 116 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/modules/encoding/text_decoder.cc#116 | stream flush behavior |
| `codecDecodeCall` | `third_party/blink/renderer/modules/encoding/text_decoder.cc` | 120 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/modules/encoding/text_decoder.cc#120 | TextCodec::Decode call |
| `fatalErrorHandling` | `third_party/blink/renderer/modules/encoding/text_decoder.cc` | 127 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/modules/encoding/text_decoder.cc#127 | fatal decode error handling |
| `bomErase` | `third_party/blink/renderer/modules/encoding/text_decoder.cc` | 136 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/modules/encoding/text_decoder.cc#136 | BOM erase |
| `codecMember` | `third_party/blink/renderer/modules/encoding/text_decoder.h` | 75 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/modules/encoding/text_decoder.h#75 | TextCodec member |
| `textCodecUtf8Create` | `third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc` | 181 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc#181 | TextCodecUtf8::Create |
| `textCodecUtf8Decode` | `third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc` | 356 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc#356 | TextCodecUtf8::Decode |
| `latin1Buffer` | `third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc` | 365 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc#365 | LChar InlinedStringBuffer |
| `asciiFastPath` | `third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc` | 394 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc#394 | ASCII fast path |
| `copyAsciiMachineWord` | `third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc` | 402 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc#402 | CopyAsciiMachineWord |
| `latin1ToString` | `third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc` | 443 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc#443 | LChar buffer ToString |
| `upConvertTo16Bit` | `third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc` | 445 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc#445 | upConvertTo16Bit label |
| `utf16Buffer` | `third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc` | 446 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc#446 | UChar InlinedStringBuffer |
| `appendCharacter` | `third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc` | 524 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc#524 | AppendCharacter |
| `utf16ToString` | `third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc` | 529 | https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.179/third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc#529 | UChar buffer ToString |

## Findings

### chrome-blink-textdecoder-host-api-source-pin

Classification: SOURCE_FACT

Chrome/Blink TextDecoder.decode delegates byte spans to TextDecoder::Decode, creates or reuses a TextCodec, and calls TextCodec::Decode with stream/fatal options.

- TextDecoder::decode line 81
- NewTextCodec line 108
- codec_->Decode line 120

### chrome-blink-utf8-codec-string-source-pin

Classification: SOURCE_FACT

The pinned UTF-8 codec decodes into Blink string buffers and returns Blink String values through LChar or UChar ToString paths.

- TextCodecUtf8::Decode line 356
- LChar buffer line 365
- LChar ToString line 443
- UChar buffer line 446
- UChar ToString line 529

### chrome-blink-utf8-ascii-fast-path-source-pin

Classification: SOURCE_FACT

The pinned UTF-8 codec has an explicit ASCII fast path with machine-word copying before falling back to non-ASCII handling.

- ASCII fast path line 394
- CopyAsciiMachineWord line 402
- upConvertTo16Bit line 445

### chrome-blink-source-pin-scope-guard

Classification: SCOPE_GUARD

This source pin explains Chrome/Blink TextDecoder boundaries only. It is not Safari/JSC, Firefox/SpiderMonkey, Node, or Bun TextDecoder evidence, and it is not codegen or a runtime-ceiling proof.

- The audit does not run a benchmark row.
- The audit does not inspect generated machine code.
- Any 200 MiB/s+ bounded-memory full-string row would still be a counterexample to the broad runtime-limit hypothesis.

## Interpretation

For this Chrome/Blink source revision, the browser `TextDecoder.decode()` path is a Blink host-API path: JavaScript calls into Blink `TextDecoder`, which delegates to `TextCodec`, and UTF-8 decoding returns Blink `String` values from `InlinedStringBuffer<LChar>` or `InlinedStringBuffer<UChar>`. This is different evidence from Node/V8 `TextDecoder`, which is implemented through Node internal bindings.

The source pin narrows one browser source-boundary gap. It does not prove that Chrome/V8 or JavaScript runtimes have no remaining performance headroom, and it does not cover non-V8 browsers or generated code for the benchmark loop.
