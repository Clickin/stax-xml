# Chunked String Decode Rejection

Date: 2026-05-22

Goal worktree: `G:\tmp\stax-xml-chunked-decode-goal`

Goal branch: `goal/chunked-decode-suffix-detach`

Checkpoint base: `a04159d40d2f020026fa66bf4c6cf340a2793de9`

Last evidence commit before discard:
`216edff5795b5f1e6e42ff8529122676bf818dc3`

## Final Direction

Use a byte-offset parser core with span-level string materialization:

- scan XML as bytes;
- keep event names, text, and attributes as byte spans until the API consumer
  asks for strings or the converter must assign values;
- materialize strings with `TextDecoder.decode()` over an `ArrayBufferView`
  covering exactly the span;
- keep this as the large-file default because stax-xml's main strength is
  bounded-memory, multi-GiB XML parsing.

Do not make decoded string chunks the product default.

## Why

The chunked-string spike proved that JavaScript string operations can be fast:
`String#indexOf` gives a real fast path that byte arrays do not expose. Direct
substring materialization also avoids the explicit suffix-detach copy cost.

That is not enough for stax-xml's primary workload. A StAX parser for large XML
files must remain stable when consumers keep selected names, attributes, or text
after the parser has moved on. Direct substrings over decoded chunks can keep
the decoded parent chunk alive. This makes retained memory scale with chunk
history rather than with the small strings actually returned to the consumer.

## Evidence Summary

Environment:

- Node: `v24.15.0`
- V8: `13.6.233.17-node.48`
- Command gate: `node --expose-gc`
- Fixture: generated `attribute-heavy`
- Chunk size: `1 MiB`
- Retention mode: one retained attribute value or text string per decoded chunk
- Harness in discarded worktree:
  `packages/benchmark/chunked-string-retention-gc.mjs`

Command shape:

```sh
pnpm --filter benchmark bench:chunked-string-retention-gc -- --size-gib=4 --chunk-size=1048576 --retain=sample --runs=1 --warmups=0
```

Large-input results:

| Input | Strategy | Throughput | Retained RSS delta | Retained heap delta | Retained strings/chars | Checkpoint GC |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 GiB | suffix-detach | 82.1 MiB/s | 133.2 MiB | 1.8 MiB | 1025 / 12440 | 452 / 287.6 ms |
| 1 GiB | direct slice | 133.3 MiB/s | 308.2 MiB | 303.3 MiB | 1025 / 12440 | 221 / 167.6 ms |
| 2 GiB | suffix-detach | 80.6 MiB/s | 136.1 MiB | 3.6 MiB | 2049 / 25107 | 787 / 525.9 ms |
| 2 GiB | direct slice | 101.6 MiB/s | 621.2 MiB | 613.5 MiB | 2049 / 25107 | 440 / 491.3 ms |
| 4 GiB | suffix-detach | 75.4 MiB/s | 139.7 MiB | 7.2 MiB | 4097 / 49934 | 1441 / 1157.9 ms |
| 4 GiB | direct slice | 142.7 MiB/s | 1234.8 MiB | 1220.9 MiB | 4097 / 49934 | 882 / 695.9 ms |

The direct-slice path is faster, but the 4 GiB run kept about `1.22 GiB` of
heap live for only `49934` retained characters. That is decoded parent retention
and is incompatible with the library's large-file positioning.

Additional controls:

| Input | Retain | Strategy | Throughput | Retained RSS delta | Retained heap delta |
| --- | --- | --- | ---: | ---: | ---: |
| 1 GiB | none | suffix-detach | 81.9 MiB/s | 133.9 MiB | 1.7 MiB |
| 1 GiB | none | direct slice | 92.0 MiB/s | 0.5 MiB | 1.2 MiB |
| 64 MiB | all | suffix-detach | 38.8 MiB/s | 440.0 MiB | 313.2 MiB |
| 64 MiB | all | direct slice | 52.4 MiB/s | 152.3 MiB | 343.4 MiB |

`retain=none` shows direct substring has a genuine CPU benefit when no strings
escape. `retain=sample` shows why that benefit is unsafe for exposed parser
strings in large streaming workloads.

## Decision

Keep the product direction on byte offsets and span decode.

Implementation guidance:

- Prefer `Uint8Array` or `Buffer` indexing for hot byte scanning.
- Use `DataView` or `Uint8Array.subarray()` only as a precise view passed to
  `TextDecoder.decode()` for materialization. Do not interpret this as a
  requirement to scan with `DataView#getUint8()`.
- Keep returned strings independent of decoded chunk parents.
- Converter/string extraction paths should use byte spans until assignment.

Rejected:

- decoded chunk string scanner as the default parser core;
- wholesale replacement of `retainedSubstring` with direct `slice`;
- lazy getters for names, text, or attributes;
- Map/localName caching as the primary performance direction.

## What To Do With The Goal Worktree

The goal worktree was an evidence spike. Its product code should not be merged.
The useful decision is captured in this knowledge note.

Safe cleanup target:

```sh
git worktree remove G:/tmp/stax-xml-chunked-decode-goal
git branch -D goal/chunked-decode-suffix-detach
```

If the branch needs to be preserved for archaeology, keep only the commit ids
above, not the worktree.
