# Node TextDecoder Source Pin Audit

Generated: 2026-05-23T23:52:45.038Z

## Scope

This audit pins Node source lines for `TextDecoder.decode()` and its UTF-8 string-creation boundary. It is source evidence for the Node/V8 TextDecoder rows only. It is not a benchmark, not browser TextDecoder coverage, not codegen evidence, and not a runtime-ceiling proof.

## Runtime And Source

- Node: v24.15.0
- V8: 13.6.233.17-node.48
- Repository: nodejs/node
- Revision: v24.15.0
- Files: `lib/internal/encoding.js`, `src/encoding_binding.cc`, `src/string_bytes.cc`

## Anchors

| ID | File | Line | Source | Meaning |
| --- | --- | ---: | --- | --- |
| `textDecoderClass` | `lib/internal/encoding.js` | 430 | https://github.com/nodejs/node/blob/v24.15.0/lib/internal/encoding.js#L430 | TextDecoder class |
| `textDecoderDecode` | `lib/internal/encoding.js` | 482 | https://github.com/nodejs/node/blob/v24.15.0/lib/internal/encoding.js#L482 | TextDecoder.decode |
| `utf8FastPath` | `lib/internal/encoding.js` | 450 | https://github.com/nodejs/node/blob/v24.15.0/lib/internal/encoding.js#L450 | kUTF8FastPath branch |
| `directDecodeUtf8` | `lib/internal/encoding.js` | 494 | https://github.com/nodejs/node/blob/v24.15.0/lib/internal/encoding.js#L494 | direct decodeUTF8 fast path |
| `streamingDecodeUtf8` | `lib/internal/encoding.js` | 524 | https://github.com/nodejs/node/blob/v24.15.0/lib/internal/encoding.js#L524 | streaming decodeUTF8 call |
| `parseInputFunction` | `lib/internal/encoding.js` | 395 | https://github.com/nodejs/node/blob/v24.15.0/lib/internal/encoding.js#L395 | parseInput function |
| `parseInputViewFastBuffer` | `lib/internal/encoding.js` | 404 | https://github.com/nodejs/node/blob/v24.15.0/lib/internal/encoding.js#L404 | ArrayBufferView FastBuffer wrapper |
| `decodeUtf8Binding` | `src/encoding_binding.cc` | 151 | https://github.com/nodejs/node/blob/v24.15.0/src/encoding_binding.cc#L151 | BindingData::DecodeUTF8 |
| `arrayBufferViewContents` | `src/encoding_binding.cc` | 164 | https://github.com/nodejs/node/blob/v24.15.0/src/encoding_binding.cc#L164 | ArrayBufferViewContents<char> |
| `simdutfFatalAsciiValidation` | `src/encoding_binding.cc` | 181 | https://github.com/nodejs/node/blob/v24.15.0/src/encoding_binding.cc#L181 | fatal ASCII validation |
| `bindingStringBytesEncodeUtf8` | `src/encoding_binding.cc` | 203 | https://github.com/nodejs/node/blob/v24.15.0/src/encoding_binding.cc#L203 | DecodeUTF8 StringBytes::Encode UTF8 |
| `stringBytesEncode` | `src/string_bytes.cc` | 503 | https://github.com/nodejs/node/blob/v24.15.0/src/string_bytes.cc#L503 | StringBytes::Encode |
| `stringBytesUtf8Case` | `src/string_bytes.cc` | 541 | https://github.com/nodejs/node/blob/v24.15.0/src/string_bytes.cc#L541 | StringBytes UTF8 case |
| `asciiFastPathCopy` | `src/string_bytes.cc` | 548 | https://github.com/nodejs/node/blob/v24.15.0/src/string_bytes.cc#L548 | UTF8 ASCII fast path NewFromCopy |
| `newFromUtf8Fallback` | `src/string_bytes.cc` | 571 | https://github.com/nodejs/node/blob/v24.15.0/src/string_bytes.cc#L571 | String::NewFromUtf8 fallback |
| `simdutfUtf16Conversion` | `src/string_bytes.cc` | 565 | https://github.com/nodejs/node/blob/v24.15.0/src/string_bytes.cc#L565 | simdutf UTF8 to UTF16 conversion |
| `externalTwoByteNew` | `src/string_bytes.cc` | 567 | https://github.com/nodejs/node/blob/v24.15.0/src/string_bytes.cc#L567 | ExternTwoByteString::New |
| `externStringCopy` | `src/string_bytes.cc` | 92 | https://github.com/nodejs/node/blob/v24.15.0/src/string_bytes.cc#L92 | ExternString NewFromCopy memcpy |
| `newFromOneByte` | `src/string_bytes.cc` | 173 | https://github.com/nodejs/node/blob/v24.15.0/src/string_bytes.cc#L173 | String::NewFromOneByte simple copy |
| `newFromTwoByte` | `src/string_bytes.cc` | 189 | https://github.com/nodejs/node/blob/v24.15.0/src/string_bytes.cc#L189 | String::NewFromTwoByte simple copy |

## Findings

### node-textdecoder-js-fast-path-source-pin

Classification: SOURCE_FACT

Node TextDecoder.decode reaches a UTF-8 fast path that calls the internal decodeUTF8 binding for non-streaming and streaming UTF-8 inputs.

- TextDecoder.decode line 482
- direct decodeUTF8 line 494
- streaming decodeUTF8 line 524

### node-textdecoder-buffer-source-boundary

Classification: SOURCE_FACT

The Node fast path accepts ArrayBuffer and ArrayBufferView input at the binding boundary; stream bookkeeping can wrap ArrayBufferView input as FastBuffer, but the benchmark does not call Buffer.toString().

- parseInput line 395
- ArrayBufferView FastBuffer wrapper line 404
- ArrayBufferViewContents<char> line 164

### node-textdecoder-v8-string-creation-source-pin

Classification: SOURCE_FACT

Node DecodeUTF8 returns JavaScript strings through StringBytes::Encode; its UTF-8 branch uses ASCII copy, simdutf UTF-16 conversion plus external string resource, or V8 String::NewFromUtf8 fallback.

- DecodeUTF8 StringBytes::Encode UTF8 line 203
- ASCII NewFromCopy line 548
- simdutf UTF-16 conversion line 565
- String::NewFromUtf8 fallback line 571

### node-textdecoder-source-pin-scope-guard

Classification: SCOPE_GUARD

These source lines explain the Node TextDecoder boundary only. They are not browser TextDecoder internals, not a JIT/codegen trace, and not evidence that JavaScript runtimes have no remaining headroom.

- The audit does not run a benchmark row.
- The audit does not inspect Blink, WebKit, or SpiderMonkey TextDecoder implementations.
- Any 200 MiB/s+ bounded-memory full-string row would still be a counterexample to the broad runtime-limit hypothesis.

## Interpretation

For this Node revision, `TextDecoder.decode()` is not a hand-written JavaScript string materializer in the benchmark loop. The UTF-8 fast path crosses into Node native binding code and returns V8 strings through `StringBytes::Encode`. That source boundary explains why Node TextDecoder rows must be interpreted as Node/V8 host-API evidence, not as proof about Blink, WebKit, SpiderMonkey, or all JavaScript runtimes.

The source pin also does not make Node `Buffer.toString()` a neutral browser-compatible lane. The benchmark rows still avoid direct `Buffer.toString()` calls, native addons, and lazy getters; this audit only documents Node internal implementation boundaries for the standard `TextDecoder` API.
