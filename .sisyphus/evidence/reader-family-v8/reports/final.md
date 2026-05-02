# Reader Family V8 Evidence Report

## Verdict: inconclusive

The snapshot branch improved the public/direct timing ratio on the shared JavaScript fallback reader family, and the focused V8 diagnostics did not surface snapshot-only reader-related deopts or map churn. However, the required optimized/inlining proof never surfaced reader-specific wrapper behavior, so the evidence is not strong enough to satisfy the plan's stricter `reduced` rule.

## Environment

- Base comparison: `origin/master` at `49eb6d45b24eebc535e9322ae4c44be7bc43ca86`
- Snapshot comparison: `snapshot/2026-05-02-reader-family-zero-base` at `4a851011d7a4e3ab94c6897598089fd5aa3124be`
- Node parity: `v24.15.0` on both branches
- V8 parity: `13.6.233.17-node.48` on both branches
- Node executable parity: `C:\Program Files\nodejs\node.exe` on both branches
- Platform: `Microsoft Windows 10.0.26200`
- CPU: `13th Gen Intel(R) Core(TM) i5-13600K`

## Comparison Axes

- Branch axis: `origin/master` versus `snapshot/2026-05-02-reader-family-zero-base`
- API axis: public reader wrapper path versus matching direct core path
- Performance scope: wrapper overhead on the shared JavaScript fallback family, not native `StreamReaderSync` throughput
- Evidence strategy: correctness gate first, then wrapper/direct ratio evidence, then focused V8 diagnostics for inlining, deopts, and map stability

## Correctness Gate

- Both detached-worktree test runs passed with exit code `0`.
- Master ran 7 closest reader-family-adjacent files (`146` tests passed).
- Snapshot ran 12 reader-family files (`178` tests passed).
- Correctness precondition therefore passed on both branches.
- Caveat: this is mapped reader-family-adjacent evidence rather than strict identical-file A/B evidence because the snapshot branch adds renamed and reimplemented reader-family tests.

## Wrapper vs Direct Delta

- Task 4's existing `benchmark-baseline.mjs` harness was not usable for the verdict because both branches logged `Unexpected end of document` during warmup while still exiting `0`.
- The strongest branch-comparable overhead signal came from Task 5's evidence-only harness on the shared JavaScript fallback family.
- Measured public/direct ratios:
  - master: `2.2261x` (`StaxXmlParserSync` `2.6554 ms` / `StaxXmlIterableParser` `1.1928 ms`)
  - snapshot: `1.4731x` (`EventReaderSync` `1.7190 ms` / `IterableReader` `1.1669 ms`)
- Ratio change: `2.2261x -> 1.4731x`, about a `33.8%` reduction in wrapper/direct overhead ratio relative to master.
- Event-count gate passed on both branches (`6916` events, stable checksum).
- API-equivalence caveat: snapshot no longer exports `./iterable`, so the harness privately imported `packages/stax-xml/src/IterableReader.ts` only inside `.sisyphus/evidence/reader-family-v8/tools/wrapper-vs-direct.mjs` to compare `EventReaderSync` against the same fallback core it wraps.

## V8 Optimization and Inlining

- Required V8 passes were recovered successfully through direct Node CLI flags after this Node build rejected several flags in `NODE_OPTIONS`.
- The inlining pass succeeded technically on both branches, but it did not emit reader-family-specific inlining records.
- The optimized-code fallback pass also succeeded technically, but it surfaced only Node/bootstrap MAGLEV activity rather than labeled reader-wrapper optimized bodies.
- Interpretation: the evidence does not show a reader-specific inlining win or direct proof that wrapper calls inline away or are otherwise negligible.

## Deoptimization Findings

- No reader-related deopts surfaced on either branch.
- Both branches only showed the same unrelated Node bootstrap deopts under `requireBuiltin <node:internal/bootstrap/realm>`.
- There were no snapshot-only repeated reader-related deopts.
- Interpretation: Task 6 found no deoptimization evidence that the snapshot wrapper path is less stable than master.

## Hidden Class / IC Friendliness

- The map/generalization traces on both branches were dominated by Node/bootstrap behavior.
- No branch produced reader/materializer-specific `wrong map`, reader-property generalization, or branch-distinct post-warmup map churn evidence.
- No reader-specific hidden-class regression was observable from this workload.
- IC-specific proof remained indirect here; the usable signal was neutral deopt/map evidence rather than labeled reader IC traces.

