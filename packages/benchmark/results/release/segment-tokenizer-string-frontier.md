# Segment Tokenizer String Frontier

Generated: 2026-05-26T10:33:07.032Z

Benchmark-only probe that keeps the same demand-driven synchronous Iterable<Uint8Array[]> grouped segment source and incrementally adds browser-compatible TextDecoder string materialization to the token-boundary scanner. Rows are partial headroom evidence and not full StAX counterexamples because they do not expose public event objects or validate the full XML contract.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 32
- Grouped batch size: 8
- Fastest row: tokenOnly 239.61 MiB/s
- All strings / token-only ratio: 0.29x
- 200 MiB/s bounded full-string counterexamples: 0

## Rows

| Row | MiB/s | Samples | Spread | Bounded | Max RSS | Events | Strings | Decode calls | Cache hits | Cache misses | Cached names | Decoded bytes | Checksum |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `tokenOnly` | 239.61 | 3 | 3.27% | yes | 106.82 MiB | 61236569 | 0 | 0 | 0 | 0 | 0 | 0 | -1381363934 |
| `elementNameStrings` | 116.08 | 3 | 3.14% | yes | 89.12 MiB | 61236569 | 43225814 | 43225814 | 0 | 0 | 0 | 288172088 | 1787722344 |
| `elementNameCachedStrings` | 144.98 | 3 | 12.19% | yes | 89.32 MiB | 61236569 | 43225814 | 6 | 43225808 | 6 | 6 | 37 | 1787722344 |
| `elementAndAttributeNameStrings` | 96.32 | 3 | 0.64% | yes | 89.37 MiB | 61236569 | 61236569 | 61236569 | 0 | 0 | 0 | 367419410 | 976545000 |
| `elementAndAttributeNameCachedStrings` | 134.20 | 3 | 8.23% | yes | 89.74 MiB | 61236569 | 61236569 | 10 | 61236559 | 10 | 10 | 53 | 976545000 |
| `elementAndAttributeStrings` | 82.70 | 3 | 8.47% | yes | 123.71 MiB | 61236569 | 79247324 | 79247324 | 0 | 0 | 0 | 430775658 | -1128445687 |
| `allTokenStringsNoObjects` | 69.53 | 3 | 0.64% | yes | 123.26 MiB | 61236569 | 97258079 | 97258079 | 0 | 0 | 0 | 882827595 | 1627122898 |
| `allTokenStringsNameCachedNoObjects` | 80.09 | 3 | 7.49% | yes | 123.68 MiB | 61236569 | 97258079 | 36021520 | 61236559 | 10 | 10 | 515408238 | 1627122898 |

## Findings

- same-token-boundary-contract (CONTRACT_FACT): All rows consume the same grouped file-backed sync Iterable<Uint8Array[]> source and preserve token boundary counters.
  - 61236569:21612907:21612907:18010755:18010755
- string-materialization-frontier (BENCH_FACT): Adding element, attribute, and text string materialization reached 69.53 MiB/s versus token-only 239.61 MiB/s (0.29x).
  - tokenOnly: 239.61 MiB/s, strings=0, decodeCalls=0, cacheHits=0, decodedBytes=0
  - elementNameStrings: 116.08 MiB/s, strings=43225814, decodeCalls=43225814, cacheHits=0, decodedBytes=288172088
  - elementNameCachedStrings: 144.98 MiB/s, strings=43225814, decodeCalls=6, cacheHits=43225808, decodedBytes=37
  - elementAndAttributeNameStrings: 96.32 MiB/s, strings=61236569, decodeCalls=61236569, cacheHits=0, decodedBytes=367419410
  - elementAndAttributeNameCachedStrings: 134.20 MiB/s, strings=61236569, decodeCalls=10, cacheHits=61236559, decodedBytes=53
  - elementAndAttributeStrings: 82.70 MiB/s, strings=79247324, decodeCalls=79247324, cacheHits=0, decodedBytes=430775658
  - allTokenStringsNoObjects: 69.53 MiB/s, strings=97258079, decodeCalls=97258079, cacheHits=0, decodedBytes=882827595
  - allTokenStringsNameCachedNoObjects: 80.09 MiB/s, strings=97258079, decodeCalls=36021520, cacheHits=61236559, decodedBytes=515408238
- partial-not-stax-counterexample (SCOPE_GUARD): These rows use browser-compatible TextDecoder and deliberately avoid Node Buffer and native addons, but they still do not expose public event objects or claim full StAX checksum parity.
  - tokenOnly: fullStringParity=false, usesTextDecoder=false, usesNodeBuffer=false
  - elementNameStrings: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false
  - elementNameCachedStrings: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false
  - elementAndAttributeNameStrings: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false
  - elementAndAttributeNameCachedStrings: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false
  - elementAndAttributeStrings: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false
  - allTokenStringsNoObjects: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false
  - allTokenStringsNameCachedNoObjects: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false

## Limits

- This is a string-materialization frontier over a simplified token-boundary scanner, not the public StAX reader.
- Rows are not full-string parity rows and cannot be counted as runtime-limit counterexamples.
- The benchmark intentionally uses TextDecoder, not Node Buffer, native addons, or lazy getters.

