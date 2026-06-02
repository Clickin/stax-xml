# Safari/WebKit Availability Audit

Generated: 2026-06-02T15:40:46.975Z

ENVIRONMENT_FACT_LIMIT evidence for the current host and repository harness. It does not benchmark Safari/WebKit and does not prove Safari/WebKit cannot be a counterexample elsewhere.

## Summary

- Host platform: win32-x64
- Host is macOS: no
- Safari executable found: no
- Safari executable path: none
- safaridriver found: no
- Current harness supports Safari/WebKit: yes
- Can run Safari browser rows now: no
- Safari benchmark rows recorded: no
- Exact Safari build identity recorded: no
- Safari source boundary pinned: no
- Primary sync byte-batch rows recorded: no
- Bounded primary sync byte-batch rows recorded: no
- Direct ReadableStream rows are separate evidence: yes
- Closure requirements met: 2
- Closure requirements blocked: 9
- Closes Safari obligation: no
- Open obligation remains: yes

## Command Probes

| Command | Found | Resolved path |
| --- | --- | --- |
| safaridriver | no |  |
| Safari | no |  |
| MiniBrowser | no |  |
| WebKitWebDriver | no |  |

## Path Probes

| Label | Exists | Path |
| --- | --- | --- |
| macOS Safari app | no | /Applications/Safari.app/Contents/MacOS/Safari |
| macOS safaridriver | no | /usr/bin/safaridriver |
| Windows legacy Safari app | no | C:\Program Files\Safari\Safari.exe |
| Windows legacy Safari x86 app | no | C:\Program Files (x86)\Safari\Safari.exe |

## Environment Probes

| Variable | Exists | Value |
| --- | --- | --- |
| SAFARI_PATH | no |  |
| WEBKIT_PATH | no |  |
| WEBKIT_BROWSER_PATH | no |  |
| PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH | no |  |

## Harness Scope

Current benchmark browser harnesses support Chrome/Edge through CDP, Firefox through built-in WebDriver BiDi, and Safari/WebKit through the safaridriver WebDriver wrapper, including cross-process stability rows, when safaridriver is available.

| Entry point | Exists | Path |
| --- | --- | --- |
| safari smoke harness | yes | G:\programming\stax-xml\packages\benchmark\safari-webdriver-candidate-headroom.mjs |
| cross-process browser harness | yes | G:\programming\stax-xml\packages\benchmark\browser-candidate-headroom-cross-process.mjs |

## Closure Matrix

| Requirement | Status | Summary |
| --- | --- | --- |
| `host-is-macos` | blocked | Current host is not macOS, so this audit cannot produce local Safari browser rows. |
| `safari-executable-found` | blocked | No Safari/WebKit executable was found on PATH, common install paths, or configured environment variables. |
| `safaridriver-found` | blocked | No safaridriver/WebKit driver was found. |
| `harness-supports-safari` | met | Repository harness has a Safari/WebKit execution path. |
| `can-run-safari-browser-rows` | blocked | Current host cannot run Safari/WebKit browser benchmark rows. |
| `safari-benchmark-rows-recorded` | blocked | No Safari/WebKit benchmark row is recorded by this environment audit. |
| `primary-sync-byte-batch-rows-recorded` | blocked | No Safari/WebKit primary sync byte-batch row is recorded. |
| `bounded-primary-sync-byte-batch-rows-recorded` | blocked | No bounded Safari/WebKit primary sync byte-batch row is recorded. |
| `exact-build-identity-recorded` | blocked | No exact Safari/WebKit build identity is recorded. |
| `source-boundary-pinned` | blocked | No Safari/WebKit source boundary is pinned. |
| `direct-readable-stream-not-substitute` | met | Direct ReadableStream rows are explicitly scoped as separate source-overhead evidence. |

## Findings

- local-host-platform (ENVIRONMENT_FACT_LIMIT): Current host is not macOS, so Apple Safari browser rows are not locally runnable through the normal Safari/safaridriver path.
- local-safari-executable (OPEN): No local Safari/WebKit executable was found through PATH, common install paths, or explicit environment variables.
- local-safaridriver (OPEN): No local safaridriver/WebKit driver path was found.
- repo-harness-support (ENVIRONMENT_FACT_LIMIT): Current benchmark browser harnesses support Chrome/Edge through CDP, Firefox through built-in WebDriver BiDi, and Safari/WebKit through the safaridriver WebDriver wrapper, including cross-process stability rows, when safaridriver is available.
- safari-row-obligation-remains (OPEN): Safari/WebKit browser rows remain unrecorded; this audit only explains the local gap and is not a substitute for same-contract rows.

## Scope Limits

- This is an environment availability audit, not a benchmark row.
- This does not prove Safari/WebKit cannot exceed any throughput threshold.
- A future Safari/WebKit row must still use the same full-string contract and counterexample scanner.
