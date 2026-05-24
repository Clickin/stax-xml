# Browser Candidate Headroom Matrix

Generated: 2026-05-24T02:30:57.797Z

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
| stringFull | full-stax-js | full-string-materialization | stream-events | 54.71 MiB/s | 1.00x | 0.16x | below | no | not-found | 45189256 | 1421012805 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | stream-events | 44.00 MiB/s | 0.80x | 0.13x | below | no | not-found | 45189256 | 1421012805 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | stream-events | 58.74 MiB/s | 1.07x | 0.18x | below | no | not-found | 45189256 | 1421012805 | yes |

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
- Max working set: 944.7 MiB
- Max private bytes: 777.2 MiB
- Max process count: 12

| Sample | Scope | Processes | Working set | Private bytes |
| --- | --- | ---: | ---: | ---: |
| browser-started | windows-process-tree | 12 | 691.8 MiB | 565.8 MiB |
| before-run | windows-process-tree | 12 | 944.7 MiB | 777.2 MiB |
| after-run | windows-process-tree | 12 | 935.5 MiB | 767.2 MiB |

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
  - maxWorkingSet=944.7 MiB
  - maxPrivateBytes=777.2 MiB
  - maxProcessCount=12
- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=45189256, checksum=1421012805
  - eventObjectFull: events=45189256, checksum=1421012805
  - rawFrameNameId: events=45189256, checksum=1421012805
- headroom-search: The fastest row in each family is a browser headroom signal, not a runtime-limit conclusion.
  - partial=missing
  - full=rawFrameNameId 58.74 MiB/s

## Firefox BiDi Notes

- Automation: WebDriver BiDi
- Browser: Firefox 143.0
- Engine: SpiderMonkey
- This path does not use Playwright, Selenium, CDP, or a native addon.
- Firefox does not expose Chromium `performance.memory`; host process-tree memory is report-level evidence, not row-level bounded-memory proof.
