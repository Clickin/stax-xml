# Raw Span Shape Audit

Generated: 2026-05-26T11:49:11.487Z

Audits raw-frame span shape over a demand-driven synchronous Iterable<Uint8Array[]> corpus-cycle input. It records source/span facts only; it is not a throughput benchmark and not a runtime-limit proof.

## Source Consumption

- Parser input: synchronous Iterable<Uint8Array[]>
- ArrayBuffer consumption: The corpus seed is read once and replayed as Uint8Array batches; the parser does not receive one full 1 GiB ArrayBuffer input.
- Batch/backpressure: The iterator yields one Uint8Array[] batch per StreamReaderSync pull and does not prebuild the repeated 1 GiB stream.
- Direct ReadableStream: no

## Summary

- Corpus: G:\programming\stax-xml\packages\benchmark\assets\books.xml
- Size: 1.00 GiB (1.00 GiB)
- Events: 57,096,514
- Shape checksum: -1533499053
- Explicit attr-value medium ASCII spans: 0
- Text/CDATA medium ASCII spans: 2,831,232
- Text/CDATA long or non-ASCII spans: 3,539,040

## Span Distribution

| Kind | Count | Avg bytes | Min | Max | ASCII | Non-ASCII | <=12 ASCII | 13-24 ASCII | >24 ASCII | Long/non-ASCII | Trim boundary |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| elementName | 40,109,120 | 6.86 | 4 | 12 | 40,109,120 | 0 | 40,109,120 | 0 | 0 | 0 | 0 |
| text | 16,987,392 | 29.24 | 4 | 185 | 16,987,392 | 0 | 10,617,120 | 2,831,232 | 3,539,040 | 3,539,040 | 0 |
| attrName | 2,831,232 | 2.00 | 2 | 2 | 2,831,232 | 0 | 2,831,232 | 0 | 0 | 0 | 0 |
| attrValueExplicit | 2,831,232 | 5.00 | 5 | 5 | 2,831,232 | 0 | 2,831,232 | 0 | 0 | 0 | 0 |
| attrValueImplicit | 0 | 0.00 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Top Lengths

- elementName: 5:16,987,392, 4:5,662,464, 6:5,662,464, 11:5,662,464, 12:5,662,464, 7:471,872
- text: 10:3,067,168, 4:1,887,488, 7:1,415,616, 11:1,179,680, 5:943,744, 8:943,744, 12:943,744, 15:943,744, 13:707,808, 94:471,872, 132:471,872, 6:235,936
- attrName: 2:2,831,232
- attrValueExplicit: 5:2,831,232
- attrValueImplicit: 

## Findings

- attr-value-medium-ascii-pocket-absent (NEGATIVE_RESULT): The books.xml corpus-cycle has no explicit attribute-value spans in the 13-24 byte ASCII bucket, so the medium ASCII attr-value fast path has no hit population on this input.
  - explicitAttrValueTotal=2,831,232
  - explicitAttrValueShortAscii=2,831,232
  - explicitAttrValueMediumAscii=0
- text-medium-ascii-pocket-present (SOURCE_FACT): The same corpus-cycle does contain a 13-24 byte ASCII text/CDATA population, matching the medium ASCII text candidate hit counter.
  - textTotal=16,987,392
  - textMediumAscii=2,831,232
  - textLongOrNonAscii=3,539,040
- source-shape-separated-from-stream-overhead (SCOPE_GUARD): This audit uses the same synchronous byte-batch source shape as the primary Node/V8 full-parity rows; it is not a direct ReadableStream measurement.
  - parserInput=synchronous Iterable<Uint8Array[]>
  - directReadableStream=false

