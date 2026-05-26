# Materialization Span Distribution

Generated: 2026-05-26T15:54:13.168Z

Counts raw UTF-8 span length, ASCII, and trim properties for full-string materialization fields. This is distribution evidence for candidate selection, not throughput evidence and not a runtime-limit proof.

## Summary

- Event count: 75,206,126
- Attribute pairs: 12
- Implicit attribute values: 0

| Kind | Total | ASCII | 1-12 ASCII | 13-24 ASCII | 25+ ASCII | Non-ASCII | Avg bytes | Trim changed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| name | 58,503,984 | 100.00% | 58,335,744 | 168,240 | 0 | 0 | 2.82 | 0.00% |
| text | 16,702,140 | 100.00% | 0 | 16,638,312 | 63,828 | 0 | 24.08 | 0.00% |
| attrName | 12 | 100.00% | 12 | 0 | 0 | 0 | 4.00 | 0.00% |
| attrValue | 12 | 100.00% | 12 | 0 | 0 | 0 | 8.00 | 0.00% |

## Buckets

- name: 0=0, 1-12=58,335,744, 13-24=168,240, 25-64=0, 65-256=0, 257+=0
- text: 0=0, 1-12=0, 13-24=16,638,312, 25-64=63,744, 65-256=84, 257+=0
- attrName: 0=0, 1-12=12, 13-24=0, 25-64=0, 65-256=0, 257+=0
- attrValue: 0=0, 1-12=12, 13-24=0, 25-64=0, 65-256=0, 257+=0

## Findings

- text-medium-ascii-candidate-coverage (SOURCE_FACT): Text spans have a measurable 13-24 byte ASCII cohort, so medium/unrolled ASCII text candidates exercise real corpus data.
  - text.mediumAscii=16638312
  - text.mediumAsciiRatio=99.62%
  - text.trimChanged=0
- attr-value-medium-ascii-candidate-coverage (NEGATIVE_RESULT): Attribute values have no 13-24 byte ASCII spans in this corpus-cycle fixture, so the medium ASCII attr-value candidate is not expected to hit.
  - attrValue.mediumAscii=0
  - attrValue.shortAscii=12
  - attrValue.longAscii=0
- distribution-artifact-scope (SCOPE_GUARD): This artifact describes materialization span shape only; it is not a throughput benchmark or runtime-limit proof.
  - No MiB/s row is emitted.
  - No 200 MiB/s counterexample can be inferred from this artifact alone.

