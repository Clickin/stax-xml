# Runtime Proof Coverage Audit

Generated: 2026-06-01T17:40:40.458Z

This audit scans current release artifacts to show which proof obligations are covered, partial, or still open. It is not a new benchmark run and not an impossibility proof.

## Summary

- Scanned primary artifacts: 217
- Ignored derived artifacts: 7
- Measured rows recognized: 1253
- Rows with unknown full-string parity: 0
- Rows with unknown bounded-memory flag: 23
  - Unknown bounded-memory JS rows: 7
  - Unknown bounded-memory full-string rows: 20
  - Unknown bounded-memory 1 GiB+ JS full-string rows: 0
  - Unknown bounded-memory counterexample-relevant rows: 0
  - Unknown bounded-memory small/diagnostic JS rows: 7
  - Unknown bounded-memory non-JS allocator-counter rows: 10
  - Unknown bounded-memory non-JS rows without peak-memory counters: 6
  - Unknown bounded-memory rows with memory counters: 10
- Benchmark artifacts: 155
- Source artifacts: 24
- Trace/profile artifacts: 15
- Allocation artifacts: 16
- Environment artifacts: 4
- Negative-result artifacts: 24
- 1 GiB+ JS full-string rows: 848
- 1 GiB+ JS full-string source-mode rows not using full ArrayBuffer parser input: 474/474
- 1 GiB+ JS full-string separate direct ReadableStream source-overhead rows: 17
- Corpus seeds: 4
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
| `spidermonkey-jsshell-tokenizer-headroom.json` | SpiderMonkey js-shell | `release-spidermonkey-token-boundary` | 0.02 | not-recorded | no | 122.24 |
| `spidermonkey-jsshell-tokenizer-headroom.json` | SpiderMonkey js-shell | `nightly-spidermonkey-token-boundary` | 0.02 | not-recorded | no | 113.81 |
| `spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit.json` | SpiderMonkey js-shell | `taskcluster-debug-spidermonkey-xml-token-boundary-codegen` | 0.00 | not-recorded | no | 0.72 |
| `woodstox-hotspot-trace.json` | Java/Woodstox | `benchmark` | 0.02 | not-recorded | yes | 322.29 |
| `woodstox-jfr-allocation.json` | Java/Woodstox | `benchmark` | 0.02 | not-recorded | yes | 311.86 |
| `woodstox-measured-jfr-allocation-rerun.json` | Java/Woodstox | `benchmark` | 0.02 | not-recorded | yes | 136.56 |
| `woodstox-measured-jfr-allocation.json` | Java/Woodstox | `benchmark` | 0.02 | not-recorded | yes | 182.56 |

## Source Input Safety

This classifies the parser input shape for 1 GiB+ JavaScript full-string rows that expose source-mode metadata. Direct ReadableStream rows remain source-overhead evidence, separate from the primary synchronous byte-batch baseline.

| Source mode | Rows | Not full ArrayBuffer | Full ArrayBuffer | Unknown | Direct ReadableStream | Demand-driven | Fastest row |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `async-iterable-byte-batches` | 15 | 15 | 0 | 0 | 0 | 15 | async-iterable-raw-frame-ascii-batch-8 77.56 MiB/s from stream-source-consumption-backpressure-counters.json |
| `complete-js-string` | 1 | 1 | 0 | 0 | 0 | 0 | 3 41.10 MiB/s from bun-event-reader-string-large.json |
| `fetch-async-iterable-byte-batches` | 2 | 2 | 0 | 0 | 0 | 2 | fetchAsyncByteBatchFull 13.52 MiB/s from browser-candidate-headroom-books-corpus.json |
| `fetch-readable-stream-pull` | 2 | 2 | 0 | 0 | 2 | 2 | fetchReadableStreamFull 14.64 MiB/s from browser-candidate-headroom-books-corpus.json |
| `file-backed-sync-iterable-byte-batches` | 53 | 53 | 0 | 0 | 0 | 53 | stax-raw-frame-name-id-batch-8 152.11 MiB/s from file-backed-batch-size-sweep.json |
| `generated-sync-iterable-byte-batches` | 382 | 382 | 0 | 0 | 0 | 382 | rawFrameNameId 185.50 MiB/s from text-trim-cost-decomposition.json |
| `sync-iterable-byte-batches` | 4 | 4 | 0 | 0 | 0 | 4 | sync-iterable-byte-batches 76.22 MiB/s from stream-source-consumption-shapes.json |
| `web-readable-stream-pull` | 15 | 15 | 0 | 0 | 15 | 15 | web-readable-stream-raw-frame-ascii-batch-8 77.86 MiB/s from stream-source-consumption-shapes.json |

## Runtime Coverage

