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

The public package is a pure JavaScript StAX-style parser and writer.

- [StreamReader](/stax-xml/api/main/#streamreader) - Async batch-first StAX core
- [StreamReaderSync](/stax-xml/api/main/#streamreadersync) - Sync batch-first StAX core
- [EventReader](/stax-xml/api-guides/event-reader/) - Asynchronous XML parsing
- [EventReaderSync](/stax-xml/api-guides/event-reader-sync/) - Synchronous XML parsing
- [Tree/Object helpers](/stax-xml/api-guides/event-reader/#unknown-xml-tree-and-object-helpers) - Unknown XML projection to an ElementTree-like tree or compact object
- [Writer](/stax-xml/api-guides/writer/) - XML writing functionality
- [WriterSync](/stax-xml/api-guides/writer-sync/) - Synchronous XML writing and sync sink adapters
- [WriterSyncSink](/stax-xml/api/main/#writersyncsink) - Generated TypeDoc reference for sink-based sync writing

## Public Surface Map

Recommendation: use the converter API first when the target XML-to-object shape
is known. If you need a low-overhead StAX core, start with `StreamReader` or
`StreamReaderSync`; on large synchronous byte input, consume each batch with
`eventCount` plus index accessors. If you want ergonomic event objects, use
`EventReader` or `EventReaderSync`.

| Surface | Import path | Purpose | Implementation notes |
| --- | --- | --- | --- |
| `StreamReader` | `stax-xml` | Async batch-first StAX core for `ReadableStream<Uint8Array>`. | Uses the JavaScript byte reader and yields `StreamBatch` views. |
| `StreamReaderSync` | `stax-xml` | Sync batch-first StAX core for `Uint8Array` or byte-batch iterables. | Uses the JavaScript byte reader. `eventCount` is batch-local, and views are invalidated by the next `nextBatch()` call. |
| `EventReader` | `stax-xml` | Async event reader for `ReadableStream<Uint8Array>` input. | Preserves stream backpressure at the public boundary. |
| `EventReaderSync` | `stax-xml` | Sync event reader for an in-memory XML string. | Materializes `AnyXmlEvent` values from the JavaScript reader stack. |
| `Writer` | `stax-xml` | Async writer for `WritableStream<Uint8Array>`. | Emits encoded XML incrementally to a web writable stream. |
| `WriterSync` | `stax-xml` | In-memory synchronous writer. | Builds and returns the XML string; the package default export remains `WriterSync`. |
| `WriterSyncSink` | `stax-xml` | Synchronous sink writer for large output. | Writes incrementally to a `SyncTextSink` instead of retaining the full XML string. |
| Tree/object helpers | `stax-xml` | `parseXmlTree*()` and `parseXmlObject*()` convenience APIs. | Project unknown XML into an order-preserving tree or compact object using the same reader stack. |

The package does not expose native, Wasm, or backend-selection modes. The
public contract is pure JavaScript and the boundary cost of returning
JavaScript strings and objects is part of the measured workload.

## Type Definitions

The main types exported by StAX-XML are:

- `XmlEventType` - Enumeration of XML event types
- `AnyXmlEvent` - Union type of all XML events
- `StartElementEvent` - Start element events with attributes
- `CharactersEvent` - Text content events
- `ErrorEvent` - Parsing error events
- `XmlAttribute` - XML attribute interface
- `XmlTreeDocument` / `XmlTreeElement` - Order-preserving tree helper result types
- `XmlObjectRecord` / `XmlObjectValue` - Compact object helper result types
- `ParseXmlTreeOptions` / `ParseXmlObjectOptions` - Tree/object helper options
- `SyncTextSink` - Custom synchronous sink target for `WriterSyncSink`
- `EventReaderOptions` / `EventReaderSyncOptions` - Event reader options
- `WriterOptions` / `WriterSyncOptions` - Async and sync writer options
- `WriterSyncSinkOptions` - Sink-based sync writer options

For detailed type information and method signatures, please refer to the
individual API guides above.
