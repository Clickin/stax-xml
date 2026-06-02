# SpiderMonkey Codegen Rerun Stability Audit

Generated: 2026-06-02T23:11:47.246Z

Compares original and rerun Taskcluster debug SpiderMonkey js-shell codegen artifacts. This is reproducibility evidence for emitted JitSpew/codegen diagnostics, not same-contract StAX closure evidence.

## Summary

- Pairs checked: 2
- Reproducible pairs: 2
- Same Taskcluster build pairs: 2
- Same codegen marker-count pairs: 2
- All remain non-closure: yes
- Throughput counts as target evidence: no
- Closure audit qualified closures: 0
- Conclusion allowed: no

## Pairs

| Pair | Same build | Markers original | Markers rerun | Same markers | Marker ratio | MiB/s original | MiB/s rerun | MiB/s ratio | Reproduced | Same-contract | Closes |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| `taskcluster-debug-basic-codegen` | yes | 54761.00 | 54761.00 | yes | 1.00 | n/a | n/a | n/a | yes | no | no |
| `taskcluster-debug-materialized-codegen` | yes | 234582.00 | 234582.00 | yes | 1.00 | 0.77 | 0.76 | 0.99 | yes | no | no |

## Findings

- TRACE_FACT: Taskcluster debug SpiderMonkey js-shell codegen output was reproduced by rerun artifacts.
- NEGATIVE_RESULT: The reproduced debug js-shell codegen artifacts still do not close the same-contract StAX codegen obligation.
- SCOPE_GUARD: Rerun reproducibility is diagnostic-surface evidence only; it is not a throughput target row or same-contract StAX closure.

