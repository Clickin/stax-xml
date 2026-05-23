# Large Candidate Headroom Matrix

Generated: 2026-05-23T17:31:20.939Z

This experiment is a 1 GiB+ bounded-memory counterexample search over generated `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
The neutral path uses `Uint8Array` plus `TextDecoder`; it does not use native addons, Node `Buffer.toString()`, or lazy getters.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Node v24.15.0, V8 13.6.233.17-node.48
- Fixture source: generated
- Generated size: 1.00 GiB (1073742038 bytes)
- Fixture shape: diverse-cycle
- Row cycle size: 4096
- Row bytes: min=222, max=284, avg=261.4
- Batch size: 16
- Runs: warmups=0, runs=3
- Bounded RSS reporting gate: 512.0 MiB

## Woodstox Target

- Baseline tool: woodstox
- Woodstox throughput: 333.43 MiB/s
- Goal ratio: 0.90x
- 0.9x target throughput: 300.09 MiB/s

## Results

| Variant | Family | Contract scope | Throughput | Relative to stringFull | Woodstox ratio | 0.9x target | Bounded memory | Counterexample | Events | Checksum | Full parity |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | ---: | ---: | --- |
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | 109.41 MiB/s | 2.12x | 0.33x | not-applicable | yes | not-found | 45189256 | 773645869 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | 85.72 MiB/s | 1.66x | 0.26x | not-applicable | yes | not-found | 45189256 | -779910903 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | 74.80 MiB/s | 1.45x | 0.22x | not-applicable | yes | not-found | 45189256 | -1618348602 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | 92.15 MiB/s | 1.79x | 0.28x | not-applicable | yes | not-found | 45189256 | 494150397 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | 87.33 MiB/s | 1.69x | 0.26x | not-applicable | yes | not-found | 45189256 | 946031520 | no |
| stringFull | full-stax-js | full-string-materialization | 51.58 MiB/s | 1.00x | 0.15x | below | yes | not-found | 45189256 | 1421012805 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | 43.75 MiB/s | 0.85x | 0.13x | below | yes | not-found | 45189256 | 1421012805 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | 54.32 MiB/s | 1.05x | 0.16x | below | yes | not-found | 45189256 | 1421012805 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | 53.99 MiB/s | 1.05x | 0.16x | below | yes | not-found | 45189256 | 1421012805 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | 58.48 MiB/s | 1.13x | 0.18x | below | yes | not-found | 45189256 | 1421012805 | yes |

## Timing Stability

Rows with `runs > 1` report same-process timing spread; this is variance evidence for the recorded machine, not a cross-process statistical proof.

| Variant | Runs | Avg ms | Min ms | Max ms | Spread | Samples ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| scanAllNoDecode | 3 | 9359.62 | 7856.81 | 10217.37 | 25.2% | 7856.81, 10217.37, 10004.68 |
| nameStringOnly | 3 | 11945.60 | 11704.33 | 12148.29 | 3.7% | 11704.33, 12148.29, 11984.18 |
| textStringOnly | 3 | 13690.72 | 13221.71 | 13952.75 | 5.3% | 13221.71, 13897.70, 13952.75 |
| attrNameStringOnly | 3 | 11112.00 | 10933.69 | 11257.48 | 2.9% | 10933.69, 11144.84, 11257.48 |
| attrValueStringOnly | 3 | 11725.07 | 11649.55 | 11769.14 | 1.0% | 11649.55, 11756.52, 11769.14 |
| stringFull | 3 | 19854.13 | 19495.88 | 20096.57 | 3.0% | 19495.88, 20096.57, 19969.93 |
| eventObjectFull | 3 | 23404.32 | 23127.67 | 23767.44 | 2.7% | 23127.67, 23767.44, 23317.86 |
| cursorAccessor | 3 | 18851.44 | 18416.23 | 19155.56 | 3.9% | 18982.54, 18416.23, 19155.56 |
| rawFrameDirect | 3 | 18966.82 | 18879.45 | 19011.78 | 0.7% | 19009.24, 18879.45, 19011.78 |
| rawFrameNameId | 3 | 17510.27 | 17467.45 | 17587.15 | 0.7% | 17467.45, 17476.22, 17587.15 |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +2.4 MiB | +4.5 MiB | 8.6 MiB | 76.2 MiB |
| nameStringOnly | +3.1 MiB | +897.3 KiB | 8.9 MiB | 78.4 MiB |
| textStringOnly | +5.9 MiB | +2.6 MiB | 12.0 MiB | 85.6 MiB |
| attrNameStringOnly | +6.9 MiB | +1.6 MiB | 12.7 MiB | 90.8 MiB |
| attrValueStringOnly | +2.1 MiB | -621.3 KiB | 8.0 MiB | 89.9 MiB |
| stringFull | +4.7 MiB | +6.4 MiB | 15.8 MiB | 103.6 MiB |
| eventObjectFull | +10.2 MiB | +34.4 MiB | 20.5 MiB | 206.2 MiB |
| cursorAccessor | +33.9 MiB | +4.3 MiB | 39.8 MiB | 218.7 MiB |
| rawFrameDirect | +21.3 MiB | -1.1 MiB | 27.3 MiB | 218.2 MiB |
| rawFrameNameId | +49.6 MiB | +1.6 MiB | 55.6 MiB | 220.9 MiB |

## Materialization Counters

Counters are collected inside the measured large-input loop to avoid a second 1 GiB+ pass.

| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Event objects | Attribute pairs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| scanAllNoDecode | 0 | 0 | 0 | 0 | 0 | 0 | 0/0 | 0 | 28,756,798 |
| nameStringOnly | 32,864,912 | 32,864,912 | 0 | 0 | 0 | 0 | 0/0 | 0 | 28,756,798 |
| textStringOnly | 12,324,342 | 0 | 12,324,342 | 0 | 0 | 0 | 0/0 | 0 | 28,756,798 |
| attrNameStringOnly | 28,756,798 | 0 | 0 | 28,756,798 | 0 | 0 | 0/0 | 0 | 28,756,798 |
| attrValueStringOnly | 28,756,798 | 0 | 0 | 0 | 28,756,798 | 0 | 0/0 | 0 | 28,756,798 |
| stringFull | 102,702,850 | 32,864,912 | 12,324,342 | 28,756,798 | 28,756,798 | 0 | 0/0 | 0 | 28,756,798 |
| eventObjectFull | 102,702,850 | 32,864,912 | 12,324,342 | 28,756,798 | 28,756,798 | 0 | 0/0 | 45,189,256 | 28,756,798 |
| cursorAccessor | 102,702,850 | 32,864,912 | 12,324,342 | 28,756,798 | 28,756,798 | 0 | 0/0 | 0 | 28,756,798 |
| rawFrameDirect | 102,702,850 | 32,864,912 | 12,324,342 | 28,756,798 | 28,756,798 | 102,702,850 | 0/0 | 0 | 28,756,798 |
| rawFrameNameId | 102,702,850 | 32,864,912 | 12,324,342 | 28,756,798 | 28,756,798 | 41,087,307 | 61,615,543/6,167 | 0 | 28,756,798 |

## Omitted Rows

- projectionLowSelectivity: Projection rows require a separate selector contract and remain future work.
- projectionHighSelectivity: Projection rows require a separate selector contract and remain future work.

## Parity

All rows event-count parity: ok, events=45189256.
Full-string parity rows: ok, events=45189256, checksum=1421012805, rows=stringFull, eventObjectFull, cursorAccessor, rawFrameDirect, rawFrameNameId.

## Findings

- bounded-memory-contract: Rows consume generated Uint8Array batches and do not load a full XML string.
  - stringFull: maxRSS=103.6 MiB
  - eventObjectFull: maxRSS=206.2 MiB
  - cursorAccessor: maxRSS=218.7 MiB
  - rawFrameDirect: maxRSS=218.2 MiB
  - rawFrameNameId: maxRSS=220.9 MiB
- contract-separation: Partial rows deliberately drop one or more string fields and are not StAX parity rows.
  - scanAllNoDecode: event-types-and-attribute-counts-only, strings=0
  - nameStringOnly: event-types-attribute-counts-and-element-names, strings=32864912
  - textStringOnly: event-types-attribute-counts-and-text-cdata, strings=12324342
  - attrNameStringOnly: event-types-attribute-counts-and-attribute-names, strings=28756798
  - attrValueStringOnly: event-types-attribute-counts-and-attribute-values, strings=28756798
- full-string-parity: Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.
  - stringFull: events=45189256, checksum=1421012805
  - eventObjectFull: events=45189256, checksum=1421012805
  - cursorAccessor: events=45189256, checksum=1421012805
  - rawFrameDirect: events=45189256, checksum=1421012805
  - rawFrameNameId: events=45189256, checksum=1421012805
- headroom-search: The fastest row in each family is a headroom signal, not a runtime-limit conclusion.
  - partial=scanAllNoDecode 109.41 MiB/s
  - full=rawFrameNameId 58.48 MiB/s
