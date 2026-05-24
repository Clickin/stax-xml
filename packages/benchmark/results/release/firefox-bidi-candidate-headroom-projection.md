# Browser Candidate Headroom Matrix

Generated: 2026-05-24T04:48:53.831Z

This experiment is a browser-runtime counterexample search over generated browser `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
Projection rows report projected record counts and selected-field checksums; they are workload headroom rows, not full StAX parity rows.
Variant memory uses browser JS heap only. Host process-tree memory is reported separately when available and must not be mixed with Node/Bun RSS rows as the same memory proof.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Firefox 143.0, SpiderMonkey, Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0
- Fixture source: generated
- Generated size: 1.00 GiB (1073742077 bytes)
- Fixture shape: projection-cycle
- Row cycle size: 4096
- Row bytes: min=321, max=340, avg=337.7
- Batch size: 16
- Runs: warmups=0, runs=1
- Bounded JS heap reporting gate: 512.0 MiB
- Cases: stringFull, eventObjectFull, rawFrameNameId, projectionLowSelectivity, projectionHighSelectivity

## Woodstox Target

- Baseline tool: woodstox
- Woodstox throughput: 333.43 MiB/s
- Goal ratio: 0.90x
- Target throughput: 300.09 MiB/s

## Results

| Variant | Family | Contract scope | Count kind | Throughput | Relative to stringFull | Woodstox ratio | 0.9x target | Bounded JS heap | Counterexample | Events | Checksum | Full parity |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | ---: | ---: | --- |
| stringFull | full-stax-js | full-string-materialization | stream-events | 61.77 MiB/s | 1.00x | 0.19x | below | no | not-found | 60416563 | 1441552024 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | stream-events | 52.54 MiB/s | 0.85x | 0.16x | below | no | not-found | 60416563 | 1441552024 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | stream-events | 64.24 MiB/s | 1.04x | 0.19x | below | no | not-found | 60416563 | 1441552024 | yes |
| projectionLowSelectivity | projection-js | projected-records-low-selectivity | projected-records | 115.30 MiB/s | 1.87x | 0.35x | not-applicable | no | not-found | 33382 | -403434369 | no |
| projectionHighSelectivity | projection-js | projected-records-high-selectivity | projected-records | 82.57 MiB/s | 1.34x | 0.25x | not-applicable | no | not-found | 3179819 | -2078190377 | no |

## Memory

Memory uses page-exposed browser JS heap counters before and after each measured run when the engine provides them; max values are the maximum observed run endpoints.

| Variant | Avg used heap delta | Max used heap | Max total heap | JS heap limit |
| --- | ---: | ---: | ---: | ---: |
| stringFull | n/a | n/a | n/a | n/a |
| eventObjectFull | n/a | n/a | n/a | n/a |
| rawFrameNameId | n/a | n/a | n/a | n/a |
| projectionLowSelectivity | n/a | n/a | n/a | n/a |
| projectionHighSelectivity | n/a | n/a | n/a | n/a |

## Host Process Memory

Windows Win32_Process process tree rooted at the browser pid. Working set and private bytes are host OS counters, not portable browser RSS, and are not variant-level JS heap measurements.

- Scope: windows-process-tree
- Max working set: 865.0 MiB
- Max private bytes: 699.8 MiB
- Max process count: 12

| Sample | Scope | Processes | Working set | Private bytes |
| --- | --- | ---: | ---: | ---: |
| browser-started | windows-process-tree | 12 | 677.9 MiB | 554.8 MiB |
| before-run | windows-process-tree | 12 | 741.4 MiB | 615.2 MiB |
| after-run | windows-process-tree | 12 | 865.0 MiB | 699.8 MiB |

## Per-Variant Host Process Memory Probes

These counters bracket separate fresh-browser per-case probe runs at the host process-tree level. They are useful row-level host evidence, but they are not portable browser RSS, not page JS heap measurements, and not the timing samples used for the throughput table.

| Variant | Scope | Max working set | Max private bytes | Max process count | Samples | Probe throughput |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| stringFull | windows-process-tree | 673.6 MiB | 549.7 MiB | 12 | 2 | 60.05 MiB/s |
| eventObjectFull | windows-process-tree | 724.1 MiB | 566.6 MiB | 12 | 2 | 53.09 MiB/s |
| rawFrameNameId | windows-process-tree | 702.6 MiB | 564.3 MiB | 12 | 2 | 67.28 MiB/s |
| projectionLowSelectivity | windows-process-tree | 676.0 MiB | 551.7 MiB | 12 | 2 | 118.30 MiB/s |
| projectionHighSelectivity | windows-process-tree | 691.6 MiB | 553.3 MiB | 12 | 2 | 86.75 MiB/s |

## Materialization Counters

| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Event objects | Projected records | Projection fields | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| stringFull | 92,214,751 | 44,517,466 | 15,899,095 | 15,899,095 | 15,899,095 | 0 | 0/0 | 0 | 0 | 0 | 15,899,095 |
| eventObjectFull | 92,214,751 | 44,517,466 | 15,899,095 | 15,899,095 | 15,899,095 | 0 | 0/0 | 60,416,563 | 0 | 0 | 15,899,095 |
| rawFrameNameId | 92,214,751 | 44,517,466 | 15,899,095 | 15,899,095 | 15,899,095 | 31,798,200 | 60,416,551/10 | 0 | 0 | 0 | 15,899,095 |
| projectionLowSelectivity | 66,764 | 0 | 33,382 | 0 | 33,382 | 0 | 0/0 | 0 | 33,382 | 66,764 | 0 |
| projectionHighSelectivity | 6,359,638 | 0 | 3,179,819 | 0 | 3,179,819 | 0 | 0/0 | 0 | 3,179,819 | 6,359,638 | 0 |

## Omitted Rows

- processRss: Browsers do not expose a portable process RSS metric to page JavaScript; this report records page-exposed JS heap counters when available and separate Windows process-tree counters when available.

## Parity

- Stream-event rows event-count parity: ok, events=60416563, rows=stringFull, eventObjectFull, rawFrameNameId
- Full-string parity rows: ok, events=60416563, checksum=1441552024, rows=stringFull, eventObjectFull, rawFrameNameId
- Projection rows report projected record counts: ok, rows=projectionLowSelectivity, projectionHighSelectivity
- Projection low selectivity selects `/root/book[@code="7"]` and captures `@id` plus direct `title` text.
- Projection high selectivity selects every `/root/book` and captures `@id` plus direct `title` text.

## Findings

- browser-byte-batch-contract: Rows consume generated browser Uint8Array batches and do not load a full XML string.
  - stringFull: maxJsHeap=n/a
  - eventObjectFull: maxJsHeap=n/a
  - rawFrameNameId: maxJsHeap=n/a
- browser-memory-scope: Variant memory is browser JS heap only; it is not a process RSS replacement.
  - stringFull: jsHeapLimit=n/a
  - eventObjectFull: jsHeapLimit=n/a
  - rawFrameNameId: jsHeapLimit=n/a
- browser-host-process-memory: Host process-tree memory is recorded separately from variant JS heap when the host supports it.
  - maxWorkingSet=865.0 MiB
  - maxPrivateBytes=699.8 MiB
  - maxProcessCount=12
- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=60416563, checksum=1441552024
  - eventObjectFull: events=60416563, checksum=1441552024
  - rawFrameNameId: events=60416563, checksum=1441552024
- headroom-search: The fastest row in each family is a browser headroom signal, not a runtime-limit conclusion.
  - partial=missing
  - full=rawFrameNameId 64.24 MiB/s
- projection-contract: Projection rows report projected record counts and selected-field checksums, not full StAX event parity.
  - projectionLowSelectivity: records=33382, checksum=-403434369, strings=66764
  - projectionHighSelectivity: records=3179819, checksum=-2078190377, strings=6359638

## Firefox BiDi Notes

- Automation: WebDriver BiDi
- Browser: Firefox 143.0
- Engine: SpiderMonkey
- This path does not use Playwright, Selenium, CDP, or a native addon.
- Firefox does not expose Chromium `performance.memory`; per-variant host process-tree probes are Windows host evidence, not portable browser RSS or JS heap proof.
