---
title: StreamReaderSync - Synchronous Current-Token XML Parsing
description: Low-allocation synchronous XML stream reader for JavaScript and TypeScript
slug: v1.0.0/api-guides/stream-reader-sync
---

`StreamReaderSync` is the synchronous current-token reader for a string,
`Uint8Array`, or `Iterable<Uint8Array>`.

```ts
import { StreamReaderSync, XmlEventType } from 'stax-xml';

const reader = new StreamReaderSync(xml);
try {
  while (reader.next() !== null) {
    if (reader.eventType() === XmlEventType.START_ELEMENT) {
      console.log(reader.name(), reader.attributeValue('id'));
    }
  }
} finally {
  reader.close();
}
```

```ts
interface StreamReaderSyncOptions {
  documentMode?: 'document' | 'fragment';
}
```

String input is scanned directly. Byte input uses fatal incremental UTF-8
decoding. The reader recognizes the five predefined XML entities and numeric
character references, but does not resolve custom or external entities.

Accessors include `eventType()`, `name()`, `text()`, `localName()`, `prefix()`,
`namespaceURI()`, attribute metadata, `attributeValue()`, and
`namespaceURIForPrefix()`. They describe only the current token. Call
`reader.close()` when stopping early; it is idempotent.
