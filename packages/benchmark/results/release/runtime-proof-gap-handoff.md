# Runtime Proof Gap Handoff

Generated: 2026-05-31T23:21:05.589Z

Turns current open or partial runtime proof obligations into concrete external-run handoffs. This is not benchmark evidence, not emitted JIT IR, not Safari/WebKit throughput evidence, and not a runtime-limit conclusion.

## Audit Input

- Audit JSON: G:\programming\stax-xml\packages\benchmark\results\release\runtime-proof-coverage-audit.json
- Audit generated: 2026-05-31T22:54:13.928Z
- Comparison JSON: G:\programming\stax-xml\packages\benchmark\results\release\same-contract-runtime-comparison.json
- Comparison generated: 2026-05-31T23:20:48.612Z
- Active obligations: 2

## Summary

- Handoffs: 2
- Unhandled obligations: 0
- External-run required closures: 2
- Locally runnable closures: 0
- Audit artifacts: 198
- Audit measured rows: 1111
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
- Aggregate rows: 261
- Source modes: fetch-async-iterable-byte-batches, fetch-readable-stream-pull, file-backed-sync-iterable-byte-batches, sync-iterable-byte-batches
- 1 GiB+ JS full-string source-mode rows not using full ArrayBuffer parser input: 210/210
- Full ArrayBuffer parser-input rows: 0
- Unknown parser-input rows: 0
- Corpus seed replay rows: 127
- File-backed sync Iterable<Uint8Array[]> rows: 36
- Direct ReadableStream rows: 1

| Source mode | Rows | Not full ArrayBuffer | Direct ReadableStream | Corpus seed replay | Fastest row |
| --- | ---: | ---: | ---: | ---: | --- |
| fetch-async-iterable-byte-batches | 1 | 1 | 0 | 1 | Chrome/V8 browser fetchAsyncByteBatchFull 9.77 MiB/s from browser-fetch-readable-stream-books-corpus.json |
| fetch-readable-stream-pull | 1 | 1 | 1 | 1 | Chrome/V8 browser fetchReadableStreamFull 9.68 MiB/s from browser-fetch-readable-stream-books-corpus.json |
| file-backed-sync-iterable-byte-batches | 36 | 36 | 0 | 0 | Node/V8 stax-raw-frame-name-id-batch-8 152.11 MiB/s from file-backed-batch-size-sweep.json |
| sync-iterable-byte-batches | 172 | 172 | 0 | 125 | Node/V8 rawFrameNameId 185.50 MiB/s from text-trim-cost-decomposition.json |
- Node source frontier: sync-iterable-byte-batches-batch-8 67.94 MiB/s vs web-readable-stream-raw-frame-ascii-batch-8 75.98 MiB/s (1.12x); backpressure 6/6; fullArrayBufferRows=0
- Browser live fetch frontier: fetchReadableStreamFull 9.68 MiB/s; fetchAsyncByteBatchFull 9.77 MiB/s; backpressure 2/2; fullArrayBufferRows=0

## Memory Frontier Evidence

- Status: classified
- Source artifact: same-contract-runtime-comparison.json
- Contract: 1gib-plus-js-full-string-memory-frontier
- 1 GiB+ JS full-string memory rows: 216
- Bounded rows: 199
- Unbounded or unproven rows: 17
- Memory kinds: browser-js-heap, browser-js-heap-unavailable, process-rss
- Fastest bounded row: Node/V8 rawFrameNameId 185.50 MiB/s (process-rss max 60.45 MiB)
- Fastest process RSS row under 128 MiB: Node/V8 rawFrameNameId 185.50 MiB/s (process-rss max 60.45 MiB)
- Fastest browser JS heap row: Chrome/V8 browser rawFrameNameId 69.90 MiB/s (browser-js-heap max 39.55 MiB)

| Memory kind | Rows | Bounded | Unbounded/unproven | Max recorded | Fastest row | Fastest bounded row |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| browser-js-heap | 20 | 20 | 0 | 358.37 MiB | Chrome/V8 browser rawFrameNameId 69.90 MiB/s (browser-js-heap max 39.55 MiB) | Chrome/V8 browser rawFrameNameId 69.90 MiB/s (browser-js-heap max 39.55 MiB) |
| browser-js-heap-unavailable | 9 | 0 | 9 | n/a MiB | Firefox/SpiderMonkey browser rawFrameNameId 64.24 MiB/s (browser-js-heap-unavailable) | none |
| process-rss | 187 | 179 | 8 | 1956.69 MiB | Node/V8 rawFrameNameId 185.50 MiB/s (process-rss max 60.45 MiB) | Node/V8 rawFrameNameId 185.50 MiB/s (process-rss max 60.45 MiB) |

