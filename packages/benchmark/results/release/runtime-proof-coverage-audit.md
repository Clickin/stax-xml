# Runtime Proof Coverage Audit

Generated: 2026-05-26T16:02:01.681Z

This audit scans current release artifacts to show which proof obligations are covered, partial, or still open. It is not a new benchmark run and not an impossibility proof.

## Summary

- Scanned primary artifacts: 172
- Ignored derived artifacts: 5
- Measured rows recognized: 895
- Rows with unknown full-string parity: 0
- Rows with unknown bounded-memory flag: 20
  - Unknown bounded-memory JS rows: 4
  - Unknown bounded-memory full-string rows: 20
  - Unknown bounded-memory 1 GiB+ JS full-string rows: 0
  - Unknown bounded-memory counterexample-relevant rows: 0
  - Unknown bounded-memory small/diagnostic JS rows: 4
  - Unknown bounded-memory non-JS allocator-counter rows: 10
  - Unknown bounded-memory non-JS rows without peak-memory counters: 6
  - Unknown bounded-memory rows with memory counters: 10
- Benchmark artifacts: 126
- Source artifacts: 17
- Trace/profile artifacts: 10
- Allocation artifacts: 15
- Environment artifacts: 2
- Negative-result artifacts: 16
- 1 GiB+ JS full-string rows: 560
- Corpus seeds: 3
- Open or partial obligations: 2

## Unknown Bounded-Memory Rows

These rows have enough throughput/parity metadata to be recognized, but no row-level memory counter or bounded-memory flag. They are listed so remaining unknowns are auditable rather than only counted. The counterexample-relevant subset is 1 GiB+ JavaScript full-string rows, and is summarized separately above.

| Artifact | Runtime | Row | Size GiB | Memory | Full string | MiB/s |
| --- | --- | --- | ---: | --- | --- | ---: |
| `browser-v8-codegen-trace.json` | Chrome/V8 browser | `stringFull` | 0.00 | not-recorded | yes | 49.46 |
| `browser-v8-codegen-trace.json` | Chrome/V8 browser | `rawFrameNameId` | 0.00 | not-recorded | yes | 28.68 |
| `browser-v8-codegen-trace.json` | Chrome/V8 browser | `eventObjectFull` | 0.00 | not-recorded | yes | 41.47 |
| `firefox-spidermonkey-diagnostic-dump-audit.json` | Firefox/SpiderMonkey browser | `rawFrameNameId` | n/a | not-recorded | yes | 24.32 |
| `quick-xml-allocation-count-stability.json` | Rust/quick-xml | `benchmark` | 0.02 | allocator-counters | yes | 220.90 |
| `quick-xml-allocation-count-stability.json` | Rust/quick-xml | `benchmark` | 0.00 | allocator-counters | yes | 183.58 |
| `quick-xml-allocation-count-stability.json` | Rust/quick-xml | `benchmark` | 0.00 | allocator-counters | yes | 259.32 |
| `quick-xml-allocation-count-stability.json` | Rust/quick-xml | `benchmark` | 0.00 | allocator-counters | yes | 303.17 |
| `quick-xml-allocation-count-stability.json` | Rust/quick-xml | `benchmark` | 0.00 | allocator-counters | yes | 205.74 |
| `quick-xml-allocation-count.json` | Rust/quick-xml | `benchmark` | 0.02 | allocator-counters | yes | 257.43 |
| `quick-xml-allocation-count.json` | Rust/quick-xml | `benchmark` | 0.00 | allocator-counters | yes | 183.37 |
| `quick-xml-allocation-count.json` | Rust/quick-xml | `benchmark` | 0.00 | allocator-counters | yes | 227.89 |
| `quick-xml-allocation-count.json` | Rust/quick-xml | `benchmark` | 0.00 | allocator-counters | yes | 316.77 |
| `quick-xml-allocation-count.json` | Rust/quick-xml | `benchmark` | 0.00 | allocator-counters | yes | 205.15 |
| `quick-xml-shape-audit.json` | Rust/quick-xml | `quick-xml` | 0.02 | not-recorded | yes | 309.82 |
| `quick-xml-shape-audit.json` | Java/Woodstox | `woodstox` | 0.02 | not-recorded | yes | 333.43 |
| `woodstox-hotspot-trace.json` | Java/Woodstox | `benchmark` | 0.02 | not-recorded | yes | 322.29 |
| `woodstox-jfr-allocation.json` | Java/Woodstox | `benchmark` | 0.02 | not-recorded | yes | 311.86 |
| `woodstox-measured-jfr-allocation-rerun.json` | Java/Woodstox | `benchmark` | 0.02 | not-recorded | yes | 136.56 |
| `woodstox-measured-jfr-allocation.json` | Java/Woodstox | `benchmark` | 0.02 | not-recorded | yes | 182.56 |

