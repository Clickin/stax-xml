# stax-xml Machine-Code Gap Analysis

Status: static evidence checkpoint
Date: 2026-05-23

## Scope

This note compares the current full-materialization reader path against the
Woodstox and quick-xml baselines under one benchmark contract:
full event traversal, full relevant string materialization, event-count parity,
and checksum parity. It deliberately does not compare a checksum-only shortcut
against a fully materialized parser path.

Native addon work is excluded for this analysis. It should not be revived as a
candidate until native code can safely and stably construct JavaScript events
plus UTF-16 or UTF-8 string values for Node. Tokenizer-only native throughput is
not evidence for this goal because the current deficit is measured after public
JavaScript string and event access.

## Reproduction

Projection and external baselines were captured before this note:

```powershell
node --expose-gc packages\benchmark\external-baseline.mjs --json-out packages\benchmark\results\release\external-baseline.json --md-out packages\benchmark\results\release\external-baseline.md
```

Static evidence capture:

```powershell
pnpm --dir packages\benchmark run dev:machine-code-comparison -- --output-dir results\machine-code-comparison\current
```

The generated machine-code logs are raw evidence and are ignored by git:

- `packages/benchmark/results/machine-code-comparison/current/v8/consumeStaxStream.bytecode.log`
- `packages/benchmark/results/machine-code-comparison/current/v8/consumeStaxStream.optcode.log`
- `packages/benchmark/results/machine-code-comparison/current/v8/foldString.bytecode.log`
- `packages/benchmark/results/machine-code-comparison/current/v8/foldString.optcode.log`
- `packages/benchmark/results/machine-code-comparison/current/jsc/consumeStaxStream.jsc.log`
- `packages/benchmark/results/machine-code-comparison/current/jvm/WoodstoxBench.javap.txt`
- `packages/benchmark/results/machine-code-comparison/current/quick-xml/quick_xml_baseline.s`

## Baseline

Current parity benchmark:

| Tool | Throughput | Woodstox ratio | Events | Checksum |
| --- | ---: | ---: | ---: | ---: |
| `stax-stream` | 106.4 MiB/s | 0.32x | 967967 | -746772258 |
| `stax-event` | 93.5 MiB/s | 0.28x | 967967 | -746772258 |
| `woodstox` | 329.3 MiB/s | 1.00x | 967967 | -746772258 |
| `quick-xml` | 302.3 MiB/s | 0.92x | 967967 | -746772258 |

The 0.9x Woodstox target is 296.4 MiB/s on this run. The current
`StreamReaderSync` full-string path is therefore short by roughly 2.8x.

## Static Evidence

### V8

The V8 target is a generated `consumeStaxStream(Uint8Array)` workload that
uses the public batch/index accessors and folds every name, text, and attribute
value into the checksum.

Evidence from the current optimized-code log:

- `nameAt` and `attributeValueAt` are hot and optimized, so the trace is not
  only cold interpreter behavior.
- `consumeStaxStream` still contains calls to accessor functions such as
  `nameAt` and `attributeValueAt`.
- `TypedArrayPrototypeSubArray` appears in the optimized code.
- `CEntry_Return1_ArgvOnStack_NoBuiltinExit` appears repeatedly.
- Deopt metadata includes `wrong call target`, `wrong map`, `out of bounds`,
  and `not a String`. This is metadata in the generated code, not proof of
  runtime deopt frequency.

The generated summary counted:

- V8 bytecode: `Runtime=21`, `GetNamedProperty=19`, `CreateObjectLiteral=1`
- V8 optimized code: `CEntry=22`, `TypedArraySubArray=3`, `Call=207`
- V8 bytecode lengths: `441`, `62`
- V8 optimized instruction sizes: `9624`, `2392`

This supports the local conclusion that the current full-materialization path
still crosses through JavaScript accessor/string/runtime boundaries. It does
not support a generic "V8 is slow" claim, and it does not prove that a native
tokenizer would close the gap once JavaScript events and strings are required.

### JSC / Bun

The same target workload runs under Bun 1.3.13 with WebKit JavaScriptCore dump
flags enabled:

