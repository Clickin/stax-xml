# Source Consumption Shape Audit

Generated: 2026-06-02T16:23:24.393Z

Audits source-consumption metadata from the same-contract aggregate. This is not a benchmark run and not a runtime-limit conclusion.

## Summary

- Status: classified
- Source artifact: G:\programming\stax-xml\packages\benchmark\results\release\same-contract-runtime-comparison.json
- Aggregate rows: 289
- JavaScript 1 GiB+ full-string rows: 239
- 1 GiB+ JS full-string rows with source-mode metadata: 233
- Rows not using full ArrayBuffer parser input: 233/233
- Full ArrayBuffer parser-input rows: 0
- Unknown parser-input rows: 0
- Direct ReadableStream rows: 1
- Corpus seed replay rows: 150
- File-backed sync Iterable<Uint8Array[]> rows: 36
- Sync Iterable<Uint8Array[]> rows: 195
- Primary source contract: primary-sync-iterable-byte-batches
- Primary parser input: synchronous Iterable<Uint8Array[]>
- Primary source boundary: demand-driven StreamReaderSync parser pulls
- Primary ArrayBuffer parser input: full-target ArrayBuffer parser input is excluded; corpus rows may replay smaller seed buffers as byte batches.
- Primary backpressure contract: Primary sync rows yield one grouped Uint8Array[] batch per parser pull; async and direct ReadableStream rows must stay separate and record backpressure counters.
- Primary sync byte-batch rows: 231
- Primary excluded rows: 8
- Primary direct ReadableStream rows: 0
- Primary async source rows: 0
- Primary full ArrayBuffer parser-input rows: 0
- Primary unknown source-mode rows: 0
- Primary fastest row: Node/V8 `rawFrameNameId` 185.50 MiB/s from `text-trim-cost-decomposition.json`
- Async/readable source frontier respects backpressure: true
- Browser live source frontier respects backpressure: true
- Representative stream rows respect backpressure: true

## Primary Exclusions

| Reason | Rows | Fastest excluded row |
| --- | ---: | --- |
| `async-source-boundary` | 1 | Chrome/V8 browser `fetchAsyncByteBatchFull` 9.77 MiB/s from `browser-fetch-readable-stream-books-corpus.json` |
| `direct-readable-stream` | 1 | Chrome/V8 browser `fetchReadableStreamFull` 9.68 MiB/s from `browser-fetch-readable-stream-books-corpus.json` |
| `unknown-source-mode` | 6 | Node/V8 `shortAsciiSubarraySharedDecoder` 51.60 MiB/s from `textdecoder-span-variants.json` |

## Source Mode Breakdown

| Source mode | Rows | Not full ArrayBuffer | Full ArrayBuffer | Unknown | Direct ReadableStream | Corpus replay | Fastest row |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `fetch-async-iterable-byte-batches` | 1 | 1 | 0 | 0 | 0 | 1 | Chrome/V8 browser `fetchAsyncByteBatchFull` 9.77 MiB/s from `browser-fetch-readable-stream-books-corpus.json` |
| `fetch-readable-stream-pull` | 1 | 1 | 0 | 0 | 1 | 1 | Chrome/V8 browser `fetchReadableStreamFull` 9.68 MiB/s from `browser-fetch-readable-stream-books-corpus.json` |
| `file-backed-sync-iterable-byte-batches` | 36 | 36 | 0 | 0 | 0 | 0 | Node/V8 `stax-raw-frame-name-id-batch-8` 152.11 MiB/s from `file-backed-batch-size-sweep.json` |
| `sync-iterable-byte-batches` | 195 | 195 | 0 | 0 | 0 | 148 | Node/V8 `rawFrameNameId` 185.50 MiB/s from `text-trim-cost-decomposition.json` |

## Source Frontiers

- Node/source-shape audit artifact: stream-source-consumption-backpressure-counters.json
- Fastest sync Iterable<Uint8Array[]> row: `sync-iterable-byte-batches-batch-8` (synchronous Iterable<Uint8Array[]>, 71.96 MiB/s, directReadableStream=false, fullArrayBufferParserInput=false, respectsBackpressure=n/a)
- Fastest direct ReadableStream row: `web-readable-stream-raw-frame-ascii-batch-8` (Web ReadableStream<Uint8Array>, 76.53 MiB/s, directReadableStream=true, fullArrayBufferParserInput=false, respectsBackpressure=true)
- Direct ReadableStream ratio to fastest sync iterable: 1.06x
- Backpressure rows respected: 6/6
- Frontier full ArrayBuffer rows: 0

