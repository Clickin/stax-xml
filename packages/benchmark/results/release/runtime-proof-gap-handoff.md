# Runtime Proof Gap Handoff

Generated: 2026-06-02T20:28:13.177Z

Turns current open or partial runtime proof obligations into concrete external-run handoffs. This is not benchmark evidence, not emitted JIT IR, not Safari/WebKit throughput evidence, and not a runtime-limit conclusion.

## Audit Input

- Audit JSON: G:\programming\stax-xml\packages\benchmark\results\release\runtime-proof-coverage-audit.json
- Audit generated: 2026-06-02T20:28:02.070Z
- Comparison JSON: G:\programming\stax-xml\packages\benchmark\results\release\same-contract-runtime-comparison.json
- Comparison generated: 2026-06-02T20:08:45.362Z
- Active obligations: 2

## Summary

- Handoffs: 2
- Unhandled obligations: 0
- External-run required closures: 2
- Locally runnable closures: 0
- Audit artifacts: 226
- Audit measured rows: 1266
- Primary source consumption: synchronous Iterable<Uint8Array[]> byte batches
- Direct ReadableStream scope: separate source-overhead evidence only
- Direct ReadableStream backpressure required: yes
- Source consumption evidence status: classified
- Memory frontier evidence status: classified
- External target evidence status: classified
- Text materialization evidence status: classified
- Runtime-limit conclusion allowed: no
- Conclusion blocker: Open or partial obligations still require external runtime evidence before any runtime-limit conclusion.

## Source Consumption Evidence

- Status: classified
- Source artifact: same-contract-runtime-comparison.json
- Aggregate rows: 289
- Source modes: fetch-async-iterable-byte-batches, fetch-readable-stream-pull, file-backed-sync-iterable-byte-batches, sync-iterable-byte-batches
- 1 GiB+ JS full-string source-mode rows not using full ArrayBuffer parser input: 233/233
- Full ArrayBuffer parser-input rows: 0
- Unknown parser-input rows: 0
- Corpus seed replay rows: 150
- File-backed sync Iterable<Uint8Array[]> rows: 36
- Separate direct ReadableStream source-overhead rows: 1
- Primary source contract: primary-sync-iterable-byte-batches
- Primary parser input: synchronous Iterable<Uint8Array[]>
- Primary source boundary: demand-driven StreamReaderSync parser pulls
- Primary ArrayBuffer parser input: full-target ArrayBuffer parser input is excluded; corpus rows may replay smaller seed buffers as byte batches.
- Primary backpressure contract: Primary sync rows yield one grouped Uint8Array[] batch per parser pull; async and direct ReadableStream rows must stay separate and record backpressure counters.
- Primary sync byte-batch rows: 231; excluded rows: 8
- Primary source modes: file-backed-sync-iterable-byte-batches, sync-iterable-byte-batches
- Primary excluded direct/async/full-ArrayBuffer/unknown rows: 0/0/0/0
- Fastest primary source row: Node/V8 rawFrameNameId 185.50 MiB/s (process-rss max 60.45 MiB)

| Primary exclusion reason | Rows | Fastest excluded row |
| --- | ---: | --- |
| `async-source-boundary` | 1 | Chrome/V8 browser `fetchAsyncByteBatchFull` 9.77 MiB/s from `browser-fetch-readable-stream-books-corpus.json` |
| `direct-readable-stream` | 1 | Chrome/V8 browser `fetchReadableStreamFull` 9.68 MiB/s from `browser-fetch-readable-stream-books-corpus.json` |
| `unknown-source-mode` | 6 | Node/V8 `shortAsciiSubarraySharedDecoder` 51.60 MiB/s from `textdecoder-span-variants.json` |

| Source mode | Rows | Not full ArrayBuffer | Direct ReadableStream | Corpus seed replay | Fastest row |
| --- | ---: | ---: | ---: | ---: | --- |
| fetch-async-iterable-byte-batches | 1 | 1 | 0 | 1 | Chrome/V8 browser fetchAsyncByteBatchFull 9.77 MiB/s from browser-fetch-readable-stream-books-corpus.json |
| fetch-readable-stream-pull | 1 | 1 | 1 | 1 | Chrome/V8 browser fetchReadableStreamFull 9.68 MiB/s from browser-fetch-readable-stream-books-corpus.json |
| file-backed-sync-iterable-byte-batches | 36 | 36 | 0 | 0 | Node/V8 stax-raw-frame-name-id-batch-8 152.11 MiB/s from file-backed-batch-size-sweep.json |
| sync-iterable-byte-batches | 195 | 195 | 0 | 148 | Node/V8 rawFrameNameId 185.50 MiB/s from text-trim-cost-decomposition.json |
- Node source frontier: sync-iterable-byte-batches-batch-8 71.96 MiB/s vs web-readable-stream-raw-frame-ascii-batch-8 76.53 MiB/s (1.06x); backpressure 6/6; fullArrayBufferRows=0
- Browser live fetch frontier: fetchReadableStreamFull 9.68 MiB/s; fetchAsyncByteBatchFull 9.77 MiB/s; backpressure 2/2; fullArrayBufferRows=0

## Memory Frontier Evidence

- Status: classified
- Source artifact: same-contract-runtime-comparison.json
- Contract: 1gib-plus-js-full-string-memory-frontier
- 1 GiB+ JS full-string memory rows: 239
- Bounded rows: 222
- Unbounded or unproven rows: 17
- Unbounded or unproven rows at or above 200 MiB/s: 0
- Memory kinds: browser-js-heap, browser-js-heap-unavailable, process-rss
- Fastest bounded row: Node/V8 rawFrameNameId 185.50 MiB/s (process-rss max 60.45 MiB)
- Fastest unbounded or unproven row: Bun/JSC stringFull 99.71 MiB/s (process-rss max 1956.69 MiB)
- Fastest process RSS row under 128 MiB: Node/V8 rawFrameNameId 185.50 MiB/s (process-rss max 60.45 MiB)
- Fastest browser JS heap row: Chrome/V8 browser rawFrameNameId 69.90 MiB/s (browser-js-heap max 39.55 MiB)

