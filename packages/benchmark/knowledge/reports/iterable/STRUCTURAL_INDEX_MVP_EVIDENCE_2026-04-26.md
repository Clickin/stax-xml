# Structural Index MVP Evidence - 2026-04-26

## Verification

Correctness parity passed for the structural-index MVP:

- Rust native aggregate tests: 22 passed.
- stax-xml focused/unit run: 57 files and 1011 tests passed.
- stax-xml build: passed.
- native aggregate build: passed.
- native aggregate smoke: passed.
- structural-index converter final benchmark: checksum parity passed for JS, byte-auto, native-buffer-table, native table checksum projection, native table rows projection, and schema-aware native projection paths on 16 MiB and 128 MiB fixtures.
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
- `attribute-heavy` 128 MiB: count-only 989.47 ms / 129.4 MiB/s, full-string-direct 1802.81 ms / 71.0 MiB/s.
- `mixed-utf8` 128 MiB: count-only 1244.48 ms / 102.9 MiB/s, full-string-direct 2310.96 ms / 55.4 MiB/s.
- `high-cardinality` 128 MiB: count-only 1029.07 ms / 124.4 MiB/s, full-string-direct 1734.75 ms / 73.8 MiB/s.
- `shuffled-attribute-order` 128 MiB: count-only 996.87 ms / 128.4 MiB/s, full-string-direct 1818.59 ms / 70.4 MiB/s.

The full default `bench:iterable-attr-materialization` matrix is much larger than this guard because it includes 3 scenarios, 8 tiers, warmups, and repeated runs for every fixture; it exceeded the 10 minute interactive timeout before producing a final report. The regression guard intentionally uses the same harness with a bounded 128 MiB parser-focused slice so it remains practical to run before converter benchmark claims.

## Final Benchmark

Command:

```sh
pnpm --filter benchmark run bench:structural-index-converter
```

Results:

| Fixture | Size | JS compiled | Byte auto | Native buffer table | Native table checksum projection | Native table rows projection | Native direct projection | Buffer-table speedup | Table-checksum speedup | Table-rows speedup | Direct-projection speedup |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| attribute-heavy | 16 MiB | 272.07 ms | 258.10 ms | 331.38 ms | 150.87 ms | 137.58 ms | 117.20 ms | 0.82x | 1.80x | 1.98x | 2.32x |
| mixed-utf8 | 16 MiB | 328.96 ms | 298.31 ms | 343.83 ms | 150.76 ms | 167.88 ms | 113.59 ms | 0.96x | 2.18x | 1.96x | 2.90x |
| attribute-heavy | 128 MiB | 2141.79 ms | 1999.88 ms | 2505.23 ms | 1241.88 ms | 1234.69 ms | 968.84 ms | 0.85x | 1.72x | 1.73x | 2.21x |
| mixed-utf8 | 128 MiB | 2512.52 ms | 2319.35 ms | 2727.33 ms | 1183.48 ms | 1400.92 ms | 930.11 ms | 0.92x | 2.12x | 1.79x | 2.70x |

All checksums matched.

## Gate Status

The generic native-buffer-table path still does not satisfy the 1.5x performance gate when the table is consumed through the JavaScript `IterableEventTable` wrapper. At 128 MiB it is 0.85x to 0.92x of JS compiled converter throughput, despite checksum parity.

The generic table projection path does satisfy the gate. It builds the same structural table in the native addon and then projects from that table without JS per-event dispatch; at 128 MiB it reaches 1.72x to 2.12x for checksum-only projection and 1.73x to 1.79x when returning actual converter rows. That means generic table tuning is still relevant, but the table must feed a native projection boundary rather than round-tripping every event through JS.

The direct schema-aware native projection PoC remains the upper-bound comparison for this schema. At 128 MiB it reaches 2.21x to 2.70x of JS compiled converter throughput while preserving checksum parity.

## Notes

The native-buffer-table row includes native table construction and compiled converter consumption through `StaxXmlStructuralIndexParser`. It is intentionally stricter than raw span-table construction alone because the user-facing win must survive converter consumption.

The generic table builder now writes event records directly into the final byte table and only appends the side attribute buffer at finish. `napi::Buffer::from(Vec<u8>)` transfers the final table Vec into a JavaScript Buffer without an additional Rust-to-JS byte copy, but the current ABI still requires attribute bytes to be gathered separately until the final event count is known.

The native table rows path is now wired into `CompiledRootProcessor` for the representative compiled schema `//item` with `./@id`, `./name`, and `./value` on byte input when a native backend exports `parseItemRowsViaTableUint8Array`. Unsupported plans and unavailable backend capabilities fall back to the existing structural table or JS paths.

The native projection paths are still schema-specific. They prove the lowering boundary for one compiled plan shape; they are not yet a general compiled-plan-to-native projection engine.
