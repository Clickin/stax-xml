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
slug: v0.5.1/guide/quick-start
---

This guide will help you parse your first XML document with StAX-XML.

## Basic Asynchronous Parsing

Here's how to parse XML from a `ReadableStream` using the asynchronous parser:

```typescript
import { StaxXmlParser, XmlEventType } from 'stax-xml';

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
  const parser = new StaxXmlParser(stream);

  for await (const event of parser) {
    if (event.type === XmlEventType.START_ELEMENT) {
      console.log(`Start element: ${event.name}`);
      if (event.attributes) {
        console.log('Attributes:', event.attributes);
      }
    } else if (event.type === XmlEventType.CHARACTERS) {
      const text = event.text.trim();
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

For smaller XML strings, you can use the synchronous parser:

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

const xmlString = '<greeting>Hello, World!</greeting>';
const parser = new StaxXmlParserSync(xmlString);

for (const event of parser) {
  console.log(event.type, event);
}
```

## Parsing to Objects

Here's a practical example of parsing XML into JavaScript objects:

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

interface Book {
  id: string;
  title: string;
  author: string;
  price: number;
}

function parseBooks(xmlString: string): Book[] {
  const parser = new StaxXmlParserSync(xmlString);
  const books: Book[] = [];
  let currentBook: Partial<Book> = {};
  let currentElement = '';

  for (const event of parser) {
    switch (event.type) {
      case XmlEventType.START_ELEMENT:
        if (event.name === 'book') {
          currentBook = { id: event.attributes?.id || '' };
        }
        currentElement = event.name;
        break;

      case XmlEventType.CHARACTERS:
        const text = event.text.trim();
        if (text && currentBook && ['title', 'author', 'price'].includes(currentElement)) {
          if (currentElement === 'price') {
            currentBook.price = parseFloat(text);
          } else {
            (currentBook as any)[currentElement] = text;
          }
        }
        break;

      case XmlEventType.END_ELEMENT:
        if (event.name === 'book' && currentBook.id) {
          books.push(currentBook as Book);
          currentBook = {};
        }
        currentElement = '';
        break;
    }
  }

  return books;
}

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

const books = parseBooks(xmlString);
console.log(books);
// Output: [
//   { id: '1', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', price: 12.99 },
//   { id: '2', title: 'To Kill a Mockingbird', author: 'Harper Lee', price: 14.99 }
// ]
```

## Error Handling

StAX-XML provides error events for malformed XML:

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

const malformedXml = '<root><unclosed>';
const parser = new StaxXmlParserSync(malformedXml);

for (const event of parser) {
  if (event.type === XmlEventType.ERROR) {
    console.error('XML parsing error:', event.message);
    console.error('Position:', event.position);
  }
}
```

## Next Steps

- Explore more [Examples](/stax-xml/v0.5.1/guide/examples/) for advanced use cases
- See [Benchmarks](/stax-xml/v0.5.1/resources/benchmarks/) for performance comparisons