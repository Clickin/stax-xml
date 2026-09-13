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
