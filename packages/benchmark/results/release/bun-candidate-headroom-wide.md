# Large Candidate Headroom Matrix

Generated: 2026-05-23T13:52:05.753Z

This experiment is a 1 GiB+ bounded-memory counterexample search over generated `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
The neutral path uses `Uint8Array` plus `TextDecoder`; it does not use native addons, Node `Buffer.toString()`, or lazy getters.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Bun 1.3.13, JavaScriptCore WebKit 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
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
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | 238.72 MiB/s | 2.27x | 0.72x | not-applicable | yes | not-found | 44596829 | 178037248 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | 202.60 MiB/s | 1.92x | 0.61x | not-applicable | yes | not-found | 44596829 | -961575258 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | 161.44 MiB/s | 1.53x | 0.48x | not-applicable | yes | not-found | 44596829 | -800270476 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | 207.16 MiB/s | 1.97x | 0.62x | not-applicable | yes | not-found | 44596829 | -1641285685 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | 170.65 MiB/s | 1.62x | 0.51x | not-applicable | yes | not-found | 44596829 | 1201035695 | no |
| stringFull | full-stax-js | full-string-materialization | 105.38 MiB/s | 1.00x | 0.32x | below | yes | not-found | 44596829 | 2036370286 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | 107.97 MiB/s | 1.02x | 0.32x | below | yes | not-found | 44596829 | 2036370286 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | 93.10 MiB/s | 0.88x | 0.28x | below | yes | not-found | 44596829 | 2036370286 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | 111.09 MiB/s | 1.05x | 0.33x | below | yes | not-found | 44596829 | 2036370286 | yes |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +1.8 MiB | +54.7 MiB | 27.1 MiB | 253.9 MiB |
| nameStringOnly | +1.6 MiB | -3.6 MiB | 28.8 MiB | 254.1 MiB |
| textStringOnly | +32.6 MiB | +15.3 MiB | 61.3 MiB | 265.8 MiB |
| attrNameStringOnly | +2.1 MiB | +64.3 MiB | 63.4 MiB | 330.1 MiB |
| attrValueStringOnly | +1.4 MiB | +30.1 MiB | 64.9 MiB | 360.1 MiB |
| stringFull | +8.7 MiB | -71.4 MiB | 73.6 MiB | 360.1 MiB |
| cursorAccessor | -15.8 MiB | +13.3 MiB | 73.6 MiB | 302.0 MiB |
| rawFrameDirect | +18.1 MiB | -6.7 MiB | 75.9 MiB | 302.0 MiB |
| rawFrameNameId | -2.0 MiB | +6.6 MiB | 75.9 MiB | 302.0 MiB |

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
| cursorAccessor | 101,356,425 | 32,434,056 | 12,162,771 | 28,379,799 | 28,379,799 | 0 | 0/0 | 0 | 28,379,799 |
| rawFrameDirect | 101,356,425 | 32,434,056 | 12,162,771 | 28,379,799 | 28,379,799 | 101,356,425 | 0/0 | 0 | 28,379,799 |
| rawFrameNameId | 101,356,425 | 32,434,056 | 12,162,771 | 28,379,799 | 28,379,799 | 40,548,737 | 60,807,688/6,167 | 0 | 28,379,799 |

## Omitted Rows

- eventObjectFull: EventReaderSync requires a complete XML string input in this benchmark family, so it is excluded from the generated byte-batch bounded-memory matrix.
- projectionLowSelectivity: Projection rows require a separate selector contract and remain future work.
- projectionHighSelectivity: Projection rows require a separate selector contract and remain future work.

## Parity

All rows event-count parity: ok, events=44596829.
Full-string parity rows: ok, events=44596829, checksum=2036370286, rows=stringFull, cursorAccessor, rawFrameDirect, rawFrameNameId.

## Findings

- bounded-memory-contract: Rows consume generated Uint8Array batches and do not load a full XML string.
  - stringFull: maxRSS=360.1 MiB
  - cursorAccessor: maxRSS=302.0 MiB
  - rawFrameDirect: maxRSS=302.0 MiB
  - rawFrameNameId: maxRSS=302.0 MiB
- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
  - scanAllNoDecode: event-types-and-attribute-counts-only, strings=0
  - nameStringOnly: event-types-attribute-counts-and-element-names, strings=32434056
  - textStringOnly: event-types-attribute-counts-and-text-cdata, strings=12162771
  - attrNameStringOnly: event-types-attribute-counts-and-attribute-names, strings=28379799
  - attrValueStringOnly: event-types-attribute-counts-and-attribute-values, strings=28379799
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=44596829, checksum=2036370286
  - cursorAccessor: events=44596829, checksum=2036370286
  - rawFrameDirect: events=44596829, checksum=2036370286
  - rawFrameNameId: events=44596829, checksum=2036370286
- headroom-search: The fastest row in each family is a headroom signal, not a runtime-limit conclusion.
  - partial=scanAllNoDecode 238.72 MiB/s
  - full=rawFrameNameId 111.09 MiB/s
