---
title: StaxXmlWriter - Asynchronous XML Stream Writer
description: Stream-based asynchronous XML writer for large documents and real-time generation
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/api-guides/staxxml-writer.png
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
      content: https://clickin.github.io/stax-xml/og/api-guides/staxxml-writer.png
slug: v0.5.0/api-guides/staxxml-writer
---

## StaxXmlWriter - Asynchronous XML Stream Writer

`StaxXmlWriter` is an asynchronous, stream-based XML writer designed for large documents and memory-efficient processing. It writes XML data directly to a WritableStream, making it ideal for streaming responses and real-time XML generation.

### Key Features

- **Stream-Based**: Writes directly to WritableStream for memory efficiency
- **Asynchronous**: All methods return promises for non-blocking operations
- **Large Document Support**: Handles arbitrarily large XML documents
- **Memory Efficient**: No need to store entire XML in memory
- **Real-time Generation**: Perfect for streaming APIs and live data

> **Note**: For synchronous, in-memory XML generation, see [StaxXmlWriterSync](/stax-xml/v0.5.0/api-guides/staxxml-writer-sync/) which builds XML as a string.

### 🔧 Quick Start

```typescript
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { StaxXmlWriter } from 'stax-xml';

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
    const writer = new StaxXmlWriter(stream, {
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
import { StaxXmlWriter } from 'stax-xml';

const app = new Hono();

app.get('/api/catalog', (c) => {
  const items = [
    { id: '001', name: 'Premium Laptop', featured: true },
    { id: '002', name: 'Wireless Mouse', featured: false }
  ];

  c.header('Content-Type', 'application/xml; charset=utf-8');

  return stream(c, async (stream) => {
    const writer = new StaxXmlWriter(stream, {
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
      await writer.writeNamespace('meta', 'http://example.com/metadata');

      await writer.writeStartElement('header', { prefix: 'meta' });
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

`StaxXmlWriter` supports a unified API that simplifies element creation:

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

#### StaxXmlWriter (Asynchronous, Stream-Based)

```typescript
class StaxXmlWriter {
  // Constructor - for streaming XML directly to WritableStream
  constructor(stream: WritableStream<Uint8Array>, options?: StaxXmlWriterOptions)

  // Document Level Methods
  writeStartDocument(version?: string, encoding?: string): Promise<this>
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

interface StaxXmlWriterOptions {
  encoding?: string; // Default: 'utf-8'
  prettyPrint?: boolean; // Default: false
  indentString?: string; // Default: '  '
  addEntities?: { entity: string, value: string }[];
  autoEncodeEntities?: boolean; // Default: true
  namespaces?: NamespaceDeclaration[];
  bufferSize?: number; // Default: 16384
  highWaterMark?: number; // Default: 65536
  flushThreshold?: number; // Default: 0.8
  enableAutoFlush?: boolean; // Default: true
}
```

#### Interfaces

```typescript
interface WriteElementOptions {
  prefix?: string;
  uri?: string;
  attributes?: Record<string, string | AttributeInfo>;
  selfClosing?: boolean;
}

interface AttributeInfo {
  value: string;
  localName: string;
  prefix?: string;
  uri?: string;
}

interface NamespaceDeclaration {
  prefix?: string;
  uri: string;
}
```

### 🚀 When to Use StaxXmlWriter

**Use StaxXmlWriter when:**
- Building large XML documents (> 100MB)
- Streaming XML to clients in real-time
- Memory efficiency is critical
- Working with asynchronous/streaming architectures
- Processing data that doesn't fit in memory
- Building APIs that need to stream responses
- Real-time XML generation from live data sources

**For small documents or synchronous operations**, consider [StaxXmlWriterSync](/api-guides/staxxml-writer-sync/) which builds XML in memory as a string.