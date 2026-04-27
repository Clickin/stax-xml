# JavaScript Runtime Benchmark Matrix

Generated: 2026-04-27T11:04:46.976Z

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
- `public-sync-full-string` uses `StaxXmlParserSync` over one string.
- `iterable-count-only` and `iterable-full-string` use the browser-compatible synchronous iterable byte-batch backend; they are not async parser rows.
- This matrix intentionally excludes native addons.

</details>

## Results

| Runtime | Version | Scenario | Throughput | Average | Events | Checksum | Peak heap | Status |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| node | 24.15.0 | public-sync-full-string | 56.2 MiB/s | 284.87 ms | 967967 | -746772258 | 201.6 MiB | ok |
| node | 24.15.0 | iterable-count-only | 196.7 MiB/s | 81.36 ms | 967967 | 2078515073 | 26.7 MiB | ok |
| node | 24.15.0 | iterable-full-string | 117.3 MiB/s | 136.35 ms | 967967 | 1007437756 | 54.5 MiB | ok |
| bun | 1.3.13 | public-sync-full-string | 84.6 MiB/s | 189.06 ms | 967967 | -746772258 | 220.8 MiB | ok |
| bun | 1.3.13 | iterable-count-only | 254.8 MiB/s | 62.79 ms | 967967 | 2078515073 | 68.3 MiB | ok |
| bun | 1.3.13 | iterable-full-string | 158.5 MiB/s | 100.96 ms | 967967 | 1007437756 | 68.4 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 56.5 MiB/s | 283.35 ms | 967967 | -746772258 | 191.5 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-count-only | 202.0 MiB/s | 79.19 ms | 967967 | 2078515073 | 30.4 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-full-string | 128.7 MiB/s | 124.31 ms | 967967 | 1007437756 | 26.2 MiB | ok |

## Contract

- `public-sync-full-string` uses `StaxXmlParserSync` and folds element names, text, attribute names, and attribute values into a checksum.
- `iterable-count-only` uses the browser-compatible iterable event-frame backend without string materialization.
- `iterable-full-string` uses the same event-frame backend and materializes the same full string checksum workload.
- All runtime rows must preserve event count and checksum for the same scenario.
