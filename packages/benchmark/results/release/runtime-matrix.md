# JavaScript Runtime Benchmark Matrix

Generated: 2026-07-18T12:36:23.232Z

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
  scenario: "stream-sync-type-only" | "stream-sync-name-text" | "stream-sync-full" | "event-sync-full",
  eventCount: number,
  checksum: fold(the fields touched by that accessor tier),
  peakHeapUsedBytes: number
}
~~~

Runtime methods:

- Node reads text with `fs.readFileSync`, then runs the built package through `node --expose-gc`.
- Bun reads text with `Bun.file(path).text()`, then runs the same built JavaScript package.
- Deno reads text with `Deno.readTextFile` under `--allow-read --allow-env`, then runs the same built JavaScript package.
- `stream-sync-type-only` advances `StreamReaderSync` and reads only each token type.
- `stream-sync-name-text` additionally reads element/PI names and text payloads.
- `stream-sync-full` additionally reads namespace and complete attribute fields.
- `event-sync-full` materializes `EventReaderSync` events and folds the same full checksum.
- This matrix measures only the public pure JavaScript reader path.

</details>

## Results

| Runtime | Version | Scenario | Throughput | Average | Events | Checksum | Peak heap | Status |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| node | 24.15.0 | stream-sync-type-only | 119.0 MiB/s | 134.40 ms | 1024909 | 879435954 | 22.0 MiB | ok |
| node | 24.15.0 | stream-sync-name-text | 82.3 MiB/s | 194.32 ms | 1024909 | -1201287088 | 22.4 MiB | ok |
| node | 24.15.0 | stream-sync-full | 64.5 MiB/s | 247.98 ms | 1024909 | -855783368 | 28.0 MiB | ok |
| node | 24.15.0 | event-sync-full | 62.9 MiB/s | 254.57 ms | 1024909 | -855783368 | 30.6 MiB | ok |
| bun | 1.3.13 | stream-sync-type-only | 197.0 MiB/s | 81.23 ms | 1024909 | 879435954 | 33.1 MiB | ok |
| bun | 1.3.13 | stream-sync-name-text | 153.1 MiB/s | 104.48 ms | 1024909 | -1201287088 | 33.0 MiB | ok |
| bun | 1.3.13 | stream-sync-full | 101.8 MiB/s | 157.21 ms | 1024909 | -855783368 | 33.0 MiB | ok |
| bun | 1.3.13 | event-sync-full | 108.4 MiB/s | 147.62 ms | 1024909 | -855783368 | 17.1 MiB | ok |
| deno | 2.7.14 (v8 14.7.173.20-rusty) | stream-sync-type-only | 131.0 MiB/s | 122.16 ms | 1024909 | 879435954 | 34.9 MiB | ok |
| deno | 2.7.14 (v8 14.7.173.20-rusty) | stream-sync-name-text | 88.0 MiB/s | 181.73 ms | 1024909 | -1201287088 | 30.7 MiB | ok |
| deno | 2.7.14 (v8 14.7.173.20-rusty) | stream-sync-full | 67.0 MiB/s | 238.90 ms | 1024909 | -855783368 | 35.7 MiB | ok |
| deno | 2.7.14 (v8 14.7.173.20-rusty) | event-sync-full | 61.1 MiB/s | 262.02 ms | 1024909 | -855783368 | 38.3 MiB | ok |

## Contract

- `stream-sync-type-only`, `stream-sync-name-text`, and `stream-sync-full` isolate incremental public accessor cost.
- `event-sync-full` is the fully materialized event-object reference workload.
- All tiers must preserve event count; the two full tiers must also preserve the complete checksum.
