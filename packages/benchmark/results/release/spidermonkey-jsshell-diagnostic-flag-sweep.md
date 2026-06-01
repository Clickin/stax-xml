# SpiderMonkey JS Shell Diagnostic Flag Sweep

Generated: 2026-06-01T03:29:10.900Z

Sweeps public SpiderMonkey js-shell diagnostic flags that are easy to mistake for emitted IR/codegen evidence. This is not benchmark evidence and does not close the SpiderMonkey emitted-code obligation.

## Summary

- Status: available
- Version: JavaScript-C153.0a1
- Help advertises --dump-bytecode: true
- Help advertises JitSpew/IR flags: false
- Bytecode probes: 4
- Bytecode-output probes: 0
- IR/codegen-output probes: 0
- Diagnostic pref surface: false
- Closes emitted IR obligation: false

## Probes

| Probe | Exit | Checksum | Output bytes | Bytecode markers | IR/codegen markers | Bytecode dump | IR/codegen dump |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| dump-bytecode-inline | 0 | 210 | 15 | 0 | 0 | no | no |
| dump-bytecode-file | 0 | 210 | 15 | 0 | 0 | no | no |
| short-D-file | 0 | 210 | 15 | 0 | 0 | no | no |
| dump-bytecode-compileonly-file | 0 | n/a | 1 | 0 | 0 | no | no |

## Pref Probe

- Matching pref count: 7
- Has JitSpew pref: false
- Has dump pref: false
- Matching prefs: experimental.joint_iteration=true, experimental.wasm_esm_integration=false, ion.regalloc=0, warn_asmjs_deprecation=true, wasm_exception_force_stack_trace=false, wasm_js_promise_integration=true, wasm_test_serialization=false

## Findings

- public-jsshell-dump-bytecode-no-output (NEGATIVE_RESULT): The public SpiderMonkey js-shell advertises --dump-bytecode, but the swept inline/file/-D/compileonly probes emitted no bytecode dump markers.
  - version=JavaScript-C153.0a1
  - helpAdvertisesDumpBytecode=true
  - bytecodeProbeCount=4
  - bytecodeOutputProbeCount=0
- public-jsshell-no-diagnostic-pref-surface (NEGATIVE_RESULT): The public SpiderMonkey js-shell --list-prefs surface does not expose JitSpew, dump, bytecode, or disassembler prefs.
  - matchingPrefCount=7
  - matchingPrefs=experimental.joint_iteration=true, experimental.wasm_esm_integration=false, ion.regalloc=0, warn_asmjs_deprecation=true, wasm_exception_force_stack_trace=false, wasm_js_promise_integration=true, wasm_test_serialization=false
- public-jsshell-diagnostic-sweep-scope (SCOPE_GUARD): This sweep only rules out easy public-shell diagnostic flag paths; it is not current Firefox emitted IR/codegen evidence.
  - A diagnostic-capable SpiderMonkey build is still required for emitted MIR/LIR/codegen proof.
  - Bytecode dump output, even if later found, would still not be optimized native code evidence.

