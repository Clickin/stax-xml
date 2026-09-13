# Attribute hash elimination

**Decision: NO-GO for H1A and H1B.** Both candidate patches were removed from the product branch. The independent correctness fix remains.

## Reading order

1. This decision, `gates.json`, and `aggregate-gates.json`.
2. `primary-raw-analysis.csv` (all 100 candidate/workload results), then `primary-raw.json` (all 1,350 fresh processes).
3. `headroom-decision.json`, `headroom-counts.json`, `lookup-headroom-source-ticks.json`, and `counterfactual-counts.json`.
4. `H1A.patch`, `H1B.patch`, `codegen-summary.json`, the CPU profiles, and production optimization/deoptimization logs.
5. `series-raw-analysis.csv`, `series-raw.json`, `duplicate-series.json`, and `width-series-counts.json`.
6. Correctness logs, `build-manifest.json`, `final-product-verification.json`, and `manifest.json`.

## Baselines and novelty

- Original product R0: `9a839ffb6824a25c4cc2fa6698e860daea5b5816`.
- Correctness fix and R1: **`adc2cb7d0a64152725a5c43b2233676a79fec646`**.
- Product branch at handoff: local `perf/attribute-hash-elimination`, containing the correctness commit only. `correctness-fix.patch` preserves the source fix for reconstruction if that product ref is unavailable. The correctness fix is successful product work, **not** a failed optimization.
- Closest rejected experiment: `2026-09-13-entity-single-eval`, archive commit `4eb355c54f20cf6f0e6c91f2952f4244b71bfa33`.
- Both evidence refs and relevant TokenCursor history were examined; exact refs are in `evidence-refs.txt`. Closest historical changes and dossiers are cited in `novelty-audit.json`.

No equivalent H1 mechanism was located in the searched history. This is a scoped novelty finding, not universal proof: the research ZIP already missing from the earlier experiment remains unavailable. Unlike semantic-result transport, H1 removes narrow-name hash arithmetic and query hashing without adding persistent state, caches, allocations, or a workload classifier. Its new cost is exact comparison and generated code. `hypothesis-matrix.json` records the pre-measurement alternatives and exclusions.

## Independent correctness fix

Table allocation/growth is separate from generation advancement. A reusable table advances and reseeds at the first wide lookup (`count === 16`); later lookups reuse it, and growth reseeds the preceding attributes. No per-element whole-table clear or persistent tag-tracking state was added. On a start-tag reparse, the table is safely reseeded from that parse attempt's preceding spans.

Regression coverage includes 15/16/17/32 attributes, 33 for table growth, consecutive same names, different names/order, real duplicates, namespace-aware and namespace-disabled parsing, one-code-unit chunks, expanded-name duplicates, and ordering.

R1, H1A, and H1B each passed **668 unit cases, 100% statements/branches/functions/lines, W3C 805 passed / 203 unchanged skips / 0 failed, and release surfaces**. Each candidate additionally passed 880 differential cases with positive-input/error oracles. The duplicate series exercised 300 build/fixture/namespace cases, each with 20 expected duplicate-error parses. Final product dist is byte-identical to R1; see `final-product-verification.json`.

## Headroom before implementation

Untimed R1 counters (namespace-aware full access):

| Input | Attribute-name hash operations | Linear duplicate candidates | Wide table calls |
|---|---:|---:|---:|
| midsize.xml | 313,406 | 9,217 | 0 |
| large.xml | 2,350,647 | 69,121 | 0 |
| attribute-heavy.xml | 2,885,302 | 560,537 | 0 |
| mixed-utf8.xml | 330,125 | 90,007 | 0 |
| catalog.xml, Converter | 500,184 scan + 40,000 query | 120,016 | 0 |

Counts include real byte-chunk replay work. Width distributions and wide activations for all five name distributions / eleven widths are preserved separately.

The long full-access profile attributed only **349/26,378 = 1.323%** of samples to hash-related source positions. This alone did not justify implementation. The subsequently measured public `attributeValue(name)` workload attributed **3,758/40,553 = 9.266%** to the query `hashString` loop; query-only entry/callsite positions bring it to 9.533%. Including shared hashCode/parser positions gives 10.618%, which must not be called query-only cost. This provided material public-path headroom before H1A was implemented.

