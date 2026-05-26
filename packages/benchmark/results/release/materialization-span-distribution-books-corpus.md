# Materialization Span Distribution

Generated: 2026-05-26T15:27:08.689Z

Counts raw UTF-8 span length, ASCII, and trim properties for full-string materialization fields. This is distribution evidence for candidate selection, not throughput evidence and not a runtime-limit proof.

## Summary

- Event count: 57,096,514
- Attribute pairs: 2,831,232
- Implicit attribute values: 0

| Kind | Total | ASCII | 1-12 ASCII | 13-24 ASCII | 25+ ASCII | Non-ASCII | Avg bytes | Trim changed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| name | 40,109,120 | 100.00% | 40,109,120 | 0 | 0 | 0 | 6.86 | 0.00% |
| text | 16,987,392 | 100.00% | 10,617,120 | 2,831,232 | 3,539,040 | 0 | 29.24 | 0.00% |
| attrName | 2,831,232 | 100.00% | 2,831,232 | 0 | 0 | 0 | 2.00 | 0.00% |
| attrValue | 2,831,232 | 100.00% | 2,831,232 | 0 | 0 | 0 | 5.00 | 0.00% |

## Buckets

- name: 0=0, 1-12=40,109,120, 13-24=0, 25-64=0, 65-256=0, 257+=0
- text: 0=0, 1-12=10,617,120, 13-24=2,831,232, 25-64=943,744, 65-256=2,595,296, 257+=0
- attrName: 0=0, 1-12=2,831,232, 13-24=0, 25-64=0, 65-256=0, 257+=0
- attrValue: 0=0, 1-12=2,831,232, 13-24=0, 25-64=0, 65-256=0, 257+=0

## Findings

- text-medium-ascii-candidate-coverage (SOURCE_FACT): Text spans have a measurable 13-24 byte ASCII cohort, so medium/unrolled ASCII text candidates exercise real corpus data.
  - text.mediumAscii=2831232
  - text.mediumAsciiRatio=16.67%
  - text.trimChanged=0
- attr-value-medium-ascii-candidate-coverage (NEGATIVE_RESULT): Attribute values have no 13-24 byte ASCII spans in this corpus-cycle fixture, so the medium ASCII attr-value candidate is not expected to hit.
  - attrValue.mediumAscii=0
  - attrValue.shortAscii=2831232
  - attrValue.longAscii=0
- distribution-artifact-scope (SCOPE_GUARD): This artifact describes materialization span shape only; it is not a throughput benchmark or runtime-limit proof.
  - No MiB/s row is emitted.
  - No 200 MiB/s counterexample can be inferred from this artifact alone.

