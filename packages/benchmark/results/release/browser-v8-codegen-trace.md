# Browser V8 Codegen Trace

Generated: 2026-05-24T11:12:11.380Z

This report is a TRACE_FACT for one browser/V8 build and selected same-contract reader functions.
It uses browser V8 optimization status with `--allow-natives-syntax` and optional `--trace-opt --trace-deopt --trace-file-names` output. It is not a runtime ceiling proof.

## Environment

- Browser: HeadlessChrome 148.0.0.0
- JavaScript engine: V8
- User agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36
- CDP V8 version: 14.8.178.22
- Host Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture size: 4.02 MiB (4210992 bytes)
- V8 optimization status available: true

## Variant Parity

| Case | MiB/s | Events | Checksum |
| --- | ---: | ---: | ---: |
| stringFull | 49.46 | 318974 | 1006682924 |
| rawFrameNameId | 28.68 | 318974 | 1006682924 |
| eventObjectFull | 41.47 | 318974 | 1006682924 |

## Trace Summary

- Trace bytes: 541
- Trace lines: 4
- Optimization lines: 0
- Deopt lines: 0

| Function | Trace mentions | Optimization mentions | Deopt mentions |
| --- | ---: | ---: | ---: |
| consumeBrowserStringFull | 0 | 0 | 0 |
| consumeBrowserRawFrameNameId | 0 | 0 | 0 |
| consumeBrowserEventObjectFull | 0 | 0 | 0 |
| decodeBrowserSpan | 0 | 0 | 0 |
| foldBrowserString | 0 | 0 | 0 |
| materializeBrowserEventObject | 0 | 0 | 0 |

## V8 Optimization Status

| Function | Status |
| --- | ---: |
| consumeBrowserStringFull | 1 |
| consumeBrowserRawFrameNameId | 1 |
| consumeBrowserEventObjectFull | 281 |
| decodeBrowserSpan | 41 |
| foldBrowserString | 41 |
| materializeBrowserEventObject | 41 |

## Findings

- browser-v8-trace-opt-captured (TRACE_FACT): Chrome/Edge browser V8 exposed optimization-status evidence while running same-contract browser reader variants.
  - optimizationStatusAvailable=true
  - optimizedTargetFunctions=6
  - traceBytes=541
  - optimizingLines=0
  - deoptLines=0
- browser-v8-trace-same-contract (TRACE_FACT): The traced browser variants preserved full-string event count and checksum parity.
  - stringFull: events=318974, checksum=1006682924, mibPerSec=49.46
  - rawFrameNameId: events=318974, checksum=1006682924, mibPerSec=28.68
  - eventObjectFull: events=318974, checksum=1006682924, mibPerSec=41.47
- browser-v8-trace-scope-limit (TRACE_FACT_LIMIT): This is selected-function browser V8 trace evidence, not a complete generated-code proof and not a runtime ceiling proof.
  - V8 optimization status is captured from the page; raw trace logs are summarized when Chrome emits them.
  - Safari/WebKit and Firefox/SpiderMonkey codegen/allocation obligations remain separate.
