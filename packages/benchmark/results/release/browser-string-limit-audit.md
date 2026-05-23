# Browser String-Limit Audit

Generated: 2026-05-23T20:58:02.703Z

This experiment audits the EventReaderSync complete XML string path in the browser.
It tests whether a projected 1 GiB generated XML string can be constructed before parsing.
It is not a byte-batch runtime ceiling and not proof that JavaScript runtimes have no further headroom.

## Environment

- Package: stax-xml 1.0.0
- Runtime: Chrome 148.0.0.0, V8
- User agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36
- CDP browser: Chrome/148.0.7778.179
- CDP V8: 14.8.178.22
- Fixture shape: diverse-cycle
- Row cycle size: 4096
- Runs: warmups=0, runs=1

## Results

| Size | Status | Throughput | Events | Checksum | Event objects | String fields | String code units | Max JS heap | Construction probe |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 64.0 MiB | ok | 81.08 MiB/s | 2,824,406 | 288962256 | 2,824,406 | 6,419,100 | 67,015,502 | 150.2 MiB | n/a |
| 1024 MiB | string-construction-failed | n/a | n/a | n/a | n/a | n/a | 1,072,245,626 | n/a | RangeError: Invalid string length |

## Memory

Variant memory uses Chromium `performance.memory` page JS heap endpoints. Host process-tree memory is separate host context.

| Size | Avg used heap delta | Max used heap | Max total heap | JS heap limit |
| ---: | ---: | ---: | ---: | ---: |
| 64.0 MiB | +11.0 MiB | 150.2 MiB | 174.8 MiB | 4.00 GiB |

## Host Process Memory

Windows process-tree memory rooted at the browser pid. This is host process context, not variant-level JS heap memory.

- Scope: windows-process-tree
- Max working set: 614.9 MiB
- Max private bytes: 358.8 MiB
- Max process count: 10

## Findings

- browser-string-input-control (BENCH_FACT): At least one browser EventReaderSync complete-string control row parsed successfully.
  - 64 MiB: 81.08 MiB/s, events=2,824,406, checksum=288962256
- browser-complete-string-boundary (BENCH_FACT): At least one projected complete XML string failed browser string construction before EventReaderSync parsing.
  - 1024 MiB: RangeError: Invalid string length
- browser-memory-scope (BENCH_FACT): Measured row memory is Chromium page JS heap. Host process-tree memory is reported separately when available.
  - 64 MiB: maxJsHeap=150.2 MiB
- not-byte-batch-runtime-ceiling (TRACE_FACT_LIMIT): A complete-string construction failure limits EventReaderSync string input only; it is not a byte-batch runtime ceiling.
  - StreamReaderSync byte-batch browser artifacts remain the relevant bounded-memory reader path.
