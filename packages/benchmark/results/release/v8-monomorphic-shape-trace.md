# V8 Monomorphic Shape Trace

Generated: 2026-05-23T08:45:07.874Z

This report is a TRACE_FACT for one Node/V8 build and one generated fixture.
It summarizes raw V8 trace/optimized-code logs without committing those large raw logs.
It is not a proof that JavaScript runtimes have no further headroom.

## Environment

- Node: v24.15.0
- V8: 13.6.233.17-node.48
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: 128 generated elements, 35854 bytes
- Runs: warmups=24, iterations=6

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\v8-codegen\monomorphic-shape-release
- Manifest: G:\programming\stax-xml\packages\benchmark\results\v8-codegen\monomorphic-shape-release\manifest.json
- Committed: no

## Trace Gate

| Case | Status | Events | Checksum | Optimized functions | Deopts warmup/post-warmup |
| --- | --- | ---: | ---: | ---: | ---: |
| public-accessor | optimized-no-post-warmup-deopt | 2180 | 1331061553 | 15 | 35/0 |
| raw-frame-direct-decode | optimized-no-post-warmup-deopt | 2180 | 1331061553 | 15 | 11/0 |
| raw-frame-name-id-cache | optimized-no-post-warmup-deopt | 2180 | 1331061553 | 13 | 15/0 |

## Optimized-Code Signals

| Case | Native/runtime/IC/deopt signals | Optcode files |
| --- | --- | ---: |
| public-accessor | CEntry=22, TypedArrayPrototypeSubArray=1, DeoptExit=432 | 7 |
| raw-frame-direct-decode | CEntry=45, TypedArrayPrototypeSubArray=8, DeoptExit=988 | 7 |
| raw-frame-name-id-cache | CEntry=25, TypedArrayPrototypeSubArray=4, DeoptExit=528 | 7 |

## Findings

- post-warmup-deopt-gate: Records whether each reader shape deoptimized after the warmup marker in this Node/V8 run.
  - public-accessor: status=optimized-no-post-warmup-deopt, postWarmupDeopts=0
  - raw-frame-direct-decode: status=optimized-no-post-warmup-deopt, postWarmupDeopts=0
  - raw-frame-name-id-cache: status=optimized-no-post-warmup-deopt, postWarmupDeopts=0
- optimized-code-risk-signals: Counts selected V8 optimized-code/runtime/native-call signals in filtered optcode logs.
  - public-accessor: CEntry=22, TypedArrayPrototypeSubArray=1, DeoptExit=432
  - raw-frame-direct-decode: CEntry=45, TypedArrayPrototypeSubArray=8, DeoptExit=988
  - raw-frame-name-id-cache: CEntry=25, TypedArrayPrototypeSubArray=4, DeoptExit=528
