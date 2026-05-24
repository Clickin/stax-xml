# Deno TextDecoder Source Pin Audit

Generated: 2026-05-24T16:49:30.963Z

Exact Deno source-line pinning for TextDecoder.decode in Deno 2.7.13. These source facts constrain the Deno TextDecoder host boundary for the Deno/V8 TextDecoder benchmark rows; they are not codegen evidence or a throughput proof.

## Runtime

- Deno: 2.7.13
- V8: 14.7.173.20-rusty
- Source revision: v2.7.13

## Anchors

| Anchor | File | Line | URL |
| --- | --- | ---: | --- |
| TextDecoder encoding op imports | ext/web/08_text_encoding.js | 21 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/08_text_encoding.js#L21 |
| TextDecoder class | ext/web/08_text_encoding.js | 50 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/08_text_encoding.js#L50 |
| TextDecoder constructor | ext/web/08_text_encoding.js | 67 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/08_text_encoding.js#L67 |
| UTF-8 label fast path | ext/web/08_text_encoding.js | 75 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/08_text_encoding.js#L75 |
| UTF-8 single-pass flag | ext/web/08_text_encoding.js | 87 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/08_text_encoding.js#L87 |
| TextDecoder.decode method | ext/web/08_text_encoding.js | 113 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/08_text_encoding.js#L113 |
| Uint8Array validation fast path | ext/web/08_text_encoding.js | 116 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/08_text_encoding.js#L116 |
| TypedArray buffer extraction | ext/web/08_text_encoding.js | 146 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/08_text_encoding.js#L146 |
| SharedArrayBuffer clone boundary | ext/web/08_text_encoding.js | 156 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/08_text_encoding.js#L156 |
| single-pass decode fast path | ext/web/08_text_encoding.js | 181 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/08_text_encoding.js#L181 |
| op_encoding_decode_utf8 call | ext/web/08_text_encoding.js | 185 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/08_text_encoding.js#L185 |
| op_encoding_decode_single call | ext/web/08_text_encoding.js | 188 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/08_text_encoding.js#L188 |
| op_encoding_new_decoder call | ext/web/08_text_encoding.js | 197 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/08_text_encoding.js#L197 |
| op_encoding_decode streaming call | ext/web/08_text_encoding.js | 203 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/08_text_encoding.js#L203 |
| deno_web extension op registration | ext/web/lib.rs | 71 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/lib.rs#L71 |
| op_encoding_decode_utf8 function | ext/web/lib.rs | 494 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/lib.rs#L494 |
| op_encoding_decode_utf8 anybuffer input | ext/web/lib.rs | 496 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/lib.rs#L496 |
| UTF-8 BOM skip | ext/web/lib.rs | 503 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/lib.rs#L503 |
| v8::String::new_from_utf8 return | ext/web/lib.rs | 520 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/lib.rs#L520 |
| op_encoding_decode_single function | ext/web/lib.rs | 528 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/lib.rs#L528 |
| encoding_rs max UTF-16 buffer length | ext/web/lib.rs | 544 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/lib.rs#L544 |
| UTF-16 output Vec allocation | ext/web/lib.rs | 547 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/lib.rs#L547 |
| encoding_rs decode_to_utf16 | ext/web/lib.rs | 562 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/lib.rs#L562 |
| U16String return | ext/web/lib.rs | 555 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/lib.rs#L555 |
| op_encoding_decode streaming function | ext/web/lib.rs | 597 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/lib.rs#L597 |
| TextDecoderResource decoder state | ext/web/lib.rs | 635 | https://github.com/denoland/deno/blob/v2.7.13/ext/web/lib.rs#L635 |

## Findings

- deno-textdecoder-js-dispatch-source-pin (SOURCE_FACT): Deno implements TextDecoder in ext/web/08_text_encoding.js and routes default non-fatal UTF-8 single-pass decode to op_encoding_decode_utf8.
  - TextDecoder class line 50
  - decode method line 113
  - UTF-8 single-pass flag line 87
  - op_encoding_decode_utf8 call line 185
- deno-textdecoder-input-boundary-source-pin (SOURCE_FACT): Deno skips full BufferSource validation for non-shared Uint8Array input, extracts ArrayBuffer storage for typed arrays, and clones SharedArrayBuffer-backed input before passing it to Rust.
  - Uint8Array validation fast path line 116
  - TypedArray buffer extraction line 146
  - SharedArrayBuffer clone boundary line 156
- deno-textdecoder-v8-string-creation-source-pin (SOURCE_FACT): Deno op_encoding_decode_utf8 takes a zero-copy anybuffer byte slice and creates the JavaScript result through v8::String::new_from_utf8.
  - op_encoding_decode_utf8 function line 494
  - #[anybuffer] input line 496
  - v8::String::new_from_utf8 line 520
- deno-textdecoder-non-utf8-streaming-source-pin (SOURCE_FACT): For non-UTF-8 or streaming paths, Deno uses encoding_rs decoders, allocates a UTF-16 output Vec sized by max_utf16_buffer_length, and returns U16String.
  - op_encoding_decode_single function line 528
  - max_utf16_buffer_length line 544
  - output Vec line 547
  - decode_to_utf16 line 562
  - U16String return line 555
- deno-textdecoder-source-pin-scope-guard (SCOPE_GUARD): This pins Deno TextDecoder source boundaries only. It is not V8 optimized-code evidence, allocation census evidence, Safari/WebKit coverage, or an impossibility proof.
  - Deno source revision v2.7.13
  - Deno 2.7.13
  - V8 14.7.173.20-rusty
