# Full-String Transfer Hypothesis - 2026-05-03

## Decision

Full-string optimization should not send one JS string per XML name/text/value
from native to JavaScript. The better direction is:

1. keep traversal metadata in SoA-compatible typed arrays,
2. keep bytes or string arenas coarse-grained,
3. expose per-event/per-attribute offsets into those arenas, and
4. materialize user-visible strings lazily or by slicing bounded arenas.

This does not conflict with the SoA count/traversal plan. SoA owns event type,
attribute count, attr starts, and span/arena offset columns. Full-string arena
work is an additional set of parallel offset columns plus arena storage. The
same batch cursor can advance both structural columns and string arenas.

## Compared Paths

The focused diagnostic benchmark compares these paths:

- `native-full-string-direct-no-transfer`
  - Native parses and folds UTF-8 spans directly.
  - No Rust `String` allocation and no JS string transfer.
- `native-event-object-full-rust-strings-no-transfer`
  - Native materializes Rust `String`s for events/attributes but only returns
    summary counters.
  - This is a lower bound for "native creates strings" before N-API transfer.
- `native-full-string-values-js-string-transfer`
  - Native materializes full-string values and returns `Vec<String>` to JS.
  - This measures many per-value JS string creations/transfers.
- `native-full-string-arena-js-slice`
  - Native materializes values into one arena `String` and returns a
    little-endian `u32` UTF-16 offset buffer.
  - JS slices the returned arena and folds each slice, forcing string access.
- `stream-raw-arraybuffer-per-span-decode`
  - Native returns the existing external buffer/table.
  - JS decodes each span from the ArrayBuffer/Buffer path.
- `stream-raw-soa-string-arena-direct`
  - Native fills SoA columns and a batch-local JS string arena during streaming
    parse.
  - JS consumes UTF-16 code-unit arena offsets directly and falls back to byte
    decode only for invalid UTF-8 spans.
- `stream-raw-js-string-arena-ascii`
  - JS decodes each native batch buffer once into one string arena and slices
    spans.
  - This is an ASCII-only approximation of native chunked string arenas.

## Evidence

Command:

```sh
pnpm --filter=benchmark exec node --expose-gc full-string-transfer-hypothesis.mjs \
  --file test-data/runtime-comparison-16mib.xml \
  --runs 3 --warmups 1 \
  --json-out /tmp/stax-full-string-transfer-hypothesis.json
```

Fixture: `runtime-comparison-16mib.xml`, 16.00 MiB, ASCII.

| Path | Throughput | Avg | Strings | Objects/Arenas |
| --- | ---: | ---: | ---: | ---: |
| Native span fold, no transfer | 778.8 MiB/s | 20.55 ms | n/a | 0 objects |
| Native Rust strings, no transfer | 257.9 MiB/s | 62.03 ms | n/a | 967,967 objects |
| Native strings transferred to JS | 57.0 MiB/s | 280.85 ms | 1,537,355 | 967,967 objects |
| Native arena string, JS slice | 103.9 MiB/s | 154.03 ms | 1,537,355 | 1 arena |
| Raw ArrayBuffer, per-span JS decode | 86.6 MiB/s | 184.86 ms | 1,537,355 | 17 arenas |
| Raw batch string arena, JS slice | 112.0 MiB/s | 142.80 ms | 1,537,355 | 17 arenas |

Interpretation:

- Native span folding is the upper bound; it avoids the public requirement to
  return strings.
- Rust `String` allocation alone is about 3x slower than native span folding,
  before any JS transfer.
- Returning 1.5M individual JS strings is slower than the current
  ArrayBuffer/table raw path.
- Returning one native arena string plus offsets is much better than per-value
  string transfer and better than per-span ArrayBuffer decode on this fixture.
- The current native arena diagnostic is pessimistic for a final arena design:
  it first builds `EventObjectFull` Rust strings, then copies those strings into
  an arena. A production path should fill SoA columns and arena offsets directly
  from parsed spans.
- Coarse string arenas are better than per-span decode on this ASCII fixture.

## Consequences

For full-string work, do not add a native API that returns one JavaScript string
per name/text/attribute value as the main optimization path. It creates too
many N-API/V8 string objects and loses to the external ArrayBuffer route.

Implementation update: the streaming native parser now supports
`batchLayout: 'soa-string-arena'` for `StreamReaderSync`. The layout keeps the
stable public batch/event-view API, adds an experimental
`nextRawBatch().kind === 'soa-string-arena'` path for benchmark consumers, and
uses `-1` arena offsets to preserve byte-decode fallback semantics for invalid
UTF-8 spans.

The next useful experiments are:

- Measure native SoA arena batch fill against the previous raw word-table and
  `EventObjectFull` transfer diagnostics on the standard 16MiB fixture.
- External UTF-8/UTF-16 ArrayBuffer arena plus offsets as a CppHeap-avoiding
  variant, especially for workloads that may not read every string.

The arena design must bound parent retention. Use batch-sized arenas or an
explicit maximum arena size; do not retain one whole-document parent string.

## Caveats

The JS string-arena row uses ASCII byte offsets as code-unit offsets. The native
arena row emits UTF-16 code-unit offsets and was separately checked against a
small non-ASCII fixture (`😀`, `한글`, `café`) by comparing arena slices with the
per-value transfer result.

The native JS-string-transfer row intentionally stresses individual strings. A
future "native sends one bounded arena string plus offsets" design is a
different path and should be benchmarked separately.
