# Runtime-Limit Proof Obligation Gate

Generated: 2026-06-03T07:45:12.819Z

## Scope

This is a static gate over the proof ledger for the broad `CLAIM-JS-RUNTIME-LIMIT-200MIB` claim. It does not prove a JavaScript runtime ceiling. It checks that the current ledger keeps the broad claim below conclusion strength while known proof obligations remain open.

## Verdict

- Gate pass: yes
- Gate status: incomplete-proof-correctly-blocked
- Conclusion allowed: no
- Runtime claim status: `HYPOTHESIS`

## Claim Guards

| ID | Claim | Required status | Actual status | Satisfied |
| --- | --- | --- | --- | --- |
| `runtime-limit-remains-hypothesis` | `CLAIM-JS-RUNTIME-LIMIT-200MIB` | `HYPOTHESIS` | `HYPOTHESIS` | yes |
| `woodstox-object-shape-counterexample` | `CLAIM-WOODSTOX-SAME-JS-OBJECTS` | `COUNTEREXAMPLE` | `COUNTEREXAMPLE` | yes |
| `quickxml-object-shape-counterexample` | `CLAIM-QUICKXML-SAME-JS-OBJECTS` | `COUNTEREXAMPLE` | `COUNTEREXAMPLE` | yes |
| `lazy-getters-negative-result` | `CLAIM-LAZY-GETTERS` | `NEGATIVE_RESULT` | `NEGATIVE_RESULT` | yes |
| `node-buffer-not-neutral-primary` | `CLAIM-NODE-BUFFER-PRIMARY` | `NEGATIVE_RESULT` | `NEGATIVE_RESULT` + product constraint | yes |
| `node-textdecoder-source-boundary` | `CLAIM-NODE-TEXTDECODER-SOURCE-BOUNDARY` | `SOURCE_FACT` | `SOURCE_FACT` | yes |
| `chrome-blink-textdecoder-source-boundary` | `CLAIM-CHROME-BLINK-TEXTDECODER-SOURCE-BOUNDARY` | `SOURCE_FACT` | `SOURCE_FACT` | yes |
| `bun-webkit-textdecoder-source-boundary` | `CLAIM-BUN-WEBKIT-TEXTDECODER-SOURCE-BOUNDARY` | `SOURCE_FACT` | `SOURCE_FACT` | yes |
| `bun-textdecoder-dispatch-counterexample` | `CLAIM-BUN-TEXTDECODER-DISPATCH-SOURCE-BOUNDARY` | `SOURCE_FACT` + `COUNTEREXAMPLE` | `SOURCE_FACT` + `COUNTEREXAMPLE` | yes |
| `firefox-spidermonkey-textdecoder-source-boundary` | `CLAIM-FIREFOX-SPIDERMONKEY-TEXTDECODER-SOURCE-BOUNDARY` | `SOURCE_FACT` | `SOURCE_FACT` | yes |

## Artifact Mentions

| Artifact | Present |
| --- | --- |
| `materialization-contract-audit.md` | yes |
| `same-contract-runtime-comparison.md` | yes |
| `runtime-counterexample-scan.md` | yes |
| `runtime-proof-coverage-audit.md` | yes |
| `quick-xml-shape-audit.md` | yes |
| `quick-xml-allocation-count.md` | yes |
| `quick-xml-allocation-count-stability.md` | yes |
| `woodstox-hotspot-trace.md` | yes |
| `woodstox-jfr-allocation.md` | yes |
| `woodstox-measured-jfr-allocation.md` | yes |
| `woodstox-measured-jfr-allocation-rerun.md` | yes |
| `candidate-headroom-large.md` | yes |
| `bun-candidate-headroom-large.md` | yes |
| `browser-candidate-headroom-large.md` | yes |
| `firefox-bidi-candidate-headroom.md` | yes |
| `text-cdata-cost-decomposition.md` | yes |
| `text-materialization-frontier.md` | yes |
| `text-trim-guard-candidate.md` | yes |
| `text-ascii-pretrim-candidate.md` | yes |
| `all-ascii-span-materialization-candidate.md` | yes |
| `sync-byte-batch-shape-batch1.md` | yes |
| `sync-byte-batch-shape-batch16.md` | yes |
| `textdecoder-span-variants.md` | yes |
| `bun-textdecoder-span-variants.md` | yes |
| `browser-textdecoder-span-variants.md` | yes |
| `node-textdecoder-source-pin-audit.md` | yes |
| `chrome-blink-textdecoder-source-pin-audit.md` | yes |
| `bun-textdecoder-dispatch-source-pin-audit.md` | yes |
| `firefox-spidermonkey-textdecoder-source-pin-audit.md` | yes |
| `stax-public-reader-host-api-boundary-audit.md` | yes |
| `bun-jsc-partial-codegen-trace.md` | yes |
| `bun-jsc-textdecoder-codegen-trace.md` | yes |
| `stream-source-consumption-shapes.md` | yes |
| `stream-source-consumption-backpressure-counters.md` | yes |
| `event-reader-byte-batch-cross-process-corpus.md` | yes |
| `segment-scan-headroom.md` | yes |
| `segment-tokenizer-headroom.md` | yes |
| `segment-tokenizer-string-frontier.md` | yes |
| `runtime-proof-gap-handoff.md` | yes |
| `runtime-proof-handoff-validation.md` | yes |

