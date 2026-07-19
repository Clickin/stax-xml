# JavaScript Runtime Benchmark Matrix

Generated: 2026-07-19T07:35:02.251Z

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
  peakHeapUsedBytes: number,
  peakRssBytes: number
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

| Runtime | Version | Scenario | Throughput | Average | Events | Checksum | Peak heap | Peak RSS | Status |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| node | 26.5.0 | stream-sync-type-only | 118.1 MiB/s | 135.45 ms | 1024909 | 879435954 | 7.5 MiB | 132.0 MiB | ok |
| node | 26.5.0 | stream-sync-name-text | 81.3 MiB/s | 196.86 ms | 1024909 | -1201287088 | 8.7 MiB | 132.9 MiB | ok |
| node | 26.5.0 | stream-sync-full | 64.0 MiB/s | 249.85 ms | 1024909 | -855783368 | 21.2 MiB | 153.8 MiB | ok |
| node | 26.5.0 | event-sync-full | 55.4 MiB/s | 288.57 ms | 1024909 | -855783368 | 8.4 MiB | 154.2 MiB | ok |
| bun | 1.3.14 | stream-sync-type-only | 195.1 MiB/s | 82.00 ms | 1024909 | 879435954 | 33.1 MiB | 189.8 MiB | ok |
| bun | 1.3.14 | stream-sync-name-text | 143.1 MiB/s | 111.77 ms | 1024909 | -1201287088 | 32.9 MiB | 219.9 MiB | ok |
| bun | 1.3.14 | stream-sync-full | 85.8 MiB/s | 186.44 ms | 1024909 | -855783368 | 33.0 MiB | 227.8 MiB | ok |
| bun | 1.3.14 | event-sync-full | 72.4 MiB/s | 221.11 ms | 1024909 | -855783368 | 17.0 MiB | 268.7 MiB | ok |
| deno | 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-type-only | 132.6 MiB/s | 120.65 ms | 1024909 | 879435954 | 26.2 MiB | 118.7 MiB | ok |
| deno | 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-name-text | 86.1 MiB/s | 185.85 ms | 1024909 | -1201287088 | 29.3 MiB | 119.3 MiB | ok |
| deno | 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-full | 67.1 MiB/s | 238.57 ms | 1024909 | -855783368 | 31.5 MiB | 139.0 MiB | ok |
| deno | 2.9.3 (v8 14.9.207.2-rusty) | event-sync-full | 60.0 MiB/s | 266.74 ms | 1024909 | -855783368 | 36.8 MiB | 139.3 MiB | ok |

## Contract

- `stream-sync-type-only`, `stream-sync-name-text`, and `stream-sync-full` isolate incremental public accessor cost.
- `event-sync-full` is the fully materialized event-object reference workload.
- All tiers must preserve event count; the two full tiers must also preserve the complete checksum.
