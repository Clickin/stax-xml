# Browser Candidate Headroom Matrix

Generated: 2026-05-24T07:01:58.405Z

This experiment is a browser-runtime counterexample search over corpus-backed browser `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
Variant memory uses browser JS heap only. Host process-tree memory is reported separately when available and must not be mixed with Node/Bun RSS rows as the same memory proof.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Firefox 143.0, SpiderMonkey, Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0
- Fixture source: corpus-file
- Source file: G:\programming\stax-xml\packages\benchmark\assets\books.xml
- Generated size: 1.00 GiB (1073744736 bytes)
- Fixture shape: corpus-cycle
- Row cycle size: 1
- Row bytes: min=4551, max=4551, avg=4551.0
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
| stringFull | full-stax-js | full-string-materialization | stream-events | 72.66 MiB/s | 1.00x | 0.22x | below | no | not-found | 57096514 | -540013997 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | stream-events | 62.46 MiB/s | 0.86x | 0.19x | below | no | not-found | 57096514 | -540013997 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | stream-events | 76.70 MiB/s | 1.06x | 0.23x | below | no | not-found | 57096514 | -540013997 | yes |

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
- Max working set: 862.9 MiB
- Max private bytes: 701.9 MiB
- Max process count: 12

| Sample | Scope | Processes | Working set | Private bytes |
| --- | --- | ---: | ---: | ---: |
| browser-started | windows-process-tree | 12 | 727.0 MiB | 602.4 MiB |
| before-run | windows-process-tree | 12 | 718.2 MiB | 592.2 MiB |
| after-run | windows-process-tree | 12 | 862.9 MiB | 701.9 MiB |

## Per-Variant Host Process Memory Probes

These counters bracket separate fresh-browser per-case probe runs at the host process-tree level. They are useful row-level host evidence, but they are not portable browser RSS, not page JS heap measurements, and not the timing samples used for the throughput table.

| Variant | Scope | Max working set | Max private bytes | Max process count | Samples | Probe throughput |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| stringFull | windows-process-tree | 807.2 MiB | 647.8 MiB | 12 | 2 | 73.18 MiB/s |
| eventObjectFull | windows-process-tree | 879.8 MiB | 720.2 MiB | 12 | 2 | 63.03 MiB/s |
| rawFrameNameId | windows-process-tree | 761.4 MiB | 605.9 MiB | 12 | 2 | 83.43 MiB/s |

## Materialization Counters

| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Event objects | Projected records | Projection fields | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| stringFull | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| eventObjectFull | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 0 | 0/0 | 57,096,514 | 0 | 0 | 2,831,232 |
| rawFrameNameId | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 19,818,633 | 42,940,343/9 | 0 | 0 | 0 | 2,831,232 |

## Omitted Rows

- projectionLowSelectivity: Projection rows require a separate selector contract and are emitted only for projection-cycle fixtures.
- projectionHighSelectivity: Projection rows require a separate selector contract and are emitted only for projection-cycle fixtures.
- processRss: Browsers do not expose a portable process RSS metric to page JavaScript; this report records page-exposed JS heap counters when available and separate Windows process-tree counters when available.

## Parity

- All rows event-count parity: ok, events=57096514, rows=stringFull, eventObjectFull, rawFrameNameId
- Full-string parity rows: ok, events=57096514, checksum=-540013997, rows=stringFull, eventObjectFull, rawFrameNameId

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
  - maxWorkingSet=862.9 MiB
  - maxPrivateBytes=701.9 MiB
  - maxProcessCount=12
- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=57096514, checksum=-540013997
  - eventObjectFull: events=57096514, checksum=-540013997
  - rawFrameNameId: events=57096514, checksum=-540013997
- headroom-search: The fastest row in each family is a browser headroom signal, not a runtime-limit conclusion.
  - partial=missing
  - full=rawFrameNameId 76.70 MiB/s
- corpus-cycle-fixture: The browser fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.
  - sourceFile=G:\programming\stax-xml\packages\benchmark\assets\books.xml
  - sourceBytes=4551
  - actualBytes=1073744736

## Firefox BiDi Notes

- Automation: WebDriver BiDi
- Browser: Firefox 143.0
- Engine: SpiderMonkey
- This path does not use Playwright, Selenium, CDP, or a native addon.
- Firefox does not expose Chromium `performance.memory`; per-variant host process-tree probes are Windows host evidence, not portable browser RSS or JS heap proof.
