# JavaScript Runtime Benchmark Matrix

Generated: 2026-04-28T13:22:28.131Z

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
  scenario: "public-sync-full-string" | "iterable-count-only" | "iterable-full-string",
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
- `iterable-count-only` and `iterable-full-string` use the browser-compatible synchronous iterable byte-batch backend; they are not async parser rows.
- This matrix intentionally excludes native addons.

</details>

## Results

| Runtime | Version | Scenario | Throughput | Average | Events | Checksum | Peak heap | Status |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| node | 24.15.0 | public-sync-full-string | 38.6 MiB/s | 414.32 ms | 967967 | -746772258 | 261.7 MiB | ok |
| node | 24.15.0 | iterable-count-only | 196.1 MiB/s | 81.57 ms | 967967 | 2078515073 | 26.9 MiB | ok |
| node | 24.15.0 | iterable-full-string | 110.5 MiB/s | 144.74 ms | 967967 | 1007437756 | 54.7 MiB | ok |
| bun | 1.3.13 | public-sync-full-string | 62.7 MiB/s | 255.23 ms | 967967 | -746772258 | 75.2 MiB | ok |
| bun | 1.3.13 | iterable-count-only | 235.2 MiB/s | 68.03 ms | 967967 | 2078515073 | 67.5 MiB | ok |
| bun | 1.3.13 | iterable-full-string | 150.1 MiB/s | 106.62 ms | 967967 | 1007437756 | 67.6 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 35.3 MiB/s | 453.62 ms | 967967 | -746772258 | 236.9 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-count-only | 201.8 MiB/s | 79.27 ms | 967967 | 2078515073 | 30.6 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-full-string | 119.6 MiB/s | 133.82 ms | 967967 | 1007437756 | 26.4 MiB | ok |

## Contract

- `public-sync-full-string` uses `EventReaderSync` and folds element names, text, attribute names, and attribute values into a checksum.
- `iterable-count-only` uses the browser-compatible iterable event-frame backend without string materialization.
- `iterable-full-string` uses the same event-frame backend and materializes the same full string checksum workload.
- All runtime rows must preserve event count and checksum for the same scenario.
