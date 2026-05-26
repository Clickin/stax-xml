# Segment Tokenizer Headroom

Generated: 2026-05-26T10:05:49.671Z

Benchmark-only probe for the parser-core no-concat hypothesis after XML token-boundary work is added. Rows consume demand-driven synchronous Iterable<Uint8Array[]> file batches and fold start/end/text/attribute-count events without JavaScript string materialization, so these rows are partial headroom evidence and not full StAX counterexamples.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 32
- Grouped batch size: 8
- Fastest row: singleton-segment-tokenize 236.55 MiB/s
- Grouped segment / concat ratio: 1.01x
- Singleton / grouped segment ratio: 1.21x
- 200 MiB/s bounded full-string counterexamples: 0

## Rows

| Row | MiB/s | Samples | Spread | Bounded | Max RSS | Events | Start | End | Text | Attrs | Checksum | Batch size | Concat before tokenize | Segment-aware |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `singleton-segment-tokenize` | 236.55 | 3 | 13.83% | yes | 62.69 MiB | 61236569 | 21612907 | 21612907 | 18010755 | 18010755 | -1381363934 | 1 | no | yes |
| `grouped-concat-tokenize` | 194.55 | 3 | 2.10% | yes | 65.70 MiB | 61236569 | 21612907 | 21612907 | 18010755 | 18010755 | -1381363934 | 8 | yes | no |
| `grouped-segment-tokenize` | 196.26 | 3 | 4.71% | yes | 73.54 MiB | 61236569 | 21612907 | 21612907 | 18010755 | 18010755 | -1381363934 | 8 | no | yes |

## Findings

- same-token-boundary-contract (CONTRACT_FACT): All rows scan the same file-backed bytes and preserve start/end/text/attribute counters plus checksum parity.
  - 61236569:21612907:21612907:18010755:18010755:-1381363934
- segment-tokenizer-headroom (BENCH_FACT): Grouped segment-aware tokenization reached 196.26 MiB/s versus grouped concat tokenization at 194.55 MiB/s (1.01x).
  - singleton-segment-tokenize: 236.55 MiB/s, concatBeforeTokenize=false
  - grouped-concat-tokenize: 194.55 MiB/s, concatBeforeTokenize=true
  - grouped-segment-tokenize: 196.26 MiB/s, concatBeforeTokenize=false
- partial-not-stax-counterexample (SCOPE_GUARD): These rows fold XML token boundaries and attribute counts, but they do not materialize names/text strings, validate all XML productions, expose public event objects, or preserve the full StAX checksum.
  - singleton-segment-tokenize: fullStringParity=false, contractScope=xml-token-boundary-no-string-materialization
  - grouped-concat-tokenize: fullStringParity=false, contractScope=xml-token-boundary-no-string-materialization
  - grouped-segment-tokenize: fullStringParity=false, contractScope=xml-token-boundary-no-string-materialization
- source-contract (CONTRACT_FACT): Rows use demand-driven synchronous Iterable<Uint8Array[]> parser-input shape, not direct ReadableStream and not one full ArrayBuffer parser input.
  - singletonBatchSize=1
  - groupedBatchSize=8
  - directReadableStream=false
  - fullArrayBufferParserInput=false

## Limits

- This is an XML token-boundary probe only. It does not validate every XML production, materialize JavaScript strings, preserve full StAX event semantics, or expose public event objects.
- A positive segment-tokenizer ratio is implementation headroom, not a full-string runtime counterexample.
- A negative segment-tokenizer ratio does not rule out a full segmented parser; it only rejects this token-boundary shape on this fixture/runtime.