## Open Obligations

These are static disclosure guards. They must stay disclosed while the broad runtime-limit claim remains below `CONCLUSION`; the coverage snapshot column records whether the current evidence audit still treats each guard as active.
Active evidence-gap disclosures: 1
Disclosure-only guards: 4

| ID | Disclosed | Coverage status | Gate role | Meaning |
| --- | --- | --- | --- | --- |
| `safari-jsc-source-and-browser-rows-open` | yes | open | active-evidence-gap | Safari/browser JSC source and benchmark coverage remains separate from Bun/JSC coverage. |
| `codegen-traces-open` | yes | covered | disclosure-only-guard | Runtime codegen/JIT evidence remains required for broad runtime-limit conclusions. |
| `allocation-profiles-open` | yes | covered | disclosure-only-guard | Allocation/heap evidence remains required for runtimes without adequate traces. |
| `independent-corpus-suite-open` | yes | covered | disclosure-only-guard | More independent real/corpus fixtures remain required. |
| `counterexample-rule-present` | yes | covered | disclosure-only-guard | The ledger must preserve the rule that a bounded full-string 200 MiB/s JavaScript row disproves the limit claim. |

## Coverage Snapshot

- Coverage audit loaded: yes (2026-06-03T07:44:19.970Z)
- Active coverage obligations: safari-jsc-source-and-browser-rows-open
- Covered coverage obligations: firefox-browser-rows-open, codegen-traces-open, allocation-profiles-open, non-v8-browser-coverage-open, independent-corpus-suite-open, counterexample-rule-present
- SpiderMonkey diagnostics rows vs closure candidates: 12/20 (gap=8, closureQualified=1)
- SpiderMonkey closure candidates outside coverage diagnostics: `firefox-spidermonkey-profiler-trace.json`, `firefox-spidermonkey-taskcluster-debug-browser-diagnostic-dump-audit.json`, `spidermonkey-jsshell-materialized-headroom.json`, `spidermonkey-jsshell-stax-primary-byte-batch.json`, `spidermonkey-jsshell-tokenizer-headroom.json`, `spidermonkey-taskcluster-debug-jsshell-codegen-rerun.json`, `spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun.json`, `spidermonkey-taskcluster-debug-jsshell-primary-byte-batch-codegen-audit.json`
- SpiderMonkey coverage diagnostics outside closure candidates: none
- SpiderMonkey selected row identity statuses: not-claimed=4, not-claimed-non-stax-diagnostic=8
- SpiderMonkey closest codegen blockers: spidermonkey-taskcluster-debug-jsshell-codegen-audit.json=[evidenceClassAllowed, sameContractStaxRow, selectedRowMetadata, unchangedRunnable]; spidermonkey-taskcluster-debug-jsshell-codegen-rerun.json=[evidenceClassAllowed, sameContractStaxRow, selectedRowMetadata, unchangedRunnable]; spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json=[evidenceClassAllowed, sameContractStaxRow, selectedRowMetadata, unchangedRunnable]; spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun.json=[evidenceClassAllowed, sameContractStaxRow, selectedRowMetadata, unchangedRunnable]; spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit.json=[evidenceClassAllowed, sameContractStaxRow, selectedRowMetadata, unchangedRunnable]
- SpiderMonkey Taskcluster route freshness: fresh (artifactIdentityMatchesRoute=yes, expectedIdentitySource=inferred-from-artifacts, checkedArtifacts=5, mismatchedArtifacts=none)
- Safari/WebKit closure comparison: generatedAt=2026-06-03T06:02:02.040Z, rows=291, candidates=0, qualified=0
- Safari/WebKit status: evidenceClass=environment-availability-only, canRunSafariBrowserRows=no, browserRows=0, primarySyncRows=0, boundedPrimaryRows=0, largeBoundedPrimaryRows=0, exactBuildIdentity=no, sourceBoundaryPinned=no, closesSafariObligation=no
- Safari/WebKit local closure blockers: met=`harness-supports-safari`, `direct-readable-stream-not-substitute`, blocked=`host-is-macos`, `safari-executable-found`, `safaridriver-found`, `can-run-safari-browser-rows`, `safari-benchmark-rows-recorded`, `primary-sync-byte-batch-rows-recorded`, `bounded-primary-sync-byte-batch-rows-recorded`, `exact-build-identity-recorded`, `source-boundary-pinned`

