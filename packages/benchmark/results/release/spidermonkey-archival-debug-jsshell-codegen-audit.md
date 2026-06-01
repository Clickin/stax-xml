# SpiderMonkey Archival Debug JS Shell Codegen Audit

Generated: 2026-06-01T03:00:26.989Z

Checks an archived Mozilla debug SpiderMonkey js-shell for JitSpew codegen output. This proves the expected diagnostic surface shape, but the shell is Firefox 36 era and is not current Firefox/SpiderMonkey StAX evidence.

## Summary

- Status: available
- Version: Version: JavaScript-C36.0a2
- Build ID: 20150102133716
- Source revision: b6b89746c58b
- Package URL: https://archive.mozilla.org/pub/firefox/nightly/2015/01/2015-01-03-mozilla-aurora-debug/jsshell-win64-x86_64.zip
- Build info URL: https://archive.mozilla.org/pub/firefox/nightly/2015/01/2015-01-03-mozilla-aurora-debug/firefox-36.0a2.en-US.debug-win64-x86_64.txt
- Codegen dump output emitted: true
- Scope comparable to current Firefox: false
- Same-contract StAX row: false
- Closes emitted IR obligation: false

## Codegen Probe

- Status: codegen-output-emitted
- Flags: codegen
- Exit code: 0
- Checksum: 5050
- Output bytes: 1490940
- Stdout lines: 1
- Stderr lines: 42040
- Codegen marker count: 42040
- IonScript marker count: 8
- Assembly mnemonic count: 19105

## Excerpt

```text
checksum=5050
[Codegen] # Emitting exception tail stub
[Codegen] subq       $0x30, %rsp
[Codegen] movq       %rsp, %rax
[Codegen] movq       %rsp, %rcx
[Codegen] andq       $0xfffffff0, %rsp
[Codegen] push       %rcx
[Codegen] subq       $0x28, %rsp
[Codegen] movq       %rax, %rcx
[Codegen] testb      $0xf, %ah/spl
[Codegen] je         ((32))
[Codegen] int3
[Codegen] #label     ((33))
[Codegen] ##link     ((32)) jumps to ((33))
[Codegen] ##setRel32 ((from=00000008CCFFE850)) ((to=00000008CCFFE851))
[Codegen] movabsq    $0x7ff7268c1b60, %rax
[Codegen] call       *%rax
[Codegen] addq       $0x28, %rsp
[Codegen] pop        %rsp
[Codegen] movq       0x18(%rsp), %rax
[Codegen] testl      %eax, %eax
[Codegen] je         ((63))
[Codegen] cmpl       $0x1, %eax
[Codegen] je         ((72))
[Codegen] cmpl       $0x2, %eax
[Codegen] je         ((81))
[Codegen] cmpl       $0x3, %eax
[Codegen] je         ((90))
[Codegen] cmpl       $0x4, %eax
[Codegen] je         ((99))
[Codegen] int3
[Codegen] #label     ((100))
[Codegen] ##link     ((63)) jumps to ((100))
[Codegen] ##setRel32 ((from=00000008CCFFE86F)) ((to=00000008CCFFE894))
[Codegen] movabsq    $0xfffa00000000000e, %rcx
[Codegen] movq       0x8(%rsp), %rsp
[Codegen] ret
[Codegen] #label     ((116))
[Codegen] ##link     ((72)) jumps to ((116))
[Codegen] ##setRel32 ((from=00000008CCFFE878)) ((to=00000008CCFFE8A4))
```

## Findings

- archival-debug-jsshell-codegen-emitted (TRACE_FACT): The archived debug SpiderMonkey shell emits JitSpew codegen diagnostics under IONFLAGS/JIT_SPEW.
  - version=Version: JavaScript-C36.0a2
  - buildId=20150102133716
  - sourceRevision=b6b89746c58b
  - status=codegen-output-emitted
  - codegenMarkers=42040
  - ionScriptMarkers=8
  - assemblyMnemonics=19105
  - checksum=5050
- archival-debug-jsshell-scope-guard (SCOPE_GUARD): This is diagnostic-surface evidence for an archived Firefox 36 era shell, not current Firefox 143/SpiderMonkey benchmark evidence.
  - scopeComparableToCurrentFirefox=false
  - sameContractStaxRow=false
  - closesEmittedIrObligation=false
  - A current diagnostic-capable Firefox/SpiderMonkey build is still required for the open codegen obligation.

