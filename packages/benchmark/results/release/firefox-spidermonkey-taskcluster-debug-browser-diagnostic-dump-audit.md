# Firefox/SpiderMonkey Diagnostic Dump Audit

Generated: 2026-06-02T23:33:13.317Z

Attempts to collect SpiderMonkey JIT diagnostic dump output from the installed Firefox browser while running the same browser reader harness. This is an availability audit; if no dump is emitted, it is not JIT IR evidence and must not be counted as optimized-code proof.

## Outcome

- Status: failed
- Completed: no
- Emitted dump: no
- Dump files: 0
- Dump bytes: 0
- stderr diagnostic hits: 4
- stdout diagnostic hits: 0

## Diagnostic Environment

- IONFLAGS: logs,codegen,mir,lir,aborts,scripts
- ION_SPEW_FILENAME: G:\programming\stax-xml\packages\benchmark\results\firefox-spidermonkey-taskcluster-debug-browser-diagnostic-dump-audit\ion-spew.log
- JIT_SPEW_DIR: G:\programming\stax-xml\packages\benchmark\results\firefox-spidermonkey-taskcluster-debug-browser-diagnostic-dump-audit
- JS_JITSPEW: logs,codegen,mir,lir,aborts,scripts

## Variants

| Variant | Throughput | Events | Checksum | Full parity |
| --- | ---: | ---: | ---: | --- |

## Findings

- spidermonkey-diagnostic-browser-run-failed (NEGATIVE_RESULT): The Firefox browser reader harness did not complete, so no same-contract SpiderMonkey diagnostic dump evidence was collected.
  - exitCode=1
  - signal=none
  - timedOut=false
  - error=none
- diagnostic-dump-audit-scope (SCOPE_GUARD): This artifact is an availability audit for diagnostic dump output, not a proof that SpiderMonkey has no optimized-code headroom.
  - A no-dump result may mean the installed release build does not expose this diagnostic surface.
  - A future debug/nightly/js-shell run can still provide SpiderMonkey JIT IR or optimized-code evidence.
