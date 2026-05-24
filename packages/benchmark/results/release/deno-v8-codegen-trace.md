# Deno V8 Codegen Trace

Generated: 2026-05-24T17:30:35.152Z

Deno/V8 trace-opt and trace-deopt signals for selected stax-xml reader rows. This is runtime-specific TRACE_FACT evidence, not a throughput benchmark, allocation profile, or runtime ceiling proof.

## Environment

- Deno: 2.7.13 (stable, release, x86_64-pc-windows-msvc)
- V8: 14.7.173.20-rusty
- TypeScript: 5.9.2
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: 128 generated elements, 8892 bytes
- Runs: warmups=24, iterations=6

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\deno-v8-codegen\trace-1779643834392
- Manifest: G:\programming\stax-xml\packages\benchmark\results\deno-v8-codegen\trace-1779643834392\manifest.json
- Committed: no

## Trace Gate

| Case | Status | Events | Checksum | Target optimized functions | Compilation targets | Deopts warmup/post-warmup |
| --- | --- | ---: | ---: | --- | --- | ---: |
| public-accessor | target-optimized-no-post-warmup-deopt | 2180 | 1331061553 | consumePublicAccessor, materializeName, decodeSpan, foldString, parseBuffer, parseTag, parseStartTag | MAGLEV, TURBOFAN_JS | 37/0 |
| raw-frame-direct-decode | target-optimized-no-post-warmup-deopt | 2180 | 1331061553 | consumeRawFrame, materializeName, decodeSpan, foldString, parseBuffer, parseTag, parseStartTag | MAGLEV, TURBOFAN_JS | 11/0 |
| raw-frame-name-id-cache | target-optimized-no-post-warmup-deopt | 2180 | 1331061553 | consumeRawFrame, materializeName, decodeSpan, foldString, parseBuffer, parseTag, parseStartTag | MAGLEV, TURBOFAN_JS | 13/0 |

## Findings

- deno-v8-optimization-seen (TRACE_FACT): Deno/V8 emitted trace-opt signals for selected stax-xml parser and reader functions in this small generated workload.
  - public-accessor: targets=MAGLEV/TURBOFAN_JS, optimizedTargets=consumePublicAccessor,materializeName,decodeSpan,foldString,parseBuffer,parseTag,parseStartTag
  - raw-frame-direct-decode: targets=MAGLEV/TURBOFAN_JS, optimizedTargets=consumeRawFrame,materializeName,decodeSpan,foldString,parseBuffer,parseTag,parseStartTag
  - raw-frame-name-id-cache: targets=MAGLEV/TURBOFAN_JS, optimizedTargets=consumeRawFrame,materializeName,decodeSpan,foldString,parseBuffer,parseTag,parseStartTag
- post-warmup-deopt-observed (TRACE_FACT): Records whether each case deoptimized after the warmup marker; this is a trace observation, not a ceiling proof.
  - public-accessor: warmupDeopts=37, postWarmupDeopts=0
  - raw-frame-direct-decode: warmupDeopts=11, postWarmupDeopts=0
  - raw-frame-name-id-cache: warmupDeopts=13, postWarmupDeopts=0
- scope-guard (SCOPE_GUARD): This trace is a small selected-function Deno/V8 run, not a 1 GiB benchmark, allocation profile, browser trace, or impossibility proof.
  - Deno trace flags used: --trace-opt,--trace-deopt,--trace-file-names
