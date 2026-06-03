# Text Materialization Frontier Coverage Audit

Generated: 2026-06-03T06:03:18.013Z

Checks that selected same-contract materialization negative/cache candidate groups from the runtime comparison are represented in text-materialization-frontier negativeRows.

## Summary

- Status: classified
- Required groups: 8
- Required candidates: 11
- Covered candidates: 11
- Missing candidates: 0
- Covered candidates crossing 200 MiB/s: 0
- Frontier negative candidates: 38
- Frontier full-parity negative candidates: 34

## Required Groups

| Group | Cases | Covered | Missing |
| --- | ---: | ---: | ---: |
| `text-cache-negative-stability` | 1 | 1 | 0 |
| `offset-text-cache-negative` | 1 | 1 | 0 |
| `long-ascii-text-negative-stability` | 1 | 1 | 0 |
| `medium-ascii-text-negative` | 1 | 1 | 0 |
| `unrolled-medium-ascii-text-negative` | 1 | 1 | 0 |
| `medium-ascii-attr-value-negative` | 1 | 1 | 0 |
| `attr-value-cache-negative` | 2 | 2 | 0 |
| `bun-cache-candidates-books-corpus` | 3 | 3 | 0 |

## Findings

| ID | Classification | Summary |
| --- | --- | --- |
| `required-materialization-candidates-covered` | SOURCE_FACT | 11/11 required materialization negative candidates are represented in the text frontier. |
| `covered-candidates-remain-below-target` | NEGATIVE_RESULT | 0 covered required candidates cross 200 MiB/s. |

