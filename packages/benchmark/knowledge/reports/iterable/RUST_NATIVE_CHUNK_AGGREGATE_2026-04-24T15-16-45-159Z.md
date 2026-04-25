# Rust Native Chunk-Aggregate Spike

Generated: 2026-04-24T15:15:33.975Z
JSON: /home/senghyunjo.linux/stax-xml-native-linux-vm/packages/benchmark/knowledge/reports/iterable/RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T15-16-45-159Z.json

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
| quoted-gt | js-node | 106.9 | native-buffer | 469.7 | 339.4% | yes |
| attr-heavy | js-node | 121.5 | native-buffer | 453.0 | 273.0% | yes |
| high-cardinality | js-node | 129.5 | native-buffer | 519.1 | 300.9% | yes |
| mixed-utf8 | js-node | 130.3 | native-buffer | 485.7 | 272.7% | yes |

## Full-String Buffer Vs File

| Size MiB | Fixture | Best JS MiB/s | Native Buffer MiB/s | Native File MiB/s | Buffer Improvement | File Improvement |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 16.00 | attr-heavy | 107.8 | 465.8 | 431.8 | 332.1% | 300.5% |
| 16.00 | high-cardinality | 107.0 | 517.1 | 475.4 | 383.2% | 344.3% |
| 16.00 | mixed-utf8 | 113.8 | 489.2 | 457.8 | 329.8% | 302.2% |
| 16.00 | quoted-gt | 97.1 | 480.0 | 437.1 | 394.4% | 350.2% |
| 128.00 | attr-heavy | 121.5 | 453.0 | 419.3 | 273.0% | 245.2% |
| 128.00 | quoted-gt | 106.9 | 469.7 | 430.9 | 339.4% | 303.1% |
| 128.00 | mixed-utf8 | 130.3 | 485.7 | 441.1 | 272.7% | 238.5% |
| 128.00 | high-cardinality | 129.5 | 519.1 | 473.8 | 300.9% | 265.9% |

## Copy And Boundary Notes

- native-buffer uses one preloaded Node Buffer and one N-API call per measured run.
- native-file reads the file inside Rust and includes native file ingestion in the measured run.
- JS baselines use the existing iterable full parser over file byte batches.
- checksum parity is enforced for every fixture, tier, and scenario before report emission.

