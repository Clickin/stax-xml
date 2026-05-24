# Large Candidate Headroom Matrix

Generated: 2026-05-24T06:59:44.346Z

This experiment is a 1 GiB+ bounded-memory counterexample search over corpus-backed `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
The neutral path uses `Uint8Array` plus `TextDecoder`; it does not use native addons, Node `Buffer.toString()`, or lazy getters.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Node v24.15.0, V8 13.6.233.17-node.48
- Fixture source: corpus-file
- Source file: G:\programming\stax-xml\packages\benchmark\assets\books.xml
- Generated size: 1.00 GiB (1073744736 bytes)
- Fixture shape: corpus-cycle
- Row cycle size: 1
- Row bytes: min=4551, max=4551, avg=4551.0
- Batch size: 1
- Cases: all
- Runs: warmups=0, runs=1
- Bounded RSS reporting gate: 512.0 MiB

## Woodstox Target

- Baseline tool: woodstox
- Woodstox throughput: 333.43 MiB/s
- Goal ratio: 0.90x
- 0.9x target throughput: 300.09 MiB/s

## Results

| Variant | Family | Contract scope | Count kind | Throughput | Relative to stringFull | Woodstox ratio | 0.9x target | Bounded memory | Counterexample | Events | Checksum | Full parity |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | ---: | ---: | --- |
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | stream-events | 279.08 MiB/s | 2.27x | 0.84x | not-applicable | yes | not-found | 57096514 | -239086029 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | stream-events | 225.09 MiB/s | 1.83x | 0.68x | not-applicable | yes | not-found | 57096514 | -929151437 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | stream-events | 177.67 MiB/s | 1.44x | 0.53x | not-applicable | yes | not-found | 57096514 | 1377684179 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | stream-events | 271.08 MiB/s | 2.20x | 0.81x | not-applicable | yes | not-found | 57096514 | 878766131 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | stream-events | 270.74 MiB/s | 2.20x | 0.81x | not-applicable | yes | not-found | 57096514 | -923412077 | no |
| stringFull | full-stax-js | full-string-materialization | stream-events | 123.06 MiB/s | 1.00x | 0.37x | below | yes | not-found | 57096514 | -540013997 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | stream-events | 131.98 MiB/s | 1.07x | 0.40x | below | yes | not-found | 57096514 | -540013997 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | stream-events | 164.74 MiB/s | 1.34x | 0.49x | below | yes | not-found | 57096514 | -540013997 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | stream-events | 161.05 MiB/s | 1.31x | 0.48x | below | yes | not-found | 57096514 | -540013997 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | stream-events | 172.69 MiB/s | 1.40x | 0.52x | below | yes | not-found | 57096514 | -540013997 | yes |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +911.8 KiB | +2.9 MiB | 5.6 MiB | 62.9 MiB |
| nameStringOnly | +1.7 MiB | +4.5 MiB | 6.7 MiB | 67.6 MiB |
| textStringOnly | +1.4 MiB | -1.6 MiB | 6.4 MiB | 67.7 MiB |
| attrNameStringOnly | +1.2 MiB | +2.7 MiB | 6.3 MiB | 68.9 MiB |
| attrValueStringOnly | +2.1 MiB | -176.0 KiB | 7.1 MiB | 69.0 MiB |
| stringFull | +1.4 MiB | -1.4 MiB | 6.5 MiB | 68.9 MiB |
| eventObjectFull | +3.5 MiB | +65.8 MiB | 8.6 MiB | 133.4 MiB |
| cursorAccessor | +18.7 MiB | +11.1 MiB | 23.8 MiB | 144.5 MiB |
| rawFrameDirect | +14.4 MiB | -5.8 MiB | 19.6 MiB | 144.6 MiB |
| rawFrameNameId | +829.8 KiB | +4.5 MiB | 6.0 MiB | 143.3 MiB |

## Materialization Counters

Counters are collected inside the measured large-input loop to avoid a second 1 GiB+ pass.

| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Event objects | Projected records | Projection fields | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| scanAllNoDecode | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| nameStringOnly | 40,109,120 | 40,109,120 | 0 | 0 | 0 | 0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| textStringOnly | 16,987,392 | 0 | 16,987,392 | 0 | 0 | 0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| attrNameStringOnly | 2,831,232 | 0 | 0 | 2,831,232 | 0 | 0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| attrValueStringOnly | 2,831,232 | 0 | 0 | 0 | 2,831,232 | 0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| stringFull | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| eventObjectFull | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 0 | 0/0 | 57,096,514 | 0 | 0 | 2,831,232 |
| cursorAccessor | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| rawFrameDirect | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 62,758,976 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| rawFrameNameId | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 19,818,633 | 42,940,343/9 | 0 | 0 | 0 | 2,831,232 |

## Omitted Rows

- projectionLowSelectivity: Projection rows require a separate selector contract and remain future work.
- projectionHighSelectivity: Projection rows require a separate selector contract and remain future work.

## Parity

All rows event-count parity: ok, events=57096514.
Full-string parity rows: ok, events=57096514, checksum=-540013997, rows=stringFull, eventObjectFull, cursorAccessor, rawFrameDirect, rawFrameNameId.

## Findings

- bounded-memory-contract: Rows consume corpus-backed Uint8Array batches and do not load a full XML string.
  - stringFull: maxRSS=68.9 MiB
  - eventObjectFull: maxRSS=133.4 MiB
  - cursorAccessor: maxRSS=144.5 MiB
  - rawFrameDirect: maxRSS=144.6 MiB
  - rawFrameNameId: maxRSS=143.3 MiB
- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
  - scanAllNoDecode: event-types-and-attribute-counts-only, strings=0
  - nameStringOnly: event-types-attribute-counts-and-element-names, strings=40109120
  - textStringOnly: event-types-attribute-counts-and-text-cdata, strings=16987392
  - attrNameStringOnly: event-types-attribute-counts-and-attribute-names, strings=2831232
  - attrValueStringOnly: event-types-attribute-counts-and-attribute-values, strings=2831232
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=57096514, checksum=-540013997
  - eventObjectFull: events=57096514, checksum=-540013997
  - cursorAccessor: events=57096514, checksum=-540013997
  - rawFrameDirect: events=57096514, checksum=-540013997
  - rawFrameNameId: events=57096514, checksum=-540013997
- headroom-search: The fastest row in each family is a headroom signal, not a runtime-limit conclusion.
  - partial=scanAllNoDecode 279.08 MiB/s
  - full=rawFrameNameId 172.69 MiB/s
- corpus-cycle-fixture: The fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.
  - sourceFile=G:\programming\stax-xml\packages\benchmark\assets\books.xml
  - sourceBytes=4551
  - actualBytes=1073744736
