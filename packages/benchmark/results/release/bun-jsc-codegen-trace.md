# Bun/JSC Codegen Trace

Generated: 2026-05-24T11:31:39.006Z

This report is a TRACE_FACT for one Bun/JavaScriptCore build and selected same-contract stax-xml reader functions.
It uses JavaScriptCore bytecode and DFG JIT dump options. It is not Safari/browser evidence and not a runtime ceiling proof.

## Environment

- Runtime: bun 1.3.13
- Bun revision: 1.3.13+bf2e2cecf
- JavaScript engine: JavaScriptCore
- WebKit commit: 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
- Host Node: v24.15.0
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture size: 1.02 MiB (0.0010000672191381454 GiB actual)
- JSC trace env: JSC_dumpBytecodeAtDFGTime=true, JSC_dumpDFGDisassembly=true
- Raw artifacts committed: no

## Variant Parity

| Case | MiB/s | Events | Checksum | Bounded memory |
| --- | ---: | ---: | ---: | --- |
| stringFull | 5.91 | 47753 | -1316984100 | yes |
| rawFrameNameId | 6.77 | 47753 | -1316984100 | yes |
| eventObjectFull | 9.68 | 47753 | -1316984100 | yes |

## Trace Summary

- Trace bytes: 725680
- Trace lines: 9478
- Parsing lines: 24
- Generated JIT lines: 18
- Generated DFG JIT lines: 15
- Bytecode lines: 515
- DFG node lines: 1432
- Target function mentions: 44

| Function | Mentions |
| --- | ---: |
| consumeStreamSelective | 0 |
| consumeEventObjectFull | 0 |
| consumeRawFrameStyle | 0 |
| consumeRawFrame | 0 |
| materializePublicEventObject | 0 |
| materializeName | 4 |
| decodeSpan | 6 |
| decodeShortAsciiSpan | 0 |
| copyName | 10 |
| nameAt | 7 |
| currentGeneration | 17 |

## Findings

- bun-jsc-bytecode-dfg-trace-visible (TRACE_FACT): Bun/JSC emitted JavaScriptCore bytecode and DFG JIT disassembly for the selected stax-xml benchmark run.
  - generatedDfgLineCount=15
  - bytecodeLineCount=515
  - dfgNodeLineCount=1432
  - totalTargetMentions=44
- bun-jsc-trace-same-contract (TRACE_FACT): The traced full-string Bun/JSC rows preserved event count and checksum parity.
  - stringFull: events=47753, checksum=-1316984100, mibPerSec=5.91
  - rawFrameNameId: events=47753, checksum=-1316984100, mibPerSec=6.77
  - eventObjectFull: events=47753, checksum=-1316984100, mibPerSec=9.68
- not-safari-or-runtime-ceiling-proof (SCOPE_GUARD): This is Bun/JSC runtime codegen evidence, not Safari/WebKit browser evidence and not a 200 MiB/s runtime ceiling proof.
  - Bun uses a patched JavaScriptCore build exposed by process.versions.webkit.
  - Safari/WebKit browser rows remain a separate proof obligation.

## Scope Limits

- This is selected Bun/JSC bytecode and DFG disassembly evidence, not an exhaustive optimized-code proof.
- This is not Safari/WebKit browser evidence; Safari rows remain separate from Bun/JSC rows.
- This is not a 1 GiB trace and not a JavaScript runtime ceiling proof.