| ID | Satisfied | Meaning |
| --- | --- | --- |
| `coverage-loaded` | yes | runtime-proof-coverage-audit.json must be loaded by the gate. |
| `safari-webkit-local-unavailable-status-visible` | yes | Safari/WebKit local unavailable status must stay visible in coverage: current host has no Safari/safaridriver row, zero Safari browser rows are recorded, and the Safari obligation remains open. |
| `safari-webkit-closure-audit-comparison-current` | yes | Safari/WebKit closure audit comparison freshness must be preserved in coverage: the closure matrix must reference the current same-contract comparison generatedAt and row count even when no Safari rows are present. |
| `spidermonkey-identity-status-counts-present` | yes | Coverage audit must expose coverage.spiderMonkeyDiagnostics.selectedRowIdentityStatusCounts for gate-level review. |
| `spidermonkey-non-stax-diagnostic-rows-visible` | yes | Coverage audit must keep non-StAX SpiderMonkey diagnostic rows visible via selectedRowIdentityStatusCounts.not-claimed-non-stax-diagnostic. |
| `spidermonkey-closure-audit-surface-visible` | yes | Coverage audit must expose SpiderMonkey diagnostic row count, closure-audit candidate count, their gap, and qualifiedClosureCount so gate review sees the curated coverage surface is not the full closure matrix. |
| `spidermonkey-closure-audit-comparison-current` | yes | SpiderMonkey closure audit comparison freshness must be preserved in coverage: selected-row comparison counts must match the current same-contract comparison generatedAt and row count. |
| `spidermonkey-closure-frontier-current` | yes | SpiderMonkey closure frontier must be preserved in coverage: closest blocked candidates must remain the current Taskcluster/debug-shell frontier with the minimum blocked requirement count and exact remaining blockers. |
| `spidermonkey-closure-audit-gap-artifacts-visible` | yes | Coverage audit must name the SpiderMonkey closure candidates outside curated diagnostics rows and report no diagnostic rows outside the closure audit. |
| `spidermonkey-taskcluster-route-freshness` | yes | Taskcluster route freshness must show the current SpiderMonkey debug-shell artifacts match the latest route task and expected build/source identity. |

## Counterexample Snapshot

