---
title: StaxXmlParserSync - Synchronous XML Parsing
description: High-performance synchronous XML parser for JavaScript/TypeScript
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/api-guides/staxxml-parser-sync.png
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
      content: https://clickin.github.io/stax-xml/og/api-guides/staxxml-parser-sync.png
---

## StaxXmlParserSync - Synchronous XML Parsing

`StaxXmlParserSync` is a high-performance, pull-based XML parser for JavaScript/TypeScript designed for synchronous processing of XML strings. It is ideal for environments where the entire XML document is already in memory, such as in web servers handling small to medium-sized XML payloads. It avoids the overhead of asynchronous streams.

### 🔧 Quick Start

#### Parsing XML String

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

const xmlContent = `
  <catalog>
    <product id="P001">
      <name>Laptop</name>
      <price>1200</price>
    </product>
    <product id="P002">
      <name>Mouse</name>
      <price>25</price>
    </product>
  </catalog>
`;

const parser = new StaxXmlParserSync(xmlContent);
const products = [];
let currentProduct = null;
let currentText = '';

for (const event of parser) { // Use for...of for synchronous iteration
  switch (event.type) {
    case XmlEventType.START_ELEMENT:
      if (event.name === 'product') {
        currentProduct = { id: event.attributes?.id || '', name: '', price: 0 };
      } else if (event.name === 'name' || event.name === 'price') {
        currentText = ''; // Reset text buffer for new element
      }
      break;
      
    case XmlEventType.CHARACTERS:
      currentText += event.value; // Use event.value for synchronous parser
      break;
      
    case XmlEventType.END_ELEMENT:
      if (currentProduct) {
        if (event.name === 'name') {
          currentProduct.name = currentText.trim();
        } else if (event.name === 'price') {
          currentProduct.price = parseFloat(currentText.trim());
        } else if (event.name === 'product') {
          products.push(currentProduct);
          currentProduct = null;
        }
      }
      break;
  }
}

console.log(products);
// Output: [
//   { id: "P001", name: "Laptop", price: 1200 },
//   { id: "P002", name: "Mouse", price: 25 }
// ]
```

### 📚 API Reference

```typescript
class StaxXmlParserSync {
  constructor(
    xmlString: string,
    options?: StaxXmlParserSyncOptions
  )
}

interface StaxXmlParserSyncOptions {
  autoDecodeEntities?: boolean; // Default: true
  addEntities?: { entity: string, value: string }[];
}
```
