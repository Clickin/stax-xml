# Firefox/SpiderMonkey Profiler Trace

Generated: 2026-05-24T18:41:37.688Z

This report captures a Gecko Profiler startup/shutdown profile around the Firefox BiDi same-contract reader harness.
It is sampled SpiderMonkey/Gecko profile evidence, not JIT IR, not a deterministic optimized-code dump, and not a JavaScript runtime ceiling proof.

## Options

- Fixture shape: diverse-cycle
- Size GiB: 0.01
- Cases: stringFull, eventObjectFull, rawFrameNameId
- Profiler features: js,stackwalk,cpu
- Raw profile committed: no

## Variants

| Variant | Throughput | Events | Checksum | Full-string parity |
| --- | ---: | ---: | ---: | --- |
| stringFull | 46.85 MiB/s | 460176 | -1469723734 | yes |
| eventObjectFull | 38.91 MiB/s | 460176 | -1469723734 | yes |
| rawFrameNameId | 51.70 MiB/s | 460176 | -1469723734 | yes |

## Profile Summary

- Threads: 7
- Samples: 9054
- Frames: 9640
- JS-relevant frames: 300
- Interval: 1
- Stackwalk: 1
- Features: js, stackwalk, cpu

## Target Term Hits

| Term | Frame locations | Sample stacks |
| --- | ---: | ---: |
| consumeRawFrame | 0 | 0 |
| consumePublicAccessor | 0 | 0 |
| consumeEventObject | 0 | 0 |
| materialize | 0 | 0 |
| decode | 0 | 0 |
| TextDecoder | 0 | 0 |
| foldString | 0 | 0 |

## Threads

### GeckoMain

- Samples: 1425
- Frames: 8904
- JS-relevant frames: 284
- Top sampled locations:
  - js::RunScript (1958)
  - (root) (1425)
  - 0x7ffb6d4e427c (1418)
  - 0x7ffb6bcce957 (1418)
  - 0x7ff7010b8858 (1418)
  - XREMain::XRE_main (1409)

### Renderer

- Samples: 1325
- Frames: 172
- JS-relevant frames: 0
- Top sampled locations:
  - (root) (1325)
  - 0x7ffb6d4e427c (1325)
  - 0x7ffaaab09c49 (1325)
  - 0x7ffb6bcce957 (1325)
  - 0x7ffb6a5a37b0 (1325)
  - 0x7ffa80586381 (1325)

### WinCompositor

- Samples: 1325
- Frames: 13
- JS-relevant frames: 0
- Top sampled locations:
  - (root) (1325)
  - 0x7ffb6d4e427c (1325)
  - 0x7ffaaab09c49 (1325)
  - 0x7ffb6bcce957 (1325)
  - 0x7ffa125c7f51 (1325)
  - 0x7ffa125c80fd (1325)

### Compositor

- Samples: 1328
- Frames: 122
- JS-relevant frames: 0
- Top sampled locations:
  - (root) (1328)
  - 0x7ffb6d4e427c (1328)
  - 0x7ffaaab09c49 (1328)
  - 0x7ffb6bcce957 (1328)
  - 0x7ffb6a5a37b0 (1328)
  - 0x7ffa80586381 (1328)

### CanvasRenderer

- Samples: 1323
- Frames: 19
- JS-relevant frames: 0
- Top sampled locations:
  - (root) (1323)
  - 0x7ffb6d4e427c (1323)
  - 0x7ffaaab09c49 (1323)
  - 0x7ffb6bcce957 (1323)
  - 0x7ffb6a5a37b0 (1323)
  - 0x7ffa80586381 (1323)

### DOM Worker

- Samples: 1265
- Frames: 328
- JS-relevant frames: 12
- Top sampled locations:
  - 0x7ffa13df61ec (1358)
  - (root) (1265)
  - 0x7ffb6d4e427c (1265)
  - 0x7ffaaab09c49 (1265)
  - 0x7ffb6bcce957 (1265)
  - 0x7ffb6a5a37b0 (1265)

### DOM Worker

- Samples: 1063
- Frames: 82
- JS-relevant frames: 4
- Top sampled locations:
  - 0x7ffa13df61ec (1133)
  - (root) (1063)
  - 0x7ffb6d4e427c (1063)
  - 0x7ffaaab09c49 (1063)
  - 0x7ffb6bcce957 (1063)
  - 0x7ffb6a5a37b0 (1063)

## Findings

- gecko-profiler-profile-captured (TRACE_FACT): Firefox wrote a Gecko Profiler JSON profile for the same browser reader harness through graceful BiDi browser.close shutdown.
  - threads=7
  - samples=9054
  - frames=9640
  - features=js,stackwalk,cpu
- same-contract-profiled-run (BENCH_FACT): The profiled Firefox run preserved same-contract event count and checksum parity for selected full-string rows.
  - stringFull: events=460176, checksum=-1469723734, throughput=46.85 MiB/s
  - eventObjectFull: events=460176, checksum=-1469723734, throughput=38.91 MiB/s
  - rawFrameNameId: events=460176, checksum=-1469723734, throughput=51.70 MiB/s
- spidermonkey-profiler-target-frame-evidence (LIMITED_EVIDENCE): The sampled profile was captured, but benchmark-specific JavaScript frame names were not visible in the summarized frame table.
  - targetFrameHits=0
- not-jit-ir-or-runtime-ceiling-proof (SCOPE_GUARD): Gecko Profiler samples are not SpiderMonkey JIT IR, not a deterministic optimized-code dump, and not a proof that no faster JavaScript implementation exists.
  - Use this as runtime-specific profile evidence only.
  - Safari/WebKit browser rows remain separate.
