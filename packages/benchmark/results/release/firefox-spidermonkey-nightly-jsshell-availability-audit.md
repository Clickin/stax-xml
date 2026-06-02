# Firefox SpiderMonkey Nightly JS Shell Availability Audit

Generated: 2026-06-02T17:52:18.477Z

Checks an official Firefox nightly SpiderMonkey JavaScript shell package for local JIT execution status and diagnostic surface. This is not emitted JIT IR, optimized-code, throughput, or browser evidence.

## Summary

- Status: available
- Package verified: false
- JIT execution status observed: true
- IR dump surface present: false
- Bytecode dump output emitted: true
- IONFLAGS/JIT_SPEW output emitted: false
- Native disassembly surface present: false
- Native dump complete: false
- Binary XML input readable: true
- Can run current stax full-string benchmark unchanged: false
- Closes emitted IR obligation: false
- Package URL: https://archive.mozilla.org/pub/firefox/nightly/latest-mozilla-central/jsshell-win64.zip
- Sums URL: https://archive.mozilla.org/pub/firefox/nightly/latest-mozilla-central/
- Build id: 20260531212007
- Source revision: 71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7

## Package Verification

- Status: not-checked
- SHA512 match: null
- SHA512: 4d27579cc95d07b22e6e841ce8e9d63906853ed9b284ddd20902f770c879acadb489254a6c818435dfb9e34e69e64bbdff136cdebe3930b8a1e98e5445d7da7a
- Expected line: not-recorded

## Build Info

- Status: ok
- URL: https://archive.mozilla.org/pub/firefox/nightly/latest-mozilla-central/firefox-153.0a1.en-US.win64.txt
- File: G:\tmp\stax-spidermonkey-latest-jsshell-153\firefox-153.0a1.en-US.win64.txt
- Build id: 20260531212007
- Source revision: 71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7
- Source URL: https://hg.mozilla.org/mozilla-central/rev/71e37c8757f87e7682d7db7d9b9ec9f7f81e24f7

## Shell Surface

- JS shell: G:\tmp\stax-spidermonkey-latest-jsshell-153\extract\js.exe
- Version: JavaScript-C153.0a1
- Help version: Version: JavaScript-C153.0a1
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
- File bytes: 83
- File SHA256: dbbc992c055cb8a385c3167be0cf2688d026306bf291312a22b85b5e57f6d974
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
  - version=JavaScript-C153.0a1
  - packageVerified=false
  - packageUrl=https://archive.mozilla.org/pub/firefox/nightly/latest-mozilla-central/jsshell-win64.zip
- spidermonkey-jit-status-observed (TRACE_FACT): The nightly SpiderMonkey shell can observe Ion execution status with inIon() under --ion-eager.
  - ionHits=4988
  - checksum=12502500
  - ionEnable=1
  - ionWarmup=0
- spidermonkey-nightly-jsshell-no-ir-dump-surface (NEGATIVE_RESULT): The nightly SpiderMonkey shell exposes Ion controls and native dump helper names, but no active disassembler or JitSpew/IONFLAGS/IR dump surface.
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
  - nativeDumpBytes=83
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
  - --dump-bytecode output, if available, is bytecode diagnostic evidence and is not MIR/LIR or optimized native code.

