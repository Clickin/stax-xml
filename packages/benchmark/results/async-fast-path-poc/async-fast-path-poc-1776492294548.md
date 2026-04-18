# Async Fast-Path PoC

Generated: 2026-04-18T06:04:54.548Z
Warmup runs: 2
Measurement runs: 6

## complex.xml

| Scenario | Avg ms | Min ms | Max ms | Checksum | Delta vs published |
| --- | ---: | ---: | ---: | ---: | ---: |
| current | 0.73 | 0.50 | 1.01 | 2135759058 | -31.2% |
| experimental | 0.42 | 0.37 | 0.47 | 728004874 | -60.2% |
| published-v0.5.2 | 1.06 | 0.56 | 2.75 | 728004874 | +0.0% |

## midsize.xml

| Scenario | Avg ms | Min ms | Max ms | Checksum | Delta vs published |
| --- | ---: | ---: | ---: | ---: | ---: |
| current | 552.38 | 502.52 | 629.58 | -2071307470 | +11.3% |
| experimental | 404.18 | 348.46 | 446.48 | -2071307470 | -18.6% |
| published-v0.5.2 | 496.40 | 465.67 | 593.28 | -2071307470 | +0.0% |
