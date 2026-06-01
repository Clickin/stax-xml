# Memory Frontier Audit

Generated: 2026-06-01T19:32:33.798Z

Audits memory classification from the same-contract aggregate. This is not a benchmark run, does not normalize memory models across runtimes, and does not prove a JavaScript runtime ceiling.

## Summary

- Status: classified
- Source artifact: G:\programming\stax-xml\packages\benchmark\results\release\same-contract-runtime-comparison.json
- Rows classified: 239
- JavaScript 1 GiB+ full-string rows: 239
- Bounded rows: 222
- Unbounded or unproven rows: 17
- Bounded rows without numeric memory proof: 0
- Unbounded or unproven rows at or above 200 MiB/s: 0
- Memory kinds: browser-js-heap, browser-js-heap-unavailable, process-rss
- Fastest bounded row: Node/V8 `rawFrameNameId` 185.50 MiB/s (process-rss max 60.45 MiB, `text-trim-cost-decomposition.json`)
- Fastest unbounded or unproven row: Bun/JSC `stringFull` 99.71 MiB/s (process-rss max 1956.69 MiB, `candidate-headroom-cross-process-large-asset-corpus.json`)
- Fastest process RSS row under 128 MiB: Node/V8 `rawFrameNameId` 185.50 MiB/s (process-rss max 60.45 MiB, `text-trim-cost-decomposition.json`)
- Fastest browser JS heap row: Chrome/V8 browser `rawFrameNameId` 69.90 MiB/s (browser-js-heap max 39.55 MiB, `browser-candidate-headroom-large.json`)

## Memory Kind Buckets

| Memory kind | Rows | Bounded | Unbounded or unproven | Max MiB | Fastest row | Fastest bounded row |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| browser-js-heap | 20 | 20 | 0 | 358.37 MiB | Chrome/V8 browser `rawFrameNameId` 69.90 MiB/s (browser-js-heap max 39.55 MiB, `browser-candidate-headroom-large.json`) | Chrome/V8 browser `rawFrameNameId` 69.90 MiB/s (browser-js-heap max 39.55 MiB, `browser-candidate-headroom-large.json`) |
| browser-js-heap-unavailable | 9 | 0 | 9 | n/a | Firefox/SpiderMonkey browser `rawFrameNameId` 64.24 MiB/s (browser-js-heap-unavailable max n/a, `firefox-bidi-candidate-headroom-projection.json`) | none |
| process-rss | 210 | 202 | 8 | 1956.69 MiB | Node/V8 `rawFrameNameId` 185.50 MiB/s (process-rss max 60.45 MiB, `text-trim-cost-decomposition.json`) | Node/V8 `rawFrameNameId` 185.50 MiB/s (process-rss max 60.45 MiB, `text-trim-cost-decomposition.json`) |

## Same-Fixture Process RSS Snapshot

- Caveat: Process RSS values are same-fixture endpoint evidence, not allocation-model equivalence across Java, Rust, and JavaScript runtimes.
- JavaScript: Node/V8 `stax-raw-frame-name-id-batch-8` 152.11 MiB/s, process RSS 61.77 MiB from `file-backed-batch-size-sweep.json`
- Woodstox: Java/Woodstox `woodstox` 351.56 MiB/s, process RSS 312.71 MiB from `file-backed-trim-boundary-check-candidate.json`
- quick-xml: Rust/quick-xml `quick-xml` 274.63 MiB/s, process RSS 4.78 MiB from `file-backed-short-attr-value-cache-candidate.json`

## Findings

| ID | Classification | Summary |
| --- | --- | --- |
| `memory-frontier-classified` | SOURCE_FACT | 222/239 current JavaScript 1 GiB+ full-string rows are bounded under their recorded memory metric. |
| `memory-kinds-not-normalized` | SOURCE_FACT | Process RSS, browser JS heap, and browser host-probe-only rows remain separate memory kinds. |
| `no-unbounded-target-row` | SOURCE_FACT | No current unbounded or unproven-memory JavaScript 1 GiB+ full-string row reaches 200 MiB/s. |
| `firefox-heap-unavailable-not-bounded-proof` | SOURCE_FACT | Firefox/SpiderMonkey browser rows without page JS heap counters remain unbounded or unproven for counterexample purposes. |
| `same-fixture-rss-snapshot-not-allocation-model` | SOURCE_FACT | Same-fixture process RSS rows are endpoint memory evidence and not allocation-model equivalence across JavaScript, Java, and Rust. |

Interpretation: Memory is classified on the same 1 GiB+ JavaScript full-string row set used for counterexample scanning; process RSS, browser JS heap, and browser host-probe-only rows are not normalized into one allocation model.

