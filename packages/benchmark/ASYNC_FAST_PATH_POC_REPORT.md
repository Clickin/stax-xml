# Async Fast-Path PoC Report

Generated from:

- Quick run: `packages/benchmark/results/async-fast-path-poc/async-fast-path-poc-1776492336634.md`
- Full run: `packages/benchmark/results/async-fast-path-poc/async-fast-path-poc-1776492294548.md`

## Goal

Validate an experimental async parser that keeps the `v0.5.2` string/event architecture, but replaces whole-buffer concatenation with a tail-carry path:

1. Decode each incoming `Uint8Array` chunk once with `TextDecoder.decode(chunk, { stream: true })`
2. Parse only strings, not byte spans
3. Preserve only incomplete markup tail across chunk boundaries
4. Join accumulated text only when emitting a `CHARACTERS` event

## Implementation Summary

- Added `StaxXmlParserFastPathExperimental`
- Added `test/parser-fast-path.experimental.test.ts`
- Added `packages/benchmark/async-fast-path-poc.ts`
- Added benchmark scripts:
  - `pnpm --filter benchmark run dev:async:fast-path:poc`
  - `pnpm --filter benchmark run bench:async:fast-path:poc`

The experimental parser does **not** retain parsed prefix strings. It only joins:

- incomplete structural tail, when a tag/comment/CDATA/PI crosses chunk boundaries
- pending text segments, when a text event is finally emitted

This is the special path needed to avoid repeated `decoded_1 + decoded_2 + ...` growth as streaming progresses.

The implementation itself is browser-runnable because it uses Web Standard `ReadableStream<Uint8Array>` and `TextDecoder`. This PoC only added Node-side verification and benchmark coverage.

## Full Benchmark Result

### `complex.xml`

| Scenario | Avg ms | Delta vs published | Checksum parity vs published |
| --- | ---: | ---: | --- |
| current | 0.73 | -31.2% | no |
| experimental | 0.42 | -60.2% | yes |
| published-v0.5.2 | 1.06 | baseline | yes |

### `midsize.xml`

| Scenario | Avg ms | Delta vs published | Checksum parity vs published |
| --- | ---: | ---: | --- |
| current | 552.38 | +11.3% | yes |
| experimental | 404.18 | -18.6% | yes |
| published-v0.5.2 | 496.40 | baseline | yes |

## Interpretation

- The experimental parser achieved checksum parity with published `v0.5.2` on both fixtures.
- On the streaming-heavy `midsize.xml` fixture, the experimental parser beat published `v0.5.2` by `18.6%`.
- The current `master` parser remained `11.3%` slower than published on `midsize.xml`.
- On `complex.xml`, current `master` produced a different checksum from published, so its lower time there is not a same-behavior win.

## Takeaways

- The tail-carry special path is sufficient to prevent whole-prefix string growth during streaming.
- The main win came from moving async parsing back to string-native scanning and limiting concatenation to incomplete suffixes.
- The custom iterator shape was kept, but the benchmark result suggests the large gain comes primarily from decode/parsing strategy, not from iterator mechanics alone.

## Remaining Risks

- The experimental parser is browser-compatible in implementation, but this PoC only verified and benchmarked it on the Node side.
- The full package baseline on `master` is already red in unrelated parser/converter tests, so verification here is intentionally targeted.
- The PoC does not yet expose internal metrics for carry frequency or tail size distribution.
