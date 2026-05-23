# Browser Candidate Headroom Matrix

Generated: 2026-05-23T17:13:14.508Z

This experiment is a browser-runtime counterexample search over corpus-backed browser `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
Variant memory uses browser JS heap only. Host process-tree memory is reported separately when available and must not be mixed with Node/Bun RSS rows as the same memory proof.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Chrome 148.0.0.0, V8, Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36
- Fixture source: corpus-file
- Source file: G:\programming\stax-xml\packages\stax-xml\performance\samples\treebank_e.xml
- Generated size: 1.00 GiB (1074787404 bytes)
- Fixture shape: corpus-cycle
- Row cycle size: 1
- Row bytes: min=89565617, max=89565617, avg=89565617.0
- Batch size: 1
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
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | 95.80 MiB/s | 3.15x | 0.29x | not-applicable | yes | not-found | 75206126 | -1094942745 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | 81.27 MiB/s | 2.68x | 0.24x | not-applicable | yes | not-found | 75206126 | -1903399745 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | 33.09 MiB/s | 1.09x | 0.10x | not-applicable | yes | not-found | 75206126 | -198281981 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | 89.94 MiB/s | 2.96x | 0.27x | not-applicable | yes | not-found | 75206126 | 1179526435 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | 91.71 MiB/s | 3.02x | 0.28x | not-applicable | yes | not-found | 75206126 | -360449985 | no |
| stringFull | full-stax-js | full-string-materialization | 30.38 MiB/s | 1.00x | 0.09x | below | yes | not-found | 75206126 | -925527041 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | 28.92 MiB/s | 0.95x | 0.09x | below | yes | not-found | 75206126 | -925527041 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | 30.07 MiB/s | 0.99x | 0.09x | below | yes | not-found | 75206126 | -925527041 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | 30.29 MiB/s | 1.00x | 0.09x | below | yes | not-found | 75206126 | -925527041 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | 29.05 MiB/s | 0.96x | 0.09x | below | yes | not-found | 75206126 | -925527041 | yes |

## Memory

Memory uses Chromium `performance.memory` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg used heap delta | Max used heap | Max total heap | JS heap limit |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +264.4 MiB | 356.7 MiB | 366.0 MiB | 4.00 GiB |
| nameStringOnly | +265.9 MiB | 357.3 MiB | 365.5 MiB | 4.00 GiB |
| textStringOnly | +256.9 MiB | 348.3 MiB | 356.8 MiB | 4.00 GiB |
| attrNameStringOnly | +282.6 MiB | 374.0 MiB | 381.2 MiB | 4.00 GiB |
| attrValueStringOnly | +265.9 MiB | 357.4 MiB | 365.2 MiB | 4.00 GiB |
| stringFull | +258.3 MiB | 349.8 MiB | 356.1 MiB | 4.00 GiB |
| eventObjectFull | +266.9 MiB | 358.4 MiB | 380.2 MiB | 4.00 GiB |
| cursorAccessor | +245.5 MiB | 337.0 MiB | 369.0 MiB | 4.00 GiB |
| rawFrameDirect | +260.1 MiB | 351.6 MiB | 370.3 MiB | 4.00 GiB |
| rawFrameNameId | +254.2 MiB | 345.8 MiB | 369.0 MiB | 4.00 GiB |

## Host Process Memory

Windows Win32_Process process tree rooted at the browser pid. Working set and private bytes are host OS counters, not portable browser RSS, and are not variant-level JS heap measurements.

- Scope: windows-process-tree
- Max working set: 865.8 MiB
- Max private bytes: 689.2 MiB
- Max process count: 10

| Sample | Scope | Processes | Working set | Private bytes |
| --- | --- | ---: | ---: | ---: |
| browser-started | windows-process-tree | 9 | 365.6 MiB | 154.0 MiB |
| before-run | windows-process-tree | 10 | 415.9 MiB | 173.6 MiB |
| after-run | windows-process-tree | 8 | 865.8 MiB | 689.2 MiB |

## Materialization Counters

| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Event objects | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| scanAllNoDecode | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 | 0 | 12 |
| nameStringOnly | 58,503,984 | 58,503,984 | 0 | 0 | 0 | 0 | 0/0 | 0 | 12 |
| textStringOnly | 16,702,140 | 0 | 16,702,140 | 0 | 0 | 0 | 0/0 | 0 | 12 |
| attrNameStringOnly | 12 | 0 | 0 | 12 | 0 | 0 | 0/0 | 0 | 12 |
| attrValueStringOnly | 12 | 0 | 0 | 0 | 12 | 0 | 0/0 | 0 | 12 |
| stringFull | 75,206,148 | 58,503,984 | 16,702,140 | 12 | 12 | 0 | 0/0 | 0 | 12 |
| eventObjectFull | 75,206,148 | 58,503,984 | 16,702,140 | 12 | 12 | 0 | 0/0 | 75,206,126 | 12 |
| cursorAccessor | 75,206,148 | 58,503,984 | 16,702,140 | 12 | 12 | 0 | 0/0 | 0 | 12 |
| rawFrameDirect | 75,206,148 | 58,503,984 | 16,702,140 | 12 | 12 | 75,206,148 | 0/0 | 0 | 12 |
| rawFrameNameId | 75,206,148 | 58,503,984 | 16,702,140 | 12 | 12 | 16,702,403 | 58,503,745/251 | 0 | 12 |

## Omitted Rows

- projectionLowSelectivity: Projection rows require a separate selector contract and remain future work.
- projectionHighSelectivity: Projection rows require a separate selector contract and remain future work.
- processRss: Browsers do not expose a portable process RSS metric to page JavaScript; this report records variant JS heap via Chromium performance.memory and separate Windows process-tree counters when available.

## Parity

- Event count parity: ok, events=75206126
- Full-string parity rows: ok, events=75206126, checksum=-925527041

## Findings

- browser-byte-batch-contract: Rows consume corpus-backed browser Uint8Array batches and do not load a full XML string.
  - stringFull: maxJsHeap=349.8 MiB
  - eventObjectFull: maxJsHeap=358.4 MiB
  - cursorAccessor: maxJsHeap=337.0 MiB
  - rawFrameDirect: maxJsHeap=351.6 MiB
  - rawFrameNameId: maxJsHeap=345.8 MiB
- browser-memory-scope: Variant memory is browser JS heap only; it is not a process RSS replacement.
  - stringFull: jsHeapLimit=4.00 GiB
  - eventObjectFull: jsHeapLimit=4.00 GiB
  - cursorAccessor: jsHeapLimit=4.00 GiB
  - rawFrameDirect: jsHeapLimit=4.00 GiB
  - rawFrameNameId: jsHeapLimit=4.00 GiB
- browser-host-process-memory: Host process-tree memory is recorded separately from variant JS heap when the host supports it.
  - maxWorkingSet=865.8 MiB
  - maxPrivateBytes=689.2 MiB
  - maxProcessCount=10
- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
  - scanAllNoDecode: event-types-and-attribute-counts-only, strings=0
  - nameStringOnly: event-types-attribute-counts-and-element-names, strings=58503984
  - textStringOnly: event-types-attribute-counts-and-text-cdata, strings=16702140
  - attrNameStringOnly: event-types-attribute-counts-and-attribute-names, strings=12
  - attrValueStringOnly: event-types-attribute-counts-and-attribute-values, strings=12
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=75206126, checksum=-925527041
  - eventObjectFull: events=75206126, checksum=-925527041
  - cursorAccessor: events=75206126, checksum=-925527041
  - rawFrameDirect: events=75206126, checksum=-925527041
  - rawFrameNameId: events=75206126, checksum=-925527041
- headroom-search: The fastest row in each family is a browser headroom signal, not a runtime-limit conclusion.
  - partial=scanAllNoDecode 95.80 MiB/s
  - full=stringFull 30.38 MiB/s
- corpus-cycle-fixture: The browser fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.
  - sourceFile=G:\programming\stax-xml\packages\stax-xml\performance\samples\treebank_e.xml
  - sourceBytes=89565617
  - actualBytes=1074787404
