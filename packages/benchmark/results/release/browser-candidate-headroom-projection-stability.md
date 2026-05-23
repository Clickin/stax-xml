# Browser Candidate Headroom Matrix

Generated: 2026-05-23T18:43:35.947Z

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
- Runs: warmups=0, runs=3
- Bounded JS heap reporting gate: 512.0 MiB

## Woodstox Target

- Baseline tool: woodstox
- Woodstox throughput: 333.43 MiB/s
- Goal ratio: 0.90x
- Target throughput: 300.09 MiB/s

## Results

| Variant | Family | Contract scope | Count kind | Throughput | Relative to stringFull | Woodstox ratio | 0.9x target | Bounded JS heap | Counterexample | Events | Checksum | Full parity |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | ---: | ---: | --- |
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | stream-events | 113.35 MiB/s | 2.01x | 0.34x | not-applicable | yes | not-found | 60416563 | 830926359 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | stream-events | 95.10 MiB/s | 1.68x | 0.29x | not-applicable | yes | not-found | 60416563 | -136145711 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | stream-events | 68.05 MiB/s | 1.21x | 0.20x | not-applicable | yes | not-found | 60416563 | 1877738387 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | stream-events | 100.46 MiB/s | 1.78x | 0.30x | not-applicable | yes | not-found | 60416563 | -1847060873 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | stream-events | 97.71 MiB/s | 1.73x | 0.29x | not-applicable | yes | not-found | 60416563 | -1613934246 | no |
| stringFull | full-stax-js | full-string-materialization | stream-events | 56.44 MiB/s | 1.00x | 0.17x | below | yes | not-found | 60416563 | 1441552024 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | stream-events | 47.42 MiB/s | 0.84x | 0.14x | below | yes | not-found | 60416563 | 1441552024 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | stream-events | 56.75 MiB/s | 1.01x | 0.17x | below | yes | not-found | 60416563 | 1441552024 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | stream-events | 55.85 MiB/s | 0.99x | 0.17x | below | yes | not-found | 60416563 | 1441552024 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | stream-events | 60.12 MiB/s | 1.07x | 0.18x | below | yes | not-found | 60416563 | 1441552024 | yes |
| projectionLowSelectivity | projection-js | projected-records-low-selectivity | projected-records | 103.92 MiB/s | 1.84x | 0.31x | not-applicable | yes | not-found | 33382 | -403434369 | no |
| projectionHighSelectivity | projection-js | projected-records-high-selectivity | projected-records | 72.07 MiB/s | 1.28x | 0.22x | not-applicable | yes | not-found | 3179819 | -2078190377 | no |

## Timing Stability

Rows with `runs > 1` report same-process timing spread; this is variance evidence for the recorded browser build and machine, not a cross-process statistical proof.

| Variant | Runs | Avg ms | Min ms | Max ms | Spread | Samples ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| scanAllNoDecode | 3 | 9033.65 | 7941.09 | 9600.36 | 18.4% | 7941.09, 9559.49, 9600.36 |
| nameStringOnly | 3 | 10767.10 | 10505.09 | 10990.54 | 4.5% | 10505.09, 10990.54, 10805.66 |
| textStringOnly | 3 | 15047.50 | 15033.56 | 15073.65 | 0.3% | 15073.65, 15035.30, 15033.56 |
| attrNameStringOnly | 3 | 10192.94 | 9962.21 | 10442.95 | 4.7% | 10173.65, 10442.95, 9962.21 |
| attrValueStringOnly | 3 | 10480.13 | 10317.95 | 10696.66 | 3.6% | 10317.95, 10696.66, 10425.78 |
| stringFull | 3 | 18141.73 | 17600.53 | 18674.55 | 5.9% | 18150.11, 18674.55, 17600.53 |
| eventObjectFull | 3 | 21595.98 | 20995.17 | 22285.73 | 6.0% | 20995.17, 21507.03, 22285.73 |
| cursorAccessor | 3 | 18043.18 | 17940.65 | 18101.69 | 0.9% | 18087.19, 17940.65, 18101.69 |
| rawFrameDirect | 3 | 18336.30 | 18228.99 | 18503.79 | 1.5% | 18503.79, 18228.99, 18276.13 |
| rawFrameNameId | 3 | 17033.05 | 16940.95 | 17116.76 | 1.0% | 17041.46, 16940.95, 17116.76 |
| projectionLowSelectivity | 3 | 9854.14 | 9743.74 | 9915.87 | 1.7% | 9743.74, 9915.87, 9902.81 |
| projectionHighSelectivity | 3 | 14207.75 | 13852.32 | 14529.36 | 4.8% | 14529.36, 13852.32, 14241.57 |

