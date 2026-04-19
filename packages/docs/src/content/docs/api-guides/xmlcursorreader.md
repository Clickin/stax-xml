---
title: XmlCursorReader - Zero-Allocation XML Cursor
description: Mutable cursor-based XML traversal for high-throughput parsing
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/api-guides/xmlcursorreader.png
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
      content: https://clickin.github.io/stax-xml/og/api-guides/xmlcursorreader.png
---

## XmlCursorReader - Zero-Allocation XML Cursor

`XmlCursorReader` is a low-level cursor API for code that needs maximum throughput while scanning XML sequentially. It reuses one mutable cursor instead of allocating an event object for every node, so accessors are methods that read the current cursor position.

Use the cursor API when you want to inspect, filter, or count XML events with minimal allocation. Use `StaxXmlParser` or the Converter API when you need event objects, async iteration ergonomics, or declarative object mapping.

### Quick Start

```typescript
import { CursorEventType, XmlCursorReader } from 'stax-xml/cursor';

const cursor = new XmlCursorReader('<root><item id="1">Hello</item></root>');

while (cursor.next()) {
  switch (cursor.eventType()) {
    case CursorEventType.START_ELEMENT:
      console.log(cursor.name());
      console.log(cursor.getAttributeValue('id'));
      break;
    case CursorEventType.CHARACTERS:
      console.log(cursor.text());
      break;
  }
}
```

### Async Streams

`XmlCursorReaderAsync` accepts a web standard `ReadableStream<Uint8Array>` and keeps the same accessor shape.

```typescript
import { CursorEventType, XmlCursorReaderAsync } from 'stax-xml/cursor';

const response = await fetch('/large.xml');
const cursor = new XmlCursorReaderAsync(response.body!);

while (await cursor.next()) {
  if (cursor.eventType() === CursorEventType.START_ELEMENT) {
    console.log(cursor.localName());
  }
}

await cursor.close();
```

### Accessors

| Method | Description |
| --- | --- |
| `next()` | Advances to the next event. Returns `false` after `END_DOCUMENT`. |
| `eventType()` | Returns a `CursorEventType` numeric constant for the current event. |
| `name()` | Returns the qualified element name for start/end element events. |
| `localName()` | Returns the local element or attribute name without prefix. |
| `prefix()` | Returns the namespace prefix when present. |
| `uri()` | Returns the namespace URI for the current element when namespace tracking is active. |
| `text()` | Returns character or CDATA text for text events. |
| `depth()` | Returns the current element stack depth. |
| `getAttributeCount()` | Returns the number of attributes on the current start element. |
| `getAttributeName(index)` | Returns an attribute's qualified name by index. |
| `getAttributeValue(indexOrName)` | Returns an attribute value by index or qualified name. |
| `getAttributeLocalName(index)` | Returns an attribute local name by index. |
| `getAttributePrefix(index)` | Returns an attribute prefix by index. |
| `getAttributeUri(index)` | Returns an attribute namespace URI by index when namespace tracking is active. |

### Options

```typescript
const cursor = new XmlCursorReader(xml, {
  autoDecodeEntities: true,
  addEntities: [{ entity: '&copy;', value: '©' }]
});

const asyncCursor = new XmlCursorReaderAsync(stream, {
  encoding: 'utf-8',
  autoDecodeEntities: true
});
```

`autoDecodeEntities` defaults to `true`. The async reader defaults to `utf-8` decoding.
