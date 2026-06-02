# Runtime-Limit Proof Obligation Gate

Generated: 2026-06-02T14:22:00.439Z

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

| ID | Disclosed | Coverage status | Meaning |
| --- | --- | --- | --- |
| `safari-jsc-source-and-browser-rows-open` | yes | open | Safari/browser JSC source and benchmark coverage remains separate from Bun/JSC coverage. |
| `codegen-traces-open` | yes | partial | Runtime codegen/JIT evidence remains required for broad runtime-limit conclusions. |
| `allocation-profiles-open` | yes | covered | Allocation/heap evidence remains required for runtimes without adequate traces. |
| `independent-corpus-suite-open` | yes | covered | More independent real/corpus fixtures remain required. |
| `counterexample-rule-present` | yes | covered | The ledger must preserve the rule that a bounded full-string 200 MiB/s JavaScript row disproves the limit claim. |

## Coverage Snapshot

- Coverage audit loaded: yes (2026-06-02T14:21:03.892Z)
- Active coverage obligations: safari-jsc-source-and-browser-rows-open, codegen-traces-open
- Covered coverage obligations: firefox-browser-rows-open, allocation-profiles-open, non-v8-browser-coverage-open, independent-corpus-suite-open, counterexample-rule-present
- SpiderMonkey diagnostics rows vs closure candidates: 11/15 (gap=4, closureQualified=0)
- SpiderMonkey closure candidates outside coverage diagnostics: `spidermonkey-jsshell-materialized-headroom.json`, `spidermonkey-jsshell-tokenizer-headroom.json`, `spidermonkey-taskcluster-debug-jsshell-codegen-rerun.json`, `spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun.json`
- SpiderMonkey coverage diagnostics outside closure candidates: none
- SpiderMonkey selected row identity statuses: not-claimed=4, not-claimed-non-stax-diagnostic=7
- SpiderMonkey Taskcluster route freshness: fresh (artifactIdentityMatchesRoute=yes, checkedArtifacts=5, mismatchedArtifacts=none)

| ID | Satisfied | Meaning |
| --- | --- | --- |
| `coverage-loaded` | yes | runtime-proof-coverage-audit.json must be loaded by the gate. |
| `spidermonkey-identity-status-counts-present` | yes | Coverage audit must expose coverage.spiderMonkeyDiagnostics.selectedRowIdentityStatusCounts for gate-level review. |
| `spidermonkey-non-stax-diagnostic-rows-visible` | yes | Coverage audit must keep non-StAX SpiderMonkey diagnostic rows visible via selectedRowIdentityStatusCounts.not-claimed-non-stax-diagnostic. |
| `spidermonkey-closure-audit-surface-visible` | yes | Coverage audit must expose SpiderMonkey diagnostic row count, closure-audit candidate count, their gap, and qualifiedClosureCount so gate review sees the curated coverage surface is not the full closure matrix. |
| `spidermonkey-closure-audit-comparison-current` | yes | SpiderMonkey closure audit comparison freshness must be preserved in coverage: selected-row comparison counts must match the current same-contract comparison generatedAt and row count. |
| `spidermonkey-closure-audit-gap-artifacts-visible` | yes | Coverage audit must name the SpiderMonkey closure candidates outside curated diagnostics rows and report no diagnostic rows outside the closure audit. |
| `spidermonkey-taskcluster-route-freshness` | yes | Taskcluster route freshness must show the current SpiderMonkey debug-shell artifacts match the latest route task and expected build/source identity. |

## Counterexample Snapshot

- Same-contract comparison loaded: yes (2026-06-01T17:12:20.521Z)
- Same-contract comparison contract: same-full-string-checksum-contract-not-same-object-shape; publicEventCase=eventObjectFull; objectShapeEquivalence=false; memoryEquivalence=false
- Same-contract comparison rows: 289/289; largeFullJsRows=239
- Same-contract comparison counterexamples: 0
- Runtime counterexample scan loaded: yes (2026-06-02T14:21:15.716Z)
- Counterexample scan contract: threshold=200.00 MiB/s, minSizeGiB=1.00, parseErrors=0
- Counterexample scan coverage shape: artifacts=225/225, measuredRows=1255/1255
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

## Handoff Snapshot

- Handoff loaded: yes (2026-06-02T14:21:42.788Z)
- Handoff active obligations: safari-jsc-source-and-browser-rows-open, codegen-traces-open
- Handoff IDs: safari-webkit-browser-row-handoff, spidermonkey-codegen-handoff

