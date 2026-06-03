# Firefox/SpiderMonkey Taskcluster Debug Browser Launch Preflight Audit

Generated: 2026-06-03T02:49:00.569Z

Checks whether the Taskcluster win64-debug Firefox browser can start at all on this Windows host before treating it as a same-contract SpiderMonkey browser codegen path. This is launch preflight evidence, not emitted IR, not benchmark throughput, and not a runtime-limit conclusion.

## Outcome

- Status: blocked-by-dll-blocklist-interceptor
- Browser executable: G:\tmp\stax-spidermonkey-taskcluster-debug-firefox-azB5UO80Q3KJPPyXD0C8tA\extract\firefox\firefox.exe
- Executable present: yes
- Attempts: 2
- Started attempts: 0
- DLL blocklist/interceptor failures: 2
- MOZ_DISABLE_DLL_BLOCKLIST changed failure: no
- Can start debug browser: no
- Same-contract StAX row: no
- Closes emitted IR obligation: no

## Attempts

| Attempt | Status | Exit code | Timed out | DLL blocklist failure | Interceptor assertion | Env override |
| --- | --- | ---: | --- | --- | --- | --- |
| help-baseline | failed | 2147483651 | no | yes | yes | none |
| help-disable-dll-blocklist | failed | 2147483651 | no | yes | yes | MOZ_DISABLE_DLL_BLOCKLIST=1 |

## Findings

- taskcluster-debug-firefox-preflight-blocked (NEGATIVE_RESULT): The Taskcluster debug Firefox browser fails during minimal process startup before any BiDi or StAX benchmark work can run.
  - attempts=2
  - dllBlocklistFailures=2
  - disableDllBlocklistChangedFailure=false
- debug-browser-preflight-scope (SCOPE_GUARD): This launch preflight is not SpiderMonkey emitted IR or same-contract StAX closure evidence.
  - A failed debug browser startup cannot close codegen-traces-open.
  - A future debug browser that reaches BiDi must still emit IR or optimized-code metadata for a same-contract full-string StAX row.
