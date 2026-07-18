---
title: Converter - Writing XML
description: Serialize JavaScript values with the v1 converter writer API
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/writing-xml.png
slug: v1.0.0/converter/writing-xml
---

Converter writing is a public v1 feature. Configure XML names with `.writer()`,
then call `.writeSync()`, `.write()`, or `.writeToStream()`.

```ts
import { x } from 'stax-xml/converter';

const catalog = x.object({
  id: x.string('./@id').writer({ asAttribute: 'id' }),
  owner: x.object({
    name: x.string('./name').writer({ element: 'name' }),
  }).writer({ element: 'owner' }),
  books: x.array(
    x.object({
      title: x.string('./title').writer({ element: 'title' }),
    }).writer({ element: 'book' }),
  ).writer({ element: 'books' }),
});

const data = {
  id: 'c1',
  owner: { name: 'Ada' },
  books: [{ title: 'One' }, { title: 'Two' }],
};

const xml = catalog.writeSync(data, {
  rootElement: 'catalog',
  includeDeclaration: false,
});
// <catalog id="c1"><owner><name>Ada</name></owner><books><book><title>One</title></book><book><title>Two</title></book></books></catalog>
```

`undefined` and `null` object fields are omitted. Attribute fields attach to the
containing object element. An element field without `element` uses its field
key. Array element schemas must name their item element for non-empty output.
`rootElement` is an optional outer wrapper; a top-level schema's own `element`
is retained inside it.

```ts
interface XmlElementWriteConfig {
  element?: string;
  asAttribute?: string;
  namespace?: { prefix?: string; uri: string };
  cdata?: boolean;
  selfClosing?: boolean;
  comment?: string;
}

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

An omitted namespace prefix declares the default namespace. Prefixed elements
and attributes declare and use their URI according to XML Namespaces rules.
Reserved bindings, undeclared prefixes, invalid NCNames, and duplicate expanded
attributes are rejected.

`cdata` applies to string scalar content. `selfClosing` emits `/>` only for an
empty configured element. String content is escaped once and all structured
writer inputs reject XML 1.0 forbidden characters.

The v1 parser and writers support XML 1.0. Reader byte input can select a
host-supported `TextDecoder` encoding. Built-in string and byte writer targets
use UTF-8; an injected `AsyncTextSink` or encoded `WriterSyncSink` can declare
its external encoding. Mismatched encodings and XML 1.1 declarations are rejected. Sync and async
converter writers have the same structure and validation semantics.

```ts
await catalog.writeToStream(data, writableStream, {
  rootElement: 'catalog',
  includeDeclaration: true,
});
```

Transform schemas are not writable because transforms are not necessarily
reversible. Number writers reject `NaN` and infinities. Low-level `writeRaw()`
accepts trusted XML only; converter scalar writers use validated character or
CDATA methods.
