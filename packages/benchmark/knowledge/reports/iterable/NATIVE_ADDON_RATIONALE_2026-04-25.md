# Native Addon Rationale

Date: 2026-04-25
Audience: release review / benchmark review / future optimizer agents
Repository: `G:\programming\stax-xml-spike-rust-native`

## Decision

`stax-xml` should keep the public facade package and keep the JavaScript parser
as the compatibility fallback, but the release performance ceiling should move
to optional Rust native and Wasm acceleration packages.

This is not a decision to remove the JavaScript implementation. It is a
decision to stop treating pure JavaScript loop-shape work as the primary path
for closing the remaining gap against native XML parsers under user-facing
string-return workloads.

## Evidence Summary

The current release benchmark set has three relevant layers:

- Node ecosystem comparison against other JavaScript XML packages:
  `packages/benchmark/results/release/latest-summary.json`
- JavaScript runtime matrix for the same built `stax-xml` implementation on
  Node, Bun, and Deno:
  `packages/benchmark/results/release/runtime-matrix.json`
- Cross-runtime comparator for `stax-xml` on Node, Woodstox on Java 8, and
  `quick-xml`:
  `packages/benchmark/results/release/cross-runtime-comparison.json`

Those release-result tables do not use the `stax-xml` native addon. They show
the JavaScript fallback/runtime ceiling and the external native baselines that
the native direction is trying to reach. The actual native addon evidence is
preserved separately in the benchmark-only Rust/N-API spike reports under
`packages/benchmark/knowledge/reports/iterable/`.

The runtime matrix shows that the iterable event-frame backend is useful and
portable, but still bounded by each JavaScript runtime's code generation and
string materialization behavior:

| Runtime | iterable count-only | iterable full-string |
| --- | ---: | ---: |
| Node 24.15.0 | 197.1 MiB/s | 112.6 MiB/s |
| Bun 1.3.13 | 265.8 MiB/s | 158.9 MiB/s |
| Deno 2.7.13 | 204.0 MiB/s | 123.0 MiB/s |

The cross-runtime comparator is the stronger release signal because it uses the
same event-count and checksum contract for `stax-xml` on Node and external
native parsers:

| Tier | stax-xml on Node | Woodstox Java 8 | quick-xml |
| --- | ---: | ---: | ---: |
| count-only | 182.7 MiB/s | 309.4 MiB/s | 303.4 MiB/s |
| name-string-only | 138.2 MiB/s | 323.1 MiB/s | 256.5 MiB/s |
| text-string-only | 104.8 MiB/s | 316.2 MiB/s | 271.0 MiB/s |
| attr-value-string-only | 113.6 MiB/s | 294.1 MiB/s | 297.3 MiB/s |
| full-string | 93.1 MiB/s | 246.0 MiB/s | 214.8 MiB/s |

The `stax-xml on Node` column above is still JavaScript fallback throughput.
The native addon spike is not mixed directly into that table because it was
run on a different host, with different 128 MiB fixtures, and through a
benchmark-only aggregate API. As an overlay, it shows the intended native
ceiling much more clearly:

| Evidence row | Scope | Throughput | Improvement |
| --- | --- | ---: | ---: |
| `stax-xml` JS fallback | release comparator `full-string`, 16 MiB fixture | 93.1 MiB/s | baseline for release comparator |
| Woodstox Java 8 | release comparator `full-string`, same 16 MiB fixture | 246.0 MiB/s | +164.2% vs release JS |
| `quick-xml` | release comparator `full-string`, same 16 MiB fixture | 214.8 MiB/s | +130.7% vs release JS |
| `stax-xml` native-buffer spike | benchmark-only `full-string-direct`, 128 MiB fixture average | 481.9 MiB/s | +296.5% vs spike JS |
| `stax-xml` native-file spike | benchmark-only `full-string-direct`, 128 MiB fixture average | 441.3 MiB/s | +263.2% vs spike JS |

This is the clearest performance story: the JavaScript fallback is below the
native parser baselines, while the coarse Rust/N-API aggregate spike moves
`stax-xml` beyond those baselines on its measured fixtures. The remaining
release work is to turn that spike boundary into a product parser/converter
backend without changing the public facade.