- Same-contract comparison loaded: yes (2026-06-03T06:02:02.040Z)
- Same-contract comparison contract: same-full-string-checksum-contract-not-same-object-shape; publicEventCase=eventObjectFull; objectShapeEquivalence=false; memoryEquivalence=false
- Same-contract comparison rows: 291/291; largeFullJsRows=239
- Same-contract comparison counterexamples: 0
- Runtime counterexample scan loaded: yes (2026-06-03T07:44:58.950Z)
- Counterexample scan contract: threshold=200.00 MiB/s, minSizeGiB=1.00, parseErrors=0
- Counterexample scan coverage shape: artifacts=231/231, measuredRows=1269/1269
- Counterexample scan aggregate surface: aggregateRows=182, largeFullAggregateRows=142, measuredCounterexamples=0, aggregateCounterexamples=0
- Counterexample scan source-shape surface: sourceModeRows=644, largeFullSourceModeRows=474, modes=generated-sync-iterable-byte-batches:382,fullArrayBuffer=0,unknownArrayBuffer=0,directReadableStream=0; file-backed-sync-iterable-byte-batches:53,fullArrayBuffer=0,unknownArrayBuffer=0,directReadableStream=0; async-iterable-byte-batches:15,fullArrayBuffer=0,unknownArrayBuffer=0,directReadableStream=0; web-readable-stream-pull:15,fullArrayBuffer=0,unknownArrayBuffer=0,directReadableStream=15; sync-iterable-byte-batches:4,fullArrayBuffer=0,unknownArrayBuffer=0,directReadableStream=0; fetch-async-iterable-byte-batches:2,fullArrayBuffer=0,unknownArrayBuffer=0,directReadableStream=0; fetch-readable-stream-pull:2,fullArrayBuffer=0,unknownArrayBuffer=0,directReadableStream=2; complete-js-string:1,fullArrayBuffer=0,unknownArrayBuffer=0,directReadableStream=0
- Runtime counterexample scan counterexamples: 0
- Current release counterexamples: 0
- [x] same-contract-comparison-loaded: same-contract-runtime-comparison.json must be loaded by the gate.
- [x] same-contract-comparison-contract: same-contract-runtime-comparison.json must preserve checksum/event-count semantics without claiming JavaScript object-shape, memory, or source-mode equivalence.
- [x] same-contract-comparison-row-count: same-contract-runtime-comparison.json summary.rowCount must match the actual comparisonRows length.
- [x] same-contract-comparison-large-js-rows: same-contract-runtime-comparison.json must include large full-string JavaScript rows for the counterexample frontier.
- [x] counterexample-scan-loaded: runtime-counterexample-scan.json must be loaded by the gate.
- [x] counterexample-scan-parameters: runtime-counterexample-scan.json must preserve the 200 MiB/s and 0.999 GiB counterexample threshold contract.
- [x] counterexample-scan-no-parse-errors: runtime-counterexample-scan.json must report zero release artifact parse errors.
- [x] counterexample-scan-current-coverage-shape: runtime-counterexample-scan.json must scan the same artifact and measured-row counts as the current coverage audit.
- [x] counterexample-scan-aggregate-surface: runtime-counterexample-scan.json must preserve aggregate-row counterexample counts as a separate surface from measured rows.
- [x] counterexample-scan-source-shape-surface: runtime-counterexample-scan.json must preserve source-mode classification for large full-string JavaScript rows and keep full ArrayBuffer parser inputs visible.

## Handoff Snapshot

- Handoff loaded: yes (2026-06-03T07:44:37.702Z)
- Handoff active obligations: safari-jsc-source-and-browser-rows-open
- Handoff IDs: safari-webkit-browser-row-handoff

| ID | Satisfied | Meaning |
| --- | --- | --- |
| `handoff-loaded` | yes | runtime-proof-gap-handoff.json must be loaded by the gate. |
| `safari-primary-byte-batch-contract` | yes | Safari handoff must require primary synchronous Iterable<Uint8Array[]> rows and keep direct ReadableStream rows separate. |
| `safari-closure-checks-primary-bounded` | yes | Safari closure checks must require primary and bounded sync byte-batch rows plus closesSafariObligation=true. |
| `safari-closure-checks-same-contract-comparison` | yes | Safari closure checks must require bounded primary rows to match same-contract-runtime-comparison.json by row id, event count, and checksum via primaryRowsInSameContractComparison. |
| `safari-closure-checks-1gib-primary` | yes | Safari closure checks must require largeBoundedPrimarySyncByteBatchRowsRecorded and largePrimaryRowsInSameContractComparison for 1 GiB+ bounded primary row id, event count, and checksum parity. |
| `safari-row-level-source-boundary-required` | yes | Safari closure checks must require row-level source revision and source-pin artifact metadata, not only an availability-level sourceBoundaryPinned boolean. |
| `safari-source-boundary-separates-bun-webkit` | yes | Safari handoff must preserve that Bun/JSC and Bun-patched WebKit source pins are not Safari browser JSC source pins unless the tested build identity matches. |
| `safari-target-distance-recomputed-after-rows` | yes | Safari handoff must require target-distance-audit regeneration after Safari/WebKit rows so Woodstox and quick-xml 0.9x targets use the updated JavaScript comparison set. |
| `safari-structured-evidence-intake-contract` | yes | Safari handoff must expose structured required artifacts, row fields, audit fields, and rejection rules for external row intake. |
| `safari-local-availability-blocker` | yes | Safari handoff must preserve the local Safari availability blocker with host/harness runability details and zero-candidate closure audit summary tied to the current same-contract comparison identity. |