| Memory kind | Rows | Bounded | Unbounded/unproven | Max recorded | Fastest row | Fastest bounded row |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| browser-js-heap | 20 | 20 | 0 | 358.37 MiB | Chrome/V8 browser rawFrameNameId 69.90 MiB/s (browser-js-heap max 39.55 MiB) | Chrome/V8 browser rawFrameNameId 69.90 MiB/s (browser-js-heap max 39.55 MiB) |
| browser-js-heap-unavailable | 9 | 0 | 9 | n/a MiB | Firefox/SpiderMonkey browser rawFrameNameId 64.24 MiB/s (browser-js-heap-unavailable) | none |
| process-rss | 210 | 202 | 8 | 1956.69 MiB | Node/V8 rawFrameNameId 185.50 MiB/s (process-rss max 60.45 MiB) | Node/V8 rawFrameNameId 185.50 MiB/s (process-rss max 60.45 MiB) |

- Interpretation: Memory is classified on the same 1 GiB+ JavaScript full-string row set used for counterexample scanning; process RSS, browser JS heap, and browser host-probe-only rows are not normalized into one allocation model.

## External Target Evidence

- Status: classified
- Source artifact: same-contract-runtime-comparison.json
- Contract: woodstox-and-quickxml-0.9x-target-distance
- Fastest aggregated JS full row: Node/V8 rawFrameNameId 185.50 MiB/s (process-rss max 60.45 MiB)
- Fastest primary sync byte-batch JS full row: Node/V8 rawFrameNameId 185.50 MiB/s (process-rss max 60.45 MiB)
- Fastest JS full row vs 200 MiB/s: 0.93x, 14.50 MiB/s remaining
- Fastest primary JS full row vs 200 MiB/s: 0.93x, 14.50 MiB/s remaining
- Fastest JS full row vs 1024 MiB Woodstox reference: 0.55x, 118.67 MiB/s below 0.9x target
- Same-fixture Woodstox target: stax-raw-frame-name-id-batch-8 152.11 MiB/s vs Woodstox 351.56 MiB/s; 0.9x target 316.40 MiB/s; remaining 164.29 MiB/s; targetMet=no
- Same-fixture quick-xml target: stax-raw-frame-name-id-batch-8 152.11 MiB/s vs quick-xml 274.63 MiB/s; 0.9x target 247.17 MiB/s; remaining 95.06 MiB/s; targetMet=no
- Same-fixture fastest JS source/memory contract: Node/V8 stax-raw-frame-name-id-batch-8 152.11 MiB/s (process-rss max 61.77 MiB); sourceMode=file-backed-sync-iterable-byte-batches; directReadableStream=no; fullArrayBufferParserInput=no; boundedMemory=yes
- 1024 MiB external baseline: stax-stream 124.62 MiB/s (0.37x Woodstox); rawFrameNameId 132.54 MiB/s (0.39x Woodstox); Woodstox 337.97 MiB/s; quick-xml 270.26 MiB/s (0.80x Woodstox)
- Same-fixture process RSS: JS 61.77 MiB; Woodstox 312.71 MiB; quick-xml 4.78 MiB
- Process RSS caveat: Process RSS values are same-fixture endpoint evidence, not allocation-model equivalence across Java, Rust, and JavaScript runtimes.
- Interpretation: Woodstox and quick-xml remain same-checksum semantic comparators, not same object-shape comparators; the 0.9x target is evaluated separately from the 200 MiB/s counterexample threshold.

## Text Materialization Evidence

- Status: classified
- Source artifact: same-contract-runtime-comparison.json
- Frontier artifact: text-materialization-frontier.json
- Contract: text-materialization-frontier-counterexample-boundary
- Target: 200.00 MiB/s
- Fastest full-string row: rawFrameNameId from text-trim-cost-decomposition.json at 185.50 MiB/s (fullStringParity=yes, boundedMemory=yes)
- Fastest without text/CDATA strings row: withoutTextStrings from text-trim-cost-decomposition-4gib.json at 252.36 MiB/s (fullStringParity=no, boundedMemory=yes)
- Fastest no-trim row: rawFrameNameIdNoTrim from text-trim-cost-decomposition-8gib.json at 186.97 MiB/s (fullStringParity=no, boundedMemory=yes)
- Fastest fold-trim row: rawFrameNameIdFoldTrim from text-trim-cost-decomposition-2gib.json at 148.58 MiB/s (fullStringParity=yes, boundedMemory=yes)
- Fastest full row target distance: 0.93x target, 14.50 MiB/s remaining, 1.08x speedup required
- Without-text to full ratio: 1.36x
- No-trim to full ratio: 1.01x
- Fold-trim to full ratio: 0.80x
- Rows crossing target: full=0, withoutText=4, noTrim=0, foldTrim=0
- Negative candidate count: 38
- Interpretation: Text/CDATA omission crosses the target as headroom evidence, while trim-only, fold-trim, cache, and ASCII candidates remain negative for the current full-string contract.

## Active Obligations

- safari-jsc-source-and-browser-rows-open (open): Bun/JSC and Bun-patched WebKit evidence is present, but no Safari/WebKit browser benchmark row was found. Local Safari/WebKit availability audit is present and records that the current host cannot run Safari rows even though the repository has a safaridriver harness when safaridriver is available.
  - Next: Run same-contract Safari/WebKit rows on a macOS host through the safaridriver wrapper and cross-process stability runner.
