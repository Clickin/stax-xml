# Runtime Proof Coverage Audit

Generated: 2026-05-24T09:03:03.049Z

This audit scans current release artifacts to show which proof obligations are covered, partial, or still open. It is not a new benchmark run and not an impossibility proof.

## Summary

- Scanned primary artifacts: 77
- Ignored derived artifacts: 5
- Measured rows recognized: 487
- Benchmark artifacts: 57
- Source artifacts: 9
- Trace/profile artifacts: 3
- Allocation artifacts: 10
- 1 GiB+ JS full-string rows: 259
- Corpus seeds: 2
- Open or partial obligations: 4

## Runtime Coverage

| Runtime | Artifacts | Measured Rows | 1 GiB+ Full Rows | Fastest 1 GiB+ Full Row | Source Pins | Trace/Profile | Allocation |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| Node/V8 | 28 | 129 | 61 | rawFrameNameId 172.69 MiB/s from candidate-headroom-books-corpus.json | 2 | 1 | 5 |
| Bun/JSC | 19 | 123 | 66 | rawFrameNameId 176.55 MiB/s from bun-candidate-headroom-books-corpus-stability.json | 3 | 1 | 1 |
| Deno/V8 | 1 | 15 | 9 | stringFull 87.62 MiB/s from candidate-headroom-cross-process-projection.json | 0 | 0 | 0 |
| Chrome/V8 browser | 13 | 92 | 53 | rawFrameNameId 130.32 MiB/s from browser-candidate-headroom-cross-process-books-corpus.json | 2 | 0 | 1 |
| Firefox/SpiderMonkey browser | 11 | 78 | 70 | rawFrameNameId 76.90 MiB/s from firefox-bidi-candidate-headroom-cross-process-books-corpus.json | 1 | 0 | 0 |
| Java/Woodstox | 6 | 3 | 0 | none | 0 | 1 | 2 |
| Rust/quick-xml | 4 | 3 | 0 | none | 0 | 0 | 1 |
| unknown | 7 | 44 | 0 | none | 0 | 1 | 3 |

## Open Obligations

| Obligation | Status | Evidence | Next experiment |
| --- | --- | --- | --- |
| `firefox-browser-rows-open` | covered | 78 Firefox/SpiderMonkey browser benchmark rows found. | Broaden Firefox coverage with corpus/projection rows plus SpiderMonkey codegen and allocation evidence. |
| `safari-jsc-source-and-browser-rows-open` | open | Bun/JSC and Bun-patched WebKit evidence is present, but no Safari/WebKit browser benchmark row was found. | Pin the exact Safari/WebKit browser build and run same-contract browser rows separately from Bun/JSC. |
| `codegen-traces-open` | partial | Node/V8 trace evidence present. Bun/JSC has profiler/source evidence but no codegen/IR artifact. Browser codegen trace evidence missing. | Capture runtime-specific optimized-code or IR evidence for the fastest full-string rows, especially Bun/JSC and browser engines. |
| `allocation-profiles-open` | partial | 10 allocation/profile artifacts found. Bun/JSC allocation evidence present. Non-V8 browser allocation evidence missing. | Add Bun/JSC and non-V8 browser allocation or heap-profile artifacts for the same full-string rows. |
| `non-v8-browser-coverage-open` | covered | 78 non-V8 browser benchmark rows found. | Broaden non-V8 browser coverage with Safari/WebKit plus corpus/projection rows and allocation evidence. |
| `independent-corpus-suite-open` | partial | 2 release corpus seed(s) found: books.xml, treebank_e.xml. | Add at least 1 more independent real XML corpus seed(s) before treating corpus coverage as broad. |
| `counterexample-rule-present` | covered | runtime-counterexample-scan.md is a required gate artifact and preserves the bounded full-string 200 MiB/s counterexample rule. | Keep new rows flowing through the counterexample scanner before broadening claims. |

## Corpus Coverage

Current release corpus seeds: `books.xml`, `treebank_e.xml`.

## Browser Coverage

- Chrome/V8 browser benchmark rows: 92
- Firefox/SpiderMonkey browser benchmark rows: 78
- Safari/WebKit browser benchmark rows: 0
- Non-V8 browser benchmark rows: 78

Firefox benchmark rows and exact tested-build TextDecoder source pinning are now present, but Firefox codegen/allocation evidence remains a separate gap. Safari/browser JSC is still not covered by Bun/JSC.

## Findings

- coverage-audit-is-not-runtime-limit-proof (SCOPE_GUARD): Coverage auditing can prove which evidence families are absent or partial, but it cannot prove a JavaScript runtime ceiling.
- non-v8-browser-gap-remains (COVERED): At least one non-V8 browser benchmark row is present.
- corpus-suite-gap-remains (PARTIAL): Current release artifacts cover 2 corpus seed(s), so broad corpus coverage remains unproven.
- open-obligations-ranked (OPEN): 4 proof obligation(s) remain open or partial after scanning current release artifacts.
  - safari-jsc-source-and-browser-rows-open
  - codegen-traces-open
  - allocation-profiles-open
  - independent-corpus-suite-open

## Limits

- This audit only checks evidence coverage in current release artifacts. It does not measure new throughput or memory.
- Source pins without same-runtime benchmark rows are treated as source-only evidence.
- Bun/JSC evidence is not Safari/browser JSC evidence unless the tested browser build and rows are recorded separately.
- Missing evidence is not evidence that optimization is impossible; it is a queue for counterexample search.
