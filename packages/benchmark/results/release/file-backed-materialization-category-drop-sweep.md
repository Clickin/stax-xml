# File-Backed Materialization Category Drop Sweep

Generated: 2026-05-25T03:01:52.162Z

Measures the cost of each string materialization category over the same file-backed synchronous Iterable<Uint8Array[]> source. Near-full rows intentionally omit one category and are headroom evidence, not full StAX counterexamples.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Source shape: file-backed sync Iterable<Uint8Array[]>
- Chunk KiB: 64
- Batch size: 1
- Fastest row: withoutTextStrings 173.60 MiB/s, RSS 69.30 MiB
- Fastest full-string row: stringFull 127.32 MiB/s, RSS 71.25 MiB
- 200 MiB/s bounded full-string counterexamples: 0
- 200 MiB/s bounded partial/headroom rows: 0

## Rows

| Row | Contract scope | MiB/s | Full string | Bounded | Max RSS | String fields | Events | Checksum |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: |
| `stringFull` | full-string-materialization | 127.32 | yes | yes | 71.25 MiB | 97258079 | 61236571 | -716099804 |
| `withoutElementNameStrings` | full-materialization-minus-element-names | 138.57 | no | yes | 71.18 MiB | 54032265 | 61236571 | 296957194 |
| `withoutTextStrings` | full-materialization-minus-text-cdata | 173.60 | no | yes | 69.30 MiB | 79247324 | 61236571 | -413060314 |
| `withoutAttributeNameStrings` | full-materialization-minus-attribute-names | 135.46 | no | yes | 70.81 MiB | 79247324 | 61236571 | 615320352 |
| `withoutAttributeValueStrings` | full-materialization-minus-attribute-values | 137.51 | no | yes | 70.79 MiB | 79247324 | 61236571 | 396015339 |

## Materialization Counters

| Row | Name | Text | Attr name | Attr value | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: |
| `stringFull` | 43225814 | 18010755 | 18010755 | 18010755 | 18010755 |
| `withoutElementNameStrings` | 0 | 18010755 | 18010755 | 18010755 | 18010755 |
| `withoutTextStrings` | 43225814 | 0 | 18010755 | 18010755 | 18010755 |
| `withoutAttributeNameStrings` | 43225814 | 18010755 | 0 | 18010755 | 18010755 |
| `withoutAttributeValueStrings` | 43225814 | 18010755 | 18010755 | 0 | 18010755 |

## Findings

- same-source-contract (CONTRACT_FACT): All rows consume the same file-backed synchronous Iterable<Uint8Array[]> source shape.
  - file-backed-sync-iterable-byte-batches chunk=64KiB batch=1
- category-drop-headroom (BENCH_FACT): Fastest category row was withoutTextStrings at 173.60 MiB/s; fastest full-string row was stringFull at 127.32 MiB/s.
  - stringFull=127.32 MiB/s fullString=true strings=97258079
  - withoutElementNameStrings=138.57 MiB/s fullString=false strings=54032265
  - withoutTextStrings=173.60 MiB/s fullString=false strings=79247324
  - withoutAttributeNameStrings=135.46 MiB/s fullString=false strings=79247324
  - withoutAttributeValueStrings=137.51 MiB/s fullString=false strings=79247324
- bounded-counterexample-search (COUNTEREXAMPLE_NOT_FOUND): The file-backed category-drop sweep applies the same 200 MiB/s bounded full-string counterexample rule.
  - stringFull: bounded=true, mibPerSec=127.32
  - withoutElementNameStrings: bounded=true, mibPerSec=138.57
  - withoutTextStrings: bounded=true, mibPerSec=173.60
  - withoutAttributeNameStrings: bounded=true, mibPerSec=135.46
  - withoutAttributeValueStrings: bounded=true, mibPerSec=137.51

## Limits

- Near-full rows intentionally omit one string category and cannot be used as StAX full-materialization counterexamples.
- This is a file-backed source-shape artifact, not a direct ReadableStream row and not an OS-cache-neutral disk benchmark.
- A missing counterexample in this artifact is not a JavaScript runtime ceiling proof.

