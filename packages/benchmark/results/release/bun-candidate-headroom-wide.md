# Large Candidate Headroom Matrix

Generated: 2026-05-23T16:45:26.138Z

This experiment is a 1 GiB+ bounded-memory counterexample search over generated `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
The neutral path uses `Uint8Array` plus `TextDecoder`; it does not use native addons, Node `Buffer.toString()`, or lazy getters.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Bun 1.3.13, JavaScriptCore WebKit 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
- Fixture source: generated
- Generated size: 1.00 GiB (1073742042 bytes)
- Fixture shape: diverse-cycle
- Row cycle size: 65536
- Row bytes: min=222, max=289, avg=264.8
- Batch size: 16
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
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | 175.02 MiB/s | 3.31x | 0.52x | not-applicable | yes | not-found | 44596829 | 178037248 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | 104.65 MiB/s | 1.98x | 0.31x | not-applicable | yes | not-found | 44596829 | -961575258 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | 85.47 MiB/s | 1.61x | 0.26x | not-applicable | yes | not-found | 44596829 | -800270476 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | 107.52 MiB/s | 2.03x | 0.32x | not-applicable | yes | not-found | 44596829 | -1641285685 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | 89.71 MiB/s | 1.69x | 0.27x | not-applicable | yes | not-found | 44596829 | 1201035695 | no |
| stringFull | full-stax-js | full-string-materialization | 52.93 MiB/s | 1.00x | 0.16x | below | yes | not-found | 44596829 | 2036370286 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | 34.09 MiB/s | 0.64x | 0.10x | below | yes | not-found | 44596829 | 2036370286 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | 56.32 MiB/s | 1.06x | 0.17x | below | yes | not-found | 44596829 | 2036370286 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | 52.49 MiB/s | 0.99x | 0.16x | below | yes | not-found | 44596829 | 2036370286 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | 60.51 MiB/s | 1.14x | 0.18x | below | yes | not-found | 44596829 | 2036370286 | yes |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +1.1 MiB | +45.8 MiB | 26.3 MiB | 252.4 MiB |
| nameStringOnly | -252.0 KiB | -4.8 MiB | 26.3 MiB | 253.0 MiB |
| textStringOnly | +52.4 MiB | -30.8 MiB | 78.5 MiB | 248.8 MiB |
| attrNameStringOnly | -52.4 MiB | +33.1 MiB | 78.5 MiB | 256.1 MiB |
| attrValueStringOnly | -9.9 KiB | -10.7 MiB | 26.1 MiB | 256.2 MiB |
| stringFull | +47.1 MiB | -28.2 MiB | 73.2 MiB | 250.9 MiB |
| eventObjectFull | +14.7 MiB | +8.0 MiB | 87.8 MiB | 235.9 MiB |
| cursorAccessor | -30.2 MiB | -15.6 MiB | 87.8 MiB | 241.3 MiB |
| rawFrameDirect | +30.5 MiB | +24.8 MiB | 88.1 MiB | 255.9 MiB |
| rawFrameNameId | -30.2 MiB | -35.5 MiB | 88.1 MiB | 261.3 MiB |

## Materialization Counters

Counters are collected inside the measured large-input loop to avoid a second 1 GiB+ pass.

| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Event objects | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| scanAllNoDecode | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 | 0 | 28,379,799 |
| nameStringOnly | 32,434,056 | 32,434,056 | 0 | 0 | 0 | 0 | 0/0 | 0 | 28,379,799 |
| textStringOnly | 12,162,771 | 0 | 12,162,771 | 0 | 0 | 0 | 0/0 | 0 | 28,379,799 |
| attrNameStringOnly | 28,379,799 | 0 | 0 | 28,379,799 | 0 | 0 | 0/0 | 0 | 28,379,799 |
| attrValueStringOnly | 28,379,799 | 0 | 0 | 0 | 28,379,799 | 0 | 0/0 | 0 | 28,379,799 |
| stringFull | 101,356,425 | 32,434,056 | 12,162,771 | 28,379,799 | 28,379,799 | 0 | 0/0 | 0 | 28,379,799 |
| eventObjectFull | 101,356,425 | 32,434,056 | 12,162,771 | 28,379,799 | 28,379,799 | 0 | 0/0 | 44,596,829 | 28,379,799 |
| cursorAccessor | 101,356,425 | 32,434,056 | 12,162,771 | 28,379,799 | 28,379,799 | 0 | 0/0 | 0 | 28,379,799 |
| rawFrameDirect | 101,356,425 | 32,434,056 | 12,162,771 | 28,379,799 | 28,379,799 | 101,356,425 | 0/0 | 0 | 28,379,799 |
| rawFrameNameId | 101,356,425 | 32,434,056 | 12,162,771 | 28,379,799 | 28,379,799 | 40,548,737 | 60,807,688/6,167 | 0 | 28,379,799 |

## Omitted Rows

- projectionLowSelectivity: Projection rows require a separate selector contract and remain future work.
- projectionHighSelectivity: Projection rows require a separate selector contract and remain future work.

## Parity

All rows event-count parity: ok, events=44596829.
Full-string parity rows: ok, events=44596829, checksum=2036370286, rows=stringFull, eventObjectFull, cursorAccessor, rawFrameDirect, rawFrameNameId.

## Findings

- bounded-memory-contract: Rows consume generated Uint8Array batches and do not load a full XML string.
  - stringFull: maxRSS=250.9 MiB
  - eventObjectFull: maxRSS=235.9 MiB
  - cursorAccessor: maxRSS=241.3 MiB
  - rawFrameDirect: maxRSS=255.9 MiB
  - rawFrameNameId: maxRSS=261.3 MiB
- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
  - scanAllNoDecode: event-types-and-attribute-counts-only, strings=0
  - nameStringOnly: event-types-attribute-counts-and-element-names, strings=32434056
  - textStringOnly: event-types-attribute-counts-and-text-cdata, strings=12162771
  - attrNameStringOnly: event-types-attribute-counts-and-attribute-names, strings=28379799
  - attrValueStringOnly: event-types-attribute-counts-and-attribute-values, strings=28379799
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=44596829, checksum=2036370286
  - eventObjectFull: events=44596829, checksum=2036370286
  - cursorAccessor: events=44596829, checksum=2036370286
  - rawFrameDirect: events=44596829, checksum=2036370286
  - rawFrameNameId: events=44596829, checksum=2036370286
- headroom-search: The fastest row in each family is a headroom signal, not a runtime-limit conclusion.
  - partial=scanAllNoDecode 175.02 MiB/s
  - full=rawFrameNameId 60.51 MiB/s
