---
title: Examples
description: Real-world examples and usage patterns for StAX-XML
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/guide/examples.png
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
      content: https://clickin.github.io/stax-xml/og/guide/examples.png
---

This page contains practical examples showing how to use StAX-XML for various XML processing scenarios.

## Namespace Handling

Parse XML documents with namespace declarations:

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

const xmlWithNamespaces = `
<root xmlns:book="http://example.com/book" xmlns="http://example.com/default">
  <book:library>
    <book:book id="1">
      <title>XML Processing</title>
    </book:book>
  </book:library>
</root>
`;

const parser = new StaxXmlParserSync(xmlWithNamespaces);

for (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log(`Element: ${event.name}`);
    console.log(`Namespace URI: ${event.namespaceURI || 'default'}`);
    console.log(`Local name: ${event.localName}`);
    if (event.prefix) {
      console.log(`Prefix: ${event.prefix}`);
    }
  }
}
```

## Processing Large Files with Async Parser

Use `StaxXmlParser` when file or network I/O should remain async. The API is async end to end, while the parser backend consumes received byte batches synchronously.

```typescript
import { StaxXmlParser, XmlEventType } from 'stax-xml';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';

async function processLargeXml(filePath: string) {
  const fileStream = createReadStream(filePath, { highWaterMark: 1024 * 1024 });
  const webStream = Readable.toWeb(fileStream) as ReadableStream<Uint8Array>;
  const parser = new StaxXmlParser(webStream);
  let elementCount = 0;

  for await (const event of parser) {
    if (event.type === XmlEventType.START_ELEMENT) {
      elementCount++;
      if (elementCount % 1000 === 0) {
        console.log(`Processed ${elementCount} elements...`);
      }
    }
  }

  console.log(`Total elements processed: ${elementCount}`);
}
```

When file I/O should be async but the parse itself can run synchronously after chunks are available, pass the byte chunks to the iterable parser:

```typescript
import { open } from 'node:fs/promises';
import { IterableEventType, StaxXmlIterableParser, toByteBatches } from 'stax-xml/iterable';

async function processLargeXmlWithSyncIterable(filePath: string) {
  const file = await open(filePath, 'r');
  const chunks: Uint8Array[] = [];

  try {
    for await (const chunk of file.createReadStream({ highWaterMark: 1024 * 1024 })) {
      chunks.push(chunk);
    }
  } finally {
    await file.close();
  }

  const parser = new StaxXmlIterableParser(toByteBatches(chunks, { batchSize: 8 }));
  let elementCount = 0;

  while (parser.nextBatch()) {
    for (let index = 0; index < parser.eventCount(); index++) {
      if (parser.eventType(index) === IterableEventType.START_ELEMENT) {
        elementCount++;
        console.log(parser.copyName(index));
      }
    }
  }

  console.log(`Total elements processed: ${elementCount}`);
}
```

The iterable path avoids one full XML string, but it blocks the current worker/thread during the parse loop. For Node-only batch jobs that can also block file I/O, use `nodeFileByteBatchesSync()` and `StaxXmlNodeIterableParser()` from `stax-xml/iterable/node`.

## XML Generation with Writer

Create small XML documents in memory with `StaxXmlWriterSync`. For large file output, use `StaxXmlWriterSyncSink` as described in the writer sync guide.

```typescript
import { StaxXmlWriterSync } from 'stax-xml';

function generateBookCatalog() {
  const writer = new StaxXmlWriterSync();

  writer.writeStartDocument();
  writer.writeStartElement('catalog');
  writer.writeAttribute('version', '1.0');

  const books = [
    { id: '1', title: 'JavaScript Guide', author: 'John Doe', price: 29.99 },
    { id: '2', title: 'TypeScript Handbook', author: 'Jane Smith', price: 34.99 }
  ];

  for (const book of books) {
    writer.writeStartElement('book');
    writer.writeAttribute('id', book.id);

    writer.writeStartElement('title');
    writer.writeCharacters(book.title);
    writer.writeEndElement();

    writer.writeStartElement('author');
    writer.writeCharacters(book.author);
    writer.writeEndElement();

    writer.writeStartElement('price');
    writer.writeCharacters(book.price.toString());
    writer.writeEndElement();

    writer.writeEndElement(); // book
  }

  writer.writeEndElement(); // catalog
  writer.writeEndDocument();

  return writer.getXmlString();
}
```

## Self-Closing Tags

Handle self-closing XML elements:

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

const xmlWithSelfClosing = `
<document>
  <header>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width"/>
  </header>
  <body>
    <img src="image.jpg" alt="Description"/>
    <br/>
    <input type="text" name="username"/>
  </body>
</document>
`;

const parser = new StaxXmlParserSync(xmlWithSelfClosing);

for (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log(`Start: ${event.name}`);
    if (event.attributes) {
      console.log('Attributes:', event.attributes);
    }
  } else if (event.type === XmlEventType.END_ELEMENT) {
    console.log(`End: ${event.name}`);
  }
}
```

## Attribute Processing

Extract and process XML attributes:

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

const xmlWithAttributes = `
<products>
  <product id="p1" category="electronics" price="299.99" inStock="true">
    <name>Smartphone</name>
  </product>
  <product id="p2" category="books" price="24.99" inStock="false">
    <name>Programming Guide</name>
  </product>
</products>
`;

