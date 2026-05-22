---
title: EventReader - Asynchronous XML Parsing
description: High-performance asynchronous XML parser for JavaScript/TypeScript
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/api-guides/event-reader.png
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
      content: https://clickin.github.io/stax-xml/og/api-guides/event-reader.png
slug: v1.0.0/api-guides/event-reader
---

## EventReader - Asynchronous XML Parsing

`EventReader` is a high-performance, pull-based XML parser for JavaScript/TypeScript inspired by Java's StAX (Streaming API for XML). Its public API is asynchronous for stream and backpressure integration, while tokenization consumes received byte batches synchronously.

### 🔧 Quick Start

#### Parsing XML String

```typescript
import { EventReader, XmlEventType } from 'stax-xml';

// Create a ReadableStream from XML string
const xmlContent = `
  <books>
    <book id="1">
      <title>The Great Gatsby</title>
      <author>F. Scott Fitzgerald</author>
    </book>
    <book id="2">
      <title>To Kill a Mockingbird</title>
      <author>Harper Lee</author>
    </book>
  </books>
`;

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlContent));
    controller.close();
  }
});

// Parse XML with pull-based approach
const parser = new EventReader(stream);
const books = [];
let currentBook = null;
let currentText = '';

for await (const event of parser) {
  switch (event.type) {
    case XmlEventType.START_ELEMENT:
      if (event.name === 'book') {
        currentBook = { id: event.attributes?.id || '', title: '', author: '' };
      }
      currentText = '';
      break;

    case XmlEventType.CHARACTERS:
      currentText += event.value;
      break;

    case XmlEventType.END_ELEMENT:
      if (currentBook) {
        if (event.name === 'title') {
          currentBook.title = currentText.trim();
        } else if (event.name === 'author') {
          currentBook.author = currentText.trim();
        } else if (event.name === 'book') {
          books.push(currentBook);
          currentBook = null;
        }
      }
      break;
  }
}

console.log(books);
// Output: [
//   { id: "1", title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
//   { id: "2", title: "To Kill a Mockingbird", author: "Harper Lee" }
// ]
```


#### Parsing XML String with more structured syntax
```typescript
import { EventReader, isCharacters, isEndDocument, isEndElement, isStartElement } from 'stax-xml';


// Create a ReadableStream from XML string
const xmlContent = `
  <books>
    <book id="1">
      <title>The Great Gatsby</title>
      <author>F. Scott Fitzgerald</author>
    </book>
    <book id="2">
      <title>To Kill a Mockingbird</title>
      <author>Harper Lee</author>
    </book>
  </books>
`;
interface Book {
  id: string
  title: string
  author: string
}

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlContent));
    controller.close();
  }
});

// Parse XML with pull-based approach
const parser = new EventReader(stream);
const books: Book[] = [];

for await (const event of parser) {
  if (isEndDocument(event)) {
    break;
  }
  if (isStartElement(event) && event.name === 'book') {
    books.push(await parseBook(event.attributes?.id || '', parser));
  }
}

/**
 * parse Each book
 */
async function parseBook(id: string, parser: EventReader): Promise<Book> {
  const currentBook = {
    id: id,
    title: '',
    author: ''
  };
  for await (const event of parser) {
    if (isEndElement(event) && event.name === 'book') {
      break;
    }
    else if (isStartElement(event)) {
      const charEvent = (await parser.next()).value;
      if (isCharacters(charEvent) && event.name === 'title') {
        currentBook.title = charEvent.value;
      }
      else if (isCharacters(charEvent) && event.name === 'author') {
        currentBook.author = charEvent.value;
      }
    }
  }
  return currentBook;
}
console.log(books);
// Output: [
//   { id: "1", title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
//   { id: "2", title: "To Kill a Mockingbird", author: "Harper Lee" }
// ]
```

#### Parsing Remote XML with Fetch

