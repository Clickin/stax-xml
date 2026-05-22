---
title: Quick Start
description: Get up and running with StAX-XML in minutes
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/guide/quick-start.png
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
      content: https://clickin.github.io/stax-xml/og/guide/quick-start.png
slug: v1.0.0/guide/quick-start
---

This guide will help you parse your first XML document with StAX-XML.

**ESM-only package:** All examples use `import` syntax because `require('stax-xml')` is not supported.

## Basic Asynchronous Parsing

Here's how to parse XML from a `ReadableStream` using the asynchronous event reader:

```typescript
import { EventReader, XmlEventType } from 'stax-xml';

const xmlContent = `
<bookstore>
  <book id="1">
    <title>The Great Gatsby</title>
    <author>F. Scott Fitzgerald</author>
    <price>12.99</price>
  </book>
  <book id="2">
    <title>To Kill a Mockingbird</title>
    <author>Harper Lee</author>
    <price>14.99</price>
  </book>
</bookstore>
`;

// Create a ReadableStream from the XML string
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlContent));
    controller.close();
  }
});

async function parseBooks() {
  const reader = new EventReader(stream);

  for await (const event of reader) {
    if (event.type === XmlEventType.START_ELEMENT) {
      console.log(`Start element: ${event.name}`);
      if (event.attributes) {
        console.log('Attributes:', event.attributes);
      }
    } else if (event.type === XmlEventType.CHARACTERS) {
      const text = event.value.trim();
      if (text) {
        console.log(`Text: ${text}`);
      }
    } else if (event.type === XmlEventType.END_ELEMENT) {
      console.log(`End element: ${event.name}`);
    }
  }
}

parseBooks();
```

## Basic Synchronous Parsing

For smaller XML strings, you can use the synchronous event reader:

```typescript
import { EventReaderSync, XmlEventType } from 'stax-xml';

const xmlString = '<greeting>Hello, World!</greeting>';
const reader = new EventReaderSync(xmlString);

for (const event of reader) {
  console.log(event.type, event);
}
```

## Parsing Unknown XML

```typescript
import { parseXmlObjectSync, parseXmlTreeSync } from 'stax-xml';

const xmlString = `
<bookstore>
  <book id="1">
    <title>The Great Gatsby</title>
    <author>F. Scott Fitzgerald</author>
    <price>12.99</price>
  </book>
  <book id="2">
    <title>To Kill a Mockingbird</title>
    <author>Harper Lee</author>
    <price>14.99</price>
  </book>
</bookstore>
`;

const tree = parseXmlTreeSync(xmlString);
console.log(tree.children[0]);

const object = parseXmlObjectSync(xmlString);
console.log(object.bookstore);
// {
//   book: [
//     { '@id': '1', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', price: '12.99' },
//     { '@id': '2', title: 'To Kill a Mockingbird', author: 'Harper Lee', price: '14.99' }
//   ]
// }
```

Use `parseXmlTreeSync()` when element order and mixed content matter. Use `parseXmlObjectSync()` when you want a compact object shape with attributes under `@id`-style keys. For typed domain objects, use the converter API or a custom event loop.

## Error Handling

StAX-XML provides error events for malformed XML:

```typescript
import { EventReaderSync, XmlEventType } from 'stax-xml';

const malformedXml = '<root><unclosed>';
const reader = new EventReaderSync(malformedXml);

for (const event of reader) {
  if (event.type === XmlEventType.ERROR) {
    console.error('XML parsing error:', event.error.message);
  }
}
```

## Next Steps

- Explore more [Examples](/stax-xml/guide/examples/) for advanced use cases
- See [Benchmarks](/stax-xml/resources/benchmarks/) for performance comparisons
