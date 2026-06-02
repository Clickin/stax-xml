# Runtime Proof Handoff Validation

Generated: 2026-06-02T18:14:54.460Z

Static validation for runtime-proof-gap-handoff external runbooks. This is not benchmark evidence, not emitted JIT IR, not Safari/WebKit throughput evidence, and not a runtime-limit conclusion.

## Summary

- Pass: yes
- Handoffs: 2
- Required handoffs present: yes
- Commands checked: 15
- Scripts referenced: 22
- Missing scripts: 0
- Release output paths: 74
- Non-release output paths: 0
- Raw output paths: 2
- Raw output path policy violations: 0
- Required flags present: yes
- Required contracts present: yes
- External-run status pinned: yes
- External-run required handoffs: 2
- Locally runnable handoffs: 0
- Unhandled obligations in handoff: 0
- Runtime-limit conclusion allowed: no

## Handoff Checks

| Handoff | Classification | Local status | Locally runnable | Commands | Required flags | Required contracts | External-run pinned |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| `safari-webkit-browser-row-handoff` | EXTERNAL_RUN_REQUIRED | external-run-required | no | 5 | yes | yes | yes |
| `spidermonkey-codegen-handoff` | EXTERNAL_RUN_REQUIRED | external-run-required | no | 10 | yes | yes | yes |

## Command Checks

| Handoff | Command | Scripts | Scripts existing | Release outputs curated | Raw outputs separated |
| --- | --- | --- | --- | --- | --- |
| `safari-webkit-browser-row-handoff` | `safari-availability-audit` | `packages/benchmark/safari-webkit-availability-audit.mjs` | yes | yes | none |
| `safari-webkit-browser-row-handoff` | `safari-smoke` | `packages/benchmark/safari-webdriver-candidate-headroom.mjs` | yes | yes | none |
| `safari-webkit-browser-row-handoff` | `safari-books-corpus-cross-process` | `packages/benchmark/browser-candidate-headroom-cross-process.mjs` | yes | yes | yes |
| `safari-webkit-browser-row-handoff` | `safari-webkit-closure-audit` | `packages/benchmark/safari-webkit-closure-audit.mjs` | yes | yes | none |
| `safari-webkit-browser-row-handoff` | `post-safari-audits` | `packages/benchmark/same-contract-runtime-comparison.mjs`<br>`packages/benchmark/safari-webkit-closure-audit.mjs`<br>`packages/benchmark/runtime-counterexample-scan.mjs`<br>`packages/benchmark/runtime-proof-coverage-audit.mjs`<br>`packages/benchmark/source-consumption-shape-audit.mjs`<br>`packages/benchmark/memory-frontier-audit.mjs`<br>`packages/benchmark/target-distance-audit.mjs`<br>`packages/benchmark/text-materialization-boundary-audit.mjs`<br>`packages/benchmark/runtime-limit-proof-obligation-gate.mjs`<br>`packages/benchmark/runtime-proof-gap-handoff.mjs` | yes | yes | none |
| `spidermonkey-codegen-handoff` | `firefox-buildconfig-boundary` | `packages/benchmark/firefox-spidermonkey-buildconfig-source-pin-audit.mjs` | yes | yes | none |
| `spidermonkey-codegen-handoff` | `firefox-diagnostic-installed-or-debug-build` | `packages/benchmark/firefox-spidermonkey-diagnostic-dump-audit.mjs` | yes | yes | yes |
| `spidermonkey-codegen-handoff` | `spidermonkey-js-shell-availability` | `packages/benchmark/firefox-spidermonkey-js-shell-availability-audit.mjs` | yes | yes | none |
| `spidermonkey-codegen-handoff` | `spidermonkey-official-jsshell-surface` | `packages/benchmark/firefox-spidermonkey-release-jsshell-availability-audit.mjs` | yes | yes | none |
| `spidermonkey-codegen-handoff` | `spidermonkey-jsshell-tokenizer-headroom` | `packages/benchmark/spidermonkey-jsshell-tokenizer-headroom.mjs` | yes | yes | none |
| `spidermonkey-codegen-handoff` | `spidermonkey-jsshell-materialized-headroom` | `packages/benchmark/spidermonkey-jsshell-materialized-headroom.mjs` | yes | yes | none |
| `spidermonkey-codegen-handoff` | `stax-public-reader-host-api-boundary` | `packages/benchmark/stax-public-reader-host-api-boundary-audit.mjs` | yes | yes | none |
| `spidermonkey-codegen-handoff` | `spidermonkey-codegen-closure-audit` | `packages/benchmark/spidermonkey-codegen-closure-audit.mjs` | yes | yes | none |
| `spidermonkey-codegen-handoff` | `spidermonkey-codegen-rerun-stability-audit` | `packages/benchmark/spidermonkey-codegen-rerun-stability-audit.mjs` | yes | yes | none |
| `spidermonkey-codegen-handoff` | `post-spidermonkey-audits` | `packages/benchmark/stax-public-reader-host-api-boundary-audit.mjs`<br>`packages/benchmark/spidermonkey-jsshell-tokenizer-headroom.mjs`<br>`packages/benchmark/spidermonkey-jsshell-materialized-headroom.mjs`<br>`packages/benchmark/spidermonkey-codegen-closure-audit.mjs`<br>`packages/benchmark/spidermonkey-codegen-rerun-stability-audit.mjs`<br>`packages/benchmark/runtime-counterexample-scan.mjs`<br>`packages/benchmark/runtime-proof-coverage-audit.mjs`<br>`packages/benchmark/source-consumption-shape-audit.mjs`<br>`packages/benchmark/memory-frontier-audit.mjs`<br>`packages/benchmark/target-distance-audit.mjs`<br>`packages/benchmark/text-materialization-boundary-audit.mjs`<br>`packages/benchmark/runtime-limit-proof-obligation-gate.mjs`<br>`packages/benchmark/runtime-proof-gap-handoff.mjs` | yes | yes | none |

## Findings

- handoff-static-validation (CONTRACT_FACT): Every current runtime proof handoff has existing local entrypoint scripts, curated release outputs, separated raw outputs, and required closure contracts.
  - handoffs=safari-webkit-browser-row-handoff:ok, spidermonkey-codegen-handoff:ok
  - commands=15
- handoff-scope-guard (SCOPE_GUARD): Static handoff validation is runbook quality evidence only; it cannot close Safari/WebKit browser rows or SpiderMonkey emitted IR obligations.
  - No external benchmark command is executed by this audit.
  - No emitted SpiderMonkey IR, optimized code, or Safari/WebKit throughput row is produced by this audit.

