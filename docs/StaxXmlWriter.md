## StaxXmlWriter - Creating XML Documents

StAX-XML includes a powerful XML writer that allows you to generate XML documents programmatically. This writer is now fully synchronous, building the XML string in memory.

### 🔧 Quick Start

##### Writing to Local File

```typescript
import { StaxXmlWriter } from 'stax-xml';
import { writeFileSync } from 'fs'; // Use writeFileSync for synchronous writing

// For Node.js - write to a local file synchronously
function createLocalXmlFile() {
  const writer = new StaxXmlWriter({
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
import { StaxXmlWriter } from 'stax-xml';

const app = express();

// Middleware to create XML response
app.get('/api/users', (req, res) => {
  try {
    // Sample data
    const users = [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
    ];

    const writer = new StaxXmlWriter({
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

##### Hono Framework - Streaming XML Response (Conceptual Example)

*Note: Hono's streaming response typically works with ReadableStreams. Since `StaxXmlWriter` is now synchronous and returns a full string, direct streaming integration like before is not applicable. You would generate the full XML string and then send it as a response.* 

```typescript
import { Hono } from 'hono';
import { StaxXmlWriter } from 'stax-xml';

const app = new Hono();

app.get('/api/products', (c) => {
  // Sample product data
  const products = [
    { id: 'P001', name: 'Smartphone', price: 699.99, category: 'Electronics' },
    { id: 'P002', name: 'Headphones', price: 199.99, category: 'Electronics' },
    { id: 'P003', name: 'Coffee Maker', price: 149.99, category: 'Appliances' }
  ];

  const writer = new StaxXmlWriter({
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

##### Advanced Writer Features

```typescript
import { StaxXmlWriter } from 'stax-xml';

// Create in-memory XML with custom entities and namespaces
function createAdvancedXml() {
  const writer = new StaxXmlWriter({
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
  writer.writeCDATA('<p>This is <b>HTML</b> content in CDATA</p>');
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

##### New Unified WriteElementOptions API

StaxXmlWriter now supports a new unified API that simplifies element creation by consolidating all options into a single `WriteElementOptions` object:

```typescript
import { StaxXmlWriter, WriteElementOptions } from 'stax-xml';

function createXmlWithNewAPI() {
  const writer = new StaxXmlWriter({ prettyPrint: true });

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

**Key Benefits of the New API:**

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
class StaxXmlWriter {
  constructor(
    options?: StaxXmlWriterOptions
  )

  // Document Level Methods
  writeStartDocument(version?: string, encoding?: string): this
  writeEndDocument(): void

  // Element Writing Methods
  writeStartElement(localName: string, options?: WriteElementOptions): this
  writeEndElement(): this

  // Attribute and Namespace Methods
  writeAttribute(localName: string, value: string, prefix?: string, uri?: string): this
  writeNamespace(prefix: string, uri: string): this

  // Content Writing Methods
  writeCharacters(text: string): this
  writeCDATA(cdata: string): this
  writeComment(comment: string): this
  writeProcessingInstruction(target: string, data?: string): this

  // Utility Methods
  setPrettyPrint(enabled: boolean): this
  setIndentString(indentString: string): this
  isPrettyPrintEnabled(): boolean
  getIndentString(): string
}

interface StaxXmlWriterOptions {
  encoding?: string; // Default: 'utf-8'
  prettyPrint?: boolean; // Default: false
  indentString?: string; // Default: '  '
  addEntities?: { entity: string, value: string }[];
  autoEncodeEntities?: boolean; // Default: true
  namespaces?: NamespaceDeclaration[];
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