- codegen-traces-open (partial): Node/V8 trace evidence present. Bun/JSC codegen/IR evidence present. Chrome/V8 browser codegen trace evidence present. Deno/V8 codegen trace evidence present (2 artifacts). Firefox/SpiderMonkey Gecko Profiler trace evidence present. Firefox/SpiderMonkey JitSpew/IONFLAGS source gate evidence present, but it is not emitted JIT IR. Firefox/SpiderMonkey installed buildconfig source pin present (buildconfig source pin only; enableJitSpew=false, enableJsShell=true, mozPackageJsShell=true). Firefox/SpiderMonkey diagnostic dump audit was attempted and emitted no JIT diagnostic dump from this installed browser build (status=no-dump-emitted, dumpFiles=0). Firefox/SpiderMonkey local js-shell availability audit present (status=available, found=2, searchRoots=2); no emitted JIT IR is recorded by that audit. Firefox/SpiderMonkey official release js-shell audit present (status=available, packageVerified=true, jitStatus=true, irDumpSurface=false, bytecodeDumpOutput=true, bytecodeDumpStatus=bytecode-output-emitted, nativeDisassemblySurface=false, nativeDumpComplete=false, canReadBinaryInput=true, canRunCurrentStaxFullStringBenchmark=false); it is bytecode/JIT-status diagnostic evidence only, not emitted JIT IR. Firefox/SpiderMonkey official nightly js-shell audit present (status=available, packageVerified=false, jitStatus=true, irDumpSurface=false, bytecodeDumpOutput=true, bytecodeDumpStatus=bytecode-output-emitted, nativeDisassemblySurface=false, nativeDumpComplete=false, canReadBinaryInput=true, canRunCurrentStaxFullStringBenchmark=false); it is bytecode/JIT-status diagnostic evidence only, not emitted JIT IR. Current StAX public reader host API boundary audit present (primarySyncByteBatchRequiresTextDecoder=true, directReadableStreamRequiresReadableStream=true, stringInputRequiresTextEncoder=true, alternateDecoderWouldBeUnchangedClosure=false); it pins why a js-shell alternate decoder or polyfill is not unchanged StAX public-reader closure evidence. Firefox/SpiderMonkey js-shell StAX API gap audit present (status=blocked-by-host-api-surface, unchangedRunnableShells=0/2, blockedSurfaces=5, commonMissingGlobals=TextDecoder, TextEncoder, ReadableStream, fetch); it is host API surface evidence only, not emitted JIT IR. Firefox/SpiderMonkey public js-shell diagnostic flag sweep present (bytecodeProbes=4, bytecodeOutputProbes=0, diagnosticPrefSurface=false); it rules out easy public-shell bytecode/dump flag paths but is not emitted JIT IR. Firefox/SpiderMonkey current Taskcluster debug js-shell codegen audit present (taskId=aJLr1DFjQ7urQTpRiIsfRQ, buildId=20260602093330, sourceRevision=253b8523586577438a3ddf86d67436719feaf6d8, codegenDump=true, sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=false, selectedRowIdentityStatus=not-claimed-non-stax-diagnostic); it proves a current diagnostic shell path but is not emitted codegen for a same-contract StAX row. Firefox/SpiderMonkey current Taskcluster debug js-shell XML workload codegen audit present (taskId=aJLr1DFjQ7urQTpRiIsfRQ, buildId=20260602093330, sourceRevision=253b8523586577438a3ddf86d67436719feaf6d8, codegenDump=true, sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=false, selectedRowIdentityStatus=not-claimed-non-stax-diagnostic); it ties the current diagnostic shell to an XML byte-tokenizer workload but is still not emitted codegen for a same-contract full-string StAX row. Firefox/SpiderMonkey current Taskcluster debug js-shell materialized string/object codegen audit present (taskId=aJLr1DFjQ7urQTpRiIsfRQ, buildId=20260602093330, sourceRevision=253b8523586577438a3ddf86d67436719feaf6d8, codegenDump=true, sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=false, selectedRowIdentityStatus=not-claimed-non-stax-diagnostic); it ties the current diagnostic shell to JS string and event-object materialization but is still not the unchanged full-string StAX benchmark. Firefox/SpiderMonkey codegen rerun stability audit present (pairs=2, reproduciblePairs=2, sameTaskclusterBuildPairs=2, sameCodegenMarkerPairs=2, qualifiedClosureCount=0, throughputCountsAsTargetEvidence=false); it proves diagnostic rerun reproducibility but still not same-contract StAX closure. Firefox/SpiderMonkey ASCII scope-distance audit present (corpusFileCount=3, allCorpusFilesAscii=true, asciiByteToStringEquivalentToUtf8=true, semanticMaterializedWorkload=true, reducesScopeDistance=true, closesCodegenObligation=false); it narrows ASCII materialized js-shell scope but is not unchanged StAX closure evidence. Firefox/SpiderMonkey materialized scope-distance audit present (semanticEquivalentForAsciiFields=true, closureRequirementsMet=2, closureRequirementsBlocked=4, primarySyncByteBatchMissingGlobals=TextDecoder, asciiTextDecoderEquivalent=true, diagnosticThroughputMiBPerSec=0.32216048877786657, throughputCountsAsTargetEvidence=false, closesCodegenObligation=false); it records why the materialized js-shell codegen artifact is useful but still not closure evidence. Firefox/SpiderMonkey emitted JIT IR or optimized-code dump evidence missing.
  - Next: Capture runtime-specific optimized-code or IR evidence for the fastest full-string rows, especially Firefox/SpiderMonkey and any future Safari/WebKit rows.

## Handoffs

### safari-webkit-browser-row-handoff

- Classification: EXTERNAL_RUN_REQUIRED
- Obligations: safari-jsc-source-and-browser-rows-open
- Proof goal: Produce same-contract Safari/WebKit browser rows separate from Bun/JSC, then rerun the coverage audit and counterexample scan.
- Local closure status: external-run-required
- Locally runnable now: no
- Local closure scope: This is environment availability evidence only; it is not a Safari/WebKit benchmark row or runtime limitation.
- Local blockers:
  - Current host cannot run Safari/WebKit browser rows through the normal Safari/safaridriver path (hostPlatform=win32-x64, safariExecutableFound=false, safaridriverFound=false, currentHarnessSupportsSafari=true, canRunSafariBrowserRows=false).
  - No Safari/WebKit benchmark row is recorded by the availability audit.
  - No exact Safari/WebKit source-boundary pin is recorded by the availability audit.
  - Safari closure matrix reports closureRequirementsMet=2, closureRequirementsBlocked=9, closesSafariObligation=false.
  - The Safari/WebKit closure audit checks candidateRows=0, comparisonGeneratedAt=2026-06-02T20:08:45.362Z, comparisonRowCount=289, largeBoundedPrimaryRows=0, rowsInSameContractComparison=0, measuredExactBuildIdentityRows=0, rowLevelSourceBoundaryPinnedRows=0, sourceBoundaryPinned=false, qualifiedClosureCount=0, and conclusionAllowed=false.
