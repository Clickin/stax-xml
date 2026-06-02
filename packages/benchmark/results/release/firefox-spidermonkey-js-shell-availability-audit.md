# Firefox/SpiderMonkey JS Shell Availability Audit

Generated: 2026-06-02T17:44:40.699Z

Checks whether a local SpiderMonkey JavaScript shell is available for follow-up JIT IR or optimized-code diagnostics. This is environment evidence only; absence of a shell is not proof that SpiderMonkey cannot emit codegen evidence elsewhere.

## Outcome

- Status: available
- Found candidates: G:\tmp\stax-spidermonkey-jsshell\extract\js.exe, G:\tmp\stax-spidermonkey-nightly-jsshell\js.exe
- Platform: win32-x64
- Search roots: G:\tmp\stax-spidermonkey-jsshell\extract, G:\tmp\stax-spidermonkey-nightly-jsshell

## Probes

| Source | Candidate | Status | Detail |
| --- | --- | --- | --- |
| env:SPIDERMONKEY_JS_SHELL | none | not-configured |  |
| env:JSSHELL | none | not-configured |  |
| env:JS_SHELL | none | not-configured |  |
| PATH | js | missing | spawnSync js ENOENT |
| PATH | js.exe | missing | spawnSync js.exe ENOENT |
| PATH | jsshell | missing | spawnSync jsshell ENOENT |
| PATH | jsshell.exe | missing | spawnSync jsshell.exe ENOENT |
| PATH | spidermonkey | missing | spawnSync spidermonkey ENOENT |
| PATH | spidermonkey.exe | missing | spawnSync spidermonkey.exe ENOENT |
| PATH | mozjs | missing | spawnSync mozjs ENOENT |
| PATH | mozjs.exe | missing | spawnSync mozjs.exe ENOENT |
| filesystem:G:\tmp\stax-spidermonkey-jsshell\extract | G:\tmp\stax-spidermonkey-jsshell\extract\js | missing | G:\tmp\stax-spidermonkey-jsshell\extract\js |
| filesystem:G:\tmp\stax-spidermonkey-jsshell\extract | G:\tmp\stax-spidermonkey-jsshell\extract\js.exe | found | JavaScript-C143.0.1 |
| filesystem:G:\tmp\stax-spidermonkey-jsshell\extract | G:\tmp\stax-spidermonkey-jsshell\extract\jsshell | missing | G:\tmp\stax-spidermonkey-jsshell\extract\jsshell |
| filesystem:G:\tmp\stax-spidermonkey-jsshell\extract | G:\tmp\stax-spidermonkey-jsshell\extract\jsshell.exe | missing | G:\tmp\stax-spidermonkey-jsshell\extract\jsshell.exe |
| filesystem:G:\tmp\stax-spidermonkey-jsshell\extract | G:\tmp\stax-spidermonkey-jsshell\extract\spidermonkey | missing | G:\tmp\stax-spidermonkey-jsshell\extract\spidermonkey |
| filesystem:G:\tmp\stax-spidermonkey-jsshell\extract | G:\tmp\stax-spidermonkey-jsshell\extract\spidermonkey.exe | missing | G:\tmp\stax-spidermonkey-jsshell\extract\spidermonkey.exe |
| filesystem:G:\tmp\stax-spidermonkey-jsshell\extract | G:\tmp\stax-spidermonkey-jsshell\extract\mozjs | missing | G:\tmp\stax-spidermonkey-jsshell\extract\mozjs |
| filesystem:G:\tmp\stax-spidermonkey-jsshell\extract | G:\tmp\stax-spidermonkey-jsshell\extract\mozjs.exe | missing | G:\tmp\stax-spidermonkey-jsshell\extract\mozjs.exe |
| filesystem:G:\tmp\stax-spidermonkey-nightly-jsshell | G:\tmp\stax-spidermonkey-nightly-jsshell\js | missing | G:\tmp\stax-spidermonkey-nightly-jsshell\js |
| filesystem:G:\tmp\stax-spidermonkey-nightly-jsshell | G:\tmp\stax-spidermonkey-nightly-jsshell\js.exe | found | JavaScript-C143.0a1 |
| filesystem:G:\tmp\stax-spidermonkey-nightly-jsshell | G:\tmp\stax-spidermonkey-nightly-jsshell\jsshell | missing | G:\tmp\stax-spidermonkey-nightly-jsshell\jsshell |
| filesystem:G:\tmp\stax-spidermonkey-nightly-jsshell | G:\tmp\stax-spidermonkey-nightly-jsshell\jsshell.exe | missing | G:\tmp\stax-spidermonkey-nightly-jsshell\jsshell.exe |
| filesystem:G:\tmp\stax-spidermonkey-nightly-jsshell | G:\tmp\stax-spidermonkey-nightly-jsshell\spidermonkey | missing | G:\tmp\stax-spidermonkey-nightly-jsshell\spidermonkey |
| filesystem:G:\tmp\stax-spidermonkey-nightly-jsshell | G:\tmp\stax-spidermonkey-nightly-jsshell\spidermonkey.exe | missing | G:\tmp\stax-spidermonkey-nightly-jsshell\spidermonkey.exe |
| filesystem:G:\tmp\stax-spidermonkey-nightly-jsshell | G:\tmp\stax-spidermonkey-nightly-jsshell\mozjs | missing | G:\tmp\stax-spidermonkey-nightly-jsshell\mozjs |
| filesystem:G:\tmp\stax-spidermonkey-nightly-jsshell | G:\tmp\stax-spidermonkey-nightly-jsshell\mozjs.exe | missing | G:\tmp\stax-spidermonkey-nightly-jsshell\mozjs.exe |

## Findings

- spidermonkey-js-shell-available (ENVIRONMENT_FACT): A local SpiderMonkey JavaScript shell candidate is available for future JIT diagnostic runs.
  - candidate=G:\tmp\stax-spidermonkey-jsshell\extract\js.exe
  - candidate=G:\tmp\stax-spidermonkey-nightly-jsshell\js.exe
- js-shell-availability-scope (SCOPE_GUARD): This audit records local tool availability only; it is not emitted JIT IR, optimized-code, allocation, or throughput evidence.
  - A future debug/nightly SpiderMonkey shell or macOS/browser host can still close the codegen proof obligation.

