---
title: StreamReaderSync - Synchronous Current-Token XML Parsing
description: Low-allocation synchronous XML stream reader for JavaScript and TypeScript
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/api-guides/stream-reader-sync.png
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
      content: https://clickin.github.io/stax-xml/og/api-guides/stream-reader-sync.png
---

## StreamReaderSync

`StreamReaderSync` is the synchronous current-token reader. It accepts a
JavaScript string, one `Uint8Array`, or an `Iterable<Uint8Array>`.

```ts
import { StreamReaderSync, XmlEventType } from 'stax-xml';

const reader = new StreamReaderSync('<catalog><book id="b1">StAX</book></catalog>');
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

String input is scanned directly without first encoding it to bytes. Byte
inputs are decoded incrementally as fatal UTF-8.

```ts
type StreamReaderSyncInput =
  | string
  | Uint8Array
  | Iterable<Uint8Array>;

interface StreamReaderSyncOptions {
  documentMode?: 'document' | 'fragment';
}
```

The reader emits `START_DOCUMENT` first and `END_DOCUMENT` last. Accessors
include `eventType()`, `name()`, `text()`, `localName()`, `prefix()`,
`namespaceURI()`, indexed attribute metadata, `attributeValue(indexOrName)`,
`attributeValue(namespaceURI, localName)`, and
`namespaceURIForPrefix()`. They describe only the current token.

Malformed XML, unsupported named entities, and invalid UTF-8 throw an error.
Only the five predefined XML entities and numeric character references are
decoded; custom and external entities are not resolved.

Call `reader.close()` when stopping early. It is idempotent and closes an
underlying byte iterator. Use [`EventReaderSync`](/stax-xml/api-guides/event-reader-sync)
when stable event objects are more convenient.