```typescript
import { EventReader, XmlEventType } from 'stax-xml';

async function parseRemoteXml(url: string) {
  try {
    // Fetch XML from remote URL
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get the response body as a ReadableStream
    const xmlStream = response.body;

    if (!xmlStream) {
      throw new Error('No response body');
    }

    // Parse the XML stream directly
    const parser = new EventReader(xmlStream);
    const results = [];
    let currentItem = {};
    let currentText = '';

    for await (const event of parser) {
      switch (event.type) {
        case XmlEventType.START_ELEMENT:
          if (event.name === 'item') {
            currentItem = {};
          }
          currentText = '';
          break;

        case XmlEventType.CHARACTERS:
          currentText += event.value;
          break;

        case XmlEventType.END_ELEMENT:
          if (event.name === 'title' || event.name === 'description') {
            currentItem[event.name] = currentText.trim();
          } else if (event.name === 'item') {
            results.push(currentItem);
          }
          break;
      }
    }

    return results;
  } catch (error) {
    console.error('Error parsing remote XML:', error);
    throw error;
  }
}

// Usage examples
const rssUrl = 'https://example.com/feed.xml';
const xmlApiUrl = 'https://api.example.com/data.xml';

// Parse RSS feed
parseRemoteXml(rssUrl)
  .then(items => {
    console.log('RSS items:', items);
  })
  .catch(error => {
    console.error('Failed to parse RSS:', error);
  });

// Parse API response
parseRemoteXml(xmlApiUrl)
  .then(data => {
    console.log('API data:', data);
  })
  .catch(error => {
    console.error('Failed to parse API response:', error);
  });
```

#### Custom Entity Support

```typescript
const parser = new EventReader(stream, {
  addEntities: [
    { entity: 'custom', value: 'Custom Value' },
    { entity: 'special', value: '★' }
  ]
});
```

#### While-Based Iterator Pattern (StAX-like)

```typescript
import { EventReader, XmlEventType, isStartElement, isEndElement } from 'stax-xml';

// XML data with nested structure
const xmlContent = `
  <catalog>
    <products>
      <product id="1" category="electronics">
        <name>Laptop</name>
        <price currency="USD">999.99</price>
        <specifications>
          <cpu>Intel i7</cpu>
          <memory>16GB</memory>
          <storage>512GB SSD</storage>
        </specifications>
      </product>
      <product id="2" category="books">
        <name>JavaScript Guide</name>
        <price currency="USD">29.99</price>
        <author>John Doe</author>
      </product>
    </products>
  </catalog>
