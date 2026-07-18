---
title: API Reference Overview
description: Complete API reference for StAX-XML
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/api/overview.png
  - tag: meta
    attrs:
      property: og:image:width
      content: "1200"
  - tag: meta
    attrs:
      property: og:image:height
      content: "630"
  - tag: meta
    attrs:
      name: twitter:image
      content: https://clickin.github.io/stax-xml/og/api/overview.png
slug: v1.0.0/api/overview
---

## API Reference

StAX-XML 1.0 has two ESM entry points:

- `stax-xml` — four pull readers and three writers.
- `stax-xml/converter` — the schema-driven converter.

There are no public runtime, adapter, backend-selection, tree, DOM, native, or
Wasm subpaths.

## Public Surface Map

| Surface | Input or output | Use it when |
| --- | --- | --- |
| `StreamReaderSync` | `string`, `Uint8Array`, or `Iterable<Uint8Array>` | You want the lowest-allocation synchronous current-token API. String input is scanned directly without re-encoding. |
| `EventReaderSync` | Same synchronous inputs | You want stable event objects and normal synchronous iteration. |
| `StreamReader` | `ReadableStream<Uint8Array>` or `AsyncIterable<Uint8Array>` | You want an asynchronous current-token API with input backpressure. |
| `EventReader` | Same asynchronous inputs | You want stable event objects and `for await` iteration. |
| Converter | `stax-xml/converter` | The XML shape is known and you want typed object projection without building a DOM. |
| `WriterSync` | JavaScript string output | The complete output comfortably fits in memory. |
| `WriterSyncSink` | Synchronous text sink | You need incremental output or an external encoder. |
| `Writer` | `WritableStream<Uint8Array>` or `AsyncTextSink` | You need incremental asynchronous UTF-8 output or an external encoder. |

All four readers use the same token core and emit `START_DOCUMENT` and
`END_DOCUMENT`. `StreamReaderSync` and `StreamReader` expose the current token
through methods such as `eventType()`, `name()`, `text()`,
`attributeValue()`, and `namespaceURI()`. Event readers materialize stable
`AnyXmlEvent` objects from those tokens.

## Imports

```ts
import {
  EventReader,
  EventReaderSync,
  StreamReader,
  StreamReaderSync,
  Writer,
  WriterSync,
  WriterSyncSink,
  XmlEventType,
} from 'stax-xml';

import { x } from 'stax-xml/converter';
```

The package is ESM-only. The root has no default export.

## Main Types

- `AnyXmlEvent`, `EventAttribute`, and the exported event interfaces
- `XmlEventType`
- `EventReaderOptions` / `EventReaderSyncOptions`
- `StreamReaderOptions` / `StreamReaderSyncOptions`
- `StreamReaderSource` / `StreamReaderSyncInput`
- `WriterOptions` / `WriterSyncOptions` / `WriterSyncSinkOptions`
- `SyncTextSink`
- `DocumentMode`

See the reader and writer guides for lifecycle examples. The generated TypeDoc
reference is rebuilt from the same package entry points before release.