- Browser live source artifact: browser-fetch-readable-stream-books-corpus.json
- Fetch ReadableStream row: `fetchReadableStreamFull` (fetch-readable-stream-pull, 9.68 MiB/s, directReadableStream=true, fullArrayBufferParserInput=false, respectsBackpressure=true)
- Fetch async byte-batch row: `fetchAsyncByteBatchFull` (fetch-async-iterable-byte-batches, 9.77 MiB/s, directReadableStream=false, fullArrayBufferParserInput=false, respectsBackpressure=true)
- Live rows respecting backpressure: 2/2
- Live rows using full ArrayBuffer parser input: 0

## Coverage Crosscheck

- Source artifact: runtime-proof-coverage-audit.json
- Status: consistent
- Coverage source-mode rows: 474
- Coverage not-full-ArrayBuffer rows: 474/474
- Coverage full ArrayBuffer rows: 0
- Coverage unknown ArrayBuffer rows: 0
- Coverage direct ReadableStream rows: 17
- Coverage demand-driven rows: 473

| Source mode | Rows | Not full ArrayBuffer | Full ArrayBuffer | Unknown | Direct ReadableStream | Demand-driven | Fastest row |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `async-iterable-byte-batches` | 15 | 15 | 0 | 0 | 0 | 15 | Node/V8 `async-iterable-raw-frame-ascii-batch-8` 77.56 MiB/s from `stream-source-consumption-backpressure-counters.json` |
| `complete-js-string` | 1 | 1 | 0 | 0 | 0 | 0 | Bun/JSC `3` 41.10 MiB/s from `bun-event-reader-string-large.json` |
| `fetch-async-iterable-byte-batches` | 2 | 2 | 0 | 0 | 0 | 2 | Chrome/V8 browser `fetchAsyncByteBatchFull` 13.52 MiB/s from `browser-candidate-headroom-books-corpus.json` |
| `fetch-readable-stream-pull` | 2 | 2 | 0 | 0 | 2 | 2 | Chrome/V8 browser `fetchReadableStreamFull` 14.64 MiB/s from `browser-candidate-headroom-books-corpus.json` |
| `file-backed-sync-iterable-byte-batches` | 53 | 53 | 0 | 0 | 0 | 53 | Node/V8 `stax-raw-frame-name-id-batch-8` 152.11 MiB/s from `file-backed-batch-size-sweep.json` |
| `generated-sync-iterable-byte-batches` | 382 | 382 | 0 | 0 | 0 | 382 | Node/V8 `rawFrameNameId` 185.50 MiB/s from `text-trim-cost-decomposition.json` |
| `sync-iterable-byte-batches` | 4 | 4 | 0 | 0 | 0 | 4 | Node/V8 `sync-iterable-byte-batches` 76.22 MiB/s from `stream-source-consumption-shapes.json` |
| `web-readable-stream-pull` | 15 | 15 | 0 | 0 | 15 | 15 | Node/V8 `web-readable-stream-raw-frame-ascii-batch-8` 77.86 MiB/s from `stream-source-consumption-shapes.json` |

## Findings

| ID | Classification | Summary |
| --- | --- | --- |
| `source-contract-classified` | SOURCE_FACT | All current 1 GiB+ JavaScript full-string rows with source metadata are classified as not full ArrayBuffer parser input. |
| `direct-readable-stream-separated` | SOURCE_FACT | Direct ReadableStream rows are counted separately from synchronous byte-batch parser rows. |
| `primary-frontier-sync-byte-batches-only` | SOURCE_FACT | Primary JavaScript frontier is restricted to synchronous Iterable<Uint8Array[]> byte-batch rows. |
| `backpressure-respected` | SOURCE_FACT | Rows that exercise async/readable or live fetch source paths record backpressure-respecting counters, and representative rows carry backpressure proof. |
| `corpus-replay-not-full-target-arraybuffer` | SOURCE_FACT | Corpus-cycle rows replay smaller seed buffers and are not classified as one full-target ArrayBuffer parser input. |

