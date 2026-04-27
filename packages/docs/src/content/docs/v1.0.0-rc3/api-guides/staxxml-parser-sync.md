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
slug: v1.0.0-rc3/api-guides/staxxml-parser-sync
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

### 🛡️ Type Guard Functions

Type guard functions provide runtime type checking and TypeScript type narrowing for XML events. These functions work with both asynchronous and synchronous parsers, providing the same type safety benefits for `StaxXmlParserSync`.

#### Using Type Guards with Synchronous Parser

```typescript
import { StaxXmlParserSync, isStartElement, isEndElement, isCharacters, isError } from 'stax-xml';

const xmlContent = `
  <products>
    <product id="P001" category="electronics">
      <name>Laptop</name>
      <price>1200</price>
      <description><![CDATA[High-performance laptop for developers]]></description>
    </product>
    <product id="P002" category="accessories">
      <name>Mouse</name>
      <price>25</price>
    </product>
  </products>
`;

const parser = new StaxXmlParserSync(xmlContent);
const products = [];
let currentProduct = null;
let currentElement = '';
let textBuffer = '';

for (const event of parser) {
  // Type guards work the same way with synchronous parser
  if (isStartElement(event)) {
    currentElement = event.name;
    textBuffer = '';

    if (event.name === 'product') {
      currentProduct = {
        id: event.attributes?.id || '',
        category: event.attributes?.category || '',
        name: '',
        price: 0,
        description: ''
      };
    }
  } else if (isCharacters(event)) {
    // Type guard ensures safe access to 'value' property
    textBuffer += event.value;
  } else if (isEndElement(event)) {
    const trimmedText = textBuffer.trim();

    if (currentProduct && event.name !== 'product') {
      switch (event.name) {
        case 'name':
          currentProduct.name = trimmedText;
          break;
        case 'price':
          currentProduct.price = parseFloat(trimmedText);
          break;
        case 'description':
          currentProduct.description = trimmedText;
          break;
      }
    } else if (event.name === 'product' && currentProduct) {
      products.push(currentProduct);
      currentProduct = null;
    }

    textBuffer = '';
  } else if (isError(event)) {
    // Safe error handling with type guard
    console.error('Parse error:', event.error.message);
    break;
  }
}

console.log(products);
```

#### Synchronous Error Handling with Type Guards

```typescript
import { StaxXmlParserSync, isStartElement, isCharacters, isError } from 'stax-xml';

function parseProductsSafely(xmlString: string) {
  try {
    const parser = new StaxXmlParserSync(xmlString);
    const result = { products: [], errors: [] };

    for (const event of parser) {
      if (isError(event)) {
        // Type guard provides safe access to error details
        result.errors.push({
          message: event.error.message,
          timestamp: new Date().toISOString()
        });
        break; // Stop parsing on error
      } else if (isStartElement(event) && event.name === 'product') {
        // Type guard ensures 'attributes' property is available
        result.products.push({
          id: event.attributes?.id || 'unknown',
          category: event.attributes?.category || 'uncategorized'
        });
      }
    }

    return result;
  } catch (error) {
    return { products: [], errors: [{ message: error.message, timestamp: new Date().toISOString() }] };
  }
}

// Usage
const result = parseProductsSafely(xmlContent);
if (result.errors.length > 0) {
  console.error('Parsing errors:', result.errors);
} else {
  console.log('Parsed products:', result.products);
}
```

#### Type Guard Function Reference for Synchronous Parser

All type guard functions work identically with both `StaxXmlParser` and `StaxXmlParserSync`:

| Function | Purpose | Usage with Sync Parser |
|----------|---------|------------------------|
| `isStartDocument(event)` | Document start | Check for document beginning |
| `isEndDocument(event)` | Document end | Check for document completion |
| `isStartElement(event)` | Opening tags | Access element name and attributes safely |
| `isEndElement(event)` | Closing tags | Safely process element endings |
| `isCharacters(event)` | Text content | Safe access to text values |
| `isCdata(event)` | CDATA sections | Safe access to CDATA content |
| `isError(event)` | Parse errors | Handle parsing errors gracefully |

#### Benefits for Synchronous Parsing

1. **Consistent API**: Same type guard functions work with both async and sync parsers
2. **Type Safety**: Prevents accessing undefined properties on events
3. **Better Error Handling**: Safely distinguish between parse errors and content events
4. **Improved Maintainability**: More readable code compared to manual type checking

#### Comparison: Manual Type Checking vs Type Guards

**Manual Type Checking (Not Recommended):**
```typescript
for (const event of parser) {
  if (event.type === 'START_ELEMENT') {
    // No type safety - TypeScript doesn't know about 'attributes'
    console.log(event.attributes?.id); // Potential runtime error
  }
}
```

**Type Guards (Recommended):**
```typescript
for (const event of parser) {
  if (isStartElement(event)) {
    // Full type safety - TypeScript knows this is StartElementEvent
    console.log(event.attributes.id); // Safe access, no warnings
  }
}
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
