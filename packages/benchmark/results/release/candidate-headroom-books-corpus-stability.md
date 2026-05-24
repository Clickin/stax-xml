# Large Candidate Headroom Matrix

Generated: 2026-05-24T13:16:21.393Z

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
| stringFull | full-stax-js | full-string-materialization | stream-events | 154.29 MiB/s | 1.00x | 0.46x | below | yes | not-found | 57096514 | -540013997 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | stream-events | 141.62 MiB/s | 0.92x | 0.42x | below | yes | not-found | 57096514 | -540013997 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | stream-events | 176.47 MiB/s | 1.14x | 0.53x | below | yes | not-found | 57096514 | -540013997 | yes |
| rawFrameStringCache | full-stax-js | full-string-materialization | stream-events | 129.28 MiB/s | 0.84x | 0.39x | below | yes | not-found | 57096514 | -540013997 | yes |

## Timing Stability

Rows with `runs > 1` report same-process timing spread; this is variance evidence for the recorded machine, not a cross-process statistical proof.

| Variant | Runs | Avg ms | Min ms | Max ms | Spread | Samples ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| stringFull | 3 | 6637.08 | 6105.54 | 7498.43 | 21.0% | 6105.54, 7498.43, 6307.28 |
| eventObjectFull | 3 | 7230.50 | 7209.70 | 7259.21 | 0.7% | 7259.21, 7222.60, 7209.70 |
| rawFrameNameId | 3 | 5802.59 | 5689.42 | 5872.27 | 3.2% | 5846.07, 5872.27, 5689.42 |
| rawFrameStringCache | 3 | 7920.91 | 7862.57 | 8023.15 | 2.0% | 7862.57, 8023.15, 7877.03 |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| stringFull | +1.6 MiB | +2.4 MiB | 6.6 MiB | 66.8 MiB |
| eventObjectFull | +25.4 MiB | +45.5 MiB | 41.8 MiB | 203.3 MiB |
| rawFrameNameId | +910.0 KiB | +5.6 MiB | 6.1 MiB | 223.1 MiB |
| rawFrameStringCache | +6.6 MiB | +1.3 MiB | 14.3 MiB | 226.9 MiB |

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
  - stringFull: maxRSS=66.8 MiB
  - eventObjectFull: maxRSS=203.3 MiB
  - rawFrameNameId: maxRSS=223.1 MiB
  - rawFrameStringCache: maxRSS=226.9 MiB
- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=57096514, checksum=-540013997
  - eventObjectFull: events=57096514, checksum=-540013997
  - rawFrameNameId: events=57096514, checksum=-540013997
  - rawFrameStringCache: events=57096514, checksum=-540013997
- headroom-search: The fastest row in each family is a headroom signal, not a runtime-limit conclusion.
  - partial=missing
  - full=rawFrameNameId 176.47 MiB/s
- corpus-cycle-fixture: The fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.
  - sourceFile=G:\programming\stax-xml\packages\benchmark\assets\books.xml
  - sourceBytes=4551
  - actualBytes=1073744736
