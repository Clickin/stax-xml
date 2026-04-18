# Async Fast-Path PoC

Generated: 2026-04-18T07:12:53.466Z
Warmup runs: 2
Measurement runs: 6

## complex.xml

| Scenario | Avg ms | Min ms | Max ms | Checksum | Delta vs published |
| --- | ---: | ---: | ---: | ---: | ---: |
| current | 0.87 | 0.55 | 1.29 | 728004874 | -17.9% |
| experimental | 0.51 | 0.39 | 0.64 | 728004874 | -51.9% |
| published-v0.5.2 | 1.06 | 0.70 | 1.96 | 728004874 | +0.0% |

## midsize.xml

| Scenario | Avg ms | Min ms | Max ms | Checksum | Delta vs published |
| --- | ---: | ---: | ---: | ---: | ---: |
| current | 475.23 | 441.14 | 503.57 | -2071307470 | -7.9% |
| experimental | 309.51 | 285.36 | 323.91 | -2071307470 | -40.0% |
| published-v0.5.2 | 516.26 | 487.78 | 552.20 | -2071307470 | +0.0% |
