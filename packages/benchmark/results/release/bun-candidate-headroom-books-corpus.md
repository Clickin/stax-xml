# Large Candidate Headroom Matrix

Generated: 2026-05-24T06:59:34.873Z

This experiment is a 1 GiB+ bounded-memory counterexample search over corpus-backed `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
The neutral path uses `Uint8Array` plus `TextDecoder`; it does not use native addons, Node `Buffer.toString()`, or lazy getters.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Bun 1.3.13, JavaScriptCore WebKit 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
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
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | stream-events | 334.63 MiB/s | 2.15x | 1.00x | not-applicable | yes | not-found | 57096514 | -239086029 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | stream-events | 282.68 MiB/s | 1.82x | 0.85x | not-applicable | yes | not-found | 57096514 | -929151437 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | stream-events | 181.59 MiB/s | 1.17x | 0.54x | not-applicable | yes | not-found | 57096514 | 1377684179 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | stream-events | 288.27 MiB/s | 1.86x | 0.86x | not-applicable | yes | not-found | 57096514 | 878766131 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | stream-events | 276.86 MiB/s | 1.78x | 0.83x | not-applicable | yes | not-found | 57096514 | -923412077 | no |
| stringFull | full-stax-js | full-string-materialization | stream-events | 155.37 MiB/s | 1.00x | 0.47x | below | yes | not-found | 57096514 | -540013997 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | stream-events | 133.43 MiB/s | 0.86x | 0.40x | below | yes | not-found | 57096514 | -540013997 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | stream-events | 159.70 MiB/s | 1.03x | 0.48x | below | yes | not-found | 57096514 | -540013997 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | stream-events | 136.14 MiB/s | 0.88x | 0.41x | below | yes | not-found | 57096514 | -540013997 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | stream-events | 174.51 MiB/s | 1.12x | 0.52x | below | yes | not-found | 57096514 | -540013997 | yes |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +31.1 MiB | +50.8 MiB | 31.3 MiB | 169.3 MiB |
| nameStringOnly | -14.9 MiB | -1.5 MiB | 31.3 MiB | 169.0 MiB |
| textStringOnly | -3.4 MiB | +17.1 MiB | 16.4 MiB | 184.6 MiB |
| attrNameStringOnly | +18.4 MiB | -10.8 MiB | 31.3 MiB | 184.9 MiB |
| attrValueStringOnly | +14.0 MiB | +2.9 MiB | 45.3 MiB | 176.5 MiB |
| stringFull | -10.0 MiB | +8.5 MiB | 45.3 MiB | 185.1 MiB |
| eventObjectFull | +10.0 MiB | +832.0 KiB | 45.4 MiB | 186.0 MiB |
| cursorAccessor | -10.1 MiB | +4.4 MiB | 45.4 MiB | 190.6 MiB |
| rawFrameDirect | -15.4 MiB | -1.8 MiB | 35.3 MiB | 190.7 MiB |
| rawFrameNameId | +26.4 MiB | -12.2 MiB | 46.3 MiB | 189.1 MiB |

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
  - stringFull: maxRSS=185.1 MiB
  - eventObjectFull: maxRSS=186.0 MiB
  - cursorAccessor: maxRSS=190.6 MiB
  - rawFrameDirect: maxRSS=190.7 MiB
  - rawFrameNameId: maxRSS=189.1 MiB
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
  - partial=scanAllNoDecode 334.63 MiB/s
  - full=rawFrameNameId 174.51 MiB/s
- corpus-cycle-fixture: The fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.
  - sourceFile=G:\programming\stax-xml\packages\benchmark\assets\books.xml
  - sourceBytes=4551
  - actualBytes=1073744736
