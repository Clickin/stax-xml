# JavaScript Runtime Benchmark Matrix

Generated: 2026-05-05T01:35:27.589Z

This fixture compares the same built `stax-xml` JavaScript implementation on Node, Bun, and Deno.
It does not compare binary parser modules or non-JavaScript parser backends.

## Environment

- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\runtime-comparison-16mib.xml
- Fixture size: 16.00 MiB
- Runs: warmups=1, runs=3

## Scenario

<details>
<summary>Scenario contract: Node, Bun, and Deno runtime matrix</summary>

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
  scenario: "public-sync-full-string" | "stream-sync-index-full-string" | "event-count-only" | "event-full-string",
  eventCount: number,
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
- `event-count-only` and `event-full-string` use public event reader checksum tiers; they are not async parser rows.
- This matrix measures only the public pure JavaScript reader path.

</details>

## Results

| Runtime | Version | Scenario | Throughput | Average | Events | Checksum | Peak heap | Status |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| node | 24.15.0 | public-sync-full-string | 96.1 MiB/s | 166.50 ms | 967967 | -746772258 | 24.6 MiB | ok |
| node | 24.15.0 | stream-sync-index-full-string | 105.5 MiB/s | 151.66 ms | 967967 | -746772258 | 23.3 MiB | ok |
| node | 24.15.0 | event-count-only | 120.2 MiB/s | 133.09 ms | 967967 | 2078515073 | 20.5 MiB | ok |
| node | 24.15.0 | event-full-string | 85.7 MiB/s | 186.60 ms | 967967 | 1007437756 | 23.0 MiB | ok |
| bun | 1.3.13 | public-sync-full-string | 69.2 MiB/s | 231.12 ms | 967967 | -746772258 | 16.8 MiB | ok |
| bun | 1.3.13 | stream-sync-index-full-string | 138.7 MiB/s | 115.36 ms | 967967 | -746772258 | 67.2 MiB | ok |
| bun | 1.3.13 | event-count-only | 82.6 MiB/s | 193.80 ms | 967967 | 2078515073 | 17.2 MiB | ok |
| bun | 1.3.13 | event-full-string | 48.9 MiB/s | 327.38 ms | 967967 | 1007437756 | 17.2 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 93.3 MiB/s | 171.51 ms | 967967 | -746772258 | 27.5 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | stream-sync-index-full-string | 111.2 MiB/s | 143.94 ms | 967967 | -746772258 | 27.8 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-count-only | 121.0 MiB/s | 132.19 ms | 967967 | 2078515073 | 27.6 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-full-string | 99.7 MiB/s | 160.53 ms | 967967 | 1007437756 | 27.6 MiB | ok |

## Contract

- `public-sync-full-string` uses `EventReaderSync` and folds element names, text, attribute names, and attribute values into a checksum.
- `stream-sync-index-full-string` uses `StreamReaderSync` and folds the same full-string checksum through batch-local index accessors.
- `event-count-only` uses the public event reader without string field folding beyond event counts and attribute counts.
- `event-full-string` uses the same public event reader and materializes the full string checksum workload.
- All runtime rows must preserve event count and checksum for the same scenario.