`;

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlContent));
    controller.close();
  }
});

// Main parsing function using while-based iteration
async function parseCatalog(xmlStream: ReadableStream<Uint8Array>) {
  const parser = new EventReader(xmlStream);
  const catalog = { products: [] };

  const iterator = parser[Symbol.asyncIterator]();
  let result = await iterator.next();

  while (!result.done) {
    const event = result.value;

    if (isStartElement(event) && event.name === 'products') {
      await parseProducts(iterator, catalog);
    }

    result = await iterator.next();
  }

  return catalog;
}

// Separate parsing function for products
async function parseProducts(iterator: AsyncIterator<any>, catalog: any) {
  let result = await iterator.next();

  while (!result.done) {
    const event = result.value;

    if (isStartElement(event) && event.name === 'product') {
      const product = await parseProduct(iterator, event);
      catalog.products.push(product);
    } else if (isEndElement(event) && event.name === 'products') {
      break;
    }

    result = await iterator.next();
  }
}

// Separate parsing function for individual product
async function parseProduct(iterator: AsyncIterator<any>, startEvent: any) {
  const product = {
    id: startEvent.attributes?.id || '',
    category: startEvent.attributes?.category || '',
    name: '',
    price: { amount: '', currency: '' },
    specifications: {},
    author: ''
  };

  let result = await iterator.next();
  let currentText = '';

  while (!result.done) {
    const event = result.value;

    switch (event.type) {
      case XmlEventType.START_ELEMENT:
        currentText = '';
        if (event.name === 'price') {
          product.price.currency = event.attributes?.currency || '';
        } else if (event.name === 'specifications') {
          await parseSpecifications(iterator, product);
        }
        break;

      case XmlEventType.CHARACTERS:
        currentText += event.value;
        break;

      case XmlEventType.END_ELEMENT:
        if (event.name === 'name') {
          product.name = currentText.trim();
        } else if (event.name === 'price') {
          product.price.amount = currentText.trim();
        } else if (event.name === 'author') {
          product.author = currentText.trim();
        } else if (event.name === 'product') {
          return product;
        }
        break;
    }

    result = await iterator.next();
  }

  return product;
}

// Separate parsing function for specifications
async function parseSpecifications(iterator: AsyncIterator<any>, product: any) {
  let result = await iterator.next();
  let currentText = '';

  while (!result.done) {
    const event = result.value;

    switch (event.type) {
      case XmlEventType.START_ELEMENT:
        currentText = '';
        break;

      case XmlEventType.CHARACTERS:
        currentText += event.value;
        break;

      case XmlEventType.END_ELEMENT:
        if (event.name === 'specifications') {
          return;
        } else if (event.name === 'cpu' || event.name === 'memory' || event.name === 'storage') {
          product.specifications[event.name] = currentText.trim();
        }
        break;
    }

    result = await iterator.next();
  }
}

// Usage
parseCatalog(stream).then(result => {
  console.log(JSON.stringify(result, null, 2));
  // Output:
  // {
  //   "products": [
  //     {
  //       "id": "1",
  //       "category": "electronics",
  //       "name": "Laptop",
  //       "price": { "amount": "999.99", "currency": "USD" },
  //       "specifications": {
  //         "cpu": "Intel i7",
  //         "memory": "16GB",
  //         "storage": "512GB SSD"
  //       },
  //       "author": ""
  //     },
  //     {
  //       "id": "2",
  //       "category": "books",
  //       "name": "JavaScript Guide",
  //       "price": { "amount": "29.99", "currency": "USD" },
  //       "specifications": {},
  //       "author": "John Doe"
  //     }
  //   ]
  // }
});
```

#### Large File Processing

```typescript
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { EventReader, XmlEventType } from 'stax-xml';

const nodeStream = createReadStream('./large.xml', { highWaterMark: 1024 * 1024 });
const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
const parser = new EventReader(webStream);

for await (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    processElement(event.name, event.attributes);
  }
}
```

This path keeps stream backpressure at the API boundary. `EventReader` reads the next `ReadableStream` chunk only when the consumer asks for more events or batches. Internally, each received byte batch is handed to the tokenizer synchronously, so very large parse bursts can still occupy the current worker while that batch is processed.

For latency-sensitive main-thread work, keep batches bounded or offload parsing to a Web Worker or Node worker thread. For batch jobs, the synchronous iterable parser can also consume byte chunks directly, which avoids forcing a full XML string before parsing.

#### Unknown XML Tree and Object Helpers

When you do not have a predefined converter schema and just want to inspect an XML document, use the tree/object helpers from the main package:

```typescript
import { parseXmlObjectSync, parseXmlTreeSync } from 'stax-xml';

const xml = '<book id="1"><title>StAX</title><tag>fast</tag><tag>xml</tag></book>';

const tree = parseXmlTreeSync(xml);
console.log(tree.children[0]);

const object = parseXmlObjectSync(xml);
console.log(object.book);
// {
//   '@id': '1',
//   title: 'StAX',
//   tag: ['fast', 'xml']
// }
```

`parseXmlTree()` / `parseXmlTreeSync()` return an order-preserving tree similar in spirit to Python's ElementTree. `parseXmlObject()` / `parseXmlObjectSync()` return a compact object shape with attributes under the `@` prefix, text under `#text`, and CDATA under `#cdata`. The object helpers materialize the full result, so use the event, stream, or converter APIs when you need streaming projection over unbounded input.

#### Namespace Handling

```typescript
// XML with namespaces
const xmlWithNamespaces = `
  <root xmlns:ns="http://example.com/namespace">
    <ns:element>Content</ns:element>
  </root>
