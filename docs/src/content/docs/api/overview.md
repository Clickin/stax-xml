---
title: API Reference Overview
description: Complete API reference for StAX-XML
---

## API Reference

For now, please refer to our comprehensive API guides:

- [StaxXmlParser](/api-guides/staxxml-parser/) - Asynchronous XML parsing
- [StaxXmlParserSync](/api-guides/staxxml-parser-sync/) - Synchronous XML parsing
- [StaxXmlWriter](/api-guides/staxxml-writer/) - XML writing functionality

## Type Definitions

The main types exported by StAX-XML are:

- `XmlEventType` - Enumeration of XML event types
- `AnyXmlEvent` - Union type of all XML events
- `StartElementEvent` - Start element events with attributes
- `CharactersEvent` - Text content events
- `ErrorEvent` - Parsing error events
- `XmlAttribute` - XML attribute interface
- `WriteElementOptions` - Options for XML writing

For detailed type information and method signatures, please refer to the individual API guides above.