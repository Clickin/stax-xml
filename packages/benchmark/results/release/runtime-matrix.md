# JavaScript Runtime Benchmark Matrix

Generated: 2026-07-18T15:25:59.354Z

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
| node | 26.5.0 | stream-sync-type-only | 115.7 MiB/s | 138.31 ms | 1024909 | 879435954 | 7.5 MiB | 132.7 MiB | ok |
| node | 26.5.0 | stream-sync-name-text | 78.5 MiB/s | 203.80 ms | 1024909 | -1201287088 | 7.2 MiB | 133.5 MiB | ok |
| node | 26.5.0 | stream-sync-full | 61.5 MiB/s | 260.32 ms | 1024909 | -855783368 | 20.2 MiB | 153.9 MiB | ok |
| node | 26.5.0 | event-sync-full | 55.4 MiB/s | 288.55 ms | 1024909 | -855783368 | 14.8 MiB | 154.0 MiB | ok |
| bun | 1.3.14 | stream-sync-type-only | 187.2 MiB/s | 85.46 ms | 1024909 | 879435954 | 33.0 MiB | 181.0 MiB | ok |
| bun | 1.3.14 | stream-sync-name-text | 145.9 MiB/s | 109.68 ms | 1024909 | -1201287088 | 32.9 MiB | 210.9 MiB | ok |
| bun | 1.3.14 | stream-sync-full | 100.2 MiB/s | 159.70 ms | 1024909 | -855783368 | 33.0 MiB | 220.1 MiB | ok |
| bun | 1.3.14 | event-sync-full | 107.9 MiB/s | 148.25 ms | 1024909 | -855783368 | 17.0 MiB | 259.2 MiB | ok |
| deno | 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-type-only | 127.7 MiB/s | 125.27 ms | 1024909 | 879435954 | 28.3 MiB | 117.9 MiB | ok |
| deno | 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-name-text | 119.5 MiB/s | 133.88 ms | 1024909 | -1201287088 | 24.7 MiB | 118.3 MiB | ok |
| deno | 2.9.3 (v8 14.9.207.2-rusty) | stream-sync-full | 63.1 MiB/s | 253.69 ms | 1024909 | -855783368 | 36.0 MiB | 137.4 MiB | ok |
| deno | 2.9.3 (v8 14.9.207.2-rusty) | event-sync-full | 60.6 MiB/s | 264.21 ms | 1024909 | -855783368 | 31.5 MiB | 138.1 MiB | ok |

## Contract

- `stream-sync-type-only`, `stream-sync-name-text`, and `stream-sync-full` isolate incremental public accessor cost.
- `event-sync-full` is the fully materialized event-object reference workload.
- All tiers must preserve event count; the two full tiers must also preserve the complete checksum.
