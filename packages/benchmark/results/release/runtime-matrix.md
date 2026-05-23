# JavaScript Runtime Benchmark Matrix

Generated: 2026-05-23T04:29:40.906Z

This fixture compares the same built `stax-xml` JavaScript implementation on Node, Bun, and Deno.
It does not compare binary parser modules or non-JavaScript parser backends.

## Environment

- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\runtime-comparison-16mib.xml
- Fixture size: 16.00 MiB
- Runs: warmups=1, runs=3

## Workloads

<details>
<summary>Workload contract: Node, Bun, and Deno runtime matrix</summary>

The matrix uses one generated single-root 16.00 MiB XML fixture.

Sample XML shape, shortened:

~~~xml
<?xml version="1.0" encoding="UTF-8"?>
<root>
  <book id="book-N" lang="en" code="...">
    <title>Runtime Benchmark N</title>
    <author>Author ...</author>
    <description>Full string checksum text payload ...</description>
    <chapter number="1">Intro ...</chapter>
    <chapter number="2">Body ...</chapter>
  </book>
</root>
~~~

Output shape:

~~~text
runtime-result = {
  workload: "public-sync-full-string" | "stream-sync-index-full-string" |
            "projection-low-selectivity" | "projection-high-selectivity" |
            "event-count-only" | "event-full-string",
  eventCount: number, // record count for projection workloads
  checksum: fold(event type, names, text, attr names, attr values),
  peakHeapUsedBytes: number
}
~~~

Runtime methods:

- Node reads text with `fs.readFileSync`, then runs the built package through `node --expose-gc`.
- Bun reads text with `Bun.file(path).text()`, then runs the same built JavaScript package.
- Deno reads text with `Deno.readTextFile` under `--allow-read --allow-env`, then runs the same built JavaScript package.
- `public-sync-full-string` uses `EventReaderSync` over one string.
- `stream-sync-index-full-string` uses `StreamReaderSync` over bytes and consumes each `StreamBatch` with `eventCount` plus index accessors.
- `projection-low-selectivity` uses `stax-xml/projection` over bytes, selects `/root/book[@code="7"]`, and folds only `id` plus direct `title` child text.
- `projection-high-selectivity` uses the same projected fields but selects every `/root/book` record.
- `event-count-only` and `event-full-string` use public event reader checksum tiers; they are not async parser rows.
- This matrix measures only the public pure JavaScript reader path.

</details>

## Runtime Comparisons

Compare rows only within the same workload. Each workload preserves one input fixture, one API path, one materialization shape, and one checksum contract across runtimes.

| Workload | Runtime | Version | Throughput | Relative to baseline | Average | Events | Checksum | Peak heap | Status |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| public-sync-full-string | node | 24.15.0 | 93.7 MiB/s | 1.00x | 170.83 ms | 967967 | -746772258 | 24.6 MiB | ok |
| public-sync-full-string | bun | 1.3.13 | 68.9 MiB/s | 0.74x | 232.29 ms | 967967 | -746772258 | 16.9 MiB | ok |
| public-sync-full-string | deno | 2.7.13 (v8 14.7.173.20-rusty) | 89.2 MiB/s | 0.95x | 179.42 ms | 967967 | -746772258 | 28.3 MiB | ok |
| stream-sync-index-full-string | node | 24.15.0 | 106.4 MiB/s | 1.00x | 150.41 ms | 967967 | -746772258 | 23.4 MiB | ok |
| stream-sync-index-full-string | bun | 1.3.13 | 131.4 MiB/s | 1.24x | 121.72 ms | 967967 | -746772258 | 67.4 MiB | ok |
| stream-sync-index-full-string | deno | 2.7.13 (v8 14.7.173.20-rusty) | 101.2 MiB/s | 0.95x | 158.16 ms | 967967 | -746772258 | 27.8 MiB | ok |
| projection-low-selectivity | node | 24.15.0 | 164.7 MiB/s | 1.00x | 97.15 ms | 587 | -394352661 | 23.9 MiB | ok |
| projection-low-selectivity | bun | 1.3.13 | 216.1 MiB/s | 1.31x | 74.02 ms | 587 | -394352661 | 67.4 MiB | ok |
| projection-low-selectivity | deno | 2.7.13 (v8 14.7.173.20-rusty) | 173.9 MiB/s | 1.06x | 92.01 ms | 587 | -394352661 | 25.5 MiB | ok |
| projection-high-selectivity | node | 24.15.0 | 137.2 MiB/s | 1.00x | 116.59 ms | 56939 | 998171959 | 24.2 MiB | ok |
| projection-high-selectivity | bun | 1.3.13 | 119.1 MiB/s | 0.87x | 134.32 ms | 56939 | 998171959 | 111.7 MiB | ok |
| projection-high-selectivity | deno | 2.7.13 (v8 14.7.173.20-rusty) | 136.2 MiB/s | 0.99x | 117.51 ms | 56939 | 998171959 | 24.7 MiB | ok |
| event-count-only | node | 24.15.0 | 115.8 MiB/s | 1.00x | 138.16 ms | 967967 | 2078515073 | 20.7 MiB | ok |
| event-count-only | bun | 1.3.13 | 82.1 MiB/s | 0.71x | 194.86 ms | 967967 | 2078515073 | 17.8 MiB | ok |
| event-count-only | deno | 2.7.13 (v8 14.7.173.20-rusty) | 118.0 MiB/s | 1.02x | 135.65 ms | 967967 | 2078515073 | 25.8 MiB | ok |
| event-full-string | node | 24.15.0 | 81.5 MiB/s | 1.00x | 196.33 ms | 967967 | 1007437756 | 23.1 MiB | ok |
| event-full-string | bun | 1.3.13 | 47.5 MiB/s | 0.58x | 336.89 ms | 967967 | 1007437756 | 17.8 MiB | ok |
| event-full-string | deno | 2.7.13 (v8 14.7.173.20-rusty) | 97.1 MiB/s | 1.19x | 164.80 ms | 967967 | 1007437756 | 25.4 MiB | ok |

## Contract

- `public-sync-full-string` uses `EventReaderSync` and folds element names, text, attribute names, and attribute values into a checksum.
- `stream-sync-index-full-string` uses `StreamReaderSync` and folds the same full-string checksum through batch-local index accessors.
- `projection-low-selectivity` uses `stax-xml/projection`, byte-span selector matching, `attrEquals("code", "7")`, `attr("id")`, and `childText("title")`; its event count column is projected record count.
- `projection-high-selectivity` uses the same projection engine and projected fields without the attribute predicate, so it materializes every generated book record.
- `event-count-only` uses the public event reader without string field folding beyond event counts and attribute counts.
- `event-full-string` uses the same public event reader and materializes the full string checksum workload.
- All runtime rows must preserve event count and checksum within the same workload.
