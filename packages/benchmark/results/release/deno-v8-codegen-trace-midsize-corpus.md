# Deno V8 Codegen Trace

Generated: 2026-05-31T22:39:33.219Z

Deno/V8 trace-opt and trace-deopt signals for selected stax-xml reader rows. This is runtime-specific TRACE_FACT evidence, not a throughput benchmark, allocation profile, or runtime ceiling proof.

## Environment

- Deno: 2.7.13 (stable, release, x86_64-pc-windows-msvc)
- V8: 14.7.173.20-rusty
- TypeScript: 5.9.2
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: corpus-file (G:\programming\stax-xml\packages\benchmark\assets\midsize.xml), 14017532 bytes
- Runs: warmups=2, iterations=1

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\deno-v8-codegen\trace-1780267172640
- Manifest: G:\programming\stax-xml\packages\benchmark\results\deno-v8-codegen\trace-1780267172640\manifest.json
- Committed: no

## Trace Gate

| Case | Status | Events | Checksum | Target optimized functions | Compilation targets | Deopts warmup/post-warmup |
| --- | --- | ---: | ---: | --- | --- | ---: |
| raw-frame-name-id-cache | deopt-after-warmup | 1013762 | 1553514899 | consumeRawFrame, materializeName, decodeSpan, foldString, parseBuffer, parseTag, parseStartTag | MAGLEV, TURBOFAN_JS | 14/2 |

## Findings

- deno-v8-optimization-seen (TRACE_FACT): Deno/V8 emitted trace-opt signals for selected stax-xml parser and reader functions over a corpus-file byte fixture.
  - raw-frame-name-id-cache: targets=MAGLEV/TURBOFAN_JS, optimizedTargets=consumeRawFrame,materializeName,decodeSpan,foldString,parseBuffer,parseTag,parseStartTag
- post-warmup-deopt-observed (TRACE_FACT): Records whether each case deoptimized after the warmup marker; this is a trace observation, not a ceiling proof.
  - raw-frame-name-id-cache: warmupDeopts=14, postWarmupDeopts=2
- scope-guard (SCOPE_GUARD): This trace is a selected-function Deno/V8 corpus-file run, not a 1 GiB throughput benchmark, allocation profile, browser trace, or impossibility proof.
  - Deno trace flags used: --trace-opt,--trace-deopt,--trace-file-names
