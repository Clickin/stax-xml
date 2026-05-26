# File-Backed Materialization Category Drop Sweep

Generated: 2026-05-26T00:15:00.119Z

Measures the cost of each string materialization category over the same file-backed synchronous Iterable<Uint8Array[]> source. Near-full rows intentionally omit one category and are headroom evidence, not full StAX counterexamples.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
- Fixture size: 1024.00 MiB
- Source shape: file-backed sync Iterable<Uint8Array[]>
- Chunk KiB: 32
- Batch size: 4
- Fastest row: withoutTextStrings 172.69 MiB/s, RSS 63.36 MiB
- Fastest full-string row: stringFull 132.13 MiB/s, RSS 61.35 MiB
- 200 MiB/s bounded full-string counterexamples: 0
- 200 MiB/s bounded partial/headroom rows: 0

## Rows

| Row | Contract scope | MiB/s | Full string | Bounded | Max RSS | String fields | Events | Checksum |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: |
| `stringFull` | full-string-materialization | 132.13 | yes | yes | 61.35 MiB | 97258079 | 61236571 | -716099804 |
| `withoutElementNameStrings` | full-materialization-minus-element-names | 133.33 | no | yes | 61.18 MiB | 54032265 | 61236571 | 296957194 |
| `withoutTextStrings` | full-materialization-minus-text-cdata | 172.69 | no | yes | 63.36 MiB | 79247324 | 61236571 | -413060314 |
| `withoutAttributeNameStrings` | full-materialization-minus-attribute-names | 127.92 | no | yes | 61.21 MiB | 79247324 | 61236571 | 615320352 |
| `withoutAttributeValueStrings` | full-materialization-minus-attribute-values | 142.04 | no | yes | 61.33 MiB | 79247324 | 61236571 | 396015339 |

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
  - file-backed-sync-iterable-byte-batches chunk=32KiB batch=4
- category-drop-headroom (BENCH_FACT): Fastest category row was withoutTextStrings at 172.69 MiB/s; fastest full-string row was stringFull at 132.13 MiB/s.
  - stringFull=132.13 MiB/s fullString=true strings=97258079
  - withoutElementNameStrings=133.33 MiB/s fullString=false strings=54032265
  - withoutTextStrings=172.69 MiB/s fullString=false strings=79247324
  - withoutAttributeNameStrings=127.92 MiB/s fullString=false strings=79247324
  - withoutAttributeValueStrings=142.04 MiB/s fullString=false strings=79247324
- bounded-counterexample-search (COUNTEREXAMPLE_NOT_FOUND): The file-backed category-drop sweep applies the same 200 MiB/s bounded full-string counterexample rule.
  - stringFull: bounded=true, mibPerSec=132.13
  - withoutElementNameStrings: bounded=true, mibPerSec=133.33
  - withoutTextStrings: bounded=true, mibPerSec=172.69
  - withoutAttributeNameStrings: bounded=true, mibPerSec=127.92
  - withoutAttributeValueStrings: bounded=true, mibPerSec=142.04

## Limits

- Near-full rows intentionally omit one string category and cannot be used as StAX full-materialization counterexamples.
- This is a file-backed source-shape artifact, not a direct ReadableStream row and not an OS-cache-neutral disk benchmark.
- A missing counterexample in this artifact is not a JavaScript runtime ceiling proof.

