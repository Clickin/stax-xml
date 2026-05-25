# Runtime Proof Coverage Audit

Generated: 2026-05-25T01:52:44.514Z

This audit scans current release artifacts to show which proof obligations are covered, partial, or still open. It is not a new benchmark run and not an impossibility proof.

## Summary

- Scanned primary artifacts: 118
- Ignored derived artifacts: 5
- Measured rows recognized: 678
- Benchmark artifacts: 84
- Source artifacts: 15
- Trace/profile artifacts: 8
- Allocation artifacts: 13
- Environment artifacts: 2
- Negative-result artifacts: 5
- 1 GiB+ JS full-string rows: 419
- Corpus seeds: 3
- Open or partial obligations: 2

## Runtime Coverage

| Runtime | Artifacts | Measured Rows | 1 GiB+ Full Rows | Fastest 1 GiB+ Full Row | Source Pins | Trace/Profile | Allocation |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| Node/V8 | 44 | 215 | 135 | rawFrameNameId 180.08 MiB/s from candidate-headroom-cross-process-books-corpus.json | 2 | 2 | 5 |
| Bun/JSC | 26 | 181 | 114 | rawFrameNameId 178.52 MiB/s from bun-candidate-headroom-books-corpus-stability.json | 3 | 2 | 2 |
| Deno/V8 | 9 | 50 | 44 | shortAsciiSubarraySharedDecoder 90.83 MiB/s from deno-textdecoder-span-variants-corpus.json | 1 | 1 | 1 |
| Chrome/V8 browser | 15 | 98 | 56 | rawFrameNameId 130.32 MiB/s from browser-candidate-headroom-cross-process-books-corpus.json | 2 | 1 | 1 |
| Firefox/SpiderMonkey browser | 19 | 82 | 70 | rawFrameNameId 76.90 MiB/s from firefox-bidi-candidate-headroom-cross-process-books-corpus.json | 4 | 1 | 1 |
| Safari/WebKit browser | 1 | 0 | 0 | none | 0 | 0 | 0 |
| Java/Woodstox | 7 | 4 | 1 | woodstox 324.53 MiB/s from external-baseline-1024mib-file-sync-batches.json | 0 | 1 | 2 |
| Rust/quick-xml | 5 | 4 | 1 | quick-xml 290.92 MiB/s from external-baseline-1024mib-file-sync-batches.json | 0 | 0 | 1 |
| unknown | 11 | 44 | 0 | none | 0 | 1 | 3 |

## Open Obligations

| Obligation | Status | Evidence | Next experiment |
| --- | --- | --- | --- |
| `firefox-browser-rows-open` | covered | 82 Firefox/SpiderMonkey browser benchmark rows found. | Broaden Firefox coverage with corpus/projection rows plus SpiderMonkey codegen and allocation evidence. |
| `safari-jsc-source-and-browser-rows-open` | open | Bun/JSC and Bun-patched WebKit evidence is present, but no Safari/WebKit browser benchmark row was found. Local Safari/WebKit availability audit is present and records that the current host/harness cannot run Safari rows. | Run same-contract Safari/WebKit rows on a macOS host through the safaridriver wrapper and cross-process stability runner. |
| `codegen-traces-open` | partial | Node/V8 trace evidence present. Bun/JSC codegen/IR evidence present. Chrome/V8 browser codegen trace evidence present. Firefox/SpiderMonkey Gecko Profiler trace evidence present. Firefox/SpiderMonkey JitSpew/IONFLAGS source gate evidence present, but it is not emitted JIT IR. Firefox/SpiderMonkey diagnostic dump audit was attempted and emitted no JIT diagnostic dump from this installed browser build. Firefox/SpiderMonkey local js-shell availability audit present; no emitted JIT IR is recorded by that audit. Firefox/SpiderMonkey JIT IR or optimized-code dump missing. | Capture runtime-specific optimized-code or IR evidence for the fastest full-string rows, especially Firefox/SpiderMonkey and any future Safari/WebKit rows. |
| `allocation-profiles-open` | covered | 13 allocation/profile artifacts found. Bun/JSC allocation evidence present. Non-V8 browser allocation evidence present. | Add Bun/JSC and non-V8 browser allocation or heap-profile artifacts for the same full-string rows. |
| `non-v8-browser-coverage-open` | covered | 82 non-V8 browser benchmark rows found. | Broaden non-V8 browser coverage with Safari/WebKit plus corpus/projection rows and allocation evidence. |
| `independent-corpus-suite-open` | covered | 3 release corpus seed(s) found: books.xml, large.xml, treebank_e.xml. | Keep new corpus rows flowing through the counterexample scanner before broadening claims. |
| `counterexample-rule-present` | covered | runtime-counterexample-scan.md is a required gate artifact and preserves the bounded full-string 200 MiB/s counterexample rule. | Keep new rows flowing through the counterexample scanner before broadening claims. |

## Corpus Coverage

Current release corpus seeds: `books.xml`, `large.xml`, `treebank_e.xml`.

## Browser Coverage

- Chrome/V8 browser benchmark rows: 98
- Firefox/SpiderMonkey browser benchmark rows: 82
- Safari/WebKit browser benchmark rows: 0
- Non-V8 browser benchmark rows: 82

Firefox benchmark rows and exact tested-build JS string, TextDecoder, and page memory API source pins are now present, but Firefox codegen/allocation evidence remains a separate gap. Safari/browser JSC is still not covered by Bun/JSC.

## Findings

- coverage-audit-is-not-runtime-limit-proof (SCOPE_GUARD): Coverage auditing can prove which evidence families are absent or partial, but it cannot prove a JavaScript runtime ceiling.
- non-v8-browser-gap-remains (COVERED): At least one non-V8 browser benchmark row is present.
- corpus-suite-gap-remains (COVERED): Current release artifacts cover 3 corpus seed(s), so broad corpus coverage remains unproven.
- open-obligations-ranked (OPEN): 2 proof obligation(s) remain open or partial after scanning current release artifacts.
  - safari-jsc-source-and-browser-rows-open
  - codegen-traces-open

## Limits

- This audit only checks evidence coverage in current release artifacts. It does not measure new throughput or memory.
- Source pins without same-runtime benchmark rows are treated as source-only evidence.
- Bun/JSC evidence is not Safari/browser JSC evidence unless the tested browser build and rows are recorded separately.
- Missing evidence is not evidence that optimization is impossible; it is a queue for counterexample search.
