# Browser Candidate Headroom Matrix

Generated: 2026-05-24T04:13:30.119Z

This experiment is a browser-runtime counterexample search over corpus-backed browser `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
Variant memory uses browser JS heap only. Host process-tree memory is reported separately when available and must not be mixed with Node/Bun RSS rows as the same memory proof.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Firefox 143.0, SpiderMonkey, Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0
- Fixture source: corpus-file
- Source file: G:\programming\stax-xml\packages\stax-xml\performance\samples\treebank_e.xml
- Generated size: 1.00 GiB (1074787404 bytes)
- Fixture shape: corpus-cycle
- Row cycle size: 1
- Row bytes: min=89565617, max=89565617, avg=89565617.0
- Batch size: 1
- Runs: warmups=0, runs=1
- Bounded JS heap reporting gate: 512.0 MiB
- Cases: stringFull, eventObjectFull, rawFrameNameId

## Woodstox Target

- Baseline tool: woodstox
- Woodstox throughput: 333.43 MiB/s
- Goal ratio: 0.90x
- Target throughput: 300.09 MiB/s

## Results

| Variant | Family | Contract scope | Count kind | Throughput | Relative to stringFull | Woodstox ratio | 0.9x target | Bounded JS heap | Counterexample | Events | Checksum | Full parity |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | ---: | ---: | --- |
| stringFull | full-stax-js | full-string-materialization | stream-events | 44.92 MiB/s | 1.00x | 0.13x | below | no | not-found | 75206126 | -925527041 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | stream-events | 36.27 MiB/s | 0.81x | 0.11x | below | no | not-found | 75206126 | -925527041 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | stream-events | 48.15 MiB/s | 1.07x | 0.14x | below | no | not-found | 75206126 | -925527041 | yes |

## Memory

Memory uses page-exposed browser JS heap counters before and after each measured run when the engine provides them; max values are the maximum observed run endpoints.

| Variant | Avg used heap delta | Max used heap | Max total heap | JS heap limit |
| --- | ---: | ---: | ---: | ---: |
| stringFull | n/a | n/a | n/a | n/a |
| eventObjectFull | n/a | n/a | n/a | n/a |
| rawFrameNameId | n/a | n/a | n/a | n/a |

## Host Process Memory

Windows Win32_Process process tree rooted at the browser pid. Working set and private bytes are host OS counters, not portable browser RSS, and are not variant-level JS heap measurements.

- Scope: windows-process-tree
- Max working set: 1.04 GiB
- Max private bytes: 998.1 MiB
- Max process count: 12

| Sample | Scope | Processes | Working set | Private bytes |
| --- | --- | ---: | ---: | ---: |
| browser-started | windows-process-tree | 12 | 674.3 MiB | 551.2 MiB |
| before-run | windows-process-tree | 12 | 736.9 MiB | 612.0 MiB |
| after-run | windows-process-tree | 12 | 1.04 GiB | 998.1 MiB |

## Per-Variant Host Process Memory Probes

These counters bracket separate fresh-browser per-case probe runs at the host process-tree level. They are useful row-level host evidence, but they are not portable browser RSS, not page JS heap measurements, and not the timing samples used for the throughput table.

| Variant | Scope | Max working set | Max private bytes | Max process count | Samples | Probe throughput |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| stringFull | windows-process-tree | 1.04 GiB | 1007.7 MiB | 12 | 2 | 44.67 MiB/s |
| eventObjectFull | windows-process-tree | 1.19 GiB | 1.14 GiB | 12 | 2 | 35.94 MiB/s |
| rawFrameNameId | windows-process-tree | 1.04 GiB | 1002.8 MiB | 12 | 2 | 47.67 MiB/s |

## Materialization Counters

| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Event objects | Projected records | Projection fields | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| stringFull | 75,206,148 | 58,503,984 | 16,702,140 | 12 | 12 | 0 | 0/0 | 0 | 0 | 0 | 12 |
| eventObjectFull | 75,206,148 | 58,503,984 | 16,702,140 | 12 | 12 | 0 | 0/0 | 75,206,126 | 0 | 0 | 12 |
| rawFrameNameId | 75,206,148 | 58,503,984 | 16,702,140 | 12 | 12 | 16,702,403 | 58,503,745/251 | 0 | 0 | 0 | 12 |

## Omitted Rows

- projectionLowSelectivity: Projection rows require a separate selector contract and are emitted only for projection-cycle fixtures.
- projectionHighSelectivity: Projection rows require a separate selector contract and are emitted only for projection-cycle fixtures.
- processRss: Browsers do not expose a portable process RSS metric to page JavaScript; this report records page-exposed JS heap counters when available and separate Windows process-tree counters when available.

## Parity

- All rows event-count parity: ok, events=75206126, rows=stringFull, eventObjectFull, rawFrameNameId
- Full-string parity rows: ok, events=75206126, checksum=-925527041, rows=stringFull, eventObjectFull, rawFrameNameId

## Findings

- browser-byte-batch-contract: Rows consume corpus-backed browser Uint8Array batches and do not load a full XML string.
  - stringFull: maxJsHeap=n/a
  - eventObjectFull: maxJsHeap=n/a
  - rawFrameNameId: maxJsHeap=n/a
- browser-memory-scope: Variant memory is browser JS heap only; it is not a process RSS replacement.
  - stringFull: jsHeapLimit=n/a
  - eventObjectFull: jsHeapLimit=n/a
  - rawFrameNameId: jsHeapLimit=n/a
- browser-host-process-memory: Host process-tree memory is recorded separately from variant JS heap when the host supports it.
  - maxWorkingSet=1.04 GiB
  - maxPrivateBytes=998.1 MiB
  - maxProcessCount=12
- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=75206126, checksum=-925527041
  - eventObjectFull: events=75206126, checksum=-925527041
  - rawFrameNameId: events=75206126, checksum=-925527041
- headroom-search: The fastest row in each family is a browser headroom signal, not a runtime-limit conclusion.
  - partial=missing
  - full=rawFrameNameId 48.15 MiB/s
- corpus-cycle-fixture: The browser fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.
  - sourceFile=G:\programming\stax-xml\packages\stax-xml\performance\samples\treebank_e.xml
  - sourceBytes=89565617
  - actualBytes=1074787404

## Firefox BiDi Notes

- Automation: WebDriver BiDi
- Browser: Firefox 143.0
- Engine: SpiderMonkey
- This path does not use Playwright, Selenium, CDP, or a native addon.
- Firefox does not expose Chromium `performance.memory`; per-variant host process-tree probes are Windows host evidence, not portable browser RSS or JS heap proof.
