# Runtime Proof Gap Handoff

Generated: 2026-05-25T07:09:26.069Z

Turns current open or partial runtime proof obligations into concrete external-run handoffs. This is not benchmark evidence, not emitted JIT IR, not Safari/WebKit throughput evidence, and not a runtime-limit conclusion.

## Audit Input

- Audit JSON: G:\programming\stax-xml\packages\benchmark\results\release\runtime-proof-coverage-audit.json
- Audit generated: 2026-05-25T07:08:32.017Z
- Active obligations: 2

## Active Obligations

- safari-jsc-source-and-browser-rows-open (open): Bun/JSC and Bun-patched WebKit evidence is present, but no Safari/WebKit browser benchmark row was found. Local Safari/WebKit availability audit is present and records that the current host/harness cannot run Safari rows.
  - Next: Run same-contract Safari/WebKit rows on a macOS host through the safaridriver wrapper and cross-process stability runner.
- codegen-traces-open (partial): Node/V8 trace evidence present. Bun/JSC codegen/IR evidence present. Chrome/V8 browser codegen trace evidence present. Firefox/SpiderMonkey Gecko Profiler trace evidence present. Firefox/SpiderMonkey JitSpew/IONFLAGS source gate evidence present, but it is not emitted JIT IR. Firefox/SpiderMonkey diagnostic dump audit was attempted and emitted no JIT diagnostic dump from this installed browser build. Firefox/SpiderMonkey local js-shell availability audit present; no emitted JIT IR is recorded by that audit. Firefox/SpiderMonkey JIT IR or optimized-code dump missing.
  - Next: Capture runtime-specific optimized-code or IR evidence for the fastest full-string rows, especially Firefox/SpiderMonkey and any future Safari/WebKit rows.

## Handoffs

### safari-webkit-browser-row-handoff

- Classification: EXTERNAL_RUN_REQUIRED
- Obligations: safari-jsc-source-and-browser-rows-open
- Proof goal: Produce same-contract Safari/WebKit browser rows separate from Bun/JSC, then rerun the coverage audit and counterexample scan.

Prerequisites:
- macOS host with the exact Safari/WebKit build under test.
- Safari WebDriver enabled and safaridriver available, normally /usr/bin/safaridriver.
- Repository checkout with benchmark dependencies installed and stax-xml build artifacts available.
- Use the same full-string checksum rows: stringFull, eventObjectFull, and rawFrameNameId before broadening cases.

Commands:
- safari-availability-audit: Record whether the host can run Safari/WebKit rows.
  - `node packages/benchmark/safari-webkit-availability-audit.mjs --json-out packages/benchmark/results/release/safari-webkit-availability-audit.json --md-out packages/benchmark/results/release/safari-webkit-availability-audit.md`
- safari-smoke: Prove the safaridriver harness can launch the target browser and preserve checksum parity on a small row.
  - `node packages/benchmark/safari-webdriver-candidate-headroom.mjs --driver-executable /usr/bin/safaridriver --size-gib 0.001 --fixture-shape diverse-cycle --diverse-cycle-size 64 --cases stringFull,eventObjectFull,rawFrameNameId --json-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-smoke.json --md-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-smoke.md`
- safari-books-corpus-cross-process: Generate the first 1 GiB same-contract Safari/WebKit corpus stability row set.
  - `node packages/benchmark/browser-candidate-headroom-cross-process.mjs --harness safari-webdriver --driver-executable /usr/bin/safaridriver --process-runs 3 --size-gib 1 --fixture-shape corpus-cycle --corpus-file packages/benchmark/assets/books.xml --batch-size 1 --cases stringFull,eventObjectFull,rawFrameNameId --output-dir packages/benchmark/results/cross-process/safari-webdriver-books-corpus --json-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-cross-process-books-corpus.json --md-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-cross-process-books-corpus.md`
