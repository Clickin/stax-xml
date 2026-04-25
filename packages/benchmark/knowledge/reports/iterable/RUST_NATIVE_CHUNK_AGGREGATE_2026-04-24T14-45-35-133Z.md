# Rust Native Chunk-Aggregate Spike

Generated: 2026-04-24T14:44:34.048Z
JSON: G:\programming\stax-xml\.omx\worktrees\rust-native-chunk-aggregate\packages\benchmark\knowledge\reports\iterable\RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T14-45-35-133Z.json

## Contract

- Benchmark-only native Rust/N-API lab under packages/benchmark.
- Public package exports and browser parser paths are untouched.
- Native boundary is coarse: one call per Buffer or file, never per tag/event.
- count-only is diagnostic only; full-string-direct is the primary gate.

## Gate

Status: pass
Representative size: 128 MiB
full-string-direct wins: 4/4 fixtures at >=20%
event-object-full wins: 4/4 fixtures at >=10%

## 128 MiB Full-String Results

| Fixture | Best JS | MiB/s | Best Native | MiB/s | Improvement | Pass |
| --- | --- | ---: | --- | ---: | ---: | --- |
| quoted-gt | js-node | 92.1 | native-buffer | 427.3 | 364.0% | yes |
| attr-heavy | js-node | 101.6 | native-buffer | 446.8 | 339.9% | yes |
| high-cardinality | js-node | 99.6 | native-buffer | 504.9 | 406.8% | yes |
| mixed-utf8 | js-node | 95.9 | native-buffer | 462.2 | 381.9% | yes |

## Full-String Buffer Vs File

| Size MiB | Fixture | Best JS MiB/s | Native Buffer MiB/s | Native File MiB/s | Buffer Improvement | File Improvement |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 128.00 | attr-heavy | 101.6 | 446.8 | - | 339.9% | - |
| 128.00 | quoted-gt | 92.1 | 427.3 | - | 364.0% | - |
| 128.00 | mixed-utf8 | 95.9 | 462.2 | - | 381.9% | - |
| 128.00 | high-cardinality | 99.6 | 504.9 | - | 406.8% | - |

## Copy And Boundary Notes

- native-buffer uses one preloaded Node Buffer and one N-API call per measured run.
- native-file reads the file inside Rust and includes native file ingestion in the measured run.
- JS baselines use the existing iterable full parser over file byte batches.
- checksum parity is enforced for every fixture, tier, and scenario before report emission.

