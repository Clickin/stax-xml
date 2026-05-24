# Runtime Proof Coverage Audit

Generated: 2026-05-24T16:50:21.842Z

This audit scans current release artifacts to show which proof obligations are covered, partial, or still open. It is not a new benchmark run and not an impossibility proof.

## Summary

- Scanned primary artifacts: 94
- Ignored derived artifacts: 5
- Measured rows recognized: 572
- Benchmark artifacts: 69
- Source artifacts: 12
- Trace/profile artifacts: 5
- Allocation artifacts: 12
- Environment artifacts: 1
- 1 GiB+ JS full-string rows: 327
- Corpus seeds: 3
- Open or partial obligations: 1

## Runtime Coverage

| Runtime | Artifacts | Measured Rows | 1 GiB+ Full Rows | Fastest 1 GiB+ Full Row | Source Pins | Trace/Profile | Allocation |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| Node/V8 | 30 | 157 | 85 | rawFrameNameId 180.08 MiB/s from candidate-headroom-cross-process-books-corpus.json | 2 | 1 | 5 |
| Bun/JSC | 24 | 157 | 90 | rawFrameNameId 178.52 MiB/s from bun-candidate-headroom-books-corpus-stability.json | 3 | 2 | 2 |
| Deno/V8 | 6 | 35 | 29 | shortAsciiSubarraySharedDecoder 90.83 MiB/s from deno-textdecoder-span-variants-corpus.json | 1 | 0 | 0 |
| Chrome/V8 browser | 14 | 95 | 53 | rawFrameNameId 130.32 MiB/s from browser-candidate-headroom-cross-process-books-corpus.json | 2 | 1 | 1 |
| Firefox/SpiderMonkey browser | 14 | 78 | 70 | rawFrameNameId 76.90 MiB/s from firefox-bidi-candidate-headroom-cross-process-books-corpus.json | 3 | 0 | 1 |
| Safari/WebKit browser | 1 | 0 | 0 | none | 0 | 0 | 0 |
| Java/Woodstox | 6 | 3 | 0 | none | 0 | 1 | 2 |
| Rust/quick-xml | 4 | 3 | 0 | none | 0 | 0 | 1 |
| unknown | 8 | 44 | 0 | none | 0 | 1 | 3 |

## Open Obligations

| Obligation | Status | Evidence | Next experiment |
| --- | --- | --- | --- |
| `firefox-browser-rows-open` | covered | 78 Firefox/SpiderMonkey browser benchmark rows found. | Broaden Firefox coverage with corpus/projection rows plus SpiderMonkey codegen and allocation evidence. |
| `safari-jsc-source-and-browser-rows-open` | open | Bun/JSC and Bun-patched WebKit evidence is present, but no Safari/WebKit browser benchmark row was found. Local Safari/WebKit availability audit is present and records that the current host/harness cannot run Safari rows. | Run same-contract Safari/WebKit rows on a macOS host through the safaridriver wrapper and cross-process stability runner. |
| `codegen-traces-open` | covered | Node/V8 trace evidence present. Bun/JSC codegen/IR evidence present. Browser codegen trace evidence present. | Capture runtime-specific optimized-code or IR evidence for the fastest full-string rows, especially Bun/JSC and browser engines. |
| `allocation-profiles-open` | covered | 12 allocation/profile artifacts found. Bun/JSC allocation evidence present. Non-V8 browser allocation evidence present. | Add Bun/JSC and non-V8 browser allocation or heap-profile artifacts for the same full-string rows. |
| `non-v8-browser-coverage-open` | covered | 78 non-V8 browser benchmark rows found. | Broaden non-V8 browser coverage with Safari/WebKit plus corpus/projection rows and allocation evidence. |
| `independent-corpus-suite-open` | covered | 3 release corpus seed(s) found: books.xml, large.xml, treebank_e.xml. | Keep new corpus rows flowing through the counterexample scanner before broadening claims. |
| `counterexample-rule-present` | covered | runtime-counterexample-scan.md is a required gate artifact and preserves the bounded full-string 200 MiB/s counterexample rule. | Keep new rows flowing through the counterexample scanner before broadening claims. |

## Corpus Coverage

Current release corpus seeds: `books.xml`, `large.xml`, `treebank_e.xml`.

## Browser Coverage

- Chrome/V8 browser benchmark rows: 95
- Firefox/SpiderMonkey browser benchmark rows: 78
- Safari/WebKit browser benchmark rows: 0
- Non-V8 browser benchmark rows: 78

Firefox benchmark rows and exact tested-build JS string, TextDecoder, and page memory API source pins are now present, but Firefox codegen/allocation evidence remains a separate gap. Safari/browser JSC is still not covered by Bun/JSC.

## Findings

- coverage-audit-is-not-runtime-limit-proof (SCOPE_GUARD): Coverage auditing can prove which evidence families are absent or partial, but it cannot prove a JavaScript runtime ceiling.
- non-v8-browser-gap-remains (COVERED): At least one non-V8 browser benchmark row is present.
- corpus-suite-gap-remains (COVERED): Current release artifacts cover 3 corpus seed(s), so broad corpus coverage remains unproven.
- open-obligations-ranked (OPEN): 1 proof obligation(s) remain open or partial after scanning current release artifacts.
  - safari-jsc-source-and-browser-rows-open

## Limits

- This audit only checks evidence coverage in current release artifacts. It does not measure new throughput or memory.
- Source pins without same-runtime benchmark rows are treated as source-only evidence.
- Bun/JSC evidence is not Safari/browser JSC evidence unless the tested browser build and rows are recorded separately.
- Missing evidence is not evidence that optimization is impossible; it is a queue for counterexample search.
