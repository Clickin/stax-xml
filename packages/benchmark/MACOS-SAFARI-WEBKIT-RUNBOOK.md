# macOS Safari/WebKit Proof Runbook

This runbook is for the remaining Safari/WebKit browser evidence that cannot be
produced on the current Windows host. It is not benchmark evidence by itself.

## Current Windows Status

- Windows-local proof gates pass with the broad runtime-limit claim still kept
  as a hypothesis.
- The open external obligation is `safari-jsc-source-and-browser-rows-open`.
- Current Windows evidence records `hostPlatform=win32-x64`,
  `safaridriverFound=false`, `canRunSafariBrowserRows=false`, and
  `closesSafariObligation=false`.
- Bun/JSC and Bun-patched WebKit evidence must stay separate from Apple Safari
  browser evidence.

## Required macOS Setup

- macOS host with the Safari/WebKit build under test.
- Safari WebDriver enabled.
- `/usr/bin/safaridriver` available and executable.
- Repository checkout with dependencies installed and benchmark scripts
  runnable.

Useful preflight commands:

```sh
/usr/bin/safaridriver --version
```

```sh
node packages/benchmark/safari-webkit-availability-audit.mjs --json-out packages/benchmark/results/release/safari-webkit-availability-audit.json --md-out packages/benchmark/results/release/safari-webkit-availability-audit.md
```

## Run Order

1. Run a small Safari smoke benchmark.

```sh
node packages/benchmark/safari-webdriver-candidate-headroom.mjs --driver-executable /usr/bin/safaridriver --size-gib 0.001 --fixture-shape diverse-cycle --diverse-cycle-size 64 --cases stringFull,eventObjectFull,rawFrameNameId --json-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-smoke.json --md-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-smoke.md
```

2. Run the required 1 GiB same-contract cross-process corpus rows.

```sh
node packages/benchmark/browser-candidate-headroom-cross-process.mjs --harness safari-webdriver --driver-executable /usr/bin/safaridriver --process-runs 3 --size-gib 1 --fixture-shape corpus-cycle --corpus-file packages/benchmark/assets/books.xml --batch-size 1 --cases stringFull,eventObjectFull,rawFrameNameId --output-dir packages/benchmark/results/cross-process/safari-webdriver-books-corpus --json-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-cross-process-books-corpus.json --md-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-cross-process-books-corpus.md
```

3. Recompute Safari closure classification.

```sh
node packages/benchmark/safari-webkit-closure-audit.mjs --json-out packages/benchmark/results/release/safari-webkit-closure-audit.json --md-out packages/benchmark/results/release/safari-webkit-closure-audit.md
```

4. Recompute the proof chain after Safari rows are present.

Run these sequentially:

```sh
node packages/benchmark/same-contract-runtime-comparison.mjs --json-out packages/benchmark/results/release/same-contract-runtime-comparison.json --md-out packages/benchmark/results/release/same-contract-runtime-comparison.md
```

```sh
node packages/benchmark/safari-webkit-closure-audit.mjs --json-out packages/benchmark/results/release/safari-webkit-closure-audit.json --md-out packages/benchmark/results/release/safari-webkit-closure-audit.md
```

```sh
node packages/benchmark/runtime-counterexample-scan.mjs --json-out packages/benchmark/results/release/runtime-counterexample-scan.json --md-out packages/benchmark/results/release/runtime-counterexample-scan.md
```

```sh
node packages/benchmark/runtime-proof-coverage-audit.mjs --json-out packages/benchmark/results/release/runtime-proof-coverage-audit.json --md-out packages/benchmark/results/release/runtime-proof-coverage-audit.md
```

```sh
node packages/benchmark/source-consumption-shape-audit.mjs --json-out packages/benchmark/results/release/source-consumption-shape-audit.json --md-out packages/benchmark/results/release/source-consumption-shape-audit.md
```

```sh
node packages/benchmark/memory-frontier-audit.mjs --json-out packages/benchmark/results/release/memory-frontier-audit.json --md-out packages/benchmark/results/release/memory-frontier-audit.md
```

