# Firefox SpiderMonkey Release JS Shell Availability Audit

Generated: 2026-05-26T23:01:39.317Z

Checks an official Firefox release SpiderMonkey JavaScript shell package for local JIT execution status and diagnostic surface. This is not emitted JIT IR, optimized-code, throughput, or browser evidence.

## Summary

- Status: available
- Package verified: true
- JIT execution status observed: true
- IR dump surface present: false
- Native disassembly surface present: false
- Native dump complete: false
- Closes emitted IR obligation: false
- Package URL: https://archive.mozilla.org/pub/firefox/releases/143.0.1/jsshell/jsshell-win64.zip
- Sums URL: https://archive.mozilla.org/pub/firefox/releases/143.0.1/SHA512SUMS

## Package Verification

- Status: verified
- SHA512 match: true
- SHA512: 3fdfe9046c42a5d0bfa5a21db456171636a140866a54264589e10cb55ed29469659753bcbf3823bbafbc30a42535b459f62437e4700728657df5db67a220126a
- Expected line: 3fdfe9046c42a5d0bfa5a21db456171636a140866a54264589e10cb55ed29469659753bcbf3823bbafbc30a42535b459f62437e4700728657df5db67a220126a  jsshell/jsshell-win64.zip

## Shell Surface

- JS shell: G:\tmp\stax-spidermonkey-jsshell\extract\js.exe
- Version: JavaScript-C143.0.1
- Help version: Version: JavaScript-C143.0.1
- has --ion-eager: true
- has --ion-offthread-compile: true
- has --dump-bytecode: true
- has JitSpew/IR dump flag surface: false
- has disnative builtin: true
- has disblic builtin: true
- has inJit builtin: true
- hasDisassembler(): false

## JIT Status Probe

- Exit code: 0
- Ion hits: 4988
- Checksum: 12502500
- ion.enable: 1
- ion.warmup.trigger: 0

## Native Dump Probe

- File created: true
- File bytes: 93
- File SHA256: 77ae9208875b0b06c4108084ed4be78ae9150a0ab4d462a5c11032133d8ebae0
- hasDisassembler: false
- disnative write error: Error: Did not write all function bytes to the file.

## Findings

- official-release-jsshell-available (ENVIRONMENT_FACT): The official Firefox release SpiderMonkey JavaScript shell is executable locally.
  - version=JavaScript-C143.0.1
  - packageVerified=true
  - packageUrl=https://archive.mozilla.org/pub/firefox/releases/143.0.1/jsshell/jsshell-win64.zip
- spidermonkey-jit-status-observed (TRACE_FACT): The release SpiderMonkey shell can observe Ion execution status with inIon() under --ion-eager.
  - ionHits=4988
  - checksum=12502500
  - ionEnable=1
  - ionWarmup=0
- spidermonkey-release-jsshell-no-ir-dump-surface (NEGATIVE_RESULT): The release SpiderMonkey shell exposes Ion controls and native dump helper names, but no active disassembler or JitSpew/IONFLAGS/IR dump surface.
  - hasIonEager=true
  - hasIonOffthreadCompile=true
  - hasDumpBytecode=true
  - hasJitSpewFlag=false
  - hasDisnativeBuiltin=true
  - hasDisblicBuiltin=true
  - hasDisassembler=false
  - nativeDumpBytes=93
  - nativeDumpError=Error: Did not write all function bytes to the file.
  - This narrows the local diagnostic path but does not close the emitted JIT IR obligation.
- release-jsshell-scope (SCOPE_GUARD): This audit is shell JIT-status evidence only; it is not browser throughput, allocation, emitted IR, or optimized-code evidence.
  - A diagnostic-capable SpiderMonkey shell or Firefox build is still required for emitted MIR/LIR/codegen dump evidence.

