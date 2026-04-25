# Rust Native Chunk-Aggregate Optimization

Generated: 2026-04-24

## Scope

This remains a benchmark-only Rust/N-API lab under `packages/benchmark`.
No public package export, browser path, or Node-only product variant was added.

The optimization follows the quick-xml baseline direction:

- keep the native boundary coarse;
- preserve full parser aggregate parity;
- prioritize attribute/materialization costs for `attr-heavy` and
  `high-cardinality`;
- do not blindly replace short scalar loops with `memchr3`.

## Implemented Candidate

- Replaced heap-first attribute span collection with `AttrSpans`, an inline
  16-span table with overflow only beyond the native spike fixture shape.
- Kept no-attribute events on `None`, and now also skips constructing an
  `AttrSpans` value for start tags without attributes.
- Switched quoted attribute value tail scanning from scalar byte stepping to
  `memchr(quote, ...)`.
- Added an ASCII fast path to checksum folding while preserving UTF-16 checksum
  parity for non-ASCII text.
- Removed `String` allocation from `full-string-direct`; that tier now folds
  `&str` spans directly and only validates UTF-8.
- Removed the closure-based `AttrSpans::for_each` path in favor of a direct
  `AttrSpanIter` loop.
- Added Rust regression tests for quoted `>` handling, incomplete quoted tails,
  inline attr-heavy shape, attr iteration order, span folding, and checksum
  parity.

Rejected during iteration:

- Full `find_tag_end` replacement with `memchr3('"', '\'', '>')`. It matched
  the quick-xml idea too mechanically and regressed short-tag fixture runs, so
  it was not kept.

## Verification

Commands:

```bash
cd packages/benchmark/native/rust-aggregate
cargo fmt --check
cargo test --release --offline
cargo rustc --release --offline -- --emit=asm

cd ../../..
pnpm --filter benchmark run build:native-aggregate -- --offline
pnpm --filter benchmark run smoke:native-aggregate
node --check packages/benchmark/rust-native-chunk-aggregate.mjs
node --check packages/benchmark/native/rust-aggregate/build.mjs
node --check packages/benchmark/native/rust-aggregate/smoke.mjs
node --expose-gc packages/benchmark/rust-native-chunk-aggregate.mjs --sizes-mib 16 --fixtures quoted-gt,attr-heavy,high-cardinality,mixed-utf8 --tiers full-string-direct,event-object-full --scenarios js-node,native-buffer --runs 3 --warmups 1 --no-progress
node --expose-gc packages/benchmark/rust-native-chunk-aggregate.mjs --sizes-mib 128 --fixtures quoted-gt,attr-heavy,high-cardinality,mixed-utf8 --tiers full-string-direct,event-object-full --scenarios js-node,native-buffer --runs 3 --warmups 1 --no-progress
```

Artifacts:

- `RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T14-44-29-665Z.json`
- `RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T14-44-29-665Z.md`
- `RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T14-45-35-133Z.json`
- `RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T14-45-35-133Z.md`

The DLL export table still contains only `napi_register_module_v1`.

## 128 MiB Gate

Status: pass

| Fixture | Tier | JS MiB/s | Native MiB/s | Native improvement |
| --- | --- | ---: | ---: | ---: |
| `quoted-gt` | `full-string-direct` | 92.1 | 427.3 | 364.0% |
| `quoted-gt` | `event-object-full` | 83.2 | 162.4 | 95.2% |
| `attr-heavy` | `full-string-direct` | 101.6 | 446.8 | 339.8% |
| `attr-heavy` | `event-object-full` | 89.2 | 154.7 | 73.5% |
| `high-cardinality` | `full-string-direct` | 99.6 | 504.9 | 407.2% |
| `high-cardinality` | `event-object-full` | 92.2 | 195.8 | 112.3% |
| `mixed-utf8` | `full-string-direct` | 95.9 | 462.2 | 382.1% |
| `mixed-utf8` | `event-object-full` | 84.5 | 194.2 | 129.8% |

## Regression Fix Confirmation

Compared with the previous candidate
`RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T14-36-10-378Z.json`.

| Fixture | Tier | Before MiB/s | After MiB/s | Delta |
| --- | --- | ---: | ---: | ---: |
| `quoted-gt` | `full-string-direct` | 190.4 | 427.3 | 124.4% |
| `quoted-gt` | `event-object-full` | 142.7 | 162.4 | 13.9% |
| `attr-heavy` | `full-string-direct` | 164.0 | 446.8 | 172.4% |
| `attr-heavy` | `event-object-full` | 154.6 | 154.7 | 0.0% |
| `high-cardinality` | `full-string-direct` | 244.8 | 504.9 | 106.3% |
| `high-cardinality` | `event-object-full` | 192.7 | 195.8 | 1.6% |
| `mixed-utf8` | `full-string-direct` | 222.8 | 462.2 | 107.5% |
| `mixed-utf8` | `event-object-full` | 186.8 | 194.2 | 4.0% |

All compared rows preserved event count and checksum parity.

Compared with the first native aggregate report
`RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T13-52-00-318Z.json`.

| Fixture | Tier | Baseline MiB/s | Final MiB/s | Delta |
| --- | --- | ---: | ---: | ---: |
| `quoted-gt` | `full-string-direct` | 177.9 | 427.3 | 140.2% |
| `quoted-gt` | `event-object-full` | 150.9 | 162.4 | 7.6% |
| `attr-heavy` | `full-string-direct` | 166.5 | 446.8 | 168.2% |
| `attr-heavy` | `event-object-full` | 120.6 | 154.7 | 28.2% |
| `high-cardinality` | `full-string-direct` | 218.9 | 504.9 | 130.7% |
| `high-cardinality` | `event-object-full` | 182.3 | 195.8 | 7.4% |
| `mixed-utf8` | `full-string-direct` | 217.1 | 462.2 | 112.9% |
| `mixed-utf8` | `event-object-full` | 181.3 | 194.2 | 7.1% |

All compared rows preserved event count and checksum parity.

## Read

The approved regression fixes worked. The previous `quoted-gt/event-object-full`
and `attr-heavy/full-string-direct` regressions are gone at 128 MiB. The biggest
remaining product-direction question is not raw native throughput but API shape:
this still returns aggregate benchmark results through one native call and does
not yet prove a user-facing Node parser/materializer interface.
