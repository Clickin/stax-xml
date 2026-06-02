# Firefox SpiderMonkey Release JS Shell Availability Audit

Generated: 2026-06-02T17:52:18.393Z

Checks an official Firefox release SpiderMonkey JavaScript shell package for local JIT execution status and diagnostic surface. This is not emitted JIT IR, optimized-code, throughput, or browser evidence.

## Summary

- Status: available
- Package verified: true
- JIT execution status observed: true
- IR dump surface present: false
- Bytecode dump output emitted: true
- IONFLAGS/JIT_SPEW output emitted: false
- Native disassembly surface present: false
- Native dump complete: false
- Binary XML input readable: true
- Can run current stax full-string benchmark unchanged: false
- Closes emitted IR obligation: false
- Package URL: https://archive.mozilla.org/pub/firefox/releases/143.0.1/jsshell/jsshell-win64.zip
- Sums URL: https://archive.mozilla.org/pub/firefox/releases/143.0.1/SHA512SUMS
- Build id: not-recorded
- Source revision: not-recorded

## Package Verification

- Status: verified
- SHA512 match: true
- SHA512: 3fdfe9046c42a5d0bfa5a21db456171636a140866a54264589e10cb55ed29469659753bcbf3823bbafbc30a42535b459f62437e4700728657df5db67a220126a
- Expected line: 3fdfe9046c42a5d0bfa5a21db456171636a140866a54264589e10cb55ed29469659753bcbf3823bbafbc30a42535b459f62437e4700728657df5db67a220126a  jsshell/jsshell-win64.zip

## Build Info

- Status: not-configured
- URL: not-recorded
- File: not-recorded
- Build id: not-recorded
- Source revision: not-recorded
- Source URL: not-recorded

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
- TextDecoder: undefined
- TextEncoder: undefined
- ReadableStream: undefined
- fetch: undefined
- binary read helper: function

## JIT Status Probe

- Exit code: 0
- Ion hits: 4988
- Checksum: 12502500
- ion.enable: 1
- ion.warmup.trigger: 0

## Bytecode Dump Probe

- Status: bytecode-output-emitted
- Exit code: 0
- Checksum: 12502500
- Output bytes: 1063
- Bytecode marker count: 18
- Stdout lines: 24
- Stderr lines: 0

## IONFLAGS/JIT_SPEW Probe

- Status: no-jitspew-output
- Flags: logs,codegen,mir,lir,aborts,scripts
- Exit code: 0
- Ion hits: 4988
- Checksum: 12502500
- Output bytes: 34
- Diagnostic marker count: 0
- Stdout lines: 2
- Stderr lines: 0

## Native Dump Probe

- File created: true
- File bytes: 93
- File SHA256: 9f17b0c664f31c1b23f5873ba27c36532be39207bdab46eea5dc73ede5781326
- hasDisassembler: false
- disnative write error: Error: Did not write all function bytes to the file.

## Binary Input Probe

- Status: ok
- File: G:\programming\stax-xml\packages\benchmark\assets\books.xml
- Byte length: 4551
- Checksum: 356012
- First bytes: 60,63,120,109,108,32,118,101

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
  - hasBytecodeDumpOutput=true
  - hasJitSpewFlag=false
  - hasDisnativeBuiltin=true
  - hasDisblicBuiltin=true
  - hasDisassembler=false
  - bytecodeDumpStatus=bytecode-output-emitted
  - bytecodeDumpMarkers=18
  - envJitSpewStatus=no-jitspew-output
  - envJitSpewMarkers=0
  - envJitSpewStderrLines=0
  - nativeDumpBytes=93
  - nativeDumpError=Error: Did not write all function bytes to the file.
  - This narrows the local diagnostic path but does not close the emitted JIT IR obligation.
- spidermonkey-release-jsshell-stax-api-gap (NEGATIVE_RESULT): The release SpiderMonkey shell can read binary XML into Uint8Array, but lacks TextDecoder/TextEncoder and Web stream globals needed to run the current full-string stax-xml benchmark unchanged.
  - TextDecoder=undefined
  - TextEncoder=undefined
  - ReadableStream=undefined
  - fetch=undefined
  - Uint8Array=function
  - binaryInput=ok
  - binaryBytes=4551
  - canRunCurrentStaxFullStringBenchmark=false
- release-jsshell-scope (SCOPE_GUARD): This audit is shell JIT-status evidence only; it is not browser throughput, allocation, emitted IR, or optimized-code evidence.
  - A diagnostic-capable SpiderMonkey shell or Firefox build is still required for emitted MIR/LIR/codegen dump evidence.
  - --dump-bytecode output, if available, is bytecode diagnostic evidence and is not MIR/LIR or optimized native code.

