# Segment Tokenizer String Frontier

Generated: 2026-05-26T14:07:58.843Z

Benchmark-only probe that keeps the same demand-driven synchronous Iterable<Uint8Array[]> grouped segment source and incrementally adds browser-compatible TextDecoder string materialization to the token-boundary scanner. Rows are partial headroom evidence and not full StAX counterexamples because they do not expose public event objects or validate the full XML contract.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 32
- Grouped batch size: 8
- Fastest row: tokenOnly 234.30 MiB/s
- All strings / token-only ratio: 0.28x
- 200 MiB/s bounded full-string counterexamples: 0

## Rows

| Row | MiB/s | Samples | Spread | Bounded | Max RSS | Events | Strings | Decode calls | Cache hits | Cache misses | Cache bypass | Cached entries | Decoded bytes | Checksum |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `tokenOnly` | 234.30 | 3 | 2.81% | yes | 106.44 MiB | 61236569 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | -1381363934 |
| `elementNameStrings` | 111.32 | 3 | 2.97% | yes | 89.21 MiB | 61236569 | 43225814 | 43225814 | 0 | 0 | 0 | 0 | 288172088 | 1787722344 |
| `elementNameCachedStrings` | 153.14 | 3 | 4.31% | yes | 89.93 MiB | 61236569 | 43225814 | 6 | 43225808 | 6 | 0 | 6 | 37 | 1787722344 |
| `elementAndAttributeNameStrings` | 95.59 | 3 | 0.58% | yes | 89.66 MiB | 61236569 | 61236569 | 61236569 | 0 | 0 | 0 | 0 | 367419410 | 976545000 |
| `elementAndAttributeNameCachedStrings` | 134.86 | 3 | 2.94% | yes | 90.04 MiB | 61236569 | 61236569 | 10 | 61236559 | 10 | 0 | 10 | 53 | 976545000 |
| `elementAndAttributeStrings` | 83.34 | 3 | 0.22% | yes | 123.98 MiB | 61236569 | 79247324 | 79247324 | 0 | 0 | 0 | 0 | 430775658 | -1128445687 |
| `elementAndAttributeStringsBoundedCache` | 112.27 | 3 | 2.35% | yes | 126.73 MiB | 61236569 | 79247324 | 3602259 | 75645065 | 4096 | 3598163 | 4096 | 42114941 | -1128445687 |
| `allTokenStringsNoObjects` | 66.58 | 3 | 6.04% | yes | 126.25 MiB | 61236569 | 97258079 | 97258079 | 0 | 0 | 0 | 0 | 882827595 | 1627122898 |
| `allTokenStringsNameCachedNoObjects` | 81.14 | 3 | 3.44% | yes | 126.42 MiB | 61236569 | 97258079 | 36021520 | 61236559 | 10 | 0 | 10 | 515408238 | 1627122898 |
| `allTokenStringsBoundedCacheNoObjects` | 74.85 | 3 | 1.53% | yes | 193.68 MiB | 61236569 | 97258079 | 21028479 | 76229600 | 4096 | 21024383 | 4096 | 488418218 | 1627122898 |

## Findings

- same-token-boundary-contract (CONTRACT_FACT): All rows consume the same grouped file-backed sync Iterable<Uint8Array[]> source and preserve token boundary counters.
  - 61236569:21612907:21612907:18010755:18010755
- string-materialization-frontier (BENCH_FACT): Adding element, attribute, and text string materialization reached 66.58 MiB/s versus token-only 234.30 MiB/s (0.28x).
  - tokenOnly: 234.30 MiB/s, strings=0, decodeCalls=0, cacheHits=0, cacheBypass=0, decodedBytes=0
  - elementNameStrings: 111.32 MiB/s, strings=43225814, decodeCalls=43225814, cacheHits=0, cacheBypass=0, decodedBytes=288172088
  - elementNameCachedStrings: 153.14 MiB/s, strings=43225814, decodeCalls=6, cacheHits=43225808, cacheBypass=0, decodedBytes=37
  - elementAndAttributeNameStrings: 95.59 MiB/s, strings=61236569, decodeCalls=61236569, cacheHits=0, cacheBypass=0, decodedBytes=367419410
  - elementAndAttributeNameCachedStrings: 134.86 MiB/s, strings=61236569, decodeCalls=10, cacheHits=61236559, cacheBypass=0, decodedBytes=53
  - elementAndAttributeStrings: 83.34 MiB/s, strings=79247324, decodeCalls=79247324, cacheHits=0, cacheBypass=0, decodedBytes=430775658
  - elementAndAttributeStringsBoundedCache: 112.27 MiB/s, strings=79247324, decodeCalls=3602259, cacheHits=75645065, cacheBypass=3598163, decodedBytes=42114941
  - allTokenStringsNoObjects: 66.58 MiB/s, strings=97258079, decodeCalls=97258079, cacheHits=0, cacheBypass=0, decodedBytes=882827595
  - allTokenStringsNameCachedNoObjects: 81.14 MiB/s, strings=97258079, decodeCalls=36021520, cacheHits=61236559, cacheBypass=0, decodedBytes=515408238
  - allTokenStringsBoundedCacheNoObjects: 74.85 MiB/s, strings=97258079, decodeCalls=21028479, cacheHits=76229600, cacheBypass=21024383, decodedBytes=488418218
- partial-not-stax-counterexample (SCOPE_GUARD): These rows use browser-compatible TextDecoder and deliberately avoid Node Buffer and native addons, but they still do not expose public event objects or claim full StAX checksum parity.
  - tokenOnly: fullStringParity=false, usesTextDecoder=false, usesNodeBuffer=false
  - elementNameStrings: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false
  - elementNameCachedStrings: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false
  - elementAndAttributeNameStrings: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false
  - elementAndAttributeNameCachedStrings: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false
  - elementAndAttributeStrings: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false
  - elementAndAttributeStringsBoundedCache: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false
  - allTokenStringsNoObjects: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false
  - allTokenStringsNameCachedNoObjects: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false
  - allTokenStringsBoundedCacheNoObjects: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false

## Limits

- This is a string-materialization frontier over a simplified token-boundary scanner, not the public StAX reader.
- Rows are not full-string parity rows and cannot be counted as runtime-limit counterexamples.
- The benchmark intentionally uses TextDecoder, not Node Buffer, native addons, or lazy getters.

