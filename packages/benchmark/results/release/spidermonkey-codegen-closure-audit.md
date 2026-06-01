# SpiderMonkey Codegen Closure Audit

Generated: 2026-06-01T19:53:34.078Z

Audits SpiderMonkey diagnostic/codegen artifacts against the exact closure requirements for codegen-traces-open. This is not benchmark evidence and not emitted IR by itself; it prevents diagnostic js-shell or availability artifacts from being promoted to same-contract StAX closure evidence.

## Summary

- Candidates checked: 15
- Diagnostic/codegen surface candidates: 6
- Emitted-codegen surface count: 6
- Same-contract StAX row count: 0
- Unchanged runnable count: 0
- Selected row metadata count: 0
- Closing metadata count: 5
- Qualified closures: 0
- Contradicted closure claims: 0
- Conclusion allowed: no

## Closure Matrix

| Artifact | Evidence class | Diagnostic surface | Same StAX row | Unchanged runnable | Row metadata | Closing metadata | Allowed class | Qualified | Missing |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `firefox-spidermonkey-buildconfig-source-pin-audit.json` | source-pin-only | no | no | no | no | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `firefox-spidermonkey-diagnostic-dump-audit.json` | negative-diagnostic-surface | no | no | no | no | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `firefox-spidermonkey-js-shell-availability-audit.json` | availability-only | no | no | no | no | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `firefox-spidermonkey-jsshell-stax-api-gap-audit.json` | unknown | no | no | no | no | no | yes | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata | |
| `firefox-spidermonkey-nightly-jsshell-availability-audit.json` | availability-only | no | no | no | no | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `firefox-spidermonkey-release-jsshell-availability-audit.json` | availability-only | no | no | no | no | no | no | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `spidermonkey-archival-debug-jsshell-codegen-audit.json` | archival-codegen-scope-guard | yes | no | no | no | no | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata, evidenceClassAllowed | |
| `spidermonkey-jsshell-diagnostic-flag-sweep.json` | unknown | no | no | no | no | no | yes | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata | |
| `spidermonkey-jsshell-materialized-headroom.json` | unknown | no | no | no | no | no | yes | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata | |
| `spidermonkey-jsshell-tokenizer-headroom.json` | unknown | no | no | no | no | no | yes | no | emittedCodegenSurface, sameContractStaxRow, unchangedRunnable, selectedRowMetadata, closingMetadata | |
| `spidermonkey-taskcluster-debug-jsshell-codegen-audit.json` | current-debug-codegen-scope-guard | yes | no | no | no | yes | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-codegen-rerun.json` | current-debug-codegen-scope-guard | yes | no | no | no | yes | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json` | current-debug-materialized-codegen-scope-guard | yes | no | no | no | yes | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun.json` | current-debug-materialized-codegen-scope-guard | yes | no | no | no | yes | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |
| `spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit.json` | current-debug-xml-codegen-scope-guard | yes | no | no | no | yes | no | no | sameContractStaxRow, unchangedRunnable, selectedRowMetadata, evidenceClassAllowed | |

## Findings

- spidermonkey-codegen-closure-matrix (SCOPE_GUARD): SpiderMonkey diagnostic/codegen artifacts are classified through the same-contract closure matrix before they can close codegen-traces-open.
  - candidates=15
  - qualifiedClosures=0
- spidermonkey-codegen-closure-not-met (NEGATIVE_RESULT): No current SpiderMonkey diagnostic/codegen artifact satisfies emitted-codegen, unchanged StAX, selected-row metadata, and closing-metadata requirements together.
  - emittedCodegenSurface=6
  - sameContractStaxRows=0
  - unchangedRunnable=0