- Interpretation: Memory is classified on the same 1 GiB+ JavaScript full-string row set used for counterexample scanning; process RSS, browser JS heap, and browser host-probe-only rows are not normalized into one allocation model.

## External Target Evidence

- Status: classified
- Source artifact: same-contract-runtime-comparison.json
- Contract: woodstox-and-quickxml-0.9x-target-distance
- Fastest aggregated JS full row: Node/V8 rawFrameNameId 185.50 MiB/s (process-rss max 60.45 MiB)
- Fastest JS full row vs 200 MiB/s: 0.93x, 14.50 MiB/s remaining
- Fastest JS full row vs 1024 MiB Woodstox reference: 0.55x, 118.67 MiB/s below 0.9x target
- Same-fixture Woodstox target: stax-raw-frame-name-id-batch-8 152.11 MiB/s vs Woodstox 351.56 MiB/s; 0.9x target 316.40 MiB/s; remaining 164.29 MiB/s; targetMet=no
- Same-fixture quick-xml target: stax-raw-frame-name-id-batch-8 152.11 MiB/s vs quick-xml 274.63 MiB/s; 0.9x target 247.17 MiB/s; remaining 95.06 MiB/s; targetMet=no
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
- Fastest no-trim row: rawFrameNameIdNoTrim from text-trim-cost-decomposition-8gib.json at 186.97 MiB/s (fullStringParity=no, boundedMemory=unknown)
- Fastest fold-trim row: rawFrameNameIdFoldTrim from text-trim-cost-decomposition-2gib.json at 148.58 MiB/s (fullStringParity=yes, boundedMemory=unknown)
- Fastest full row target distance: 0.93x target, 14.50 MiB/s remaining, 1.08x speedup required
- Without-text to full ratio: 1.36x
- No-trim to full ratio: 1.01x
- Fold-trim to full ratio: 0.80x
- Rows crossing target: full=0, withoutText=4, noTrim=0, foldTrim=0
- Negative candidate count: 21
- Interpretation: Text/CDATA omission crosses the target as headroom evidence, while trim-only, fold-trim, cache, and ASCII candidates remain negative for the current full-string contract.

## Active Obligations

- safari-jsc-source-and-browser-rows-open (open): Bun/JSC and Bun-patched WebKit evidence is present, but no Safari/WebKit browser benchmark row was found. Local Safari/WebKit availability audit is present and records that the current host cannot run Safari rows even though the repository has a safaridriver harness when safaridriver is available.
  - Next: Run same-contract Safari/WebKit rows on a macOS host through the safaridriver wrapper and cross-process stability runner.
- codegen-traces-open (partial): Node/V8 trace evidence present. Bun/JSC codegen/IR evidence present. Chrome/V8 browser codegen trace evidence present. Deno/V8 codegen trace evidence present (2 artifacts). Firefox/SpiderMonkey Gecko Profiler trace evidence present. Firefox/SpiderMonkey JitSpew/IONFLAGS source gate evidence present, but it is not emitted JIT IR. Firefox/SpiderMonkey installed buildconfig source pin present (buildconfig source pin only; enableJitSpew=false, enableJsShell=true, mozPackageJsShell=true). Firefox/SpiderMonkey diagnostic dump audit was attempted and emitted no JIT diagnostic dump from this installed browser build (status=no-dump-emitted, dumpFiles=0). Firefox/SpiderMonkey local js-shell availability audit present (status=not-found, found=0, searchRoots=0); no emitted JIT IR is recorded by that audit. Firefox/SpiderMonkey official release js-shell audit present (status=available, packageVerified=true, jitStatus=true, irDumpSurface=false, bytecodeDumpOutput=false, bytecodeDumpStatus=no-bytecode-output, nativeDisassemblySurface=false, nativeDumpComplete=false, canReadBinaryInput=true, canRunCurrentStaxFullStringBenchmark=false); it is JIT-status evidence only, not emitted JIT IR. Firefox/SpiderMonkey official nightly js-shell audit present (status=available, packageVerified=false, jitStatus=true, irDumpSurface=false, bytecodeDumpOutput=false, bytecodeDumpStatus=no-bytecode-output, nativeDisassemblySurface=false, nativeDumpComplete=false, canReadBinaryInput=true, canRunCurrentStaxFullStringBenchmark=false); it is JIT-status evidence only, not emitted JIT IR. Firefox/SpiderMonkey emitted JIT IR or optimized-code dump evidence missing.
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
  - Current host cannot run Safari/WebKit browser rows through the normal Safari/safaridriver path.
  - No Safari/WebKit benchmark row is recorded by the availability audit.
  - No exact Safari/WebKit source-boundary pin is recorded by the availability audit.
