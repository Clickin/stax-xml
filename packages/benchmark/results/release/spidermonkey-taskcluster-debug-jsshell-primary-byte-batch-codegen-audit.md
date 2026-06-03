# SpiderMonkey Taskcluster Debug js-shell Primary Byte-Batch Codegen Audit

Generated: 2026-06-03T06:28:42.086Z

Runs the current built StreamReaderSync primary byte-batch full-string checksum path in the current Taskcluster debug SpiderMonkey js-shell with codegen diagnostics enabled. This is emitted-code closure evidence for the js-shell primary byte-batch row only; it is not browser Firefox evidence and not bounded-memory throughput evidence.

## Summary

- Status: same-contract-codegen-output-emitted
- Codegen dump output emitted: yes
- Native dump complete: yes
- Same-contract StAX row: yes
- Selected row: nightly-spidermonkey-stax-stream-reader-sync-primary-byte-batch
- Selected row matches current comparison: yes
- Evidence class: same-contract-spidermonkey-codegen
- Closes emitted IR obligation: yes

## Findings

- taskcluster-debug-jsshell-primary-byte-batch-codegen (TRACE_FACT): The Taskcluster debug SpiderMonkey js-shell emitted codegen diagnostics while running the current StAX primary byte-batch row.
  - codegenMarkerCount=547558
  - assemblyMnemonicCount=197574
  - selectedRowMatchesCurrentComparison=true
- not-runtime-limit-counterexample (SCOPE_GUARD): This artifact is codegen closure evidence only. It does not provide row-level memory counters and does not create a 200 MiB/s bounded-memory counterexample.
  - selectedMiBPerSec=62.75
  - boundedMemory=not-recorded-in-this-artifact