These are **source-attribution screening estimates, not causal speedup ceilings**. Independent reviewers preferred a lookup-only experiment. Main retained the user's specified combined H1A cost model rather than substituting a third mechanism. The counterfactual untimed probe predicted 10,089,666 duplicate span character-pair comparisons on the attribute-heavy input; this is not query fallback timing.

## Candidates and fixed protocol

- **H1A:** remove per-code-unit hashing from attribute scanning; narrow duplicates use exact length/span equality. At the existing transition, hash the preceding attributes once and use full hashes for the wide table. Narrow qualified-name lookup uses exact spans rather than query hashes; wide lookup retains full hashes.
- **H1B:** H1A plus one first/last-code-unit prefilter, always followed by exact span equality and its length check. No stored fingerprint, lazy hash cache, threshold tuning, or runtime variant switch.

H1A's three-pair diagnostic pilot regressed full access 1.8602x, lookup 2.0415x, and EventReader 1.7484x. Its exact span loop received 18,567/41,698 CPU samples (44.53%). That observed comparison blocker justified H1B. No third candidate or post-hoc revision was made.

Primary: Node **24.21.0**, Apple M4, Darwin 25.5.0; independently built minified products, prepared byte input, natural GC. Nine blocks, four warmups and three measured samples per fresh process; workload and build order randomized with seed 20260913. Ratios use paired block medians and a 10,000-resample percentile paired bootstrap. No outliers were removed and no failed case was hidden or replaced. No evidence extension was made.

## End-to-end results

Namespace-aware rows below. Times are geometric means of block medians; ratios are candidate/R1 time, not throughput multipliers. The full CSV includes all paths and both namespace modes, including every failed and inconclusive row.

| Workload | R1 ms | H1A ratio [95% CI] | H1B ratio [95% CI] |
|---|---:|---|---|
| midsize full | 98.644 | 1.0031 [0.9956, 1.0102] | 1.0063 [0.9977, 1.0163] |
| midsize lookup | 104.249 | 0.9615 [0.9074, 0.9966] | 0.9560 [0.8721, 1.0175] |
| midsize EventReader | 121.425 | 1.0337 [0.9952, 1.1066] | 1.0508 [0.9970, 1.1453] |
| large full | 756.435 | 1.0513 [0.9869, 1.1382] | 1.0039 [0.9821, 1.0341] |
| large lookup | 743.321 | 1.0136 [0.9815, 1.0524] | 0.9940 [0.9723, 1.0161] |
| large EventReader | 872.488 | 1.0473 [0.9464, 1.2283] | 1.0062 [0.9862, 1.0317] |
| attribute-heavy full | 30.320 | **1.9132 [1.8397, 2.0475]** | **1.0766 [1.0279, 1.1710]** |
| attribute-heavy lookup | 46.664 | **1.9861 [1.9569, 2.0155]** | 0.9829 [0.9655, 0.9977] |
| attribute-heavy EventReader | 38.549 | **1.6955 [1.6268, 1.7437]** | 1.1078 [0.9885, 1.2847] |
| catalog Converter | 26.182 | 0.9802 [0.8910, 1.0366] | 1.0345 [1.0035, 1.0776] |

Ordinary gate requires each CI upper bound <=1.02:

| Candidate | PASS | credible FAIL (CI lower >1.02) | INCONCLUSIVE |
|---|---:|---:|---:|
| H1A | 17 | 10 | 23 |
| H1B | 22 | 2 | 26 |

H1B also fails name/text attribute-heavy access: 1.0801 [1.0425, 1.1324]. Its lookup reductions are ~1.7% with namespaces and ~3.8% without: neither reaches the 5% positive gate. Across 34 full-consuming public cases, H1A's geometric-mean time ratio is **1.12931 [1.10906, 1.15330]** and H1B's **1.00803 [0.99960, 1.01777]**. Neither delivers the required 3% broader improvement. Wide confidence intervals on several actual XML paths remain INCONCLUSIVE, not PASS.

