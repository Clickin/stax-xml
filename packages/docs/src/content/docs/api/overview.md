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
---

## API Reference

For now, please refer to our comprehensive API guides:

- [EventReader](/stax-xml/api-guides/event-reader/) - Asynchronous XML parsing
- [EventReaderSync](/stax-xml/api-guides/event-reader-sync/) - Synchronous XML parsing
- [Tree/Object helpers](/stax-xml/api-guides/event-reader/#unknown-xml-tree-and-object-helpers) - Unknown XML projection to an ElementTree-like tree or compact object
- [CursorReader](/stax-xml/api-guides/cursor-reader/) - Thin cursor wrapper over `IterableReader`
- [Writer](/stax-xml/api-guides/writer/) - XML writing functionality
- [WriterSync](/stax-xml/api-guides/writer-sync/) - Synchronous XML writing and sync sink adapters
- [WriterSyncSink](/stax-xml/api/main/#writersyncsink) - Generated TypeDoc reference for sink-based sync writing

## Public Surface Map

The package import path already provides the `stax-xml` namespace, so the canonical class names do not use a `StaxXml` prefix. The old prefixed aliases are intentionally not exported.

| Surface | Import path | Purpose | Implementation notes |
| --- | --- | --- | --- |
| `EventReader` | `stax-xml` | Async event reader for `ReadableStream<Uint8Array>` input. | Preserves stream backpressure at the public boundary and materializes XML events from the iterable event backend. Runtime acceleration is selected only through `initStaxXml()`, not per-reader options. |
| `EventReaderSync` | `stax-xml` | Sync event reader for an in-memory XML string. | Iterates `AnyXmlEvent` values from a string. When a runtime backend has been initialized, it may use a structural-index table internally and can fall back to the JavaScript reader on parse errors when configured. |
| `IterableReader` | `stax-xml/iterable` or `stax-xml` | Low-level sync byte-batch reader for browser-compatible `Uint8Array` batches. | Exposes batch-local typed-array frames and span/copy helpers. It is the shared low-level reader behind higher-level readers, cursors, and converter fast paths. |
| `NodeIterableReader` | `stax-xml/iterable/node` | Node-specific sync byte-batch reader for `Buffer` batches and blocking file reads. | This is a separate Node implementation, not a sink adapter. It owns Buffer-oriented scanning, `node:fs` batch helpers, and optional initialized runtime handoff. |
| `CursorReader` | `stax-xml/cursor` or `stax-xml` | Sync cursor-style reader for XML strings. | Wraps event/table parsing with one-current-event accessors such as `name()`, `text()`, and `getAttributeValue()`. |
| `CursorReaderAsync` | `stax-xml/cursor` or `stax-xml` | Async cursor-style reader for `ReadableStream<Uint8Array>`. | Keeps the same cursor accessor model while pulling from an async stream and closing stream/native resources via `close()`. |
| `Writer` | `stax-xml` | Async writer for `WritableStream<Uint8Array>`. | Emits encoded XML incrementally to a web writable stream. |
| `WriterSync` | `stax-xml` | In-memory synchronous writer. | Builds and returns the XML string; the package default export remains `WriterSync`. |
| `WriterSyncSink` | `stax-xml` | Synchronous sink writer for large output. | Writes incrementally to a `SyncTextSink` instead of retaining the full XML string. |
| Tree/object helpers | `stax-xml` | `parseXmlTree*()` and `parseXmlObject*()` convenience APIs. | Project unknown XML into an order-preserving tree or compact object using the same reader stack. |
| Runtime acceleration | `stax-xml/runtime` | `initStaxXml()`, `getStaxXmlRuntime()`, and backend resolution helpers. | Backend preference belongs here; reader options no longer expose `backend`. |

## Type Definitions

The main types exported by StAX-XML are:

- `XmlEventType` - Enumeration of XML event types
- `CursorEventType` - Numeric cursor event constants
- `AnyXmlEvent` - Union type of all XML events
- `StartElementEvent` - Start element events with attributes
- `CharactersEvent` - Text content events
- `ErrorEvent` - Parsing error events
- `XmlAttribute` - XML attribute interface
- `WriteElementOptions` - Options for XML writing
- `XmlTreeDocument` / `XmlTreeElement` - Order-preserving tree helper result types
- `XmlObjectRecord` / `XmlObjectValue` - Compact object helper result types
- `ParseXmlTreeOptions` / `ParseXmlObjectOptions` - Tree/object helper options
- `SyncTextSink` - Custom synchronous sink target for `WriterSyncSink`
- `EventReaderOptions` / `EventReaderSyncOptions` - Event reader options
- `IterableReaderOptions` / `IterableReaderBatchFrame` - Low-level byte-batch reader options and frame view
- `NodeIterableReaderOptions` / `NodeIterableReaderBackendKind` - Node-specific iterable reader options and selected runtime kind
- `WriterOptions` / `WriterSyncOptions` - Async and sync writer options
- `WriterSyncSinkOptions` - Sink-based sync writer options
- `CursorReaderOptions` - Options for sync cursor readers
- `CursorReaderAsyncOptions` - Options for async cursor readers

For detailed type information and method signatures, please refer to the individual API guides above.
