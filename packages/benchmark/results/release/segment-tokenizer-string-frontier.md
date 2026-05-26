# Segment Tokenizer String Frontier

Generated: 2026-05-26T10:22:23.717Z

Benchmark-only probe that keeps the same demand-driven synchronous Iterable<Uint8Array[]> grouped segment source and incrementally adds browser-compatible TextDecoder string materialization to the token-boundary scanner. Rows are partial headroom evidence and not full StAX counterexamples because they do not expose public event objects or validate the full XML contract.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 32
- Grouped batch size: 8
- Fastest row: tokenOnly 207.36 MiB/s
- All strings / token-only ratio: 0.33x
- 200 MiB/s bounded full-string counterexamples: 0

## Rows

| Row | MiB/s | Samples | Spread | Bounded | Max RSS | Events | Strings | Decode calls | Decoded bytes | Checksum |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `tokenOnly` | 207.36 | 3 | 7.14% | yes | 106.99 MiB | 61236569 | 0 | 0 | 0 | -1381363934 |
| `elementNameStrings` | 97.50 | 3 | 0.77% | yes | 89.07 MiB | 61236569 | 43225814 | 43225814 | 288172088 | 1787722344 |
| `elementAndAttributeNameStrings` | 81.95 | 3 | 4.06% | yes | 89.21 MiB | 61236569 | 61236569 | 61236569 | 367419410 | 976545000 |
| `elementAndAttributeStrings` | 78.96 | 3 | 15.03% | yes | 89.54 MiB | 61236569 | 79247324 | 79247324 | 430775658 | -1128445687 |
| `allTokenStringsNoObjects` | 68.94 | 3 | 1.10% | yes | 122.86 MiB | 61236569 | 97258079 | 97258079 | 882827595 | 1627122898 |

## Findings

- same-token-boundary-contract (CONTRACT_FACT): All rows consume the same grouped file-backed sync Iterable<Uint8Array[]> source and preserve token boundary counters.
  - 61236569:21612907:21612907:18010755:18010755
- string-materialization-frontier (BENCH_FACT): Adding element, attribute, and text string materialization reached 68.94 MiB/s versus token-only 207.36 MiB/s (0.33x).
  - tokenOnly: 207.36 MiB/s, strings=0, decodedBytes=0
  - elementNameStrings: 97.50 MiB/s, strings=43225814, decodedBytes=288172088
  - elementAndAttributeNameStrings: 81.95 MiB/s, strings=61236569, decodedBytes=367419410
  - elementAndAttributeStrings: 78.96 MiB/s, strings=79247324, decodedBytes=430775658
  - allTokenStringsNoObjects: 68.94 MiB/s, strings=97258079, decodedBytes=882827595
- partial-not-stax-counterexample (SCOPE_GUARD): These rows use browser-compatible TextDecoder and deliberately avoid Node Buffer and native addons, but they still do not expose public event objects or claim full StAX checksum parity.
  - tokenOnly: fullStringParity=false, usesTextDecoder=false, usesNodeBuffer=false
  - elementNameStrings: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false
  - elementAndAttributeNameStrings: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false
  - elementAndAttributeStrings: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false
  - allTokenStringsNoObjects: fullStringParity=false, usesTextDecoder=true, usesNodeBuffer=false

## Limits

- This is a string-materialization frontier over a simplified token-boundary scanner, not the public StAX reader.
- Rows are not full-string parity rows and cannot be counted as runtime-limit counterexamples.
- The benchmark intentionally uses TextDecoder, not Node Buffer, native addons, or lazy getters.

