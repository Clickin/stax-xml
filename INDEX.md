# Experiment index

Before proposing a performance hypothesis, search this branch and read the closest decision record. The preservation and contribution policy is in [README.md](README.md).

## Archived experiments

### [2026-09-13-entity-single-eval](experiments/2026-09-13-entity-single-eval/README.md)

- **Baseline:** `9a839ffb6824a25c4cc2fa6698e860daea5b5816` (`origin/master` at measurement).
- **Result:** NO-GO. No candidate product connection was retained.
- **Hypothesis family:** semantic-result-reuse; event-specific-materialization; producer-consumer-side-state.
- **Strongest positive:** resolver calls fell from R0 13 to A1 7 and AT1 6, with matching differential behavior on tested Node, Bun, Firefox and JSC surfaces.
- **Decisive rejection:** actual EventReaderSync A1/AT1 time ratios were 1.077060/1.068077 on midsize and 1.085778/1.088876 on large XML; ordinary non-regression failed. W0 stayed near R0 in steady state, while all three variants incurred roughly 20% small-constructor overhead.
- **Do not retry unless:** new evidence permits semantic results to be consumed without persistent per-token transport/state, or an engine/runtime primitive materially changes that cost model. More tuning of the same structure is not a trigger.
- **Separate discovery:** the baseline wide-attribute duplicate-table defect is recorded in the experiment; it is neither an A1/AT1 regression nor a fix included here.

## Known negative patterns

### Semantic-result side channels

Reducing repeated semantic computation is not sufficient if the result must be transported through new per-token runtime state. [entity-single-eval](experiments/2026-09-13-entity-single-eval/README.md) reduced resolver calls from 13 to 6 but regressed actual EventReader workloads by roughly 7–9%.

Avoid runtime side-state, semantic envelopes, token-to-materializer result transport, or similar bookkeeping merely to reuse previously computed semantic values unless the producer eliminates materially more work than the transport costs. This is a scoped cost-model result, not a claim that all reuse is bad.

## Preservation corrections

- [2026-09-13 Git EOL correction](corrections/2026-09-13-entity-single-eval-git-eol.json): restores original CSV bytes after Git's initial CRLF-to-LF conversion. Initial commit retained; no experimental values, gates or candidate patches changed.

## [2026-09-13-attribute-hash-elimination](experiments/2026-09-13-attribute-hash-elimination/README.md)

- **R1 baseline:** `adc2cb7d0a64152725a5c43b2233676a79fec646`, the independent successful wide-table generation fix atop `9a839ffb`. Its reconstruction patch is included as evidence, not failed product work.
- **Result:** NO-GO for H1A direct narrow comparison and H1B first/last-code-unit prefilter. Both removed from the product branch.
- **Novelty:** operation elimination at the existing narrow/wide boundary, not cache/classifier/semantic-result transport. No equivalent located in searched history; missing prior research ZIP limits universal novelty claims.
- **Headroom:** query hash loop 9.266% of source-attributed lookup samples; parse/full hash-related positions only 1.323%. Attribute-heavy full/lookup Math.imul calls fell from 2,885,302/5,765,302 to zero in both candidates.
- **Decisive rejection:** H1A full-access time ratio 1.9132 [1.8397, 2.0475]; H1B 1.0766 [1.0279, 1.1710]. H1B also credibly regressed name/text access. Nine paired blocks cover 50 public workload/namespace cases; all raw samples and failed/inconclusive gates are retained.
- **Cost learned:** removing cheap inlined hash arithmetic can add much more exact-span work and generated code. H1A's comparison loop received 44.53% of samples; final observed production `parseStart` code grew from 15,112 B to 18,696/17,904 B.
- **Do not retry unless:** a different measured mechanism eliminates hashing without the demonstrated comparison/code-size cost, with exact validation and public E2E gates preserved. Short-width wins, zero Math.imul count, or threshold tuning are not promotion evidence.
- **Correctness:** R1 and both candidates passed 668 unit cases, 100% coverage, W3C 805 with unchanged skips, and release surfaces. Final dist is byte-identical to R1. Secondary runtimes were not run after Node rejection.
