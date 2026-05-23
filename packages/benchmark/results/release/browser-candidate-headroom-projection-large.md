# Browser Candidate Headroom Matrix

Generated: 2026-05-23T18:22:35.996Z

This experiment is a browser-runtime counterexample search over generated browser `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
Projection rows report projected record counts and selected-field checksums; they are workload headroom rows, not full StAX parity rows.
Variant memory uses browser JS heap only. Host process-tree memory is reported separately when available and must not be mixed with Node/Bun RSS rows as the same memory proof.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Chrome 148.0.0.0, V8, Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36
- Fixture source: generated
- Generated size: 1.00 GiB (1073742077 bytes)
- Fixture shape: projection-cycle
- Row cycle size: 4096
- Row bytes: min=321, max=340, avg=337.7
- Batch size: 16
- Runs: warmups=0, runs=1
- Bounded JS heap reporting gate: 512.0 MiB

## Woodstox Target

- Baseline tool: woodstox
- Woodstox throughput: 333.43 MiB/s
- Goal ratio: 0.90x
- Target throughput: 300.09 MiB/s

## Results

| Variant | Family | Contract scope | Count kind | Throughput | Relative to stringFull | Woodstox ratio | 0.9x target | Bounded JS heap | Counterexample | Events | Checksum | Full parity |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | ---: | ---: | --- |
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | stream-events | 128.27 MiB/s | 2.27x | 0.38x | not-applicable | yes | not-found | 60416563 | 830926359 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | stream-events | 98.36 MiB/s | 1.74x | 0.29x | not-applicable | yes | not-found | 60416563 | -136145711 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | stream-events | 67.89 MiB/s | 1.20x | 0.20x | not-applicable | yes | not-found | 60416563 | 1877738387 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | stream-events | 101.56 MiB/s | 1.80x | 0.30x | not-applicable | yes | not-found | 60416563 | -1847060873 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | stream-events | 98.59 MiB/s | 1.75x | 0.30x | not-applicable | yes | not-found | 60416563 | -1613934246 | no |
| stringFull | full-stax-js | full-string-materialization | stream-events | 56.44 MiB/s | 1.00x | 0.17x | below | yes | not-found | 60416563 | 1441552024 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | stream-events | 48.12 MiB/s | 0.85x | 0.14x | below | yes | not-found | 60416563 | 1441552024 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | stream-events | 56.15 MiB/s | 0.99x | 0.17x | below | yes | not-found | 60416563 | 1441552024 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | stream-events | 57.69 MiB/s | 1.02x | 0.17x | below | yes | not-found | 60416563 | 1441552024 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | stream-events | 60.32 MiB/s | 1.07x | 0.18x | below | yes | not-found | 60416563 | 1441552024 | yes |
| projectionLowSelectivity | projection-js | projected-records-low-selectivity | projected-records | 104.33 MiB/s | 1.85x | 0.31x | not-applicable | yes | not-found | 33382 | -403434369 | no |
| projectionHighSelectivity | projection-js | projected-records-high-selectivity | projected-records | 69.37 MiB/s | 1.23x | 0.21x | not-applicable | yes | not-found | 3179819 | -2078190377 | no |

## Memory

Memory uses Chromium `performance.memory` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg used heap delta | Max used heap | Max total heap | JS heap limit |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +2.1 MiB | 10.9 MiB | 19.0 MiB | 4.00 GiB |
| nameStringOnly | +4.7 MiB | 13.6 MiB | 20.6 MiB | 4.00 GiB |
| textStringOnly | +1.7 MiB | 10.5 MiB | 18.7 MiB | 4.00 GiB |
| attrNameStringOnly | +3.0 MiB | 10.9 MiB | 18.8 MiB | 4.00 GiB |
| attrValueStringOnly | +7.0 MiB | 14.9 MiB | 20.4 MiB | 4.00 GiB |
| stringFull | +5.9 MiB | 13.8 MiB | 19.8 MiB | 4.00 GiB |
| eventObjectFull | +8.0 MiB | 15.9 MiB | 43.2 MiB | 4.00 GiB |
| cursorAccessor | +8.8 MiB | 16.8 MiB | 44.8 MiB | 4.00 GiB |
| rawFrameDirect | +8.6 MiB | 16.5 MiB | 43.9 MiB | 4.00 GiB |
| rawFrameNameId | +22.0 MiB | 30.0 MiB | 49.6 MiB | 4.00 GiB |
| projectionLowSelectivity | +25.9 MiB | 34.0 MiB | 56.4 MiB | 4.00 GiB |
| projectionHighSelectivity | +10.8 MiB | 19.0 MiB | 44.9 MiB | 4.00 GiB |

## Host Process Memory

Windows Win32_Process process tree rooted at the browser pid. Working set and private bytes are host OS counters, not portable browser RSS, and are not variant-level JS heap measurements.

- Scope: windows-process-tree
- Max working set: 444.3 MiB
- Max private bytes: 210.5 MiB
- Max process count: 10

| Sample | Scope | Processes | Working set | Private bytes |
| --- | --- | ---: | ---: | ---: |
| browser-started | windows-process-tree | 9 | 362.5 MiB | 152.7 MiB |
| before-run | windows-process-tree | 10 | 411.9 MiB | 172.3 MiB |
| after-run | windows-process-tree | 8 | 444.3 MiB | 210.5 MiB |

## Materialization Counters

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

- processRss: Browsers do not expose a portable process RSS metric to page JavaScript; this report records variant JS heap via Chromium performance.memory and separate Windows process-tree counters when available.

## Parity

- Stream-event rows event-count parity: ok, events=60416563, rows=scanAllNoDecode, nameStringOnly, textStringOnly, attrNameStringOnly, attrValueStringOnly, stringFull, eventObjectFull, cursorAccessor, rawFrameDirect, rawFrameNameId
- Full-string parity rows: ok, events=60416563, checksum=1441552024, rows=stringFull, eventObjectFull, cursorAccessor, rawFrameDirect, rawFrameNameId
- Projection rows report projected record counts: ok, rows=projectionLowSelectivity, projectionHighSelectivity
- Projection low selectivity selects `/root/book[@code="7"]` and captures `@id` plus direct `title` text.
- Projection high selectivity selects every `/root/book` and captures `@id` plus direct `title` text.

## Findings

- browser-byte-batch-contract: Rows consume generated browser Uint8Array batches and do not load a full XML string.
  - stringFull: maxJsHeap=13.8 MiB
  - eventObjectFull: maxJsHeap=15.9 MiB
  - cursorAccessor: maxJsHeap=16.8 MiB
  - rawFrameDirect: maxJsHeap=16.5 MiB
  - rawFrameNameId: maxJsHeap=30.0 MiB
- browser-memory-scope: Variant memory is browser JS heap only; it is not a process RSS replacement.
  - stringFull: jsHeapLimit=4.00 GiB
  - eventObjectFull: jsHeapLimit=4.00 GiB
  - cursorAccessor: jsHeapLimit=4.00 GiB
  - rawFrameDirect: jsHeapLimit=4.00 GiB
  - rawFrameNameId: jsHeapLimit=4.00 GiB
- browser-host-process-memory: Host process-tree memory is recorded separately from variant JS heap when the host supports it.
  - maxWorkingSet=444.3 MiB
  - maxPrivateBytes=210.5 MiB
  - maxProcessCount=10
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
- headroom-search: The fastest row in each family is a browser headroom signal, not a runtime-limit conclusion.
  - partial=scanAllNoDecode 128.27 MiB/s
  - full=rawFrameNameId 60.32 MiB/s
- projection-contract: Projection rows report projected record counts and selected-field checksums, not full StAX event parity.
  - projectionLowSelectivity: records=33382, checksum=-403434369, strings=66764
  - projectionHighSelectivity: records=3179819, checksum=-2078190377, strings=6359638