## Handoff Validation Snapshot

- Handoff validation loaded: yes (2026-06-03T07:44:38.767Z)
- Handoff validation target handoff generatedAt: 2026-06-03T07:44:37.702Z (current 2026-06-03T07:44:37.702Z)
- Handoff validation pass: yes
- Commands checked: 5
- Scripts referenced: 14
- Missing scripts: 0
- Release output paths: 30
- Non-release output paths: 0
- Raw output paths: 1
- Raw output path policy violations: 0
- Required flags present: yes
- Required handoffs present: yes
- Required contracts present: yes
- External-run status pinned: yes
- External-run required handoffs: 1
- Locally runnable handoffs: 0
- Unhandled obligations in validated handoff: 0
- Validated handoff IDs: safari-webkit-browser-row-handoff

| ID | Satisfied | Meaning |
| --- | --- | --- |
| `handoff-validation-loaded` | yes | runtime-proof-handoff-validation.json must be loaded by the gate. |
| `handoff-validation-pass` | yes | runtime-proof-handoff-validation.json summary.pass must be true before the gate can pass. |
| `handoff-validation-contracts-present` | yes | runtime-proof-handoff-validation.json must report all required contracts present. |
| `handoff-validation-command-and-path-safety` | yes | runtime-proof-handoff-validation.json must report required flags present, existing scripts, curated release outputs, and separated raw outputs. |
| `handoff-validation-external-run-status-pinned` | yes | runtime-proof-handoff-validation.json must report all current handoffs as external-run-required with zero locally runnable closures. |
| `handoff-validation-required-handoffs-present` | yes | runtime-proof-handoff-validation.json must report required current handoffs present. |
| `handoff-validation-current-handoff` | yes | runtime-proof-handoff-validation.json must validate the currently loaded runtime-proof-gap-handoff.json generatedAt. |
| `handoff-validation-no-unhandled-obligations` | yes | runtime-proof-handoff-validation.json must validate a handoff with zero unhandled obligations. |
| `handoff-validation-spidermonkey-utf8-fallback-boundary` | yes | runtime-proof-handoff-validation.json must require the SpiderMonkey UTF-8 fallback boundary contract patterns. |

## Source Audit Snapshot

- Source audit loaded: yes (2026-06-03T07:44:58.095Z)
- Source audit inputs: comparison=2026-06-03T06:02:02.040Z (current 2026-06-03T06:02:02.040Z), coverage=2026-06-03T07:44:19.970Z (current 2026-06-03T07:44:19.970Z)
- Source audit status: classified
- Primary parser input: synchronous Iterable<Uint8Array[]>
- Primary source boundary: demand-driven StreamReaderSync parser pulls
- Primary source modes: file-backed-sync-iterable-byte-batches, sync-iterable-byte-batches
- Primary backpressure contract: Primary sync rows yield one grouped Uint8Array[] batch per parser pull; async and direct ReadableStream rows must stay separate and record backpressure counters.
- Primary sync byte-batch rows: 231
- Primary direct ReadableStream rows: 0
- Primary async source rows: 0
- Primary full ArrayBuffer parser-input rows: 0
- Representative stream rows respect backpressure: yes
- Coverage crosscheck status: consistent
- Coverage source-mode rows: 474
- Coverage not-full-ArrayBuffer rows: 474/474
- Coverage full ArrayBuffer rows: 0
- Coverage direct ReadableStream rows: 17

