---
title: Converter - Writing XML
description: Serialize JavaScript values with the public converter writer API
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/writing-xml.png
slug: v1.1.0/converter/writing-xml
---

Converter schemas are bidirectional where a parsed value has an unambiguous XML
representation. Configure element and attribute names with `.writer()`, then use
`.writeSync()`, `.write()`, or `.writeToStream()`.

## Object output

```ts
import { x } from 'stax-xml/converter';

const book = x.object({
  id: x.string('./@id').writer({ asAttribute: 'id' }),
  title: x.string('./title').writer({ element: 'title' }),
  price: x.number('./price').writer({ element: 'price' }),
  note: x.string('./note').optional().writer({ element: 'note' }),
});

const xml = book.writeSync(
  { id: 'b1', title: 'XML & Streams', price: 29.5, note: undefined },
  { rootElement: 'book', includeDeclaration: false },
);
// <book id="b1"><title>XML &amp; Streams</title><price>29.5</price></book>
```

`undefined` and `null` object fields are omitted. Attribute fields are written
on the containing object element. If an element field omits `element`, its
object key is used as the element name.

## Nested objects and arrays

```ts
const catalog = x.object({
  owner: x.object({
    name: x.string('./name').writer({ element: 'name' }),
  }).writer({ element: 'owner' }),
  books: x.array(
    x.object({
      title: x.string('./title').writer({ element: 'title' }),
    }).writer({ element: 'book' }),
  ).writer({ element: 'books' }),
});

const xml = await catalog.write(
  { owner: { name: 'Ada' }, books: [{ title: 'One' }, { title: 'Two' }] },
  { rootElement: 'catalog', includeDeclaration: false },
);
// <catalog><owner><name>Ada</name></owner><books><book><title>One</title></book><book><title>Two</title></book></books></catalog>
```

The array schema's `element` names the collection element when the array is an
object field. The array's element schema must provide its item element name.
Non-empty arrays without an item element name are rejected.

`rootElement` is an optional outer wrapper. A top-level schema configured with
its own `element` keeps that element inside the wrapper; omit `rootElement` to
use the schema element itself as the document element.

## Writer configuration

```ts
interface XmlElementWriteConfig {
  element?: string;
  asAttribute?: string;
  namespace?: {
    prefix?: string;
    uri: string;
  };
  cdata?: boolean;
  selfClosing?: boolean;
  comment?: string;
}
```

- `element` names an element. Object fields may use the field key instead.
- `asAttribute` writes the field on its containing object element.
- `namespace` declares a namespace using XML Namespaces rules. An omitted
  prefix declares the default namespace.
- `cdata` writes scalar string content as CDATA. Content containing `]]>` is
  rejected.
- `selfClosing` emits `/>` only when the configured element is empty.
- `comment` writes a validated XML comment before the element.

```ts
const value = x.string().writer({
  element: 'value',
  namespace: { prefix: 'm', uri: 'urn:metrics' },
});

value.writeSync('42', { rootElement: 'root', includeDeclaration: false });
// <root><m:value xmlns:m="urn:metrics">42</m:value></root>
```

Namespace prefixes and local names are validated as XML NCNames. Reserved
`xml` / `xmlns` bindings, undeclared prefixes, and duplicate expanded
attributes are rejected.

## Output options

```ts
interface XmlWriteOptions {
  prettyPrint?: boolean;
  indentString?: string;
  encoding?: 'utf-8' | 'UTF-8';
  rootElement?: string;
  includeDeclaration?: boolean;
  xmlVersion?: '1.0';
  writer?: WriterSync | WriterSyncSink | Writer;
}
```

The v1 parser and writers implement XML 1.0. Reader byte input can select a
host-supported `TextDecoder` encoding. Built-in string and byte writer targets
use UTF-8; an injected `AsyncTextSink` or encoded `WriterSyncSink` can declare
its external encoding. Mismatched encodings and XML 1.1 declarations are rejected.
Element text, attributes, comments, CDATA, namespace URIs, and
processing-instruction data reject characters forbidden by XML 1.0.

Synchronous and asynchronous converter writers have the same output semantics:

```ts
const options = { rootElement: 'book', includeDeclaration: false } as const;
const syncXml = book.writeSync(data, options);
const asyncXml = await book.write(data, options);
// syncXml === asyncXml
```

For large output, stream directly instead of collecting a string:

```ts
await catalog.writeToStream(data, writableStream, {
  rootElement: 'catalog',
  includeDeclaration: true,
});
```

## Unsupported output

- Transform schemas cannot be written because a transform is not necessarily
  reversible; write with the underlying schema or define an explicit inverse.
- `NaN` and infinities are rejected by number writers.
- Attribute fields require a containing object element.
- `writeRaw()` belongs to the low-level writers and accepts trusted XML only;
  converter scalar writers use validated character or CDATA methods.

See [Schema Types](./schemas/) for parsing and [Writer](../api-guides/writer/)
for the lower-level streaming writer.
