# Large Candidate Headroom Matrix

Generated: 2026-05-24T14:03:54.800Z

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
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | stream-events | 261.73 MiB/s | 2.04x | 0.78x | not-applicable | yes | not-found | 57096514 | -239086029 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | stream-events | 239.05 MiB/s | 1.86x | 0.72x | not-applicable | yes | not-found | 57096514 | -929151437 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | stream-events | 187.18 MiB/s | 1.46x | 0.56x | not-applicable | yes | not-found | 57096514 | 1377684179 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | stream-events | 265.23 MiB/s | 2.06x | 0.80x | not-applicable | yes | not-found | 57096514 | 878766131 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | stream-events | 259.73 MiB/s | 2.02x | 0.78x | not-applicable | yes | not-found | 57096514 | -923412077 | no |
| stringFull | full-stax-js | full-string-materialization | stream-events | 128.50 MiB/s | 1.00x | 0.39x | below | yes | not-found | 57096514 | -540013997 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | stream-events | 127.18 MiB/s | 0.99x | 0.38x | below | yes | not-found | 57096514 | -540013997 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | stream-events | 148.83 MiB/s | 1.16x | 0.45x | below | yes | not-found | 57096514 | -540013997 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | stream-events | 142.45 MiB/s | 1.11x | 0.43x | below | yes | not-found | 57096514 | -540013997 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | stream-events | 166.27 MiB/s | 1.29x | 0.50x | below | yes | not-found | 57096514 | -540013997 | yes |
| rawFrameSemanticChecksum | semantic-upper-bound | same-fields-checksum-no-string-materialization | stream-events | 158.38 MiB/s | 1.23x | 0.47x | not-applicable | yes | not-found | 57096514 | -540013997 | no |
| rawFrameStringCache | full-stax-js | full-string-materialization | stream-events | 121.82 MiB/s | 0.95x | 0.37x | below | yes | not-found | 57096514 | -540013997 | yes |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +1.2 MiB | +4.1 MiB | 5.9 MiB | 64.0 MiB |
| nameStringOnly | +354.0 KiB | +4.4 MiB | 5.4 MiB | 68.1 MiB |
| textStringOnly | +1.4 MiB | -1.3 MiB | 6.4 MiB | 68.2 MiB |
| attrNameStringOnly | +1.3 MiB | +2.5 MiB | 6.4 MiB | 69.2 MiB |
| attrValueStringOnly | +2.2 MiB | -16.0 KiB | 7.2 MiB | 69.2 MiB |
| stringFull | +1.4 MiB | -1.2 MiB | 6.5 MiB | 69.3 MiB |
| eventObjectFull | +6.7 MiB | +65.4 MiB | 11.8 MiB | 133.3 MiB |
| cursorAccessor | +18.7 MiB | +8.8 MiB | 23.8 MiB | 142.1 MiB |
| rawFrameDirect | +14.3 MiB | -2.8 MiB | 19.5 MiB | 142.2 MiB |
| rawFrameNameId | +1002.2 KiB | +4.0 MiB | 6.2 MiB | 143.4 MiB |
| rawFrameSemanticChecksum | +31.2 MiB | +1.2 MiB | 36.4 MiB | 144.6 MiB |
| rawFrameStringCache | +9.4 MiB | +20.0 KiB | 14.7 MiB | 144.7 MiB |

## Materialization Counters

Counters are collected inside the measured large-input loop to avoid a second 1 GiB+ pass.

| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Value cache hit/miss | Semantic byte fields/fallbacks | Event objects | Projected records | Projection fields | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| scanAllNoDecode | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 | 0/0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| nameStringOnly | 40,109,120 | 40,109,120 | 0 | 0 | 0 | 0 | 0/0 | 0/0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| textStringOnly | 16,987,392 | 0 | 16,987,392 | 0 | 0 | 0 | 0/0 | 0/0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| attrNameStringOnly | 2,831,232 | 0 | 0 | 2,831,232 | 0 | 0 | 0/0 | 0/0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| attrValueStringOnly | 2,831,232 | 0 | 0 | 0 | 2,831,232 | 0 | 0/0 | 0/0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| stringFull | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 0 | 0/0 | 0/0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| eventObjectFull | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 0 | 0/0 | 0/0 | 0/0 | 57,096,514 | 0 | 0 | 2,831,232 |
| cursorAccessor | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 0 | 0/0 | 0/0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| rawFrameDirect | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 62,758,976 | 0/0 | 0/0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| rawFrameNameId | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 19,818,633 | 42,940,343/9 | 0/0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| rawFrameSemanticChecksum | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 | 0/0 | 62,758,976/0 | 0 | 0 | 0 | 2,831,232 |
| rawFrameStringCache | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 76 | 42,940,343/9 | 19,818,557/67 | 0/0 | 0 | 0 | 0 | 2,831,232 |

## Omitted Rows

- projectionLowSelectivity: Projection rows require a separate selector contract and remain future work.
- projectionHighSelectivity: Projection rows require a separate selector contract and remain future work.

## Parity

All rows event-count parity: ok, events=57096514.
Full-string parity rows: ok, events=57096514, checksum=-540013997, rows=stringFull, eventObjectFull, cursorAccessor, rawFrameDirect, rawFrameNameId, rawFrameStringCache.

## Findings

- bounded-memory-contract: Rows consume corpus-backed Uint8Array batches and do not load a full XML string.
  - stringFull: maxRSS=69.3 MiB
  - eventObjectFull: maxRSS=133.3 MiB
  - cursorAccessor: maxRSS=142.1 MiB
  - rawFrameDirect: maxRSS=142.2 MiB
  - rawFrameNameId: maxRSS=143.4 MiB
  - rawFrameStringCache: maxRSS=144.7 MiB
- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
  - scanAllNoDecode: event-types-and-attribute-counts-only, strings=0
  - nameStringOnly: event-types-attribute-counts-and-element-names, strings=40109120
  - textStringOnly: event-types-attribute-counts-and-text-cdata, strings=16987392
  - attrNameStringOnly: event-types-attribute-counts-and-attribute-names, strings=2831232
  - attrValueStringOnly: event-types-attribute-counts-and-attribute-values, strings=2831232
- semantic-no-string-upper-bound: Semantic checksum rows fold the same fields and checksum without string materialization on ASCII spans, but they are not StAX full-string materialization rows.
  - rawFrameSemanticChecksum: 158.38 MiB/s, checksum=-540013997, semanticByteFields=62758976, fallbacks=0
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=57096514, checksum=-540013997
  - eventObjectFull: events=57096514, checksum=-540013997
  - cursorAccessor: events=57096514, checksum=-540013997
  - rawFrameDirect: events=57096514, checksum=-540013997
  - rawFrameNameId: events=57096514, checksum=-540013997
  - rawFrameStringCache: events=57096514, checksum=-540013997
- headroom-search: The fastest row in each family is a headroom signal, not a runtime-limit conclusion.
  - partial=attrNameStringOnly 265.23 MiB/s
  - full=rawFrameNameId 166.27 MiB/s
- corpus-cycle-fixture: The fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.
  - sourceFile=G:\programming\stax-xml\packages\benchmark\assets\books.xml
  - sourceBytes=4551
  - actualBytes=1073744736
