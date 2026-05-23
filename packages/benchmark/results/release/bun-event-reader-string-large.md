# Bun EventReaderSync String-Input Large Benchmark

Generated: 2026-05-23T13:24:26.861Z

This experiment measures `EventReaderSync` over a complete XML string in Bun/JSC.
It folds the full checksum through public event objects and attribute entries.
It is not a byte-batch runtime ceiling and not a proof that bounded-memory streaming is impossible.

## Environment

- Package: stax-xml 1.0.0
- Runtime: Bun 1.3.13 (1.3.13+bf2e2cecf)
- WebKit commit: 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
- Parent runtime: v24.15.0
- Fixture shape: diverse-cycle
- Row cycle size: 4096
- Runs: warmups=0, runs=1
- Child timeout: 600000 ms

## Related String-Limit Audit

- Audit: bun-jsc-string-limit-audit
- JSC max string length: 2,147,483,647 UTF-16 code units
- 1024 MiB projected string length: 1,072,245,626 code units
- 1024 MiB JSC code-unit headroom: 1,075,238,021

## Results

| Size | Status | Throughput | Average | Events | Checksum | Event objects | String fields | Peak RSS | Peak heap used | Estimated UTF-16 input |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 64.00 MiB | ok | 50.06 MiB/s | 1278.49 ms | 2,824,406 | 288962256 | 2,824,406 | 6,419,100 | 633.54 MiB | 130.92 MiB | 127.82 MiB |
| 256.00 MiB | ok | 48.20 MiB/s | 5311.42 ms | 11,297,376 | 1035231802 | 11,297,376 | 25,675,850 | 3.60 GiB | 1.00 GiB | 511.29 MiB |
| 512.00 MiB | ok | 50.52 MiB/s | 10134.22 ms | 22,594,728 | 1125502925 | 22,594,728 | 51,351,650 | 3.65 GiB | 1.00 GiB | 1022.57 MiB |
| 1.00 GiB | ok | 47.88 MiB/s | 21386.39 ms | 45,189,256 | 1421012805 | 45,189,256 | 102,702,850 | 13.45 GiB | 4.00 GiB | 2.00 GiB |

## Generation Memory

| Size | Generation time | Heap delta | RSS delta | Heap after generation | RSS after generation |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 64.00 MiB | 69.32 ms | +0 B | +255.89 MiB | 213.89 KiB | 404.46 MiB |
| 256.00 MiB | 225.55 ms | +0 B | +1022.86 MiB | 213.89 KiB | 1.15 GiB |
| 512.00 MiB | 383.58 ms | +0 B | +2.00 GiB | 213.89 KiB | 2.15 GiB |
| 1.00 GiB | 776.74 ms | +0 B | +3.99 GiB | 213.89 KiB | 4.14 GiB |

## Parse Memory

| Size | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| ---: | ---: | ---: | ---: | ---: |
| 64.00 MiB | +130.71 MiB | +228.78 MiB | 130.92 MiB | 633.26 MiB |
| 256.00 MiB | +1023.97 MiB | +2.45 GiB | 1.00 GiB | 3.60 GiB |
| 512.00 MiB | +1.00 GiB | +1.49 GiB | 1.00 GiB | 3.64 GiB |
| 1.00 GiB | +4.00 GiB | +9.30 GiB | 4.00 GiB | 13.44 GiB |

## Failed Rows

- None.

## Findings

- `bun-complete-string-parse-row`: Bun/JSC rows measure the same EventReaderSync complete-string public event-object path, not a projected or byte-batch path.
  - 64.00 MiB: 50.06 MiB/s, peakRSS=633.54 MiB, events=2,824,406
  - 256.00 MiB: 48.20 MiB/s, peakRSS=3.60 GiB, events=11,297,376
  - 512.00 MiB: 50.52 MiB/s, peakRSS=3.65 GiB, events=22,594,728
  - 1.00 GiB: 47.88 MiB/s, peakRSS=13.45 GiB, events=45,189,256
- `public-event-object-materialization`: Successful rows materialize public event objects and attribute object entries while folding the full checksum contract.
  - 64.00 MiB: eventObjects=2,824,406, stringFields=6,419,100
  - 256.00 MiB: eventObjects=11,297,376, stringFields=25,675,850
  - 512.00 MiB: eventObjects=22,594,728, stringFields=51,351,650
  - 1.00 GiB: eventObjects=45,189,256, stringFields=102,702,850
- `largest-successful-row`: Largest successful Bun row is evidence for the complete-string EventReaderSync reference path only.
  - size=1.00 GiB
  - throughput=47.88 MiB/s
  - peakRSS=13.45 GiB
  - checksum=1421012805
- `one-gib-status`: The configured 1 GiB Bun complete-string row ended with status ok.
  - throughput=47.88 MiB/s
  - peakRSS=13.45 GiB
  - checksum=1421012805
- `failed-rows`: No Bun child-process failures were recorded.
- `not-byte-batch-ceiling`: This report cannot prove a byte-batch runtime ceiling because complete-string input construction and public object materialization are in scope.
  - Use candidate-headroom-large or stream-reader large rows for bounded byte-batch claims.
  - related string-limit audit status=ok
