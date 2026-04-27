---
title: StaxXmlWriterSync - Synchronous XML Generation
description: Synchronous XML writer for generating XML documents programmatically with in-memory string building
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/api-guides/staxxml-writer-sync.png
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
      content: https://clickin.github.io/stax-xml/og/api-guides/staxxml-writer-sync.png
slug: v1.0.0-rc1/api-guides/staxxml-writer-sync
---

## StaxXmlWriterSync - Synchronous XML Generation

StAX-XML includes a synchronous XML writer that generates XML documents programmatically. `StaxXmlWriterSync` builds the XML string in memory for small and medium documents, while `StaxXmlWriterSyncSink` writes incrementally to a sink for large documents.

For large file output, prefer the sink path. The 1GiB writer benchmark shows `StaxXmlWriterSyncSink` has the best write throughput while peak RSS stays in the same range as async writing.

### 🔧 Quick Start

##### Writing to Local File

```typescript
import { StaxXmlWriterSync } from 'stax-xml';
import { writeFileSync } from 'fs';

// For Node.js - write to a local file synchronously
function createLocalXmlFile() {
  const writer = new StaxXmlWriterSync({
    prettyPrint: true,
    indentString: '  '
  });

  // Write XML document
  writer.writeStartDocument('1.0', 'utf-8');

  writer.writeStartElement('catalog', { attributes: { version: '1.0' } });

  writer.writeStartElement('product', { attributes: { id: '001' } });

  writer.writeStartElement('name');
  writer.writeCharacters('Laptop Computer');
  writer.writeEndElement();

  writer.writeStartElement('price', { attributes: { currency: 'USD' } });
  writer.writeCharacters('999.99');
  writer.writeEndElement();

  writer.writeEndElement(); // product
  writer.writeEndElement(); // catalog

  writer.writeEndDocument();

  // Get the final XML string and write to file
  writeFileSync('./output.xml', writer.getXmlString());
  console.log('XML file created successfully!');
}

createLocalXmlFile();
```

##### Express.js Middleware - XML Response

```typescript
import express from 'express';
import { StaxXmlWriterSync } from 'stax-xml';

const app = express();

// Middleware to create XML response
app.get('/api/users', (req, res) => {
  try {
    // Sample data
    const users = [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
    ];

    const writer = new StaxXmlWriterSync({
      prettyPrint: true,
      indentString: '  '
    });

    // Set appropriate headers
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    // Write XML
    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('users');

    for (const user of users) {
      writer.writeStartElement('user', { attributes: { id: user.id.toString() } });

      writer.writeStartElement('name');
      writer.writeCharacters(user.name);
      writer.writeEndElement();

      writer.writeStartElement('email');
      writer.writeCharacters(user.email);
      writer.writeEndElement();

      writer.writeEndElement(); // user
    }

    writer.writeEndElement(); // users
    writer.writeEndDocument();

    // Send the final XML string
    res.send(writer.getXmlString());

  } catch (error) {
    res.status(500).json({ error: 'Failed to generate XML' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

##### Hono Framework - XML Response

```typescript
import { Hono } from 'hono';
import { StaxXmlWriterSync } from 'stax-xml';

const app = new Hono();

app.get('/api/products', (c) => {
  // Sample product data
  const products = [
    { id: 'P001', name: 'Smartphone', price: 699.99, category: 'Electronics' },
    { id: 'P002', name: 'Headphones', price: 199.99, category: 'Electronics' },
    { id: 'P003', name: 'Coffee Maker', price: 149.99, category: 'Appliances' }
  ];

  const writer = new StaxXmlWriterSync({
    prettyPrint: true,
    indentString: '    '
  });

  try {
    // Generate XML
    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('products', {
      attributes: {
        count: products.length.toString(),
        generated: new Date().toISOString()
      }
    });

    for (const product of products) {
      writer.writeStartElement('product', {
        attributes: {
          id: product.id,
          category: product.category
        }
      });

      writer.writeStartElement('name');
      writer.writeCharacters(product.name);
      writer.writeEndElement();

      writer.writeStartElement('price', { attributes: { currency: 'USD' } });
      writer.writeCharacters(product.price.toString());
      writer.writeEndElement();

      writer.writeEndElement(); // product
    }

    writer.writeEndElement(); // products
    writer.writeEndDocument();

    // Return the generated XML string as a Response
    return c.text(writer.getXmlString(), 200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-cache',
    });

  } catch (error) {
    return c.text('Failed to generate XML', 500);
  }
});

