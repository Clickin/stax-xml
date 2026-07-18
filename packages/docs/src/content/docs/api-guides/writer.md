---
title: Writer - Asynchronous XML Stream Writer
description: Stream-based asynchronous XML writer for large documents and real-time generation
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/api-guides/writer.png
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
      content: https://clickin.github.io/stax-xml/og/api-guides/writer.png
---

## Writer - Asynchronous XML Stream Writer

`Writer` is an asynchronous, stream-based XML writer for non-blocking `WritableStream` workflows, streaming responses, and real-time XML generation.

For large file or large document output where maximum write throughput matters, prefer [`WriterSyncSink`](/stax-xml/api-guides/writer-sync/#sink-based-incremental-writing). The 1GiB writer benchmark shows the sync sink path has the best write throughput while peak RSS stays in the same range as async writing.

### Key Features

- **Stream-Based**: Writes directly to WritableStream for memory efficiency
- **Asynchronous**: All methods return promises for non-blocking operations
- **Large Document Support**: Handles arbitrarily large XML documents when an async stream architecture is required
- **Memory Efficient**: No need to store entire XML in memory
- **Real-time Generation**: Perfect for streaming APIs and live data

> **Note**: For small synchronous output, use `WriterSync` as a string builder. For large file output, use `WriterSyncSink`.

### External encoders

The default `WritableStream<Uint8Array>` path emits UTF-8. To chain a streaming
encoder such as `iconv-lite`, pass an `AsyncTextSink` instead. Its `encoding`
is written to the XML declaration, and `write()` promises provide backpressure.
An explicit declaration encoding that does not match the sink is rejected.

```typescript
import iconv from 'iconv-lite';
import { createWriteStream } from 'node:fs';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Writer, type AsyncTextSink } from 'stax-xml';

const encoder = iconv.encodeStream('shift_jis');
const completed = pipeline(encoder, createWriteStream('./catalog.xml'));
const output = Writable.toWeb(encoder).getWriter();
const sink: AsyncTextSink = {
  encoding: 'Shift_JIS',
  write: chunk => output.write(chunk),
  close: () => output.close(),
};

const writer = new Writer(sink);
await writer.writeStartDocument();
await writer.writeStartElement('catalog');
await writer.writeCharacters('日本語');
await writer.close();
await completed;
```

### 🔧 Quick Start

```typescript
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { Writer } from 'stax-xml';

const app = new Hono();

app.get('/api/products', (c) => {
  // Sample product data
  const products = [
    { id: 'P001', name: 'Smartphone', price: 699.99, category: 'Electronics' },
    { id: 'P002', name: 'Headphones', price: 199.99, category: 'Electronics' },
    { id: 'P003', name: 'Coffee Maker', price: 149.99, category: 'Appliances' }
  ];

  // Set appropriate headers
  c.header('Content-Type', 'application/xml; charset=utf-8');
  c.header('Cache-Control', 'no-cache');

  return stream(c, async (stream) => {
    const writer = new Writer(stream, {
      prettyPrint: true,
      indentString: '    '
    });

    try {
      // Generate XML directly to stream - all methods need await
      await writer.writeStartDocument('1.0', 'utf-8');
      await writer.writeStartElement('products', {
        attributes: {
          count: products.length.toString(),
          generated: new Date().toISOString()
        }
      });

      for (const product of products) {
        await writer.writeStartElement('product', {
          attributes: {
            id: product.id,
            category: product.category
          }
        });

        await writer.writeStartElement('name');
        await writer.writeCharacters(product.name);
        await writer.writeEndElement();

        await writer.writeStartElement('price', { attributes: { currency: 'USD' } });
        await writer.writeCharacters(product.price.toString());
        await writer.writeEndElement();

        await writer.writeEndElement(); // product
      }

      await writer.writeEndElement(); // products
      await writer.writeEndDocument();
      await writer.close(); // Important: close the stream

    } catch (error) {
      console.error('XML generation error:', error);
      // Note: Error handling in streaming context is limited
    }
  });
});

export default app;
```

##### Advanced Features with Namespaces and Custom Entities

```typescript
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { Writer } from 'stax-xml';

const app = new Hono();

app.get('/api/catalog', (c) => {
  const items = [
    { id: '001', name: 'Premium Laptop', featured: true },
    { id: '002', name: 'Wireless Mouse', featured: false }
  ];

  c.header('Content-Type', 'application/xml; charset=utf-8');

  return stream(c, async (stream) => {
    const writer = new Writer(stream, {
      prettyPrint: true,
      indentString: '  ',
      addEntities: [
        { entity: 'company', value: 'Acme Corporation' },
        { entity: 'copyright', value: '© 2024' }
      ],
      autoEncodeEntities: true
    });

    try {
      // Write XML with namespaces and custom entities
      await writer.writeStartDocument('1.0', 'utf-8');

      await writer.writeStartElement('catalog', {
        prefix: 'cat',
        uri: 'http://example.com/catalog',
        attributes: { version: '2.0' }
      });
      await writer.writeStartElement('header', {
        prefix: 'meta',
        uri: 'http://example.com/metadata'
      });
      await writer.writeStartElement('title');
      await writer.writeCharacters('Product Catalog');
      await writer.writeEndElement();

      await writer.writeStartElement('company');
      await writer.writeCharacters('&company;'); // Will be encoded automatically
      await writer.writeEndElement();
      await writer.writeEndElement(); // header

      await writer.writeStartElement('products');
      for (const item of items) {
        await writer.writeStartElement('product', {
          attributes: { id: item.id, featured: item.featured.toString() }
        });

        await writer.writeStartElement('name');
        await writer.writeCharacters(item.name);
        await writer.writeEndElement();

        // Self-closing element
        await writer.writeStartElement('thumbnail', {
          attributes: {
            src: `${item.id}.jpg`,
            alt: 'Product Image'
          },
          selfClosing: true
        });

        await writer.writeStartElement('description');
        await writer.writeCData('<p>This is <b>HTML</b> content in CDATA</p>');
        await writer.writeEndElement();

        await writer.writeEndElement(); // product
      }
      await writer.writeEndElement(); // products
      await writer.writeEndElement(); // catalog

      await writer.writeEndDocument();
      await writer.close();

    } catch (error) {
      console.error('XML generation error:', error);
    }
  });
});

export default app;
```

##### WriteElementOptions API

`Writer` supports a unified API that simplifies element creation:

```typescript
// Self-closing element with attributes
await writer.writeStartElement('img', {
  attributes: {
    src: 'image.jpg',
    alt: 'Image'
  },
  selfClosing: true  // No need to call writeEndElement()
});

// Element with namespace
await writer.writeStartElement('title', {
  prefix: 'html',
  uri: 'http://www.w3.org/1999/xhtml',
  attributes: { lang: 'en' }
});
```

### 📚 API Reference

#### Writer (Asynchronous, Stream-Based)

```typescript
class Writer {
  // Constructor - for streaming XML directly to WritableStream
  constructor(stream: WritableStream<Uint8Array>, options?: WriterOptions)

  // Document Level Methods
  writeStartDocument(version?: '1.0', encoding?: string): Promise<this> // UTF-8 only
  writeEndDocument(): Promise<void>

  // Element Writing Methods
  writeStartElement(localName: string, options?: WriteElementOptions): Promise<this>
  writeEndElement(): Promise<this>

  // Content Writing Methods
  writeCharacters(text: string): Promise<this>
  writeCData(cdata: string): Promise<this>
  writeComment(comment: string): Promise<this>

  // Stream Management
  close(): Promise<void>  // Closes the underlying stream
  flush(): Promise<void>  // Manual flush
  getMetrics(): object    // Performance metrics
}

interface WriterOptions {
  encoding?: string; // Default: 'utf-8'; other encodings are rejected
  prettyPrint?: boolean; // Default: false
  indentString?: string; // Default: '  '
  addEntities?: { entity: string, value: string }[];
  autoEncodeEntities?: boolean; // Default: true
  bufferSize?: number; // Default: 16384
  flushThreshold?: number; // Default: 0.8
  enableAutoFlush?: boolean; // Default: true
}
```

`Writer` always emits UTF-8 bytes because the web platform `TextEncoder` is
UTF-8-only. The constructor and `writeStartDocument()` reject any other
encoding instead of writing bytes that disagree with the XML declaration.
The declaration version is XML 1.0; XML 1.1 is rejected because the parser and
writer validation contract is XML 1.0.

#### Interfaces

```typescript
interface WriteElementOptions {
  prefix?: string;
  uri?: string;
  attributes?: Record<string, string | AttributeInfo>;
  selfClosing?: boolean;
  comment?: string;
}

interface AttributeInfo {
  value: string;
  prefix?: string;
  uri?: string;
}

```

The record key is the attribute local name. A namespaced attribute supplies its
prefix and may supply its URI to declare the binding on that element.

### 🚀 When to Use Writer

**Use Writer when:**
- Streaming XML to clients in real-time
- Memory efficiency is critical
- Working with asynchronous/streaming architectures
- Processing data that doesn't fit in memory
- Building APIs that need to stream responses
- Real-time XML generation from live data sources

**For large file generation**, prefer [WriterSyncSink](/api-guides/writer-sync/#sink-based-incremental-writing). **For small documents or synchronous operations**, use [WriterSync](/api-guides/writer-sync/) as an in-memory string builder.