The width series uses 0/1/2/4/8/15/16/17/24/32/64 attributes, five name distributions and three public access modes, five blocks: 2,475 fresh processes. It is a crossover diagnostic, not a replacement for product guards. Some short series cases improve substantially, while wide transitions regress; e.g. common-prefix full H1B ratios at widths 17/24/32/64 are 1.181/1.120/1.116/1.177. Short 700-row fixtures have a different tiering/warmup exposure from the 20,000-row product workload. No width or threshold was selected post hoc to rescue the result.

## CPU/codegen result

Untimed Math.imul interception confirms actual work elimination on attribute-heavy input:

| Mode | R1 | H1A | H1B |
|---|---:|---:|---:|
| full | 2,885,302 | 0 | 0 |
| named lookup | 5,765,302 | 0 | 0 |

R1 TurboFan inlines FNV into XOR/multiply plus guards; leaf helper self-time is not the full cost. H1A loses in exact comparison (44.53% source-position samples). H1B removes much of that penalty, but its duplicate prefilter remains 1,657/23,328 samples (7.10%) in the full profile, and query exact comparisons remain substantial.

Production minified-build optimized `parseStart` final observed instruction sizes: **R1 15,112 B; H1A 18,696 B (+23.7%); H1B 17,904 B (+18.5%)**. This is generated machine code, despite small bundle deltas. Initial optimization/deoptimization activity occurs in all builds, including insufficient feedback, not-a-Smi and wrong-map exits; the evidence does not establish a unique new polymorphic-access failure or lost-inlining cause. More comparisons and larger generated code are observed; attribution of every residual percentage is not claimed. Named/source-position CPU profiles use separately built non-minified diagnostics; all gate timings use frozen minified products.

Cold reporting (nine fresh processes per build, geometric means): root import R1/H1A/H1B **1.401/1.428/1.398 ms**; first EventReaderSync construction **0.0985/0.1037/0.0996 ms**. No large cold regression is evident in this small reporting sample; it is not a promotion result.

## Omitted versus failed gates

Bun/Deno/browser smokes were **NOT RUN**, because neither candidate survived the primary Node gate. They are not marked as failures or approvals. No successful performance patch exists and no product candidate commit is implied; exact patch SHA-256 identifiers are in `build-manifest.json`.

Rebuildable dist/source trees and large XML fixtures are deliberately omitted; hashes and deterministic fixture generation are retained. Historical missing research ZIP remains unavailable. Incidental pre-measurement harness mistakes (entry extension, custom-entity option shape, counter sharing across entry bundles) were corrected before the final measurements; overwritten preliminary diagnostic outputs are not claimed as preserved evidence.

## Reproduction and integrity

Verify `SHA256SUMS` in this directory. Offline statistical replay needs only Python stdlib:

```sh
python3 analyze.py primary-raw.json
python3 analyze.py series-raw.json
```

To rebuild, use a disposable product checkout at R0 and apply `correctness-fix.patch` with `git am`; its source is R1 even if a recreated commit has a different committer timestamp. Build with the repository lockfile (tsdown 0.22.5 / rolldown 1.1.5), snapshot dist as `builds/R1`, then independently apply each candidate patch to R1 and snapshot the resulting dist under its variant name. Both patches are relative to R1, not to each other. Do not apply archived optimization patches to master.

Run `python3 generate-fixtures.py`. `workload.mjs` accepts build directory, fixture path, access mode, namespace boolean, samples, warmups. Example: `node workload.mjs builds/R1 fixtures/attribute-heavy.xml full true 3 4`. `bench.py` records the original checkout path in its `root` variable; relocate that one path to your disposable checkout before replay. `python3 bench.py R1,H1A,H1B 9` reproduces primary scheduling; add `5 --series` instead of `9` for the series. Original absolute paths inside raw records are provenance, not required runtime locations. Untimed instrumentation and profiling must remain separate from timing builds.

## Reconsideration trigger

Reconsider only with measured evidence that removes hashing **without replacing it with the demonstrated duplicate-comparison/generated-code cost**, while preserving exact XML validation and all protected public paths. A promising short width, another cache/fingerprint family, threshold tuning, or zero Math.imul count alone is not a trigger. A separately scoped lookup-only hypothesis was suggested during review but was deliberately not implemented as a third experiment; its own novelty audit and E2E evidence would be required.
