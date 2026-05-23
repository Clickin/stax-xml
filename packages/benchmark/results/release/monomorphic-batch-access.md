# Monomorphic Batch Access

Generated: 2026-05-23T08:32:20.782Z

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
| public-accessor | 107.5 MiB/s | 1.00x | 0.33x | below | 148.88 ms | 147.18 ms | 150.44 ms | 967967 | -746772258 | full-string |
| raw-frame-direct-decode | 121.0 MiB/s | 1.13x | 0.37x | below | 132.22 ms | 130.36 ms | 133.61 ms | 967967 | -746772258 | full-string |
| raw-frame-name-id-cache | 132.3 MiB/s | 1.23x | 0.40x | below | 120.95 ms | 120.84 ms | 121.17 ms | 967967 | -746772258 | full-string |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg heap delta | Avg heap total delta | Avg RSS delta | Avg external delta | Avg arrayBuffers delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| public-accessor | +999.2 KiB | +768.0 KiB | +6.8 MiB | +5.0 MiB | +6.4 MiB | 6.0 MiB | 129.1 MiB |
| raw-frame-direct-decode | +1.8 MiB | 0 B | -516.0 KiB | -682.7 KiB | -280.3 KiB | 6.7 MiB | 131.0 MiB |
| raw-frame-name-id-cache | +794.4 KiB | 0 B | -261.3 KiB | -597.3 KiB | -67.0 KiB | 5.8 MiB | 130.4 MiB |

## Materialization Counters

Counters are collected in a separate parity-checked pass after timed samples, so throughput rows stay focused on the implementation shape under test.
String fields are the names, text values, attribute names, and attribute values consumed by the checksum contract. Raw span materializations are string creations performed by raw-frame benchmark code rather than public accessors.

| Variant | String fields | Names | Text | Attr names | Attr values | Raw span materializations | Raw name spans | Raw text spans | Raw attr-name spans | Raw attr-value spans | Name cache hit/miss | Event objects |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| public-accessor | 1537355 | 683270 | 284695 | 284695 | 284695 | 0 | 0 | 0 | 0 | 0 | 0/0 | 0 |
| raw-frame-direct-decode | 1537355 | 683270 | 284695 | 284695 | 284695 | 1537355 | 683270 | 284695 | 284695 | 284695 | 0/0 | 0 |
| raw-frame-name-id-cache | 1537355 | 683270 | 284695 | 284695 | 284695 | 569400 | 6 | 284695 | 4 | 284695 | 967955/10 | 0 |

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
  - public-accessor=107.5 MiB/s
  - raw-frame-direct-decode=121.0 MiB/s
  - relative=1.13x
- numeric-name-id-cache-delta: The numeric name-id variant keeps full string materialization but avoids repeated accessor calls for already-interned names.
  - public-accessor=107.5 MiB/s
  - raw-frame-name-id-cache=132.3 MiB/s
  - relative=1.23x
