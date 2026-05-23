# Bun/JSC CPU Profile

Generated: 2026-05-23T22:13:43.860Z

## Scope

This is a `TRACE_FACT` for selected Bun/JSC candidate rows using Bun CPU profiler sampling. It is not a codegen trace, not an allocation census, and not a 200 MiB/s ceiling proof.

## Runtime

- Runtime: bun / JavaScriptCore
- Bun: 1.3.13
- Bun revision: 1.3.13+bf2e2cecf
- WebKit commit: 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
- Fixture: diverse-cycle, 64.0 MiB target
- Cases: scanAllNoDecode, stringFull, eventObjectFull, rawFrameNameId

## Raw Artifacts

- Output dir: G:\programming\stax-xml\packages\benchmark\results\bun-jsc-cpu-profile\bun-jsc-cpu-profile-release
- Committed: no
- Reason: Raw .cpuprofile, markdown profile, per-case benchmark JSON/MD, and run logs are generated evidence files; the release artifact keeps only the curated summary.

## Profile Totals

- Samples: 329
- Profiled duration: 2547.57 ms
- stax-xml self time: 38.78%
- benchmark harness self time: 22.67%
- native/internal self time: 38.56%

## Cases

| Case | MiB/s | Events | Checksum | Strings | Max RSS | Samples | stax-xml self | Top self functions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `scanAllNoDecode` | 223.32 | 2,824,406 | 440083655 | 0 | 195.23 MiB | 45 | 65.60% | parseEndTag 22.24%; indexOf 17.26%; internName 10.37%; parseStartTag 9.57% |
| `stringFull` | 102.29 | 2,824,406 | 288962256 | 6,419,100 | 205.16 MiB | 93 | 34.06% | consumeStreamSelective 19.50%; internName 13.43%; decode 10.75%; fromCharCode 9.80% |
| `eventObjectFull` | 73.39 | 2,824,406 | 288962256 | 6,419,100 | 207.66 MiB | 123 | 33.48% | materializePublicEventObject 23.80%; entries 13.30%; internName 8.05%; consumeEventObjectFull 7.31% |
| `rawFrameNameId` | 108.77 | 2,824,406 | 288962256 | 6,419,100 | 199.14 MiB | 68 | 37.25% | decode 15.07%; consumeRawFrame 12.81%; addAttribute 12.79%; fromCharCode 10.04% |

## Full String Parity

- Status: ok
- Rows: stringFull, eventObjectFull, rawFrameNameId
- Event count: 2,824,406
- Checksum: 288962256

## Findings

### bun-cpu-profiler-trace-visible

Classification: TRACE_FACT

Bun/JSC emitted CPU profiler samples for the selected candidate rows.

- cases=scanAllNoDecode,stringFull,eventObjectFull,rawFrameNameId
- samples=329
- profiledDurationMs=2547.57
- staxXmlSelf=38.78%

### full-string-parity-preserved

Classification: BENCH_FACT

The selected full-string rows preserved the same event count and checksum while profiling was enabled.

- status=ok
- rows=stringFull,eventObjectFull,rawFrameNameId
- eventCount=2,824,406
- checksum=288962256
- fastestFull=rawFrameNameId 108.77 MiB/s

### not-codegen-or-ceiling-proof

Classification: SCOPE_GUARD

Bun CPU profiler output is sampled stack evidence, not a codegen trace, not an allocation census, and not a 200 MiB/s ceiling proof.

- No JavaScriptCore optimized IR or assembly is captured.
- The profiled fixture is intentionally smaller than 1 GiB to keep profiler overhead manageable.
- A future 200 MiB/s bounded-memory full-string row would still be a counterexample.

## Interpretation

This profile adds Bun/JSC sampled stack evidence for the same partial/full candidate row vocabulary used by the 1 GiB headroom matrix. It can support hotpath triage, but it does not replace JavaScriptCore codegen evidence and does not justify concluding that JavaScript runtimes cannot reach the target.
