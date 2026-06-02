# StAX Public Reader Host API Boundary Audit

Generated: 2026-06-02T15:41:02.747Z

Static source-boundary audit for the current StAX public reader host API surface. It pins the TextDecoder/ReadableStream/TextEncoder boundary used by same-contract full-string rows; it is not benchmark evidence, codegen evidence, or a runtime-limit conclusion.

## Summary

- All checks pass: true
- Primary sync byte-batch requires TextDecoder: true
- Direct ReadableStream requires ReadableStream: true
- String input requires TextEncoder: true
- Alternate decoder is unchanged closure: false

## Checks

| Check | Source | Matched | Expected |
| --- | --- | --- | --- |
| `iterable-reader-constructs-textdecoder` | `IterableReader.ts` | yes | IterableReader constructs a native TextDecoder for byte-span string materialization. |
| `iterable-reader-decodes-non-ascii-spans` | `IterableReader.ts` | yes | decodeSpan falls back to TextDecoder.decode(currentBuffer.subarray(start, end)). |
| `iterable-reader-public-copy-methods-use-decoder` | `IterableReader.ts` | yes | copyText, copyAttrValue, and copyAttributesObject route public string values through decodeSpan/materializeName. |
| `stream-batch-public-accessors-call-copy-methods` | `stream-reader-core.ts` | yes | StreamBatch public name/text/attribute accessors call source copy methods. |
| `event-reader-requires-web-readable-stream` | `EventReader.ts` | yes | The async public EventReader constructor requires a Web ReadableStream and consumes it through getReader(). |
| `event-reader-sync-string-input-uses-textencoder` | `EventReaderSync.ts` | yes | String-input EventReaderSync encodes document-mode strings through a native TextEncoder before StreamReaderSync. |

## Findings

- stax-primary-sync-byte-batch-textdecoder-boundary (SOURCE_FACT): Current primary synchronous Iterable<Uint8Array[]> full-string rows require TextDecoder for public string materialization.
  - primarySyncByteBatchRequiresTextDecoder=true
  - primarySyncByteBatchRequiredGlobals=Uint8Array, TextDecoder
- stax-host-api-substitution-scope-guard (SCOPE_GUARD): A js-shell polyfill or alternate decoder can be useful diagnostic evidence, but it is not unchanged StAX public-reader closure evidence.
  - directReadableStreamRequiresReadableStream=true
  - stringInputRequiresTextEncoder=true
  - alternateDecoderWouldBeUnchangedClosure=false
