# Structural Index MVP Evidence - 2026-04-26

## Verification

Correctness parity passed for the structural-index MVP:

- Rust native aggregate tests: 23 passed.
- stax-xml focused/unit run: 58 files and 1015 tests passed.
- stax-xml build: passed.
- native aggregate build: passed.
- native aggregate smoke: passed.
- structural-index converter final benchmark: checksum parity passed for JS, byte-auto, native-buffer-table, native table checksum projection, hardcoded native table rows projection, generic columnar native object rows projection, and schema-aware native projection paths on 16 MiB and 128 MiB fixtures.
- staged platform converter benchmark: checksum parity passed for actual `schema.parse(bytes, { acceleration: { backend: 'native' } })` through a staged platform package.
- event parser regression gate: targeted parser/parity tests passed, and the existing 128 MiB iterable materialization harness completed on all four regression fixtures.

## Event Parser Regression Guard

The converter acceleration work does not replace the public event parser. The core `StaxXmlIterableParser` source was not modified by this MVP; the event-table change is an optional `copyAttrValueByName` hook for table consumers.

Commands:

```sh
pnpm --filter stax-xml exec vitest run --config vitest.unit.config.ts test/parser.test.ts test/parser-sync.test.ts test/parser-async-regression.test.ts test/iterable-parser.test.ts test/iterable-node-parser.test.ts test/release-parity.test.ts test/runtime/wasm-iterable-parser.test.ts test/converter/iterable-event-backend.test.ts test/runtime/structural-index-parser.test.ts
node --expose-gc ./iterable-attr-materialization.mjs --sizes-mib 128 --fixtures attribute-heavy,mixed-utf8,high-cardinality,shuffled-attribute-order --scenarios neutral --tiers count-only,full-string-direct --runs 1 --warmups 0
```

Results:

- Parser/parity tests: 9 files and 109 tests passed.
- `attribute-heavy` 128 MiB: count-only 1026.30 ms / 124.7 MiB/s, full-string-direct 1807.44 ms / 70.8 MiB/s.
- `mixed-utf8` 128 MiB: count-only 1322.95 ms / 96.8 MiB/s, full-string-direct 2558.20 ms / 50.0 MiB/s.
- `high-cardinality` 128 MiB: count-only 1066.30 ms / 120.0 MiB/s, full-string-direct 1886.69 ms / 67.8 MiB/s.
- `shuffled-attribute-order` 128 MiB: count-only 1089.07 ms / 117.5 MiB/s, full-string-direct 1936.22 ms / 66.1 MiB/s.

The full default `bench:iterable-attr-materialization` matrix is much larger than this guard because it includes 3 scenarios, 8 tiers, warmups, and repeated runs for every fixture; it exceeded the 10 minute interactive timeout before producing a final report. The regression guard intentionally uses the same harness with a bounded 128 MiB parser-focused slice so it remains practical to run before converter benchmark claims.

## Final Benchmark

Command:

```sh
pnpm --filter benchmark run bench:structural-index-converter
```

Results:

| Fixture | Size | JS compiled | Byte auto | Native buffer table | Native table checksum projection | Hardcoded table rows | Generic object rows | Native direct projection | Buffer-table speedup | Table-checksum speedup | Hardcoded rows speedup | Generic rows speedup | Direct-projection speedup |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| attribute-heavy | 16 MiB | 289.16 ms | 275.17 ms | 315.14 ms | 159.68 ms | 145.00 ms | 219.81 ms | 116.81 ms | 0.92x | 1.81x | 1.99x | 1.32x | 2.48x |
| mixed-utf8 | 16 MiB | 319.01 ms | 301.79 ms | 368.12 ms | 161.99 ms | 166.09 ms | 248.86 ms | 112.84 ms | 0.87x | 1.97x | 1.92x | 1.28x | 2.83x |
| attribute-heavy | 128 MiB | 2439.23 ms | 2142.87 ms | 2761.03 ms | 1289.31 ms | 1362.48 ms | 1817.41 ms | 959.30 ms | 0.88x | 1.89x | 1.79x | 1.34x | 2.54x |
| mixed-utf8 | 128 MiB | 2525.05 ms | 2374.57 ms | 2789.90 ms | 1246.76 ms | 1506.53 ms | 1941.91 ms | 931.01 ms | 0.91x | 2.03x | 1.68x | 1.30x | 2.71x |

All checksums matched.

## Staged Platform Converter Benchmark

Command:

```sh
pnpm --filter benchmark run bench:structural-index-platform-converter -- --breakdown
```

This benchmark stages the locally built native aggregate addon into the current platform package, runs the public compiled converter API with `backend: 'native'`, and removes the staged binary after the child benchmark process exits. It verifies the release-style platform package entrypoint rather than calling the native aggregate probe directly.

Results:

| Schema | Fixture | Size | JS compiled | Native platform converter | Speedup |
| --- | --- | ---: | ---: | ---: | ---: |
| hardcoded-item | attribute-heavy | 16 MiB | 278.33 ms | 148.60 ms | 1.87x |
| generic-entry | attribute-heavy | 16 MiB | 253.33 ms | 194.35 ms | 1.30x |
| hardcoded-item | mixed-utf8 | 16 MiB | 326.47 ms | 163.23 ms | 2.00x |
| generic-entry | mixed-utf8 | 16 MiB | 298.30 ms | 216.91 ms | 1.38x |
| hardcoded-item | attribute-heavy | 128 MiB | 2058.73 ms | 1369.19 ms | 1.50x |
| generic-entry | attribute-heavy | 128 MiB | 1973.75 ms | 1656.66 ms | 1.19x |
| hardcoded-item | mixed-utf8 | 128 MiB | 2475.93 ms | 1528.01 ms | 1.62x |
| generic-entry | mixed-utf8 | 128 MiB | 2275.00 ms | 1756.38 ms | 1.30x |

