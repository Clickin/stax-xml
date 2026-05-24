# Bun/JSC Heap Allocation Profile

Generated: 2026-05-24T10:16:26.269Z

This report is an ALLOCATION_FACT for one Bun/JSC build and one generated fixture.
It summarizes `bun --heap-prof-md` retained heap snapshots around same-contract full-string JavaScript reader rows.
It is not a JavaScriptCore allocation census, not Safari/browser evidence, and not a runtime ceiling proof.

## Runtime

- Bun revision: 1.3.13+bf2e2cecf
- Bun version: 1.3.13
- WebKit commit: 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
- Host Node: v24.15.0
- Host platform: win32-x64

## Full String Parity

- Status: ok
- Event count: 2824406
- Checksum: 288962256
- Rows: stringFull, eventObjectFull, rawFrameNameId

## Cases

| Case | MiB/s | Events | Checksum | Bounded | Max RSS MiB | Heap bytes | Objects | GC roots | Top retained types |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |
| stringFull | 103.35 | 2824406 | 288962256 | yes | 200.74 | 2261034 | 12930 | 545 | <root>:2.1 MB, Structure:1.4 MB, FunctionCodeBlock:1.0 MB, FunctionExecutable:1001.5 KB, Function:623.6 KB |
| eventObjectFull | 56.04 | 2824406 | 288962256 | yes | 200.87 | 2298072 | 12955 | 550 | <root>:2.1 MB, Structure:2.0 MB, FunctionCodeBlock:1.0 MB, FunctionExecutable:1.0 MB, Function:627.6 KB |
| rawFrameNameId | 75.37 | 2824406 | 288962256 | yes | 191.73 | 2198945 | 12876 | 533 | <root>:2.0 MB, Structure:1.6 MB, FunctionExecutable:1.0 MB, FunctionCodeBlock:971.6 KB, Function:629.7 KB |

## Raw Artifacts

- Raw heap profile markdown files are not committed.
- stringFull heap profile: G:\programming\stax-xml\packages\benchmark\results\bun-jsc-heap-allocation-profile\bun-jsc-heap-allocation-profile-release\stringFull
- stringFull benchmark JSON: G:\programming\stax-xml\packages\benchmark\results\bun-jsc-heap-allocation-profile\bun-jsc-heap-allocation-profile-release\stringFull-benchmark.json
- eventObjectFull heap profile: G:\programming\stax-xml\packages\benchmark\results\bun-jsc-heap-allocation-profile\bun-jsc-heap-allocation-profile-release\eventObjectFull
- eventObjectFull benchmark JSON: G:\programming\stax-xml\packages\benchmark\results\bun-jsc-heap-allocation-profile\bun-jsc-heap-allocation-profile-release\eventObjectFull-benchmark.json
- rawFrameNameId heap profile: G:\programming\stax-xml\packages\benchmark\results\bun-jsc-heap-allocation-profile\bun-jsc-heap-allocation-profile-release\rawFrameNameId
- rawFrameNameId benchmark JSON: G:\programming\stax-xml\packages\benchmark\results\bun-jsc-heap-allocation-profile\bun-jsc-heap-allocation-profile-release\rawFrameNameId-benchmark.json

## Findings

- same-contract-result (ALLOCATION_FACT): All Bun/JSC heap-profiled rows preserved the same full-string event count and checksum.
  - stringFull: events=2824406, checksum=288962256
  - eventObjectFull: events=2824406, checksum=288962256
  - rawFrameNameId: events=2824406, checksum=288962256
- retained-heap-snapshot (ALLOCATION_FACT): Bun --heap-prof-md emitted retained JavaScriptCore heap snapshots with object/type counts for each row.
  - stringFull: heapBytes=2261034, objects=12930, gcRoots=545
  - eventObjectFull: heapBytes=2298072, objects=12955, gcRoots=550
  - rawFrameNameId: heapBytes=2198945, objects=12876, gcRoots=533
- heap-profile-not-allocation-census (TRACE_FACT_LIMIT): The Bun heap profile is retained-heap evidence after the profiled process exits, not a per-allocation census or a browser Safari/WebKit measurement.
  - It strengthens Bun/JSC allocation evidence beyond endpoint memory counters.
  - It does not close Safari/browser JSC rows, Bun/JSC IR/codegen, or non-V8 browser allocation evidence.
