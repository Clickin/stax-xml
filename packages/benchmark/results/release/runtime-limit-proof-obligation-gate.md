# Runtime-Limit Proof Obligation Gate

Generated: 2026-05-31T13:26:44.618Z

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

These are intentionally open obligations. They must be disclosed while the broad runtime-limit claim remains below `CONCLUSION`.

| ID | Disclosed | Meaning |
| --- | --- | --- |
| `safari-jsc-source-and-browser-rows-open` | yes | Safari/browser JSC source and benchmark coverage remains separate from Bun/JSC coverage. |
| `codegen-traces-open` | yes | Runtime codegen/JIT evidence remains required for broad runtime-limit conclusions. |
| `allocation-profiles-open` | yes | Allocation/heap evidence remains required for runtimes without adequate traces. |
| `independent-corpus-suite-open` | yes | More independent real/corpus fixtures remain required. |
| `counterexample-rule-present` | yes | The ledger must preserve the rule that a bounded full-string 200 MiB/s JavaScript row disproves the limit claim. |

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

A passing report currently means the proof ledger is conservative, not that the target runtime limit has been proven. The broad claim remains blocked by open Safari/browser JSC rows, codegen traces, allocation evidence, broader corpus coverage, and the proof rules above. A future 200 MiB/s+ bounded-memory full-string JavaScript row remains a counterexample.
