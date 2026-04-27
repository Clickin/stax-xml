---
title: StaxXmlCursorReader - Iterable Parser Cursor Wrapper
description: Thin cursor wrapper over the iterable parser backend
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/api-guides/staxxmlcursorreader.png
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
      content: https://clickin.github.io/stax-xml/og/api-guides/staxxmlcursorreader.png
slug: v1.0.0-rc1/api-guides/staxxmlcursorreader
---

## StaxXmlCursorReader - Iterable Parser Cursor Wrapper

`StaxXmlCursorReader` is a thin wrapper over `StaxXmlIterableParser` for code that prefers one-event-at-a-time cursor accessors. It delegates tokenization to the iterable parser backend and presents methods such as `name()`, `text()`, and `getAttributeValue()` on the current event.

Use it for ergonomic cursor traversal. Use `StaxXmlIterableParser` directly when you need batch frames, byte spans, or the lowest-level backend surface.

### Quick Start

```typescript
import { CursorEventType, StaxXmlCursorReader } from 'stax-xml/cursor';

const cursor = new StaxXmlCursorReader('<root><item id="1">Hello</item></root>');

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

`StaxXmlCursorReaderAsync` accepts a web standard `ReadableStream<Uint8Array>` and keeps the same accessor shape.

```typescript
import { CursorEventType, StaxXmlCursorReaderAsync } from 'stax-xml/cursor';

const response = await fetch('/large.xml');
const cursor = new StaxXmlCursorReaderAsync(response.body!);

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
const cursor = new StaxXmlCursorReader(xml, {
  autoDecodeEntities: true,
  addEntities: [{ entity: '&copy;', value: '©' }]
});

const asyncCursor = new StaxXmlCursorReaderAsync(stream, {
  encoding: 'utf-8',
  autoDecodeEntities: true
});
```

`autoDecodeEntities` defaults to `true`. The async reader defaults to `utf-8` decoding.
