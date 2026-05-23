# Browser Candidate Headroom Matrix

Generated: 2026-05-23T15:45:41.143Z

This experiment is a browser-runtime counterexample search over generated browser `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
Memory is browser JS heap only; it is not process RSS and must not be mixed with Node/Bun RSS rows as the same memory proof.

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
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | 153.75 MiB/s | 1.93x | 0.46x | not-applicable | yes | not-found | 45189256 | 773645869 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | 135.55 MiB/s | 1.70x | 0.41x | not-applicable | yes | not-found | 45189256 | -779910903 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | 100.52 MiB/s | 1.26x | 0.30x | not-applicable | yes | not-found | 45189256 | -1618348602 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | 146.59 MiB/s | 1.84x | 0.44x | not-applicable | yes | not-found | 45189256 | 494150397 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | 139.06 MiB/s | 1.75x | 0.42x | not-applicable | yes | not-found | 45189256 | 946031520 | no |
| stringFull | full-stax-js | full-string-materialization | 79.58 MiB/s | 1.00x | 0.24x | below | yes | not-found | 45189256 | 1421012805 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | 78.82 MiB/s | 0.99x | 0.24x | below | yes | not-found | 45189256 | 1421012805 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | 76.20 MiB/s | 0.96x | 0.23x | below | yes | not-found | 45189256 | 1421012805 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | 82.08 MiB/s | 1.03x | 0.25x | below | yes | not-found | 45189256 | 1421012805 | yes |

## Memory

Memory uses Chromium `performance.memory` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg used heap delta | Max used heap | Max total heap | JS heap limit |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +3.9 MiB | 12.4 MiB | 20.0 MiB | 4.00 GiB |
| nameStringOnly | +6.0 MiB | 14.6 MiB | 21.0 MiB | 4.00 GiB |
| textStringOnly | +1.7 MiB | 10.3 MiB | 26.8 MiB | 4.00 GiB |
| attrNameStringOnly | +13.6 MiB | 21.1 MiB | 32.3 MiB | 4.00 GiB |
| attrValueStringOnly | +12.9 MiB | 20.5 MiB | 30.5 MiB | 4.00 GiB |
| stringFull | +11.1 MiB | 18.7 MiB | 29.1 MiB | 4.00 GiB |
| cursorAccessor | +6.1 MiB | 13.7 MiB | 27.7 MiB | 4.00 GiB |
| rawFrameDirect | +3.2 MiB | 10.8 MiB | 26.7 MiB | 4.00 GiB |
| rawFrameNameId | +6.7 MiB | 14.4 MiB | 27.9 MiB | 4.00 GiB |

## Materialization Counters

| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Event objects | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| scanAllNoDecode | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 | 0 | 28,756,798 |
| nameStringOnly | 32,864,912 | 32,864,912 | 0 | 0 | 0 | 0 | 0/0 | 0 | 28,756,798 |
| textStringOnly | 12,324,342 | 0 | 12,324,342 | 0 | 0 | 0 | 0/0 | 0 | 28,756,798 |
| attrNameStringOnly | 28,756,798 | 0 | 0 | 28,756,798 | 0 | 0 | 0/0 | 0 | 28,756,798 |
| attrValueStringOnly | 28,756,798 | 0 | 0 | 0 | 28,756,798 | 0 | 0/0 | 0 | 28,756,798 |
| stringFull | 102,702,850 | 32,864,912 | 12,324,342 | 28,756,798 | 28,756,798 | 0 | 0/0 | 0 | 28,756,798 |
| cursorAccessor | 102,702,850 | 32,864,912 | 12,324,342 | 28,756,798 | 28,756,798 | 0 | 0/0 | 0 | 28,756,798 |
| rawFrameDirect | 102,702,850 | 32,864,912 | 12,324,342 | 28,756,798 | 28,756,798 | 102,702,850 | 0/0 | 0 | 28,756,798 |
| rawFrameNameId | 102,702,850 | 32,864,912 | 12,324,342 | 28,756,798 | 28,756,798 | 41,087,307 | 61,615,543/6,167 | 0 | 28,756,798 |

## Omitted Rows

- eventObjectFull: EventReaderSync complete-string input is not part of this browser byte-batch matrix.
- projectionLowSelectivity: Projection rows require a separate selector contract and remain future work.
- projectionHighSelectivity: Projection rows require a separate selector contract and remain future work.
- processRss: Browsers do not expose a portable process RSS metric to page JavaScript; this report records JS heap via Chromium performance.memory.

## Parity

- Event count parity: ok, events=45189256
- Full-string parity rows: ok, events=45189256, checksum=1421012805

## Findings

- browser-byte-batch-contract: Rows consume generated browser Uint8Array batches and do not load a full XML string.
  - stringFull: maxJsHeap=18.7 MiB
  - cursorAccessor: maxJsHeap=13.7 MiB
  - rawFrameDirect: maxJsHeap=10.8 MiB
  - rawFrameNameId: maxJsHeap=14.4 MiB
- browser-memory-scope: Memory is browser JS heap only; it is not a process RSS replacement.
  - stringFull: jsHeapLimit=4.00 GiB
  - cursorAccessor: jsHeapLimit=4.00 GiB
  - rawFrameDirect: jsHeapLimit=4.00 GiB
  - rawFrameNameId: jsHeapLimit=4.00 GiB
- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
  - scanAllNoDecode: event-types-and-attribute-counts-only, strings=0
  - nameStringOnly: event-types-attribute-counts-and-element-names, strings=32864912
  - textStringOnly: event-types-attribute-counts-and-text-cdata, strings=12324342
  - attrNameStringOnly: event-types-attribute-counts-and-attribute-names, strings=28756798
  - attrValueStringOnly: event-types-attribute-counts-and-attribute-values, strings=28756798
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=45189256, checksum=1421012805
  - cursorAccessor: events=45189256, checksum=1421012805
  - rawFrameDirect: events=45189256, checksum=1421012805
  - rawFrameNameId: events=45189256, checksum=1421012805
- headroom-search: The fastest row in each family is a browser headroom signal, not a runtime-limit conclusion.
  - partial=scanAllNoDecode 153.75 MiB/s
  - full=rawFrameNameId 82.08 MiB/s
