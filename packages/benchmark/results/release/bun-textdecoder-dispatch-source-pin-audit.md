# Bun TextDecoder Dispatch Source Pin Audit

Generated: 2026-05-24T00:32:09.312Z

## Scope

This audit pins Bun source lines for `TextDecoder` dispatch in the exact Bun 1.3.13 source revision used by the local benchmark runtime. It is source evidence for Bun dispatch only. It is not a benchmark, not JIT/codegen evidence, not Safari/browser coverage, not SpiderMonkey coverage, and not a runtime-ceiling proof.

## Runtime And Source

- Bun: 1.3.13+bf2e2cecf
- Bun source tag: bun-v1.3.13
- Bun source commit: bf2e2cecf27e800962b1e7f03d66278f9d5d2e79
- Recorded WebKit commit: 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
- Repository: oven-sh/bun
- Files: `src/bun.js/webcore/TextDecoder.zig`, `src/bun.js/webcore/encoding.classes.ts`, `src/bun.js/bindings/TextEncodingRegistry.cpp`, `src/bun.js/bindings/TextEncoding.cpp`

## Anchors

| ID | File | Line | Source | Meaning |
| --- | --- | ---: | --- | --- |
| `classDefinition` | `src/bun.js/webcore/encoding.classes.ts` | 5 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/encoding.classes.ts#L5 | TextDecoder class definition |
| `protoDecodeBinding` | `src/bun.js/webcore/encoding.classes.ts` | 24 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/encoding.classes.ts#L24 | decode binds to Zig decode |
| `domjitReturnsString` | `src/bun.js/webcore/encoding.classes.ts` | 28 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/encoding.classes.ts#L28 | DOMJIT returns JSString |
| `domjitUint8ArrayArg` | `src/bun.js/webcore/encoding.classes.ts` | 29 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/encoding.classes.ts#L29 | DOMJIT JSUint8Array arg |
| `zigCodegenClass` | `src/bun.js/webcore/TextDecoder.zig` | 21 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/TextDecoder.zig#L21 | JSTextDecoder codegen class |
| `defaultEncodingUtf8` | `src/bun.js/webcore/TextDecoder.zig` | 19 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/TextDecoder.zig#L19 | default UTF-8 encoding |
| `decodeMethod` | `src/bun.js/webcore/TextDecoder.zig` | 158 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/TextDecoder.zig#L158 | TextDecoder.decode method |
| `decodeWithoutTypeChecks` | `src/bun.js/webcore/TextDecoder.zig` | 188 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/TextDecoder.zig#L188 | decodeWithoutTypeChecks fast path |
| `decodeSlice` | `src/bun.js/webcore/TextDecoder.zig` | 192 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/TextDecoder.zig#L192 | decodeSlice implementation |
| `encodingSwitch` | `src/bun.js/webcore/TextDecoder.zig` | 195 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/TextDecoder.zig#L195 | encoding switch |
| `latin1Branch` | `src/bun.js/webcore/TextDecoder.zig` | 196 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/TextDecoder.zig#L196 | latin1 native branch |
| `latin1AsciiToJs` | `src/bun.js/webcore/TextDecoder.zig` | 198 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/TextDecoder.zig#L198 | latin1 ASCII to JS |
| `latin1ExternalU16` | `src/bun.js/webcore/TextDecoder.zig` | 209 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/TextDecoder.zig#L209 | latin1 external UTF-16 string |
| `utf8Branch` | `src/bun.js/webcore/TextDecoder.zig` | 211 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/TextDecoder.zig#L211 | UTF-8 native branch |
| `utf8DecodeAlloc` | `src/bun.js/webcore/TextDecoder.zig` | 230 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/TextDecoder.zig#L230 | UTF-8 toUTF16AllocMaybeBuffered |
| `utf8ExternalU16` | `src/bun.js/webcore/TextDecoder.zig` | 253 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/TextDecoder.zig#L253 | UTF-8 external UTF-16 string |
| `utf8AsciiToJs` | `src/bun.js/webcore/TextDecoder.zig` | 259 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/TextDecoder.zig#L259 | UTF-8 ASCII to JS |
| `utf16Branch` | `src/bun.js/webcore/TextDecoder.zig` | 262 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/TextDecoder.zig#L262 | UTF-16 native branch |
| `otherEncodingsWebKitComment` | `src/bun.js/webcore/TextDecoder.zig` | 280 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/TextDecoder.zig#L280 | other encodings use WebKit TextCodec |
| `otherEncodingsCreateCodec` | `src/bun.js/webcore/TextDecoder.zig` | 286 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/TextDecoder.zig#L286 | TextCodec.create for other encodings |
| `otherEncodingsDecode` | `src/bun.js/webcore/TextDecoder.zig` | 298 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/webcore/TextDecoder.zig#L298 | TextCodec.decode for other encodings |
| `registryNativeFastPathComment` | `src/bun.js/bindings/TextEncodingRegistry.cpp` | 207 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/bindings/TextEncodingRegistry.cpp#L207 | native UTF encodings not registered in codec map |
| `registryUtfFallbackNull` | `src/bun.js/bindings/TextEncodingRegistry.cpp` | 296 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/bindings/TextEncodingRegistry.cpp#L296 | UTF-8 handled natively returns null codec |
| `textEncodingDecode` | `src/bun.js/bindings/TextEncoding.cpp` | 65 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/bindings/TextEncoding.cpp#L65 | TextEncoding::decode uses newTextCodec |
| `textEncodingDecodeNewCodec` | `src/bun.js/bindings/TextEncoding.cpp` | 70 | https://github.com/oven-sh/bun/blob/bf2e2cecf27e800962b1e7f03d66278f9d5d2e79/src/bun.js/bindings/TextEncoding.cpp#L70 | TextEncoding::decode newTextCodec call |

