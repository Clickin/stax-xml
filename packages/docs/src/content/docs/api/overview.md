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

- [StaxXmlParser](/stax-xml/api-guides/staxxml-parser/) - Asynchronous XML parsing
- [StaxXmlParserSync](/stax-xml/api-guides/staxxml-parser-sync/) - Synchronous XML parsing
- [StaxXmlCursorReader](/stax-xml/api-guides/staxxmlcursorreader/) - Thin cursor wrapper over `StaxXmlIterableParser`
- [StaxXmlWriter](/stax-xml/api-guides/staxxml-writer/) - XML writing functionality
- [StaxXmlWriterSync](/stax-xml/api-guides/staxxml-writer-sync/) - Synchronous XML writing and sync sink adapters
- [StaxXmlWriterSyncSink](/stax-xml/api/main/#staxxmlwritersyncsink) - Generated TypeDoc reference for sink-based sync writing

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
- `SyncTextSink` - Custom synchronous sink target for `StaxXmlWriterSyncSink`
- `StaxXmlWriterSyncSinkOptions` - Sink-based sync writer options
- `StaxXmlCursorReaderOptions` - Options for sync cursor readers
- `StaxXmlCursorReaderAsyncOptions` - Options for async cursor readers

For detailed type information and method signatures, please refer to the individual API guides above.