The important part is not just that native parsers are faster. The important
part is where the gap appears. Even count-only traversal is behind native
baselines, and full-string workloads widen the gap once element names, text,
attribute names, and attribute values are folded into the checksum. That is the
actual public-performance contract for this project: not raw byte traversal,
but string-return parser and converter consumers.

Woodstox was also checked on Java 25. Java 8 remains the public Woodstox
baseline because it is the minimum supported Woodstox runtime, and the Java 25
check did not reverse the conclusion.

## Native Addon Improvement Evidence

The benchmark-only Rust/N-API chunk-aggregate spike did use a native addon. Its
latest preserved report is:

- `packages/benchmark/knowledge/reports/iterable/RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T15-16-45-159Z.json`
- `packages/benchmark/knowledge/reports/iterable/RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T15-16-45-159Z.md`

That spike is not yet a public parser API. It uses a coarse native boundary:
one native call per preloaded `Buffer` (`native-buffer`) or one native file read
inside Rust (`native-file`), never one Node-API call per XML event. Checksum and
event-count parity were enforced against the JS parser for every measured row.

The release-relevant signal is the 128 MiB `full-string-direct` tier, because
it folds element names, text, attribute names, and attribute values into the
checksum without hiding string-return costs behind byte-only traversal:

| Fixture | JS node iterable | Native buffer | Buffer improvement | Native file | File improvement |
| --- | ---: | ---: | ---: | ---: | ---: |
| quoted-gt | 106.9 MiB/s | 469.7 MiB/s | +339.4% | 430.9 MiB/s | +303.1% |
| attr-heavy | 121.5 MiB/s | 453.0 MiB/s | +273.0% | 419.3 MiB/s | +245.2% |
| high-cardinality | 129.5 MiB/s | 519.1 MiB/s | +300.9% | 473.8 MiB/s | +265.9% |
| mixed-utf8 | 130.3 MiB/s | 485.7 MiB/s | +272.7% | 441.1 MiB/s | +238.5% |

Average throughput across those four fixtures was:

| Scenario | Average throughput | Average improvement vs JS |
| --- | ---: | ---: |
| JS node iterable | 122.0 MiB/s | baseline |
| Native buffer | 481.9 MiB/s | +296.5% |
| Native file | 441.3 MiB/s | +263.2% |

The same report also measured `event-object-full`, which is closer to a
materialized event-object workload than the direct checksum tier:

| Fixture | JS node iterable | Native buffer | Buffer improvement | Native file | File improvement |
| --- | ---: | ---: | ---: | ---: | ---: |
| quoted-gt | 97.6 MiB/s | 243.9 MiB/s | +149.9% | 232.8 MiB/s | +138.5% |
| attr-heavy | 114.9 MiB/s | 232.6 MiB/s | +102.4% | 222.9 MiB/s | +94.0% |
| high-cardinality | 114.7 MiB/s | 298.6 MiB/s | +160.3% | 283.1 MiB/s | +146.8% |
| mixed-utf8 | 102.1 MiB/s | 291.2 MiB/s | +185.2% | 274.6 MiB/s | +168.9% |

This is the concrete reason to invest in the native addon path: the native
spike reached roughly 3.7x-4.0x the JS full-string throughput through the
preloaded-buffer boundary and roughly 3.4x-4.0x through the native-file
boundary on the measured 128 MiB fixtures, with parity checks. The remaining
work is not to prove that native can be faster; it is to turn this
benchmark-only coarse aggregate boundary into a release-grade parser/converter
integration without breaking the public facade or falling into per-event FFI
overhead.

## Why Pure JavaScript Is No Longer The Acceleration Ceiling

The prior iterable parser optimization work was valuable. It produced the
browser-compatible byte-batch backend, typed-array-backed event frames, name
interning, cursor integration, converter integration, runtime benchmark
fixtures, and a clearer split between count-only and string-return costs.

