# Bun-Patched WebKit TextDecoder Source Pin Audit

Generated: 2026-05-24T00:18:49.756Z

## Scope

This audit pins WebKit `TextDecoder` and UTF-8 `TextCodec` source lines for the exact Bun-patched WebKit commit recorded by the Bun/JSC TextDecoder benchmark artifacts. It is source evidence for that WebKit implementation only. It is not a Bun runtime dispatch proof, not Safari/JSC browser coverage, not SpiderMonkey coverage, not JIT/codegen evidence, and not a runtime-ceiling proof.

## Runtime And Source

- Bun artifact runtime: 1.3.13
- WebKit commit: 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
- Repository: oven-sh/webkit
- Files: `Source/WebCore/dom/TextDecoder.cpp`, `Source/WebCore/dom/TextDecoder.h`, `Source/WebCore/PAL/pal/text/TextCodec.h`, `Source/WebCore/PAL/pal/text/TextEncodingRegistry.cpp`, `Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp`

## Anchors

| ID | File | Line | Source | Meaning |
| --- | --- | ---: | --- | --- |
| `textDecoderDecode` | `Source/WebCore/dom/TextDecoder.cpp` | 55 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/dom/TextDecoder.cpp#L55 | TextDecoder::decode |
| `bufferSourceSpan` | `Source/WebCore/dom/TextDecoder.cpp` | 61 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/dom/TextDecoder.cpp#L61 | BufferSource span extraction |
| `newTextCodec` | `Source/WebCore/dom/TextDecoder.cpp` | 65 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/dom/TextDecoder.cpp#L65 | newTextCodec |
| `stripByteOrderMark` | `Source/WebCore/dom/TextDecoder.cpp` | 67 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/dom/TextDecoder.cpp#L67 | stripByteOrderMark |
| `codecDecodeCall` | `Source/WebCore/dom/TextDecoder.cpp` | 71 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/dom/TextDecoder.cpp#L71 | TextCodec::decode call |
| `fatalErrorHandling` | `Source/WebCore/dom/TextDecoder.cpp` | 77 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/dom/TextDecoder.cpp#L77 | fatal decode error handling |
| `resultReturn` | `Source/WebCore/dom/TextDecoder.cpp` | 78 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/dom/TextDecoder.cpp#L78 | decoded String return |
| `codecMember` | `Source/WebCore/dom/TextDecoder.h` | 63 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/dom/TextDecoder.h#L63 | TextCodec member |
| `textCodecDecodeVirtual` | `Source/WebCore/PAL/pal/text/TextCodec.h` | 53 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/PAL/pal/text/TextCodec.h#L53 | TextCodec decode virtual |
| `textCodecUtf8RegisterNames` | `Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp` | 46 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp#L46 | TextCodecUTF8 registerEncodingNames |
| `textCodecUtf8RegisterUtf8Name` | `Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp` | 49 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp#L49 | UTF-8 encoding name |
| `textCodecUtf8CodecFactory` | `Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp` | 62 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp#L62 | TextCodecUTF8::codec |
| `textCodecUtf8RegisterCodecs` | `Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp` | 67 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp#L67 | TextCodecUTF8 registerCodecs |
| `registryRegistersUtf8` | `Source/WebCore/PAL/pal/text/TextEncodingRegistry.cpp` | 211 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/PAL/pal/text/TextEncodingRegistry.cpp#L211 | registry registers TextCodecUTF8 |
| `registryNewTextCodec` | `Source/WebCore/PAL/pal/text/TextEncodingRegistry.cpp` | 292 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/PAL/pal/text/TextEncodingRegistry.cpp#L292 | newTextCodec registry lookup |
| `registryFallbackUtf8` | `Source/WebCore/PAL/pal/text/TextEncodingRegistry.cpp` | 300 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/PAL/pal/text/TextEncodingRegistry.cpp#L300 | newTextCodec UTF-8 fallback |
| `textCodecUtf8Decode` | `Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp` | 304 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp#L304 | TextCodecUTF8::decode |
| `latin1Buffer` | `Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp` | 314 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp#L314 | Latin1 StringBuffer |
| `asciiFastPath` | `Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp` | 336 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp#L336 | ASCII fast path |
| `copyAsciiMachineWord` | `Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp` | 342 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp#L342 | copyASCIIMachineWord |
| `latin1StringAdopt` | `Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp` | 393 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp#L393 | Latin1 String::adopt |
| `upConvertTo16Bit` | `Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp` | 395 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp#L395 | upConvertTo16Bit label |
| `utf16Buffer` | `Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp` | 396 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp#L396 | UTF-16 StringBuffer |
| `appendCharacter` | `Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp` | 465 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp#L465 | appendCharacter |
| `utf16StringAdopt` | `Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp` | 478 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp#L478 | UTF-16 String::adopt |

## Findings

### bun-patched-webkit-textdecoder-host-api-source-pin

Classification: SOURCE_FACT

The pinned WebKit TextDecoder implementation extracts a BufferSource span, creates a TextCodec, and calls TextCodec::decode to return a WebKit String.

- TextDecoder::decode line 55
- BufferSource span extraction line 61
- newTextCodec line 65
- TextCodec::decode call line 71
- decoded String return line 78

### bun-patched-webkit-utf8-codec-source-pin

Classification: SOURCE_FACT

The pinned WebKit UTF-8 codec registers UTF-8, decodes bytes into StringBuffer storage, uses ASCII fast paths, and adopts Latin1 or UTF-16 buffers into WebKit String values.

- TextCodecUTF8::registerCodecs line 67
- TextCodecUTF8::decode line 304
- Latin1 StringBuffer line 314
- copyASCIIMachineWord line 342
- Latin1 String::adopt line 393
- UTF-16 StringBuffer line 396
- UTF-16 String::adopt line 478

### bun-webkit-source-pin-scope-guard

Classification: SCOPE_GUARD

This source pin explains the WebKit TextDecoder implementation at the Bun-patched WebKit commit. It is not proof that Bun runtime dispatch reaches these exact functions, not Safari/browser coverage, not SpiderMonkey coverage, and not a runtime-ceiling proof.

- The audit does not run a benchmark row.
- The audit does not inspect Bun native dispatch or generated machine code.
- Any 200 MiB/s+ bounded-memory full-string row would still be a counterexample to the broad runtime-limit hypothesis.

## Interpretation

For this Bun-patched WebKit revision, WebKit `TextDecoder.decode()` is implemented as a host-API path that extracts a byte span from `BufferSource`, creates a `TextCodec`, and returns a WebKit `String` from the codec. The UTF-8 codec source decodes into `StringBuffer<Latin1Character>` first, has an ASCII machine-word fast path, and falls back to `StringBuffer<char16_t>` before adopting either buffer into a `String`.

This narrows the WebKit source-boundary gap for the Bun/JSC TextDecoder benchmark commit. It does not by itself prove Bun dispatch, Safari/browser behavior, generated code, or that JavaScript runtimes have no remaining performance headroom.
