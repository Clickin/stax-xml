# JavaScript Runtime Benchmark Matrix

Generated: 2026-07-12T02:32:08.827Z

This fixture compares the same built `stax-xml` JavaScript implementation on Node, Bun, and Deno.
It does not compare binary parser modules or non-JavaScript parser backends.

## Environment

- Baseline machine: Apple M4 Apple Silicon (darwin-arm64)
- Matches baseline: yes
- CPU: Apple M4
- Platform: darwin-arm64
- Fixture: /Users/senghyunjo/github/stax-xml/packages/benchmark/test-data/runtime-comparison-16mib.xml
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
  workload: "public-sync-full-string" | "cursor-sync-full-string" |
            "event-count-only" | "event-full-string",
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
- `cursor-sync-full-string` uses `CursorReaderSync` over bytes and folds the same full-string checksum through cursor accessors.
- `event-count-only` and `event-full-string` use public event reader checksum tiers; they are not async parser rows.
- This matrix measures only the public pure JavaScript reader path.

</details>

## Runtime Comparisons

Compare rows only within the same workload. Each workload preserves one input fixture, one API path, one materialization shape, and one checksum contract across runtimes.

| Workload | Runtime | Version | Throughput | Relative to baseline | Average | Events | Checksum | Peak heap | Status |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| public-sync-full-string | node | 24.15.0 | 117.1 MiB/s | 1.00x | 136.64 ms | 1024909 | -26688828 | 21.3 MiB | ok |
| public-sync-full-string | bun | 1.3.13 | 106.8 MiB/s | 0.91x | 149.88 ms | 1024909 | -26688828 | 16.9 MiB | ok |
| public-sync-full-string | deno | 2.7.14 (v8 14.7.173.20-rusty) | 114.1 MiB/s | 0.97x | 140.28 ms | 1024909 | -26688828 | 27.8 MiB | ok |
| cursor-sync-full-string | node | 24.15.0 | 102.5 MiB/s | 1.00x | 156.15 ms | 1024909 | 113372214 | 23.8 MiB | ok |
| cursor-sync-full-string | bun | 1.3.13 | 139.2 MiB/s | 1.36x | 114.97 ms | 1024909 | 113372214 | 33.0 MiB | ok |
| cursor-sync-full-string | deno | 2.7.14 (v8 14.7.173.20-rusty) | 115.8 MiB/s | 1.13x | 138.12 ms | 1024909 | 113372214 | 35.0 MiB | ok |
| event-count-only | node | 24.15.0 | 121.6 MiB/s | 1.00x | 131.58 ms | 1024909 | 1485326873 | 28.0 MiB | ok |
| event-count-only | bun | 1.3.13 | 161.4 MiB/s | 1.33x | 99.11 ms | 1024909 | 1485326873 | 38.4 MiB | ok |
| event-count-only | deno | 2.7.14 (v8 14.7.173.20-rusty) | 159.3 MiB/s | 1.31x | 100.41 ms | 1024909 | 1485326873 | 33.1 MiB | ok |
| event-full-string | node | 24.15.0 | 109.7 MiB/s | 1.00x | 145.88 ms | 1024909 | 1078379828 | 23.6 MiB | ok |
| event-full-string | bun | 1.3.13 | 79.8 MiB/s | 0.73x | 200.55 ms | 1024909 | 1078379828 | 17.0 MiB | ok |
| event-full-string | deno | 2.7.14 (v8 14.7.173.20-rusty) | 126.8 MiB/s | 1.16x | 126.22 ms | 1024909 | 1078379828 | 34.7 MiB | ok |

## Contract

- `public-sync-full-string` uses `EventReaderSync` and folds element names, text, attribute names, and attribute values into a checksum.
- `cursor-sync-full-string` uses `CursorReaderSync` and folds the same full-string checksum through cursor accessors.
- `event-count-only` uses the public event reader without string field folding beyond event counts and attribute counts.
- `event-full-string` uses the same public event reader and materializes the full string checksum workload.
- All runtime rows must preserve event count and checksum within the same workload.