## Bytecode and Optimized Code Notes

- Bytecode logging succeeded technically after switching away from `NODE_OPTIONS`, but the logs were dominated by bootstrap/generated functions and did not expose labeled reader-family bytecode bodies.
- Optimized-code logging had the same limitation: successful output, but no reader-family-specific optimized-code bodies to analyze.
- Because of that, bytecode/optimized-code evidence is neutral rather than affirmative.
- This is why the improved Task 5 ratio alone does not justify `reduced`.

## Residual Uncertainty

- The strongest positive signal is limited to the shared JavaScript fallback family, not the native runtime path.
- The correctness gate is branch-comparable but not identical-file A/B because snapshot added new reader-family test files.
- Snapshot/direct comparability required a harness-only private import because the snapshot branch no longer exports the JS direct iterable core.
- Most importantly, Task 6 did not surface reader-specific inlining or optimized-code proof showing the wrapper call layer disappears or is negligible after warmup.
- Result: the evidence is promising and negative-risk checks stayed clean, but the stricter proof bar for `reduced` was not met.

## Raw Evidence Index

### Environment and workspace references

- `.sisyphus/evidence/reader-family-v8/env/original-ref.txt`
- `.sisyphus/evidence/reader-family-v8/env/master-env.json`
- `.sisyphus/evidence/reader-family-v8/env/snapshot-env.json`
- `.sisyphus/evidence/reader-family-v8/raw/task-7-workspace-unchanged.log`

### Processed summaries used directly in the synthesis

- `.sisyphus/evidence/reader-family-v8/processed/reader-tests.md`
- `.sisyphus/evidence/reader-family-v8/processed/existing-harnesses.md`
- `.sisyphus/evidence/reader-family-v8/processed/wrapper-vs-direct.md`
- `.sisyphus/evidence/reader-family-v8/processed/v8-diagnostics.md`

### Raw logs behind the processed summaries cited above

- `.sisyphus/evidence/reader-family-v8/raw/master/reader-tests.log`
- `.sisyphus/evidence/reader-family-v8/raw/snapshot/reader-tests.log`
- `.sisyphus/evidence/reader-family-v8/raw/master/benchmark-baseline.log`
- `.sisyphus/evidence/reader-family-v8/raw/snapshot/benchmark-baseline.log`
- `.sisyphus/evidence/reader-family-v8/raw/master/async-parser-1mb.log`
- `.sisyphus/evidence/reader-family-v8/raw/snapshot/async-parser-1mb.log`
- `.sisyphus/evidence/reader-family-v8/raw/snapshot/trace-opt-deopt.log`
- `.sisyphus/evidence/reader-family-v8/raw/snapshot/profile-stream-reader-overhead.log`
- `.sisyphus/evidence/reader-family-v8/raw/master/wrapper-vs-direct.log`
- `.sisyphus/evidence/reader-family-v8/raw/snapshot/wrapper-vs-direct.log`
- `.sisyphus/evidence/reader-family-v8/raw/master/wrapper-vs-direct-opt-deopt-public.log`
- `.sisyphus/evidence/reader-family-v8/raw/snapshot/wrapper-vs-direct-opt-deopt-public.log`
- `.sisyphus/evidence/reader-family-v8/raw/master/wrapper-vs-direct-inlining-public.log`
- `.sisyphus/evidence/reader-family-v8/raw/snapshot/wrapper-vs-direct-inlining-public.log`
- `.sisyphus/evidence/reader-family-v8/raw/master/wrapper-vs-direct-bytecode-public.log`
- `.sisyphus/evidence/reader-family-v8/raw/snapshot/wrapper-vs-direct-bytecode-public.log`
- `.sisyphus/evidence/reader-family-v8/raw/master/wrapper-vs-direct-opt-code-public.log`
- `.sisyphus/evidence/reader-family-v8/raw/snapshot/wrapper-vs-direct-opt-code-public.log`
- `.sisyphus/evidence/reader-family-v8/raw/master/wrapper-vs-direct-map-public.log`
- `.sisyphus/evidence/reader-family-v8/raw/snapshot/wrapper-vs-direct-map-public.log`
- `.sisyphus/evidence/reader-family-v8/raw/master/isolate-*-wrapper-vs-direct-map-v8.log`
- `.sisyphus/evidence/reader-family-v8/raw/snapshot/isolate-*-wrapper-vs-direct-map-v8.log`
