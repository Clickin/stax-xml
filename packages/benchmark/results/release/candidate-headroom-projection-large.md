# Large Candidate Headroom Matrix

Generated: 2026-05-23T18:02:29.314Z

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
- Runs: warmups=0, runs=1
- Bounded RSS reporting gate: 512.0 MiB

## Woodstox Target

- Baseline tool: woodstox
- Woodstox throughput: 333.43 MiB/s
- Goal ratio: 0.90x
- 0.9x target throughput: 300.09 MiB/s

## Results

| Variant | Family | Contract scope | Count kind | Throughput | Relative to stringFull | Woodstox ratio | 0.9x target | Bounded memory | Counterexample | Events | Checksum | Full parity |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | ---: | ---: | --- |
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | stream-events | 199.91 MiB/s | 2.98x | 0.60x | not-applicable | yes | not-found | 60416563 | 830926359 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | stream-events | 109.50 MiB/s | 1.63x | 0.33x | not-applicable | yes | not-found | 60416563 | -136145711 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | stream-events | 99.15 MiB/s | 1.48x | 0.30x | not-applicable | yes | not-found | 60416563 | 1877738387 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | stream-events | 133.57 MiB/s | 1.99x | 0.40x | not-applicable | yes | not-found | 60416563 | -1847060873 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | stream-events | 128.81 MiB/s | 1.92x | 0.39x | not-applicable | yes | not-found | 60416563 | -1613934246 | no |
| stringFull | full-stax-js | full-string-materialization | stream-events | 67.04 MiB/s | 1.00x | 0.20x | below | yes | not-found | 60416563 | 1441552024 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | stream-events | 57.67 MiB/s | 0.86x | 0.17x | below | yes | not-found | 60416563 | 1441552024 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | stream-events | 77.29 MiB/s | 1.15x | 0.23x | below | yes | not-found | 60416563 | 1441552024 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | stream-events | 74.48 MiB/s | 1.11x | 0.22x | below | yes | not-found | 60416563 | 1441552024 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | stream-events | 82.91 MiB/s | 1.24x | 0.25x | below | yes | not-found | 60416563 | 1441552024 | yes |
| projectionLowSelectivity | projection-js | projected-records-low-selectivity | projected-records | 127.79 MiB/s | 1.91x | 0.38x | not-applicable | yes | not-found | 33382 | -403434369 | no |
| projectionHighSelectivity | projection-js | projected-records-high-selectivity | projected-records | 99.60 MiB/s | 1.49x | 0.30x | not-applicable | yes | not-found | 3179819 | -2078190377 | no |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +1.2 MiB | +3.1 MiB | 6.7 MiB | 68.9 MiB |
| nameStringOnly | +1.3 MiB | +1.8 MiB | 7.2 MiB | 70.8 MiB |
| textStringOnly | +1.2 MiB | +3.9 MiB | 7.1 MiB | 74.8 MiB |
| attrNameStringOnly | +666.3 KiB | +3.1 MiB | 6.5 MiB | 78.0 MiB |
| attrValueStringOnly | +1.9 MiB | +388.0 KiB | 7.7 MiB | 78.5 MiB |
| stringFull | +3.2 MiB | -3.5 MiB | 9.1 MiB | 78.5 MiB |
| eventObjectFull | +28.8 MiB | +60.8 MiB | 34.8 MiB | 135.9 MiB |
| cursorAccessor | +10.7 MiB | +8.3 MiB | 16.6 MiB | 144.3 MiB |
| rawFrameDirect | +14.3 MiB | -2.7 MiB | 20.3 MiB | 144.5 MiB |
| rawFrameNameId | +22.5 MiB | +6.3 MiB | 28.8 MiB | 146.0 MiB |
| projectionLowSelectivity | +15.4 MiB | +12.0 MiB | 21.5 MiB | 156.1 MiB |
| projectionHighSelectivity | +32.2 MiB | -14.3 MiB | 38.5 MiB | 156.1 MiB |

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
  - stringFull: maxRSS=78.5 MiB
  - eventObjectFull: maxRSS=135.9 MiB
  - cursorAccessor: maxRSS=144.3 MiB
  - rawFrameDirect: maxRSS=144.5 MiB
  - rawFrameNameId: maxRSS=146.0 MiB
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
  - partial=scanAllNoDecode 199.91 MiB/s
  - full=rawFrameNameId 82.91 MiB/s
- projection-contract: Projection rows report projected record counts and selected-field checksums, not full StAX event parity.
  - projectionLowSelectivity: records=33382, checksum=-403434369, strings=66764
  - projectionHighSelectivity: records=3179819, checksum=-2078190377, strings=6359638
