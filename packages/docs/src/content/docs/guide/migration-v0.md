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

## Public API Diff

The following table maps the v0.7 public surface to its 1.0 replacement. A
reader choice depends on whether the application needs stable event objects or
a reusable current-token view.

| v0.x API | 1.0 replacement | Contract change |
| --- | --- | --- |
| `StaxXmlParserSync` | `EventReaderSync` | Still a synchronous iterable; start-element attributes are now a read-only Map rather than a record. |
| `StaxXmlParserSync` | `StreamReaderSync` | Use this instead when stable event objects are unnecessary. Call `next()`, then read the current token through getters. |
| `StaxXmlParser` | `EventReader` or `StreamReader` | Accepts `ReadableStream<Uint8Array>` or `AsyncIterable<Uint8Array>`. Concurrent `next()` calls are rejected. |
| `StaxXmlCursorReader` | `StreamReaderSync` | `next()` now returns an `XmlEventType` or `null`, not `boolean`; getter names no longer start with `get`. |
| `StaxXmlCursorReaderAsync` | `StreamReader` | Uses the same token and getter contract as the synchronous reader. |
| `StaxXmlWriterSync` / default export | `WriterSync` | Import it by name; the package has no default export. |
| `StaxXmlWriterSyncSink` | `WriterSyncSink` | The caller still supplies a `SyncTextSink`. |
| `StaxXmlWriter` | `Writer` | Supply a `WritableStream<Uint8Array>` or `AsyncTextSink`. |
| `XmlEventType.ERROR`, `ErrorEvent`, `isError` | None | Parse and decode failures throw from sync readers and reject async reads. |
| `attributes: Record<string, string>` and `attributesWithPrefix` | `attributes: EventAttributes` | A read-only Map keyed by qualified name; each value carries `name`, `localName`, `prefix`, `namespaceURI`, and `value`. |
| element `uri` | `namespaceURI` | Missing prefixes and namespace URIs are represented by an empty string. |
| `stax-xml/cursor` and platform adapter subpaths | Root reader/writer exports | Only `stax-xml` and `stax-xml/converter` are exported package paths. |

For cursor migrations, rename `getAttributeCount()` to `attributeCount()`,
`getAttributeName()` to `attributeName()`, `getAttributeLocalName()` to
`attributeLocalName()`, `getAttributePrefix()` to `attributePrefix()`,
`getAttributeValue()` to `attributeValue()`, and `uri()` to `namespaceURI()`.
The 1.0 readers additionally expose `attributeNamespaceURI()` and namespace-aware
lookup through `attributeValue(namespaceURI, localName)`.

## Parser Option Diff

Reader behavior is stricter in 1.0, but the v0 entity-policy options remain
available. Options that exposed queue implementation details were removed.

| v0.x parser option | 1.0 behavior or replacement |
| --- | --- |
| `autoDecodeEntities` | Retained; defaults to `true`. When enabled, character data and attribute values decode the five predefined entities, decimal/hexadecimal numeric references, and configured custom entities in one pass. `false` returns their original source spelling. CDATA remains literal in both modes. |
| `addEntities` | Retained as a trusted internal entity vocabulary for applications that do not want DTD processing. It applies to text and attributes; unknown entities are still rejected. The writer option with the same name remains separate. |
| `eventFilter` | Removed. Filter `EventReader` events in the consumer, or use `StreamReader` and avoid reading fields for unwanted token types. |
| `maxBufferSize`, `enableBufferCompaction`, `initialQueueCapacity` | Removed. Buffering, queueing, and compaction are internal implementation details. |
| `encoding` | Retained for byte inputs. It is passed to the host `TextDecoder`; malformed input is fatal. JavaScript string input is already decoded. |
| No v0 equivalent | `documentMode: 'fragment' | 'document'` controls single-root validation; `namespaceAware: false` opts out of namespace resolution. |

`autoDecodeEntities: false` is a lexical-value mode: returned character and
attribute values retain reference spelling, while the parser still rejects
unterminated, unknown, and invalid numeric references. Namespace bindings are
decoded internally so namespace processing remains correct. `addEntities`
provides DTD-like application definitions without interpreting the document's
DTD or performing external I/O. Definitions cannot override the five
predefined entities, are not recursively expanded, and must contain valid XML
characters.

Entity handling is illustrated by this complete example:

```ts
import { EventReaderSync, XmlEventType } from 'stax-xml';

const xml = '<mi title="&theta;">&#x398;&amp;#x398;<![CDATA[&theta;]]></mi>';
const addEntities = [{ entity: 'theta', value: 'Θ' }];

for (const event of new EventReaderSync(xml, { addEntities })) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log(event.attributes.get('title')?.value);
    // Θ
  }
  if (event.type === XmlEventType.CHARACTERS) console.log(event.value);
  // Θ&#x398; -- &amp; becomes &, but the resulting text is not decoded again
  if (event.type === XmlEventType.CDATA) console.log(event.value);
  // &theta;
}

// With autoDecodeEntities: false, text is returned as
// "&#x398;&amp;#x398;" and the title attribute is "&theta;".
```

## Event and Attribute Diff

The most common TypeScript change is attribute access:

```ts
// v0.x
for (const event of new StaxXmlParserSync(xml, {
  autoDecodeEntities: true,
  eventFilter: {
    includeAttributes: true,
    includeCharacters: true,
    includeCdata: false,
  },
})) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log(event.uri, event.attributes.title);
  }
}

// 1.0
for (const event of new EventReaderSync(xml)) {
  if (event.type === XmlEventType.CDATA) continue;
  if (event.type === XmlEventType.START_ELEMENT) {
    const title = event.attributes.get('title')?.value;
    console.log(event.namespaceURI, title);
  }
}
```

Materialized events provide O(1) qualified-name lookup, preserve source order
when iterated, and serialize attributes as a JSON object. Reserved JavaScript
keys such as `__proto__` and `constructor` are ordinary Map keys. For the lowest
allocation path, use the current-token API:

```ts
const reader = new StreamReaderSync(xml);
while (reader.next() !== null) {
  if (reader.eventType() === XmlEventType.START_ELEMENT) {
    console.log(reader.namespaceURI(), reader.attributeValue('title'));
  }
}
```

`EventReaderSync` and `EventReader` return stable objects that can be retained.
`StreamReaderSync` and `StreamReader` expose only the current token; consume its
getters before the next call to `next()`.

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
