# Large Candidate Headroom Matrix

Generated: 2026-05-24T13:18:04.497Z

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
- Cases: stringFull, eventObjectFull, rawFrameNameId, rawFrameStringCache
- Runs: warmups=0, runs=3
- Bounded RSS reporting gate: 512.0 MiB

## Woodstox Target

- Baseline tool: woodstox
- Woodstox throughput: 333.43 MiB/s
- Goal ratio: 0.90x
- 0.9x target throughput: 300.09 MiB/s

## Results

| Variant | Family | Contract scope | Count kind | Throughput | Relative to stringFull | Woodstox ratio | 0.9x target | Bounded memory | Counterexample | Events | Checksum | Full parity |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | ---: | ---: | --- |
| stringFull | full-stax-js | full-string-materialization | stream-events | 171.35 MiB/s | 1.00x | 0.51x | below | yes | not-found | 57096514 | -540013997 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | stream-events | 136.44 MiB/s | 0.80x | 0.41x | below | yes | not-found | 57096514 | -540013997 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | stream-events | 178.52 MiB/s | 1.04x | 0.54x | below | yes | not-found | 57096514 | -540013997 | yes |
| rawFrameStringCache | full-stax-js | full-string-materialization | stream-events | 143.20 MiB/s | 0.84x | 0.43x | below | yes | not-found | 57096514 | -540013997 | yes |

## Timing Stability

Rows with `runs > 1` report same-process timing spread; this is variance evidence for the recorded machine, not a cross-process statistical proof.

| Variant | Runs | Avg ms | Min ms | Max ms | Spread | Samples ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| stringFull | 3 | 5976.20 | 5938.98 | 6005.07 | 1.1% | 6005.07, 5938.98, 5984.56 |
| eventObjectFull | 3 | 7505.09 | 7484.50 | 7537.35 | 0.7% | 7537.35, 7493.43, 7484.50 |
| rawFrameNameId | 3 | 5736.22 | 5685.88 | 5776.69 | 1.6% | 5776.69, 5685.88, 5746.09 |
| rawFrameStringCache | 3 | 7150.62 | 7059.93 | 7243.09 | 2.6% | 7243.09, 7148.85, 7059.93 |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| stringFull | +11.4 MiB | +16.6 MiB | 46.6 MiB | 204.6 MiB |
| eventObjectFull | +3.4 MiB | +628.0 KiB | 45.4 MiB | 199.2 MiB |
| rawFrameNameId | +314.7 KiB | -1.8 MiB | 46.3 MiB | 189.4 MiB |
| rawFrameStringCache | -11.2 MiB | -1.2 MiB | 46.3 MiB | 185.0 MiB |

## Materialization Counters

Counters are collected inside the measured large-input loop to avoid a second 1 GiB+ pass.

| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Value cache hit/miss | Event objects | Projected records | Projection fields | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| stringFull | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 0 | 0/0 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| eventObjectFull | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 0 | 0/0 | 0/0 | 57,096,514 | 0 | 0 | 2,831,232 |
| rawFrameNameId | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 19,818,633 | 42,940,343/9 | 0/0 | 0 | 0 | 0 | 2,831,232 |
| rawFrameStringCache | 62,758,976 | 40,109,120 | 16,987,392 | 2,831,232 | 2,831,232 | 76 | 42,940,343/9 | 19,818,557/67 | 0 | 0 | 0 | 2,831,232 |

## Omitted Rows

- projectionLowSelectivity: Projection rows require a separate selector contract and remain future work.
- projectionHighSelectivity: Projection rows require a separate selector contract and remain future work.

## Parity

All rows event-count parity: ok, events=57096514.
Full-string parity rows: ok, events=57096514, checksum=-540013997, rows=stringFull, eventObjectFull, rawFrameNameId, rawFrameStringCache.

## Findings

- bounded-memory-contract: Rows consume corpus-backed Uint8Array batches and do not load a full XML string.
  - stringFull: maxRSS=204.6 MiB
  - eventObjectFull: maxRSS=199.2 MiB
  - rawFrameNameId: maxRSS=189.4 MiB
  - rawFrameStringCache: maxRSS=185.0 MiB
- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=57096514, checksum=-540013997
  - eventObjectFull: events=57096514, checksum=-540013997
  - rawFrameNameId: events=57096514, checksum=-540013997
  - rawFrameStringCache: events=57096514, checksum=-540013997
- headroom-search: The fastest row in each family is a headroom signal, not a runtime-limit conclusion.
  - partial=missing
  - full=rawFrameNameId 178.52 MiB/s
- corpus-cycle-fixture: The fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.
  - sourceFile=G:\programming\stax-xml\packages\benchmark\assets\books.xml
  - sourceBytes=4551
  - actualBytes=1073744736
