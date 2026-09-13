# Entity Single Evaluation

Status: NO-GO
Date: 2026-09-13
Baseline: 9a839ffb6824a25c4cc2fa6698e860daea5b5816

## Hypothesis

Reuse entity results already computed by the pure-JS producer's validation path in EventReader materialization, removing repeated semantic entity interpretation without changing public behavior. The baseline was origin/master at the SHA above; this was not a Wasm experiment.

Closest antecedents were the frontier research ZIP and earlier iterable/string-retention investigations described in the original HANDOFF. The ZIP was unavailable during the experiment and remains unavailable for this archive. What was different here was a static, Event-specific cursor specialization carrying completed semantic values from validation to namespace/public-value consumers, rather than a kernel-only speed claim. Preserved historical context is under evidence/history/.

## Variants

| Variant | Scope |
|---|---|
| R0 | Unmodified baseline |
| W0 | Event-specific wiring/subclass control; baseline normalization behavior |
| A1 | W0 plus attribute and namespace entity result reuse |
| AT1 | A1 plus text completion/resume normalization |

The implementation used static AST generation, a private Symbol request envelope, and an Event-specific materializing cursor path. Normalized values lived in subclass state; result builders used fragments and join. Ordinary TokenCursor runtime statements were unchanged after visibility/export normalization. Candidate patches are original, unmodified evidence in candidates/; no candidate commit is implied by the baseline source SHA.

## What actually improved