## Findings

### bun-textdecoder-js-class-dispatches-to-zig

Classification: SOURCE_FACT

Bun defines the TextDecoder class through generated bindings whose decode prototype method maps to the Zig TextDecoder.decode implementation.

- TextDecoder class definition line 5
- prototype decode binding line 24
- DOMJIT JSString return line 28
- JSTextDecoder codegen class line 21

### bun-textdecoder-utf8-native-path

Classification: SOURCE_FACT

For the default UTF-8 TextDecoder used by the benchmark rows, Bun source routes through a Zig UTF-8 branch that decodes with bun.strings and returns ZigString JS values.

- default UTF-8 encoding line 19
- TextDecoder.decode line 158
- decodeSlice line 192
- UTF-8 branch line 211
- toUTF16AllocMaybeBuffered line 230
- ZigString.toExternalU16 line 253
- ZigString.init(input).toJS line 259

### bun-textdecoder-webkit-only-other-encodings

Classification: COUNTEREXAMPLE

The pinned Bun source explicitly places WebKit TextCodec behind the all-other-encodings branch, so the default UTF-8 TextDecoder benchmark rows should not be described as dispatching through WebKit TextDecoder.cpp.

- other-encodings WebKit comment line 280
- TextCodec.create line 286
- TextCodec.decode line 298
- native UTF encodings not registered line 207
- UTF-8 handled natively null codec line 296

### bun-textdecoder-dispatch-scope-guard

Classification: SCOPE_GUARD

This audit is source dispatch evidence for Bun 1.3.13. It is not machine-code evidence, not a benchmark row, and not proof that JavaScript runtimes have no remaining performance headroom.

- The audit does not inspect generated machine code.
- The audit does not measure throughput or memory.
- Any 200 MiB/s+ bounded-memory full-string row would still be a counterexample to the broad runtime-limit hypothesis.

## Interpretation

For Bun 1.3.13, `TextDecoder` is defined by Bun generated bindings and implemented by `src/bun.js/webcore/TextDecoder.zig`. The default `UTF-8` branch used by `new TextDecoder()` decodes in Bun Zig through `bun.strings` helpers and returns `ZigString` values to JavaScript. Latin1 and UTF-16 also have native branches.

The WebKit `TextCodec` path is still present, but the pinned Bun source places it under the "all other encodings" branch. Therefore the Bun/JSC default UTF-8 TextDecoder benchmark rows should not be cited as dispatching through WebKit `WebCore/dom/TextDecoder.cpp`; the earlier WebKit source pin is useful only for the WebKit implementation boundary and for encodings that actually reach `TextCodec`.

This source dispatch fact does not prove that Bun has no remaining headroom. It narrows the interpretation of the existing Bun TextDecoder rows and leaves codegen, allocation, and counterexample searches open.
