# Bun/JSC TextDecoder Codegen Trace

Generated: 2026-05-25T12:11:39.364Z

This report is a TRACE_FACT for one Bun/JavaScriptCore build and the TextDecoder span materialization matrix.
It uses JavaScriptCore bytecode and DFG JIT dump options. It is not native Bun Zig generated-code proof, not Safari/browser evidence, and not a runtime ceiling proof.

## Environment

- Runtime: bun 1.3.13
- Bun revision: 1.3.13+bf2e2cecf
- JavaScript engine: JavaScriptCore
- WebKit commit: 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
- Host Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture size: 1.02 MiB (0.0010000672191381454 GiB actual)
- Batch size: 16
- JSC trace env: JSC_dumpBytecodeAtDFGTime=true, JSC_dumpDFGDisassembly=true
- Raw artifacts committed: no

## Variant Parity

- Full-string parity status: ok
- Full-string rows: 5

| Variant | MiB/s | Events | Checksum | TextDecoder calls | New decoders | Short ASCII hits | Bounded memory |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| subarraySharedDecoder | 6.41 | 47753 | -1316984100 | 108525 | 0 | 0 | yes |
| viewSharedDecoder | 13.97 | 47753 | -1316984100 | 108525 | 0 | 0 | yes |
| sliceCopySharedDecoder | 1.97 | 47753 | -1316984100 | 108525 | 0 | 0 | yes |
| subarrayNewDecoder | 6.94 | 47753 | -1316984100 | 108525 | 108525 | 0 | yes |
| shortAsciiSubarraySharedDecoder | 7.82 | 47753 | -1316984100 | 8682 | 0 | 99843 | yes |

## Trace Summary

- Trace bytes: 946861
- Trace lines: 12141
- Parsing lines: 26
- Generated JIT lines: 22
- Generated DFG JIT lines: 18
- Bytecode lines: 675
- DFG node lines: 1880
- Target function mentions: 59

| Target | Mentions |
| --- | ---: |
| TextDecoder | 14 |
| decode | 25 |
| decodeShortAsciiSpan | 0 |
| consumeVariant | 0 |
| StreamReaderSync | 0 |
| Uint8Array.subarray | 16 |
| materializeName | 4 |
| currentGeneration | 0 |

## Findings

- bun-jsc-textdecoder-bytecode-dfg-trace-visible (TRACE_FACT): Bun/JSC emitted JavaScriptCore bytecode and DFG JIT disassembly while running the TextDecoder span matrix.
  - generatedDfgLineCount=18
  - bytecodeLineCount=675
  - dfgNodeLineCount=1880
  - totalTargetMentions=59
- bun-jsc-textdecoder-full-string-contract (TRACE_FACT): The traced TextDecoder rows preserved full-string event count and checksum parity.
  - subarraySharedDecoder: events=47753, checksum=-1316984100, textDecoderCalls=108525, mibPerSec=6.41
  - viewSharedDecoder: events=47753, checksum=-1316984100, textDecoderCalls=108525, mibPerSec=13.97
  - sliceCopySharedDecoder: events=47753, checksum=-1316984100, textDecoderCalls=108525, mibPerSec=1.97
  - subarrayNewDecoder: events=47753, checksum=-1316984100, textDecoderCalls=108525, mibPerSec=6.94
  - shortAsciiSubarraySharedDecoder: events=47753, checksum=-1316984100, textDecoderCalls=8682, mibPerSec=7.82
- not-native-zig-codegen-or-safari-proof (SCOPE_GUARD): This trace observes Bun/JSC JavaScript benchmark callsites, not native Bun Zig TextDecoder generated code or Safari/WebKit browser behavior.
  - The Bun TextDecoder dispatch source-pin audit remains the source evidence for Bun Zig default UTF-8 dispatch.
  - Safari/WebKit browser rows remain a separate proof obligation.

## Scope Limits

- This is selected Bun/JSC bytecode and DFG disassembly evidence for JavaScript benchmark callsites.
- It does not prove generated native code inside Bun Zig `TextDecoder` implementation.
- It is not Safari/WebKit browser evidence; Safari rows remain separate from Bun/JSC rows.
- This is not a 1 GiB trace and not a JavaScript runtime ceiling proof.