| ID | Satisfied | Meaning |
| --- | --- | --- |
| `source-audit-loaded` | yes | source-consumption-shape-audit.json must be loaded by the gate. |
| `source-audit-current-inputs` | yes | source-consumption-shape-audit.json must reference the currently loaded comparison and coverage audit generatedAt values. |
| `coverage-crosscheck-consistent` | yes | Source audit coverage crosscheck must be consistent with the wider coverage source-mode scan. |
| `coverage-crosscheck-not-full-arraybuffer` | yes | Coverage crosscheck must report every source-mode row as not full ArrayBuffer parser input. |
| `coverage-crosscheck-readable-stream-separated` | yes | Coverage crosscheck must keep direct ReadableStream rows visible as separate source-overhead evidence. |
| `primary-source-sync-byte-batches-only` | yes | Primary source audit rows must stay synchronous Iterable<Uint8Array[]> byte batches with async and direct ReadableStream rows excluded. |
| `representative-stream-backpressure-proven` | yes | Representative direct ReadableStream and async byte-batch rows must carry explicit backpressure proof before source-overhead evidence is cited. |

## Frontier Audit Snapshot

- Memory frontier loaded: yes (2026-06-03T06:02:49.227Z)
- Frontier audit comparison inputs: memory=2026-06-03T06:02:02.040Z, target=2026-06-03T06:02:02.040Z, text=2026-06-03T06:02:02.040Z (current 2026-06-03T06:02:02.040Z)
- Fastest bounded JS row: 185.50 MiB/s at 60.45 MiB
- Unbounded or unproven memory rows: 17
- Bounded rows without numeric memory proof: 0
- Unbounded rows at or above 200 MiB/s: 0
- Same-fixture process RSS: JS=61.77 MiB, Woodstox=312.71 MiB, quick-xml=4.78 MiB
- Target distance loaded: yes (2026-06-03T06:03:26.996Z)
- Woodstox 0.9x target met: no
- Woodstox 0.9x remaining: 164.29 MiB/s
- quick-xml 0.9x target met: no
- quick-xml 0.9x remaining: 95.06 MiB/s
- Shared JS target row: yes
- Overall JS frontier separated from same-fixture target row: yes
- Target JS row visible in counterexample scan: yes
- Target JS contract: sourceMode=file-backed-sync-iterable-byte-batches, directReadableStream=no, fullArrayBufferParserInput=no, boundedMemory=yes, memoryKind=process-rss, maxRssMiB=61.77
- Text materialization boundary loaded: yes (2026-06-03T06:03:26.424Z)
- Fastest full-string row: 185.50 MiB/s
- Full-string rows crossing 200 MiB/s: 0
- No-text rows crossing 200 MiB/s: 4
- No-trim rows crossing 200 MiB/s: 0
- Fold-trim rows crossing 200 MiB/s: 0
- No-trim/fold-trim bounded memory: no-trim=yes, fold-trim=yes
- No-trim/fold-trim string reads: no-trim text=135898776, no-trim fields=502070478, fold-trim text=33974712, fold-trim fields=125517686
- Without-text full-string parity: no
- Text materialization frontier coverage loaded: yes (2026-06-03T06:03:18.013Z)
- Required materialization negative candidates covered: 11/11
- Missing materialization negative candidates: 0
- Covered materialization negative candidates crossing 200 MiB/s: 0

| ID | Satisfied | Meaning |
| --- | --- | --- |
| `frontier-audits-current-comparison` | yes | Frontier audits must reference the currently loaded same-contract-runtime-comparison.json generatedAt. |
| `memory-frontier-classified` | yes | memory-frontier-audit.json must classify 1 GiB+ JavaScript full-string memory rows and keep unbounded rows visible. |
| `memory-frontier-no-unbounded-target-row` | yes | memory-frontier-audit.json must show unbounded or unproven-memory full-string rows do not reach the 200 MiB/s target. |
| `memory-frontier-same-fixture-external-rss-visible` | yes | memory-frontier-audit.json must keep same-fixture 1024 MiB process RSS snapshots visible for JavaScript, Woodstox, and quick-xml. |
| `target-distance-not-met` | yes | target-distance-audit.json must show same-fixture JavaScript remains below both Woodstox and quick-xml 0.9x targets. |
| `target-distance-js-contract-primary-bounded` | yes | target-distance-audit.json must compare external targets against a bounded file-backed synchronous byte-batch JavaScript row, not direct streams or full ArrayBuffer parser input. |
| `target-distance-same-fixture-frontier-separated` | yes | target-distance-audit.json must keep the overall fastest JavaScript frontier separate from the same-fixture Woodstox/quick-xml 0.9x target baseline. |
| `target-distance-row-visible-in-counterexample-scan` | yes | The same-fixture JavaScript row used for Woodstox/quick-xml 0.9x target distance must also be visible in runtime-counterexample-scan source-mode rows. |
| `text-frontier-no-full-counterexample` | yes | text-materialization-boundary-audit.json must show no full-string rows cross 200 MiB/s while no-text rows remain partial headroom. |
| `text-frontier-trim-variants-below-target` | yes | text-materialization-boundary-audit.json must show no-trim and fold-trim variants do not cross 200 MiB/s, and without-text headroom is not full-string parity. |
| `text-frontier-negative-candidate-coverage` | yes | text-materialization-frontier-coverage-audit.json must show required materialization negative/cache candidate groups are represented in the frontier synthesis. |

