# quick-xml Measured Allocation Count

Generated: 2026-05-26T10:53:56.471Z

This report is a TRACE_FACT for one Rust + quick-xml binary, one primary XML fixture, and generated UTF-8 fixture variants.
It counts Rust global allocator calls only inside measured `consume()` windows after warmup.
It preserves the same high-level data/checksum contract, but it is not a JavaScript object-shape row and not a speed baseline.

## Environment

- Rust: rustc 1.94.1 (e408947bf 2026-03-25)
- Cargo: cargo 1.94.1 (29ea6fb6a 2026-03-24)
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\runtime-comparison-16mib.xml
- Fixture size: 16.00 MiB
- Runs: warmups=4, runs=3
- Variant matrix: yes

## Benchmark Result

| Runtime | Instrumented throughput | Average | Events | Checksum |
| --- | ---: | ---: | ---: | ---: |
| 1.0.0 | 257.4 MiB/s | 62.15 ms | 967967 | -746772258 |

## Allocation Counts

| Metric | Total | Average per run |
| --- | ---: | ---: |
| allocCount | 512466 | 170822 |
| allocBytes | 81.38 MiB | 27.13 MiB |
| deallocCount | 512466 | 170822 |
| deallocBytes | 81.38 MiB | 27.13 MiB |
| reallocCount | 6 | 2 |
| reallocBytesIn | 72 B | 24 B |
| reallocBytesOut | 144 B | 48 B |
| allocationOperations | 512472 | 170824 |
| totalAllocatedBytes | 81.38 MiB | 27.13 MiB |
| totalReleasedBytes | 81.38 MiB | 27.13 MiB |
| netAllocatedBytes | 0 B | 0 B |

Average allocation operations per event: 1.765e-1.
Average allocated bytes per fixture MiB: 1.70 MiB.

## Cow Ownership Counts

| Metric | Total | Average per run |
| --- | ---: | ---: |
| textDecodeCount | 854085 | 284695 |
| textBorrowedCount | 854085 | 284695 |
| textOwnedCount | 0 | 0 |
| textNonEmptyCount | 854085 | 284695 |
| cdataDecodeCount | 0 | 0 |
| cdataBorrowedCount | 0 | 0 |
| cdataOwnedCount | 0 | 0 |
| cdataNonEmptyCount | 0 | 0 |
| totalDecodeCount | 854085 | 284695 |
| totalBorrowedCount | 854085 | 284695 |
| totalOwnedCount | 0 | 0 |
| totalNonEmptyCount | 854085 | 284695 |

## Attribute Vec Shape Counts

These rows count the comparator-local `Vec` used to collect quick-xml attributes for each `BytesStart`. They are type/shape counters at the Rust comparator boundary, not native allocator stack unwinding.

| Metric | Total | Average per run |
| --- | ---: | ---: |
| attributeCollectionCount | 1024905 | 341635 |
| attributeVecNonEmptyCount | 512451 | 170817 |
| attributeItemCount | 854085 | 284695 |
| attributeVecCapacitySum | 2049804 | 683268 |
| attributeVecMaxCapacity | 4 | 4 |

## Phase Allocation Attribution

These rows are direct comparator phase guards, not native stack unwinding.

| Phase | Allocation ops | Total allocated | Total released | Net allocated |
| --- | ---: | ---: | ---: | ---: |
| unattributed | 9 | 3.19 MiB | 3.19 MiB | -192 B |
| reader-event | 12 | 264 B | 72 B | 192 B |
| attribute-collection | 512451 | 78.19 MiB | 78.19 MiB | 0 B |

## Generated Fixture Variants

These rows use the same quick-xml comparator contract on generated UTF-8 fixtures. They are counterchecks for the `Cow<str>` and phase-allocation boundaries, not replacements for the 16 MiB external baseline.

