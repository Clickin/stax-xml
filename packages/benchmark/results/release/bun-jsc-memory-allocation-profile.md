# Bun/JSC Memory Allocation Profile

Generated: 2026-05-24T09:02:29.869Z

## Scope

This is an `ALLOCATION_FACT` for selected Bun/JSC candidate rows using `process.memoryUsage()` endpoints. It is not a JavaScriptCore allocation census, not a heap snapshot, not a codegen trace, and not a 200 MiB/s ceiling proof.

## Runtime

- Runtime: bun / JavaScriptCore
- Bun: 1.3.13
- Bun revision: 1.3.13+bf2e2cecf
- WebKit commit: 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
- process.memoryUsage: function
- globalThis.gc: undefined
- Fixture: diverse-cycle, 64.0 MiB target
- Runs: 3
- Cases: scanAllNoDecode, stringFull, eventObjectFull, rawFrameNameId

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\bun-jsc-memory-allocation-profile\bun-jsc-memory-allocation-profile-release
- Committed: no
- Reason: Per-case benchmark JSON/MD and run logs are generated evidence files; the release artifact keeps the curated memory summary.

## Cases

| Case | MiB/s | Events | Checksum | Strings | Max RSS | Max heap used | Avg RSS delta | Avg heap delta | External max | ArrayBuffer max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `scanAllNoDecode` | 216.04 | 2,824,406 | 440083655 | 0 | 190.0 MiB | 5.5 MiB | +14.2 MiB | +1.8 MiB | 963.9 KiB | 339 B |
| `stringFull` | 97.49 | 2,824,406 | 288962256 | 6,419,100 | 199.3 MiB | 12.9 MiB | +15.3 MiB | +4.2 MiB | 15.7 MiB | 14.7 MiB |
| `eventObjectFull` | 69.15 | 2,824,406 | 288962256 | 6,419,100 | 201.0 MiB | 21.2 MiB | +17.6 MiB | +5.9 MiB | 17.9 MiB | 16.8 MiB |
| `rawFrameNameId` | 110.86 | 2,824,406 | 288962256 | 6,419,100 | 194.9 MiB | 21.5 MiB | +16.2 MiB | +7.1 MiB | 17.8 MiB | 16.8 MiB |

## Full String Parity

- Status: ok
- Rows: stringFull, eventObjectFull, rawFrameNameId
- Event count: 2,824,406
- Checksum: 288962256

## Findings

### bun-memory-endpoint-profile-visible

Classification: ALLOCATION_FACT

Bun/JSC exposed process.memoryUsage endpoint samples for selected candidate rows.

- cases=scanAllNoDecode,stringFull,eventObjectFull,rawFrameNameId
- runs=3
- memoryApi=function
- fastestFull=rawFrameNameId 110.86 MiB/s

### full-string-parity-preserved

Classification: BENCH_FACT

The profiled full-string rows preserved the same event count and checksum.

- status=ok
- rows=stringFull,eventObjectFull,rawFrameNameId
- eventCount=2,824,406
- checksum=288962256

### endpoint-profile-not-census

Classification: SCOPE_GUARD

process.memoryUsage endpoints are coarse process snapshots, not a JavaScriptCore allocation census or heap object lifetime proof.

- Samples are before/after measured runs, not per-allocation events.
- RSS includes runtime and allocator behavior outside JavaScript heap objects.
- A future 200 MiB/s bounded-memory full-string row would still be a counterexample.

## Interpretation

This artifact narrows the Bun/JSC allocation/profile gap by recording process memory endpoint behavior for the same partial/full candidate row vocabulary. It still cannot prove JavaScriptCore object allocation counts, string lifetime, or an optimized-code ceiling.
