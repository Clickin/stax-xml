# SpiderMonkey JS Shell Materialized Headroom

Generated: 2026-06-02T15:41:32.371Z

Runs a SpiderMonkey js-shell ASCII XML workload that materializes JS string primitives and event-shaped objects. This is closer to the public StAX object surface than token-boundary scanning, but it still does not use TextDecoder, ReadableStream, or the unchanged public StAX reader, and it has no row-level memory proof.

## Summary

- Rows: 2
- Fastest row: nightly-spidermonkey-materialized-string-object at 37.61 MiB/s
- Same semantic checksum rows: 2
- 200 MiB/s bounded full-string counterexamples: 0
- Partial rows at or above 200 MiB/s: 0
- Rows with memory proof: 0

## Rows

| Row | Runtime | MiB/s | Full StAX parity | Semantic fields | Memory proof | Strings | Objects |
| --- | --- | ---: | --- | --- | --- | ---: | ---: |
| `release-spidermonkey-materialized-string-object` | JavaScript-C143.0.1 | 33.97 | no | yes | none | 980607 | 892131 |
| `nightly-spidermonkey-materialized-string-object` | JavaScript-C153.0a1 | 37.61 | no | yes | none | 980607 | 892131 |

## Findings

- spidermonkey-materialized-headroom (LIMITED_EVIDENCE_PRESENT): Fastest SpiderMonkey js-shell materialized string/object row is 37.61 MiB/s.
  - row=nightly-spidermonkey-materialized-string-object
  - sameSemanticChecksumFields=true
  - fullStringParity=false
- materialized-headroom-not-stax-counterexample (SCOPE_GUARD): The materialized js-shell rows are not 200 MiB/s full-string bounded-memory counterexamples.
  - counterexampleRows=0
  - memoryProofRows=0
  - TextDecoder/ReadableStream/public StAX reader unchanged execution remains blocked.