It did not produce a credible path to Woodstox-class or `quick-xml`-class
string-return throughput in pure JavaScript.

The remaining bottlenecks sit in places JavaScript is structurally weak for
this workload:

- delimiter scanning wants a tight native/vectorized primitive, closer to
  `memchr`/SIMD than to repeated JavaScript byte loops;
- UTF-8 string materialization crosses runtime-specific boundaries such as
  `TextDecoder`, `Buffer.toString`, substring allocation, and GC behavior;
- public event objects, cursor views, attributes, namespace state, and converter
  state machines impose shape stability and allocation constraints that are
  difficult to remove without breaking API semantics;
- speculative caches, lazy string access, and branch-heavy fast paths often
  move cost rather than remove it, especially when hit rate and branch
  predictability vary by XML shape;
- per-event native calls would be the wrong boundary because crossing Node-API
  for each event would trade parser cost for FFI overhead.

The conclusion is therefore narrower than "JavaScript is slow." The conclusion
is that the current StAX-style, user-facing, string-return contract needs a
coarser native boundary for the hot tokenizer and aggregation work if the goal
is to approach native parser baselines.

## Why Rust Native Addons

Rust is the right native boundary for this project because it lets the parser
move the expensive parts into code that can be optimized like the native
comparators while keeping the JavaScript package contract stable.

The intended native boundary is coarse-grained:

- scan byte chunks in native code;
- aggregate event/string/span results before returning to JavaScript;
- avoid one Node-API call per XML event;
- preserve the same checksum/event-count semantics used by the JavaScript,
  Woodstox, and `quick-xml` benchmark runners;
- keep parser/cursor/converter behavior behind the existing `stax-xml` facade.

This direction also aligns with the native parser designs we are comparing
against. `quick-xml` benefits from Rust-level byte scanning and native string
handling. simdjson-style parsers show the same general lesson for structured
text: the delimiter and classification passes are where native/vectorized
execution matters most.

## Packaging Boundary

The package topology should stay:

- `stax-xml` as the public facade and compatibility package;
- exact-version optional native packages under `@stax-xml/*`;
- native first where supported, Wasm where supported, JavaScript fallback
  everywhere else.

This keeps the migration cost low. Users who only need the current public API
do not switch imports, and deployments that disallow native artifacts can keep
using JavaScript. Native packages become acceleration artifacts, not a hard
runtime dependency.

## What This Does Not Claim

This rationale does not claim:

- native will make every XML shape faster;
- JavaScript fallback can be neglected;
- browser parsing should use Node native addons;
- a per-event Node-API binding is acceptable;
- benchmark numbers are universal across hardware;
- release is ready without platform package smoke tests.

It only claims that the benchmark evidence no longer supports pure JavaScript
as the main path to the desired string-return performance target.

## Release-Facing Wording

Use wording like this in README/docs:

> The pure JavaScript parser remains the compatibility fallback, but it is not
> the release performance ceiling. Runtime and cross-runtime benchmarks show
> that V8-friendly loop-shape work improved the iterable backend but did not
> close the full-string gap against native parser baselines such as Woodstox
> and `quick-xml`. Rust native addons move tokenizer and string/span aggregation
> work to a coarse native boundary that can use native and SIMD-oriented
> scanning strategies, while `stax-xml` keeps the same public facade and falls
> back to JavaScript when binaries are unavailable or unwanted.

Avoid wording like this:

- "JavaScript is too slow."
- "Native is always faster."
- "The JavaScript parser is deprecated."
- "Users must install native packages."
- "The benchmark proves all production workloads will improve."

## Follow-Up Checks

Before publishing this direction as `latest`, verify:

- tarball install smoke from packed artifacts, not workspace links;
- correct optional dependency selection on Linux glibc, Linux musl, macOS,
  Windows, and arm64 runners;
- fallback behavior when optional dependencies are omitted;
- Node, Bun, Deno, and browser docs still describe their default-safe paths;
- Rust native branch coverage and JS branch coverage remain at the release
  gate;
- generated benchmark docs still flow through
  `packages/benchmark/update-release-benchmarks.mjs`.