| Variant | Fixture size | Instrumented throughput | Events | Checksum | Decode | Borrowed | Owned | Allocation ops | Dominant phase | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| escaped-utf8 | 1.00 MiB | 183.4 MiB/s | 78898 | 1840671295 | 131490 | 131490 | 0 | 26316 | attribute-collection | UTF-8 text with XML entity spellings in text and attributes; comparator decodes but does not unescape. |
| nonascii-utf8 | 1.00 MiB | 227.9 MiB/s | 46914 | -1045261330 | 28146 | 28146 | 0 | 28164 | attribute-collection | UTF-8 text with Korean, Japanese, Greek, and emoji code points. |
| cdata-utf8 | 1.00 MiB | 316.8 MiB/s | 33466 | -1470519692 | 33462 | 33462 | 0 | 33480 | attribute-collection | UTF-8 CDATA sections with markup-looking payload. |
| utf8-bom | 1.00 MiB | 205.2 MiB/s | 74364 | -631568628 | 44616 | 44616 | 0 | 44634 | attribute-collection | UTF-8 document with BOM and non-ASCII text. |

## Caveats

- Counters start after warmup and immediately before the measured consume call, then stop immediately after consume returns.
- The counter is process-global inside this single-threaded comparator binary, so it counts allocator calls made by Rust/quick-xml during the measured window.
- Phase attribution uses explicit Rust guards around comparator operations; it is not native stack unwinding and does not prove complete object lifetime.
- Escaped XML text rows use the comparator decode boundary and do not unescape entities before checksum folding.
- The timed throughput row includes allocator counter overhead and must not replace the non-instrumented quick-xml speed baseline.

## Findings

- same-contract-result (BENCH_FACT): The allocation-count run preserved the shared full-string checksum contract.
  - events=967967
  - checksum=-746772258
  - instrumentedThroughput=257.4 MiB/s
- measured-allocation-counters (TRACE_FACT): The comparator emitted exact global allocator call counters for each measured consume run.
  - allocationSamples=3
  - avgAllocationOperations=170824.0
  - avgTotalAllocatedBytes=27.13 MiB
  - avgNetAllocatedBytes=0 B
- cow-ownership-counters (TRACE_FACT): The measured run counted quick-xml text and CDATA decode ownership at the Cow<str> boundary.
  - avgDecodeCount=284695.0
  - avgBorrowedCount=284695.0
  - avgOwnedCount=0.0
- variant-cow-ownership-counters (TRACE_FACT): Generated UTF-8 fixture variants also counted quick-xml text and CDATA decode ownership at the Cow<str> boundary.
  - escaped-utf8: decode=131490, borrowed=131490, owned=0, dominantPhase=attribute-collection
  - nonascii-utf8: decode=28146, borrowed=28146, owned=0, dominantPhase=attribute-collection
  - cdata-utf8: decode=33462, borrowed=33462, owned=0, dominantPhase=attribute-collection
  - utf8-bom: decode=44616, borrowed=44616, owned=0, dominantPhase=attribute-collection
- attribute-vec-shape-counters (TRACE_FACT): The measured run counted comparator-local attribute Vec collection shape directly at the BytesStart boundary.
  - avgAttributeCollections=341635.0
  - avgNonEmptyAttributeVecs=170817.0
  - avgAttributeItems=284695.0
  - maxAttributeVecCapacity=4
- phase-allocation-attribution (TRACE_FACT): The measured run attributed allocator traffic to directly instrumented quick-xml comparator phases.
  - unattributed: ops=9, allocated=3.19 MiB
  - reader-event: ops=12, allocated=264 B
  - attribute-collection: ops=512451, allocated=78.19 MiB
- not-js-object-shape (SOURCE_FACT_LINK): The measured binary still uses the Rust quick-xml comparator shape, not JavaScript public event objects.
  - Pair this report with quick-xml-shape-audit.md for Event lifetime, Cow byte/string, and attribute Vec source facts.
- not-stack-or-lifetime-proof (LIMITATION): The counter does not prove native allocation stacks, exact allocator object types, or object lifetimes.
  - Counters start after warmup and immediately before the measured consume call, then stop immediately after consume returns.
  - The counter is process-global inside this single-threaded comparator binary, so it counts allocator calls made by Rust/quick-xml during the measured window.
  - Phase attribution uses explicit Rust guards around comparator operations; it is not native stack unwinding and does not prove complete object lifetime.
  - Escaped XML text rows use the comparator decode boundary and do not unescape entities before checksum folding.
  - The timed throughput row includes allocator counter overhead and must not replace the non-instrumented quick-xml speed baseline.
