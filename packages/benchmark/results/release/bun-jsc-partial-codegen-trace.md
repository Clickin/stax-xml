# Bun/JSC Codegen Trace

Generated: 2026-05-25T11:52:04.269Z

This report is a TRACE_FACT for one Bun/JavaScriptCore build and selected stax-xml reader functions.
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

- Full-string parity status: not-applicable
- Full-string rows: 0

| Case | MiB/s | Events | Checksum | Full string parity | Bounded memory |
| --- | ---: | ---: | ---: | --- | --- |
| scanAllNoDecode | 25.82 | 47753 | -530226764 | no | yes |
| nameStringOnly | 7.48 | 47753 | 69593332 | no | yes |
| textStringOnly | 28.32 | 47753 | -1491329952 | no | yes |
| attrNameStringOnly | 23.05 | 47753 | -1372808567 | no | yes |
| attrValueStringOnly | 15.59 | 47753 | -1595127389 | no | yes |

## Trace Summary

- Trace bytes: 614101
- Trace lines: 7740
- Parsing lines: 18
- Generated JIT lines: 12
- Generated DFG JIT lines: 11
- Bytecode lines: 386
- DFG node lines: 1214
- Target function mentions: 17

| Function | Mentions |
| --- | ---: |
| consumeStreamSelective | 0 |
| consumeEventObjectFull | 0 |
| consumeRawFrameStyle | 0 |
| consumeRawFrame | 0 |
| materializePublicEventObject | 0 |
| materializeName | 4 |
| decodeSpan | 4 |
| decodeShortAsciiSpan | 0 |
| copyName | 4 |
| nameAt | 2 |
| currentGeneration | 3 |

## Findings

- bun-jsc-bytecode-dfg-trace-visible (TRACE_FACT): Bun/JSC emitted JavaScriptCore bytecode and DFG JIT disassembly for the selected stax-xml benchmark run.
  - generatedDfgLineCount=11
  - bytecodeLineCount=386
  - dfgNodeLineCount=1214
  - totalTargetMentions=17
- bun-jsc-trace-partial-contract (SCOPE_GUARD): The traced Bun/JSC rows are partial/headroom rows only and do not preserve the full-string StAX contract.
  - scanAllNoDecode: fullStringParity=false, contractScope=event-types-and-attribute-counts-only, checksum=-530226764, mibPerSec=25.82
  - nameStringOnly: fullStringParity=false, contractScope=event-types-attribute-counts-and-element-names, checksum=69593332, mibPerSec=7.48
  - textStringOnly: fullStringParity=false, contractScope=event-types-attribute-counts-and-text-cdata, checksum=-1491329952, mibPerSec=28.32
  - attrNameStringOnly: fullStringParity=false, contractScope=event-types-attribute-counts-and-attribute-names, checksum=-1372808567, mibPerSec=23.05
  - attrValueStringOnly: fullStringParity=false, contractScope=event-types-attribute-counts-and-attribute-values, checksum=-1595127389, mibPerSec=15.59
- not-safari-or-runtime-ceiling-proof (SCOPE_GUARD): This is Bun/JSC runtime codegen evidence, not Safari/WebKit browser evidence and not a 200 MiB/s runtime ceiling proof.
  - Bun uses a patched JavaScriptCore build exposed by process.versions.webkit.
  - Safari/WebKit browser rows remain a separate proof obligation.

## Scope Limits

- This is selected Bun/JSC bytecode and DFG disassembly evidence, not an exhaustive optimized-code proof.
- This is not Safari/WebKit browser evidence; Safari rows remain separate from Bun/JSC rows.
- This is not a 1 GiB trace and not a JavaScript runtime ceiling proof.