```sh
node packages/benchmark/target-distance-audit.mjs --json-out packages/benchmark/results/release/target-distance-audit.json --md-out packages/benchmark/results/release/target-distance-audit.md
```

```sh
node packages/benchmark/text-materialization-boundary-audit.mjs --json-out packages/benchmark/results/release/text-materialization-boundary-audit.json --md-out packages/benchmark/results/release/text-materialization-boundary-audit.md
```

```sh
node packages/benchmark/text-materialization-frontier-coverage-audit.mjs --json-out packages/benchmark/results/release/text-materialization-frontier-coverage-audit.json --md-out packages/benchmark/results/release/text-materialization-frontier-coverage-audit.md
```

```sh
node packages/benchmark/runtime-proof-gap-handoff.mjs --json-out packages/benchmark/results/release/runtime-proof-gap-handoff.json --md-out packages/benchmark/results/release/runtime-proof-gap-handoff.md
```

```sh
node packages/benchmark/runtime-proof-handoff-validation.mjs --json-out packages/benchmark/results/release/runtime-proof-handoff-validation.json --md-out packages/benchmark/results/release/runtime-proof-handoff-validation.md
```

```sh
node packages/benchmark/runtime-limit-proof-obligation-gate.mjs --json-out packages/benchmark/results/release/runtime-limit-proof-obligation-gate.json --md-out packages/benchmark/results/release/runtime-limit-proof-obligation-gate.md
```

## Closure Requirements

Safari/WebKit can close `safari-jsc-source-and-browser-rows-open` only when the
audits prove all of these:

- `runtimeId=safari-jsc-browser`.
- The accepted cases `stringFull`, `eventObjectFull`, and `rawFrameNameId` are
  all present as 1 GiB+ primary sync byte-batch rows.
- Rows preserve full-string event count and checksum parity.
- Parser input is synchronous `Iterable<Uint8Array[]>`, not a full XML string
  or full XML `ArrayBuffer`.
- Direct `ReadableStream` rows, if any, remain separate source-overhead
  evidence and do not substitute for primary rows.
- Memory evidence is explicit. Missing Safari JS heap counters are not bounded
  memory proof.
- Exact Safari/WebKit build identity is recorded.
- Row-level Safari/WebKit source-boundary metadata is recorded. Bun/JSC WebKit
  pins cannot substitute unless the exact Safari/WebKit build identity matches.
- `safari-webkit-closure-audit.json` reports `summary.qualifiedClosureCount>0`.
- `runtime-proof-coverage-audit.json` reports
  `coverage.safariWebKitStatus.closesSafariObligation=true`.
- `runtime-counterexample-scan.json` includes Safari/WebKit rows and classifies
  any 200 MiB/s+ bounded-memory full-string row as a counterexample.
- `target-distance-audit.json` is regenerated after Safari rows.

## Counterexample Handling

If a Safari/WebKit row is 1 GiB+, full-string parity, JavaScript runtime,
bounded-memory, and at least 200 MiB/s, do not use it as closure evidence for a
runtime-limit claim. Treat it as a counterexample and update the ledger.

If Safari rows are fast but lack bounded memory proof, keep them in the
unbounded or unproven memory frontier and do not classify them as bounded
counterexamples.

## Success Signal

Windows-side work is done when the repository passes:

```sh
bun test packages/benchmark/runtime-counterexample-scan-report.test.mjs packages/benchmark/runtime-limit-proof-obligation-gate-report.test.mjs packages/benchmark/runtime-proof-coverage-audit-report.test.mjs packages/benchmark/runtime-proof-gap-handoff-report.test.mjs packages/benchmark/runtime-proof-handoff-validation-report.test.mjs packages/benchmark/safari-webkit-closure-audit-report.test.mjs
```

```sh
pnpm --filter stax-xml test
```

```sh
pnpm --filter stax-xml build
```

```sh
git diff --check
```