interface Product {
  id: string;
  category: string;
  price: number;
  inStock: boolean;
  name?: string;
}

function parseProducts(xml: string): Product[] {
  const parser = new StaxXmlParserSync(xml);
  const products: Product[] = [];
  let currentProduct: Partial<Product> = {};
  let currentElement = '';

  for (const event of parser) {
    switch (event.type) {
      case XmlEventType.START_ELEMENT:
        if (event.name === 'product' && event.attributes) {
          currentProduct = {
            id: event.attributes.id,
            category: event.attributes.category,
            price: parseFloat(event.attributes.price),
            inStock: event.attributes.inStock === 'true'
          };
        }
        currentElement = event.name;
        break;

      case XmlEventType.CHARACTERS:
        if (currentElement === 'name' && event.text.trim()) {
          currentProduct.name = event.text.trim();
        }
        break;

      case XmlEventType.END_ELEMENT:
        if (event.name === 'product') {
          products.push(currentProduct as Product);
          currentProduct = {};
        }
        currentElement = '';
        break;
    }
  }

  return products;
}

const products = parseProducts(xmlWithAttributes);
console.log(products);
```

## Error Handling and Validation

Implement robust error handling:

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

function parseWithErrorHandling(xmlString: string) {
  const parser = new StaxXmlParserSync(xmlString);
  const errors: string[] = [];
  let isValid = true;

  try {
    for (const event of parser) {
      if (event.type === XmlEventType.ERROR) {
        isValid = false;
        errors.push(`Error at position ${event.position}: ${event.message}`);
      } else if (event.type === XmlEventType.START_ELEMENT) {
        console.log(`Processing element: ${event.name}`);
      }
    }
  } catch (error) {
    isValid = false;
    errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    isValid,
    errors
  };
}

// Test with malformed XML
const malformedXml = `
<root>
  <unclosed>
  <duplicate attr="1" attr="2">content</duplicate>
</root>
`;

const result = parseWithErrorHandling(malformedXml);
if (!result.isValid) {
  console.error('XML validation failed:', result.errors);
}
```

## Converting Between Formats

Transform XML to JSON:

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

function xmlToJson(xmlString: string): any {
  const parser = new StaxXmlParserSync(xmlString);
  const stack: any[] = [];
  let result: any = null;

  for (const event of parser) {
    switch (event.type) {
      case XmlEventType.START_ELEMENT:
        const element: any = {};

        if (event.attributes) {
          element['@attributes'] = event.attributes;
        }

        if (stack.length === 0) {
          result = { [event.name]: element };
          stack.push(result[event.name]);
        } else {
          const parent = stack[stack.length - 1];
          if (!parent[event.name]) {
            parent[event.name] = element;
          } else if (Array.isArray(parent[event.name])) {
            parent[event.name].push(element);
          } else {
            parent[event.name] = [parent[event.name], element];
          }
          stack.push(element);
        }
        break;

      case XmlEventType.CHARACTERS:
        const text = event.text.trim();
        if (text && stack.length > 0) {
          const current = stack[stack.length - 1];
          if (typeof current === 'object' && !current['#text']) {
            current['#text'] = text;
          }
        }
        break;

      case XmlEventType.END_ELEMENT:
        stack.pop();
        break;
    }
  }

  return result;
}

const xmlData = `
<library>
  <book id="1">
    <title>The Great Gatsby</title>
    <author>F. Scott Fitzgerald</author>
  </book>
  <book id="2">
    <title>1984</title>
    <author>George Orwell</author>
  </book>
</library>
`;

const jsonResult = xmlToJson(xmlData);
console.log(JSON.stringify(jsonResult, null, 2));
```

## Performance Tips

Optimize parsing for high-performance scenarios:

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

// Pre-compile frequently used patterns
const ELEMENT_NAMES = new Set(['book', 'title', 'author', 'price']);
const TARGET_ELEMENTS = ['title', 'author', 'price'];

function optimizedParsing(xmlString: string) {
  const parser = new StaxXmlParserSync(xmlString);
  const results: any[] = [];
  let currentBook: any = null;
  let currentElement = '';

  for (const event of parser) {
    switch (event.type) {
      case XmlEventType.START_ELEMENT:
        // Use Set for O(1) lookup instead of array includes
        if (ELEMENT_NAMES.has(event.name)) {
          if (event.name === 'book') {
            currentBook = { id: event.attributes?.id };
          }
          currentElement = event.name;
        }
        break;

      case XmlEventType.CHARACTERS:
        // Only process if we're in a target element and have text
        if (currentBook && TARGET_ELEMENTS.includes(currentElement)) {
          const text = event.text.trim();
          if (text) {
            currentBook[currentElement] = text;
          }
        }
        break;

      case XmlEventType.END_ELEMENT:
        if (event.name === 'book' && currentBook) {
          results.push(currentBook);
          currentBook = null;
        }
        currentElement = '';
        break;
    }
  }

  return results;
}
```

## Next Steps

- See [Performance Benchmarks](/stax-xml/resources/benchmarks/) for comparison data
- Visit our [FAQ](/stax-xml/resources/faq/) for troubleshooting help