- `JSC_dumpDisassembly=true`
- `JSC_dumpDFGDisassembly=true`
- `JSC_dumpBytecodeAtDFGTime=true`
- `JSC_dumpGraphAfterParsing=true`
- `JSC_reportBaselineCompileTimes=true`
- `JSC_useConcurrentJIT=false`

Current quick capture summary:

- `GeneratedJitCode=187`
- `ConsumeLinks=18`
- `ConsumeBaseline=0`
- `FoldStringBaseline=1`
- `Baseline=125`
- `DFG=0`
- `B3=0`
- `SlowPath=18`
- `TextDecoder=21`
- `TypedArray=8`
- `Call=2340`

The important part is not the global call count. The target
`consumeStaxStream` appears as an `LLIntFunctionCall` with bytecode size `677`
and links to `typeAt`, `nameAt`, `textAt`, `attributeNameAt`,
`attributeValueAt`, `foldString`, and `next`. In this quick capture it did not
emit a `Generated Baseline JIT code for consumeStaxStream` section, while
`foldString` did baseline compile.

That makes JSC a separate constraint, not an automatic escape hatch from V8.
For JSC, the likely portable direction is to make hot projected kernels smaller
and more monomorphic. Do not infer JSC DFG/B3 behavior from this run; DFG/B3 did
not appear for the captured full-materialization target.

### JVM / Woodstox

The current JVM evidence is `javap` bytecode, not HotSpot machine code. It is
useful for bounding the benchmark contract only.

The `WoodstoxBench.consume` bytecode calls the same high-level data that the
JavaScript benchmark consumes:

- `XMLStreamReader.getLocalName()`
- `XMLStreamReader.getAttributeCount()`
- `XMLStreamReader.getAttributeLocalName(int)`
- `XMLStreamReader.getAttributeValue(int)`
- `XMLStreamReader.getText()`
- `XMLStreamReader.next()`

The generated summary counted `invoke=128` and `invokeinterface=24`. This
means the Java row is not a checksum-only scanner. It does not prove the
HotSpot final assembly shape. A later JVM pass needs `PrintCompilation`,
`PrintInlining`, and, if available, hsdis/JITWatch-grade assembly evidence
before we claim which parts Woodstox or HotSpot eliminate.

### Rust / quick-xml

The quick-xml comparator was built with `cargo rustc --release -- --emit=asm`.
The current asm contains direct search and UTF-8 evidence:

- `memchr3_raw` loads in the reader path.
- `memchr2_raw` and `memchr_raw` loads also appear.
- `pcmpeqb` plus `pmovmskb` appear in the emitted asm.
- `BytesText::decode` and `core::str::from_utf8` calls appear.

The generated summary counted `memchr=33`, `simdCompare=23`, `call=437`,
`branch=807`, and `utf8=10`.

This supports a narrow conclusion: quick-xml gets a native delimiter-search
shape that JavaScript `Buffer.indexOf()` loops did not reproduce, while still
decoding text for the parity checksum. It does not justify adding a Node
`Buffer` primary lane, because prior neutral-vs-Node iterable measurements did
not show enough benefit and would lower browser compatibility.

## Reverse-Derived Gaps

1. The largest proven gap is not raw XML byte classification alone. Under full
   materialization, stax-xml remains at 0.32x Woodstox while quick-xml reaches
   0.92x Woodstox with the same event/checksum contract.
2. V8 still exposes calls around span access, typed-array slicing, and string
   materialization in the current accessor-heavy path.
3. JSC/Bun also keeps the large full-materialization driver as linked
   JavaScript calls in the current quick capture; the helper `foldString`
   compiles, but `consumeStaxStream` itself does not baseline compile here.
4. quick-xml has static native search evidence (`memchr*`, SIMD compare
   instructions) that JavaScript cannot assume it will get from repeated
   `Buffer.indexOf()` or ad hoc byte loops.
5. Woodstox bytecode confirms a comparable high-level consumption contract, but
   the current evidence is insufficient to attribute its win to any specific
   HotSpot machine-code pattern.

## Candidate Directions

Priority update after the first follow-up experiment: start with monomorphic
batch access when the question is "why is JS event/string materialization
expensive?". Projection-first and plan-compiled matching remain useful product
directions, but they mostly avoid materialization on negative paths. They do
not explain or directly reduce the cost of full public string/event access.

