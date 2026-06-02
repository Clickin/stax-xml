# SpiderMonkey Codegen Closure Audit

Generated: 2026-06-02T18:24:31.994Z

Audits SpiderMonkey diagnostic/codegen artifacts against the exact closure requirements for codegen-traces-open. This is not benchmark evidence and not emitted IR by itself; it prevents diagnostic js-shell or availability artifacts from being promoted to same-contract StAX closure evidence.

## Inputs

- Comparison JSON: G:\programming\stax-xml\packages\benchmark\results\release\same-contract-runtime-comparison.json
- Comparison generated: 2026-06-02T18:14:24.864Z
- Comparison rows checked: 289

## Summary

- Candidates checked: 16
- Diagnostic/codegen surface candidates: 6
- Emitted-codegen surface count: 6
- Same-contract StAX row count: 0
- Profiled full-string parity count: 1
- Unchanged runnable count: 0
- Selected row metadata count: 1
- Diagnostic workload metadata count: 3
- Non-comparable diagnostic workload metadata count: 3
- Closing metadata count: 5
- Qualified closures: 0
- Contradicted closure claims: 0
- Selected row identity statuses: not-claimed-non-stax-diagnostic=16
- Selected row comparison matches: matched=0, mismatched=1, missing=15
- Selected row metadata missing fields: selectedChecksum=15, selectedEventCount=15, selectedRowId=15
- Closing metadata missing fields: diagnosticFlags=10, emittedDumpMetadata=10, runtimeBuildIdentity=11
- Evidence classes: archival-codegen-scope-guard=1, availability-only=1, bytecode-diagnostic-only=2, current-debug-codegen-scope-guard=2, current-debug-materialized-codegen-scope-guard=2, current-debug-xml-codegen-scope-guard=1, diagnostic-flag-sweep-negative=1, gecko-profiler-scope-guard=1, host-api-surface-gap=1, materialized-headroom-only=1, negative-diagnostic-surface=1, parser-core-headroom-only=1, source-pin-only=1
- Disallowed evidence classes: archival-codegen-scope-guard=1, availability-only=1, bytecode-diagnostic-only=2, current-debug-codegen-scope-guard=2, current-debug-materialized-codegen-scope-guard=2, current-debug-xml-codegen-scope-guard=1, diagnostic-flag-sweep-negative=1, gecko-profiler-scope-guard=1, host-api-surface-gap=1, materialized-headroom-only=1, negative-diagnostic-surface=1, parser-core-headroom-only=1, source-pin-only=1
- Minimum blocked requirement count: 4
- Closest blocked candidate count: 5
- Conclusion allowed: no

## Missing Requirement Histogram

- closingMetadata: 11
- emittedCodegenSurface: 10
- evidenceClassAllowed: 16
- sameContractStaxRow: 16
- selectedRowMatchesCurrentComparison: 1
- selectedRowMetadata: 15
- unchangedRunnable: 16

## Closest Blocked Candidates

| Artifact | Evidence class | Missing count | Missing |
| --- | --- | --- | --- |
| `spidermonkey-taskcluster-debug-jsshell-codegen-audit.json` | current-debug-codegen-scope-guard | 4 | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-codegen-rerun.json` | current-debug-codegen-scope-guard | 4 | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json` | current-debug-materialized-codegen-scope-guard | 4 | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun.json` | current-debug-materialized-codegen-scope-guard | 4 | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit.json` | current-debug-xml-codegen-scope-guard | 4 | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |

## Closure Matrix

| Artifact | Evidence class | Diagnostic surface | Same StAX row | Unchanged runnable | Row metadata | Row comparison | Closing metadata | Allowed class | Qualified | Missing |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `firefox-spidermonkey-buildconfig-source-pin-audit.json` | source-pin-only | no | no | no | no | n/a | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `firefox-spidermonkey-diagnostic-dump-audit.json` | negative-diagnostic-surface | no | no | no | no | n/a | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `firefox-spidermonkey-js-shell-availability-audit.json` | availability-only | no | no | no | no | n/a | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `firefox-spidermonkey-jsshell-stax-api-gap-audit.json` | host-api-surface-gap | no | no | no | no | n/a | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `firefox-spidermonkey-nightly-jsshell-availability-audit.json` | bytecode-diagnostic-only | no | no | no | no | n/a | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `firefox-spidermonkey-profiler-trace.json` | gecko-profiler-scope-guard | no | no | no | yes | no | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMatchesCurrentComparison, closingMetadata, evidenceClassAllowed | |
| `firefox-spidermonkey-release-jsshell-availability-audit.json` | bytecode-diagnostic-only | no | no | no | no | n/a | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `spidermonkey-archival-debug-jsshell-codegen-audit.json` | archival-codegen-scope-guard | yes | no | no | no | n/a | no | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `spidermonkey-jsshell-diagnostic-flag-sweep.json` | diagnostic-flag-sweep-negative | no | no | no | no | n/a | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `spidermonkey-jsshell-materialized-headroom.json` | materialized-headroom-only | no | no | no | no | n/a | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `spidermonkey-jsshell-tokenizer-headroom.json` | parser-core-headroom-only | no | no | no | no | n/a | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-codegen-audit.json` | current-debug-codegen-scope-guard | yes | no | no | no | n/a | yes | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-codegen-rerun.json` | current-debug-codegen-scope-guard | yes | no | no | no | n/a | yes | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json` | current-debug-materialized-codegen-scope-guard | yes | no | no | no | n/a | yes | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun.json` | current-debug-materialized-codegen-scope-guard | yes | no | no | no | n/a | yes | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit.json` | current-debug-xml-codegen-scope-guard | yes | no | no | no | n/a | yes | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |

## Findings

- spidermonkey-codegen-closure-matrix (SCOPE_GUARD): SpiderMonkey diagnostic/codegen artifacts are classified through the same-contract closure matrix before they can close codegen-traces-open.
  - candidates=16
  - qualifiedClosures=0
- spidermonkey-codegen-closure-not-met (NEGATIVE_RESULT): No current SpiderMonkey diagnostic/codegen artifact satisfies emitted-codegen, unchanged StAX, selected-row metadata, and closing-metadata requirements together.
  - emittedCodegenSurface=6
  - sameContractStaxRows=0
  - unchangedRunnable=0
- spidermonkey-diagnostic-workload-metadata-not-row-identity (SCOPE_GUARD): Diagnostic workload metadata is recorded for 3 non-closure artifact(s), but it is not selected same-contract row identity.
  - diagnosticWorkloadMetadata=3
  - nonComparableDiagnosticWorkloadMetadata=3
  - selectedRowMetadata=1
