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
- [Writer](/stax-xml/api-guides/writer/) - XML writing functionality
- [WriterSync](/stax-xml/api-guides/writer-sync/) - Synchronous XML writing and sync sink adapters
- [WriterSyncSink](/stax-xml/api/main/#writersyncsink) - Generated TypeDoc reference for sink-based sync writing
- [ProjectionReader](/stax-xml/api/projection/) - Unknown-schema full-document projection and native row fast paths

## Public Surface Map

The package import path already provides the `stax-xml` namespace, so the canonical class names do not use a `StaxXml` prefix. The old prefixed aliases are intentionally not exported.

Recommendation: use the converter API first when the target XML-to-object shape is known. If you need to traverse the whole XML, try `EventReader` or `EventReaderSync` first for light per-event work; use `ProjectionReader` when the unknown-schema job needs heavier tree, node, or row materialization.

| Surface | Import path | Purpose | Implementation notes |
| --- | --- | --- | --- |
| `EventReader` | `stax-xml` | Async event reader for `ReadableStream<Uint8Array>` input. | Preserves stream backpressure at the public boundary. When initialized native streaming batches are available, it selects the native backend at construction; otherwise it uses an internal JavaScript reader. |
| `EventReaderSync` | `stax-xml` | Sync event reader for an in-memory XML string. | Iterates lean `AnyXmlEvent` values from a string. When a runtime backend has been initialized, it may use a structural-index table internally; set `namespaceAware: true` when expanded namespace fields are required. |
| `Writer` | `stax-xml` | Async writer for `WritableStream<Uint8Array>`. | Emits encoded XML incrementally to a web writable stream. |
| `WriterSync` | `stax-xml` | In-memory synchronous writer. | Builds and returns the XML string; the package default export remains `WriterSync`. |
| `WriterSyncSink` | `stax-xml` | Synchronous sink writer for large output. | Writes incrementally to a `SyncTextSink` instead of retaining the full XML string. |
| Tree/object helpers | `stax-xml` | `parseXmlTree*()` and `parseXmlObject*()` convenience APIs. | Project unknown XML into an order-preserving tree or compact object using the same reader stack. Prefer these helpers only when the convenience shape is enough; known-schema extraction should use the converter API. |
| `ProjectionReader` | `stax-xml/projection` | Unknown-schema full-document projection plus native/Wasm row fast paths for `Buffer` or `Uint8Array` input. | `parseXmlNodes*()` returns a txml-style order-preserving object tree. Use this for heavier unknown-schema materialization after light event-reader traversal is no longer enough; projection row helpers remain the lower-level native fast path. The public name intentionally has no `Node` prefix. |
| Runtime acceleration | `stax-xml/runtime` | `initStaxXml()`, `getStaxXmlRuntime()`, and backend resolution helpers. | Backend preference belongs here; reader options no longer expose `backend`. |

## Type Definitions

The main types exported by StAX-XML are:

- `XmlEventType` - Enumeration of XML event types
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
- `WriterOptions` / `WriterSyncOptions` - Async and sync writer options
- `WriterSyncSinkOptions` - Sink-based sync writer options
- `ParseXmlNodesOptions` / `XmlNode` / `XmlElementNode` - Unknown-schema txml-style full-document projection types
- `ProjectionReaderOptions` / `ObjectRowsProjectionSpec` - Public native projection surface options and row projection spec

For detailed type information and method signatures, please refer to the individual API guides above.
