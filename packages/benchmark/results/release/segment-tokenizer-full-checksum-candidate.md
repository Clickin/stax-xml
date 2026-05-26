# Segment Tokenizer String Frontier

Generated: 2026-05-26T21:38:54.661Z

Benchmark-only probe that keeps the same demand-driven synchronous Iterable<Uint8Array[]> grouped segment source and incrementally adds browser-compatible TextDecoder string materialization to the token-boundary scanner. Most rows are partial headroom evidence; full-checksum rows validate the StreamReaderSync checksum but still do not expose public event objects.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 32
- Grouped batch size: 8
- Fastest row: allTokenStringsNameCachedDocumentEventsNoObjects 52.73 MiB/s
- All strings / token-only ratio: n/ax
- Full-checksum segmented candidate: 41.20 MiB/s
- Full-checksum candidate matches StreamReaderSync reference: yes
- Fastest full-checksum segmented candidate: allTokenStringsNameCachedDocumentEventsNoObjects 52.73 MiB/s
- 200 MiB/s bounded full-string counterexamples: 0
- StreamReaderSync reference: 61236571 events, checksum -716099804

## Rows

| Row | MiB/s | Samples | Spread | Bounded | Max RSS | Events | Strings | Decode calls | Cache hits | Cache misses | Cache bypass | Cached entries | Decoded bytes | Checksum |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `allTokenStringsDocumentEventsNoObjects` | 41.20 | 3 | 2.06% | yes | 127.84 MiB | 61236571 | 97258079 | 97258079 | 0 | 0 | 0 | 0 | 882827595 | -716099804 |
| `allTokenStringsNameCachedDocumentEventsNoObjects` | 52.73 | 3 | 4.03% | yes | 97.78 MiB | 61236571 | 97258079 | 36021520 | 61236559 | 10 | 0 | 10 | 515408238 | -716099804 |
| `allTokenStringsBoundedCacheDocumentEventsNoObjects` | 46.27 | 3 | 1.42% | yes | 133.63 MiB | 61236571 | 97258079 | 21028479 | 76229600 | 4096 | 21024383 | 4096 | 488418218 | -716099804 |

## Findings

- same-token-boundary-contract (CONTRACT_FACT): All rows consume the same grouped file-backed sync Iterable<Uint8Array[]> source and preserve token boundary counters.
  - 61236571:21612907:21612907:18010755:18010755
- string-materialization-frontier (BENCH_FACT): Token-only and all-string rows were not both measured.
  - allTokenStringsDocumentEventsNoObjects: 41.20 MiB/s, strings=97258079, decodeCalls=97258079, cacheHits=0, cacheBypass=0, decodedBytes=882827595
  - allTokenStringsNameCachedDocumentEventsNoObjects: 52.73 MiB/s, strings=97258079, decodeCalls=36021520, cacheHits=61236559, cacheBypass=0, decodedBytes=515408238
  - allTokenStringsBoundedCacheDocumentEventsNoObjects: 46.27 MiB/s, strings=97258079, decodeCalls=21028479, cacheHits=76229600, cacheBypass=21024383, decodedBytes=488418218
- partial-not-stax-counterexample (SCOPE_GUARD): These rows use browser-compatible TextDecoder and deliberately avoid Node Buffer and native addons. Full-checksum rows still do not expose public event objects, and partial rows do not claim full StAX checksum parity.
  - allTokenStringsDocumentEventsNoObjects: fullStringParity=true, usesTextDecoder=true, usesNodeBuffer=false
  - allTokenStringsNameCachedDocumentEventsNoObjects: fullStringParity=true, usesTextDecoder=true, usesNodeBuffer=false
  - allTokenStringsBoundedCacheDocumentEventsNoObjects: fullStringParity=true, usesTextDecoder=true, usesNodeBuffer=false
- full-checksum-segmented-candidate (BENCH_FACT): The document-event segmented row matched the StreamReaderSync reference at 41.20 MiB/s.
  - candidate=61236571:-716099804
  - reference=61236571:-716099804
  - fullStringParity=true
  - counterexampleEligible=true
- full-checksum-cache-candidates (BENCH_FACT): The fastest measured full-checksum segmented row was allTokenStringsNameCachedDocumentEventsNoObjects at 52.73 MiB/s.
  - allTokenStringsDocumentEventsNoObjects: 41.20 MiB/s, fullStringParity=true, strings=97258079, decodeCalls=97258079, cacheHits=0, cacheBypass=0, checksum=-716099804
  - allTokenStringsNameCachedDocumentEventsNoObjects: 52.73 MiB/s, fullStringParity=true, strings=97258079, decodeCalls=36021520, cacheHits=61236559, cacheBypass=0, checksum=-716099804
  - allTokenStringsBoundedCacheDocumentEventsNoObjects: 46.27 MiB/s, fullStringParity=true, strings=97258079, decodeCalls=21028479, cacheHits=76229600, cacheBypass=21024383, checksum=-716099804

## Limits

- This is a string-materialization frontier over a simplified token-boundary scanner, not the public StAX reader.
- Full-checksum rows are no-public-object checksum candidates; they still do not expose public StAX event objects.
- Partial frontier rows are not full-string parity rows and cannot be counted as runtime-limit counterexamples.
- The benchmark intentionally uses TextDecoder, not Node Buffer, native addons, or lazy getters.

