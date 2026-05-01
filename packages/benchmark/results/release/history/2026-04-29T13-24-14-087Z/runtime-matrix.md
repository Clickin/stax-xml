# JavaScript Runtime Benchmark Matrix

Generated: 2026-04-29T13:23:23.726Z

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
| node | 24.15.0 | public-sync-full-string | 66.5 MiB/s | 240.66 ms | 967967 | -746772258 | 21.1 MiB | ok |
| node | 24.15.0 | event-count-only | 76.8 MiB/s | 208.21 ms | 967967 | 2078515073 | 21.8 MiB | ok |
| node | 24.15.0 | event-full-string | 65.4 MiB/s | 244.76 ms | 967967 | 1007437756 | 21.5 MiB | ok |
| bun | 1.3.13 | public-sync-full-string | 96.0 MiB/s | 166.66 ms | 967967 | -746772258 | 75.1 MiB | ok |
| bun | 1.3.13 | event-count-only | 103.4 MiB/s | 154.68 ms | 967967 | 2078515073 | 75.1 MiB | ok |
| bun | 1.3.13 | event-full-string | 62.7 MiB/s | 255.22 ms | 967967 | 1007437756 | 75.1 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | public-sync-full-string | 63.7 MiB/s | 251.09 ms | 967967 | -746772258 | 27.6 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-count-only | 76.3 MiB/s | 209.73 ms | 967967 | 2078515073 | 24.0 MiB | ok |
| deno | 2.7.13 (v8 14.7.173.20-rusty) | event-full-string | 68.5 MiB/s | 233.53 ms | 967967 | 1007437756 | 24.3 MiB | ok |

## Contract

- `public-sync-full-string` uses `EventReaderSync` and folds element names, text, attribute names, and attribute values into a checksum.
- `event-count-only` uses the public event reader without string field folding beyond event counts and attribute counts.
- `event-full-string` uses the same public event reader and materializes the full string checksum workload.
- All runtime rows must preserve event count and checksum for the same scenario.
