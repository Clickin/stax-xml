# Safari/WebKit Availability Audit

Generated: 2026-05-26T21:19:00.453Z

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
