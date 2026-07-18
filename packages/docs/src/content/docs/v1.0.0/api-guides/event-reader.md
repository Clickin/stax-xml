---
title: EventReader - Asynchronous XML Parsing
description: High-performance asynchronous XML parser for JavaScript/TypeScript
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/api-guides/event-reader.png
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
      content: https://clickin.github.io/stax-xml/og/api-guides/event-reader.png
slug: v1.0.0/api-guides/event-reader
---

## EventReader

`EventReader` is the asynchronous stable-event API. It accepts bytes from
a `ReadableStream<Uint8Array>` or `AsyncIterable<Uint8Array>` and reads another
input chunk only when the consumer asks for an event that is not already
buffered.

```ts
import { EventReader, XmlEventType } from 'stax-xml';

for await (const event of new EventReader(response.body!)) {
  if (event.type === XmlEventType.START_ELEMENT) {
    const id = event.attributes.find((attribute) => attribute.name === 'id')?.value;
    console.log(event.name, id);
  } else if (event.type === XmlEventType.CHARACTERS) {
    console.log(event.value);
  }
}
```

Every yielded event and attribute is a stable JavaScript object. Advancing the
reader does not mutate previously yielded values.

## Input

```ts
type StreamReaderSource =
  | ReadableStream<Uint8Array>
  | AsyncIterable<Uint8Array>;

interface EventReaderOptions {
  documentMode?: 'document' | 'fragment';
  namespaceAware?: boolean; // default: true
  autoDecodeEntities?: boolean; // default: true
  addEntities?: { entity: string; value: string }[];
  encoding?: string; // default: 'utf-8'
}
```

Byte input is decoded incrementally by a fatal `TextDecoder`. `encoding`
defaults to `utf-8` and accepts labels supported by the host decoder. The label
is not inferred from the XML declaration. Invalid
byte sequences and malformed XML reject `next()` and return the underlying
source. The reader does not interpret DTD declarations, resolve external
entities, or perform external I/O.

`autoDecodeEntities` defaults to `true` and performs single-pass decoding of
the five predefined XML entities, numeric character references, and trusted
definitions supplied through `addEntities`. Set it to `false` to preserve
reference spelling in returned text and attributes while retaining XML
reference validation. CDATA is always literal. Custom definitions are
non-recursive and cannot override predefined entities.

Node.js `Readable` streams can be passed directly because they are async
iterables and their `Buffer` chunks are `Uint8Array` values.

```ts
import { createReadStream } from 'node:fs';
import { EventReader } from 'stax-xml';

const reader = new EventReader(createReadStream('large.xml'));
```

## Lifecycle

`EventReader` implements both `AsyncIterable<AnyXmlEvent>` and
`AsyncIterator<AnyXmlEvent>`. It emits `START_DOCUMENT` first and
`END_DOCUMENT` last. Breaking from `for await` invokes `return()` and cancels or
returns the source. In a manual loop, call `await reader.return()` when stopping
early. Concurrent `next()` calls are rejected.

## Current-Token Alternative

Use `StreamReader` when reducing event-object allocation matters. It accepts the same
sources and returns the event type while accessors read the current token.
Attribute values can be read by index, qualified name, or the
`(namespaceURI, localName)` pair.

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

Current-token accessors are valid until the next successful `next()` call.

## Event Shapes

`AnyXmlEvent` covers document, start/end element, characters, CDATA, comment,
processing-instruction, and DTD events. Start-element attributes are an
`EventAttribute[]`; namespace declarations are not included as attributes.
Use the exported type guards such as `isStartElement()` and `isCharacters()`
for TypeScript narrowing.

The package does not provide async string input. When the complete XML is
already a JavaScript string, use `EventReaderSync` or `StreamReaderSync` so the
string can be scanned directly.
