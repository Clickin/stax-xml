# Monomorphic Batch Access

Generated: 2026-05-23T07:32:05.373Z

This experiment keeps the full-string materialization contract: it does not filter events, skip string fields, use native addons, or use Node Buffer-specific decoding.
It isolates whether monomorphic direct access to the batch frame can reduce JavaScript accessor/runtime overhead after the parser has already produced spans.

## Fixture

- Source: file
- Size: 16.0 MiB (16777038 bytes)
- Runs: warmups=1, runs=3

## Woodstox Target

- Baseline: woodstox
- Goal: 0.90x Woodstox
- Woodstox: 329.3 MiB/s
- Target throughput: 296.4 MiB/s

## Results

| Variant | Throughput | Relative to public | Woodstox ratio | 0.9x target | Average | Min | Max | Events | Checksum | Materialization |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| public-accessor | 104.7 MiB/s | 1.00x | 0.32x | below | 152.85 ms | 149.27 ms | 157.71 ms | 967967 | -746772258 | full-string |
| raw-frame-direct-decode | 111.9 MiB/s | 1.07x | 0.34x | below | 143.00 ms | 141.66 ms | 144.89 ms | 967967 | -746772258 | full-string |
| raw-frame-name-id-cache | 126.7 MiB/s | 1.21x | 0.38x | below | 126.28 ms | 123.19 ms | 129.45 ms | 967967 | -746772258 | full-string |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg heap delta | Avg heap total delta | Avg RSS delta | Avg external delta | Avg arrayBuffers delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| public-accessor | +1.2 MiB | +853.3 KiB | +7.0 MiB | +5.0 MiB | +8.0 MiB | 6.5 MiB | 130.3 MiB |
| raw-frame-direct-decode | +1.8 MiB | +170.7 KiB | -724.0 KiB | -725.3 KiB | -237.7 KiB | 6.7 MiB | 132.1 MiB |
| raw-frame-name-id-cache | +781.8 KiB | +426.7 KiB | -517.3 KiB | -725.3 KiB | -109.7 KiB | 5.7 MiB | 131.5 MiB |

## Parity

Status: ok
Events: 967967
Checksum: -746772258

## Findings

- full-materialization-not-avoided: Every variant consumes all events and folds element names, text, attribute names, and attribute values into the checksum.
  - public-accessor: events=967967, checksum=-746772258
  - raw-frame-direct-decode: events=967967, checksum=-746772258
  - raw-frame-name-id-cache: events=967967, checksum=-746772258
- direct-raw-frame-delta: Direct raw-frame traversal isolates accessor indirection from parser and string materialization cost.
  - public-accessor=104.7 MiB/s
  - raw-frame-direct-decode=111.9 MiB/s
  - relative=1.07x
- numeric-name-id-cache-delta: The numeric name-id variant keeps full string materialization but avoids repeated accessor calls for already-interned names.
  - public-accessor=104.7 MiB/s
  - raw-frame-name-id-cache=126.7 MiB/s
  - relative=1.21x
