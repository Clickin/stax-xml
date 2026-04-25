# Rust Native Chunk-Aggregate Spike

Generated: 2026-04-24T13:52:23.013Z
JSON: G:\programming\stax-xml\.omx\worktrees\rust-native-chunk-aggregate\packages\benchmark\knowledge\reports\iterable\RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T13-53-31-593Z.json

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

## 512 MiB Full-String Confirmation

| Fixture | Best JS | MiB/s | Native Buffer MiB/s | Native File MiB/s | Buffer Improvement | File Improvement |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| quoted-gt | js-neutral | 113.0 | 177.8 | 137.2 | 57.3% | 21.4% |
| attr-heavy | js-neutral | 119.5 | 164.0 | 156.3 | 37.2% | 30.8% |
| high-cardinality | js-node | 113.4 | 218.2 | 203.7 | 92.4% | 79.6% |
| mixed-utf8 | js-node | 105.5 | 221.6 | 204.4 | 110.0% | 93.8% |

## Copy And Boundary Notes

- native-buffer uses one preloaded Node Buffer and one N-API call per measured run.
- native-file reads the file inside Rust and includes native file ingestion in the measured run.
- JS baselines use the existing iterable full parser over file byte batches.
- checksum parity is enforced for every fixture, tier, and scenario before report emission.