- post-safari-audits: Classify whether Safari rows close the obligation or create a counterexample.
  - `node packages/benchmark/runtime-proof-coverage-audit.mjs --json-out packages/benchmark/results/release/runtime-proof-coverage-audit.json --md-out packages/benchmark/results/release/runtime-proof-coverage-audit.md && node packages/benchmark/runtime-counterexample-scan.mjs --json-out packages/benchmark/results/release/runtime-counterexample-scan.json --md-out packages/benchmark/results/release/runtime-counterexample-scan.md`

Expected evidence:
- Safari/WebKit environment.browserName or javascriptEngine is recognized as safari-jsc-browser by runtime-proof-coverage-audit.
- Rows preserve fullStringParity and the same event/checksum contract.
- Memory evidence is classified explicitly; missing Safari JS heap counters must not be treated as bounded-memory proof.

Scope guards:
- Safari rows are browser JSC evidence; they do not replace Bun/JSC rows.
- A missing or failing safaridriver run is environment evidence only, not a runtime limitation.

### spidermonkey-codegen-handoff

- Classification: EXTERNAL_RUN_REQUIRED
- Obligations: codegen-traces-open
- Proof goal: Capture emitted SpiderMonkey JIT IR, optimized-code, or codegen diagnostics for same-contract Firefox/SpiderMonkey full-string rows.

Prerequisites:
- Diagnostic-capable Firefox build or SpiderMonkey shell built with the required JitSpew/codegen diagnostics enabled.
- Set FIREFOX_PATH when using a non-default Firefox build; set SPIDERMONKEY_JS_SHELL, JSSHELL, or JS_SHELL when probing a shell.
- Keep checksum parity rows small first, then scale only after dump emission is proven.

Commands:
- firefox-diagnostic-installed-or-debug-build: Run the existing browser diagnostic dump audit against the Firefox build selected by FIREFOX_PATH.
  - `FIREFOX_PATH=/path/to/firefox node packages/benchmark/firefox-spidermonkey-diagnostic-dump-audit.mjs --size-gib 0.0001 --fixture-shape diverse-cycle --diverse-cycle-size 16 --cases rawFrameNameId --output-dir packages/benchmark/results/firefox-spidermonkey-diagnostic-dump-audit --json-out packages/benchmark/results/release/firefox-spidermonkey-diagnostic-dump-audit.json --md-out packages/benchmark/results/release/firefox-spidermonkey-diagnostic-dump-audit.md`
- spidermonkey-js-shell-availability: Record whether a local SpiderMonkey shell is available for follow-up JIT diagnostics.
  - `SPIDERMONKEY_JS_SHELL=/path/to/js node packages/benchmark/firefox-spidermonkey-js-shell-availability-audit.mjs --json-out packages/benchmark/results/release/firefox-spidermonkey-js-shell-availability-audit.json --md-out packages/benchmark/results/release/firefox-spidermonkey-js-shell-availability-audit.md`
- post-spidermonkey-audits: Reclassify the codegen obligation after diagnostic artifacts are generated.
  - `node packages/benchmark/runtime-proof-coverage-audit.mjs --json-out packages/benchmark/results/release/runtime-proof-coverage-audit.json --md-out packages/benchmark/results/release/runtime-proof-coverage-audit.md`

Expected evidence:
- A release artifact whose objective records emitted Firefox/SpiderMonkey JIT IR, optimized-code, or codegen dump evidence.
- The artifact must include the runtime/build identity, diagnostic flags, selected row id, event count, and checksum parity.
- The coverage audit must classify the artifact as SpiderMonkey codegen evidence, not merely profiler/source/availability evidence.

Scope guards:
- The existing no-dump diagnostic audit is a negative result for the installed browser build only.
- JS shell availability is environment evidence only until a dump or IR artifact is captured.

## Findings

- handoff-scope (SCOPE_GUARD): The handoff records next experiments for open proof gaps; it is not itself benchmark, allocation, or codegen evidence.
  - activeObligations=safari-jsc-source-and-browser-rows-open:open, codegen-traces-open:partial
  - handoffs=safari-webkit-browser-row-handoff, spidermonkey-codegen-handoff
- handoff-coverage (CONTRACT_FACT): Every currently active proof obligation has a concrete handoff entry.
  - unhandledObligations=0