The complete six-entity diagnostic required **R0 13, A1 7, AT1 6 resolver calls**. AT1 performed no subsequent namespace/materializer reinterpretation in that diagnostic. See evidence/occurrences.json and evidence/logs/*-occurrence.log; instrumentation was separate from timed builds.

Tested differential behavior matched: Node 24.21.0 and Bun 1.3.14 each covered 1,487 scenarios across four builds, Firefox 151.0.1 covered 598, and standalone system JSC covered 16 direct-string cases. Standalone JSC lacked TextDecoder; native byte/async coverage came from Bun/JSC and Firefox. Candidate unit tests passed 719 cases each, W3C passed 805 with the same 203 existing skips, and public declaration/CSP checks passed.

This does not mean every acceptance gate passed: candidate coverage failed unchanged thresholds, and a separate baseline correctness defect prevented mandatory synthetic throughput cases. Original evidence and scope qualifications are retained in HANDOFF.md, gates.json and failures.json.

## Product-level measurements

Actual EventReaderSync, prepared bytes, namespaceAware=true, autoDecodeEntities=true. Node 24.21.0 / Apple M4 / Darwin 25.5.0; natural GC. Ratios are candidate/R0 time, not throughput gains. Milliseconds are geometric means of block medians.

| Input | Variant | R0 ms | Candidate ms | Time ratio | 95% paired CI | Result |
|---|---|---:|---:|---:|---|---|
| midsize.xml (13,584,398 B) | W0 | 358.881 | 353.975 | 0.986328 | [0.973012, 0.998740] | PASS |
| midsize.xml | A1 | 358.881 | 386.537 | 1.077060 | [1.060393, 1.092452] | FAIL |
| midsize.xml | AT1 | 358.881 | 383.313 | 1.068077 | [1.055953, 1.079727] | FAIL |
| large.xml (101,882,907 B) | W0 | 2705.098 | 2741.992 | 1.013639 | [0.996854, 1.034628] | INCONCLUSIVE |
| large.xml | A1 | 2705.098 | 2937.136 | 1.085778 | [1.078889, 1.092245] | FAIL |
| large.xml | AT1 | 2705.098 | 2945.517 | 1.088876 | [1.080577, 1.095730] | FAIL |

The exact unrounded values and all 246 metric rows are in performance-table.csv. Primary used seven independent blocks, six warmups and five samples; selected inconclusive cases extended to fourteen blocks. Large XML has fourteen blocks; midsize has seven. Paired bootstrap used 10,000 iterations. All raw final statistical inputs, including W0 and failed cases, are in evidence/primary-final.json and evidence/guards-final.json. Pilot inputs are also preserved.

Cold EventReaderSync construction on complex.xml failed for all controls/candidates: W0 1.211201 [1.180424, 1.248535], A1 1.196846 [1.148547, 1.240717], AT1 1.217094 [1.164742, 1.275376]. Each exceeds the cold 1.10 gate. Converter remained INCONCLUSIVE after fourteen blocks; A1's unrounded CI upper bound 1.020014 exceeds 1.02.

## Why it was rejected

Ordinary non-regression required every protected case's time-ratio CI upper bound <=1.02; cold required <=1.10; the entity gain gate required >=10% E2E throughput improvement on the prescribed cases. Actual XML and cold failed. Reducing resolver work did not produce a product-level win.

Of 58 cases, 47 mandatory synthetic-dependent cases were NOT RUN because the baseline rejected their valid wide-attribute input. Entity gain and text-extension estimates therefore were not established. These cases were not discarded or converted into passes. The independently measured actual/cold regressions remain decisive.

A1/AT1 coverage also failed: lines 98.88%/97.62%, statements 98.67%/97.45%, branches 97.66%/95.30%; functions 100%. Thresholds were not weakened. Full retention/slope gates and 128 MiB/1 GiB expansion were NOT RUN because no primary candidate passed; available-engine retention smokes are not memory approval.

All product connections were restored to R0. Final product build, 658 unit cases, W3C, 100% coverage and release surfaces passed; final dist was byte-identical to R0. product.patch is empty. This archive did not rerun, modify, rescue or retune any variant.

## Cost model learned

W0 remained near R0 in steady-state actual XML, so the dominant A1/AT1 regression was not merely Event-specific wiring. The semantic-result transport/state introduced by A1/AT1 cost more than the repeated entity resolution it removed on these workloads. Wiring itself was not free at construction: all three variants were roughly 20% slower there.

**Avoid adding runtime side-state, semantic envelopes, token-to-materializer result transport, or similar bookkeeping merely to reuse previously computed semantic values unless the producer can eliminate materially more work than the transport itself costs.**

This is not “all reuse is bad.” The boundary is the measured Event-specific producer/materializer bookkeeping structure and tested workloads/runtimes. The archive records a rejection, not a universal micro-cost decomposition or a newly claimed entity-rich speedup.

## Baseline defect discovered

Classification: **baseline defect discovered during experiment**. This is unrelated to the A1/AT1 experiment result.

Valid repeated elements with `id` plus 16 general attributes can cause R0 to throw `Duplicate attribute: a15`; the namespace fixture can fail at a12. xmllint accepts the generated XML. Evidence indicates that the duplicate hash table generation is not advanced when an allocated table is reused across wide elements.

Preserved reproduction: evidence/baseline-defect/wide-baseline.xml and harness/reproduction/wide-baseline-repro.mjs; original diagnostics: evidence/logs/{R0-wide-baseline,A1-wide-baseline,wide-xmllint,fixture-contract}.log and failures.json. No parser fix is included in this archive. Any fix belongs to a separate product task with its own evidence.

## Reproduction

Start with this entry's manifest.json and SHA256SUMS. Every copied artifact is byte-identical to its original, with a source-to-archive map. Original absolute paths and original gate classifications remain intact as historical provenance. Use the archive paths below instead of obsolete /tmp paths in HANDOFF.md. The original SHA256SUMS is an inventory of the larger original bundle, not the checksum command for this selected archive.

Integrity verification, from this experiment directory:

```sh
shasum -a 256 -c SHA256SUMS
```

Offline statistical replay (no parser builds, benchmark execution or original /tmp directory required):

```sh
node harness/packages/benchmark/entity-single-eval/analyze.mjs analyze \
  --input evidence/primary-final.json \
  --guards evidence/guards-final.json \
  --manifest evidence/builds.json \
  --out /tmp/entity-single-eval-statistical-replay.json
```

The analyzer emits measured numeric results. The preserved final gates.json additionally classifies baseline-blocked missing data as NOT RUN and records correctness/packaging/retention context; it is not a byte-identical analyzer output. Keep the final decision unchanged. Do not combine old seven-block data with primary-final/guards-final again: the final files already include the extension blocks.

Original candidate reconstruction, only if separately authorized: use a new disposable worktree at the baseline, apply exactly one candidates/{W0,A1,AT1}.patch and harness/harness.patch, install the baseline lockfile dependencies, then use its existing build/test scripts and archived harness. Original build/fixture manifests preserve versions, source/patch/dist hashes and input hashes. Remap entry/converterEntry and fixture asset locations in a derived manifest, never in this archive. The small reproduction scripts are preserved verbatim; some reference original absolute paths and require explicit relocation in a disposable copy. Candidate builds and large XML assets were deliberately not duplicated here. They are not required for offline statistical replay.

No candidate reconstruction or benchmark rerun was performed to create this archive. Missing original research ZIP and intentionally excluded artifacts are explicit in manifest.json. Summary selection retains one full reference trace plus existing differential/engine summaries; original hashes identify omitted duplicate traces. The first Firefox smoke-driver iterator error and its successful correction remain in the diagnostic record, not as an A1/AT1 failure.

## Reconsideration trigger

Reconsider this family only with new evidence that semantic results can be consumed without persistent per-token transport/state, or with an engine/runtime primitive that materially changes the computation-versus-transport cost model. A new hypothesis must cite this entry, identify the eliminated cost, and state what is genuinely different before implementation. “Retry with more tuning” is not a trigger. A baseline wide-attribute fix alone does not erase the actual/cold regressions.
