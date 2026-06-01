# SpiderMonkey Materialized Scope Distance Audit

Generated: 2026-06-01T07:48:30.040Z

Compares the current Taskcluster SpiderMonkey js-shell materialized-codegen artifact against the token-only codegen artifact, the js-shell StAX API gap, and the semantic materialization contract. This audit records exactly what the materialized js-shell workload proves and why it still cannot close the unchanged StAX codegen obligation.

## Summary

- All checks pass: true
- Semantic-equivalent for ASCII fields: true
- Materializes JS strings and objects: true
- Closes diagnostic surface obligation: true
- Closes codegen obligation: false
- Same-contract StAX row: false
- Unchanged StAX benchmark: false

## Workload Comparison

- Token workload: xml-token-boundary-no-string-materialization, fullStringParity=false, checksum=9292058, codegenMarkers=151431
- Materialized workload: ascii-js-string-and-public-event-object-materialization, fullStringParity=true, checksum=167904020, materializedStringCount=245161, materializedObjectCount=223041, codegenMarkers=234522

## Checks

- same-current-debug-shell-build: pass
  - materializedTaskId=bzK0wWZvQoOguMjTIbRJ_g
  - tokenTaskId=bzK0wWZvQoOguMjTIbRJ_g
  - buildId=20260531212007
- semantic-field-folding-present: pass
  - sameSemanticChecksumFields=true
  - fullStringParity=true
  - checksum=167904020
- materializes-js-strings-and-public-event-objects: pass
  - materializedStringCount=245161
  - materializedObjectCount=223041
  - materializedAttributeObjectCount=78342
- token-to-materialized-workload-delta-recorded: pass
  - tokenFullStringParity=false
  - materializedFullStringParity=true
  - tokenChecksum=9292058
  - materializedChecksum=167904020
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
  - materializedStringCount=245161
  - materializedObjectCount=223041
  - checksum=167904020
- materialized-js-shell-not-unchanged-stax (SCOPE_GUARD): The same artifact remains outside unchanged StAX closure because the js-shell host API cannot run the TextDecoder/ReadableStream benchmark surface.
  - sameContractStaxRow=false
  - unchangedStaxBenchmark=false
  - closesCodegenObligation=false
- materialized-js-shell-closure-negative (NEGATIVE_RESULT): This audit rejects using the materialized js-shell codegen artifact as closure evidence for codegen-traces-open.
  - requiredClosure=same-contract full-string StAX emitted codegen
  - observedClosure=ASCII js-shell materialized workload codegen
  - allChecksPass=true
