# Concat Buffer Reuse Negative Result

Generated: 2026-05-26T00:39:03.818Z

Records a rejected parser-core candidate that reused a scratch `Uint8Array` for multi-chunk `Iterable<Uint8Array[]>` concat output. The candidate preserved checksum parity but did not improve the current 32KiB file-backed batch-size sweep, so the source change was not retained.

## Summary

- Candidate: reusable multi-chunk concat buffer
- Contract: same full-string checksum over file-backed `Iterable<Uint8Array[]>`
- Chunk KiB: 32
- Runs: 3
- Retained in source: no
- 200 MiB/s bounded counterexample: no

## Baseline vs Candidate

| Metric | Baseline | Candidate |
| --- | ---: | ---: |
| Fastest row | `stax-raw-frame-name-id-batch-16` | `stax-raw-frame-name-id-batch-16` |
| Fastest MiB/s | 150.90 | 149.69 |
| Fastest RSS | 69.70 MiB | 69.14 MiB |
| Batch 4 raw-frame MiB/s | 141.27 | 140.40 |
| Batch 4 raw-frame RSS | 67.03 MiB | 66.31 MiB |
| Events | 61,236,571 | 61,236,571 |
| Checksum | -716099804 | -716099804 |

## Findings

- concat-buffer-reuse-not-headroom (NEGATIVE_RESULT): Reusable concat storage did not produce measurable throughput headroom for the current 32KiB file-backed byte-batch sweep.
  - baseline fastest stax-raw-frame-name-id-batch-16=150.90 MiB/s, RSS=69.70 MiB
  - candidate fastest stax-raw-frame-name-id-batch-16=149.69 MiB/s, RSS=69.14 MiB
  - baseline batch4 raw-frame=141.27 MiB/s, RSS=67.03 MiB
  - candidate batch4 raw-frame=140.40 MiB/s, RSS=66.31 MiB
- negative-result-not-runtime-limit-proof (SCOPE_GUARD): This failed candidate narrows one implementation path only; it is not evidence that JavaScript runtimes cannot exceed 200 MiB/s.
  - single-currentBuffer span model remains unchanged
  - no segmented-buffer parser prototype was implemented
  - Safari/WebKit and runtime codegen obligations remain open

## Limits

- The candidate rerun was a local transient patch and was reverted after measurement.
- This report is a negative-result record, not a primary benchmark row for counterexample scanning.
- A different segmented-buffer parser design could still be a valid future experiment.
