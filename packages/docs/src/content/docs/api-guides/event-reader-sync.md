---
title: EventReaderSync - Synchronous XML Parsing
description: High-performance synchronous XML parser for JavaScript/TypeScript
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/api-guides/event-reader-sync.png
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
      content: https://clickin.github.io/stax-xml/og/api-guides/event-reader-sync.png
---

## EventReaderSync

`EventReaderSync` is the synchronous stable-event API. It accepts a JavaScript
string, one `Uint8Array`, or an `Iterable<Uint8Array>`.

```ts
import { EventReaderSync, XmlEventType } from 'stax-xml';

const xml = '<catalog><book id="b1">StAX</book></catalog>';

for (const event of new EventReaderSync(xml)) {
  if (event.type === XmlEventType.START_ELEMENT) {
    const id = event.attributes.get('id')?.value;
    console.log(event.name, id);
  }
}
```

String input is scanned directly as a JavaScript string. It is not encoded to a
`Uint8Array` first. Byte inputs use a fatal `TextDecoder`; `encoding` defaults
to `utf-8` and accepts labels supported by the host decoder. The label is not
inferred from the XML declaration.

## Input

```ts
type StreamReaderSyncInput =
  | string
  | Uint8Array
  | Iterable<Uint8Array>;

interface EventReaderSyncOptions {
  documentMode?: 'document' | 'fragment';
  namespaceAware?: boolean; // default: true
  autoDecodeEntities?: boolean; // default: true
  addEntities?: { entity: string; value: string }[];
  encoding?: string; // byte input only; default: 'utf-8'
}
```

The reader emits `START_DOCUMENT` first and `END_DOCUMENT` last. It implements
both `Iterable<AnyXmlEvent>` and `Iterator<AnyXmlEvent>`. Breaking from a
`for...of` loop invokes `return()` and releases the input iterator. In a manual
loop, call `reader.return()` when stopping early.

Every returned event and attribute is stable after the reader advances.

## Current-Token Alternative

Use `StreamReaderSync` to avoid stable event-object allocation:

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

Accessors include `eventType()`, `name()`, `text()`, `localName()`, `prefix()`,
`namespaceURI()`, indexed attribute metadata, `attributeValue(indexOrName)`,
`attributeValue(namespaceURI, localName)`,
and `namespaceURIForPrefix()`. They describe only the current token.

## Event Shapes and Errors

`AnyXmlEvent` covers document, start/end element, characters, CDATA, comment,
processing-instruction, and DTD events. Start-element attributes are an
`EventAttributes` is a read-only Map keyed by qualified name. Values retain
`name`, `localName`, `prefix`, `namespaceURI`, and `value`; iteration follows
source order. `JSON.stringify()` emits a JSON object rather than `{}`.
Namespace declarations are not included as attributes.

Malformed XML, unsupported named entity references, and invalid byte sequences
for the selected encoding throw an error. DTD declarations are emitted as
events but are not interpreted, and the reader never resolves external
entities or performs external I/O.

`autoDecodeEntities` defaults to `true` and performs single-pass decoding of
the five predefined XML entities, numeric character references, and definitions
supplied through `addEntities`. Set it to `false` to preserve reference
spelling in returned text and attributes; reference syntax and code points are
still validated. CDATA is always literal. `addEntities` is a trusted,
non-recursive internal vocabulary for DTD-free inputs. It cannot override the
five predefined entities.

Use exported type guards such as `isStartElement()` and `isCharacters()` for
TypeScript narrowing.
