# Large XML Stream Reader Cross-Runtime Benchmark

**Generated:** 2026-07-25T01:46:06.253Z  
**Environment:** Node v26.5.0, macOS (darwin), arm64 (Apple M4)

## Workload

The XML fixtures model a database table: a `<database>` root containing millions of `<row>` elements, each with 17 typed child columns (`id`, `account_id`, `email`, `first_name`, `last_name`, `phone`, `address`, `city`, `state`, `zipcode`, `country`, `created_at`, `updated_at`, `balance`, `is_active`, `tier`, `notes`).

Every benchmark streams the file row-by-row:

1. Parse one `<row>` and its column children.
2. Materialize a temporary row object (simulating preparation of a DB `INSERT` statement).
3. Compute a row checksum and discard the object before moving to the next row.
4. Never materialize the entire document as a JS/Rust/Java object array.

Three implementations are compared on the same fixture:

- **stax-xml** — pure JavaScript `StreamReaderSync` (this package)
- **Woodstox** — Java StAX parser (`com.ctc.wstx.stax.WstxInputFactory`)
- **quick-xml** — Rust pull parser (`quick-xml 0.40.1`)

## Fixtures

| Size | Rows | File | SHA-256 |
| --- | --- | --- | --- |
| 10 GiB | 10,990,193 | `packages/benchmark/assets/large/database-10gib.xml` | — |
| 20 GiB | 21,980,386 | `packages/benchmark/assets/large/database-20gib.xml` | — |
| 30 GiB | 33,038,210 | `packages/benchmark/assets/large/database-30gib.xml` | — |

## Results Summary

| Fixture | Reader | Wall Time | Throughput | Peak RSS | Peak Heap | Rows | Checksum |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 10 GiB | stax-xml (Node.js) | 92.93 s | 110.61 MiB/s | 552.66 MiB | 44.23 MiB | 10,990,193 | -1981085726 |
| 10 GiB | Woodstox (Java) | 34.13 s | 301.16 MiB/s | 212.52 MiB | 150.52 MiB | 10,990,193 | -1981085726 |
| 10 GiB | quick-xml (Rust) | 15.73 s | 653.22 MiB/s | 2.53 MiB | n/a | 10,990,193 | -1981085726 |
| 20 GiB | stax-xml (Node.js) | 187.56 s | 109.75 MiB/s | 555.63 MiB | 56.46 MiB | 21,980,386 | -1677173944 |
| 20 GiB | Woodstox (Java) | 69.03 s | 298.23 MiB/s | 213.05 MiB | 150.53 MiB | 21,980,386 | -1677173944 |
| 20 GiB | quick-xml (Rust) | 31.33 s | 657.04 MiB/s | 2.53 MiB | n/a | 21,980,386 | -1677173944 |
| 30 GiB | stax-xml (Node.js) | 281.18 s | 110.09 MiB/s | 558.36 MiB | 75.93 MiB | 33,038,210 | -1176897731 |
| 30 GiB | Woodstox (Java) | 103.26 s | 299.78 MiB/s | 209.63 MiB | 150.53 MiB | 33,038,210 | -1176897731 |
| 30 GiB | quick-xml (Rust) | 47.02 s | 658.34 MiB/s | 2.53 MiB | n/a | 33,038,210 | -1176897731 |

## Observations

- **Throughput scales linearly with file size** for all three implementations; there is no notable slowdown as the file grows from 10 GiB to 30 GiB.
- **stax-xml** holds a steady ~110 MiB/s with a flat RSS around 550 MiB and a small, slowly growing JS heap (~45–76 MiB). The RSS is higher than the native parsers because the Node/V8 process itself carries baseline overhead and the synchronous reader keeps decoded chunks in flight.
- **Woodstox** is ~2.7× faster than stax-xml at ~300 MiB/s, with a flat ~210 MiB RSS and ~150 MiB Java heap. The Java heap plateau confirms streaming behavior.
- **quick-xml** is the fastest at ~655 MiB/s — about **6× stax-xml** and **2.2× Woodstox** — while using only ~2.5 MiB of RSS. This demonstrates that the Rust implementation keeps almost nothing resident while streaming.
- **Checksum parity** is identical across all three runtimes for each fixture, confirming that the row-by-row parsing semantics match despite the different languages and APIs.

## How to Reproduce

Generate fixtures (or reuse existing ones):

```bash
pnpm --filter benchmark generate:large:fixtures
```

Run the full cross-runtime benchmark:

```bash
pnpm --filter benchmark bench:large:cross-runtime
```

Run individual components:

```bash
# stax-xml
node --expose-gc packages/benchmark/stream-reader-large.mjs \
  --file=packages/benchmark/assets/large/database-10gib.xml \
  --runs=1 --warmups=0

# Woodstox
javac -cp "$HOME/.m2/repository/com/fasterxml/woodstox/woodstox-core/6.7.0/woodstox-core-6.7.0.jar:$HOME/.m2/repository/org/codehaus/woodstox/stax2-api/4.2.2/stax2-api-4.2.2.jar" \
  -d /tmp/stax-xml-woodstox-large \
  packages/benchmark/cross-runtime/reader-woodstox/XmlReaderBenchLarge.java
java -cp "/tmp/stax-xml-woodstox-large:$HOME/.m2/repository/com/fasterxml/woodstox/woodstox-core/6.7.0/woodstox-core-6.7.0.jar:$HOME/.m2/repository/org/codehaus/woodstox/stax2-api/4.2.2/stax2-api-4.2.2.jar" \
  -Xmx8g XmlReaderBenchLarge \
  packages/benchmark/assets/large/database-10gib.xml 0 1

# quick-xml
cd packages/benchmark/cross-runtime/reader-quickxml-large
cargo run --release --offline -- \
  ../../assets/large/database-10gib.xml 0 1
```

## Raw Data

Full JSON results: `packages/benchmark/results/large-cross-runtime/report-1784943966253.json`