`;

for await (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log('Element:', event.name);
    console.log('Local name:', event.localName);
    console.log('Namespace URI:', event.uri);
    console.log('Prefix:', event.prefix);
  }
}
```

### 🎯 Event Types

- `START_DOCUMENT`: Beginning of XML document
- `END_DOCUMENT`: End of XML document
- `START_ELEMENT`: Opening XML tag
- `END_ELEMENT`: Closing XML tag
- `CHARACTERS`: Text content between tags
- `CDATA`: CDATA section content
- `ERROR`: Parse error occurred

### 🛡️ Type Guard Functions

Type guard functions provide runtime type checking and TypeScript type narrowing for XML events. These functions are essential for writing type-safe code when working with XML events, as they allow TypeScript to properly infer the specific event type and provide access to type-specific properties.

#### What are Type Guards?

Type guards are functions that perform runtime checks to determine the type of a value, while also providing TypeScript with type information. In the context of stax-xml, type guards help you safely access event-specific properties without type errors.

#### Available Type Guard Functions

```typescript
import {
  isStartDocument,
  isEndDocument,
  isStartElement,
  isEndElement,
  isCharacters,
  isCdata,
  isError
} from 'stax-xml';
```

#### Benefits of Using Type Guards

1. **Type Safety**: Prevents runtime errors by ensuring you only access properties that exist on specific event types
2. **IntelliSense Support**: Better IDE autocomplete and suggestions
3. **Cleaner Code**: More readable than manual type checking with `event.type === XmlEventType.START_ELEMENT`
4. **Type Narrowing**: TypeScript automatically narrows the type, giving you access to type-specific properties

#### Basic Usage Example

```typescript
import { EventReader, isStartElement, isEndElement, isCharacters } from 'stax-xml';

const xmlContent = `
  <book id="123">
    <title>TypeScript Guide</title>
    <author>John Doe</author>
  </book>
`;

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlContent));
    controller.close();
  }
});

const parser = new EventReader(stream);

for await (const event of parser) {
  // Type guard provides type safety and narrowing
  if (isStartElement(event)) {
    // TypeScript knows this is a StartElementEvent
    console.log('Element:', event.name);
    console.log('Attributes:', event.attributes);
    // event.attributes is safely accessible here
  } else if (isCharacters(event)) {
    // TypeScript knows this is a CharactersEvent
    console.log('Text content:', event.value);
    // event.value is safely accessible here
  } else if (isEndElement(event)) {
    // TypeScript knows this is an EndElementEvent
    console.log('Closing element:', event.name);
    // event.name is safely accessible here
  }
}
```

#### Advanced Usage with Error Handling

```typescript
import { EventReader, isStartElement, isCharacters, isError } from 'stax-xml';

async function parseWithErrorHandling(xmlStream: ReadableStream<Uint8Array>) {
  const parser = new EventReader(xmlStream);
  const result = { elements: [], errors: [] };

  for await (const event of parser) {
    if (isError(event)) {
      // Handle parsing errors safely
      console.error('Parse error:', event.error.message);
      result.errors.push(event.error);
      break; // Stop parsing on error
    } else if (isStartElement(event)) {
      result.elements.push({
        name: event.name,
        attributes: event.attributes
      });
    }
  }

  return result;
}
```

#### Type Guard Function Reference

| Function | Purpose | Returns True For | Available Properties |
|----------|---------|------------------|---------------------|
| `isStartDocument(event)` | Document start | `START_DOCUMENT` events | `type` |
| `isEndDocument(event)` | Document end | `END_DOCUMENT` events | `type` |
| `isStartElement(event)` | Opening tags | `START_ELEMENT` events | `type`, `name`, `localName`, `prefix`, `uri`, `attributes`, `attributesWithPrefix` |
| `isEndElement(event)` | Closing tags | `END_ELEMENT` events | `type`, `name`, `localName`, `prefix`, `uri` |
| `isCharacters(event)` | Text content | `CHARACTERS` events | `type`, `value` |
| `isCdata(event)` | CDATA sections | `CDATA` events | `type`, `value` |
| `isError(event)` | Parse errors | `ERROR` events | `type`, `error` |

