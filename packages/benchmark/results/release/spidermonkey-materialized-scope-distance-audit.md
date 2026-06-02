# SpiderMonkey Materialized Scope Distance Audit

Generated: 2026-06-02T13:33:10.486Z

Compares the current Taskcluster SpiderMonkey js-shell materialized-codegen artifact against the token-only codegen artifact, the js-shell StAX API gap, and the semantic materialization contract. This audit records exactly what the materialized js-shell workload proves and why it still cannot close the unchanged StAX codegen obligation.

## Summary

- All checks pass: true
- Semantic-equivalent for ASCII fields: true
- Materializes JS strings and objects: true
- Closes diagnostic surface obligation: true
- Closure requirements met: 2
- Closure requirements blocked: 4
- Source artifact declares emitted-IR closure: false
- Closure claim contradicted by scope: false
- Closes codegen obligation: false
- Diagnostic throughput MiB/s: 0.32216048877786657
- Diagnostic throughput class: debug-jitspew-diagnostic-not-frontier
- Throughput counts as target evidence: false
- Same-contract StAX row: false
- Unchanged StAX benchmark: false
- Primary sync byte-batch missing globals: TextDecoder
- Non-primary harness missing globals: TextEncoder, ReadableStream, fetch
- ASCII TextDecoder equivalence reduces scope distance: true

## Workload Comparison

- Token workload: xml-token-boundary-no-string-materialization, fullStringParity=false, checksum=9292058, codegenMarkers=151431
- Materialized workload: ascii-js-string-and-public-event-object-materialization, fullStringParity=true, diagnosticThroughputMiBPerSec=0.32216048877786657, throughputCountsAsTargetEvidence=false, checksum=-553631888, materializedStringCount=61289, materializedObjectCount=55759, codegenMarkers=234522

## Closure Requirement Matrix

| Requirement | Status | Required | Observed |
| --- | --- | --- | --- |
| `emitted-codegen-surface` | met | The diagnostic shell emits codegen/IR or optimized-code output for the tested workload. | codegenDump=true, nativeDumpComplete=true |
| `full-string-semantic-materialization` | met | The workload materializes JS strings and public event objects for the checksum fields under test. | fullStringParity=true, materializedStringCount=61289, materializedObjectCount=55759 |
| `same-contract-stax-row` | blocked | The emitted codegen corresponds to the unchanged same-contract StAX benchmark row. | sameContractStaxRow=false |
| `unchanged-stax-benchmark` | blocked | The benchmark harness is unchanged from the current TextDecoder/ReadableStream StAX row. | unchangedStaxBenchmark=false |
| `host-api-surface` | blocked | The js-shell can run the current full-string StAX harness without host API substitution. | canRunCurrentStaxFullStringBenchmark=false, missingGlobals=TextDecoder, TextEncoder, ReadableStream, fetch, primarySyncByteBatchMissingGlobals=TextDecoder |
| `closure-declared-by-source-artifact` | blocked | The source artifact declares that it closes the emitted-IR obligation. | closesEmittedIrObligation=false |

## Checks

- same-current-debug-shell-build: pass
  - materializedTaskId=aJLr1DFjQ7urQTpRiIsfRQ
  - tokenTaskId=aJLr1DFjQ7urQTpRiIsfRQ
  - buildId=20260602093330
- semantic-field-folding-present: pass
  - sameSemanticChecksumFields=true
  - fullStringParity=true
  - checksum=-553631888
- materializes-js-strings-and-public-event-objects: pass
  - materializedStringCount=61289
  - materializedObjectCount=55759
  - materializedAttributeObjectCount=19586
- token-to-materialized-workload-delta-recorded: pass
  - tokenFullStringParity=false
  - materializedFullStringParity=true
  - tokenChecksum=9292058
  - materializedChecksum=-553631888
- unchanged-stax-host-api-gap-remains: pass
  - missingGlobals=TextDecoder, TextEncoder, ReadableStream, fetch
  - canRunCurrentStaxFullStringBenchmark=false
- unchanged-stax-closure-blocked: pass
  - sameContractStaxRow=false
  - unchangedStaxBenchmark=false
  - closesEmittedIrObligation=false

## Findings

- materialized-js-shell-semantic-equivalence-bounded (SOURCE_FACT): The materialized js-shell workload folds the same semantic string fields for the ASCII corpus-seed scope and records positive JS string/object materialization counters.
  - semanticEquivalentForAsciiFields=true
  - materializedStringCount=61289
  - materializedObjectCount=55759
  - checksum=-553631888
- materialized-js-shell-ascii-textdecoder-equivalence (SOURCE_FACT): For the checked ASCII corpus scope, the js-shell materializer produces the same string code units that UTF-8 TextDecoder would produce, narrowing the remaining TextDecoder blocker to unchanged host API/codegen evidence.
  - reducesScopeDistance=true
  - materializedCorpusSeedAscii=true
  - asciiByteToStringEquivalentToUtf8=true
- materialized-js-shell-not-unchanged-stax (SCOPE_GUARD): The same artifact remains outside unchanged StAX closure because the js-shell host API cannot run the TextDecoder/ReadableStream benchmark surface.
  - sameContractStaxRow=false
  - unchangedStaxBenchmark=false
  - closesCodegenObligation=false
- materialized-js-shell-closure-negative (NEGATIVE_RESULT): This audit rejects using the materialized js-shell codegen artifact as closure evidence for codegen-traces-open.
  - requiredClosure=same-contract full-string StAX emitted codegen
  - observedClosure=ASCII js-shell materialized workload codegen
  - allChecksPass=true
- materialized-js-shell-diagnostic-throughput-not-frontier (SCOPE_GUARD): The measured MiB/s from the current debug js-shell JitSpew run is recorded for reproducibility but cannot be cited as target-distance, frontier, or counterexample evidence.
  - diagnosticThroughputMiBPerSec=0.32216048877786657
  - diagnosticThroughputClass=debug-jitspew-diagnostic-not-frontier
  - throughputCountsAsTargetEvidence=false
  - reason=debug shell plus codegen diagnostic output, small ASCII materialized workload, and not the unchanged same-contract StAX row
