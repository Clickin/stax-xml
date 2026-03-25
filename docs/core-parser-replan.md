# Core Parser Replan

Updated: 2026-03-25

## Fixed baselines

- `main`: `/josh/programs/stax-xml`
- `checkpoint`: `/josh/programs/stax-xml-core-parser-checkpoint`
- `feature`: `/josh/programs/stax-xml-core-parser-refactor`

Checkpoint was frozen from feature commit `97dbf5b` with a Lore commit so cursor-internal comparisons can stay stable while feature continues to move.

## Operating rules

- Benchmark and profiling runs use `packages/stax-xml/dist/index.js` or `packages/stax-xml/dist/index.mjs` only.
- `main` and `checkpoint` stay fixed during the comparison window.
- Cursor results are judged against `checkpoint`.
- Public wrapper results are judged against `main`.
- Stress results are recorded as signals and are not ship gates.

## Benchmark suites

### Cursor suite

- `sync-cursor-consume`: synthetic token-dense XML
- `sync-cursor-attr-unused`: synthetic attribute-dense XML without attribute access
- `async-cursor-midsize-4kb`
- `async-cursor-midsize-64kb`

### Wrapper suite

- `sync-parser-books`: `books.xml`
- `sync-parser-complex`: `complex.xml`
- `async-parser-midsize-4kb`: `midsize.xml`
- `async-parser-midsize-64kb`: `midsize.xml`
- `async-parser-mixed-256b`: `mixed.xml`

### Stress suite

- `async-parser-single-chunk`

## Gate definitions

### Cursor gate: checkpoint vs feature

- `sync-cursor-consume`: at least 10% faster
- `sync-cursor-attr-unused`: at least 25% faster
- `async-cursor-midsize-4kb`: completes and stays within `1.5x`
- `async-cursor-midsize-64kb`: completes and stays within `1.5x`

### Wrapper gate: main vs feature

- No representative wrapper case regresses by more than 5%
- At least one representative wrapper case improves by at least 5%
- Representative wrapper cases are `sync-parser-books` and `sync-parser-complex`
- `async-parser-midsize-4kb`: feature run completes without timeout
- `async-parser-midsize-64kb`: feature run completes without timeout
- `async-parser-mixed-256b`: feature run completes without timeout and keeps a stable checksum

### Stress suite

- `async-parser-single-chunk` is signal only
- Runaway behavior, timeout behavior, and chunk sensitivity are recorded, not used as ship gates

## Workflow

1. Build dist in each worktree.
2. Verify baseline SHA pins and worktree state.
3. Run the cursor suite for `checkpoint` and `feature`.
4. Run the wrapper suite for `main` and `feature`.
5. Run the stress suite for `feature` when needed.
6. Evaluate cursor and wrapper gates from the suite JSON outputs.

## Commands

Build:

```bash
pnpm --dir /josh/programs/stax-xml/packages/stax-xml build
pnpm --dir /josh/programs/stax-xml-core-parser-checkpoint/packages/stax-xml build
pnpm --dir /josh/programs/stax-xml-core-parser-refactor/packages/stax-xml build
```

Verify baselines:

```bash
node /josh/programs/stax-xml-core-parser-refactor/scripts/verify-core-parser-baselines.mjs \
  /josh/programs/stax-xml \
  /josh/programs/stax-xml-core-parser-checkpoint \
  /josh/programs/stax-xml-core-parser-refactor \
  --expect-checkpoint 97dbf5b
```

Run benchmark suites:

```bash
node /josh/programs/stax-xml-core-parser-refactor/scripts/run-benchmark.mjs \
  /josh/programs/stax-xml-core-parser-checkpoint checkpoint cursor checkpoint

node /josh/programs/stax-xml-core-parser-refactor/scripts/run-benchmark.mjs \
  /josh/programs/stax-xml-core-parser-refactor feature cursor checkpoint

node /josh/programs/stax-xml-core-parser-refactor/scripts/run-benchmark.mjs \
  /josh/programs/stax-xml main wrapper main

node /josh/programs/stax-xml-core-parser-refactor/scripts/run-benchmark.mjs \
  /josh/programs/stax-xml-core-parser-refactor feature wrapper main
```

Evaluate gates:

```bash
node /josh/programs/stax-xml-core-parser-refactor/scripts/evaluate-core-parser-gates.mjs \
  cursor \
  /tmp/stax-compare/checkpoint/benchmarks/cursor.json \
  /tmp/stax-compare/feature/benchmarks/cursor.json

node /josh/programs/stax-xml-core-parser-refactor/scripts/evaluate-core-parser-gates.mjs \
  wrapper \
  /tmp/stax-compare/main/benchmarks/wrapper.json \
  /tmp/stax-compare/feature/benchmarks/wrapper.json
```

Default profiling targets:

```bash
node /josh/programs/stax-xml-core-parser-refactor/scripts/run-node-cpu-prof.mjs \
  /josh/programs/stax-xml-core-parser-checkpoint checkpoint cursor checkpoint sync-cursor-consume \
  /josh/programs/stax-xml-core-parser-refactor/scripts/parser-benchmark-case.mjs \
  -- /josh/programs/stax-xml-core-parser-checkpoint cursor sync-cursor-consume checkpoint

node /josh/programs/stax-xml-core-parser-refactor/scripts/run-node-cpu-prof.mjs \
  /josh/programs/stax-xml-core-parser-refactor feature cursor checkpoint async-cursor-midsize-64kb \
  /josh/programs/stax-xml-core-parser-refactor/scripts/parser-benchmark-case.mjs \
  -- /josh/programs/stax-xml-core-parser-refactor cursor async-cursor-midsize-64kb checkpoint

node /josh/programs/stax-xml-core-parser-refactor/scripts/run-node-cpu-prof.mjs \
  /josh/programs/stax-xml main wrapper main sync-parser-books \
  /josh/programs/stax-xml-core-parser-refactor/scripts/parser-benchmark-case.mjs \
  -- /josh/programs/stax-xml wrapper sync-parser-books main

node /josh/programs/stax-xml-core-parser-refactor/scripts/run-node-cpu-prof.mjs \
  /josh/programs/stax-xml-core-parser-refactor feature wrapper main async-parser-mixed-256b \
  /josh/programs/stax-xml-core-parser-refactor/scripts/parser-benchmark-case.mjs \
  -- /josh/programs/stax-xml-core-parser-refactor wrapper async-parser-mixed-256b main
```

## Implementation stages

- Stage 1: sync scalar state
- Stage 2: sync no-attribute fast path
- Stage 3: sync namespace copy-on-write
- Stage 4: async scanner prototype
- Stage 5: async full integration

Each stage closes only after the cursor gate and wrapper gate both pass.
