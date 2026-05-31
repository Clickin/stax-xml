# Source Consumption Shape Audit

Generated: 2026-05-31T23:49:12.901Z

Audits source-consumption metadata from the same-contract aggregate. This is not a benchmark run and not a runtime-limit conclusion.

## Summary

- Status: classified
- Source artifact: G:\programming\stax-xml\packages\benchmark\results\release\same-contract-runtime-comparison.json
- Aggregate rows: 261
- JavaScript 1 GiB+ full-string rows: 216
- 1 GiB+ JS full-string rows with source-mode metadata: 210
- Rows not using full ArrayBuffer parser input: 210/210
- Full ArrayBuffer parser-input rows: 0
- Unknown parser-input rows: 0
- Direct ReadableStream rows: 1
- Corpus seed replay rows: 127
- File-backed sync Iterable<Uint8Array[]> rows: 36
- Sync Iterable<Uint8Array[]> rows: 172
- Async/readable source frontier respects backpressure: true
- Browser live source frontier respects backpressure: true

## Source Mode Breakdown

| Source mode | Rows | Not full ArrayBuffer | Full ArrayBuffer | Unknown | Direct ReadableStream | Corpus replay | Fastest row |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `fetch-async-iterable-byte-batches` | 1 | 1 | 0 | 0 | 0 | 1 | Chrome/V8 browser `fetchAsyncByteBatchFull` 9.77 MiB/s from `browser-fetch-readable-stream-books-corpus.json` |
| `fetch-readable-stream-pull` | 1 | 1 | 0 | 0 | 1 | 1 | Chrome/V8 browser `fetchReadableStreamFull` 9.68 MiB/s from `browser-fetch-readable-stream-books-corpus.json` |
| `file-backed-sync-iterable-byte-batches` | 36 | 36 | 0 | 0 | 0 | 0 | Node/V8 `stax-raw-frame-name-id-batch-8` 152.11 MiB/s from `file-backed-batch-size-sweep.json` |
| `sync-iterable-byte-batches` | 172 | 172 | 0 | 0 | 0 | 125 | Node/V8 `rawFrameNameId` 185.50 MiB/s from `text-trim-cost-decomposition.json` |

## Source Frontiers

- Node/source-shape audit artifact: stream-source-consumption-backpressure-counters.json
- Fastest sync Iterable<Uint8Array[]> row: `sync-iterable-byte-batches-batch-8` (synchronous Iterable<Uint8Array[]>, 67.94 MiB/s, directReadableStream=false, fullArrayBufferParserInput=false, respectsBackpressure=n/a)
- Fastest direct ReadableStream row: `web-readable-stream-raw-frame-ascii-batch-8` (Web ReadableStream<Uint8Array>, 75.98 MiB/s, directReadableStream=true, fullArrayBufferParserInput=false, respectsBackpressure=true)
- Direct ReadableStream ratio to fastest sync iterable: 1.12x
- Backpressure rows respected: 6/6
- Frontier full ArrayBuffer rows: 0

- Browser live source artifact: browser-fetch-readable-stream-books-corpus.json
- Fetch ReadableStream row: `fetchReadableStreamFull` (fetch-readable-stream-pull, 9.68 MiB/s, directReadableStream=true, fullArrayBufferParserInput=false, respectsBackpressure=true)
- Fetch async byte-batch row: `fetchAsyncByteBatchFull` (fetch-async-iterable-byte-batches, 9.77 MiB/s, directReadableStream=false, fullArrayBufferParserInput=false, respectsBackpressure=true)
- Live rows respecting backpressure: 2/2
- Live rows using full ArrayBuffer parser input: 0

## Findings

| ID | Classification | Summary |
| --- | --- | --- |
| `source-contract-classified` | SOURCE_FACT | All current 1 GiB+ JavaScript full-string rows with source metadata are classified as not full ArrayBuffer parser input. |
| `direct-readable-stream-separated` | SOURCE_FACT | Direct ReadableStream rows are counted separately from synchronous byte-batch parser rows. |
| `backpressure-respected` | SOURCE_FACT | Rows that exercise async/readable or live fetch source paths record backpressure-respecting counters. |
| `corpus-replay-not-full-target-arraybuffer` | SOURCE_FACT | Corpus-cycle rows replay smaller seed buffers and are not classified as one full-target ArrayBuffer parser input. |