#### Complex Parsing Example with Multiple Type Guards

```typescript
import {
  EventReader,
  isStartDocument,
  isEndDocument,
  isStartElement,
  isEndElement,
  isCharacters,
  isCdata,
  isError
} from 'stax-xml';

interface Article {
  title: string;
  content: string;
  author: string;
  publishDate: string;
}

async function parseArticles(xmlStream: ReadableStream<Uint8Array>): Promise<Article[]> {
  const parser = new EventReader(xmlStream);
  const articles: Article[] = [];
  let currentArticle: Partial<Article> | null = null;
  let currentElement = '';
  let textBuffer = '';

  for await (const event of parser) {
    if (isStartDocument(event)) {
      console.log('Starting document parsing...');
    } else if (isEndDocument(event)) {
      console.log('Finished parsing document');
      break;
    } else if (isError(event)) {
      throw new Error(`Parsing failed: ${event.error.message}`);
    } else if (isStartElement(event)) {
      currentElement = event.name;
      textBuffer = '';

      if (event.name === 'article') {
        currentArticle = {
          title: '',
          content: '',
          author: '',
          publishDate: event.attributes?.publishDate || ''
        };
      }
    } else if (isCharacters(event) || isCdata(event)) {
      // Both CHARACTERS and CDATA events have a 'value' property
      textBuffer += event.value;
    } else if (isEndElement(event)) {
      const trimmedText = textBuffer.trim();

      if (currentArticle && event.name !== 'article') {
        switch (event.name) {
          case 'title':
            currentArticle.title = trimmedText;
            break;
          case 'content':
            currentArticle.content = trimmedText;
            break;
          case 'author':
            currentArticle.author = trimmedText;
            break;
        }
      } else if (event.name === 'article' && currentArticle) {
        // Ensure all required fields are present
        if (currentArticle.title && currentArticle.content && currentArticle.author) {
          articles.push(currentArticle as Article);
        }
        currentArticle = null;
      }

      textBuffer = '';
      currentElement = '';
    }
  }

  return articles;
}

// Usage example
const articleXml = `
  <articles>
    <article publishDate="2024-01-15">
      <title>Understanding Type Guards</title>
      <author>Jane Smith</author>
      <content><![CDATA[Type guards are essential for type-safe TypeScript development...]]></content>
    </article>
    <article publishDate="2024-01-20">
      <title>XML Parsing Best Practices</title>
      <author>Bob Johnson</author>
      <content>When parsing XML, always handle errors gracefully...</content>
    </article>
  </articles>
`;

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(articleXml));
    controller.close();
  }
});

parseArticles(stream).then(articles => {
  console.log('Parsed articles:', articles);
}).catch(error => {
  console.error('Parsing failed:', error);
});
```

#### Comparison: With and Without Type Guards

**Without Type Guards (Error-Prone):**
```typescript
for await (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    // TypeScript doesn't know event has 'attributes' property
    // This could cause runtime errors
    console.log(event.attributes?.id); // TypeScript warning
  }
}
```

**With Type Guards (Type-Safe):**
```typescript
for await (const event of parser) {
  if (isStartElement(event)) {
    // TypeScript knows event is StartElementEvent
    // Full IntelliSense support and type safety
    console.log(event.attributes.id); // No TypeScript warnings
  }
}
```

### 📚 API Reference

```typescript
class EventReader {
  constructor(
    xmlStream: ReadableStream<Uint8Array>,
    options?: EventReaderOptions
  )
}

interface EventReaderOptions {
  encoding?: string; // Default: 'utf-8'
  addEntities?: { entity: string, value: string }[];
  autoDecodeEntities?: boolean; // Default: true
  maxBufferSize?: number; // Default: 64KB
  enableBufferCompaction?: boolean; // Default: true
}
```