| Runtime | Artifacts | Measured Rows | 1 GiB+ Full Rows | Fastest 1 GiB+ Full Row | Source Pins | Trace/Profile | Allocation |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| Node/V8 | 111 | 589 | 407 | rawFrameNameId 185.50 MiB/s from text-trim-cost-decomposition.json | 2 | 2 | 5 |
| Bun/JSC | 41 | 319 | 209 | rawFrameNameId 178.52 MiB/s from bun-candidate-headroom-books-corpus-stability.json | 3 | 4 | 2 |
| Deno/V8 | 17 | 128 | 104 | rawFrameNameId 110.54 MiB/s from text-trim-cost-cross-process-books-corpus.json | 1 | 2 | 2 |
| SpiderMonkey js-shell | 6 | 3 | 0 | none | 0 | 4 | 0 |
| Chrome/V8 browser | 15 | 100 | 58 | rawFrameNameId 130.32 MiB/s from browser-candidate-headroom-cross-process-books-corpus.json | 2 | 1 | 1 |
| Firefox/SpiderMonkey browser | 23 | 82 | 70 | rawFrameNameId 76.90 MiB/s from firefox-bidi-candidate-headroom-cross-process-books-corpus.json | 5 | 1 | 1 |
| Safari/WebKit browser | 1 | 0 | 0 | none | 0 | 0 | 0 |
| Java/Woodstox | 12 | 13 | 5 | woodstox 351.56 MiB/s from file-backed-trim-boundary-check-candidate.json | 0 | 1 | 3 |
| Rust/quick-xml | 11 | 19 | 5 | quick-xml 274.63 MiB/s from file-backed-short-attr-value-cache-candidate.json | 0 | 0 | 2 |

## Safari/WebKit Browser Row Status

Safari/WebKit evidence class: environment-availability-only
Safari/WebKit availability closure requirements: met=2, blocked=9
Safari/WebKit direct ReadableStream rows separate: yes
Safari/WebKit rows with measured exact build identity: 0
Safari/WebKit 1 GiB+ bounded primary rows with measured exact build identity: 0
Safari/WebKit primary rows in same-contract comparison: no
Safari/WebKit 1 GiB+ bounded primary rows in same-contract comparison: no
Safari/WebKit obligation closed: no

| Availability artifact | macOS host | Safari executable | safaridriver | Harness support | Runnable here | Browser rows | Full rows | Primary sync rows | Bounded primary rows | 1 GiB+ bounded primary rows | Comparison primary rows | 1 GiB+ comparison primary rows | Exact build identity | Source boundary pinned |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `safari-webkit-availability-audit.json` | no | no | no | yes | no | 0 | 0 | 0 | 0 | 0 | 0 | 0 | no | no |

## SpiderMonkey Diagnostic Surface

Emitted SpiderMonkey IR/codegen evidence artifacts: 0
Raw SpiderMonkey emitted-IR closure claims: 0
SpiderMonkey selected row identity statuses: not-claimed=4, not-claimed-non-stax-diagnostic=7
JIT-status-only SpiderMonkey shell artifacts: 2

| Diagnostic | Artifact | Status | Evidence class | JIT status | IR surface | Bytecode dump | Native dump complete | Current stax benchmark | Selected row identity | Selected row metadata | Comparison match | Closes emitted IR obligation | Closure qualified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `installed-browser-diagnostic-dump` | `firefox-spidermonkey-diagnostic-dump-audit.json` | no-dump-emitted | negative-diagnostic-surface | unknown | unknown | unknown | unknown | unknown | not-claimed | no | unknown | no | no |
| `local-js-shell-discovery` | `firefox-spidermonkey-js-shell-availability-audit.json` | available | availability-only | unknown | unknown | unknown | unknown | unknown | not-claimed | no | unknown | no | no |
| `official-release-jsshell` | `firefox-spidermonkey-release-jsshell-availability-audit.json` | available | jit-status-only | yes | no | no (no-bytecode-output, markers=0) | no | no | not-claimed-non-stax-diagnostic | no | unknown | no | no |
| `official-nightly-jsshell` | `firefox-spidermonkey-nightly-jsshell-availability-audit.json` | available | jit-status-only | yes | no | no (no-bytecode-output, markers=0) | no | no | not-claimed-non-stax-diagnostic | no | unknown | no | no |
| `official-jsshell-stax-api-gap` | `firefox-spidermonkey-jsshell-stax-api-gap-audit.json` | blocked-by-host-api-surface | host-api-surface-gap | yes | unknown | unknown | unknown | no | not-claimed-non-stax-diagnostic | no | unknown | no | no |
| `official-jsshell-diagnostic-flag-sweep` | `spidermonkey-jsshell-diagnostic-flag-sweep.json` | available | diagnostic-flag-sweep-negative | unknown | unknown | no (unknown, markers=unknown) | unknown | unknown | not-claimed | no | unknown | no | no |
| `taskcluster-debug-jsshell-codegen` | `spidermonkey-taskcluster-debug-jsshell-codegen-audit.json` | available | current-debug-codegen-scope-guard | unknown | yes | unknown | yes | no | not-claimed-non-stax-diagnostic | no | unknown | no | no |
| `taskcluster-debug-jsshell-xml-codegen` | `spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit.json` | available | current-debug-xml-codegen-scope-guard | unknown | yes | unknown | yes | no | not-claimed-non-stax-diagnostic | no | unknown | no | no |
| `taskcluster-debug-jsshell-materialized-codegen` | `spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json` | available | current-debug-materialized-codegen-scope-guard | unknown | yes | unknown | yes | no | not-claimed-non-stax-diagnostic | no | unknown | no | no |
| `archival-debug-jsshell-codegen` | `spidermonkey-archival-debug-jsshell-codegen-audit.json` | available | archival-codegen-scope-guard | unknown | yes | unknown | yes | no | not-claimed-non-stax-diagnostic | no | unknown | no | no |
| `installed-buildconfig-source-pin` | `firefox-spidermonkey-buildconfig-source-pin-audit.json` | source-pin | source-pin-only | unknown | unknown | unknown | unknown | unknown | not-claimed | no | unknown | no | no |

