# SpiderMonkey Taskcluster Debug JS Shell ASCII StAX Codegen Audit

Generated: 2026-06-03T04:25:29.271Z

Runs the current built StAX StreamReaderSync primary byte-batch API in a Taskcluster debug SpiderMonkey js-shell on ASCII and UTF-8 fixtures and records JitSpew codegen output. This proves a current StAX API UTF-8 js-shell codegen surface after the internal UTF-8 fallback boundary, but it is not the broad 1 GiB same-contract benchmark because the selected row is not in same-contract-runtime-comparison.

## Summary

- Status: available
- Version: JavaScript-C153.0a1
- Task ID: azB5UO80Q3KJPPyXD0C8tA
- Route: gecko.v2.mozilla-central.latest.firefox.win64-debug
- Build ID: 20260602214419
- Source revision: e4f9cbec72268c8efc0137a1d593e24af3df0712
- Codegen dump output emitted: true
- Current StAX ASCII primary byte-batch row: true
- Current StAX UTF-8 primary byte-batch row: true
- Same-contract StAX row: false
- Can run current StAX full-string benchmark: false
- Can run ASCII primary byte-batch benchmark: true
- Can run UTF-8 primary byte-batch benchmark: true
- Evidence class: current-debug-ascii-stax-codegen-scope-guard
- Closes diagnostic surface obligation: true
- Closes emitted IR obligation: false

## ASCII StAX Probe

- Status: ascii-stax-codegen-output-emitted
- Flags: codegen
- Exit code: 0
- Output bytes: 26346382
- Codegen marker count: 603868
- IonScript marker count: 268
- Assembly mnemonic count: 217637
- Event count: 4
- Checksum: 1418510204
- Materialized fields: {"name":"root","attrName":"a","attrValue":"b","text":"text"}

## UTF-8 StAX Probe

- Event count: 4
- Checksum: 544876941
- Materialized fields: {"name":"root","attrName":"a","attrValue":"값","text":"본문🌊"}

## Host API Probe

- Missing globals: TextDecoder, TextEncoder, ReadableStream, fetch
- Can run ASCII primary byte-batch benchmark: true

## Excerpt

```text
asciiStaxPayload={"iterations":200,"byteLength":23,"result":{"eventCount":4,"checksum":1418510204,"name":"root","attrName":"a","attrValue":"b","text":"text"},"utf8ByteLength":31,"utf8Result":{"eventCount":4,"checksum":544876941,"name":"root","attrName":"a","attrValue":"값","text":"본문🌊"},"globals":{"TextDecoder":"undefined","TextEncoder":"undefined","ReadableStream":"undefined","fetch":"undefined","Uint8Array":"function"}}
found tag: codegen
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
[Codegen] 00004c  movabsq    $0x7ff7e276299c, %rax
[Codegen] 000056  subq       $40, %rsp
[Codegen] 00005a  movq       %rax, %rcx
[Codegen] 00005d  testb      $0xf, %spl
[Codegen] 000061  je         .Lfrom103
[Codegen] 000067  .set .Llabel103, .
[Codegen] 000067  int3
[Codegen] 000068  .set .Llabel104, .
[Codegen] 000068  .set .Lfrom103, .Llabel104
[Codegen] 000068  call       .Lfrom109
[Codegen] 00006d  addq       $40, %rsp
[Codegen] 000071  pop        %rsp
[Codegen] 000072  .set .Llabel114, .
[Codegen] 000072  vmovdqu    0x50(%rsp), %xmm5
[Codegen] 000078  .set .Llabel120, .
[Codegen] 000078  vmovdqu    0x40(%rsp), %xmm4
[Codegen] 00007e  .set .Llabel126, .
```

## Findings

- taskcluster-debug-jsshell-ascii-stax-codegen-emitted (TRACE_FACT): The current Taskcluster debug SpiderMonkey shell emits JitSpew codegen while running the built StAX StreamReaderSync ASCII primary byte-batch API.
  - version=JavaScript-C153.0a1
  - taskId=azB5UO80Q3KJPPyXD0C8tA
  - buildId=20260602214419
  - sourceRevision=e4f9cbec72268c8efc0137a1d593e24af3df0712
  - status=ascii-stax-codegen-output-emitted
  - codegenMarkers=603868
  - eventCount=4
  - checksum=1418510204
- taskcluster-debug-jsshell-utf8-stax-codegen-emitted (TRACE_FACT): The current Taskcluster debug SpiderMonkey shell emits JitSpew codegen while running the built StAX StreamReaderSync UTF-8 primary byte-batch API without host TextDecoder.
  - currentStaxUtf8PrimaryByteBatchRow=true
  - canRunUtf8PrimaryByteBatchBenchmark=true
  - eventCount=4
  - checksum=544876941
  - attrValue=값
  - text=본문🌊
- taskcluster-debug-jsshell-ascii-stax-host-api-narrowing (SCOPE_GUARD): The ASCII and UTF-8 primary byte-batch StAX paths can run without TextDecoder/TextEncoder, but this does not prove the selected 1 GiB same-contract benchmark.
  - currentStaxAsciiPrimaryByteBatchRow=true
  - currentStaxUtf8PrimaryByteBatchRow=true
  - canRunAsciiPrimaryByteBatchBenchmark=true
  - canRunUtf8PrimaryByteBatchBenchmark=true
  - missingGlobals=TextDecoder, TextEncoder, ReadableStream, fetch
  - sameContractStaxRow=false
  - closesEmittedIrObligation=false

