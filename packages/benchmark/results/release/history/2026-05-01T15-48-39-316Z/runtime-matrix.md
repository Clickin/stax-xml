# JavaScript Runtime Benchmark Matrix

Generated: 2026-05-01T15:16:41.387Z

This fixture compares the same built `stax-xml` JavaScript implementation on Node, Bun, and Deno.
It does not compare native addons; native and non-JS runtimes are covered by `cross-runtime-comparison.json`.

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
  scenario: "public-sync-full-string" | "event-count-only" | "event-full-string",
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
- `event-count-only` and `event-full-string` use public event reader checksum tiers; they are not async parser rows.
- This matrix intentionally excludes native addons.

</details>

## Results

| Runtime | Version | Scenario | Throughput | Average | Events | Checksum | Peak heap | Status |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| node | 24.15.0 | public-sync-full-string | 66.7 MiB/s | 239.79 ms | 967967 | -746772258 | 21.3 MiB | ok |
| node | 24.15.0 | event-count-only | 73.1 MiB/s | 218.80 ms | 967967 | 2078515073 | 21.9 MiB | ok |
| node | 24.15.0 | event-full-string | 63.3 MiB/s | 252.83 ms | 967967 | 1007437756 | 22.0 MiB | ok |
| bun | 1.3.13 | public-sync-full-string | 96.8 MiB/s | 165.31 ms | 967967 | -746772258 | 143.2 MiB | ok |
| bun | 1.3.13 | event-count-only | 107.2 MiB/s | 149.21 ms | 967967 | 2078515073 | 75.1 MiB | ok |
| bun | 1.3.13 | event-full-string | 63.5 MiB/s | 251.80 ms | 967967 | 1007437756 | 75.1 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 65.8 MiB/s | 243.24 ms | 967967 | -746772258 | 27.5 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-count-only | 77.9 MiB/s | 205.48 ms | 967967 | 2078515073 | 25.5 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-full-string | 67.7 MiB/s | 236.17 ms | 967967 | 1007437756 | 25.3 MiB | ok |

## Contract

- `public-sync-full-string` uses `EventReaderSync` and folds element names, text, attribute names, and attribute values into a checksum.
- `event-count-only` uses the public event reader without string field folding beyond event counts and attribute counts.
- `event-full-string` uses the same public event reader and materializes the full string checksum workload.
- All runtime rows must preserve event count and checksum for the same scenario.
