# Large Candidate Headroom Matrix

Generated: 2026-05-23T18:57:34.912Z

This experiment is a 1 GiB+ bounded-memory counterexample search over generated `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
Projection rows report projected record counts and selected-field checksums; they are workload headroom rows, not full StAX parity rows.
The neutral path uses `Uint8Array` plus `TextDecoder`; it does not use native addons, Node `Buffer.toString()`, or lazy getters.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Node v24.15.0, V8 13.6.233.17-node.48
- Fixture source: generated
- Generated size: 1.00 GiB (1073742077 bytes)
- Fixture shape: projection-cycle
- Row cycle size: 4096
- Row bytes: min=321, max=340, avg=337.7
- Batch size: 16
- Runs: warmups=0, runs=3
- Bounded RSS reporting gate: 512.0 MiB

## Woodstox Target

- Baseline tool: woodstox
- Woodstox throughput: 333.43 MiB/s
- Goal ratio: 0.90x
- 0.9x target throughput: 300.09 MiB/s

## Results

| Variant | Family | Contract scope | Count kind | Throughput | Relative to stringFull | Woodstox ratio | 0.9x target | Bounded memory | Counterexample | Events | Checksum | Full parity |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | ---: | ---: | --- |
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | stream-events | 151.85 MiB/s | 2.00x | 0.46x | not-applicable | yes | not-found | 60416563 | 830926359 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | stream-events | 115.35 MiB/s | 1.52x | 0.35x | not-applicable | yes | not-found | 60416563 | -136145711 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | stream-events | 88.50 MiB/s | 1.17x | 0.27x | not-applicable | yes | not-found | 60416563 | 1877738387 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | stream-events | 127.61 MiB/s | 1.68x | 0.38x | not-applicable | yes | not-found | 60416563 | -1847060873 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | stream-events | 123.21 MiB/s | 1.62x | 0.37x | not-applicable | yes | not-found | 60416563 | -1613934246 | no |
| stringFull | full-stax-js | full-string-materialization | stream-events | 75.94 MiB/s | 1.00x | 0.23x | below | yes | not-found | 60416563 | 1441552024 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | stream-events | 59.93 MiB/s | 0.79x | 0.18x | below | yes | not-found | 60416563 | 1441552024 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | stream-events | 69.81 MiB/s | 0.92x | 0.21x | below | yes | not-found | 60416563 | 1441552024 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | stream-events | 73.94 MiB/s | 0.97x | 0.22x | below | yes | not-found | 60416563 | 1441552024 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | stream-events | 82.47 MiB/s | 1.09x | 0.25x | below | yes | not-found | 60416563 | 1441552024 | yes |
| projectionLowSelectivity | projection-js | projected-records-low-selectivity | projected-records | 128.02 MiB/s | 1.69x | 0.38x | not-applicable | yes | not-found | 33382 | -403434369 | no |
| projectionHighSelectivity | projection-js | projected-records-high-selectivity | projected-records | 99.34 MiB/s | 1.31x | 0.30x | not-applicable | yes | not-found | 3179819 | -2078190377 | no |

## Timing Stability

Rows with `runs > 1` report same-process timing spread; this is variance evidence for the recorded machine, not a cross-process statistical proof.

| Variant | Runs | Avg ms | Min ms | Max ms | Spread | Samples ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| scanAllNoDecode | 3 | 6743.45 | 5096.40 | 7646.99 | 37.8% | 5096.40, 7646.99, 7486.97 |
| nameStringOnly | 3 | 8877.27 | 8802.20 | 8943.12 | 1.6% | 8943.12, 8886.50, 8802.20 |
| textStringOnly | 3 | 11571.01 | 11482.85 | 11618.47 | 1.2% | 11482.85, 11618.47, 11611.71 |
| attrNameStringOnly | 3 | 8024.49 | 7988.77 | 8088.38 | 1.2% | 8088.38, 7996.31, 7988.77 |
| attrValueStringOnly | 3 | 8311.09 | 8261.04 | 8346.19 | 1.0% | 8326.06, 8346.19, 8261.04 |
| stringFull | 3 | 13483.86 | 13406.60 | 13541.85 | 1.0% | 13503.12, 13406.60, 13541.85 |
| eventObjectFull | 3 | 17085.77 | 16557.54 | 17518.20 | 5.6% | 17518.20, 17181.56, 16557.54 |
| cursorAccessor | 3 | 14668.90 | 14556.62 | 14797.75 | 1.6% | 14797.75, 14556.62, 14652.32 |
| rawFrameDirect | 3 | 13849.91 | 13747.42 | 13995.48 | 1.8% | 13995.48, 13806.84, 13747.42 |
| rawFrameNameId | 3 | 12416.75 | 12377.87 | 12462.55 | 0.7% | 12462.55, 12409.82, 12377.87 |
| projectionLowSelectivity | 3 | 7998.63 | 7866.63 | 8102.57 | 2.9% | 8102.57, 8026.68, 7866.63 |
| projectionHighSelectivity | 3 | 10307.56 | 10207.80 | 10439.94 | 2.3% | 10274.93, 10207.80, 10439.94 |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +798.5 KiB | +4.0 MiB | 9.1 MiB | 77.0 MiB |
| nameStringOnly | +327.1 KiB | +656.0 KiB | 10.0 MiB | 78.9 MiB |
| textStringOnly | -377.5 KiB | -1.1 MiB | 10.4 MiB | 78.9 MiB |
| attrNameStringOnly | +237.6 KiB | +1.4 MiB | 9.6 MiB | 79.7 MiB |
| attrValueStringOnly | -7.4 KiB | +69.3 KiB | 11.1 MiB | 79.9 MiB |
| stringFull | -299.5 KiB | -920.0 KiB | 10.5 MiB | 79.9 MiB |
| eventObjectFull | +17.5 MiB | +43.2 MiB | 61.3 MiB | 206.7 MiB |
| cursorAccessor | -8.0 MiB | +5.6 MiB | 61.3 MiB | 224.3 MiB |
| rawFrameDirect | +3.3 MiB | -4.9 MiB | 65.5 MiB | 223.6 MiB |
| rawFrameNameId | +1.1 MiB | +5.3 MiB | 69.7 MiB | 225.0 MiB |
| projectionLowSelectivity | +376.8 KiB | +12.1 MiB | 51.6 MiB | 261.2 MiB |
| projectionHighSelectivity | -3.5 MiB | -12.8 MiB | 51.6 MiB | 261.2 MiB |

## Materialization Counters

Counters are collected inside the measured large-input loop to avoid a second 1 GiB+ pass.

| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Event objects | Projected records | Projection fields | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| scanAllNoDecode | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 | 0 | 0 | 0 | 15,899,095 |
| nameStringOnly | 44,517,466 | 44,517,466 | 0 | 0 | 0 | 0 | 0/0 | 0 | 0 | 0 | 15,899,095 |
| textStringOnly | 15,899,095 | 0 | 15,899,095 | 0 | 0 | 0 | 0/0 | 0 | 0 | 0 | 15,899,095 |
| attrNameStringOnly | 15,899,095 | 0 | 0 | 15,899,095 | 0 | 0 | 0/0 | 0 | 0 | 0 | 15,899,095 |
| attrValueStringOnly | 15,899,095 | 0 | 0 | 0 | 15,899,095 | 0 | 0/0 | 0 | 0 | 0 | 15,899,095 |
| stringFull | 92,214,751 | 44,517,466 | 15,899,095 | 15,899,095 | 15,899,095 | 0 | 0/0 | 0 | 0 | 0 | 15,899,095 |
| eventObjectFull | 92,214,751 | 44,517,466 | 15,899,095 | 15,899,095 | 15,899,095 | 0 | 0/0 | 60,416,563 | 0 | 0 | 15,899,095 |
| cursorAccessor | 92,214,751 | 44,517,466 | 15,899,095 | 15,899,095 | 15,899,095 | 0 | 0/0 | 0 | 0 | 0 | 15,899,095 |
| rawFrameDirect | 92,214,751 | 44,517,466 | 15,899,095 | 15,899,095 | 15,899,095 | 92,214,751 | 0/0 | 0 | 0 | 0 | 15,899,095 |
| rawFrameNameId | 92,214,751 | 44,517,466 | 15,899,095 | 15,899,095 | 15,899,095 | 31,798,200 | 60,416,551/10 | 0 | 0 | 0 | 15,899,095 |
| projectionLowSelectivity | 66,764 | 0 | 33,382 | 0 | 33,382 | 0 | 0/0 | 0 | 33,382 | 66,764 | 0 |
| projectionHighSelectivity | 6,359,638 | 0 | 3,179,819 | 0 | 3,179,819 | 0 | 0/0 | 0 | 3,179,819 | 6,359,638 | 0 |

## Omitted Rows

- none

## Parity

Stream-event rows event-count parity: ok, events=60416563.
Full-string parity rows: ok, events=60416563, checksum=1441552024, rows=stringFull, eventObjectFull, cursorAccessor, rawFrameDirect, rawFrameNameId.
Projection rows report projected record counts: ok, rows=projectionLowSelectivity, projectionHighSelectivity.
Projection low selectivity selects `/root/book[@code="7"]` and captures `@id` plus direct `title` text.
Projection high selectivity selects every `/root/book` and captures `@id` plus direct `title` text.

## Findings

- bounded-memory-contract: Rows consume generated Uint8Array batches and do not load a full XML string.
  - stringFull: maxRSS=79.9 MiB
  - eventObjectFull: maxRSS=206.7 MiB
  - cursorAccessor: maxRSS=224.3 MiB
  - rawFrameDirect: maxRSS=223.6 MiB
  - rawFrameNameId: maxRSS=225.0 MiB
- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
  - scanAllNoDecode: event-types-and-attribute-counts-only, strings=0
  - nameStringOnly: event-types-attribute-counts-and-element-names, strings=44517466
  - textStringOnly: event-types-attribute-counts-and-text-cdata, strings=15899095
  - attrNameStringOnly: event-types-attribute-counts-and-attribute-names, strings=15899095
  - attrValueStringOnly: event-types-attribute-counts-and-attribute-values, strings=15899095
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=60416563, checksum=1441552024
  - eventObjectFull: events=60416563, checksum=1441552024
  - cursorAccessor: events=60416563, checksum=1441552024
  - rawFrameDirect: events=60416563, checksum=1441552024
  - rawFrameNameId: events=60416563, checksum=1441552024
- headroom-search: The fastest row in each family is a headroom signal, not a runtime-limit conclusion.
  - partial=scanAllNoDecode 151.85 MiB/s
  - full=rawFrameNameId 82.47 MiB/s
- projection-contract: Projection rows report projected record counts and selected-field checksums, not full StAX event parity.
  - projectionLowSelectivity: records=33382, checksum=-403434369, strings=66764
  - projectionHighSelectivity: records=3179819, checksum=-2078190377, strings=6359638
