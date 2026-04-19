# Benchmarking Workflow Diagrams

## 🔄 Quick Iteration Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    QUICK ITERATION CYCLE                     │
└─────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │ Write Code   │
    │ Optimization │
    └──────┬───────┘
           │
           ▼
    ┌──────────────────────┐
    │ pnpm bench:gc:quick  │  (50 iterations, ~30 seconds)
    │                      │
    │ Measures:            │
    │ - Performance        │
    │ - GC pressure        │
    │ - Memory usage       │
    │ - Statistical sig.   │
    └──────┬───────────────┘
           │
           ▼
    ┌─────────────────────────────────┐
    │         Review Verdict          │
    ├─────────────────────────────────┤
    │ ✓ ACCEPT                        │
    │   - Improvement > 5%            │
    │   - p-value < 0.05              │
    │   - Memory < +10%               │
    │                                 │
    │ ✗ REJECT                        │
    │   - Regression > 5%             │
    │   - Memory > +50%               │
    │   - GC pressure > +50%          │
    │                                 │
    │ ~ NEUTRAL                       │
    │   - No significant difference   │
    │   - p-value > 0.05              │
    └─────────┬───────────────────────┘
              │
         ┌────┴────┐
         │         │
      ACCEPT    REJECT
         │         │
         ▼         ▼
    ┌─────────┐  ┌──────────────┐
    │ Proceed │  │ Iterate or   │
    │ to Full │  │ Try Different│
    │ Bench   │  │ Approach     │
    └─────────┘  └──────────────┘
```

## 🏭 Full Benchmark Workflow

```
┌─────────────────────────────────────────────────────────────┐
│              COMPREHENSIVE BENCHMARK WORKFLOW                │
└─────────────────────────────────────────────────────────────┘

┌────────────────────┐
│ 1. Generate Test   │
│    Data            │
│                    │
│ pnpm generate:     │
│      testdata      │
└────────┬───────────┘
         │
         │ Creates:
         │ - small-simple.xml (~500B)
         │ - medium-nested.xml (~50KB)
         │ - attribute-heavy.xml (~1MB)
         │ - text-heavy.xml (~2MB)
         │ - mixed-content.xml (~1MB)
         │
         ▼
┌────────────────────┐
│ 2. Run Full        │
│    Benchmark       │
│                    │
│ pnpm bench:gc:full │
└────────┬───────────┘
         │
         │ Tests:
         │ - All parser variants (baseline, current, inlined)
         │ - All writer variants (baseline, string-array)
         │ - All test patterns (5 patterns)
         │ - 100 iterations each
         │
         ▼
