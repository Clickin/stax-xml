---
title: StreamReader - Asynchronous Current-Token XML Parsing
description: Low-allocation asynchronous XML stream reader for JavaScript and TypeScript
slug: v1.0.0/api-guides/stream-reader
---

`StreamReader` is the low-allocation asynchronous reader for
`ReadableStream<Uint8Array>` and `AsyncIterable<Uint8Array>` sources. It
returns the current `XmlEventType`; use accessors before calling `next()` again.

```ts
import { StreamReader, XmlEventType } from 'stax-xml';

const reader = new StreamReader(source);
try {
  while (await reader.next() !== null) {
    if (reader.eventType() === XmlEventType.START_ELEMENT) {
      console.log(reader.name(), reader.attributeValue('id'));
    }
  }
} finally {
  await reader.close();
}
```

```ts
interface StreamReaderOptions {
  documentMode?: 'document' | 'fragment';
}
```

The reader decodes UTF-8 incrementally and recognizes only the five predefined
XML entities and numeric character references. Invalid UTF-8, malformed XML,
and unsupported named entities reject `next()`. Custom or external entities
are not resolved.

Available current-token accessors are `eventType()`, `name()`, `text()`,
`localName()`, `prefix()`, `namespaceURI()`, `attributeCount()`,
`attributeName()`, `attributeLocalName()`, `attributePrefix()`,
`attributeNamespaceURI()`, `attributeValue()`, and
`namespaceURIForPrefix()`. `attributeValue()` accepts an index, qualified name,
or `(namespaceURI, localName)` pair.

Call `await reader.close()` when stopping early. It is idempotent, closes the
underlying iterator, and cancels a `ReadableStream`. Concurrent `next()` calls
are rejected. Use [`EventReader`](/stax-xml/api-guides/event-reader) when
stable event objects are more convenient.
