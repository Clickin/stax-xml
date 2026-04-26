# Structural Index MVP Evidence - 2026-04-26

## Verification

Correctness parity passed for the structural-index MVP:

- Rust native aggregate tests: 20 passed.
- stax-xml focused/unit run: 57 files and 1011 tests passed.
- stax-xml build: passed.
- native aggregate build: passed.
- native aggregate smoke: passed.
- structural-index converter final benchmark: checksum parity passed for JS, byte-auto, native-buffer-table, native table projection, and schema-aware native projection paths on 16 MiB and 128 MiB fixtures.
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

| Fixture | Size | JS compiled | Byte auto | Native buffer table | Native table projection | Native direct projection | Buffer-table speedup | Table-projection speedup | Direct-projection speedup |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| attribute-heavy | 16 MiB | 274.78 ms | 253.68 ms | 323.04 ms | 159.69 ms | 118.68 ms | 0.85x | 1.72x | 2.32x |
| mixed-utf8 | 16 MiB | 324.34 ms | 311.87 ms | 347.96 ms | 150.74 ms | 113.19 ms | 0.93x | 2.15x | 2.87x |
| attribute-heavy | 128 MiB | 2125.66 ms | 1996.26 ms | 2568.23 ms | 1269.56 ms | 973.39 ms | 0.83x | 1.67x | 2.18x |
| mixed-utf8 | 128 MiB | 2511.93 ms | 2362.84 ms | 2790.70 ms | 1224.14 ms | 987.58 ms | 0.90x | 2.05x | 2.54x |

All checksums matched.

## Gate Status

The generic native-buffer-table path still does not satisfy the 1.5x performance gate when the table is consumed through the JavaScript `IterableEventTable` wrapper. At 128 MiB it is 0.83x to 0.90x of JS compiled converter throughput, despite checksum parity.

The generic table projection path does satisfy the gate. It builds the same structural table in the native addon and then projects from that table without JS per-event dispatch; at 128 MiB it reaches 1.67x to 2.05x of JS compiled converter throughput while preserving checksum parity. That means generic table tuning is still relevant, but the table must feed a native projection boundary rather than round-tripping every event through JS.

The direct schema-aware native projection PoC remains the upper-bound comparison for this schema. At 128 MiB it reaches 2.18x to 2.54x of JS compiled converter throughput while preserving checksum parity.

## Notes

The native-buffer-table row includes native table construction and compiled converter consumption through `StaxXmlStructuralIndexParser`. It is intentionally stricter than raw span-table construction alone because the user-facing win must survive converter consumption.

The generic table builder now writes event records directly into the final byte table and only appends the side attribute buffer at finish. `napi::Buffer::from(Vec<u8>)` transfers the final table Vec into a JavaScript Buffer without an additional Rust-to-JS byte copy, but the current ABI still requires attribute bytes to be gathered separately until the final event count is known.

The native projection rows are benchmark-only and hard-coded to the representative compiled schema `//item` with `./@id`, `./name`, and `./value`. They return item count and checksum rather than public converter objects. They prove the boundary, not the final API.
