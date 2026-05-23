# quick-xml Measured Allocation Count

Generated: 2026-05-23T11:27:27.934Z

This report is a TRACE_FACT for one Rust + quick-xml binary and one XML fixture.
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

## Benchmark Result

| Runtime | Instrumented throughput | Average | Events | Checksum |
| --- | ---: | ---: | ---: | ---: |
| 1.0.0 | 282.7 MiB/s | 56.60 ms | 967967 | -746772258 |

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

## Caveats

- Counters start after warmup and immediately before the measured consume call, then stop immediately after consume returns.
- The counter is process-global inside this single-threaded comparator binary, so it counts allocator calls made by Rust/quick-xml during the measured window.
- The counter has no stack attribution, type attribution, borrowed-vs-owned Cow frequency, or object lifetime information.
- The timed throughput row includes allocator counter overhead and must not replace the non-instrumented quick-xml speed baseline.

## Findings

- same-contract-result (BENCH_FACT): The allocation-count run preserved the shared full-string checksum contract.
  - events=967967
  - checksum=-746772258
  - instrumentedThroughput=282.7 MiB/s
- measured-allocation-counters (TRACE_FACT): The comparator emitted exact global allocator call counters for each measured consume run.
  - allocationSamples=1
  - avgAllocationOperations=170824.0
  - avgTotalAllocatedBytes=27.13 MiB
  - avgNetAllocatedBytes=0 B
- not-js-object-shape (SOURCE_FACT_LINK): The measured binary still uses the Rust quick-xml comparator shape, not JavaScript public event objects.
  - Pair this report with quick-xml-shape-audit.md for Event lifetime, Cow byte/string, and attribute Vec source facts.
- not-stack-or-lifetime-proof (LIMITATION): The counter does not prove allocation stacks, object types, object lifetimes, or borrowed-vs-owned Cow frequency.
  - Counters start after warmup and immediately before the measured consume call, then stop immediately after consume returns.
  - The counter is process-global inside this single-threaded comparator binary, so it counts allocator calls made by Rust/quick-xml during the measured window.
  - The counter has no stack attribution, type attribution, borrowed-vs-owned Cow frequency, or object lifetime information.
  - The timed throughput row includes allocator counter overhead and must not replace the non-instrumented quick-xml speed baseline.
