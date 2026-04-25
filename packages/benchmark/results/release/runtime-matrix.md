# JavaScript Runtime Benchmark Matrix

Generated: 2026-04-25T15:45:36.305Z

This fixture compares the same built `stax-xml` JavaScript implementation on Node, Bun, and Deno.
It does not compare native addons; native and non-JS runtimes are covered by `cross-runtime-comparison.json`.

## Environment

- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: G:\programming\stax-xml-spike-rust-native\packages\benchmark\test-data\runtime-comparison-16mib.xml
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
| node | 24.15.0 | public-sync-full-string | 55.0 MiB/s | 290.78 ms | 967967 | -746772258 | 200.2 MiB | ok |
| node | 24.15.0 | iterable-count-only | 213.0 MiB/s | 75.11 ms | 967967 | 2078515073 | 26.7 MiB | ok |
| node | 24.15.0 | iterable-full-string | 116.5 MiB/s | 137.36 ms | 967967 | 1007437756 | 54.5 MiB | ok |
| bun | 1.3.13 | public-sync-full-string | 84.9 MiB/s | 188.52 ms | 967967 | -746772258 | 77.0 MiB | ok |
| bun | 1.3.13 | iterable-count-only | 259.0 MiB/s | 61.77 ms | 967967 | 2078515073 | 68.3 MiB | ok |
| bun | 1.3.13 | iterable-full-string | 161.6 MiB/s | 99.01 ms | 967967 | 1007437756 | 68.4 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 57.3 MiB/s | 279.28 ms | 967967 | -746772258 | 191.3 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-count-only | 220.5 MiB/s | 72.55 ms | 967967 | 2078515073 | 30.4 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | iterable-full-string | 124.9 MiB/s | 128.10 ms | 967967 | 1007437756 | 26.3 MiB | ok |

## Contract

- `public-sync-full-string` uses `StaxXmlParserSync` and folds element names, text, attribute names, and attribute values into a checksum.
- `iterable-count-only` uses the browser-compatible iterable event-frame backend without string materialization.
- `iterable-full-string` uses the same event-frame backend and materializes the same full string checksum workload.
- All runtime rows must preserve event count and checksum for the same scenario.
