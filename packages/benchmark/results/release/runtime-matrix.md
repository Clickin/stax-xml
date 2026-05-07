# JavaScript Runtime Benchmark Matrix

Generated: 2026-05-06T10:50:17.761Z

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
| node | 24.15.0 | public-sync-full-string | 92.7 MiB/s | 172.65 ms | 967967 | -746772258 | 24.5 MiB | ok |
| node | 24.15.0 | stream-sync-index-full-string | 106.2 MiB/s | 150.67 ms | 967967 | -746772258 | 23.3 MiB | ok |
| node | 24.15.0 | event-count-only | 118.6 MiB/s | 134.85 ms | 967967 | 2078515073 | 20.4 MiB | ok |
| node | 24.15.0 | event-full-string | 84.7 MiB/s | 188.80 ms | 967967 | 1007437756 | 23.2 MiB | ok |
| bun | 1.3.13 | public-sync-full-string | 68.3 MiB/s | 234.37 ms | 967967 | -746772258 | 16.8 MiB | ok |
| bun | 1.3.13 | stream-sync-index-full-string | 137.0 MiB/s | 116.81 ms | 967967 | -746772258 | 68.3 MiB | ok |
| bun | 1.3.13 | event-count-only | 81.9 MiB/s | 195.37 ms | 967967 | 2078515073 | 17.2 MiB | ok |
| bun | 1.3.13 | event-full-string | 48.7 MiB/s | 328.62 ms | 967967 | 1007437756 | 17.2 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 94.3 MiB/s | 169.70 ms | 967967 | -746772258 | 28.0 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | stream-sync-index-full-string | 108.6 MiB/s | 147.32 ms | 967967 | -746772258 | 27.7 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-count-only | 118.8 MiB/s | 134.72 ms | 967967 | 2078515073 | 27.7 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-full-string | 97.9 MiB/s | 163.36 ms | 967967 | 1007437756 | 27.3 MiB | ok |

## Contract

- `public-sync-full-string` uses `EventReaderSync` and folds element names, text, attribute names, and attribute values into a checksum.
- `stream-sync-index-full-string` uses `StreamReaderSync` and folds the same full-string checksum through batch-local index accessors.
- `event-count-only` uses the public event reader without string field folding beyond event counts and attribute counts.
- `event-full-string` uses the same public event reader and materializes the full string checksum workload.
- All runtime rows must preserve event count and checksum for the same scenario.
