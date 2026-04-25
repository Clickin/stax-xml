# Rust Native Chunk-Aggregate Spike

Generated: 2026-04-24T15:07:01.616Z
JSON: /Users/senghyunjo/github/stax-xml/packages/benchmark/knowledge/reports/iterable/RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T15-08-11-110Z.json

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
| quoted-gt | js-node | 107.2 | native-buffer | 513.3 | 378.6% | yes |
| attr-heavy | js-node | 126.2 | native-buffer | 497.6 | 294.3% | yes |
| high-cardinality | js-node | 107.4 | native-buffer | 521.3 | 385.3% | yes |
| mixed-utf8 | js-node | 130.0 | native-buffer | 524.2 | 303.1% | yes |

## Full-String Buffer Vs File

| Size MiB | Fixture | Best JS MiB/s | Native Buffer MiB/s | Native File MiB/s | Buffer Improvement | File Improvement |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 16.00 | attr-heavy | 117.6 | 510.1 | 489.8 | 333.8% | 316.6% |
| 16.00 | high-cardinality | 125.5 | 550.9 | 531.8 | 339.0% | 323.7% |
| 16.00 | mixed-utf8 | 126.0 | 545.5 | 528.8 | 333.0% | 319.8% |
| 16.00 | quoted-gt | 105.0 | 533.3 | 516.4 | 408.0% | 392.0% |
| 128.00 | attr-heavy | 126.2 | 497.6 | 478.4 | 294.3% | 279.1% |
| 128.00 | quoted-gt | 107.2 | 513.3 | 493.9 | 378.6% | 360.5% |
| 128.00 | mixed-utf8 | 130.0 | 524.2 | 506.8 | 303.1% | 289.7% |
| 128.00 | high-cardinality | 107.4 | 521.3 | 514.0 | 385.3% | 378.4% |

## Copy And Boundary Notes

- native-buffer uses one preloaded Node Buffer and one N-API call per measured run.
- native-file reads the file inside Rust and includes native file ingestion in the measured run.
- JS baselines use the existing iterable full parser over file byte batches.
- checksum parity is enforced for every fixture, tier, and scenario before report emission.

