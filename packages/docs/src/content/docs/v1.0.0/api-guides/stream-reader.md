---
title: StreamReader - Asynchronous Current-Token XML Parsing
description: Low-allocation asynchronous XML stream reader for JavaScript and TypeScript
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/api-guides/stream-reader.png
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
      content: https://clickin.github.io/stax-xml/og/api-guides/stream-reader.png
slug: v1.0.0/api-guides/stream-reader
---

## StreamReader

`StreamReader` is the low-allocation asynchronous XML reader. It accepts a
`ReadableStream<Uint8Array>` or an `AsyncIterable<Uint8Array>` and exposes the
current token through accessor methods instead of allocating a stable event
object for every token.

```ts
import { StreamReader, XmlEventType } from 'stax-xml';

const reader = new StreamReader(response.body!);
try {
  while (await reader.next() !== null) {
    if (reader.eventType() === XmlEventType.START_ELEMENT) {
      console.log(reader.name(), reader.attributeValue('id'));
    } else if (reader.eventType() === XmlEventType.CHARACTERS) {
      console.log(reader.text());
    }
  }
} finally {
  await reader.close();
}
```

Use `StreamReader` when parsing throughput and allocation rate matter more than
retaining event objects. Accessors describe the current token and must be read
before the next successful `next()` call.

## Input and options

```ts
type StreamReaderSource =
  | ReadableStream<Uint8Array>
  | AsyncIterable<Uint8Array>;

interface StreamReaderOptions {
  documentMode?: 'document' | 'fragment';
  namespaceAware?: boolean; // default: true
  autoDecodeEntities?: boolean; // default: true
  addEntities?: { entity: string; value: string }[];
  encoding?: string; // default: 'utf-8'
}
```

`namespaceAware` defaults to `true`. Set it to `false` when consumers need raw qualified names only: namespace URIs are `''`, `xmlns` declarations are ordinary attributes, and undeclared prefixes are not rejected.

Input bytes are decoded incrementally by a fatal `TextDecoder`. `encoding`
defaults to `utf-8` and accepts host-supported labels such as `utf-16le` and
`utf-16be`. The reader does not infer this label from the XML declaration;
callers must select the encoding that matches the byte source. Invalid byte
sequences, malformed XML, and unsupported named entities reject `next()`.
`autoDecodeEntities` defaults to `true` and single-pass decodes predefined,
numeric, and configured custom entities. Set it to `false` to preserve raw
reference spelling while retaining validation. CDATA is always literal.
`addEntities` supplies trusted, non-recursive internal definitions without DTD
processing. External entities are never resolved and no external I/O is
performed.

Node.js `Readable` streams can be passed directly because they are async
iterables and their `Buffer` chunks are `Uint8Array` values.

## Current-token accessors

The reader emits `START_DOCUMENT` first and `END_DOCUMENT` last. The accessor
surface is:

```ts
reader.eventType();
reader.name();
reader.text();
reader.localName();
reader.prefix();
reader.namespaceURI();
reader.attributeCount();
reader.attributeName(index);
reader.attributeLocalName(index);
reader.attributePrefix(index);
reader.attributeNamespaceURI(index);
reader.attributeValue(indexOrName);
reader.attributeValue(namespaceURI, localName);
reader.namespaceURIForPrefix(prefix);
```

`attributeValue()` accepts an attribute index, a qualified name, or a
`(namespaceURI, localName)` pair. Attribute accessors return `undefined` when
the requested attribute does not exist.

## Lifecycle and concurrency

Call `await reader.close()` when stopping early. Closing is idempotent and
returns the underlying async iterator or cancels a `ReadableStream`. A source
error also closes the reader before rethrowing the original error. Concurrent
`next()` calls are rejected; await each call before advancing again.

For stable event objects, use [`EventReader`](/stax-xml/api-guides/event-reader)
instead. For complete XML already held as a JavaScript string, use
[`StreamReaderSync`](/stax-xml/api-guides/stream-reader-sync).