- Local evidence artifacts: safari-webkit-availability-audit.json, safari-webkit-closure-audit.json

Prerequisites:
- macOS host with the exact Safari/WebKit build under test.
- Safari WebDriver enabled and safaridriver available, normally /usr/bin/safaridriver.
- Repository checkout with benchmark dependencies installed and stax-xml build artifacts available.
- Use the same full-string checksum rows: stringFull, eventObjectFull, and rawFrameNameId before broadening cases.

Source consumption contract:
- primaryParserInput: Prepared full rows must consume StreamReaderSync over a synchronous Iterable<Uint8Array[]> generated by byteBatches(fixture).
- demandDrivenSource: byteBatches(fixture) must yield one grouped Uint8Array[] batch per parser pull; the benchmark must not pass one full XML ArrayBuffer or full XML string as parser input.
- directReadableStreamScope: Direct Response.body ReadableStream rows are source-overhead evidence only and must be reported as separate fetchReadableStreamFull or fetchAsyncByteBatchFull rows, not merged into the primary Safari/WebKit full-row target.
- backpressureRequirement: Any direct ReadableStream row must read from the source only from pull() or reader.read() demand and must record that backpressure is respected.

Source boundary contract:
- browserBuildIdentity: Record the exact Safari version, WebKit build/source revision when available, platform, and safaridriver version used for the row.
- stringBoundary: Pin Safari/WebKit string creation and ownership source lines for the exact tested build and attach the source revision/artifact metadata to the measured row, or explicitly mark the source-boundary obligation as still open.
- textDecoderBoundary: Pin Safari/WebKit TextDecoder/UTF-8 decode source lines for the exact tested build and attach the source revision/artifact metadata to the measured row before citing TextDecoder internals for Safari rows.
- bunWebKitScopeGuard: Bun/JSC and Bun-patched WebKit source pins are not Safari browser JSC source pins unless the tested Safari/WebKit build identity matches and is recorded.

Commands:
- safari-availability-audit: Record whether the host can run Safari/WebKit rows.
  - `node packages/benchmark/safari-webkit-availability-audit.mjs --json-out packages/benchmark/results/release/safari-webkit-availability-audit.json --md-out packages/benchmark/results/release/safari-webkit-availability-audit.md`
- safari-smoke: Prove the safaridriver harness can launch the target browser and preserve checksum parity on a small row.
  - `node packages/benchmark/safari-webdriver-candidate-headroom.mjs --driver-executable /usr/bin/safaridriver --size-gib 0.001 --fixture-shape diverse-cycle --diverse-cycle-size 64 --cases stringFull,eventObjectFull,rawFrameNameId --json-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-smoke.json --md-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-smoke.md`
- safari-books-corpus-cross-process: Generate the first 1 GiB same-contract Safari/WebKit corpus stability row set.
  - `node packages/benchmark/browser-candidate-headroom-cross-process.mjs --harness safari-webdriver --driver-executable /usr/bin/safaridriver --process-runs 3 --size-gib 1 --fixture-shape corpus-cycle --corpus-file packages/benchmark/assets/books.xml --batch-size 1 --cases stringFull,eventObjectFull,rawFrameNameId --output-dir packages/benchmark/results/cross-process/safari-webdriver-books-corpus --json-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-cross-process-books-corpus.json --md-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-cross-process-books-corpus.md`
- safari-webkit-closure-audit: Recompute the same-contract Safari/WebKit browser-row closure matrix before reclassifying the obligation.
  - `node packages/benchmark/safari-webkit-closure-audit.mjs --json-out packages/benchmark/results/release/safari-webkit-closure-audit.json --md-out packages/benchmark/results/release/safari-webkit-closure-audit.md`
- post-safari-audits: Classify whether Safari rows close the obligation or create a counterexample.
  - `node packages/benchmark/same-contract-runtime-comparison.mjs --json-out packages/benchmark/results/release/same-contract-runtime-comparison.json --md-out packages/benchmark/results/release/same-contract-runtime-comparison.md && node packages/benchmark/safari-webkit-closure-audit.mjs --json-out packages/benchmark/results/release/safari-webkit-closure-audit.json --md-out packages/benchmark/results/release/safari-webkit-closure-audit.md && node packages/benchmark/runtime-counterexample-scan.mjs --json-out packages/benchmark/results/release/runtime-counterexample-scan.json --md-out packages/benchmark/results/release/runtime-counterexample-scan.md && node packages/benchmark/runtime-proof-coverage-audit.mjs --json-out packages/benchmark/results/release/runtime-proof-coverage-audit.json --md-out packages/benchmark/results/release/runtime-proof-coverage-audit.md && node packages/benchmark/source-consumption-shape-audit.mjs --json-out packages/benchmark/results/release/source-consumption-shape-audit.json --md-out packages/benchmark/results/release/source-consumption-shape-audit.md && node packages/benchmark/memory-frontier-audit.mjs --json-out packages/benchmark/results/release/memory-frontier-audit.json --md-out packages/benchmark/results/release/memory-frontier-audit.md && node packages/benchmark/target-distance-audit.mjs --json-out packages/benchmark/results/release/target-distance-audit.json --md-out packages/benchmark/results/release/target-distance-audit.md && node packages/benchmark/text-materialization-boundary-audit.mjs --json-out packages/benchmark/results/release/text-materialization-boundary-audit.json --md-out packages/benchmark/results/release/text-materialization-boundary-audit.md && node packages/benchmark/text-materialization-frontier-coverage-audit.mjs --json-out packages/benchmark/results/release/text-materialization-frontier-coverage-audit.json --md-out packages/benchmark/results/release/text-materialization-frontier-coverage-audit.md && node packages/benchmark/runtime-limit-proof-obligation-gate.mjs --json-out packages/benchmark/results/release/runtime-limit-proof-obligation-gate.json --md-out packages/benchmark/results/release/runtime-limit-proof-obligation-gate.md && node packages/benchmark/runtime-proof-gap-handoff.mjs --json-out packages/benchmark/results/release/runtime-proof-gap-handoff.json --md-out packages/benchmark/results/release/runtime-proof-gap-handoff.md`

