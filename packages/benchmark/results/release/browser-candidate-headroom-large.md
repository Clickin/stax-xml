# Browser Candidate Headroom Matrix

Generated: 2026-05-23T17:08:45.261Z

This experiment is a browser-runtime counterexample search over generated browser `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
Variant memory uses browser JS heap only. Host process-tree memory is reported separately when available and must not be mixed with Node/Bun RSS rows as the same memory proof.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Chrome 148.0.0.0, V8, Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36
- Fixture source: generated
- Generated size: 1.00 GiB (1073742038 bytes)
- Fixture shape: diverse-cycle
- Row cycle size: 4096
- Row bytes: min=222, max=284, avg=261.4
- Batch size: 16
- Runs: warmups=0, runs=1
- Bounded JS heap reporting gate: 512.0 MiB

## Woodstox Target

- Baseline tool: woodstox
- Woodstox throughput: 333.43 MiB/s
- Goal ratio: 0.90x
- Target throughput: 300.09 MiB/s

## Results

| Variant | Family | Contract scope | Throughput | Relative to stringFull | Woodstox ratio | 0.9x target | Bounded JS heap | Counterexample | Events | Checksum | Full parity |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | ---: | ---: | --- |
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | 96.64 MiB/s | 2.80x | 0.29x | not-applicable | yes | not-found | 45189256 | 773645869 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | 76.78 MiB/s | 2.23x | 0.23x | not-applicable | yes | not-found | 45189256 | -779910903 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | 51.53 MiB/s | 1.50x | 0.15x | not-applicable | yes | not-found | 45189256 | -1618348602 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | 80.64 MiB/s | 2.34x | 0.24x | not-applicable | yes | not-found | 45189256 | 494150397 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | 74.83 MiB/s | 2.17x | 0.22x | not-applicable | yes | not-found | 45189256 | 946031520 | no |
| stringFull | full-stax-js | full-string-materialization | 34.46 MiB/s | 1.00x | 0.10x | below | yes | not-found | 45189256 | 1421012805 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | 33.10 MiB/s | 0.96x | 0.10x | below | yes | not-found | 45189256 | 1421012805 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | 40.05 MiB/s | 1.16x | 0.12x | below | yes | not-found | 45189256 | 1421012805 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | 42.35 MiB/s | 1.23x | 0.13x | below | yes | not-found | 45189256 | 1421012805 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | 43.45 MiB/s | 1.26x | 0.13x | below | yes | not-found | 45189256 | 1421012805 | yes |

## Memory

Memory uses Chromium `performance.memory` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg used heap delta | Max used heap | Max total heap | JS heap limit |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +7.6 MiB | 16.1 MiB | 21.6 MiB | 4.00 GiB |
| nameStringOnly | +4.2 MiB | 12.7 MiB | 20.1 MiB | 4.00 GiB |
| textStringOnly | +2.7 MiB | 11.3 MiB | 26.5 MiB | 4.00 GiB |
| attrNameStringOnly | +10.4 MiB | 18.0 MiB | 30.2 MiB | 4.00 GiB |
| attrValueStringOnly | +1.1 MiB | 8.7 MiB | 25.8 MiB | 4.00 GiB |
| stringFull | +7.1 MiB | 14.7 MiB | 27.0 MiB | 4.00 GiB |
| eventObjectFull | +31.2 MiB | 38.8 MiB | 79.7 MiB | 4.00 GiB |
| cursorAccessor | +35.3 MiB | 42.8 MiB | 84.4 MiB | 4.00 GiB |
| rawFrameDirect | +24.1 MiB | 31.7 MiB | 79.2 MiB | 4.00 GiB |
| rawFrameNameId | +10.2 MiB | 17.9 MiB | 76.5 MiB | 4.00 GiB |

## Host Process Memory

Windows Win32_Process process tree rooted at the browser pid. Working set and private bytes are host OS counters, not portable browser RSS, and are not variant-level JS heap measurements.

- Scope: windows-process-tree
- Max working set: 522.1 MiB
- Max private bytes: 283.9 MiB
- Max process count: 10

| Sample | Scope | Processes | Working set | Private bytes |
| --- | --- | ---: | ---: | ---: |
| browser-started | windows-process-tree | 9 | 362.5 MiB | 151.2 MiB |
| before-run | windows-process-tree | 10 | 412.2 MiB | 171.8 MiB |
| after-run | windows-process-tree | 8 | 522.1 MiB | 283.9 MiB |

## Materialization Counters

| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Event objects | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| scanAllNoDecode | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 | 0 | 28,756,798 |
| nameStringOnly | 32,864,912 | 32,864,912 | 0 | 0 | 0 | 0 | 0/0 | 0 | 28,756,798 |
| textStringOnly | 12,324,342 | 0 | 12,324,342 | 0 | 0 | 0 | 0/0 | 0 | 28,756,798 |
| attrNameStringOnly | 28,756,798 | 0 | 0 | 28,756,798 | 0 | 0 | 0/0 | 0 | 28,756,798 |
| attrValueStringOnly | 28,756,798 | 0 | 0 | 0 | 28,756,798 | 0 | 0/0 | 0 | 28,756,798 |
| stringFull | 102,702,850 | 32,864,912 | 12,324,342 | 28,756,798 | 28,756,798 | 0 | 0/0 | 0 | 28,756,798 |
| eventObjectFull | 102,702,850 | 32,864,912 | 12,324,342 | 28,756,798 | 28,756,798 | 0 | 0/0 | 45,189,256 | 28,756,798 |
| cursorAccessor | 102,702,850 | 32,864,912 | 12,324,342 | 28,756,798 | 28,756,798 | 0 | 0/0 | 0 | 28,756,798 |
| rawFrameDirect | 102,702,850 | 32,864,912 | 12,324,342 | 28,756,798 | 28,756,798 | 102,702,850 | 0/0 | 0 | 28,756,798 |
| rawFrameNameId | 102,702,850 | 32,864,912 | 12,324,342 | 28,756,798 | 28,756,798 | 41,087,307 | 61,615,543/6,167 | 0 | 28,756,798 |

## Omitted Rows

- projectionLowSelectivity: Projection rows require a separate selector contract and remain future work.
- projectionHighSelectivity: Projection rows require a separate selector contract and remain future work.
- processRss: Browsers do not expose a portable process RSS metric to page JavaScript; this report records variant JS heap via Chromium performance.memory and separate Windows process-tree counters when available.

## Parity

- Event count parity: ok, events=45189256
- Full-string parity rows: ok, events=45189256, checksum=1421012805

## Findings

- browser-byte-batch-contract: Rows consume generated browser Uint8Array batches and do not load a full XML string.
  - stringFull: maxJsHeap=14.7 MiB
  - eventObjectFull: maxJsHeap=38.8 MiB
  - cursorAccessor: maxJsHeap=42.8 MiB
  - rawFrameDirect: maxJsHeap=31.7 MiB
  - rawFrameNameId: maxJsHeap=17.9 MiB
- browser-memory-scope: Variant memory is browser JS heap only; it is not a process RSS replacement.
  - stringFull: jsHeapLimit=4.00 GiB
  - eventObjectFull: jsHeapLimit=4.00 GiB
  - cursorAccessor: jsHeapLimit=4.00 GiB
  - rawFrameDirect: jsHeapLimit=4.00 GiB
  - rawFrameNameId: jsHeapLimit=4.00 GiB
- browser-host-process-memory: Host process-tree memory is recorded separately from variant JS heap when the host supports it.
  - maxWorkingSet=522.1 MiB
  - maxPrivateBytes=283.9 MiB
  - maxProcessCount=10
- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
  - scanAllNoDecode: event-types-and-attribute-counts-only, strings=0
  - nameStringOnly: event-types-attribute-counts-and-element-names, strings=32864912
  - textStringOnly: event-types-attribute-counts-and-text-cdata, strings=12324342
  - attrNameStringOnly: event-types-attribute-counts-and-attribute-names, strings=28756798
  - attrValueStringOnly: event-types-attribute-counts-and-attribute-values, strings=28756798
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=45189256, checksum=1421012805
  - eventObjectFull: events=45189256, checksum=1421012805
  - cursorAccessor: events=45189256, checksum=1421012805
  - rawFrameDirect: events=45189256, checksum=1421012805
  - rawFrameNameId: events=45189256, checksum=1421012805
- headroom-search: The fastest row in each family is a browser headroom signal, not a runtime-limit conclusion.
  - partial=scanAllNoDecode 96.64 MiB/s
  - full=rawFrameNameId 43.45 MiB/s
