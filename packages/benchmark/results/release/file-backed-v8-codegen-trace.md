# File-Backed V8 Codegen Trace

Generated: 2026-05-25T00:12:13.217Z

Node/V8 trace-opt and trace-deopt evidence for file-backed StreamReaderSync reader shapes. This is trace evidence for the source consumption and wrapper functions only; it is not a throughput ceiling proof and does not replace the 1 GiB benchmark rows.

## Summary

- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\runtime-comparison-16mib.xml
- Fixture size: 16.00 MiB
- Source shape: demand-driven file-backed Iterable<Uint8Array[]>
- Chunk KiB: 64
- Batch size: 1
- Optimized cases: 3/3
- Post-warmup deopt cases: 1
- Same event count: yes
- Same checksum: no

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\v8-codegen\file-backed-release
- Manifest: G:\programming\stax-xml\packages\benchmark\results\v8-codegen\file-backed-release\manifest.json
- Committed: no

## Trace Gate

| Case | Status | Events | Checksum | Optimized functions | Deopts warmup/post-warmup | Log bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| scan-all-no-decode | optimized-no-post-warmup-deopt | 967967 | -141941271 | 20 | 25/0 | 71499 |
| stream-full-string | deopt-after-warmup | 967967 | -746772258 | 33 | 109/10 | 136298 |
| raw-frame-name-id | optimized-no-post-warmup-deopt | 967967 | -746772258 | 23 | 24/0 | 75821 |

## Findings

- file-backed-source-shape-traced (TRACE_FACT): All cases use StreamReaderSync over demand-driven file-backed Iterable<Uint8Array[]> batches.
  - scan-all-no-decode: events=967967, checksum=-141941271
  - stream-full-string: events=967967, checksum=-746772258
  - raw-frame-name-id: events=967967, checksum=-746772258
- post-warmup-deopt-gate (TRACE_FACT): Records whether each file-backed reader shape deoptimized after the warmup marker in this Node/V8 run.
  - scan-all-no-decode: status=optimized-no-post-warmup-deopt, postWarmupDeopts=0
  - stream-full-string: status=deopt-after-warmup, postWarmupDeopts=10
  - raw-frame-name-id: status=optimized-no-post-warmup-deopt, postWarmupDeopts=0
- trace-scope-guard (SCOPE_GUARD): This narrows Node/V8 file-backed source-shape evidence but does not prove a JS runtime ceiling or cover SpiderMonkey/Safari JIT IR.
  - No throughput ceiling conclusion is allowed from this trace artifact.

## Limits

- This is Node/V8 trace evidence for a file-backed fixture, not a new throughput benchmark.
- It does not prove a JavaScript runtime ceiling and does not cover SpiderMonkey or Safari/WebKit JIT IR.
- Raw trace logs are intentionally left under the generated output directory and not committed as release artifacts.

