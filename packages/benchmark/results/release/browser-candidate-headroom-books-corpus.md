# Browser Candidate Headroom Matrix

Generated: 2026-05-24T07:01:20.842Z

This experiment is a browser-runtime counterexample search over corpus-backed browser `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
Variant memory uses browser JS heap only. Host process-tree memory is reported separately when available and must not be mixed with Node/Bun RSS rows as the same memory proof.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Chrome 148.0.0.0, V8, Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36
- Fixture source: corpus-file
- Source file: G:\programming\stax-xml\packages\benchmark\assets\books.xml
- Generated size: 1.00 GiB (1073744736 bytes)
- Fixture shape: corpus-cycle
- Row cycle size: 1
- Row bytes: min=4551, max=4551, avg=4551.0
- Batch size: 1
- Runs: warmups=0, runs=1
- Bounded JS heap reporting gate: 512.0 MiB
- Cases: all

## Woodstox Target

- Baseline tool: woodstox
- Woodstox throughput: 333.43 MiB/s
- Goal ratio: 0.90x
- Target throughput: 300.09 MiB/s

## Results

| Variant | Family | Contract scope | Count kind | Throughput | Relative to stringFull | Woodstox ratio | 0.9x target | Bounded JS heap | Counterexample | Events | Checksum | Full parity |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | ---: | ---: | --- |
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | stream-events | 206.76 MiB/s | 1.73x | 0.62x | not-applicable | yes | not-found | 57096514 | -239086029 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | stream-events | 187.62 MiB/s | 1.57x | 0.56x | not-applicable | yes | not-found | 57096514 | -929151437 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | stream-events | 131.94 MiB/s | 1.10x | 0.40x | not-applicable | yes | not-found | 57096514 | 1377684179 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | stream-events | 209.12 MiB/s | 1.75x | 0.63x | not-applicable | yes | not-found | 57096514 | 878766131 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | stream-events | 204.77 MiB/s | 1.71x | 0.61x | not-applicable | yes | not-found | 57096514 | -923412077 | no |
| stringFull | full-stax-js | full-string-materialization | stream-events | 119.64 MiB/s | 1.00x | 0.36x | below | yes | not-found | 57096514 | -540013997 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | stream-events | 105.28 MiB/s | 0.88x | 0.32x | below | yes | not-found | 57096514 | -540013997 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | stream-events | 113.60 MiB/s | 0.95x | 0.34x | below | yes | not-found | 57096514 | -540013997 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | stream-events | 116.56 MiB/s | 0.97x | 0.35x | below | yes | not-found | 57096514 | -540013997 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | stream-events | 122.08 MiB/s | 1.02x | 0.37x | below | yes | not-found | 57096514 | -540013997 | yes |

## Memory

Memory uses page-exposed browser JS heap counters before and after each measured run when the engine provides them; max values are the maximum observed run endpoints.

| Variant | Avg used heap delta | Max used heap | Max total heap | JS heap limit |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +8.8 MiB | 15.8 MiB | 21.6 MiB | 4.00 GiB |
| nameStringOnly | +4.4 MiB | 11.5 MiB | 19.3 MiB | 4.00 GiB |
| textStringOnly | +6.0 MiB | 13.1 MiB | 18.7 MiB | 4.00 GiB |
| attrNameStringOnly | +3.4 MiB | 9.5 MiB | 17.5 MiB | 4.00 GiB |
| attrValueStringOnly | +3.3 MiB | 9.4 MiB | 17.4 MiB | 4.00 GiB |
| stringFull | +5.0 MiB | 11.1 MiB | 17.5 MiB | 4.00 GiB |
| eventObjectFull | +15.1 MiB | 21.2 MiB | 43.1 MiB | 4.00 GiB |
| cursorAccessor | +5.6 MiB | 11.8 MiB | 42.0 MiB | 4.00 GiB |
| rawFrameDirect | +20.6 MiB | 26.8 MiB | 46.0 MiB | 4.00 GiB |
| rawFrameNameId | +3.4 MiB | 9.6 MiB | 41.2 MiB | 4.00 GiB |

## Host Process Memory

Windows Win32_Process process tree rooted at the browser pid. Working set and private bytes are host OS counters, not portable browser RSS, and are not variant-level JS heap measurements.

- Scope: windows-process-tree
- Max working set: 445.0 MiB
- Max private bytes: 211.5 MiB
- Max process count: 10

| Sample | Scope | Processes | Working set | Private bytes |
| --- | --- | ---: | ---: | ---: |
| browser-started | windows-process-tree | 9 | 363.8 MiB | 151.3 MiB |
| before-run | windows-process-tree | 10 | 413.2 MiB | 170.9 MiB |
| after-run | windows-process-tree | 8 | 445.0 MiB | 211.5 MiB |

## Materialization Counters

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

- projectionLowSelectivity: Projection rows require a separate selector contract and are emitted only for projection-cycle fixtures.
- projectionHighSelectivity: Projection rows require a separate selector contract and are emitted only for projection-cycle fixtures.
- processRss: Browsers do not expose a portable process RSS metric to page JavaScript; this report records page-exposed JS heap counters when available and separate Windows process-tree counters when available.

## Parity

- All rows event-count parity: ok, events=57096514, rows=scanAllNoDecode, nameStringOnly, textStringOnly, attrNameStringOnly, attrValueStringOnly, stringFull, eventObjectFull, cursorAccessor, rawFrameDirect, rawFrameNameId
- Full-string parity rows: ok, events=57096514, checksum=-540013997, rows=stringFull, eventObjectFull, cursorAccessor, rawFrameDirect, rawFrameNameId

## Findings

- browser-byte-batch-contract: Rows consume corpus-backed browser Uint8Array batches and do not load a full XML string.
  - stringFull: maxJsHeap=11.1 MiB
  - eventObjectFull: maxJsHeap=21.2 MiB
  - cursorAccessor: maxJsHeap=11.8 MiB
  - rawFrameDirect: maxJsHeap=26.8 MiB
  - rawFrameNameId: maxJsHeap=9.6 MiB
- browser-memory-scope: Variant memory is browser JS heap only; it is not a process RSS replacement.
  - stringFull: jsHeapLimit=4.00 GiB
  - eventObjectFull: jsHeapLimit=4.00 GiB
  - cursorAccessor: jsHeapLimit=4.00 GiB
  - rawFrameDirect: jsHeapLimit=4.00 GiB
  - rawFrameNameId: jsHeapLimit=4.00 GiB
- browser-host-process-memory: Host process-tree memory is recorded separately from variant JS heap when the host supports it.
  - maxWorkingSet=445.0 MiB
  - maxPrivateBytes=211.5 MiB
  - maxProcessCount=10
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
- headroom-search: The fastest row in each family is a browser headroom signal, not a runtime-limit conclusion.
  - partial=attrNameStringOnly 209.12 MiB/s
  - full=rawFrameNameId 122.08 MiB/s
- corpus-cycle-fixture: The browser fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.
  - sourceFile=G:\programming\stax-xml\packages\benchmark\assets\books.xml
  - sourceBytes=4551
  - actualBytes=1073744736
