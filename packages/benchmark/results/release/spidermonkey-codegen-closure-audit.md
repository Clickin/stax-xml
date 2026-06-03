# SpiderMonkey Codegen Closure Audit

Generated: 2026-06-03T07:06:33.437Z

Audits SpiderMonkey diagnostic/codegen artifacts against the exact closure requirements for codegen-traces-open. This is not benchmark evidence and not emitted IR by itself; it prevents diagnostic js-shell or availability artifacts from being promoted to same-contract StAX closure evidence.

## Inputs

- Comparison JSON: G:\programming\stax-xml\packages\benchmark\results\release\same-contract-runtime-comparison.json
- Comparison generated: 2026-06-03T06:02:02.040Z
- Comparison rows checked: 291

## Summary

- Candidates checked: 20
- Diagnostic/codegen surface candidates: 8
- Emitted-codegen surface count: 8
- Same-contract StAX row count: 1
- Profiled full-string parity count: 1
- Unchanged runnable count: 1
- Selected row metadata count: 2
- Diagnostic workload metadata count: 3
- Diagnostic workload comparison matches: matched=0, mismatched=3, missing=17
- Non-comparable diagnostic workload metadata count: 3
- Closing metadata count: 6
- Qualified closures: 1
- Contradicted closure claims: 0
- Selected row identity statuses: not-claimed-ascii-stax-diagnostic=1, not-claimed-non-stax-diagnostic=18, same-contract-stax-row=1
- Selected row comparison matches: matched=1, mismatched=1, missing=18
- Selected row metadata missing fields: selectedChecksum=18, selectedEventCount=18, selectedRowId=18
- Closing metadata missing fields: diagnosticFlags=13, emittedDumpMetadata=13, runtimeBuildIdentity=13
- Evidence classes: archival-codegen-scope-guard=1, availability-only=1, bytecode-diagnostic-only=2, current-debug-ascii-stax-codegen-scope-guard=1, current-debug-codegen-scope-guard=2, current-debug-materialized-codegen-scope-guard=2, current-debug-xml-codegen-scope-guard=1, diagnostic-flag-sweep-negative=1, gecko-profiler-scope-guard=1, host-api-surface-gap=1, materialized-headroom-only=1, negative-diagnostic-surface=1, parser-core-headroom-only=1, same-contract-spidermonkey-codegen=1, source-pin-only=1, unknown=2
- Disallowed evidence classes: archival-codegen-scope-guard=1, availability-only=1, bytecode-diagnostic-only=2, current-debug-ascii-stax-codegen-scope-guard=1, current-debug-codegen-scope-guard=2, current-debug-materialized-codegen-scope-guard=2, current-debug-xml-codegen-scope-guard=1, diagnostic-flag-sweep-negative=1, gecko-profiler-scope-guard=1, host-api-surface-gap=1, materialized-headroom-only=1, negative-diagnostic-surface=1, parser-core-headroom-only=1, source-pin-only=1, unknown=2
- Minimum blocked requirement count: 4
- Closest blocked candidate count: 5
- Conclusion allowed: yes

## Missing Requirement Histogram

- closingMetadata: 14
- emittedCodegenSurface: 12
- evidenceClassAllowed: 19
- sameContractStaxRow: 19
- selectedRowMatchesCurrentComparison: 1
- selectedRowMetadata: 18
- unchangedRunnable: 19

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
| `firefox-spidermonkey-taskcluster-debug-browser-diagnostic-dump-audit.json` | unknown | no | no | no | no | n/a | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `spidermonkey-archival-debug-jsshell-codegen-audit.json` | archival-codegen-scope-guard | yes | no | no | no | n/a | no | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `spidermonkey-jsshell-diagnostic-flag-sweep.json` | diagnostic-flag-sweep-negative | no | no | no | no | n/a | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `spidermonkey-jsshell-materialized-headroom.json` | materialized-headroom-only | no | no | no | no | n/a | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `spidermonkey-jsshell-stax-primary-byte-batch.json` | unknown | no | no | no | no | n/a | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `spidermonkey-jsshell-tokenizer-headroom.json` | parser-core-headroom-only | no | no | no | no | n/a | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-ascii-stax-codegen-audit.json` | current-debug-ascii-stax-codegen-scope-guard | yes | no | no | no | n/a | no | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-codegen-audit.json` | current-debug-codegen-scope-guard | yes | no | no | no | n/a | yes | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-codegen-rerun.json` | current-debug-codegen-scope-guard | yes | no | no | no | n/a | yes | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json` | current-debug-materialized-codegen-scope-guard | yes | no | no | no | n/a | yes | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun.json` | current-debug-materialized-codegen-scope-guard | yes | no | no | no | n/a | yes | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-primary-byte-batch-codegen-audit.json` | same-contract-spidermonkey-codegen | yes | yes | yes | yes | yes | yes | yes | yes | none | |
| `spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit.json` | current-debug-xml-codegen-scope-guard | yes | no | no | no | n/a | yes | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |

## Findings

- spidermonkey-codegen-closure-matrix (SCOPE_GUARD): SpiderMonkey diagnostic/codegen artifacts are classified through the same-contract closure matrix before they can close codegen-traces-open.
  - candidates=20
  - qualifiedClosures=1
- spidermonkey-diagnostic-workload-metadata-not-row-identity (SCOPE_GUARD): Diagnostic workload metadata is recorded for 3 non-closure artifact(s), but it is not selected same-contract row identity.
  - diagnosticWorkloadMetadata=3
  - nonComparableDiagnosticWorkloadMetadata=3
  - selectedRowMetadata=2
