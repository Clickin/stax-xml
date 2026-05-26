# Segment Tokenizer String Frontier

Generated: 2026-05-26T19:34:55.994Z

Benchmark-only probe that keeps the same demand-driven synchronous Iterable<Uint8Array[]> grouped segment source and incrementally adds browser-compatible TextDecoder string materialization to the token-boundary scanner. Rows are partial headroom evidence and not full StAX counterexamples because they do not expose public event objects or validate the full XML contract.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 32
- Grouped batch size: 8
- Fastest row: allTokenStringsDocumentEventsNoObjects 42.58 MiB/s
- All strings / token-only ratio: n/ax
- Full-checksum segmented candidate: 42.58 MiB/s
- Full-checksum candidate matches StreamReaderSync reference: yes
- 200 MiB/s bounded full-string counterexamples: 0
- StreamReaderSync reference: 61236571 events, checksum -716099804

## Rows

| Row | MiB/s | Samples | Spread | Bounded | Max RSS | Events | Strings | Decode calls | Cache hits | Cache misses | Cache bypass | Cached entries | Decoded bytes | Checksum |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `allTokenStringsDocumentEventsNoObjects` | 42.58 | 3 | 2.41% | yes | 96.15 MiB | 61236571 | 97258079 | 97258079 | 0 | 0 | 0 | 0 | 882827595 | -716099804 |

## Findings

- same-token-boundary-contract (CONTRACT_FACT): All rows consume the same grouped file-backed sync Iterable<Uint8Array[]> source and preserve token boundary counters.
  - 61236571:21612907:21612907:18010755:18010755
- string-materialization-frontier (BENCH_FACT): Token-only and all-string rows were not both measured.
  - allTokenStringsDocumentEventsNoObjects: 42.58 MiB/s, strings=97258079, decodeCalls=97258079, cacheHits=0, cacheBypass=0, decodedBytes=882827595
- partial-not-stax-counterexample (SCOPE_GUARD): These rows use browser-compatible TextDecoder and deliberately avoid Node Buffer and native addons, but they still do not expose public event objects or claim full StAX checksum parity.
  - allTokenStringsDocumentEventsNoObjects: fullStringParity=true, usesTextDecoder=true, usesNodeBuffer=false
- full-checksum-segmented-candidate (BENCH_FACT): The document-event segmented row matched the StreamReaderSync reference at 42.58 MiB/s.
  - candidate=61236571:-716099804
  - reference=61236571:-716099804
  - fullStringParity=true
  - counterexampleEligible=true

## Limits

- This is a string-materialization frontier over a simplified token-boundary scanner, not the public StAX reader.
- Rows are not full-string parity rows and cannot be counted as runtime-limit counterexamples.
- The benchmark intentionally uses TextDecoder, not Node Buffer, native addons, or lazy getters.