export default app;
```

##### Sink-Based Incremental Writing

`StaxXmlWriterSync` can write directly to any custom sync target through `StaxXmlWriterSyncSink`. Use this path for large XML output.
Use runtime-specific adapters for Node.js, Bun, or Deno so the browser-compatible default import stays unchanged.

```typescript
import { openSync } from 'fs';
import { StaxXmlWriterSyncSink } from 'stax-xml';
import { createNodeFileSyncTextSink } from 'stax-xml/adapters/node';
import { createBunSyncTextSink } from 'stax-xml/adapters/bun';
import { createDenoSyncTextSink } from 'stax-xml/adapters/deno';

const fd = openSync('./catalog.xml', 'w');
const writer = new StaxXmlWriterSyncSink(
  createNodeFileSyncTextSink(fd),
  {
    bufferSize: 4096,
    enableAutoFlush: true,
    flushThreshold: 0.7
  }
);

writer.writeStartDocument('1.0', 'utf-8');
writer.writeStartElement('catalog', { attributes: { version: '1.0' } });
writer.writeStartElement('product', { attributes: { id: '001' } });
writer.writeStartElement('name');
writer.writeCharacters('Laptop Computer');
writer.writeEndElement();
writer.writeEndElement(); // product
writer.writeEndElement(); // catalog
writer.writeEndDocument();
writer.flush();     // manual flush (optional when auto-flush is enabled)
writer.close();     // flush + close adapter target

// Bun example:
// const bunWriter = new StaxXmlWriterSyncSink(createBunSyncTextSink(Bun.stdout));
// Deno example:
// const denoWriter = new StaxXmlWriterSyncSink(createDenoSyncTextSink(Deno.stdout));
```

`writer.flush()` drains buffered chunks and calls `sink.flush()` when available.
`writer.close()` finalizes the document if needed, optionally calls `sink.flush()`, and closes the underlying target.

##### Advanced Writer Features

```typescript
import { StaxXmlWriterSync } from 'stax-xml';

// Create in-memory XML with custom entities and namespaces
function createAdvancedXml() {
  const writer = new StaxXmlWriterSync({
    prettyPrint: true,
    indentString: '  ',
    addEntities: [
      { entity: 'company', value: 'Acme Corporation' },
      { entity: 'copyright', value: '© 2024' }
    ],
    autoEncodeEntities: true
  });

  // Write XML with namespaces and custom entities
  writer.writeStartDocument('1.0', 'utf-8');

  writer.writeStartElement('document', {
    prefix: 'doc',
    uri: 'http://example.com/document',
    attributes: { version: '2.0' }
  });
  writer.writeNamespace('meta', 'http://example.com/metadata');

  writer.writeStartElement('header', { prefix: 'meta' });
  writer.writeStartElement('title');
  writer.writeCharacters('Product Catalog');
  writer.writeEndElement();

  writer.writeStartElement('company');
  writer.writeCharacters('&company;'); // Will be encoded automatically
  writer.writeEndElement();
  writer.writeEndElement(); // header

  writer.writeStartElement('content');
  writer.writeStartElement('item', { attributes: { type: 'featured' } });

  // Self-closing element
  writer.writeStartElement('thumbnail', {
    attributes: {
      src: 'image.jpg',
      alt: 'Product Image'
    },
    selfClosing: true
  });

  writer.writeStartElement('description');
  writer.writeCData('<p>This is <b>HTML</b> content in CDATA</p>');
  writer.writeEndElement();

  writer.writeEndElement(); // item
  writer.writeEndElement(); // content
  writer.writeEndElement(); // document

  writer.writeEndDocument();

  return writer.getXmlString();
}

// Usage
console.log('Generated XML:', createAdvancedXml());
```

##### Unified WriteElementOptions API

StaxXmlWriterSync supports a unified API that simplifies element creation by consolidating all options into a single `WriteElementOptions` object:

```typescript
import { StaxXmlWriterSync, WriteElementOptions } from 'stax-xml';

function createXmlWithNewAPI() {
  const writer = new StaxXmlWriterSync({ prettyPrint: true });

  writer.writeStartDocument();

  // Basic element with attributes
  writer.writeStartElement('catalog', {
    attributes: { version: '2.0', xmlns: 'http://example.com/catalog' }
  });

  // Element with namespace and attributes
  writer.writeStartElement('product', {
    prefix: 'cat',
    uri: 'http://example.com/catalog',
    attributes: { id: '001', featured: 'true' }
  });

  writer.writeStartElement('name');
  writer.writeCharacters('Premium Laptop');
  writer.writeEndElement();

  // Self-closing element with attributes
  writer.writeStartElement('thumbnail', {
    attributes: {
      src: 'image.jpg',
      alt: 'Product Image',
      width: '200'
    },
    selfClosing: true  // No need to call writeEndElement()
  });

  // Simple self-closing element
  writer.writeStartElement('br', { selfClosing: true });

  writer.writeEndElement(); // product
  writer.writeEndElement(); // catalog

  writer.writeEndDocument();
  return writer.getXmlString();
}

