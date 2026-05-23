# Large Candidate Headroom Matrix

Generated: 2026-05-23T19:04:26.907Z

This experiment is a 1 GiB+ bounded-memory counterexample search over generated `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
Projection rows report projected record counts and selected-field checksums; they are workload headroom rows, not full StAX parity rows.
The neutral path uses `Uint8Array` plus `TextDecoder`; it does not use native addons, Node `Buffer.toString()`, or lazy getters.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Bun 1.3.13, JavaScriptCore WebKit 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
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
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | stream-events | 173.22 MiB/s | 2.26x | 0.52x | not-applicable | yes | not-found | 60416563 | 830926359 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | stream-events | 129.38 MiB/s | 1.69x | 0.39x | not-applicable | yes | not-found | 60416563 | -136145711 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | stream-events | 96.92 MiB/s | 1.26x | 0.29x | not-applicable | yes | not-found | 60416563 | 1877738387 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | stream-events | 140.14 MiB/s | 1.83x | 0.42x | not-applicable | yes | not-found | 60416563 | -1847060873 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | stream-events | 127.66 MiB/s | 1.66x | 0.38x | not-applicable | yes | not-found | 60416563 | -1613934246 | no |
| stringFull | full-stax-js | full-string-materialization | stream-events | 76.77 MiB/s | 1.00x | 0.23x | below | yes | not-found | 60416563 | 1441552024 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | stream-events | 62.14 MiB/s | 0.81x | 0.19x | below | yes | not-found | 60416563 | 1441552024 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | stream-events | 77.98 MiB/s | 1.02x | 0.23x | below | yes | not-found | 60416563 | 1441552024 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | stream-events | 63.87 MiB/s | 0.83x | 0.19x | below | yes | not-found | 60416563 | 1441552024 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | stream-events | 83.10 MiB/s | 1.08x | 0.25x | below | yes | not-found | 60416563 | 1441552024 | yes |
| projectionLowSelectivity | projection-js | projected-records-low-selectivity | projected-records | 125.90 MiB/s | 1.64x | 0.38x | not-applicable | yes | not-found | 33382 | -403434369 | no |
| projectionHighSelectivity | projection-js | projected-records-high-selectivity | projected-records | 89.98 MiB/s | 1.17x | 0.27x | not-applicable | yes | not-found | 3179819 | -2078190377 | no |

## Timing Stability

Rows with `runs > 1` report same-process timing spread; this is variance evidence for the recorded machine, not a cross-process statistical proof.

| Variant | Runs | Avg ms | Min ms | Max ms | Spread | Samples ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| scanAllNoDecode | 3 | 5911.55 | 4160.88 | 6810.90 | 44.8% | 4160.88, 6810.90, 6762.87 |
| nameStringOnly | 3 | 7914.87 | 7875.84 | 7983.94 | 1.4% | 7875.84, 7884.82, 7983.94 |
| textStringOnly | 3 | 10565.21 | 10493.61 | 10621.32 | 1.2% | 10621.32, 10580.71, 10493.61 |
| attrNameStringOnly | 3 | 7306.85 | 7168.95 | 7378.10 | 2.9% | 7378.10, 7373.51, 7168.95 |
| attrValueStringOnly | 3 | 8021.51 | 7857.00 | 8140.29 | 3.5% | 7857.00, 8067.25, 8140.29 |
| stringFull | 3 | 13337.86 | 13155.70 | 13510.28 | 2.7% | 13510.28, 13347.62, 13155.70 |
| eventObjectFull | 3 | 16478.28 | 16385.28 | 16556.61 | 1.0% | 16556.61, 16492.94, 16385.28 |
| cursorAccessor | 3 | 13131.63 | 13028.81 | 13254.09 | 1.7% | 13254.09, 13111.99, 13028.81 |
| rawFrameDirect | 3 | 16033.47 | 15939.86 | 16146.98 | 1.3% | 15939.86, 16146.98, 16013.56 |
| rawFrameNameId | 3 | 12322.72 | 12285.54 | 12345.67 | 0.5% | 12285.54, 12336.95, 12345.67 |
| projectionLowSelectivity | 3 | 8133.56 | 8050.04 | 8202.33 | 1.9% | 8202.33, 8148.31, 8050.04 |
| projectionHighSelectivity | 3 | 11380.50 | 9856.04 | 13452.11 | 31.6% | 13452.11, 10833.35, 9856.04 |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +1.2 MiB | +9.4 MiB | 4.1 MiB | 190.4 MiB |
| nameStringOnly | -15.2 KiB | -962.7 KiB | 3.7 MiB | 186.2 MiB |
| textStringOnly | +10.7 MiB | -1.7 MiB | 35.8 MiB | 170.9 MiB |
| attrNameStringOnly | -10.7 MiB | -2.4 MiB | 35.8 MiB | 184.2 MiB |
| attrValueStringOnly | -9.8 KiB | +6.7 MiB | 3.7 MiB | 196.6 MiB |
| stringFull | +3.4 MiB | -9.8 MiB | 13.7 MiB | 183.2 MiB |
| eventObjectFull | +12.3 MiB | -3.3 MiB | 50.7 MiB | 164.5 MiB |
| cursorAccessor | -8.9 MiB | -1.3 MiB | 50.7 MiB | 159.0 MiB |
| rawFrameDirect | +954.8 KiB | +3.1 MiB | 26.8 MiB | 181.2 MiB |
| rawFrameNameId | +2.4 MiB | -2.9 MiB | 34.1 MiB | 170.8 MiB |
| projectionLowSelectivity | -1.6 MiB | +3.5 MiB | 34.1 MiB | 193.0 MiB |
| projectionHighSelectivity | -3.5 MiB | -2.0 MiB | 34.7 MiB | 181.5 MiB |

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
  - stringFull: maxRSS=183.2 MiB
  - eventObjectFull: maxRSS=164.5 MiB
  - cursorAccessor: maxRSS=159.0 MiB
  - rawFrameDirect: maxRSS=181.2 MiB
  - rawFrameNameId: maxRSS=170.8 MiB
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
  - partial=scanAllNoDecode 173.22 MiB/s
  - full=rawFrameNameId 83.10 MiB/s
- projection-contract: Projection rows report projected record counts and selected-field checksums, not full StAX event parity.
  - projectionLowSelectivity: records=33382, checksum=-403434369, strings=66764
  - projectionHighSelectivity: records=3179819, checksum=-2078190377, strings=6359638