Expected evidence:
- Safari/WebKit environment.browserName or javascriptEngine is recognized as safari-jsc-browser by runtime-proof-coverage-audit.
- Rows preserve fullStringParity and the same event/checksum contract.
- Primary full rows record the synchronous Iterable<Uint8Array[]> source contract; direct ReadableStream rows, if run, remain separately named source-overhead rows.
- Any direct ReadableStream row records demand-driven pull/read consumption and backpressure-respecting behavior.
- Memory evidence is classified explicitly; missing Safari JS heap counters must not be treated as bounded-memory proof.
- Exact Safari/WebKit build identity and row-level source-boundary metadata are recorded separately from Bun/JSC WebKit evidence.

Closure checks:
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.evidenceClass must be browser-row-evidence.
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.benchmarkRowsRecorded must be greater than 0.
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.directReadableStreamFullStringRowsRecorded must be reported separately and must not substitute for primarySyncByteBatchRowsRecorded.
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.directReadableStreamRowsAreSeparateEvidence must be true.
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.primarySyncByteBatchRowsRecorded must be greater than 0.
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsRecorded must be greater than 0.
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.primaryRowsInSameContractComparison must be true, with bounded primary row id, event count, and checksum matching same-contract-runtime-comparison.json.
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.largeBoundedPrimarySyncByteBatchRowsRecorded must be greater than 0 for 1 GiB+ Safari/WebKit primary rows.
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.largePrimaryRowsInSameContractComparison must be true, with 1 GiB+ bounded primary row id, event count, and checksum matching same-contract-runtime-comparison.json.
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.exactBuildIdentityRecorded must be true.
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.rowLevelSourceBoundaryPinnedRowsRecorded must be greater than 0.
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.largeBoundedPrimarySyncByteBatchRowsWithRowLevelSourceBoundaryPin must be greater than 0.
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.sourceBoundaryPinned must be true only when the 1 GiB+ bounded primary Safari/WebKit row has row-level source revision and source-pin artifact metadata.
- safari-webkit-closure-audit.json summary.qualifiedClosureCount must be greater than 0 before safari-jsc-source-and-browser-rows-open can be closed.
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.closesSafariObligation must be true before safari-jsc-source-and-browser-rows-open can be marked covered.
- runtime-counterexample-scan.json must include any Safari/WebKit full-string rows and classify any 200 MiB/s+ bounded-memory row as a counterexample.
- target-distance-audit.json must be regenerated after Safari/WebKit rows so Woodstox and quick-xml 0.9x target distances use the same updated JavaScript comparison set.

Scope guards:
- Safari rows are browser JSC evidence; they do not replace Bun/JSC rows.
- Bun/JSC WebKit source pins must not be reused as Safari source-boundary evidence without an exact build match.
- A missing or failing safaridriver run is environment evidence only, not a runtime limitation.
- Do not compare direct ReadableStream throughput against sync byte-batch rows as if they were the same source-consumption shape.

### spidermonkey-codegen-handoff

