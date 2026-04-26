# Structural Index Acceleration Plan - 2026-04-26

## Goal

Add a converter/query-oriented flat structural index MVP without replacing the existing StAX pull parser. The index is an optional acceleration surface for compiled converter workloads that can consume a complete input buffer and then dispatch over table rows.

The public event parser remains a regression-gated baseline. Converter acceleration must not change the core `StaxXmlIterableParser` hot path unless the change is separately justified, benchmarked, and covered by parser/parity tests.

## ABI Lock

The MVP table keeps the existing compact span-table wire shape as ABI v1 and reserves the header flags word for source-kind metadata:

| Offset | Type | Meaning |
| --- | --- | --- |
| 0 | u32 | magic `0x31545053` |
| 4 | u32 | event count |
| 8 | u32 | attribute count |
| 12 | u32 | input units |
| 16 | u32 | event stride bytes, currently `28` |
| 20 | u32 | attr stride bytes, currently `16` |
| 24 | u32 | flags, low byte `0=utf16`, `1=utf8` |

Event records are array-of-struct rows for the MVP: event type, name start/end, text start/end, attr start/count. Attribute records are name start/end and value start/end. This is compatible with the prior span-table reader while making source kind explicit. A future SoA v2 can be added behind a new magic/version without changing the JS wrapper contract.

String inputs use UTF-16 code-unit offsets. `Uint8Array` and Node `Buffer` inputs use UTF-8 byte offsets. The JS wrapper keeps both the input view and native index buffer alive so span access cannot outlive either allocation.

The native table return uses the N-API Buffer ownership path so the final Rust `Vec<u8>` is handed to JavaScript without an extra Rust-to-JS byte copy. The current v1 builder writes event rows directly into the final table and keeps a side attribute byte buffer until the final event count fixes the attribute base offset.

## Runtime Semantics

`ParseInput` now accepts `ArrayBufferView` for async converter parsing. `ParseOptions.acceleration` is optional:

- `backend`: `auto`, `js`, `native`, or `wasm`; default is `auto`.
- `simd`: `auto-safe`, `off`, or explicit `avx2`; default is `auto-safe`.
- `fallbackOnParseError`: defaults to `false`.

Backend load and capability failures fall back to the JavaScript iterable parser. XML parse errors and ABI validation errors throw by default; setting `fallbackOnParseError` retries the JavaScript parser. Explicit `avx2` is reserved until a same-ABI AVX2 classifier exists, so the MVP declines that path instead of silently taking unsafe SIMD.

## Wrapper Contract

`StaxXmlStructuralIndexParser` implements `IterableEventTable` and can be passed to compiled converters before iterator consumption. It exposes `copyAttrValueByName(eventIndex, name)` as an optional fast lookup hook while preserving the existing `copyAttrName` and `copyAttrValue` APIs.

The MVP also includes native rows projections over the generic structural table. The fastest path remains the representative compiled plan shape: a root array selected by `//item` whose item object reads `./@id`, `./name`, and `./value`; `CompiledRootProcessor` uses this when the selected backend exports `parseItemRowsViaTableUint8Array`.

The next bounded lowering path accepts a descriptor for root array/object plans whose item selector is a single descendant element and whose fields are scalar relative attributes or scalar one-segment relative child elements. Native returns columnar field arrays through `parseObjectRowsViaTableUint8Array`, and TypeScript reconstructs objects while applying compiled scalar parsing so number validation and entity decoding semantics remain owned by the converter. Unsupported plans and missing backend capabilities fall back to the existing table or JavaScript paths. The direct projection parser remains only an upper-bound comparator.

Span materialization rules:

- UTF-16 source: `input.slice(start, end)`.
- Node Buffer source: `input.toString('utf8', start, end)`.
- Other byte views: shared `TextDecoder.decode(view.subarray(start, end))`.

## Deferred

The MVP defers full XPath execution in native code, nested object/array native lowering, persistent `.sxi` files, bloom filters, parallel chunk parsing, mutable arena/tombstone editing, and AVX2 default enablement. Reopen those only if benchmark evidence shows index build cost, query selectivity, repeated-query workload, or multi-core throughput as the next blocker.

## Evidence Policy

Raw generated benchmark bundles under `packages/benchmark/knowledge/reports/**` should be preserved on an evidence branch per repository policy. Mainline should keep this ABI plan, curated summaries, and reproduction commands.
