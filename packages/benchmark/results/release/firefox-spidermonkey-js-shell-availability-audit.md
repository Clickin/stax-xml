# Firefox/SpiderMonkey JS Shell Availability Audit

Generated: 2026-05-25T10:14:57.422Z

Checks whether a local SpiderMonkey JavaScript shell is available for follow-up JIT IR or optimized-code diagnostics. This is environment evidence only; absence of a shell is not proof that SpiderMonkey cannot emit codegen evidence elsewhere.

## Outcome

- Status: not-found
- Found candidates: none
- Platform: win32-x64

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

## Findings

- spidermonkey-js-shell-not-found (NEGATIVE_RESULT): No local SpiderMonkey JavaScript shell candidate was found on PATH or in the configured environment variables.
  - candidates=js, js.exe, jsshell, jsshell.exe, spidermonkey, spidermonkey.exe, mozjs, mozjs.exe
  - envCandidates=SPIDERMONKEY_JS_SHELL, JSSHELL, JS_SHELL
  - This blocks local js-shell JIT IR probing, but it is not evidence that SpiderMonkey has no codegen headroom.
- js-shell-availability-scope (SCOPE_GUARD): This audit records local tool availability only; it is not emitted JIT IR, optimized-code, allocation, or throughput evidence.
  - A future debug/nightly SpiderMonkey shell or macOS/browser host can still close the codegen proof obligation.

