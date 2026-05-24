# quick-xml Measured Allocation Count

Generated: 2026-05-24T12:53:21.986Z

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
- Runs: warmups=4, runs=1
- Variant matrix: yes

## Benchmark Result

| Runtime | Instrumented throughput | Average | Events | Checksum |
| --- | ---: | ---: | ---: | ---: |
| 1.0.0 | 243.5 MiB/s | 65.70 ms | 967967 | -746772258 |

## Allocation Counts

| Metric | Total | Average per run |
| --- | ---: | ---: |
| allocCount | 170822 | 170822 |
| allocBytes | 27.13 MiB | 27.13 MiB |
| deallocCount | 170822 | 170822 |
| deallocBytes | 27.13 MiB | 27.13 MiB |
| reallocCount | 2 | 2 |
| reallocBytesIn | 24 B | 24 B |
| reallocBytesOut | 48 B | 48 B |
| allocationOperations | 170824 | 170824 |
| totalAllocatedBytes | 27.13 MiB | 27.13 MiB |
| totalReleasedBytes | 27.13 MiB | 27.13 MiB |
| netAllocatedBytes | 0 B | 0 B |

Average allocation operations per event: 1.765e-1.
Average allocated bytes per fixture MiB: 1.70 MiB.

## Cow Ownership Counts

| Metric | Total | Average per run |
| --- | ---: | ---: |
| textDecodeCount | 284695 | 284695 |
| textBorrowedCount | 284695 | 284695 |
| textOwnedCount | 0 | 0 |
| textNonEmptyCount | 284695 | 284695 |
| cdataDecodeCount | 0 | 0 |
| cdataBorrowedCount | 0 | 0 |
| cdataOwnedCount | 0 | 0 |
| cdataNonEmptyCount | 0 | 0 |
| totalDecodeCount | 284695 | 284695 |
| totalBorrowedCount | 284695 | 284695 |
| totalOwnedCount | 0 | 0 |
| totalNonEmptyCount | 284695 | 284695 |

## Phase Allocation Attribution

These rows are direct comparator phase guards, not native stack unwinding.

| Phase | Allocation ops | Total allocated | Total released | Net allocated |
| --- | ---: | ---: | ---: | ---: |
| unattributed | 3 | 1.06 MiB | 1.06 MiB | -64 B |
| reader-event | 4 | 88 B | 24 B | 64 B |
| attribute-collection | 170817 | 26.06 MiB | 26.06 MiB | 0 B |

## Generated Fixture Variants

These rows use the same quick-xml comparator contract on generated UTF-8 fixtures. They are counterchecks for the `Cow<str>` and phase-allocation boundaries, not replacements for the 16 MiB external baseline.

| Variant | Fixture size | Instrumented throughput | Events | Checksum | Decode | Borrowed | Owned | Allocation ops | Dominant phase | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| escaped-utf8 | 1.00 MiB | 177.4 MiB/s | 78898 | 1840671295 | 43830 | 43830 | 0 | 8772 | attribute-collection | UTF-8 text with XML entity spellings in text and attributes; comparator decodes but does not unescape. |
| nonascii-utf8 | 1.00 MiB | 263.9 MiB/s | 46914 | -1045261330 | 9382 | 9382 | 0 | 9388 | attribute-collection | UTF-8 text with Korean, Japanese, Greek, and emoji code points. |
| cdata-utf8 | 1.00 MiB | 318.6 MiB/s | 33466 | -1470519692 | 11154 | 11154 | 0 | 11160 | attribute-collection | UTF-8 CDATA sections with markup-looking payload. |
| utf8-bom | 1.00 MiB | 208.2 MiB/s | 74364 | -631568628 | 14872 | 14872 | 0 | 14878 | attribute-collection | UTF-8 document with BOM and non-ASCII text. |

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
  - instrumentedThroughput=243.5 MiB/s
- measured-allocation-counters (TRACE_FACT): The comparator emitted exact global allocator call counters for each measured consume run.
  - allocationSamples=1
  - avgAllocationOperations=170824.0
  - avgTotalAllocatedBytes=27.13 MiB
  - avgNetAllocatedBytes=0 B
- cow-ownership-counters (TRACE_FACT): The measured run counted quick-xml text and CDATA decode ownership at the Cow<str> boundary.
  - avgDecodeCount=284695.0
  - avgBorrowedCount=284695.0
  - avgOwnedCount=0.0
- variant-cow-ownership-counters (TRACE_FACT): Generated UTF-8 fixture variants also counted quick-xml text and CDATA decode ownership at the Cow<str> boundary.
  - escaped-utf8: decode=43830, borrowed=43830, owned=0, dominantPhase=attribute-collection
  - nonascii-utf8: decode=9382, borrowed=9382, owned=0, dominantPhase=attribute-collection
  - cdata-utf8: decode=11154, borrowed=11154, owned=0, dominantPhase=attribute-collection
  - utf8-bom: decode=14872, borrowed=14872, owned=0, dominantPhase=attribute-collection
- phase-allocation-attribution (TRACE_FACT): The measured run attributed allocator traffic to directly instrumented quick-xml comparator phases.
  - unattributed: ops=3, allocated=1.06 MiB
  - reader-event: ops=4, allocated=88 B
  - attribute-collection: ops=170817, allocated=26.06 MiB
- not-js-object-shape (SOURCE_FACT_LINK): The measured binary still uses the Rust quick-xml comparator shape, not JavaScript public event objects.
  - Pair this report with quick-xml-shape-audit.md for Event lifetime, Cow byte/string, and attribute Vec source facts.
- not-stack-or-lifetime-proof (LIMITATION): The counter does not prove native allocation stacks, exact allocator object types, or object lifetimes.
  - Counters start after warmup and immediately before the measured consume call, then stop immediately after consume returns.
  - The counter is process-global inside this single-threaded comparator binary, so it counts allocator calls made by Rust/quick-xml during the measured window.
  - Phase attribution uses explicit Rust guards around comparator operations; it is not native stack unwinding and does not prove complete object lifetime.
  - Escaped XML text rows use the comparator decode boundary and do not unescape entities before checksum folding.
  - The timed throughput row includes allocator counter overhead and must not replace the non-instrumented quick-xml speed baseline.
