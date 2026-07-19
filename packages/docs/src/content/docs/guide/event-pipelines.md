---
title: XML Transformation Pipelines
description: Read, modify, and write XML with event or current-token pipelines.
---

StAX-XML 1.1 connects its readers and writers into two pull-based transformation
pipelines. Use materialized events when transformations benefit from stable,
typed objects. Use current-token readers when minimizing allocations matters.

## Event pipeline

`EventReader` and `EventReaderSync` yield stable `AnyXmlEvent` objects. The
corresponding writers accept those objects through `writeEvent()`, so unchanged
events can pass through directly and selected events can be replaced.

```ts
import {
  EventReaderSync,
  WriterSync,
  XmlEventType,
  type AnyXmlEvent,
} from 'stax-xml';

const fixture = `<?xml version="1.0"?>
<catalog xmlns="urn:catalog"><item id="1">old</item><empty/></catalog>`;
const writer = new WriterSync();

for (const event of new EventReaderSync(fixture)) {
  const modified: AnyXmlEvent =
    event.type === XmlEventType.CHARACTERS && event.value === 'old'
      ? { ...event, value: 'new' }
      : event;
  writer.writeEvent(modified);
}

const xml = writer.getXmlString();
```

The same shape works asynchronously:

```ts
import { EventReader, Writer, XmlEventType } from 'stax-xml';

const writer = new Writer(output);
for await (const event of new EventReader(input)) {
  await writer.writeEvent(
    event.type === XmlEventType.COMMENT
      ? { ...event, value: event.value.trim() }
      : event,
  );
}
```

`writeEvent()` covers the standard event types represented by `AnyXmlEvent`:
document boundaries, elements, characters, CDATA, comments, processing
instructions, and DTD. `writeRaw()` remains a trusted direct-output escape
hatch; RAW is deliberately not an event type, matching Java StAX
`XMLEventWriter` rather than inventing a non-standard event.

## Current-token pipeline

`StreamReader` and `StreamReaderSync` avoid materializing an event object. Read
the current token's accessors and call the corresponding writer method. This is
more code, but lets a hot path copy or modify XML without allocating one object
per token.

```ts
import { StreamReaderSync, WriterSync, XmlEventType } from 'stax-xml';

const reader = new StreamReaderSync('<root><value>old</value></root>');
const writer = new WriterSync();

while (reader.next() !== null) {
  switch (reader.eventType()) {
    case XmlEventType.START_DOCUMENT:
      writer.writeStartDocument();
      break;
    case XmlEventType.START_ELEMENT:
      writer.writeStartElement(reader.localName()!, {
        prefix: reader.prefix() || undefined,
        uri: reader.namespaceURI() || undefined,
      });
      for (let index = 0; index < reader.attributeCount(); index++) {
        writer.writeAttribute(
          reader.attributeLocalName(index)!,
          reader.attributeValue(index)!,
          reader.attributePrefix(index) || undefined,
        );
      }
      break;
    case XmlEventType.CHARACTERS:
      writer.writeCharacters(reader.text() === 'old' ? 'new' : reader.text()!);
      break;
    case XmlEventType.END_ELEMENT:
      writer.writeEndElement();
      break;
    case XmlEventType.END_DOCUMENT:
      writer.writeEndDocument();
      break;
  }
}
```

For a general-purpose namespace-preserving copy, prefer the event pipeline.
Namespace declarations are represented in start-element attributes and
`writeEvent()` handles them correctly; a current-token pipeline must dispatch
namespace declarations with `writeNamespace()` instead of `writeAttribute()`.

## Fidelity and event fields

- `START_DOCUMENT` exposes `version`, `encoding`, and `standalone` when an XML
  declaration supplied them.
- `START_ELEMENT` exposes qualified and expanded names, ordered attributes, and
  `selfClosing`, preserving `<empty/>` separately from `<empty></empty>`.
- With `namespaceAware: true`, namespace declarations remain in
  `EventAttributes` with the XMLNS namespace URI, allowing a writer to recreate
  the required bindings.
- When no attributes exist, `attributes` is `undefined`. Event runtime objects
  still use a fixed property layout internally for predictable hidden classes.

## DTD and entity security boundary

Readers surface the complete DTD declaration and writers can emit it with
`writeDTD()` or `writeEvent()`. StAX-XML does not interpret DTD entity
declarations, resolve external entities, or access the filesystem or network.
If an application has reviewed trusted internal declarations, install their
replacement values explicitly with `addEntities` on both reader and writer.

This separation makes DTD inspection, validation, and round-trip output
possible without granting XML input ambient I/O authority.
