# Monomorphic Batch Access

Generated: 2026-05-23T05:50:13.533Z

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
| public-accessor | 106.3 MiB/s | 1.00x | 0.32x | below | 150.48 ms | 147.54 ms | 152.85 ms | 967967 | -746772258 | full-string |
| raw-frame-direct-decode | 119.3 MiB/s | 1.12x | 0.36x | below | 134.14 ms | 131.77 ms | 136.69 ms | 967967 | -746772258 | full-string |
| raw-frame-name-id-cache | 130.1 MiB/s | 1.22x | 0.40x | below | 122.94 ms | 121.14 ms | 125.91 ms | 967967 | -746772258 | full-string |

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
  - public-accessor=106.3 MiB/s
  - raw-frame-direct-decode=119.3 MiB/s
  - relative=1.12x
- numeric-name-id-cache-delta: The numeric name-id variant keeps full string materialization but avoids repeated accessor calls for already-interned names.
  - public-accessor=106.3 MiB/s
  - raw-frame-name-id-cache=130.1 MiB/s
  - relative=1.22x
