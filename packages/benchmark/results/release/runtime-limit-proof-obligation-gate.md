# Runtime-Limit Proof Obligation Gate

Generated: 2026-06-01T10:36:04.392Z

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
| `bun-jsc-partial-codegen-trace.md` | yes |
| `bun-jsc-textdecoder-codegen-trace.md` | yes |
| `stream-source-consumption-shapes.md` | yes |
| `stream-source-consumption-backpressure-counters.md` | yes |
| `event-reader-byte-batch-cross-process-corpus.md` | yes |
| `runtime-proof-gap-handoff.md` | yes |

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

- Coverage audit loaded: yes (2026-06-01T10:28:54.396Z)
- Active coverage obligations: safari-jsc-source-and-browser-rows-open, codegen-traces-open
- Covered coverage obligations: firefox-browser-rows-open, allocation-profiles-open, non-v8-browser-coverage-open, independent-corpus-suite-open, counterexample-rule-present

## Counterexample Snapshot

- Same-contract comparison loaded: yes (2026-06-01T10:21:54.633Z)
- Same-contract comparison counterexamples: 0
- Runtime counterexample scan loaded: yes (2026-06-01T09:06:54.303Z)
- Runtime counterexample scan counterexamples: 0
- Current release counterexamples: 0

## Handoff Snapshot

- Handoff loaded: yes (2026-06-01T10:32:51.280Z)
- Handoff active obligations: safari-jsc-source-and-browser-rows-open, codegen-traces-open
- Handoff IDs: safari-webkit-browser-row-handoff, spidermonkey-codegen-handoff

| ID | Satisfied | Meaning |
| --- | --- | --- |
| `handoff-loaded` | yes | runtime-proof-gap-handoff.json must be loaded by the gate. |
| `safari-primary-byte-batch-contract` | yes | Safari handoff must require primary synchronous Iterable<Uint8Array[]> rows and keep direct ReadableStream rows separate. |
| `safari-closure-checks-primary-bounded` | yes | Safari closure checks must require primary and bounded sync byte-batch rows plus closesSafariObligation=true. |
| `spidermonkey-emitted-ir-required` | yes | SpiderMonkey closure checks must require emitted IR/codegen evidence and no missing IR surface. |
| `spidermonkey-materialized-scope-not-enough` | yes | SpiderMonkey materialized js-shell codegen must require closureRequirementsBlocked=0 and closesCodegenObligation=true before closing. |
| `spidermonkey-unchanged-stax-required` | yes | SpiderMonkey closing artifacts must require sameContractStaxRow=true and canRunCurrentStaxFullStringBenchmark=true unless a browser-row artifact supplies closure. |

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
| `woodstox-reference-not-identical-input` | yes | Cross-fixture Woodstox ratios must remain target-distance references, not identical-input target passes. |
| `same-fixture-woodstox-target-unmet` | yes | The current same-fixture 1024 MiB JS row must stay recorded as below the 0.9x Woodstox target. |

## Interpretation

A passing report currently means the proof ledger is conservative, not that the target runtime limit has been proven. Current coverage audit blockers: safari-jsc-source-and-browser-rows-open, codegen-traces-open. Static disclosure guards may include evidence families that the latest coverage audit already marks covered; those guards prevent stale broad conclusions, not duplicate the active coverage list. A future 200 MiB/s+ bounded-memory full-string JavaScript row remains a counterexample.
