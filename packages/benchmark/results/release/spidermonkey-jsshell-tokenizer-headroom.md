# SpiderMonkey JS Shell Tokenizer Headroom

Generated: 2026-06-02T15:41:22.069Z

Runs a SpiderMonkey js-shell XML token-boundary byte scanner over corpus-seed replay. This is JavaScript runtime parser-core headroom evidence only: it does not use TextDecoder, does not materialize names/text strings, does not expose public StAX event objects, and is not a full-string StAX counterexample.

## Summary

- Fixture source: G:\programming\stax-xml\packages\benchmark\assets\books.xml
- Target size: 16.00 MiB
- Corpus seed bytes: 4551
- Fastest row: nightly-spidermonkey-token-boundary 145.01 MiB/s
- 200 MiB/s bounded full-string counterexamples: 0
- Partial rows at or above 200 MiB/s: 0
- Rows with memory proof: 0

## Rows

| Row | Version | Package verified | MiB/s | Samples | Spread | Full string | Bounded memory | Events | Start | End | Text | Attrs | Checksum | Seed/target |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `release-spidermonkey-token-boundary` | JavaScript-C143.0.1 | yes | 121.47 | 3 | 1.44% | no | unknown | 892131 | 313353 | 313350 | 265428 | 44238 | 134568078 | 0.00 |
| `nightly-spidermonkey-token-boundary` | JavaScript-C153.0a1 | no | 145.01 | 3 | 2.55% | no | unknown | 892131 | 313353 | 313350 | 265428 | 44238 | 134568078 | 0.00 |

## Findings

- spidermonkey-jsshell-tokenizer-headroom (BENCH_FACT): Fastest SpiderMonkey js-shell token-boundary row was nightly-spidermonkey-token-boundary at 145.01 MiB/s.
  - release-spidermonkey-token-boundary: 121.47 MiB/s, jitStatus=true, binaryInput=true
  - nightly-spidermonkey-token-boundary: 145.01 MiB/s, jitStatus=true, binaryInput=true
- partial-not-stax-counterexample (SCOPE_GUARD): Rows scan token boundaries and fold counters without TextDecoder, JavaScript string materialization, public event objects, or full StAX checksum parity.
  - release-spidermonkey-token-boundary: fullStringParity=false, boundedMemory=null, contractScope=xml-token-boundary-no-string-materialization
  - nightly-spidermonkey-token-boundary: fullStringParity=false, boundedMemory=null, contractScope=xml-token-boundary-no-string-materialization
- unchanged-stax-surface-still-blocked (SCOPE_GUARD): The official js-shells can read corpus bytes and execute Ion, but cannot run the current full-string StAX benchmark unchanged because TextDecoder and Web globals are missing.
  - release-spidermonkey-token-boundary: canRunCurrentStaxFullStringBenchmark=false
  - nightly-spidermonkey-token-boundary: canRunCurrentStaxFullStringBenchmark=false

## Limits

- This is not emitted SpiderMonkey IR or optimized-code evidence.
- This is not a full StAX benchmark: it deliberately avoids TextDecoder and string/object materialization.
- Missing memory counters mean even a fast partial row is not a bounded-memory full-string counterexample.

