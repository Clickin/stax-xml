# Candidate Headroom Matrix

Generated: 2026-05-23T12:05:53.747Z

This experiment is a counterexample search scaffold, not a runtime-limit conclusion.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
The neutral path uses `Uint8Array` plus `TextDecoder`; it does not use native addons, Node `Buffer.toString()`, or lazy getters.

## Fixture

- Source: file
- Size: 16.0 MiB (16777038 bytes)
- Runs: warmups=1, runs=3
- Runtime: v24.15.0, V8 13.6.233.17-node.48

## Woodstox Target

- Baseline tool: woodstox
- Woodstox throughput: 333.4 MiB/s
- Goal ratio: 0.90x
- 0.9x target throughput: 300.1 MiB/s

## Results

| Variant | Family | Contract scope | Throughput | Relative to stringFull | Woodstox ratio | 0.9x target | Events | Checksum | Full parity |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | --- |
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | 185.6 MiB/s | 1.80x | 0.56x | not-applicable | 967967 | -141941271 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | 158.1 MiB/s | 1.53x | 0.47x | not-applicable | 967967 | 567705755 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | 124.4 MiB/s | 1.21x | 0.37x | not-applicable | 967967 | 2143003593 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | 171.6 MiB/s | 1.66x | 0.51x | not-applicable | 967967 | -69729623 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | 172.3 MiB/s | 1.67x | 0.52x | not-applicable | 967967 | -324005832 | no |
| stringFull | full-stax-js | full-string-materialization | 103.1 MiB/s | 1.00x | 0.31x | below | 967967 | -746772258 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | 102.5 MiB/s | 0.99x | 0.31x | below | 967967 | -746772258 | yes |
| eventObjectFull | full-stax-js | full-string-materialization-from-string-input | 82.1 MiB/s | 0.80x | 0.25x | below | 967967 | -746772258 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | 110.5 MiB/s | 1.07x | 0.33x | below | 967967 | -746772258 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | 128.8 MiB/s | 1.25x | 0.39x | below | 967967 | -746772258 | yes |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +1.1 MiB | +4.4 MiB | 5.9 MiB | 144.8 MiB |
| nameStringOnly | +775.2 KiB | -7.4 MiB | 5.9 MiB | 145.8 MiB |
| textStringOnly | +926.1 KiB | -8.1 MiB | 5.4 MiB | 147.8 MiB |
| attrNameStringOnly | +778.6 KiB | -6.5 MiB | 5.2 MiB | 146.4 MiB |
| attrValueStringOnly | +1.4 MiB | +221.3 KiB | 5.5 MiB | 148.3 MiB |
| stringFull | +976.8 KiB | -8.5 MiB | 5.1 MiB | 175.5 MiB |
| cursorAccessor | +1.5 MiB | -7.3 MiB | 6.1 MiB | 149.5 MiB |
| eventObjectFull | +675.2 KiB | -29.2 MiB | 5.1 MiB | 178.9 MiB |
| rawFrameDirect | +1.8 MiB | +2.3 MiB | 6.1 MiB | 135.8 MiB |
| rawFrameNameId | +1.4 MiB | -9.4 MiB | 7.1 MiB | 159.8 MiB |

## Materialization Counters

Counters are collected in a separate parity-checked pass after timed samples.

| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Event objects | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| scanAllNoDecode | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 | 0 | 284695 |
| nameStringOnly | 683270 | 683270 | 0 | 0 | 0 | 0 | 0/0 | 0 | 284695 |
| textStringOnly | 284695 | 0 | 284695 | 0 | 0 | 0 | 0/0 | 0 | 284695 |
| attrNameStringOnly | 284695 | 0 | 0 | 284695 | 0 | 0 | 0/0 | 0 | 284695 |
| attrValueStringOnly | 284695 | 0 | 0 | 0 | 284695 | 0 | 0/0 | 0 | 284695 |
| stringFull | 1537355 | 683270 | 284695 | 284695 | 284695 | 0 | 0/0 | 0 | 284695 |
| cursorAccessor | 1537355 | 683270 | 284695 | 284695 | 284695 | 0 | 0/0 | 0 | 284695 |
| eventObjectFull | 1537355 | 683270 | 284695 | 284695 | 284695 | 0 | 0/0 | 967967 | 284695 |
| rawFrameDirect | 1537355 | 683270 | 284695 | 284695 | 284695 | 1537355 | 0/0 | 0 | 284695 |
| rawFrameNameId | 1537355 | 683270 | 284695 | 284695 | 284695 | 569400 | 967955/10 | 0 | 284695 |

## Parity

All rows event-count parity: ok, events=967967.
Full-string parity rows: ok, events=967967, checksum=-746772258, rows=stringFull, cursorAccessor, eventObjectFull, rawFrameDirect, rawFrameNameId.

## Findings

- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
  - scanAllNoDecode: event-types-and-attribute-counts-only, strings=0
  - nameStringOnly: event-types-attribute-counts-and-element-names, strings=683270
  - textStringOnly: event-types-attribute-counts-and-text-cdata, strings=284695
  - attrNameStringOnly: event-types-attribute-counts-and-attribute-names, strings=284695
  - attrValueStringOnly: event-types-attribute-counts-and-attribute-values, strings=284695
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=967967, checksum=-746772258
  - cursorAccessor: events=967967, checksum=-746772258
  - eventObjectFull: events=967967, checksum=-746772258
  - rawFrameDirect: events=967967, checksum=-746772258
  - rawFrameNameId: events=967967, checksum=-746772258
- headroom-search: The fastest row in each family is a headroom signal, not a runtime-limit conclusion.
  - partial=scanAllNoDecode 185.6 MiB/s
  - full=rawFrameNameId 128.8 MiB/s
