---
title: Converter - XPath Guide
description: Streaming selector expressions supported by the converter
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/xpath-guide.png
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
      content: https://clickin.github.io/stax-xml/og/converter/xpath-guide.png
slug: v1.0.0/converter/xpath-guide
---

The converter accepts a deliberately small XPath-shaped selector language that
can be evaluated while XML tokens stream through the reader. It does not build a
DOM or fall back to a general XPath 1.0 tree evaluator.

## Supported Selectors

| Form | Example | Meaning |
| --- | --- | --- |
| Absolute path | `/catalog/book/title` | Match a path from the document root. |
| Leading descendant | `//book/title` | Match the path below any `book` element. `//` is supported only at the beginning. |
| Relative path | `./title` | Match below the object or array item's current element. |
| Current element | `.` | Select the current contextual element. |
| Attribute terminal | `./@id` | Read an attribute from the selected element. |
| Direct text terminal | `./text()` | Capture direct text on the selected element. |
| Positive position | `/catalog/book[2]/title` | Match one 1-based sibling position. |

```ts
import { x } from 'stax-xml/converter';

const catalog = x.object({
  books: x.array(
    x.object({
      id: x.string('./@id'),
      title: x.string('./title'),
    }),
    '/catalog/book',
  ),
});

const value = catalog.parseSync(xml);
```

Selectors are compiled and cached automatically. There is no public
`.compile()` step.

## Namespaces

Names are matched as the qualified names present in the XML stream. A selector
such as `/p:catalog/p:item` matches those exact prefixed names. The converter
does not accept a separate prefix-to-URI binding option, so changing the XML
prefix changes the selector that must be used. Unprefixed selectors match
unprefixed XML names.

## Unsupported XPath 1.0 Features

Wildcards, nested `//`, arbitrary predicates, axes, unions, variables,
operators, and XPath functions other than terminal `text()` are not part of the
public converter contract. An unsupported expression throws
`Unsupported streaming XPath` instead of materializing a document tree.

For unknown or dynamic XML, use `EventReader` / `EventReaderSync`. Use
`StreamReader` / `StreamReaderSync` when current-token traversal and lower
allocation are more important than stable event objects.

See the [conformance matrix](./xpath-1-conformance/) for the exact boundary.
