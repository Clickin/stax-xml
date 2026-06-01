# SpiderMonkey Taskcluster Debug JS Shell Codegen Audit

Generated: 2026-06-01T22:15:27.489Z

Checks a current mozilla-central Taskcluster win64-debug SpiderMonkey js-shell for JitSpew codegen output. This proves a current diagnostic-capable shell surface, but it is not a same-contract StAX full-string row because the js-shell host API surface cannot run the unchanged benchmark.

## Summary

- Status: available
- Version: JavaScript-C153.0a1
- Task ID: MUZBnP38TzWA6MfuY9BfzQ
- Route: gecko.v2.mozilla-central.latest.firefox.win64-debug
- Artifact: public/build/target.jsshell.zip
- Artifact bytes: 24836439
- Build ID: 20260601210056
- Build date: 2026-06-01T21:00:56Z
- Source revision: 221c997c114ef812c7d1547bf68f703f4473d178
- Source repository: https://hg.mozilla.org/mozilla-central
- Target version: 153.0a1
- Debug build: true
- Official build: true
- Nightly build: true
- Codegen dump output emitted: true
- Scope comparable to current Firefox: true
- Same-contract StAX row: false
- Can run current StAX full-string benchmark: false
- Closes diagnostic surface obligation: true
- Closes emitted IR obligation: false

## Codegen Probe

- Status: codegen-output-emitted
- Flags: codegen
- Exit code: 0
- Checksum: 5050
- Output bytes: 2339587
- Stdout lines: 1
- Stderr lines: 54757
- Codegen marker count: 54756
- IonScript marker count: 5
- Assembly mnemonic count: 20931

## Host API Probe

- Status: completed
- Missing globals: TextDecoder, TextEncoder, ReadableStream, fetch
- Can run current StAX full-string benchmark: false

## Excerpt

```text
checksum=5050
[Codegen] # Emitting bailout tail stub
[Codegen] # BEGIN creators: JitRuntime::generateBailoutTailStub
[Codegen] 000000  .set .Llabel0, .
[Codegen] 000000  testb      $0xff, %al
[Codegen] 000002  je         .Lfrom8
[Codegen] 000008  .set .Llabel8, .
[Codegen] 000008  movq       0x0(%r9), %rax
[Codegen] 00000b  cmpq       %rax, %rsp
[Codegen] 00000e  je         .Lfrom20
[Codegen] 000014  push       %r10
[Codegen] 000016  push       %r9
[Codegen] 000018  push       %r8
[Codegen] 00001a  push       %rdx
[Codegen] 00001b  push       %rcx
[Codegen] 00001c  push       %rax
[Codegen] 00001d  subq       $96, %rsp
[Codegen] 000021  .set .Llabel33, .
[Codegen] 000021  vmovdqu    %xmm5, 0x50(%rsp)
[Codegen] 000027  .set .Llabel39, .
[Codegen] 000027  vmovdqu    %xmm4, 0x40(%rsp)
[Codegen] 00002d  .set .Llabel45, .
[Codegen] 00002d  vmovdqu    %xmm3, 0x30(%rsp)
[Codegen] 000033  .set .Llabel51, .
[Codegen] 000033  vmovdqu    %xmm2, 0x20(%rsp)
[Codegen] 000039  .set .Llabel57, .
[Codegen] 000039  vmovdqu    %xmm1, 0x10(%rsp)
[Codegen] 00003f  .set .Llabel63, .
[Codegen] 00003f  vmovdqu    %xmm0, 0x0(%rsp)
[Codegen] 000044  movq       %rsp, %rax
[Codegen] 000047  andq       $0xfffffffffffffff0, %rsp
[Codegen] 00004b  push       %rax
[Codegen] 00004c  movabsq    $0x7ff7b0b6234c, %rax
[Codegen] 000056  subq       $40, %rsp
[Codegen] 00005a  movq       %rax, %rcx
[Codegen] 00005d  testb      $0xf, %spl
[Codegen] 000061  je         .Lfrom103
[Codegen] 000067  .set .Llabel103, .
[Codegen] 000067  int3
[Codegen] 000068  .set .Llabel104, .
```

## Findings

- taskcluster-debug-jsshell-codegen-emitted (TRACE_FACT): The current Taskcluster debug SpiderMonkey shell emits JitSpew codegen diagnostics under IONFLAGS/JIT_SPEW.
  - version=JavaScript-C153.0a1
  - taskId=MUZBnP38TzWA6MfuY9BfzQ
  - route=gecko.v2.mozilla-central.latest.firefox.win64-debug
  - buildId=20260601210056
  - sourceRevision=221c997c114ef812c7d1547bf68f703f4473d178
  - debug=true
  - official=true
  - status=codegen-output-emitted
  - codegenMarkers=54756
  - ionScriptMarkers=5
  - assemblyMnemonics=20931
  - checksum=5050
- taskcluster-debug-jsshell-stax-api-gap (NEGATIVE_RESULT): The current debug js-shell lacks the host APIs needed to run the unchanged StAX full-string benchmark.
  - missingGlobals=TextDecoder, TextEncoder, ReadableStream, fetch
  - canRunCurrentStaxFullStringBenchmark=false
  - sameContractStaxRow=false
  - closesEmittedIrObligation=false
- taskcluster-debug-jsshell-scope-guard (SCOPE_GUARD): This is current diagnostic-shell evidence, not emitted codegen for a same-contract StAX full-string benchmark row.
  - scopeComparableToCurrentFirefox=true
  - sameContractStaxRow=false
  - closesDiagnosticSurfaceObligation=true
  - closesEmittedIrObligation=false

