# Object Shape Parity

Generated: 2026-05-23T08:09:30.262Z

This benchmark compares JavaScript reader object shapes under the same full-string checksum contract.
It does not filter events, skip strings, use native addons, or use Node Buffer-specific decoding as the optimization being measured.

## Fixture

- Source: file
- Size: 16.0 MiB (16777038 bytes)
- Runs: warmups=1, runs=3

## Results

| Variant | Object shape | Per-event object | Throughput | Relative to stream batch | Average | Events | Checksum |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| stream-batch-index | StreamBatch index accessors | no | 124.2 MiB/s | 1.00x | 128.81 ms | 967967 | -746772258 |
| stream-event-view | StreamEventView wrapper per event | yes | 86.4 MiB/s | 0.70x | 185.15 ms | 967967 | -746772258 |
| cursor-adapter | single mutable cursor over StreamBatch | no | 107.5 MiB/s | 0.87x | 148.87 ms | 967967 | -746772258 |
| event-reader-object | EventReaderSync public event objects | yes | 94.3 MiB/s | 0.76x | 169.74 ms | 967967 | -746772258 |
| raw-frame-name-id | nextRawBatch typed arrays with numeric name-id cache | no | 136.8 MiB/s | 1.10x | 116.98 ms | 967967 | -746772258 |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| stream-batch-index | +1.3 MiB | +8.8 MiB | 6.9 MiB | 146.6 MiB |
| stream-event-view | +57.7 MiB | +52.7 MiB | 73.5 MiB | 293.2 MiB |
| cursor-adapter | +34.4 MiB | -757.3 KiB | 38.5 MiB | 279.1 MiB |
| event-reader-object | +43.5 MiB | -12.2 MiB | 48.8 MiB | 275.1 MiB |
| raw-frame-name-id | +34.5 MiB | +1001.3 KiB | 38.7 MiB | 278.4 MiB |

## Parity

Status: ok
Events: 967967
Checksum: -746772258

## Findings

- shape-parity: All variants consume the same event types, names, text, attribute names, and attribute values.
  - stream-batch-index: events=967967, checksum=-746772258
  - stream-event-view: events=967967, checksum=-746772258
  - cursor-adapter: events=967967, checksum=-746772258
  - event-reader-object: events=967967, checksum=-746772258
  - raw-frame-name-id: events=967967, checksum=-746772258
- object-shape-deltas: Relative throughput separates public object/view/cursor shape overhead from parser-core and string materialization work.
  - stream-batch-index: relative=1.00x
  - stream-event-view: relative=0.70x
  - cursor-adapter: relative=0.87x
  - event-reader-object: relative=0.76x
  - raw-frame-name-id: relative=1.10x