- Local evidence artifacts: safari-webkit-availability-audit.json

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
- stringBoundary: Pin Safari/WebKit string creation and ownership source lines for the exact tested build or explicitly mark the source-boundary obligation as still open.
- textDecoderBoundary: Pin Safari/WebKit TextDecoder/UTF-8 decode source lines for the exact tested build before citing TextDecoder internals for Safari rows.
- bunWebKitScopeGuard: Bun/JSC and Bun-patched WebKit source pins are not Safari browser JSC source pins unless the tested Safari/WebKit build identity matches and is recorded.

Commands:
- safari-availability-audit: Record whether the host can run Safari/WebKit rows.
  - `node packages/benchmark/safari-webkit-availability-audit.mjs --json-out packages/benchmark/results/release/safari-webkit-availability-audit.json --md-out packages/benchmark/results/release/safari-webkit-availability-audit.md`
- safari-smoke: Prove the safaridriver harness can launch the target browser and preserve checksum parity on a small row.
  - `node packages/benchmark/safari-webdriver-candidate-headroom.mjs --driver-executable /usr/bin/safaridriver --size-gib 0.001 --fixture-shape diverse-cycle --diverse-cycle-size 64 --cases stringFull,eventObjectFull,rawFrameNameId --json-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-smoke.json --md-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-smoke.md`
- safari-books-corpus-cross-process: Generate the first 1 GiB same-contract Safari/WebKit corpus stability row set.
  - `node packages/benchmark/browser-candidate-headroom-cross-process.mjs --harness safari-webdriver --driver-executable /usr/bin/safaridriver --process-runs 3 --size-gib 1 --fixture-shape corpus-cycle --corpus-file packages/benchmark/assets/books.xml --batch-size 1 --cases stringFull,eventObjectFull,rawFrameNameId --output-dir packages/benchmark/results/cross-process/safari-webdriver-books-corpus --json-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-cross-process-books-corpus.json --md-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-cross-process-books-corpus.md`
- post-safari-audits: Classify whether Safari rows close the obligation or create a counterexample.
  - `node packages/benchmark/same-contract-runtime-comparison.mjs --json-out packages/benchmark/results/release/same-contract-runtime-comparison.json --md-out packages/benchmark/results/release/same-contract-runtime-comparison.md && node packages/benchmark/runtime-counterexample-scan.mjs --json-out packages/benchmark/results/release/runtime-counterexample-scan.json --md-out packages/benchmark/results/release/runtime-counterexample-scan.md && node packages/benchmark/runtime-proof-coverage-audit.mjs --json-out packages/benchmark/results/release/runtime-proof-coverage-audit.json --md-out packages/benchmark/results/release/runtime-proof-coverage-audit.md && node packages/benchmark/runtime-limit-proof-obligation-gate.mjs --json-out packages/benchmark/results/release/runtime-limit-proof-obligation-gate.json --md-out packages/benchmark/results/release/runtime-limit-proof-obligation-gate.md && node packages/benchmark/runtime-proof-gap-handoff.mjs --json-out packages/benchmark/results/release/runtime-proof-gap-handoff.json --md-out packages/benchmark/results/release/runtime-proof-gap-handoff.md`

Expected evidence:
- Safari/WebKit environment.browserName or javascriptEngine is recognized as safari-jsc-browser by runtime-proof-coverage-audit.
- Rows preserve fullStringParity and the same event/checksum contract.
- Primary full rows record the synchronous Iterable<Uint8Array[]> source contract; direct ReadableStream rows, if run, remain separately named source-overhead rows.
- Any direct ReadableStream row records demand-driven pull/read consumption and backpressure-respecting behavior.
- Memory evidence is classified explicitly; missing Safari JS heap counters must not be treated as bounded-memory proof.
- Exact Safari/WebKit build identity and source-boundary status are recorded separately from Bun/JSC WebKit evidence.