// Output:
// <?xml version="1.0" encoding="UTF-8"?>
// <catalog version="2.0" xmlns="http://example.com/catalog">
//   <cat:product id="001" featured="true" xmlns:cat="http://example.com/catalog">
//     <name>Premium Laptop</name>
//     <thumbnail src="image.jpg" alt="Product Image" width="200"/>
//     <br/>
//   </cat:product>
// </catalog>
```

**Key Benefits of the Unified API:**

- **Unified Parameters**: All element options (attributes, namespace, self-closing) are consolidated into a single options object
- **Self-Closing Support**: Set `selfClosing: true` to automatically close elements without calling `writeEndElement()`
- **Cleaner Syntax**: More intuitive and readable code structure
- **Type Safety**: Full TypeScript support with comprehensive type definitions

**Usage Examples:**

```typescript
// Simple element with attributes
writer.writeStartElement('img', {
  attributes: {
    src: 'image.jpg',
    alt: 'Image'
  },
  selfClosing: true
});

// Element with namespace
writer.writeStartElement('title', {
  prefix: 'html',
  uri: 'http://www.w3.org/1999/xhtml',
  attributes: { lang: 'en' }
});
```

### 📚 API Reference

```typescript
class StaxXmlWriterSync {
  constructor(
    options?: StaxXmlWriterSyncOptions
  )

  // Document Level Methods
  writeStartDocument(version?: string, encoding?: string): this
  writeEndDocument(): void

  // Element Writing Methods
  writeStartElement(localName: string, options?: WriteElementOptions): this
  writeEndElement(): this

  // Attribute and Namespace Methods
  writeAttribute(localName: string, value: string, prefix?: string): this
  writeNamespace(prefix: string, uri: string): this

  // Content Writing Methods
  writeCharacters(text: string): this
  writeCData(cdata: string): this
  writeComment(comment: string): this
  writeProcessingInstruction(target: string, data?: string): this

  // Utility Methods
  setPrettyPrint(enabled: boolean): this
  setIndentString(indentString: string): this
  isPrettyPrintEnabled(): boolean
  getIndentString(): string
  getXmlString(): string
}

interface StaxXmlWriterSyncOptions {
  encoding?: string; // Default: 'utf-8'
  prettyPrint?: boolean; // Default: false
  indentString?: string; // Default: '  '
  addEntities?: { entity: string, value: string }[];
  autoEncodeEntities?: boolean; // Default: true
  namespaces?: NamespaceDeclaration[];
}

interface SyncTextSink {
  write(chunk: string): void;
  flush?(): void;
  close?(): void;
}

interface StaxXmlWriterSyncSinkOptions extends StaxXmlWriterSyncOptions {
  bufferSize?: number;       // default: 16 * 1024
  enableAutoFlush?: boolean; // default: true
  flushThreshold?: number;   // default: 0.8 or absolute char count
  flushOnClose?: boolean;    // default: false
}

class StaxXmlWriterSyncSink {
  constructor(
    sink: SyncTextSink,
    options?: StaxXmlWriterSyncSinkOptions
  )

  // Document Level Methods
  flush(): void
  close(): void
}

interface XmlAttribute {
  localName: string;
  value: string;
  prefix?: string;
  uri?: string;
}

interface NamespaceDeclaration {
  prefix?: string;
  uri: string;
}
```

### 🚀 Key Features

- **Synchronous Operation**: Builds XML string in memory for immediate access
- **High Performance**: Optimized for smaller to medium-sized documents
- **Pretty Printing**: Configurable indentation and formatting
- **Namespace Support**: Full XML namespace handling with prefix management
- **Entity Encoding**: Automatic or custom entity encoding
- **Self-Closing Elements**: Built-in support for self-closing tags
- **Type Safety**: Complete TypeScript support with detailed type definitions
- **Memory Efficient**: Direct string building without streaming overhead

### 💡 When to Use StaxXmlWriterSync

Use `StaxXmlWriterSync` when:
- You need the complete XML document in memory immediately
- Working with smaller to medium-sized XML documents
- Building XML responses for web APIs
- Generating configuration files or data exports
- Working in synchronous workflows where blocking is acceptable
- Memory usage is not a primary concern

For large documents or streaming scenarios, consider using the async `StaxXmlWriter` instead.
