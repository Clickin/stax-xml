# Repository Agent Policy

This file records durable operating rules for agents working in this repository.

## Benchmark Knowledge Reports

Generated benchmark and investigation reports under
`packages/benchmark/knowledge/reports/**` are evidence artifacts, not ordinary
mainline source changes.

- Do not commit raw generated reports to `master` or to a feature/milestone
  branch unless the user explicitly asks for that exact placement.
- Preserve raw reports on a separate evidence branch, preferably named
  `evidence/<topic>-reports-YYYY-MM-DD` or `report/<topic>`.
- Commit the report files together with a small index or README that records
  the important report paths, classification, and reading order.
- Keep curated summaries, release docs, reproduction instructions, or benchmark
  contracts on `master` when they are useful, but cite the evidence branch or
  commit that carries the raw report bundle.
- When preserving reports for later memory recall, include the evidence branch
  name and commit hash in the final handoff.

This policy is intended to keep milestone branches reviewable while still
retaining benchmark evidence for future analysis and agent memory recall.
