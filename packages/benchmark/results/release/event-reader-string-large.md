# EventReaderSync String-Input Large Benchmark

Generated: 2026-05-23T12:32:37.249Z

This experiment measures `EventReaderSync` over a complete XML string.
It is a reference object path for string-input memory behavior, not the bounded byte-batch `StreamReaderSync` target.
Rows run in isolated child processes so a large-string failure can be recorded without losing the report.

## Environment

- Package: stax-xml 1.0.0
- Runtime: v24.15.0, V8 13.6.233.17-node.48
- Fixture shape: diverse-cycle
- Row cycle size: 4096
- Runs: warmups=0, runs=1

## Woodstox Target

- Baseline tool: woodstox
- Woodstox throughput: 333.43 MiB/s
- Goal ratio: 0.90x
- 0.9x target throughput: 300.09 MiB/s

## Results

| Size | Status | Throughput | Average | Events | Checksum | Event objects | String fields | Peak RSS | Peak heap used | Estimated UTF-16 input |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 256.0 MiB | ok | 73.44 MiB/s | 3486.04 ms | 11,297,376 | 1035231802 | 11,297,376 | 25,675,850 | 584.9 MiB | 527.3 MiB | 511.3 MiB |
| 512.0 MiB | ok | 74.19 MiB/s | 6901.23 ms | 22,594,728 | 1125502925 | 22,594,728 | 51,351,650 | 1.07 GiB | 1.01 GiB | 1022.6 MiB |
| 1024 MiB | error | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |

## Generation Memory

| Size | Generation time | Heap delta | RSS delta | Heap after generation | RSS after generation |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 256.0 MiB | 81.31 ms | +513.6 MiB | +513.3 MiB | 519.7 MiB | 572.8 MiB |
| 512.0 MiB | 228.26 ms | +1.00 GiB | +1.00 GiB | 1.01 GiB | 1.06 GiB |

## Parse Memory

| Size | Avg heap delta | Avg RSS delta | Max endpoint heap | Max endpoint RSS | Peak sampled heap | Peak sampled RSS |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 256.0 MiB | +5.7 MiB | +13.6 MiB | 523.2 MiB | 584.9 MiB | 527.3 MiB | 584.9 MiB |
| 512.0 MiB | +9.5 MiB | +13.5 MiB | 1.01 GiB | 1.07 GiB | 1.01 GiB | 1.07 GiB |

## Materialization Counters

| Size | Names | Text | Attr names | Attr values | Attribute pairs |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 256.0 MiB | 8,216,272 | 3,081,102 | 7,189,238 | 7,189,238 | 7,189,238 |
| 512.0 MiB | 16,432,528 | 6,162,198 | 14,378,462 | 14,378,462 | 14,378,462 |

## Failures

- 1024 MiB: error
  - error: Invalid string length

## Findings

- string-input-boundary: EventReaderSync requires a complete XML string before parsing, so input memory is part of the measured boundary.
  - 256.0 MiB input, estimated UTF-16=511.3 MiB
  - 512.0 MiB input, estimated UTF-16=1022.6 MiB
- event-object-materialization: Rows materialize public event objects and attribute objects/maps while folding the full checksum contract.
  - 256.0 MiB: events=11297376, objects=11297376
  - 512.0 MiB: events=22594728, objects=22594728
- largest-successful-row: Largest successful row is evidence for the EventReaderSync string-input reference path only.
  - size=512.0 MiB
  - throughput=74.19 MiB/s
  - peakRSS=1.07 GiB
  - checksum=1125502925
- failed-rows: At least one size failed in the isolated child process.
  - 1024 MiB: status=error
