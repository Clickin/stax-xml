# Firefox/SpiderMonkey Diagnostic Dump Audit

Generated: 2026-05-26T01:32:12.544Z

Attempts to collect SpiderMonkey JIT diagnostic dump output from the installed Firefox browser while running the same browser reader harness. This is an availability audit; if no dump is emitted, it is not JIT IR evidence and must not be counted as optimized-code proof.

## Outcome

- Status: no-dump-emitted
- Completed: yes
- Emitted dump: no
- Dump files: 0
- Dump bytes: 0
- stderr diagnostic hits: 0
- stdout diagnostic hits: 0

## Diagnostic Environment

- IONFLAGS: logs,codegen,mir,lir,aborts,scripts
- JIT_SPEW_DIR: G:\programming\stax-xml\packages\benchmark\results\firefox-spidermonkey-diagnostic-dump-audit
- JS_JITSPEW: logs,codegen,mir,lir,aborts,scripts

## Variants

| Variant | Throughput | Events | Checksum | Full parity |
| --- | ---: | ---: | ---: | --- |
| rawFrameNameId | 26.18 MiB/s | 4985 | 1856142966 | yes |

## Findings

- same-harness-diagnostic-run-completed (BENCH_FACT): The Firefox browser reader harness completed while SpiderMonkey diagnostic dump environment variables were set.
  - rawFrameNameId: events=4985, checksum=1856142966, throughput=26.18 MiB/s
- spidermonkey-diagnostic-dump-not-emitted (NEGATIVE_RESULT): The installed Firefox run completed but did not emit SpiderMonkey JIT diagnostic dump files or recognizable diagnostic stream output.
  - IONFLAGS=logs,codegen,mir,lir,aborts,scripts
  - JS_JITSPEW=logs,codegen,mir,lir,aborts,scripts
  - JIT_SPEW_DIR was set to the audit output directory
  - This is not JIT IR evidence; keep the codegen proof obligation open.
- diagnostic-dump-audit-scope (SCOPE_GUARD): This artifact is an availability audit for diagnostic dump output, not a proof that SpiderMonkey has no optimized-code headroom.
  - A no-dump result may mean the installed release build does not expose this diagnostic surface.
  - A future debug/nightly/js-shell run can still provide SpiderMonkey JIT IR or optimized-code evidence.