## Proof Rules

These checks keep known semantic distinctions from being collapsed into a stronger runtime-limit claim.

| ID | Satisfied | Meaning |
| --- | --- | --- |
| `target-contract-not-object-shape` | yes | The target must be defined as the same full-string StAX contract, not identical runtime object shape. |
| `woodstox-same-js-object-shape-rejected` | yes | Woodstox object-shape parity with JavaScript public events must stay rejected. |
| `quickxml-same-js-object-shape-rejected` | yes | quick-xml object-shape parity with JavaScript public events must stay rejected. |
| `engine-invariant-not-impossibility-proof` | yes | Language/runtime string invariants alone must not be promoted to performance impossibility. |
| `negative-results-not-global-proof` | yes | Failed implementation families narrow search space but do not prove the whole runtime ceiling. |
| `lazy-getters-reopen-burden` | yes | Lazy getters remain closed unless a full-string benchmark proves improvement without cache-shape regression. |
| `bounded-full-string-counterexample-rule` | yes | A bounded 200 MiB/s full-string JavaScript row must remain a counterexample to the broad limit claim. |
| `source-shapes-separated` | yes | Direct ReadableStream source-overhead rows must remain separate from synchronous byte-batch parser rows. |
| `byte-batches-not-full-arraybuffer` | yes | Large byte-batch rows must not be treated as one prebuilt full-XML ArrayBuffer parser input. |
| `byte-batch-backpressure-preserved` | yes | Byte-batch source rows must preserve demand-driven consumption instead of preconsuming the stream. |
| `raw-frame-source-shapes-backpressure-counted` | yes | Focused source-shape evidence must include raw-frame async and ReadableStream rows under the same backpressure counters. |
| `handoff-source-consumption-classified` | yes | The handoff must carry classified source-consumption evidence without closing Safari/WebKit or SpiderMonkey obligations. |
| `handoff-external-target-distance-classified` | yes | The handoff must carry Woodstox and quick-xml 0.9x target-distance evidence under the same checksum contract. |
| `handoff-text-materialization-frontier-classified` | yes | The handoff must carry the text-materialization frontier without treating no-text headroom as a full-string counterexample. |
| `segment-headroom-not-stax-counterexample` | yes | Segment scan/tokenizer headroom must stay classified as partial evidence, not a full StAX counterexample. |
| `segment-string-frontier-below-threshold` | yes | Segment tokenizer string materialization frontier must show token-only headroom collapses below the 200 MiB/s full-string counterexample threshold. |
| `woodstox-reference-not-identical-input` | yes | Cross-fixture Woodstox ratios must remain target-distance references, not identical-input target passes. |
| `same-fixture-woodstox-target-unmet` | yes | The current same-fixture 1024 MiB JS row must stay recorded as below the 0.9x Woodstox target. |

## Interpretation

A passing report currently means the proof ledger is conservative, not that the target runtime limit has been proven. Current coverage audit blockers: safari-jsc-source-and-browser-rows-open. Static disclosure guards may include evidence families that the latest coverage audit already marks covered; those guards prevent stale broad conclusions, not duplicate the active coverage list. A future 200 MiB/s+ bounded-memory full-string JavaScript row remains a counterexample.