### 1. Monomorphic batch access

Reduce calls through the accessor layer in hot full-materialization paths. This
does not filter events or skip strings. It reads the batch frame directly and
still folds element names, text, attribute names, and attribute values into the
checksum.

Current experiment:

```powershell
pnpm --dir packages\benchmark run bench:monomorphic-batch-access
```

Result on the 16 MiB parity fixture:

| Variant | Throughput | Public ratio | Woodstox ratio | Events | Checksum |
| --- | ---: | ---: | ---: | ---: | ---: |
| `public-accessor` | 104.7 MiB/s | 1.00x | 0.32x | 967967 | -746772258 |
| `raw-frame-direct-decode` | 111.9 MiB/s | 1.07x | 0.34x | 967967 | -746772258 |
| `raw-frame-name-id-cache` | 126.7 MiB/s | 1.21x | 0.38x | 967967 | -746772258 |

Memory endpoint deltas from the same run:

| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |
| --- | ---: | ---: | ---: | ---: |
| `public-accessor` | +1.2 MiB | +7.0 MiB | 6.5 MiB | 130.3 MiB |
| `raw-frame-direct-decode` | +1.8 MiB | -724.0 KiB | 6.7 MiB | 132.1 MiB |
| `raw-frame-name-id-cache` | +781.8 KiB | -517.3 KiB | 5.7 MiB | 131.5 MiB |

Interpretation:

- Accessor indirection and repeated public method calls are material enough to
  measure.
- Numeric name-id reuse helps without using a rejected `Map<string, string>`
  localName cache.
- The observed memory footprint stays in the same band. The name-id cache row
  did not buy throughput by retaining substantially less data; it mostly avoids
  repeated name materialization and accessor work.
- This still does not close the Woodstox gap. The best row remains below the
  296.4 MiB/s 0.9x target.
- The next implementation question is whether the raw frame shape should become
  a narrower, stable internal fast path for full materialization consumers, not
  whether projection can avoid the work.

### 2. Projection-first byte matching

Projection remains useful for product workloads that do not need every event or
string, but it is not the first experiment for the full-materialization
question. It avoids the losing case by deciding whether an event matters before
public event objects and most strings exist. That makes it a throughput feature
for selective extraction, not proof that JavaScript event/string materialization
has become cheap.

### 3. Plan-compiled matchers

Translate Woodstox-style symbol reuse into plan-specific byte matching, not a
general `Map<string, string>` cache. Match target names and requested attribute
names by span length and bytes before decoding. Only decode values selected by
the projection plan.

### 4. JSC-specific fixes need a projection capture first

Do not claim a JSC fix from V8 evidence. The current Bun/JSC capture gives
baseline disassembly and linked-call evidence, but no DFG/B3 evidence for the
large full-materialization target. The next JSC pass should run against the
projection target after its hot loop is smaller.

## Rejected Lines

- Native addon tokenizer or event streaming, until native code can safely and
  stably construct JS events plus UTF-16 or UTF-8 strings for Node.
- Node `Buffer` / `Buffer.toString()` as the primary stream fast lane.
- Repeated `Buffer.indexOf()` as a JavaScript substitute for quick-xml
  `memchr3` machine code.
- Lazy event getters.
- General `Map` localName cache.
- Chunked string scanner or substring return as the large streaming default.
- Scenario-specific checksum-only wins that are not measured under the full
  materialization parity contract.

## Next Static Checks

- Capture V8 evidence for a projection target, not only the public
  full-materialization accessor target.
- Capture V8 and Bun/JSC evidence for `raw-frame-name-id-cache` so the 1.21x
  runtime delta is tied back to generated code, not only wall-clock timing.
- Add JSC/Bun capture for the projection workload and verify whether smaller
  plan-compiled kernels reach Baseline, DFG, or B3 tiers.
- Add HotSpot `PrintCompilation` and `PrintInlining`; use assembly only if
  hsdis or an equivalent setup is actually available.
- Narrow quick-xml asm inspection to the reader and event decode symbols so the
  `memchr*` counts are tied to the same consumption path, not just the final
  binary.
