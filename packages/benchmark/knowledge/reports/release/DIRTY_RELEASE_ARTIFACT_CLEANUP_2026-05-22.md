# Dirty Release Artifact Cleanup

Date: 2026-05-22

Cleaned from: main worktree after `651336c`

## What Was Preserved

The main worktree contained old generated benchmark artifacts under
`packages/benchmark/results/tmp/**`, an untracked local `.codex/agents`
configuration, and regenerated rc3 release benchmark JSON/Markdown files.

The raw artifacts were not kept in the worktree because they are generated,
time-specific evidence. The useful lessons are recorded here so the cleanup does
not lose the experiment signal.

## Release Rerun Lessons

The `node24-release-baseline-20260506-194421` and
`node26-release-baseline-20260506-194957` tmp directories repeated the release
matrix shape with `warmups=1`, `runs=3`, a 16 MiB runtime fixture, and the
public pure-JS package.

Representative runtime-matrix rows:

| Runtime | Scenario | Throughput | Peak heap | Notes |
| --- | --- | ---: | ---: | --- |
| Node 24.15.0 | public-sync-full-string | 92.4 MiB/s | 22.7 MiB | parity ok |
| Node 24.15.0 | stream-sync-index-full-string | 107.6 MiB/s | 22.3 MiB | byte batch index consumption was faster than public string input |
| Node 26.0.0 | public-sync-full-string | 94.3 MiB/s | 22.6 MiB | small Node 26 uplift, not a strategy change |
| Node 26.0.0 | stream-sync-index-full-string | 109.9 MiB/s | 22.5 MiB | same byte-span direction held |
| Bun 1.3.13 | stream-sync-index-full-string | 133.9-138.7 MiB/s | about 67 MiB | fastest stream row, but higher peak heap |
| Deno 2.7.13 | stream-sync-index-full-string | 108.9-109.8 MiB/s | about 27.8 MiB | close to Node byte-batch throughput |

The result supports the same direction as the later chunked-string rejection:
large-file parsing should stay centered on byte batches and span-level string
materialization rather than whole decoded string chunks.

## Converter Rerun Lessons

Tmp compiled-dispatch runs showed the manual `StreamReaderSync` projection
ahead of compiled converter schemas:

| Run | Manual projection | Auto compiled | Explicit compiled |
| --- | ---: | ---: | ---: |
| final smoke | 77.02 MiB/s | 43.05 MiB/s | 48.44 MiB/s |
| release shape | 79.99 MiB/s | 49.69 MiB/s | 49.81 MiB/s |

This reinforces that converter throughput work should first reduce projection
and materialization overhead, not widen API caching or lazy getter strategies.

## Cleanup Rule

Do not commit regenerated release benchmark JSON/Markdown just because a local
rerun produced slightly different timing numbers. Keep curated release docs and
knowledge notes on `master`; move raw, bulky, or exploratory benchmark evidence
to a dedicated evidence branch only when it needs to be preserved verbatim.
