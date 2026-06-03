# StAX Public Reader Host API Boundary Audit

Generated: 2026-06-03T04:55:35.708Z

Static source-boundary audit for the current StAX public reader host API surface. It separates primary byte-batch reader globals from string-input convenience, Web stream, and fixture-harness globals; it is not benchmark evidence, codegen evidence, or a runtime-limit conclusion.

## Summary

- All checks pass: true
- Primary sync byte-batch requires TextDecoder: false
- ASCII primary sync byte-batch requires TextDecoder: false
- UTF-8 fallback decoder without TextDecoder: true
- Non-UTF-8 requires TextDecoder: true
- Direct ReadableStream requires ReadableStream: true
- String input requires TextEncoder: true
- Root import requires TextEncoder: false
- Alternate decoder is unchanged closure: false

## Checks

| Check | Source | Matched | Expected |
| --- | --- | --- | --- |
| `iterable-reader-constructs-textdecoder` | `IterableReader.ts` | yes | IterableReader lazily constructs a native TextDecoder when the host provides one. |
| `iterable-reader-decodes-non-ascii-spans` | `IterableReader.ts` | yes | decodeSpan first accepts short ASCII spans, then uses native TextDecoder when available. |
| `iterable-reader-utf8-fallback-without-textdecoder` | `IterableReader.ts` | yes | UTF-8 primary byte-batch materialization has an internal fallback when TextDecoder is unavailable. |
| `iterable-reader-non-utf8-still-requires-textdecoder` | `IterableReader.ts` | yes | Non-UTF-8 decoding still requires host TextDecoder. |
| `iterable-reader-ascii-spans-avoid-textdecoder` | `IterableReader.ts` | yes | ASCII name/text/attribute spans return before getDecoder(), so ASCII primary byte-batch rows do not require TextDecoder. |
| `iterable-reader-public-copy-methods-use-decoder` | `IterableReader.ts` | yes | copyText, copyAttrValue, and copyAttributesObject route public string values through decodeSpan/materializeName. |
| `stream-batch-public-accessors-call-copy-methods` | `stream-reader-core.ts` | yes | StreamBatch public name/text/attribute accessors call source copy methods. |
| `event-reader-requires-web-readable-stream` | `EventReader.ts` | yes | The async public EventReader constructor requires a Web ReadableStream and consumes it through getReader(). |
| `event-reader-sync-string-input-uses-textencoder` | `EventReaderSync.ts` | yes | String-input EventReaderSync lazily encodes document-mode strings through a native TextEncoder before StreamReaderSync. |
| `xml-object-string-input-uses-lazy-textencoder` | `XmlObject.ts` | yes | String-input tree/object helpers lazily encode strings through a native TextEncoder, while byte inputs do not require it. |
| `root-import-no-top-level-textencoder` | `index.ts` | yes | The root barrel can re-export StreamReaderSync, EventReaderSync, and XmlObject without a top-level TextEncoder allocation. |

## Findings

- stax-primary-sync-byte-batch-textdecoder-boundary (SOURCE_FACT): Current primary synchronous UTF-8 Iterable<Uint8Array[]> full-string rows can materialize public strings without host TextDecoder; non-UTF-8 decoding still requires TextDecoder.
  - primarySyncByteBatchRequiresTextDecoder=false
  - primarySyncByteBatchRequiredGlobals=Uint8Array
  - utf8FallbackDecoder=true
  - nonUtf8RequiresTextDecoder=true
  - nativeTextDecoderPreferredWhenAvailable=true
  - asciiPrimarySyncByteBatchRequiresTextDecoder=false
  - asciiPrimarySyncByteBatchRequiredGlobals=Uint8Array
- stax-host-api-substitution-scope-guard (SCOPE_GUARD): A js-shell polyfill or alternate non-StAX decoder can be useful diagnostic evidence, but current UTF-8 byte-batch fallback keeps primary StAX materialization on the public reader path.
  - directReadableStreamRequiresReadableStream=true
  - stringInputRequiresTextEncoder=true
  - alternateDecoderWouldBeUnchangedClosure=false
- stax-root-import-textencoder-not-primary-blocker (SOURCE_FACT): Root imports and primary byte-batch reader access do not require TextEncoder; TextEncoder is limited to string-input convenience paths.
  - rootImportRequiresTextEncoder=false
  - stringInputRequiresTextEncoder=true
  - rootImportRequiredGlobals=none
- stax-ascii-primary-byte-batch-textdecoder-not-blocker (SOURCE_FACT): ASCII primary byte-batch name, text, and attribute accessors can materialize strings through the internal ASCII span path without TextDecoder.
  - asciiPrimarySyncByteBatchRequiresTextDecoder=false
  - asciiPrimarySyncByteBatchRequiredGlobals=Uint8Array
