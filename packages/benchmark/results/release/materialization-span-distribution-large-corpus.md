# Materialization Span Distribution

Generated: 2026-05-26T15:54:24.967Z

Counts raw UTF-8 span length, ASCII, and trim properties for full-string materialization fields. This is distribution evidence for candidate selection, not throughput evidence and not a runtime-limit proof.

## Summary

- Event count: 83,635,224
- Attribute pairs: 5,322,240
- Implicit attribute values: 0

| Kind | Total | ASCII | 1-12 ASCII | 13-24 ASCII | 25+ ASCII | Non-ASCII | Avg bytes | Trim changed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| name | 60,825,622 | 100.00% | 60,825,622 | 0 | 0 | 0 | 6.72 | 0.00% |
| text | 22,809,600 | 100.00% | 18,247,680 | 3,041,280 | 1,520,640 | 0 | 6.90 | 0.00% |
| attrName | 5,322,240 | 100.00% | 5,322,240 | 0 | 0 | 0 | 4.86 | 0.00% |
| attrValue | 5,322,240 | 100.00% | 4,561,920 | 0 | 760,320 | 0 | 7.00 | 0.00% |

## Buckets

- name: 0=0, 1-12=60,825,622, 13-24=0, 25-64=0, 65-256=0, 257+=0
- text: 0=0, 1-12=18,247,680, 13-24=3,041,280, 25-64=1,520,640, 65-256=0, 257+=0
- attrName: 0=0, 1-12=5,322,240, 13-24=0, 25-64=0, 65-256=0, 257+=0
- attrValue: 0=0, 1-12=4,561,920, 13-24=0, 25-64=760,320, 65-256=0, 257+=0

## Findings

- text-medium-ascii-candidate-coverage (SOURCE_FACT): Text spans have a measurable 13-24 byte ASCII cohort, so medium/unrolled ASCII text candidates exercise real corpus data.
  - text.mediumAscii=3041280
  - text.mediumAsciiRatio=13.33%
  - text.trimChanged=0
- attr-value-medium-ascii-candidate-coverage (NEGATIVE_RESULT): Attribute values have no 13-24 byte ASCII spans in this corpus-cycle fixture, so the medium ASCII attr-value candidate is not expected to hit.
  - attrValue.mediumAscii=0
  - attrValue.shortAscii=4561920
  - attrValue.longAscii=760320
- distribution-artifact-scope (SCOPE_GUARD): This artifact describes materialization span shape only; it is not a throughput benchmark or runtime-limit proof.
  - No MiB/s row is emitted.
  - No 200 MiB/s counterexample can be inferred from this artifact alone.

