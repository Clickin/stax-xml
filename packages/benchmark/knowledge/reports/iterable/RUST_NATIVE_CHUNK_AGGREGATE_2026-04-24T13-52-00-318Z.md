# Rust Native Chunk-Aggregate Spike

Generated: 2026-04-24T13:51:10.203Z
JSON: G:\programming\stax-xml\.omx\worktrees\rust-native-chunk-aggregate\packages\benchmark\knowledge\reports\iterable\RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T13-52-00-318Z.json

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
| quoted-gt | js-neutral | 99.9 | native-buffer | 177.9 | 78.1% | yes |
| attr-heavy | js-neutral | 106.8 | native-buffer | 166.5 | 56.0% | yes |
| high-cardinality | js-node | 103.0 | native-buffer | 218.9 | 112.5% | yes |
| mixed-utf8 | js-node | 101.7 | native-buffer | 217.1 | 113.5% | yes |

## Full-String Buffer Vs File

| Size MiB | Fixture | Best JS MiB/s | Native Buffer MiB/s | Native File MiB/s | Buffer Improvement | File Improvement |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 16.00 | quoted-gt | 93.5 | 177.2 | 167.6 | 89.5% | 79.2% |
| 16.00 | attr-heavy | 96.6 | 165.3 | 156.1 | 71.1% | 61.6% |
| 16.00 | high-cardinality | 83.9 | 217.5 | 201.0 | 159.3% | 139.6% |
| 16.00 | mixed-utf8 | 87.3 | 215.7 | 199.2 | 147.0% | 128.1% |
| 128.00 | quoted-gt | 99.9 | 177.9 | 168.7 | 78.1% | 68.9% |
| 128.00 | attr-heavy | 106.8 | 166.5 | 151.4 | 56.0% | 41.8% |
| 128.00 | high-cardinality | 103.0 | 218.9 | 202.3 | 112.5% | 96.3% |
| 128.00 | mixed-utf8 | 101.7 | 217.1 | 171.6 | 113.5% | 68.7% |

## Copy And Boundary Notes

- native-buffer uses one preloaded Node Buffer and one N-API call per measured run.
- native-file reads the file inside Rust and includes native file ingestion in the measured run.
- JS baselines use the existing iterable full parser over file byte batches.
- checksum parity is enforced for every fixture, tier, and scenario before report emission.