- Classification: EXTERNAL_RUN_REQUIRED
- Obligations: codegen-traces-open
- Proof goal: Capture emitted SpiderMonkey JIT IR, optimized-code, or codegen diagnostics for same-contract Firefox/SpiderMonkey full-string rows.
- Local closure status: external-run-required
- Locally runnable now: no
- Local closure scope: These are local, official-shell, and Taskcluster debug-shell diagnostic facts only; they are not emitted SpiderMonkey JIT IR or optimized-code evidence for a same-contract StAX row.
- Diagnostic identity status counts: not-claimed=4, not-claimed-non-stax-diagnostic=7
- Local blockers:
  - Installed Firefox diagnostic dump audit emitted no JIT diagnostic dump.
  - Local SpiderMonkey JS shell candidates are available (2), but this availability audit records no emitted JIT IR or optimized-code dump.
  - Official Firefox release jsshell is executable and JIT status is observable, but it exposes no emitted IR/native dump surface, bytecode dump status is bytecode-output-emitted, and it cannot run the current stax full-string benchmark unchanged.
  - Official Firefox nightly jsshell is executable and JIT status is observable, but it exposes no emitted IR/native dump surface, bytecode dump status is bytecode-output-emitted, and it cannot run the current stax full-string benchmark unchanged.
  - The js-shell StAX API gap audit pins the unchanged-harness blocker as host API surface, with common missing globals: TextDecoder, TextEncoder, ReadableStream, fetch.
  - The StAX public reader host API boundary audit pins the current TextDecoder/ReadableStream/TextEncoder boundary: primarySyncByteBatchRequiresTextDecoder=true, directReadableStreamRequiresReadableStream=true, stringInputRequiresTextEncoder=true, and alternateDecoderWouldBeUnchangedClosure=false.
  - The SpiderMonkey js-shell tokenizer headroom audit records partial parser-core headroom only: fastest=145.01 MiB/s, fullStringParity=false, memoryProofRows=0, counterexamples200MiB=0.
  - The SpiderMonkey js-shell materialized headroom audit records JS string/object materialization headroom only: fastest=37.61 MiB/s, sameSemanticChecksumFields=true, fullStringParity=false, memoryProofRows=0, counterexamples200MiB=0.
  - The public js-shell diagnostic flag sweep tried 4 bytecode flag combinations and found 0 bytecode-output probes plus diagnosticPrefSurface=false.
  - An archived Firefox 36 era debug js-shell emits JitSpew codegen output, proving the expected diagnostic surface shape, but it is not comparable to the current Firefox/SpiderMonkey benchmark rows.
  - A current Taskcluster debug js-shell emits JitSpew codegen output (taskId=aJLr1DFjQ7urQTpRiIsfRQ, buildId=20260602093330, sourceRevision=253b8523586577438a3ddf86d67436719feaf6d8), but sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=false, and selectedRowIdentityStatus=not-claimed-non-stax-diagnostic.
  - A current Taskcluster debug js-shell emits JitSpew codegen output while running the XML byte-tokenizer workload (taskId=aJLr1DFjQ7urQTpRiIsfRQ, buildId=20260602093330, sourceRevision=253b8523586577438a3ddf86d67436719feaf6d8), but fullStringParity=false, sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=false, and selectedRowIdentityStatus=not-claimed-non-stax-diagnostic.
  - A current Taskcluster debug js-shell emits JitSpew codegen output while materializing JS strings and public event-shaped objects (taskId=aJLr1DFjQ7urQTpRiIsfRQ, buildId=20260602093330, sourceRevision=253b8523586577438a3ddf86d67436719feaf6d8), but unchangedStaxBenchmark=false, sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=false, and selectedRowIdentityStatus=not-claimed-non-stax-diagnostic.
  - A rerun of the current Taskcluster debug js-shell codegen probe reproduces JitSpew output (taskId=aJLr1DFjQ7urQTpRiIsfRQ, buildId=20260602093330, sourceRevision=253b8523586577438a3ddf86d67436719feaf6d8, codegenMarkers=54756), but sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=false, and closesEmittedIrObligation=false.
  - A rerun of the current Taskcluster debug js-shell materialized string/object probe reproduces JitSpew output (taskId=aJLr1DFjQ7urQTpRiIsfRQ, buildId=20260602093330, sourceRevision=253b8523586577438a3ddf86d67436719feaf6d8, codegenMarkers=234522, throughputMiBPerSec=0.31), but unchangedStaxBenchmark=false, sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=false, and closesEmittedIrObligation=false.
  - Coverage diagnostic identity status counts: selectedRowIdentityStatusCounts not-claimed=4, not-claimed-non-stax-diagnostic=7.
  - The ASCII scope-distance audit pins corpusFileCount=3, allCorpusFilesAscii=true, asciiByteToStringEquivalentToUtf8=true, semanticMaterializedWorkload=true, and reducesScopeDistance=true while closesCodegenObligation=false, so ASCII corpus equivalence narrows materialized js-shell scope but does not supply unchanged StAX closure evidence.
  - The materialized scope-distance audit pins semanticEquivalentForAsciiFields=true while closureRequirementsMet=2 and closureRequirementsBlocked=4; primarySyncByteBatchMissingGlobals=TextDecoder; asciiTextDecoderEquivalent=true; diagnosticThroughputMiBPerSec=0.32216048877786657; throughputCountsAsTargetEvidence=false; closesCodegenObligation=false, preventing the materialized js-shell artifact from being cited as unchanged StAX closure evidence.
  - The SpiderMonkey codegen closure audit checks 16 diagnostic/codegen candidates against same-contract comparison generatedAt=2026-06-02T20:08:45.362Z, comparisonRowCount=289, finds emittedCodegenSurfaceCount=6, sameContractStaxRowCount=0, profiledFullStringParityCount=1, unchangedRunnableCount=0, selectedRowMetadataCount=1, diagnosticWorkloadMetadataCount=3, nonComparableDiagnosticWorkloadMetadataCount=3, selectedRowComparisonMatchCount=0, selectedRowComparisonMismatchCount=1, selectedRowComparisonMissingCount=15, selectedRowMetadataMissingFieldCounts selectedChecksum=15, selectedEventCount=15, selectedRowId=15, closingMetadataMissingFieldCounts diagnosticFlags=10, emittedDumpMetadata=10, runtimeBuildIdentity=11, disallowedEvidenceClassCounts archival-codegen-scope-guard=1, availability-only=1, bytecode-diagnostic-only=2, current-debug-codegen-scope-guard=2, current-debug-materialized-codegen-scope-guard=2, current-debug-xml-codegen-scope-guard=1, diagnostic-flag-sweep-negative=1, gecko-profiler-scope-guard=1, host-api-surface-gap=1, materialized-headroom-only=1, negative-diagnostic-surface=1, parser-core-headroom-only=1, source-pin-only=1, selectedRowIdentityStatusCounts not-claimed-non-stax-diagnostic=16, qualifiedClosureCount=0, contradictedClosureClaimCount=0, and conclusionAllowed=false.
  - The SpiderMonkey codegen closure frontier has closestBlockedCandidateCount=5, minimumBlockedRequirementCount=4, closestBlockedCandidates=`spidermonkey-taskcluster-debug-jsshell-codegen-audit.json`, `spidermonkey-taskcluster-debug-jsshell-codegen-rerun.json`, `spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json`, `spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun.json`, `spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit.json`, and closest-candidate common missing requirements sameContractStaxRow=5, selectedRowMetadata=5, unchangedRunnable=5, evidenceClassAllowed=5.
  - The SpiderMonkey codegen rerun stability audit compares 2 original/rerun pairs, reproduces 2 pairs on the same Taskcluster build and codegen marker counts, but qualifiedClosureCount=0, throughputCountsAsTargetEvidence=false, and conclusionAllowed=false.
  - Installed Firefox about:buildconfig records --enable-js-shell / MOZ_PACKAGE_JSSHELL but does not mention --enable-jitspew, JS_JITSPEW, or JS_STRUCTURED_SPEW.
- Local evidence artifacts: firefox-spidermonkey-diagnostic-dump-audit.json, firefox-spidermonkey-js-shell-availability-audit.json, firefox-spidermonkey-release-jsshell-availability-audit.json, firefox-spidermonkey-nightly-jsshell-availability-audit.json, firefox-spidermonkey-profiler-trace.json, firefox-spidermonkey-jsshell-stax-api-gap-audit.json, stax-public-reader-host-api-boundary-audit.json, spidermonkey-jsshell-tokenizer-headroom.json, spidermonkey-jsshell-materialized-headroom.json, spidermonkey-jsshell-diagnostic-flag-sweep.json, spidermonkey-taskcluster-debug-jsshell-codegen-audit.json, spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit.json, spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json, spidermonkey-taskcluster-debug-jsshell-codegen-rerun.json, spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun.json, spidermonkey-ascii-scope-distance-audit.json, spidermonkey-materialized-scope-distance-audit.json, spidermonkey-codegen-closure-audit.json, spidermonkey-codegen-rerun-stability-audit.json, spidermonkey-archival-debug-jsshell-codegen-audit.json, firefox-spidermonkey-buildconfig-source-pin-audit.json

