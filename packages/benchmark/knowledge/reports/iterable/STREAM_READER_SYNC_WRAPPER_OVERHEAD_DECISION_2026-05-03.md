# StreamReaderSync Wrapper Overhead Decision - 2026-05-03

## Decision

`StreamReaderSync` native/wasm acceleration should treat the current
event-view iterator path as the ergonomic compatibility surface, not as the
only performance surface.

The main regression versus the native addon full-spec control is wrapper/API
shape overhead:

- `for (const event of batch)` creates generator iterator state and per-event
  `StreamEventView` wrappers.
- Count-only workloads still pay object, getter, range-check, and method
  dispatch costs even though no strings are materialized.
- The native parser is already amortized by batch handoff; there is no
  per-event Rust call in the normal native streaming path.

The first production-safe speedup is therefore to expose and benchmark
allocation-light traversal shapes while preserving the public batch/event API.
Full-string string-arena work remains important, but it should follow the
count-only wrapper split because count-only isolates the JS overhead floor.

## Sources

This decision consolidates:

- Gemini research note `260502-gemini-research.md`
- Gemini count-only note `260502-gemini-count-only.md`
- Combined V8 bytecode/optimized-asm bundle
  `.sisyphus/evidence/reader-family-v8/processed/combined-bytecode-asm-for-gemini.md`
- Release benchmark run `2026-05-02T14-40-00-000Z`
- Local smoke run on 2026-05-03 after adding wrapper decomposition rows

The Gemini notes agreed on the same priority order: avoid iterator/event-view
allocation first, prefer simple indexed typed-array loops for count-only, and
defer chunked string/sliced-string arenas to the full-string follow-up.

## Implementation Chosen

The implemented path keeps existing behavior but adds measurement and an
experimental raw traversal surface:

- `StreamBatchView` caches `eventCount` so indexed access does not repeatedly
  re-read active table state for range checks.
- `StreamingEventBatchReader.nextTable()` directly hands the active
  `StreamingSpanTableAdapter` to `StreamBatchView`.
- `StreamingSpanTableAdapter` uses aligned little-endian `Uint32Array` and
  `Int32Array` reads when possible, with `DataView` fallback for unaligned
  tables.
- `StreamReaderSync.nextRawBatch()` returns an experimental low-level raw
  batch:
  - `soa-string-arena` for native streaming parsers that support direct SoA
    string arena fill.
  - `word-table` for aligned native tables, exposing table words directly.
  - `frame` fallback for unaligned table views.
- `node-string-return.mjs` now reports three native wrapper rows:
  - `stream-reader-native`: event-view iterator path.
  - `stream-reader-native-indexed`: public indexed batch accessors.
  - `stream-reader-native-raw`: experimental raw table/frame traversal.
- `cross-runtime-comparison.mjs` documents the indexed and raw rows as wrapper
  decomposition rows, not headline compatibility rows.

This intentionally does not replace the public iterator API. The Rust streaming
parser now has a native SoA string-arena ABI for `StreamReaderSync`, while wasm
and old native backends continue through the span-table fallback.

## Evidence

Quick smoke command:

```sh
pnpm --filter=benchmark exec node --expose-gc node-string-return.mjs \
  --file test-data/runtime-comparison-16mib.xml \
  --tiers count-only,name-string-only,text-string-only,attr-value-string-only,full-string \
  --runs 1 --warmups 0 \
  --json-out /tmp/stax-node-string-return-wrapper-overhead-smoke.json
```

On the 16 MiB runtime-comparison fixture:

| Tier | Event-view | Indexed batch | Raw batch | Raw vs event-view |
| --- | ---: | ---: | ---: | ---: |
| count-only | 175.0 MiB/s | 212.0 MiB/s | 226.0 MiB/s | 1.29x |
| name-string-only | 127.4 MiB/s | 155.2 MiB/s | 131.1 MiB/s | 1.03x |
| text-string-only | 49.0 MiB/s | 52.2 MiB/s | 135.0 MiB/s | 2.76x |
| attr-value-string-only | 49.7 MiB/s | 54.1 MiB/s | 153.5 MiB/s | 3.09x |
| full-string | 34.8 MiB/s | 38.5 MiB/s | 88.4 MiB/s | 2.54x |

All wrapper decomposition rows preserved public wrapper event count and
checksum for the smoke run. The native addon full-spec row still remains much
faster, so this is evidence of the wrapper bottleneck and not a final
performance claim.

An earlier midsize quick smoke showed the same count-only pattern:

| Fixture | Tier | Event-view | Indexed batch | Raw batch |
| --- | --- | ---: | ---: | ---: |
| midsize.xml, 12.96 MiB | count-only | 184.8 MiB/s | 243.5 MiB/s | 268.7 MiB/s |
| midsize.xml, 12.96 MiB | full-string | 114.5 MiB/s | 140.1 MiB/s | 118.0 MiB/s |

The 16 MiB fixture is more representative for string-heavy tiers because the
raw row shows that bypassing `StreamBatchView` string accessor layers can reduce
text and attribute materialization overhead even before native string arenas.

## Guidance For Future Work

Next optimization should target one of two paths:

1. Measure the native SoA string-arena raw row against the prior word-table raw
   row on the standard 16MiB count-only and full-string fixture.
2. Evaluate a JS-owned typed-array fill variant if CppHeap pressure from owned
   native buffers remains visible in Node 24 profiles.
3. Keep arena retention bounded to batch-local strings; do not promote a
   whole-document parent string into the public reader.

Do not remove the event-view row. It is the compatibility/user ergonomics row.
Do not lower the native-addon full-spec gate because the current rows are
evidence of remaining optimization work, not proof that the control is too
strict.

## Verification

Commands run for this decision:

```sh
pnpm --filter=stax-xml test -- stream-reader-sync.test.ts
pnpm --filter=stax-xml build
pnpm --filter=benchmark exec node --test test/release-benchmark-contract.test.mjs
pnpm --filter=benchmark exec node profile-stream-reader-overhead.mjs --self-test
node --check packages/benchmark/cross-runtime-comparison.mjs
node --check packages/benchmark/node-string-return.mjs
node --check packages/benchmark/profile-stream-reader-overhead.mjs
```

Raw generated benchmark outputs should stay out of mainline per repository
policy. Preserve large raw reports on an evidence branch when they need to be
retained.