## Memory

Memory uses Chromium `performance.memory` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg used heap delta | Max used heap | Max total heap | JS heap limit |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +2.6 MiB | 11.9 MiB | 20.0 MiB | 4.00 GiB |
| nameStringOnly | +4.3 MiB | 16.5 MiB | 22.5 MiB | 4.00 GiB |
| textStringOnly | +5.1 MiB | 14.1 MiB | 20.3 MiB | 4.00 GiB |
| attrNameStringOnly | +3.9 MiB | 13.3 MiB | 20.1 MiB | 4.00 GiB |
| attrValueStringOnly | +2.3 MiB | 13.3 MiB | 20.0 MiB | 4.00 GiB |
| stringFull | +4.9 MiB | 13.7 MiB | 19.7 MiB | 4.00 GiB |
| eventObjectFull | +12.3 MiB | 23.1 MiB | 76.8 MiB | 4.00 GiB |
| cursorAccessor | +33.4 MiB | 41.5 MiB | 85.9 MiB | 4.00 GiB |
| rawFrameDirect | +26.3 MiB | 46.6 MiB | 84.0 MiB | 4.00 GiB |
| rawFrameNameId | +46.1 MiB | 55.6 MiB | 90.9 MiB | 4.00 GiB |
| projectionLowSelectivity | +22.6 MiB | 36.0 MiB | 89.8 MiB | 4.00 GiB |
| projectionHighSelectivity | +31.5 MiB | 45.5 MiB | 86.1 MiB | 4.00 GiB |

## Host Process Memory

Windows Win32_Process process tree rooted at the browser pid. Working set and private bytes are host OS counters, not portable browser RSS, and are not variant-level JS heap measurements.

- Scope: windows-process-tree
- Max working set: 518.8 MiB
- Max private bytes: 280.1 MiB
- Max process count: 10

| Sample | Scope | Processes | Working set | Private bytes |
| --- | --- | ---: | ---: | ---: |
| browser-started | windows-process-tree | 9 | 367.9 MiB | 157.3 MiB |
| before-run | windows-process-tree | 10 | 418.3 MiB | 177.9 MiB |
| after-run | windows-process-tree | 8 | 518.8 MiB | 280.1 MiB |

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
  - stringFull: maxJsHeap=13.7 MiB
  - eventObjectFull: maxJsHeap=23.1 MiB
  - cursorAccessor: maxJsHeap=41.5 MiB
  - rawFrameDirect: maxJsHeap=46.6 MiB
  - rawFrameNameId: maxJsHeap=55.6 MiB
- browser-memory-scope: Variant memory is browser JS heap only; it is not a process RSS replacement.
  - stringFull: jsHeapLimit=4.00 GiB
  - eventObjectFull: jsHeapLimit=4.00 GiB
  - cursorAccessor: jsHeapLimit=4.00 GiB
  - rawFrameDirect: jsHeapLimit=4.00 GiB
  - rawFrameNameId: jsHeapLimit=4.00 GiB
- browser-host-process-memory: Host process-tree memory is recorded separately from variant JS heap when the host supports it.
  - maxWorkingSet=518.8 MiB
  - maxPrivateBytes=280.1 MiB
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
  - partial=scanAllNoDecode 113.35 MiB/s
  - full=rawFrameNameId 60.12 MiB/s
- projection-contract: Projection rows report projected record counts and selected-field checksums, not full StAX event parity.
  - projectionLowSelectivity: records=33382, checksum=-403434369, strings=66764
  - projectionHighSelectivity: records=3179819, checksum=-2078190377, strings=6359638