Prerequisites:
- Diagnostic-capable Firefox build or SpiderMonkey shell built with the required JitSpew/codegen diagnostics enabled.
- Set FIREFOX_PATH when using a non-default Firefox build; set SPIDERMONKEY_JS_SHELL, JSSHELL, or JS_SHELL when probing a shell.
- Keep checksum parity rows small first, then scale only after dump emission is proven.

Commands:
- firefox-buildconfig-boundary: Record whether the selected Firefox build exposes JitSpew/codegen diagnostic build flags.
  - `FIREFOX_PATH=/path/to/firefox node packages/benchmark/firefox-spidermonkey-buildconfig-source-pin-audit.mjs --json-out packages/benchmark/results/release/firefox-spidermonkey-buildconfig-source-pin-audit.json --md-out packages/benchmark/results/release/firefox-spidermonkey-buildconfig-source-pin-audit.md`
- firefox-diagnostic-installed-or-debug-build: Run the existing browser diagnostic dump audit against the Firefox build selected by FIREFOX_PATH.
  - `FIREFOX_PATH=/path/to/firefox node packages/benchmark/firefox-spidermonkey-diagnostic-dump-audit.mjs --size-gib 0.0001 --fixture-shape diverse-cycle --diverse-cycle-size 16 --cases rawFrameNameId --output-dir packages/benchmark/results/firefox-spidermonkey-diagnostic-dump-audit --json-out packages/benchmark/results/release/firefox-spidermonkey-diagnostic-dump-audit.json --md-out packages/benchmark/results/release/firefox-spidermonkey-diagnostic-dump-audit.md`
- spidermonkey-js-shell-availability: Record whether a local SpiderMonkey shell is available for follow-up JIT diagnostics.
  - `SPIDERMONKEY_JS_SHELL=/path/to/js node packages/benchmark/firefox-spidermonkey-js-shell-availability-audit.mjs --json-out packages/benchmark/results/release/firefox-spidermonkey-js-shell-availability-audit.json --md-out packages/benchmark/results/release/firefox-spidermonkey-js-shell-availability-audit.md`
- spidermonkey-official-jsshell-surface: Repeat the official release/nightly jsshell diagnostic surface audit before assuming a downloaded shell can emit MIR/LIR or optimized code.
  - `node packages/benchmark/firefox-spidermonkey-release-jsshell-availability-audit.mjs --package-kind release --json-out packages/benchmark/results/release/firefox-spidermonkey-release-jsshell-availability-audit.json --md-out packages/benchmark/results/release/firefox-spidermonkey-release-jsshell-availability-audit.md && node packages/benchmark/firefox-spidermonkey-release-jsshell-availability-audit.mjs --package-kind nightly --json-out packages/benchmark/results/release/firefox-spidermonkey-nightly-jsshell-availability-audit.json --md-out packages/benchmark/results/release/firefox-spidermonkey-nightly-jsshell-availability-audit.md`
- spidermonkey-jsshell-tokenizer-headroom: Refresh js-shell tokenizer headroom as partial non-StAX evidence before reclassifying runtime-limit or counterexample status.
  - `node packages/benchmark/spidermonkey-jsshell-tokenizer-headroom.mjs --json-out packages/benchmark/results/release/spidermonkey-jsshell-tokenizer-headroom.json --md-out packages/benchmark/results/release/spidermonkey-jsshell-tokenizer-headroom.md`
- spidermonkey-jsshell-materialized-headroom: Refresh js-shell string/object materialization headroom as partial non-StAX evidence before reclassifying runtime-limit or counterexample status.
  - `node packages/benchmark/spidermonkey-jsshell-materialized-headroom.mjs --json-out packages/benchmark/results/release/spidermonkey-jsshell-materialized-headroom.json --md-out packages/benchmark/results/release/spidermonkey-jsshell-materialized-headroom.md`
- stax-public-reader-host-api-boundary: Re-pin the current StAX public reader TextDecoder/ReadableStream/TextEncoder boundary before evaluating js-shell closure.
  - `node packages/benchmark/stax-public-reader-host-api-boundary-audit.mjs --json-out packages/benchmark/results/release/stax-public-reader-host-api-boundary-audit.json --md-out packages/benchmark/results/release/stax-public-reader-host-api-boundary-audit.md`
- spidermonkey-codegen-closure-audit: Recompute the same-contract SpiderMonkey codegen closure matrix before reclassifying the obligation.
  - `node packages/benchmark/spidermonkey-codegen-closure-audit.mjs --json-out packages/benchmark/results/release/spidermonkey-codegen-closure-audit.json --md-out packages/benchmark/results/release/spidermonkey-codegen-closure-audit.md`
- spidermonkey-codegen-rerun-stability-audit: Recompute original/rerun SpiderMonkey debug js-shell codegen stability as diagnostic non-closure evidence.
  - `node packages/benchmark/spidermonkey-codegen-rerun-stability-audit.mjs --json-out packages/benchmark/results/release/spidermonkey-codegen-rerun-stability-audit.json --md-out packages/benchmark/results/release/spidermonkey-codegen-rerun-stability-audit.md`
