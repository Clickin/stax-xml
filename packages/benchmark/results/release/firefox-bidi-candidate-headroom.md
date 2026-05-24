# Browser Candidate Headroom Matrix

Generated: 2026-05-24T03:56:32.221Z

This experiment is a browser-runtime counterexample search over generated browser `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
Variant memory uses browser JS heap only. Host process-tree memory is reported separately when available and must not be mixed with Node/Bun RSS rows as the same memory proof.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Firefox 143.0, SpiderMonkey, Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0
- Fixture source: generated
- Generated size: 1.00 GiB (1073742038 bytes)
- Fixture shape: diverse-cycle
- Row cycle size: 4096
- Row bytes: min=222, max=284, avg=261.4
- Batch size: 16
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
| stringFull | full-stax-js | full-string-materialization | stream-events | 33.02 MiB/s | 1.00x | 0.10x | below | no | not-found | 45189256 | 1421012805 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | stream-events | 23.31 MiB/s | 0.71x | 0.07x | below | no | not-found | 45189256 | 1421012805 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | stream-events | 35.02 MiB/s | 1.06x | 0.11x | below | no | not-found | 45189256 | 1421012805 | yes |

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
- Max working set: 908.2 MiB
- Max private bytes: 740.7 MiB
- Max process count: 12

| Sample | Scope | Processes | Working set | Private bytes |
| --- | --- | ---: | ---: | ---: |
| browser-started | windows-process-tree | 12 | 674.7 MiB | 552.0 MiB |
| before-run | windows-process-tree | 12 | 737.9 MiB | 612.7 MiB |
| after-run | windows-process-tree | 12 | 908.2 MiB | 740.7 MiB |

## Per-Variant Host Process Memory Probes

These counters bracket separate fresh-browser per-case probe runs at the host process-tree level. They are useful row-level host evidence, but they are not portable browser RSS, not page JS heap measurements, and not the timing samples used for the throughput table.

| Variant | Scope | Max working set | Max private bytes | Max process count | Samples | Probe throughput |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| stringFull | windows-process-tree | 783.2 MiB | 623.3 MiB | 12 | 2 | 33.43 MiB/s |
| eventObjectFull | windows-process-tree | 956.2 MiB | 794.4 MiB | 12 | 2 | 23.85 MiB/s |
| rawFrameNameId | windows-process-tree | 775.6 MiB | 617.4 MiB | 12 | 2 | 36.91 MiB/s |

## Materialization Counters

| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Event objects | Projected records | Projection fields | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| stringFull | 102,702,850 | 32,864,912 | 12,324,342 | 28,756,798 | 28,756,798 | 0 | 0/0 | 0 | 0 | 0 | 28,756,798 |
| eventObjectFull | 102,702,850 | 32,864,912 | 12,324,342 | 28,756,798 | 28,756,798 | 0 | 0/0 | 45,189,256 | 0 | 0 | 28,756,798 |
| rawFrameNameId | 102,702,850 | 32,864,912 | 12,324,342 | 28,756,798 | 28,756,798 | 41,087,307 | 61,615,543/6,167 | 0 | 0 | 0 | 28,756,798 |

## Omitted Rows

- projectionLowSelectivity: Projection rows require a separate selector contract and are emitted only for projection-cycle fixtures.
- projectionHighSelectivity: Projection rows require a separate selector contract and are emitted only for projection-cycle fixtures.
- processRss: Browsers do not expose a portable process RSS metric to page JavaScript; this report records page-exposed JS heap counters when available and separate Windows process-tree counters when available.

## Parity

- All rows event-count parity: ok, events=45189256, rows=stringFull, eventObjectFull, rawFrameNameId
- Full-string parity rows: ok, events=45189256, checksum=1421012805, rows=stringFull, eventObjectFull, rawFrameNameId

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
  - maxWorkingSet=908.2 MiB
  - maxPrivateBytes=740.7 MiB
  - maxProcessCount=12
- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=45189256, checksum=1421012805
  - eventObjectFull: events=45189256, checksum=1421012805
  - rawFrameNameId: events=45189256, checksum=1421012805
- headroom-search: The fastest row in each family is a browser headroom signal, not a runtime-limit conclusion.
  - partial=missing
  - full=rawFrameNameId 35.02 MiB/s

## Firefox BiDi Notes

- Automation: WebDriver BiDi
- Browser: Firefox 143.0
- Engine: SpiderMonkey
- This path does not use Playwright, Selenium, CDP, or a native addon.
- Firefox does not expose Chromium `performance.memory`; per-variant host process-tree probes are Windows host evidence, not portable browser RSS or JS heap proof.
