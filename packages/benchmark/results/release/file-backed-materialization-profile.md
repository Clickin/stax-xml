# File-Backed Materialization Profile

Generated: 2026-05-25T23:49:53.725Z

Counts the string materialization work performed by the current file-backed raw-frame name-id full-string checksum path. This is deterministic counter evidence for where full-string work remains; it is not a throughput run and not a runtime ceiling proof.

## Source Contract

- Parser input: StreamReaderSync over a synchronous Iterable<Uint8Array[]>
- Source mode: file-backed-sync-iterable-byte-batches
- File read: readSync is called only while the iterator is pulled for the next parser batch
- Chunk bytes: 32768
- Batch size: 4
- Pre-materializes full XML: no
- Direct ReadableStream: no
- Native addon: no
- Node Buffer string decode: no

## Result

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Events: 61,236,571
- Checksum: -716099804
- Full-string parity: yes

## Event Shape

- Start elements: 21,612,907
- End elements: 21,612,907
- Text events: 18,010,755
- CDATA events: 0
- Attribute pairs: 18,010,755

## Materialization

| Kind | Decode span calls | TextDecoder calls | Short ASCII hits | Span bytes | TextDecoder bytes | Short ASCII bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| name | 10 | 0 | 10 | 53 | 0 | 53 |
| text | 18,010,755 | 9,806,453 | 8,204,302 | 452,051,937 | 359,401,484 | 92,650,453 |
| attrValue | 18,010,755 | 0 | 18,010,755 | 63,356,248 | 0 | 63,356,248 |

- Total decodeSpan calls: 36,021,520
- Total TextDecoder calls: 9,806,453
- Non-name TextDecoder share: 100.00%
- Short ASCII hit rate: 72.78%
- Name cache hits/misses: 61,236,559 / 10 (100.00%)
- Unique names: 10
- Text trim calls: 18,010,755
- Text boundary whitespace: 0
- Text empty after trim: 0

## Findings

- same-contract-file-backed-profile (TRACE_FACT): The profile replays the current raw-frame name-id full-string checksum over demand-driven file-backed byte batches.
  - frames=8193
  - startElements=21612907
  - attributePairs=18010755
- name-cache-removes-repeated-name-decodes (TRACE_FACT): Name-id caching leaves 10 unique name decodes and serves repeated names at 100.00% hit rate.
  - hits=61236559
  - misses=10
  - uniqueNames=10
- non-name-strings-dominate-decoder-work (HEADROOM_EVIDENCE): Text and attribute values account for 100.00% of TextDecoder calls that remain after name caching.
  - textDecoderCalls=9806453
  - nonNameTextDecoderCalls=9806453
  - decodeSpanCalls=36021520
- not-runtime-ceiling-proof (TRACE_FACT_LIMIT): This is deterministic materialization-count evidence for one source shape and fixture; it does not prove JavaScript runtimes have no remaining headroom.
  - Use it to rank next hypotheses, not to conclude impossibility.