| ID | Satisfied | Meaning |
| --- | --- | --- |
| `handoff-loaded` | yes | runtime-proof-gap-handoff.json must be loaded by the gate. |
| `safari-primary-byte-batch-contract` | yes | Safari handoff must require primary synchronous Iterable<Uint8Array[]> rows and keep direct ReadableStream rows separate. |
| `safari-closure-checks-primary-bounded` | yes | Safari closure checks must require primary and bounded sync byte-batch rows plus closesSafariObligation=true. |
| `safari-closure-checks-same-contract-comparison` | yes | Safari closure checks must require bounded primary rows to match same-contract-runtime-comparison.json by row id, event count, and checksum via primaryRowsInSameContractComparison. |
| `safari-closure-checks-1gib-primary` | yes | Safari closure checks must require largeBoundedPrimarySyncByteBatchRowsRecorded and largePrimaryRowsInSameContractComparison for 1 GiB+ bounded primary row id, event count, and checksum parity. |
| `safari-local-availability-blocker` | yes | Safari handoff must preserve the local Safari availability blocker and zero-candidate closure audit summary. |
| `spidermonkey-closing-artifact-schema-evidence` | yes | SpiderMonkey expected evidence must require explicit closure declarations, same-contract row status, comparison match, and allowed evidence class. |
| `spidermonkey-emitted-ir-required` | yes | SpiderMonkey closure checks must require emitted IR/codegen evidence and no missing IR surface. |
| `spidermonkey-materialized-scope-not-enough` | yes | SpiderMonkey materialized js-shell codegen must require closureRequirementsBlocked=0 and closesCodegenObligation=true before closing. |
| `spidermonkey-unchanged-stax-required` | yes | SpiderMonkey closing artifacts must require sameContractStaxRow=true and canRunCurrentStaxFullStringBenchmark=true unless a browser-row artifact supplies closure. |
| `spidermonkey-same-contract-comparison-required` | yes | SpiderMonkey closing artifacts must require the selected row id to match same-contract-runtime-comparison.json with event count and checksum parity. |
| `spidermonkey-closing-metadata-required` | yes | SpiderMonkey closing artifacts must require runtime/build identity, diagnostic flags, row identity, checksum parity, and emitted IR or optimized-code dump metadata. |
| `spidermonkey-diagnostic-row-identity-blocker` | yes | SpiderMonkey diagnostic rows must remain blocked with selectedRowIdentityStatus=not-claimed-non-stax-diagnostic until they are same-contract StAX closure evidence. |
| `spidermonkey-closure-audit-identity-statuses` | yes | SpiderMonkey closure audit must preserve non-StAX diagnostic identity status counts for closure-matrix candidates. |
| `spidermonkey-selected-row-metadata-missing-fields` | yes | SpiderMonkey closure audit must preserve which selected-row metadata fields are missing from closure-matrix candidates. |
| `spidermonkey-selected-row-comparison-match-counts` | yes | SpiderMonkey closure audit must preserve selected-row comparison match counts against same-contract-runtime-comparison.json. |
| `spidermonkey-codegen-comparison-freshness` | yes | SpiderMonkey closure audit must preserve the current same-contract comparison generatedAt and row count used for selected-row matching. |
| `spidermonkey-closing-metadata-missing-fields` | yes | SpiderMonkey closure audit must preserve which closing metadata subfields are missing from closure-matrix candidates. |
| `spidermonkey-disallowed-evidence-class-counts` | yes | SpiderMonkey closure audit must preserve which diagnostic scope-guard evidence classes are disallowed as closure evidence. |
| `spidermonkey-closure-frontier-blockers` | yes | SpiderMonkey handoff must preserve named closest blocked candidates and common missing requirements from the closure audit frontier. |
| `spidermonkey-contradicted-closure-claims-clear` | yes | SpiderMonkey closure audit must preserve contradictedClosureClaimCount=0 before codegen evidence can be reclassified. |

## Handoff Validation Snapshot

- Handoff validation loaded: yes (2026-06-02T14:21:51.952Z)
- Handoff validation target handoff generatedAt: 2026-06-02T14:21:42.788Z (current 2026-06-02T14:21:42.788Z)
- Handoff validation pass: yes
- Required handoffs present: yes
- Required contracts present: yes
- Unhandled obligations in validated handoff: 0
- Validated handoff IDs: safari-webkit-browser-row-handoff, spidermonkey-codegen-handoff

