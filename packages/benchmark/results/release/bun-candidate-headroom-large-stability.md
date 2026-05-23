# Large Candidate Headroom Matrix

Generated: 2026-05-23T17:46:18.570Z

This experiment is a 1 GiB+ bounded-memory counterexample search over generated `Uint8Array` batches.
Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.
Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.
The neutral path uses `Uint8Array` plus `TextDecoder`; it does not use native addons, Node `Buffer.toString()`, or lazy getters.

## Fixture

- Package: stax-xml 1.0.0
- Runtime: Bun 1.3.13, JavaScriptCore WebKit 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
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
| scanAllNoDecode | partial-upper-bound | event-types-and-attribute-counts-only | 139.49 MiB/s | 2.57x | 0.42x | not-applicable | yes | not-found | 45189256 | 773645869 | no |
| nameStringOnly | partial-upper-bound | event-types-attribute-counts-and-element-names | 105.35 MiB/s | 1.94x | 0.32x | not-applicable | yes | not-found | 45189256 | -779910903 | no |
| textStringOnly | partial-upper-bound | event-types-attribute-counts-and-text-cdata | 85.55 MiB/s | 1.58x | 0.26x | not-applicable | yes | not-found | 45189256 | -1618348602 | no |
| attrNameStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-names | 110.33 MiB/s | 2.03x | 0.33x | not-applicable | yes | not-found | 45189256 | 494150397 | no |
| attrValueStringOnly | partial-upper-bound | event-types-attribute-counts-and-attribute-values | 91.30 MiB/s | 1.68x | 0.27x | not-applicable | yes | not-found | 45189256 | 946031520 | no |
| stringFull | full-stax-js | full-string-materialization | 54.24 MiB/s | 1.00x | 0.16x | below | yes | not-found | 45189256 | 1421012805 | yes |
| eventObjectFull | full-stax-js | full-event-object-materialization | 37.63 MiB/s | 0.69x | 0.11x | below | yes | not-found | 45189256 | 1421012805 | yes |
| cursorAccessor | full-stax-js | full-string-materialization | 56.28 MiB/s | 1.04x | 0.17x | below | yes | not-found | 45189256 | 1421012805 | yes |
| rawFrameDirect | full-stax-js | full-string-materialization | 50.59 MiB/s | 0.93x | 0.15x | below | yes | not-found | 45189256 | 1421012805 | yes |
| rawFrameNameId | full-stax-js | full-string-materialization | 58.73 MiB/s | 1.08x | 0.18x | below | yes | not-found | 45189256 | 1421012805 | yes |

## Timing Stability

Rows with `runs > 1` report same-process timing spread; this is variance evidence for the recorded machine, not a cross-process statistical proof.

| Variant | Runs | Avg ms | Min ms | Max ms | Spread | Samples ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| scanAllNoDecode | 3 | 7341.06 | 5562.83 | 8263.59 | 36.8% | 5562.83, 8196.78, 8263.59 |
| nameStringOnly | 3 | 9719.60 | 9677.79 | 9784.07 | 1.1% | 9784.07, 9696.95, 9677.79 |
| textStringOnly | 3 | 11970.13 | 11964.04 | 11973.58 | 0.1% | 11972.76, 11973.58, 11964.04 |
| attrNameStringOnly | 3 | 9281.23 | 9226.17 | 9374.85 | 1.6% | 9242.68, 9226.17, 9374.85 |
| attrValueStringOnly | 3 | 11215.76 | 11100.49 | 11276.86 | 1.6% | 11269.93, 11276.86, 11100.49 |
| stringFull | 3 | 18880.78 | 18631.37 | 19232.83 | 3.2% | 19232.83, 18778.13, 18631.37 |
| eventObjectFull | 3 | 27214.47 | 26807.66 | 27605.90 | 2.9% | 26807.66, 27229.85, 27605.90 |
| cursorAccessor | 3 | 18194.95 | 17834.08 | 18519.16 | 3.8% | 18231.63, 17834.08, 18519.16 |
| rawFrameDirect | 3 | 20240.47 | 20173.82 | 20310.87 | 0.7% | 20173.82, 20310.87, 20236.73 |
| rawFrameNameId | 3 | 17437.06 | 17285.65 | 17664.15 | 2.2% | 17664.15, 17361.37, 17285.65 |

## Memory

Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| scanAllNoDecode | +1.3 MiB | +9.1 MiB | 4.6 MiB | 204.7 MiB |
| nameStringOnly | +50.5 KiB | -3.2 MiB | 4.3 MiB | 198.9 MiB |
| textStringOnly | +12.6 MiB | -6.8 MiB | 42.1 MiB | 180.7 MiB |
| attrNameStringOnly | -12.6 MiB | +5.4 MiB | 42.1 MiB | 198.1 MiB |
| attrValueStringOnly | -22.3 KiB | +1.1 MiB | 4.3 MiB | 181.9 MiB |
| stringFull | +13.9 MiB | -7.2 MiB | 46.0 MiB | 185.5 MiB |
| eventObjectFull | -4.9 MiB | -4.6 MiB | 46.0 MiB | 180.7 MiB |
| cursorAccessor | +4.9 MiB | +18.7 KiB | 46.0 MiB | 185.7 MiB |
| rawFrameDirect | -3.0 MiB | +733.3 KiB | 46.0 MiB | 206.5 MiB |
| rawFrameNameId | +2.9 MiB | -6.9 MiB | 45.7 MiB | 191.8 MiB |

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
  - stringFull: maxRSS=185.5 MiB
  - eventObjectFull: maxRSS=180.7 MiB
  - cursorAccessor: maxRSS=185.7 MiB
  - rawFrameDirect: maxRSS=206.5 MiB
  - rawFrameNameId: maxRSS=191.8 MiB
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
  - partial=scanAllNoDecode 139.49 MiB/s
  - full=rawFrameNameId 58.73 MiB/s