Closure checks:
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.evidenceClass must be browser-row-evidence.
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.benchmarkRowsRecorded must be greater than 0.
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.exactBuildIdentityRecorded must be true.
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.sourceBoundaryPinned must be true.
- runtime-proof-coverage-audit.json coverage.safariWebKitStatus.closesSafariObligation must be true before safari-jsc-source-and-browser-rows-open can be marked covered.
- runtime-counterexample-scan.json must include any Safari/WebKit full-string rows and classify any 200 MiB/s+ bounded-memory row as a counterexample.

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
- Local closure scope: These are local and official-shell diagnostic availability facts only; they are not emitted SpiderMonkey JIT IR or optimized-code evidence.
- Local blockers:
  - Installed Firefox diagnostic dump audit emitted no JIT diagnostic dump.
  - No local SpiderMonkey JS shell was found for JIT IR probing across env, PATH, and filesystem search-root probes.
  - Official Firefox release jsshell is executable and JIT status is observable, but it exposes no emitted IR/native dump surface, bytecode dump status is no-bytecode-output, and it cannot run the current stax full-string benchmark unchanged.
  - Official Firefox nightly jsshell is executable and JIT status is observable, but it exposes no emitted IR/native dump surface, bytecode dump status is no-bytecode-output, and it cannot run the current stax full-string benchmark unchanged.
  - Installed Firefox about:buildconfig records --enable-js-shell / MOZ_PACKAGE_JSSHELL but does not mention --enable-jitspew, JS_JITSPEW, or JS_STRUCTURED_SPEW.
- Local evidence artifacts: firefox-spidermonkey-diagnostic-dump-audit.json, firefox-spidermonkey-js-shell-availability-audit.json, firefox-spidermonkey-release-jsshell-availability-audit.json, firefox-spidermonkey-nightly-jsshell-availability-audit.json, firefox-spidermonkey-buildconfig-source-pin-audit.json

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
- post-spidermonkey-audits: Reclassify the codegen obligation after diagnostic artifacts are generated.
  - `node packages/benchmark/runtime-proof-coverage-audit.mjs --json-out packages/benchmark/results/release/runtime-proof-coverage-audit.json --md-out packages/benchmark/results/release/runtime-proof-coverage-audit.md`

Expected evidence:
- A release artifact whose objective records emitted Firefox/SpiderMonkey JIT IR, optimized-code, or codegen dump evidence.
- The artifact must include the runtime/build identity, diagnostic flags, selected row id, event count, and checksum parity.
- The coverage audit must classify the artifact as SpiderMonkey codegen evidence, not merely profiler/source/availability evidence.

Closure checks:
- runtime-proof-coverage-audit.json coverage.spiderMonkeyDiagnostics.emittedIrEvidenceCount must be greater than 0.
- runtime-proof-coverage-audit.json coverage.spiderMonkeyDiagnostics.missingIrSurfaceCount must be 0 for the SpiderMonkey diagnostic rows that are claimed as codegen closure evidence.
- The closing artifact must not have evidenceClass jit-status-only, source-pin-only, negative-diagnostic-surface, or missing-availability-audit.
- The closing artifact must include runtime/build identity, diagnostic flags, selected row id, event count, checksum parity, and emitted IR or optimized-code dump metadata.

Scope guards:
- The existing no-dump diagnostic audit is a negative result for the installed browser build only.
- The installed buildconfig audit explains the local diagnostic surface but is still not emitted JIT IR.
- JS shell and official jsshell availability are environment evidence only until a dump or IR artifact is captured.

## Findings

- handoff-scope (SCOPE_GUARD): The handoff records next experiments for open proof gaps; it is not itself benchmark, allocation, or codegen evidence.
  - activeObligations=safari-jsc-source-and-browser-rows-open:open, codegen-traces-open:partial
  - handoffs=safari-webkit-browser-row-handoff, spidermonkey-codegen-handoff
- handoff-coverage (CONTRACT_FACT): Every currently active proof obligation has a concrete handoff entry.
  - unhandledObligations=0