| ID | Satisfied | Meaning |
| --- | --- | --- |
| `handoff-validation-loaded` | yes | runtime-proof-handoff-validation.json must be loaded by the gate. |
| `handoff-validation-pass` | yes | runtime-proof-handoff-validation.json summary.pass must be true before the gate can pass. |
| `handoff-validation-contracts-present` | yes | runtime-proof-handoff-validation.json must report all required contracts present. |
| `handoff-validation-required-handoffs-present` | yes | runtime-proof-handoff-validation.json must report required Safari and SpiderMonkey handoffs present. |
| `handoff-validation-current-handoff` | yes | runtime-proof-handoff-validation.json must validate the currently loaded runtime-proof-gap-handoff.json generatedAt. |
| `handoff-validation-no-unhandled-obligations` | yes | runtime-proof-handoff-validation.json must validate a handoff with zero unhandled obligations. |

## Source Audit Snapshot

- Source audit loaded: yes (2026-06-02T14:21:32.319Z)
- Source audit inputs: comparison=2026-06-01T17:12:20.521Z (current 2026-06-01T17:12:20.521Z), coverage=2026-06-02T14:21:03.892Z (current 2026-06-02T14:21:03.892Z)
- Source audit status: classified
- Primary parser input: synchronous Iterable<Uint8Array[]>
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

- Memory frontier loaded: yes (2026-06-02T14:21:32.448Z)
- Frontier audit comparison inputs: memory=2026-06-01T17:12:20.521Z, target=2026-06-01T17:12:20.521Z, text=2026-06-01T17:12:20.521Z (current 2026-06-01T17:12:20.521Z)
- Fastest bounded JS row: 185.50 MiB/s at 60.45 MiB
- Unbounded or unproven memory rows: 17
- Bounded rows without numeric memory proof: 0
- Unbounded rows at or above 200 MiB/s: 0
- Target distance loaded: yes (2026-06-02T14:21:32.249Z)
- Woodstox 0.9x target met: no
- Woodstox 0.9x remaining: 164.29 MiB/s
- quick-xml 0.9x target met: no
- quick-xml 0.9x remaining: 95.06 MiB/s
- Shared JS target row: yes
- Target JS contract: sourceMode=file-backed-sync-iterable-byte-batches, directReadableStream=no, fullArrayBufferParserInput=no, boundedMemory=yes, memoryKind=process-rss, maxRssMiB=61.77
- Text materialization boundary loaded: yes (2026-06-02T14:21:33.031Z)
- Fastest full-string row: 185.50 MiB/s
- Full-string rows crossing 200 MiB/s: 0
- No-text rows crossing 200 MiB/s: 4
- No-trim rows crossing 200 MiB/s: 0
- Fold-trim rows crossing 200 MiB/s: 0
- Without-text full-string parity: no

| ID | Satisfied | Meaning |
| --- | --- | --- |
| `frontier-audits-current-comparison` | yes | Frontier audits must reference the currently loaded same-contract-runtime-comparison.json generatedAt. |
| `memory-frontier-classified` | yes | memory-frontier-audit.json must classify 1 GiB+ JavaScript full-string memory rows and keep unbounded rows visible. |
| `memory-frontier-no-unbounded-target-row` | yes | memory-frontier-audit.json must show unbounded or unproven-memory full-string rows do not reach the 200 MiB/s target. |
| `target-distance-not-met` | yes | target-distance-audit.json must show same-fixture JavaScript remains below both Woodstox and quick-xml 0.9x targets. |
| `target-distance-js-contract-primary-bounded` | yes | target-distance-audit.json must compare external targets against a bounded file-backed synchronous byte-batch JavaScript row, not direct streams or full ArrayBuffer parser input. |
| `text-frontier-no-full-counterexample` | yes | text-materialization-boundary-audit.json must show no full-string rows cross 200 MiB/s while no-text rows remain partial headroom. |
| `text-frontier-trim-variants-below-target` | yes | text-materialization-boundary-audit.json must show no-trim and fold-trim variants do not cross 200 MiB/s, and without-text headroom is not full-string parity. |

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

A passing report currently means the proof ledger is conservative, not that the target runtime limit has been proven. Current coverage audit blockers: safari-jsc-source-and-browser-rows-open, codegen-traces-open. Static disclosure guards may include evidence families that the latest coverage audit already marks covered; those guards prevent stale broad conclusions, not duplicate the active coverage list. A future 200 MiB/s+ bounded-memory full-string JavaScript row remains a counterexample.
