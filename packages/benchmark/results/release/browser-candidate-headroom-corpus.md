# Browser Candidate Headroom Matrix

Generated: 2026-05-23T15:38:16.838Z

This experiment is a browser-runtime counterexample search over corpus-backed browser `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
Memory is browser JS heap only; it is not process RSS and must not be mixed with Node/Bun RSS rows as the same memory proof.

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
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | 172.61 MiB/s | 3.37x | 0.52x | not-applicable | yes | not-found | 75206126 | -1094942745 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | 146.15 MiB/s | 2.86x | 0.44x | not-applicable | yes | not-found | 75206126 | -1903399745 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | 54.12 MiB/s | 1.06x | 0.16x | not-applicable | yes | not-found | 75206126 | -198281981 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | 168.17 MiB/s | 3.29x | 0.50x | not-applicable | yes | not-found | 75206126 | 1179526435 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | 165.05 MiB/s | 3.23x | 0.50x | not-applicable | yes | not-found | 75206126 | -360449985 | no |
| stringFull | full-stax-js | full-string-materialization | 51.17 MiB/s | 1.00x | 0.15x | below | yes | not-found | 75206126 | -925527041 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | 49.05 MiB/s | 0.96x | 0.15x | below | yes | not-found | 75206126 | -925527041 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | 51.64 MiB/s | 1.01x | 0.15x | below | yes | not-found | 75206126 | -925527041 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | 49.47 MiB/s | 0.97x | 0.15x | below | yes | not-found | 75206126 | -925527041 | yes |

## Memory

Memory uses Chromium `performance.memory` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg used heap delta | Max used heap | Max total heap | JS heap limit |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +264.1 MiB | 356.5 MiB | 366.0 MiB | 4.00 GiB |
| nameStringOnly | +264.7 MiB | 356.1 MiB | 365.5 MiB | 4.00 GiB |
| textStringOnly | +258.5 MiB | 349.9 MiB | 354.6 MiB | 4.00 GiB |
| attrNameStringOnly | +282.0 MiB | 373.5 MiB | 381.2 MiB | 4.00 GiB |
| attrValueStringOnly | +264.3 MiB | 355.7 MiB | 365.2 MiB | 4.00 GiB |
| stringFull | +258.2 MiB | 349.7 MiB | 356.6 MiB | 4.00 GiB |
| cursorAccessor | +247.6 MiB | 339.1 MiB | 349.9 MiB | 4.00 GiB |
| rawFrameDirect | +241.6 MiB | 333.1 MiB | 341.6 MiB | 4.00 GiB |
| rawFrameNameId | +243.4 MiB | 334.9 MiB | 347.4 MiB | 4.00 GiB |

## Materialization Counters

| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Event objects | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| scanAllNoDecode | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 | 0 | 12 |
| nameStringOnly | 58,503,984 | 58,503,984 | 0 | 0 | 0 | 0 | 0/0 | 0 | 12 |
| textStringOnly | 16,702,140 | 0 | 16,702,140 | 0 | 0 | 0 | 0/0 | 0 | 12 |
| attrNameStringOnly | 12 | 0 | 0 | 12 | 0 | 0 | 0/0 | 0 | 12 |
| attrValueStringOnly | 12 | 0 | 0 | 0 | 12 | 0 | 0/0 | 0 | 12 |
| stringFull | 75,206,148 | 58,503,984 | 16,702,140 | 12 | 12 | 0 | 0/0 | 0 | 12 |
| cursorAccessor | 75,206,148 | 58,503,984 | 16,702,140 | 12 | 12 | 0 | 0/0 | 0 | 12 |
| rawFrameDirect | 75,206,148 | 58,503,984 | 16,702,140 | 12 | 12 | 75,206,148 | 0/0 | 0 | 12 |
| rawFrameNameId | 75,206,148 | 58,503,984 | 16,702,140 | 12 | 12 | 16,702,403 | 58,503,745/251 | 0 | 12 |

## Omitted Rows

- eventObjectFull: EventReaderSync complete-string input is not part of this browser byte-batch matrix.
- projectionLowSelectivity: Projection rows require a separate selector contract and remain future work.
- projectionHighSelectivity: Projection rows require a separate selector contract and remain future work.
- processRss: Browsers do not expose a portable process RSS metric to page JavaScript; this report records JS heap via Chromium performance.memory.

## Parity

- Event count parity: ok, events=75206126
- Full-string parity rows: ok, events=75206126, checksum=-925527041

## Findings

- browser-byte-batch-contract: Rows consume corpus-backed browser Uint8Array batches and do not load a full XML string.
  - stringFull: maxJsHeap=349.7 MiB
  - cursorAccessor: maxJsHeap=339.1 MiB
  - rawFrameDirect: maxJsHeap=333.1 MiB
  - rawFrameNameId: maxJsHeap=334.9 MiB
- browser-memory-scope: Memory is browser JS heap only; it is not a process RSS replacement.
  - stringFull: jsHeapLimit=4.00 GiB
  - cursorAccessor: jsHeapLimit=4.00 GiB
  - rawFrameDirect: jsHeapLimit=4.00 GiB
  - rawFrameNameId: jsHeapLimit=4.00 GiB
- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
  - scanAllNoDecode: event-types-and-attribute-counts-only, strings=0
  - nameStringOnly: event-types-attribute-counts-and-element-names, strings=58503984
  - textStringOnly: event-types-attribute-counts-and-text-cdata, strings=16702140
  - attrNameStringOnly: event-types-attribute-counts-and-attribute-names, strings=12
  - attrValueStringOnly: event-types-attribute-counts-and-attribute-values, strings=12
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=75206126, checksum=-925527041
  - cursorAccessor: events=75206126, checksum=-925527041
  - rawFrameDirect: events=75206126, checksum=-925527041
  - rawFrameNameId: events=75206126, checksum=-925527041
- headroom-search: The fastest row in each family is a browser headroom signal, not a runtime-limit conclusion.
  - partial=scanAllNoDecode 172.61 MiB/s
  - full=rawFrameDirect 51.64 MiB/s
- corpus-cycle-fixture: The browser fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.
  - sourceFile=G:\programming\stax-xml\packages\stax-xml\performance\samples\treebank_e.xml
  - sourceBytes=89565617
  - actualBytes=1074787404