## Open Obligations

| Obligation | Status | Evidence | Next experiment |
| --- | --- | --- | --- |
| `firefox-browser-rows-open` | covered | 82 Firefox/SpiderMonkey browser benchmark rows found. | Broaden Firefox coverage with corpus/projection rows plus SpiderMonkey codegen and allocation evidence. |
| `safari-jsc-source-and-browser-rows-open` | open | Bun/JSC and Bun-patched WebKit evidence is present, but no Safari/WebKit browser benchmark row was found. Local Safari/WebKit availability audit is present and records that the current host cannot run Safari rows even though the repository has a safaridriver harness when safaridriver is available. | Run same-contract Safari/WebKit rows on a macOS host through the safaridriver wrapper and cross-process stability runner. |
| `codegen-traces-open` | partial | Node/V8 trace evidence present. Bun/JSC codegen/IR evidence present. Chrome/V8 browser codegen trace evidence present. Deno/V8 codegen trace evidence present (2 artifacts). Firefox/SpiderMonkey Gecko Profiler trace evidence present. Firefox/SpiderMonkey JitSpew/IONFLAGS source gate evidence present, but it is not emitted JIT IR. Firefox/SpiderMonkey installed buildconfig source pin present (buildconfig source pin only; enableJitSpew=false, enableJsShell=true, mozPackageJsShell=true). Firefox/SpiderMonkey diagnostic dump audit was attempted and emitted no JIT diagnostic dump from this installed browser build (status=no-dump-emitted, dumpFiles=0). Firefox/SpiderMonkey local js-shell availability audit present (status=available, found=2, searchRoots=2); no emitted JIT IR is recorded by that audit. Firefox/SpiderMonkey official release js-shell audit present (status=available, packageVerified=true, jitStatus=true, irDumpSurface=false, bytecodeDumpOutput=false, bytecodeDumpStatus=no-bytecode-output, nativeDisassemblySurface=false, nativeDumpComplete=false, canReadBinaryInput=true, canRunCurrentStaxFullStringBenchmark=false); it is JIT-status evidence only, not emitted JIT IR. Firefox/SpiderMonkey official nightly js-shell audit present (status=available, packageVerified=false, jitStatus=true, irDumpSurface=false, bytecodeDumpOutput=false, bytecodeDumpStatus=no-bytecode-output, nativeDisassemblySurface=false, nativeDumpComplete=false, canReadBinaryInput=true, canRunCurrentStaxFullStringBenchmark=false); it is JIT-status evidence only, not emitted JIT IR. Firefox/SpiderMonkey js-shell StAX API gap audit present (status=blocked-by-host-api-surface, unchangedRunnableShells=0/2, blockedSurfaces=5, commonMissingGlobals=TextDecoder, TextEncoder, ReadableStream, fetch); it is host API surface evidence only, not emitted JIT IR. Firefox/SpiderMonkey public js-shell diagnostic flag sweep present (bytecodeProbes=4, bytecodeOutputProbes=0, diagnosticPrefSurface=false); it rules out easy public-shell bytecode/dump flag paths but is not emitted JIT IR. Firefox/SpiderMonkey current Taskcluster debug js-shell codegen audit present (taskId=bzK0wWZvQoOguMjTIbRJ_g, buildId=20260531212007, sourceRevision=71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7, codegenDump=true, sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=false, selectedRowIdentityStatus=not-claimed-non-stax-diagnostic); it proves a current diagnostic shell path but is not emitted codegen for a same-contract StAX row. Firefox/SpiderMonkey current Taskcluster debug js-shell XML workload codegen audit present (taskId=bzK0wWZvQoOguMjTIbRJ_g, buildId=20260531212007, sourceRevision=71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7, codegenDump=true, sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=false, selectedRowIdentityStatus=not-claimed-non-stax-diagnostic); it ties the current diagnostic shell to an XML byte-tokenizer workload but is still not emitted codegen for a same-contract full-string StAX row. Firefox/SpiderMonkey current Taskcluster debug js-shell materialized string/object codegen audit present (taskId=bzK0wWZvQoOguMjTIbRJ_g, buildId=20260531212007, sourceRevision=71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7, codegenDump=true, sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=false, selectedRowIdentityStatus=not-claimed-non-stax-diagnostic); it ties the current diagnostic shell to JS string and event-object materialization but is still not the unchanged full-string StAX benchmark. Firefox/SpiderMonkey ASCII scope-distance audit present (corpusFileCount=3, allCorpusFilesAscii=true, asciiByteToStringEquivalentToUtf8=true, semanticMaterializedWorkload=true, reducesScopeDistance=true, closesCodegenObligation=false); it narrows ASCII materialized js-shell scope but is not unchanged StAX closure evidence. Firefox/SpiderMonkey materialized scope-distance audit present (semanticEquivalentForAsciiFields=true, closureRequirementsMet=2, closureRequirementsBlocked=4, primarySyncByteBatchMissingGlobals=TextDecoder, asciiTextDecoderEquivalent=true, diagnosticThroughputMiBPerSec=0.4909373604499916, throughputCountsAsTargetEvidence=false, closesCodegenObligation=false); it records why the materialized js-shell codegen artifact is useful but still not closure evidence. Firefox/SpiderMonkey emitted JIT IR or optimized-code dump evidence missing. | Capture runtime-specific optimized-code or IR evidence for the fastest full-string rows, especially Firefox/SpiderMonkey and any future Safari/WebKit rows. |
| `allocation-profiles-open` | covered | 16 allocation/profile artifacts found. Bun/JSC allocation evidence present. Non-V8 browser allocation evidence present. | Add Bun/JSC and non-V8 browser allocation or heap-profile artifacts for the same full-string rows. |
| `non-v8-browser-coverage-open` | covered | 82 non-V8 browser benchmark rows found. | Broaden non-V8 browser coverage with Safari/WebKit plus corpus/projection rows and allocation evidence. |
| `independent-corpus-suite-open` | covered | 4 release corpus seed(s) found: books.xml, large.xml, midsize.xml, treebank_e.xml. | Keep new corpus rows flowing through the counterexample scanner before broadening claims. |
| `counterexample-rule-present` | covered | runtime-counterexample-scan.md is a required gate artifact and preserves the bounded full-string 200 MiB/s counterexample rule. | Keep new rows flowing through the counterexample scanner before broadening claims. |

