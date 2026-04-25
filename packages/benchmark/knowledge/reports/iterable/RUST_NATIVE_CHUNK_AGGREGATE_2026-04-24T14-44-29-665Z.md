# Rust Native Chunk-Aggregate Spike

Generated: 2026-04-24T14:44:21.638Z
JSON: G:\programming\stax-xml\.omx\worktrees\rust-native-chunk-aggregate\packages\benchmark\knowledge\reports\iterable\RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T14-44-29-665Z.json

## Contract

- Benchmark-only native Rust/N-API lab under packages/benchmark.
- Public package exports and browser parser paths are untouched.
- Native boundary is coarse: one call per Buffer or file, never per tag/event.
- count-only is diagnostic only; full-string-direct is the primary gate.

## Gate

Status: not-evaluated
Representative size: 128 MiB
full-string-direct wins: 0/4 fixtures at >=20%
event-object-full wins: 0/4 fixtures at >=10%

## Reject/Pass Reasons

- 128MiB representative size was not included in this run

## 128 MiB Full-String Results

| Fixture | Best JS | MiB/s | Best Native | MiB/s | Improvement | Pass |
| --- | --- | ---: | --- | ---: | ---: | --- |

## Full-String Buffer Vs File

| Size MiB | Fixture | Best JS MiB/s | Native Buffer MiB/s | Native File MiB/s | Buffer Improvement | File Improvement |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 16.00 | attr-heavy | 96.1 | 449.4 | - | 367.9% | - |
| 16.00 | high-cardinality | 86.5 | 507.8 | - | 487.3% | - |
| 16.00 | mixed-utf8 | 92.1 | 466.7 | - | 406.6% | - |
| 16.00 | quoted-gt | 85.9 | 433.6 | - | 404.6% | - |

## Copy And Boundary Notes

- native-buffer uses one preloaded Node Buffer and one N-API call per measured run.
- native-file reads the file inside Rust and includes native file ingestion in the measured run.
- JS baselines use the existing iterable full parser over file byte batches.
- checksum parity is enforced for every fixture, tier, and scenario before report emission.
