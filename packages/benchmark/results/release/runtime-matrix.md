# JavaScript Runtime Benchmark Matrix

Generated: 2026-05-05T03:48:29.944Z

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
| node | 24.15.0 | public-sync-full-string | 92.4 MiB/s | 173.17 ms | 967967 | -746772258 | 22.7 MiB | ok |
| node | 24.15.0 | stream-sync-index-full-string | 107.6 MiB/s | 148.70 ms | 967967 | -746772258 | 22.3 MiB | ok |
| node | 24.15.0 | event-count-only | 115.0 MiB/s | 139.12 ms | 967967 | 2078515073 | 20.4 MiB | ok |
| node | 24.15.0 | event-full-string | 85.7 MiB/s | 186.60 ms | 967967 | 1007437756 | 22.9 MiB | ok |
| bun | 1.3.13 | public-sync-full-string | 69.5 MiB/s | 230.26 ms | 967967 | -746772258 | 16.8 MiB | ok |
| bun | 1.3.13 | stream-sync-index-full-string | 138.7 MiB/s | 115.36 ms | 967967 | -746772258 | 67.3 MiB | ok |
| bun | 1.3.13 | event-count-only | 81.1 MiB/s | 197.38 ms | 967967 | 2078515073 | 17.2 MiB | ok |
| bun | 1.3.13 | event-full-string | 48.3 MiB/s | 330.95 ms | 967967 | 1007437756 | 17.2 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 92.4 MiB/s | 173.12 ms | 967967 | -746772258 | 28.6 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | stream-sync-index-full-string | 109.8 MiB/s | 145.76 ms | 967967 | -746772258 | 27.7 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-count-only | 122.0 MiB/s | 131.13 ms | 967967 | 2078515073 | 27.3 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-full-string | 96.9 MiB/s | 165.07 ms | 967967 | 1007437756 | 27.5 MiB | ok |

## Contract

- `public-sync-full-string` uses `EventReaderSync` and folds element names, text, attribute names, and attribute values into a checksum.
- `stream-sync-index-full-string` uses `StreamReaderSync` and folds the same full-string checksum through batch-local index accessors.
- `event-count-only` uses the public event reader without string field folding beyond event counts and attribute counts.
- `event-full-string` uses the same public event reader and materializes the full string checksum workload.
- All runtime rows must preserve event count and checksum for the same scenario.
