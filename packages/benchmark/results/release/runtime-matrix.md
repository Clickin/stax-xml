# JavaScript Runtime Benchmark Matrix

Generated: 2026-07-12T07:49:57.485Z

This fixture compares the same built `stax-xml` JavaScript implementation on Node, Bun, and Deno.
It does not compare binary parser modules or non-JavaScript parser backends.

## Environment

- CPU: Apple M4
- Fixture: /Users/senghyunjo/github/stax-xml/packages/benchmark/test-data/runtime-comparison-16mib.xml
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
| node | 24.15.0 | public-sync-full-string | 122.8 MiB/s | 130.29 ms | 1024909 | -26688828 | 23.6 MiB | ok |
| node | 24.15.0 | cursor-sync-full-string | 111.5 MiB/s | 143.51 ms | 1024909 | 113372214 | 22.8 MiB | ok |
| node | 24.15.0 | event-count-only | 147.9 MiB/s | 108.18 ms | 1024909 | 1485326873 | 24.3 MiB | ok |
| node | 24.15.0 | event-full-string | 117.8 MiB/s | 135.77 ms | 1024909 | 1078379828 | 28.2 MiB | ok |
| bun | 1.3.13 | public-sync-full-string | 121.9 MiB/s | 131.20 ms | 1024909 | -26688828 | 16.9 MiB | ok |
| bun | 1.3.13 | cursor-sync-full-string | 144.1 MiB/s | 111.01 ms | 1024909 | 113372214 | 33.0 MiB | ok |
| bun | 1.3.13 | event-count-only | 157.0 MiB/s | 101.92 ms | 1024909 | 1485326873 | 38.4 MiB | ok |
| bun | 1.3.13 | event-full-string | 78.6 MiB/s | 203.49 ms | 1024909 | 1078379828 | 17.0 MiB | ok |
| deno | 2.7.14 (v8 14.7.173.20-rusty) | public-sync-full-string | 115.7 MiB/s | 138.30 ms | 1024909 | -26688828 | 28.7 MiB | ok |
| deno | 2.7.14 (v8 14.7.173.20-rusty) | cursor-sync-full-string | 115.9 MiB/s | 138.07 ms | 1024909 | 113372214 | 34.4 MiB | ok |
| deno | 2.7.14 (v8 14.7.173.20-rusty) | event-count-only | 165.2 MiB/s | 96.86 ms | 1024909 | 1485326873 | 35.9 MiB | ok |
| deno | 2.7.14 (v8 14.7.173.20-rusty) | event-full-string | 106.7 MiB/s | 149.94 ms | 1024909 | 1078379828 | 34.4 MiB | ok |

## Contract

- `public-sync-full-string` uses `EventReaderSync` and folds element names, text, attribute names, and attribute values into a checksum.
- `stream-sync-index-full-string` uses `StreamReaderSync` and folds the same full-string checksum through batch-local index accessors.
- `event-count-only` uses the public event reader without string field folding beyond event counts and attribute counts.
- `event-full-string` uses the same public event reader and materializes the full string checksum workload.
- All runtime rows must preserve event count and checksum for the same scenario.
