---
title: Migrating from v0.x
description: Move existing StAX-XML applications to the pure JavaScript 1.0 API surface.
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/guide/migration-v0.png
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
      content: https://clickin.github.io/stax-xml/og/guide/migration-v0.png
slug: v1.0.0/guide/migration-v0
---

StAX-XML 1.0 replaces the experimental reader matrix with one pure JavaScript
token core and four public reader roles. Install only `stax-xml`; there are no
native, Wasm, runtime-adapter, or backend-selection packages.

## Migration Map

| v0.x need | 1.0 surface |
| --- | --- |
| Parse an XML string into stable events | `EventReaderSync` |
| Pull current tokens from a string or synchronous byte source | `StreamReaderSync` |
| Iterate stable events from an asynchronous byte source | `EventReader` |
| Pull current tokens from an asynchronous byte source | `StreamReader` |
| Project known XML into typed objects | `stax-xml/converter` |
| Build an in-memory XML string | `WriterSync` |
| Write incrementally | `WriterSyncSink` or `Writer` |

Remove imports of experimental cursor, batch, adapter, tree/object-helper,
native, and backend APIs. The only package entry points are `stax-xml` and
`stax-xml/converter`; the root has no default export.

## In-Memory Strings

Synchronous readers accept strings directly. They do not encode the string to a
`Uint8Array` first.

```ts
import { EventReaderSync, XmlEventType } from 'stax-xml';

for (const event of new EventReaderSync('<root><item/></root>')) {
  if (event.type === XmlEventType.START_ELEMENT) console.log(event.name);
}
```

Use `StreamReaderSync` when reducing event-object allocation matters:

```ts
import { StreamReaderSync, XmlEventType } from 'stax-xml';

const reader = new StreamReaderSync('<root><item id="1"/></root>');
while (reader.next() !== null) {
  if (reader.eventType() === XmlEventType.START_ELEMENT) {
    console.log(reader.name(), reader.attributeValue('id'));
  }
}
```

The same reader also accepts a `Uint8Array` or an `Iterable<Uint8Array>`.

Byte readers accept an `encoding` option supported by the host `TextDecoder`;
it defaults to `utf-8` and decoding is fatal. `documentMode` defaults to
`fragment`; select `document` to require exactly one root element. Namespace
processing is enabled by default and can be disabled with `namespaceAware:
false` when raw qualified names are required. XML 1.1 declarations are
rejected; the parser and writer contract is XML 1.0.

## Node.js Streams

The asynchronous readers accept a web `ReadableStream<Uint8Array>` or any
`AsyncIterable<Uint8Array>`. A Node.js `Readable` can therefore be passed
directly; its `Buffer` chunks are `Uint8Array` values.

```ts
import { createReadStream } from 'node:fs';
import { EventReader, XmlEventType } from 'stax-xml';

export async function countElements(path: string) {
  let count = 0;
  for await (const event of new EventReader(createReadStream(path))) {
    if (event.type === XmlEventType.START_ELEMENT) count++;
  }
  return count;
}
```

Breaking early from `for await` closes the event reader and returns the source.
Call `close()` on a `StreamReader` when stopping a manual pull loop early.

## Converter

Schemas automatically reuse their compiled dispatch plan. There is no public
`.compile()` step.

```ts
import { x } from 'stax-xml/converter';

const feed = x.object({
  title: x.string('/rss/channel/title'),
  items: x.array(x.string('./title'), '/rss/channel/item'),
});

const value = feed.parseSync(xmlString);
```

The converter is streaming and does not introduce a DOM parser. Use the four
reader APIs when the XML shape is not known in advance.

## CommonJS

The package is ESM-only. CommonJS callers can use dynamic import:

```js
import('stax-xml').then(({ EventReaderSync }) => {
  for (const event of new EventReaderSync('<root/>')) console.log(event.type);
});
```