All staged platform converter checksums matched.

## Generic Projection Breakdown

The staged platform converter harness now includes a benchmark-only breakdown for the generic `entry` descriptor. It separates direct native projection, legacy via-table projection, one/two/three-field projection cost, and JavaScript object hydration.

| Fixture | Size | Direct native projection, 3 fields | Via-table projection, 3 fields | Code only | Code + label | Score only | Dynamic hydration | Stable-shape hydration | Hydration speedup |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| attribute-heavy | 16 MiB | 185.18 ms | 217.40 ms | 90.09 ms | 144.33 ms | 85.60 ms | 10.54 ms | 4.59 ms | 2.30x |
| mixed-utf8 | 16 MiB | 191.65 ms | 232.82 ms | 90.57 ms | 151.53 ms | 91.48 ms | 11.49 ms | 4.81 ms | 2.39x |
| attribute-heavy | 128 MiB | 1571.13 ms | 1830.91 ms | 715.83 ms | 1248.48 ms | 687.91 ms | 132.54 ms | 76.76 ms | 1.73x |
| mixed-utf8 | 128 MiB | 1619.26 ms | 1881.88 ms | 721.31 ms | 1280.33 ms | 722.39 ms | 133.70 ms | 76.42 ms | 1.75x |

Direct generic projection removes the table-build-then-replay cost from the descriptor path. At 128 MiB it cuts the three-field native projection slice by about 260 ms to 263 ms versus the via-table path. Typed native number columns also avoid string transfer for numeric fields while preserving TypeScript-side number validation.

The remaining gap is now dominated by string column materialization/transfer and JavaScript row hydration. Stable-shape hydration remains faster in isolation, but it would only save about 56 ms to 57 ms at 128 MiB after the direct projection fix, while direct native projection still takes 1571 ms to 1619 ms for the three-field schema.

## Gate Status

The generic native-buffer-table path still does not satisfy the 1.5x performance gate when the table is consumed through the JavaScript `IterableEventTable` wrapper. At 128 MiB it is 0.85x to 0.92x of JS compiled converter throughput, despite checksum parity.

The representative table projection path does satisfy the gate. It builds the same structural table in the native addon and then projects from that table without JS per-event dispatch; at 128 MiB it reaches 1.89x to 2.03x for checksum-only projection and 1.68x to 1.79x when returning actual converter rows for the hardcoded `id/name/value` schema. That means table tuning is still relevant, but the table must feed a native projection boundary rather than round-tripping every event through JS.

The generic object rows projection now accepts a compiled-plan descriptor for root array/object shapes with relative attribute and single child element scalar fields. Returning columnar field arrays instead of per-row value arrays improved the generic path from the initial row-array shape, and the direct parser removed the table replay pass, but it still reaches only 1.19x to 1.30x at 128 MiB and does not meet the 1.5x gate. The remaining cost is dominated by generic string materialization, N-API transfer of per-field string columns, and TS object reconstruction/number validation.

The staged platform converter benchmark confirms that this cost is user-visible: after TypeScript object hydration and scalar validation, the generic descriptor path improved from the prior 1.01x to 1.11x range to 1.19x to 1.30x at 128 MiB. The hardcoded representative path stays at or above the gate through the public converter API at 1.50x to 1.62x.

The direct generic parser fixes the table replay bottleneck, but it does not yet satisfy the 1.5x generic gate. The next tuning candidates should reduce the remaining string column materialization and row hydration costs without reintroducing per-event JS/native boundaries.

The direct schema-aware native projection PoC remains the upper-bound comparison for this schema. At 128 MiB it reaches 2.21x to 2.70x of JS compiled converter throughput while preserving checksum parity.

## Notes

The native-buffer-table row includes native table construction and compiled converter consumption through `StaxXmlStructuralIndexParser`. It is intentionally stricter than raw span-table construction alone because the user-facing win must survive converter consumption.

The generic table builder now writes event records directly into the final byte table and only appends the side attribute buffer at finish. `napi::Buffer::from(Vec<u8>)` transfers the final table Vec into a JavaScript Buffer without an additional Rust-to-JS byte copy, but the current ABI still requires attribute bytes to be gathered separately until the final event count is known.

The native table rows path is now wired into `CompiledRootProcessor` for the representative compiled schema `//item` with `./@id`, `./name`, and `./value` on byte input when a native backend exports `parseItemRowsViaTableUint8Array`. This hardcoded path is tried before the generic descriptor because it is still faster for the representative benchmark.

The generic descriptor path is also wired into `CompiledRootProcessor` for byte-input root arrays of inline objects when every field is a scalar selected by a relative attribute or one relative child element. It prefers the direct native parser, retains the via-table parser as fallback/comparator, and preserves schema-side number validation by returning typed numeric columns to TypeScript for compiled scalar validation. Unsupported plans and unavailable backend capabilities fall back to the existing structural table or JS paths. This is a bounded lowering step, not full XPath execution in native code.

The native binary smoke workflow now stages each runnable platform package and executes `packages/native-aggregate/scripts/smoke-platform-package.mjs`, which verifies `parseStructuralIndexUint8Array`, `parseItemRowsViaTableUint8Array`, `parseObjectRowsUint8Array`, and `parseObjectRowsViaTableUint8Array` through the platform package entrypoint.
