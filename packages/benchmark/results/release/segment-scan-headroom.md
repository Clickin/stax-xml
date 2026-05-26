# Segment Scan Headroom

Generated: 2026-05-26T09:50:11.946Z

Benchmark-only probe for the parser-core no-concat hypothesis. Rows consume demand-driven synchronous Iterable<Uint8Array[]> file batches and scan delimiter bytes without XML parsing or string materialization, so these rows are partial headroom evidence and not full StAX counterexamples.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Chunk KiB: 32
- Grouped batch size: 8
- Fastest row: grouped-segment-scan 682.83 MiB/s
- Grouped segment / concat ratio: 1.16x
- Singleton / grouped segment ratio: 0.84x
- 200 MiB/s bounded full-string counterexamples: 0

## Rows

| Row | MiB/s | Samples | Spread | Bounded | Max RSS | Delimiters | Checksum | Batch size | Concat before scan | Segment-aware |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- |
| `singleton-segment-scan` | 575.24 | 3 | 7.46% | yes | 93.78 MiB | 162096810 | -428951732 | 1 | no | yes |
| `grouped-concat-scan` | 589.23 | 3 | 31.97% | yes | 116.50 MiB | 162096810 | -428951732 | 8 | yes | no |
| `grouped-segment-scan` | 682.83 | 3 | 3.45% | yes | 102.85 MiB | 162096810 | -428951732 | 8 | no | yes |

## Findings

- same-byte-scan-contract (CONTRACT_FACT): All rows scan the same file-backed bytes and preserve delimiter count plus checksum parity.
  - 162096810:-428951732
- segment-scan-headroom (BENCH_FACT): Grouped segment-aware scan reached 682.83 MiB/s versus grouped concat scan at 589.23 MiB/s (1.16x).
  - singleton-segment-scan: 575.24 MiB/s, concatBeforeScan=false
  - grouped-concat-scan: 589.23 MiB/s, concatBeforeScan=true
  - grouped-segment-scan: 682.83 MiB/s, concatBeforeScan=false
- partial-not-stax-counterexample (SCOPE_GUARD): These rows do not parse XML, do not materialize strings, and do not preserve full StAX event semantics; they are no-concat parser-core headroom evidence only.
  - singleton-segment-scan: fullStringParity=false, contractScope=delimiter-byte-scan-no-xml-parse-no-string-materialization
  - grouped-concat-scan: fullStringParity=false, contractScope=delimiter-byte-scan-no-xml-parse-no-string-materialization
  - grouped-segment-scan: fullStringParity=false, contractScope=delimiter-byte-scan-no-xml-parse-no-string-materialization
- source-contract (CONTRACT_FACT): Rows use demand-driven synchronous Iterable<Uint8Array[]> parser-input shape, not direct ReadableStream and not one full ArrayBuffer parser input.
  - singletonBatchSize=1
  - groupedBatchSize=8
  - directReadableStream=false
  - fullArrayBufferParserInput=false

## Limits

- This is a delimiter byte-scan probe only. It does not parse XML, preserve full StAX event semantics, or materialize JavaScript strings.
- A positive segment-scan ratio is implementation headroom, not a full-string runtime counterexample.
- A negative segment-scan ratio does not rule out a full segmented parser; it only rejects this byte-scan shape on this fixture/runtime.

