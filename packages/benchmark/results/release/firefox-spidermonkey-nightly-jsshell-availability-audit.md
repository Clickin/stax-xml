# Firefox SpiderMonkey Nightly JS Shell Availability Audit

Generated: 2026-05-26T23:50:52.444Z

Checks an official Firefox nightly SpiderMonkey JavaScript shell package for local JIT execution status and diagnostic surface. This is not emitted JIT IR, optimized-code, throughput, or browser evidence.

## Summary

- Status: available
- Package verified: false
- JIT execution status observed: true
- IR dump surface present: false
- Native disassembly surface present: false
- Native dump complete: false
- Binary XML input readable: true
- Can run current stax full-string benchmark unchanged: false
- Closes emitted IR obligation: false
- Package URL: https://archive.mozilla.org/pub/firefox/nightly/2025/08/2025-08-11-09-34-16-mozilla-central/jsshell-win64.zip
- Sums URL: https://archive.mozilla.org/pub/firefox/nightly/2025/08/2025-08-11-09-34-16-mozilla-central/

## Package Verification

- Status: not-checked
- SHA512 match: null
- SHA512: c6dc2165aa054017a3cbdc422d29a5fec7b23e3d537dc81cd8f22c30a15b45399e556ed930f619dd4994a507b4ae48f3ca1a87bfc527f24a1a992b7fe9a28497
- Expected line: not-recorded

## Shell Surface

- JS shell: G:\tmp\stax-spidermonkey-nightly-jsshell\js.exe
- Version: JavaScript-C143.0a1
- Help version: Version: JavaScript-C143.0a1
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

## Native Dump Probe

- File created: true
- File bytes: 93
- File SHA256: e77a6fb36ee90f3ba28614e7cd8be94ddd9651f6be0b1d025141cf8274d3437b
- hasDisassembler: false
- disnative write error: Error: Did not write all function bytes to the file.

## Binary Input Probe

- Status: ok
- File: G:\programming\stax-xml\packages\benchmark\assets\books.xml
- Byte length: 4551
- Checksum: 356012
- First bytes: 60,63,120,109,108,32,118,101

## Findings

- official-nightly-jsshell-available (ENVIRONMENT_FACT): The official Firefox nightly SpiderMonkey JavaScript shell is executable locally.
  - version=JavaScript-C143.0a1
  - packageVerified=false
  - packageUrl=https://archive.mozilla.org/pub/firefox/nightly/2025/08/2025-08-11-09-34-16-mozilla-central/jsshell-win64.zip
- spidermonkey-jit-status-observed (TRACE_FACT): The nightly SpiderMonkey shell can observe Ion execution status with inIon() under --ion-eager.
  - ionHits=4988
  - checksum=12502500
  - ionEnable=1
  - ionWarmup=0
- spidermonkey-nightly-jsshell-no-ir-dump-surface (NEGATIVE_RESULT): The nightly SpiderMonkey shell exposes Ion controls and native dump helper names, but no active disassembler or JitSpew/IONFLAGS/IR dump surface.
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
- spidermonkey-nightly-jsshell-stax-api-gap (NEGATIVE_RESULT): The nightly SpiderMonkey shell can read binary XML into Uint8Array, but lacks TextDecoder/TextEncoder and Web stream globals needed to run the current full-string stax-xml benchmark unchanged.
  - TextDecoder=undefined
  - TextEncoder=undefined
  - ReadableStream=undefined
  - fetch=undefined
  - Uint8Array=function
  - binaryInput=ok
  - binaryBytes=4551
  - canRunCurrentStaxFullStringBenchmark=false
- nightly-jsshell-scope (SCOPE_GUARD): This audit is shell JIT-status evidence only; it is not browser throughput, allocation, emitted IR, or optimized-code evidence.
  - A diagnostic-capable SpiderMonkey shell or Firefox build is still required for emitted MIR/LIR/codegen dump evidence.