## Runtime Coverage

| Runtime | Artifacts | Measured Rows | 1 GiB+ Full Rows | Fastest 1 GiB+ Full Row | Source Pins | Trace/Profile | Allocation |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| Node/V8 | 86 | 403 | 250 | rawFrameNameId 185.50 MiB/s from text-trim-cost-decomposition.json | 2 | 2 | 5 |
| Bun/JSC | 33 | 232 | 140 | rawFrameNameId 179.70 MiB/s from access-shape-candidate-cross-process.json | 3 | 4 | 2 |
| Deno/V8 | 9 | 50 | 44 | shortAsciiSubarraySharedDecoder 90.83 MiB/s from deno-textdecoder-span-variants-corpus.json | 1 | 1 | 1 |
| Chrome/V8 browser | 15 | 98 | 56 | rawFrameNameId 130.32 MiB/s from browser-candidate-headroom-cross-process-books-corpus.json | 2 | 1 | 1 |
| Firefox/SpiderMonkey browser | 19 | 82 | 70 | rawFrameNameId 76.90 MiB/s from firefox-bidi-candidate-headroom-cross-process-books-corpus.json | 4 | 1 | 1 |
| Safari/WebKit browser | 1 | 0 | 0 | none | 0 | 0 | 0 |
| Java/Woodstox | 11 | 12 | 4 | woodstox 351.56 MiB/s from file-backed-trim-boundary-check-candidate.json | 0 | 1 | 3 |
| Rust/quick-xml | 10 | 18 | 4 | quick-xml 274.63 MiB/s from file-backed-short-attr-value-cache-candidate.json | 0 | 0 | 2 |

## Open Obligations

| Obligation | Status | Evidence | Next experiment |
| --- | --- | --- | --- |
| `firefox-browser-rows-open` | covered | 82 Firefox/SpiderMonkey browser benchmark rows found. | Broaden Firefox coverage with corpus/projection rows plus SpiderMonkey codegen and allocation evidence. |
| `safari-jsc-source-and-browser-rows-open` | open | Bun/JSC and Bun-patched WebKit evidence is present, but no Safari/WebKit browser benchmark row was found. Local Safari/WebKit availability audit is present and records that the current host cannot run Safari rows even though the repository has a safaridriver harness when safaridriver is available. | Run same-contract Safari/WebKit rows on a macOS host through the safaridriver wrapper and cross-process stability runner. |
| `codegen-traces-open` | partial | Node/V8 trace evidence present. Bun/JSC codegen/IR evidence present. Chrome/V8 browser codegen trace evidence present. Firefox/SpiderMonkey Gecko Profiler trace evidence present. Firefox/SpiderMonkey JitSpew/IONFLAGS source gate evidence present, but it is not emitted JIT IR. Firefox/SpiderMonkey diagnostic dump audit was attempted and emitted no JIT diagnostic dump from this installed browser build (status=no-dump-emitted, dumpFiles=0). Firefox/SpiderMonkey local js-shell availability audit present (status=not-found, found=0); no emitted JIT IR is recorded by that audit. Firefox/SpiderMonkey JIT IR or optimized-code dump missing. | Capture runtime-specific optimized-code or IR evidence for the fastest full-string rows, especially Firefox/SpiderMonkey and any future Safari/WebKit rows. |
| `allocation-profiles-open` | covered | 15 allocation/profile artifacts found. Bun/JSC allocation evidence present. Non-V8 browser allocation evidence present. | Add Bun/JSC and non-V8 browser allocation or heap-profile artifacts for the same full-string rows. |
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
