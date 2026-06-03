# SpiderMonkey js-shell StAX Primary Byte-Batch Row

Generated: 2026-06-03T05:58:26.999Z

Runs the current built StreamReaderSync primary byte-batch path in official SpiderMonkey js-shells over corpus bytes read with read(file, "binary"). This is same full-string checksum StAX API evidence for js-shell, but not emitted-code closure and not a bounded-memory counterexample because row-level memory is unavailable.

## Summary

- Rows: 2
- Fastest: nightly-spidermonkey-stax-stream-reader-sync-primary-byte-batch 62.75 MiB/s
- All rows full-string parity: yes
- All rows primary byte-batch: yes
- Missing host encoding globals: yes
- Counterexamples >= 200 MiB/s with bounded memory: 0
- Runtime-limit conclusion allowed: no

## Rows

| Row | Runtime | MiB/s | Events | Checksum | Samples ms | TextDecoder | TextEncoder |
| --- | --- | ---: | ---: | ---: | --- | --- | --- |
| release-spidermonkey-stax-stream-reader-sync-primary-byte-batch | JavaScript-C143.0.1 | 51.13 | 894724 | -1087917522 | 313.00, 314.00, 312.00 | undefined | undefined |
| nightly-spidermonkey-stax-stream-reader-sync-primary-byte-batch | JavaScript-C153.0a1 | 62.75 | 894724 | -1087917522 | 253.00, 257.00, 255.00 | undefined | undefined |

## Findings

- spidermonkey-jsshell-current-stax-primary-row (BENCH_FACT): Official SpiderMonkey js-shells can execute the current built StreamReaderSync primary byte-batch full-string checksum path without host TextDecoder or TextEncoder.
  - rows=2
  - primaryPathRunnableWithoutHostEncoding=true
  - fastest=62.75 MiB/s
- spidermonkey-jsshell-row-scope (SCOPE_GUARD): The row is not a runtime-limit closure because it has no row-level memory proof and no emitted same-contract codegen evidence.
  - boundedMemory=null
  - canRunCurrentStaxFullStringBenchmark=false
  - conclusionAllowed=false