- post-spidermonkey-audits: Reclassify the codegen obligation after diagnostic artifacts are generated.
  - `node packages/benchmark/stax-public-reader-host-api-boundary-audit.mjs --json-out packages/benchmark/results/release/stax-public-reader-host-api-boundary-audit.json --md-out packages/benchmark/results/release/stax-public-reader-host-api-boundary-audit.md && node packages/benchmark/spidermonkey-jsshell-tokenizer-headroom.mjs --json-out packages/benchmark/results/release/spidermonkey-jsshell-tokenizer-headroom.json --md-out packages/benchmark/results/release/spidermonkey-jsshell-tokenizer-headroom.md && node packages/benchmark/spidermonkey-jsshell-materialized-headroom.mjs --json-out packages/benchmark/results/release/spidermonkey-jsshell-materialized-headroom.json --md-out packages/benchmark/results/release/spidermonkey-jsshell-materialized-headroom.md && node packages/benchmark/spidermonkey-codegen-closure-audit.mjs --json-out packages/benchmark/results/release/spidermonkey-codegen-closure-audit.json --md-out packages/benchmark/results/release/spidermonkey-codegen-closure-audit.md && node packages/benchmark/spidermonkey-codegen-rerun-stability-audit.mjs --json-out packages/benchmark/results/release/spidermonkey-codegen-rerun-stability-audit.json --md-out packages/benchmark/results/release/spidermonkey-codegen-rerun-stability-audit.md && node packages/benchmark/runtime-counterexample-scan.mjs --json-out packages/benchmark/results/release/runtime-counterexample-scan.json --md-out packages/benchmark/results/release/runtime-counterexample-scan.md && node packages/benchmark/runtime-proof-coverage-audit.mjs --json-out packages/benchmark/results/release/runtime-proof-coverage-audit.json --md-out packages/benchmark/results/release/runtime-proof-coverage-audit.md && node packages/benchmark/source-consumption-shape-audit.mjs --json-out packages/benchmark/results/release/source-consumption-shape-audit.json --md-out packages/benchmark/results/release/source-consumption-shape-audit.md && node packages/benchmark/memory-frontier-audit.mjs --json-out packages/benchmark/results/release/memory-frontier-audit.json --md-out packages/benchmark/results/release/memory-frontier-audit.md && node packages/benchmark/target-distance-audit.mjs --json-out packages/benchmark/results/release/target-distance-audit.json --md-out packages/benchmark/results/release/target-distance-audit.md && node packages/benchmark/text-materialization-boundary-audit.mjs --json-out packages/benchmark/results/release/text-materialization-boundary-audit.json --md-out packages/benchmark/results/release/text-materialization-boundary-audit.md && node packages/benchmark/text-materialization-frontier-coverage-audit.mjs --json-out packages/benchmark/results/release/text-materialization-frontier-coverage-audit.json --md-out packages/benchmark/results/release/text-materialization-frontier-coverage-audit.md && node packages/benchmark/runtime-limit-proof-obligation-gate.mjs --json-out packages/benchmark/results/release/runtime-limit-proof-obligation-gate.json --md-out packages/benchmark/results/release/runtime-limit-proof-obligation-gate.md && node packages/benchmark/runtime-proof-gap-handoff.mjs --json-out packages/benchmark/results/release/runtime-proof-gap-handoff.json --md-out packages/benchmark/results/release/runtime-proof-gap-handoff.md`

Expected evidence:
- A release artifact whose objective records emitted Firefox/SpiderMonkey JIT IR, optimized-code, or codegen dump evidence.
- The artifact must include the runtime/build identity, diagnostic flags, selected row id, event count, and checksum parity.
- The artifact must declare closesEmittedIrObligation=true only when sameContractStaxRow=true and canRunCurrentStaxFullStringBenchmark=true.
- The artifact must report selectedRowMatchesCurrentComparison=true against same-contract-runtime-comparison.json with event count and checksum parity.
- The artifact must report evidenceClassAllowed=true; diagnostic scope-guard, availability, source-pin, and negative-diagnostic classes cannot close the obligation.
- The coverage audit must classify the artifact as SpiderMonkey codegen evidence, not merely profiler/source/availability evidence.

Closure checks:
- runtime-proof-coverage-audit.json coverage.spiderMonkeyDiagnostics.emittedIrEvidenceCount must be greater than 0.
- runtime-proof-coverage-audit.json coverage.spiderMonkeyDiagnostics.missingIrSurfaceCount must be 0 for the SpiderMonkey diagnostic rows that are claimed as codegen closure evidence.
- spidermonkey-materialized-scope-distance-audit.json summary.closureRequirementsBlocked must be 0 before any materialized js-shell codegen artifact can be cited as same-contract StAX closure evidence.
- spidermonkey-materialized-scope-distance-audit.json summary.closesCodegenObligation must be true before materialized string/object codegen can close codegen-traces-open.
- spidermonkey-codegen-closure-audit.json summary.qualifiedClosureCount must be greater than 0 before codegen-traces-open can be closed.
- spidermonkey-codegen-rerun-stability-audit.json summary.qualifiedClosureCount must remain 0 unless the compared rerun artifacts are same-contract StAX closure evidence.
- Any SpiderMonkey closing artifact must report sameContractStaxRow=true and canRunCurrentStaxFullStringBenchmark=true, or explicitly explain why the browser-row artifact rather than js-shell artifact supplies unchanged StAX closure.
- The closing artifact selected row id must match a current same-contract full-string JavaScript row in same-contract-runtime-comparison.json, with event count and checksum parity recorded.
- The closing artifact must not have evidenceClass jit-status-only, bytecode-diagnostic-only, source-pin-only, negative-diagnostic-surface, or missing-availability-audit.
- The closing artifact must include runtime/build identity, diagnostic flags, selected row id, event count, checksum parity, and emitted IR or optimized-code dump metadata.

Scope guards:
- The existing no-dump diagnostic audit is a negative result for the installed browser build only.
- The installed buildconfig audit explains the local diagnostic surface but is still not emitted JIT IR.
- JS shell and official jsshell availability are environment evidence only until a dump or IR artifact is captured.
- Codegen rerun stability is reproducibility evidence only; it does not turn diagnostic js-shell workloads into unchanged StAX rows.

## Findings

- handoff-scope (SCOPE_GUARD): The handoff records next experiments for open proof gaps; it is not itself benchmark, allocation, or codegen evidence.
  - activeObligations=safari-jsc-source-and-browser-rows-open:open, codegen-traces-open:partial
  - handoffs=safari-webkit-browser-row-handoff, spidermonkey-codegen-handoff
- handoff-coverage (CONTRACT_FACT): Every currently active proof obligation has a concrete handoff entry.
  - unhandledObligations=0

