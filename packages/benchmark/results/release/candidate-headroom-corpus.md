# Large Candidate Headroom Matrix

Generated: 2026-05-23T16:39:26.152Z

This experiment is a 1 GiB+ bounded-memory counterexample search over corpus-backed `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
The neutral path uses `Uint8Array` plus `TextDecoder`; it does not use native addons, Node `Buffer.toString()`, or lazy getters.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Node v24.15.0, V8 13.6.233.17-node.48
- Fixture source: corpus-file
- Source file: G:\programming\stax-xml\packages\stax-xml\performance\samples\treebank_e.xml
- Generated size: 1.00 GiB (1074787404 bytes)
- Fixture shape: corpus-cycle
- Row cycle size: 1
- Row bytes: min=89565617, max=89565617, avg=89565617.0
- Batch size: 1
- Runs: warmups=0, runs=1
- Bounded RSS reporting gate: 512.0 MiB

## Woodstox Target

- Baseline tool: woodstox
- Woodstox throughput: 333.43 MiB/s
- Goal ratio: 0.90x
- 0.9x target throughput: 300.09 MiB/s

## Results

| Variant | Family | Contract scope | Throughput | Relative to stringFull | Woodstox ratio | 0.9x target | Bounded memory | Counterexample | Events | Checksum | Full parity |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | ---: | ---: | --- |
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | 138.76 MiB/s | 2.23x | 0.42x | not-applicable | yes | not-found | 75206126 | -1094942745 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | 92.47 MiB/s | 1.49x | 0.28x | not-applicable | yes | not-found | 75206126 | -1903399745 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | 77.97 MiB/s | 1.25x | 0.23x | not-applicable | yes | not-found | 75206126 | -198281981 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | 108.28 MiB/s | 1.74x | 0.32x | not-applicable | yes | not-found | 75206126 | 1179526435 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | 108.78 MiB/s | 1.75x | 0.33x | not-applicable | yes | not-found | 75206126 | -360449985 | no |
| stringFull | full-stax-js | full-string-materialization | 62.17 MiB/s | 1.00x | 0.19x | below | yes | not-found | 75206126 | -925527041 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | 61.80 MiB/s | 0.99x | 0.19x | below | yes | not-found | 75206126 | -925527041 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | 66.95 MiB/s | 1.08x | 0.20x | below | yes | not-found | 75206126 | -925527041 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | 71.51 MiB/s | 1.15x | 0.21x | below | yes | not-found | 75206126 | -925527041 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | 77.00 MiB/s | 1.24x | 0.23x | below | yes | not-found | 75206126 | -925527041 | yes |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +63.8 KiB | +92.7 MiB | 4.6 MiB | 321.5 MiB |
| nameStringOnly | +165.7 KiB | +32.4 MiB | 4.1 MiB | 353.6 MiB |
| textStringOnly | +1.1 MiB | +1.6 MiB | 5.0 MiB | 354.3 MiB |
| attrNameStringOnly | +131.5 KiB | +632.0 KiB | 4.1 MiB | 354.5 MiB |
| attrValueStringOnly | +134.4 KiB | +364.0 KiB | 4.1 MiB | 354.4 MiB |
| stringFull | +2.1 MiB | -28.2 MiB | 6.1 MiB | 353.6 MiB |
| eventObjectFull | +26.6 MiB | +94.5 MiB | 30.7 MiB | 419.0 MiB |
| cursorAccessor | +3.0 MiB | +1.4 MiB | 7.0 MiB | 419.5 MiB |
| rawFrameDirect | +29.5 MiB | -96.0 KiB | 33.6 MiB | 419.4 MiB |
| rawFrameNameId | +2.9 MiB | +208.0 KiB | 7.0 MiB | 419.3 MiB |

## Materialization Counters

Counters are collected inside the measured large-input loop to avoid a second 1 GiB+ pass.

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

## Parity

All rows event-count parity: ok, events=75206126.
Full-string parity rows: ok, events=75206126, checksum=-925527041, rows=stringFull, eventObjectFull, cursorAccessor, rawFrameDirect, rawFrameNameId.

## Findings

- bounded-memory-contract: Rows consume corpus-backed Uint8Array batches and do not load a full XML string.
  - stringFull: maxRSS=353.6 MiB
  - eventObjectFull: maxRSS=419.0 MiB
  - cursorAccessor: maxRSS=419.5 MiB
  - rawFrameDirect: maxRSS=419.4 MiB
  - rawFrameNameId: maxRSS=419.3 MiB
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
- headroom-search: The fastest row in each family is a headroom signal, not a runtime-limit conclusion.
  - partial=scanAllNoDecode 138.76 MiB/s
  - full=rawFrameNameId 77.00 MiB/s
- corpus-cycle-fixture: The fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.
  - sourceFile=G:\programming\stax-xml\packages\stax-xml\performance\samples\treebank_e.xml
  - sourceBytes=89565617
  - actualBytes=1074787404