┌────────────────────────────────┐
│ 3. Collect Metrics             │
├────────────────────────────────┤
│ Performance:                   │
│ - Time (avg, median, stddev)   │
│ - Throughput (ops/sec)         │
│                                │
│ Memory:                        │
│ - Heap delta                   │
│ - Peak usage                   │
│ - Growth rate                  │
│                                │
│ GC Pressure:                   │
│ - Major/minor GC counts        │
│ - GC pause times               │
│ - Total GC time                │
│                                │
│ Statistics:                    │
│ - p-value                      │
│ - Effect size (Cohen's d)      │
│ - Confidence interval          │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────┐
│ 4. Compare to      │
│    Baseline        │
│                    │
│ Automatic for each │
│ variant/pattern    │
└────────┬───────────┘
         │
         ▼
┌────────────────────────────────┐
│ 5. Generate Reports            │
│                                │
│ Console:                       │
│ - Performance summary table    │
│ - Statistical analysis         │
│ - Recommendations              │
│                                │
│ JSON:                          │
│ - results/benchmark-<time>.json│
│                                │
│ Markdown:                      │
│ - pnpm report:latest           │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ 6. Review Recommendations      │
├────────────────────────────────┤
│ ✓ Accepted Optimizations       │
│   - current on medium-nested   │
│     10.0% faster, 8.7% less    │
│                                │
│ ✗ Rejected Optimizations       │
│   - inlined on text-heavy      │
│     15.3% slower (p=0.0012)    │
│   - inlined on mixed-content   │
│     180.4% more memory         │
│                                │
│ ~ Neutral Results              │
│   - No significant improvement │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────┐
│ 7. Make Decision   │
│                    │
│ Deploy accepted    │
│ Reject problematic │
│ Iterate on neutral │
└────────────────────┘
```

## 📊 Metrics Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      METRICS COLLECTION                      │
└─────────────────────────────────────────────────────────────┘

                        ┌──────────────┐
                        │  Benchmark   │
                        │   Executes   │
                        └──────┬───────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
                    ▼          ▼          ▼
        ┌─────────────┐  ┌─────────┐  ┌──────────────┐
        │ Performance │  │   GC    │  │    Memory    │
        │   Timer     │  │ Monitor │  │   Tracker    │
        └──────┬──────┘  └────┬────┘  └──────┬───────┘
               │              │              │
               │              │              │
        ┌──────▼──────┐  ┌────▼────┐  ┌──────▼───────┐
        │ - start     │  │ Major   │  │ heapUsed     │
        │ - end       │  │ Minor   │  │ heapTotal    │
        │ - duration  │  │ Incr.   │  │ external     │
        │ - times[]   │  │ pause   │  │ arrayBuffers │
        └──────┬──────┘  └────┬────┘  └──────┬───────┘
               │              │              │
               └──────────────┼──────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Raw Metrics     │
                    │  Collection      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Statistical     │
                    │  Analysis        │
                    │                  │
                    │ - Mean           │
                    │ - Median         │
                    │ - Std Dev        │
                    │ - t-test         │
                    │ - p-value        │
                    │ - Effect size    │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Comparison      │
                    │  to Baseline     │
                    │                  │
                    │ - Speedup        │
                    │ - Memory diff    │
                    │ - GC reduction   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Verdict         │
                    │  Generation      │
                    │                  │
                    │ ✓ Accept         │
                    │ ✗ Reject         │
                    │ ~ Neutral        │
                    └──────────────────┘
```

## 🎯 Decision Tree

```
┌─────────────────────────────────────────────────────────────┐
│                     OPTIMIZATION DECISION                    │
└─────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │ Run Benchmark   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Is p-value      │
                    │ < 0.05?         │
                    └────┬───────┬────┘
                         │       │
                      YES│       │NO
                         │       │
                         ▼       ▼
            ┌────────────────┐  ┌─────────────────┐
            │ Is improvement │  │ Not significant │
            │ > 5%?          │  │                 │
            └────┬──────┬────┘  │ VERDICT:        │
                 │      │       │ ~ NEUTRAL       │
              YES│      │NO     │                 │
                 │      │       │ Consider:       │
                 ▼      ▼       │ - More tests    │
        ┌────────────┐ ┌─────────────────┐       │ - Larger sample │
        │ Is memory  │ │ Regression!     │       └─────────────────┘
        │ increase   │ │                 │
        │ < 10%?     │ │ VERDICT:        │
        └────┬──┬────┘ │ ✗ REJECT        │
             │  │      │                 │
          YES│  │NO    │ Performance     │
             │  │      │ got worse       │
             ▼  ▼      └─────────────────┘
    ┌──────────┐ ┌─────────────────┐
    │ Is GC    │ │ Memory too high!│
    │ increase │ │                 │
    │ < 50%?   │ │ VERDICT:        │
    └────┬─┬───┘ │ ✗ REJECT        │
         │ │     │                 │
      YES│ │NO   │ Memory          │
         │ │     │ regression      │
         ▼ ▼     │ unacceptable    │
    ┌─────────┐ └─────────────────┘
    │ SUCCESS!│
    │         │
    │ VERDICT:│
    │ ✓ ACCEPT│
    │         │
    │ - Faster│
    │ - Lower │
    │   memory│
    │ - Less  │
    │   GC    │
    └─────────┘
```

## 🔬 Tool Selection

```
┌─────────────────────────────────────────────────────────────┐
│                    WHICH TOOL TO USE?                        │
└─────────────────────────────────────────────────────────────┘

    SITUATION                           TOOL TO USE
    ─────────────────────────────────────────────────────────

    Writing new optimization        →   pnpm bench:gc:quick
    Quick sanity check              →   pnpm bench:gc:quick

    Ready for validation            →   pnpm bench:gc:full
    Testing multiple variants       →   pnpm bench:gc:full

    Need faster results (CI)        →   pnpm bench:gc:fast
    Need thorough validation        →   pnpm bench:gc:thorough

    Compare two specific files      →   node --expose-gc
                                        quick-benchmark.mjs
                                        file1.js file2.js

    Learning how to use tools       →   pnpm example:gc

    Generate documentation          →   pnpm report:latest

    Need test XML files             →   pnpm generate:testdata

    ─────────────────────────────────────────────────────────

    TIME REQUIRED:
    - quick:     ~30 seconds
    - fast:      ~2 minutes
    - full:      ~5-10 minutes
    - thorough:  ~15-20 minutes
```

## 📈 Output Interpretation

```
┌─────────────────────────────────────────────────────────────┐
│                   HOW TO READ RESULTS                        │
└─────────────────────────────────────────────────────────────┘

    Performance: 1.15x faster
    ─────────────────────────
    ✓ GOOD   : > 1.05x (>5% improvement)
    ~ NEUTRAL: 0.95x - 1.05x (within 5%)
    ✗ BAD    : < 0.95x (<5% regression)


    Memory: 8.2% less heap used
    ───────────────────────────
    ✓ GOOD   : Negative % (less memory)
    ~ OK     : 0% - 10% (small increase)
    ⚠ WARNING: 10% - 50% (moderate increase)
    ✗ BAD    : > 50% (excessive increase)


    GC Pressure: 12.3% fewer collections
    ────────────────────────────────────
    ✓ GOOD   : Negative % (fewer GCs)
    ~ OK     : 0% - 20% (slight increase)
    ⚠ WARNING: 20% - 50% (moderate increase)
    ✗ BAD    : > 50% (excessive increase)


    p-value: 0.000001
    ─────────────────
    ✓ SIGNIFICANT: < 0.05 (trust the result)
    ~ UNCERTAIN  : 0.05 - 0.10 (borderline)
    ✗ NOISE      : > 0.10 (could be random)


    Effect size (Cohen's d): 2.134 (large)
    ──────────────────────────────────────
    NEGLIGIBLE : |d| < 0.2
    SMALL      : 0.2 ≤ |d| < 0.5
    MEDIUM     : 0.5 ≤ |d| < 0.8
    LARGE      : |d| ≥ 0.8


    Coefficient of Variation: 8.3%
    ──────────────────────────────
    ✓ GOOD      : < 10% (consistent)
    ~ ACCEPTABLE: 10% - 20% (some variance)
    ⚠ WARNING   : 20% - 30% (high variance)
    ✗ BAD       : > 30% (unreliable)
```

## 🎓 Learning Path

```
┌─────────────────────────────────────────────────────────────┐
│                    GETTING STARTED                           │
└─────────────────────────────────────────────────────────────┘

    STEP 1: Understand the basics
    ─────────────────────────────
    → Read QUICK-START.md (5 min)
    → Run pnpm example:gc (2 min)
    → Understand output format


    STEP 2: Try a quick benchmark
    ──────────────────────────────
    → Run pnpm bench:gc:quick (30 sec)
    → Review the verdict
    → Understand the metrics


    STEP 3: Generate test data
    ───────────────────────────
    → Run pnpm generate:testdata (1 min)
    → Examine the XML files
    → Understand different patterns


    STEP 4: Run full benchmark
    ───────────────────────────
    → Run pnpm bench:gc:full (5-10 min)
    → Review all comparisons
    → Generate report with pnpm report:latest


    STEP 5: Deep dive
    ──────────────────
    → Read README-BENCHMARKING.md
    → Review statistical-analysis.mjs
    → Understand the decision criteria


    STEP 6: Create optimization
    ────────────────────────────
    → Write your optimization
    → Test with quick-benchmark.mjs
    → Iterate based on verdict
    → Validate with full benchmark


    READY! 🚀
```

---

## 📝 Quick Reference Commands

```bash
# See examples
pnpm example:gc

# Quick test during development
pnpm bench:gc:quick

# Full comprehensive benchmark
pnpm bench:gc:full

# Generate markdown report
pnpm report:latest

# Compare two specific files
node --expose-gc quick-benchmark.mjs baseline.js optimized.js

# Generate test data (run once)
pnpm generate:testdata
```

---

**Tip:** Start with `QUICK-START.md` for immediate usage, or `README-BENCHMARKING.md` for complete documentation.
