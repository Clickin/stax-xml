# Async Fast-Path PoC

Generated: 2026-04-18T06:05:36.634Z
Warmup runs: 1
Measurement runs: 3

## complex.xml

| Scenario | Avg ms | Min ms | Max ms | Checksum | Delta vs published |
| --- | ---: | ---: | ---: | ---: | ---: |
| current | 0.88 | 0.73 | 1.18 | -1444026357 | +41.8% |
| experimental | 0.70 | 0.53 | 1.01 | -1262662265 | +12.6% |
| published-v0.5.2 | 0.62 | 0.52 | 0.69 | -1262662265 | +0.0% |

## midsize.xml

| Scenario | Avg ms | Min ms | Max ms | Checksum | Delta vs published |
| --- | ---: | ---: | ---: | ---: | ---: |
| current | 583.92 | 522.25 | 616.30 | -890459629 | +10.3% |
| experimental | 418.32 | 387.52 | 458.69 | -890459629 | -21.0% |
| published-v0.5.2 | 529.55 | 473.72 | 576.98 | -890459629 | +0.0% |