## Corpus Coverage

Current release corpus seeds: `books.xml`, `large.xml`, `midsize.xml`, `treebank_e.xml`.

## Browser Coverage

- Chrome/V8 browser benchmark rows: 100
- Firefox/SpiderMonkey browser benchmark rows: 82
- Safari/WebKit browser benchmark rows: 0
- Non-V8 browser benchmark rows: 82

Firefox benchmark rows and exact tested-build JS string, TextDecoder, and page memory API source pins are now present, but Firefox codegen/allocation evidence remains a separate gap. Safari/browser JSC is still not covered by Bun/JSC.

## Findings

- coverage-audit-is-not-runtime-limit-proof (SCOPE_GUARD): Coverage auditing can prove which evidence families are absent or partial, but it cannot prove a JavaScript runtime ceiling.
- non-v8-browser-gap-remains (COVERED): At least one non-V8 browser benchmark row is present.
- corpus-suite-gap-remains (COVERED): Current release artifacts cover 4 corpus seed(s), so broad corpus coverage remains unproven.
- open-obligations-ranked (OPEN): 2 proof obligation(s) remain open or partial after scanning current release artifacts.
  - safari-jsc-source-and-browser-rows-open
  - codegen-traces-open

## Limits

- This audit only checks evidence coverage in current release artifacts. It does not measure new throughput or memory.
- Source pins without same-runtime benchmark rows are treated as source-only evidence.
- Bun/JSC evidence is not Safari/browser JSC evidence unless the tested browser build and rows are recorded separately.
- Missing evidence is not evidence that optimization is impossible; it is a queue for counterexample search.
