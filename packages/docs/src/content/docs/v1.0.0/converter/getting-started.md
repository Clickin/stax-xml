---
title: Converter - Getting Started
description: Learn how to use the declarative XML converter API with type-safe schemas
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/getting-started.png
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
      content: https://clickin.github.io/stax-xml/og/converter/getting-started.png
slug: v1.0.0/converter/getting-started
---

The StAX-XML Converter provides a declarative, Zod-style API for parsing XML documents with full type safety and XPath support.

## What is the Converter?

The converter is a high-level XML parsing API that allows you to:

- **Define type-safe schemas** using a fluent builder API
- **Select elements with XPath** for precise element targeting
- **Validate data** with built-in validation methods
- **Transform results** with post-processing functions
- **Infer TypeScript types** automatically from schemas

Unlike the low-level event-based `EventReader`, the converter provides a declarative way to extract structured data from XML.

:::note[Inspired by Zod]
The converter API design is heavily inspired by [Zod](https://github.com/colinhacks/zod), the popular TypeScript-first schema validation library. We adopted Zod's elegant fluent API pattern and type inference approach for XML parsing. If you're familiar with Zod, you'll feel right at home with the converter!
:::

## Installation

The converter is included in the `stax-xml` package and can be imported separately:

```typescript
import { x } from 'stax-xml/converter';
```

Or import specific types:

```typescript
import { x, type Infer, XmlParseError } from 'stax-xml/converter';
```

## Quick Example

Here's a simple example of parsing a book XML document:

```typescript
import { x, type Infer } from 'stax-xml/converter';

// Define the schema
const bookSchema = x.object({
  title: x.string().xpath('/book/title'),
  author: x.string().xpath('/book/author'),
  year: x.number().xpath('/book/year'),
  price: x.number().xpath('/book/price').min(0)
});

// Infer TypeScript type
type Book = Infer<typeof bookSchema>;
// { title: string; author: string; year: number; price: number; }

// Parse XML
const xml = `
  <book>
    <title>The Great Gatsby</title>
    <author>F. Scott Fitzgerald</author>
    <year>1925</year>
    <price>10.99</price>
  </book>
`;

const book = bookSchema.parseSync(xml);
console.log(book);
// {
//   title: "The Great Gatsby",
//   author: "F. Scott Fitzgerald",
//   year: 1925,
//   price: 10.99
// }
```

## Key Features

### Type Safety

The converter provides full TypeScript type inference. Your IDE will know exactly what shape your parsed data has:

```typescript
const schema = x.object({
  name: x.string().xpath('//name'),
  count: x.number().xpath('//count')
});

const result = schema.parseSync(xml);
// TypeScript knows: { name: string; count: number; }
```

### XPath Support

Use XPath expressions to precisely target elements in your XML:

```typescript
// Absolute paths
x.string().xpath('/root/element')

// Descendant search
x.string().xpath('//element')

// Attributes
x.string().xpath('/@id')

// Predicates
x.array(x.object({...}), '//book[@category="fiction"]')
```

### Validation

Built-in validation methods ensure your data meets requirements:

```typescript
const schema = x.object({
  age: x.number().xpath('//age').min(0).max(120).int(),
  email: x.string().xpath('//email'),
  score: x.number().xpath('//score').min(0).max(100)
});
```

### Transformations

Transform parsed data with custom functions:

```typescript
const schema = x.object({
  firstName: x.string().xpath('//firstName'),
  lastName: x.string().xpath('//lastName')
}).transform(person => ({
  fullName: `${person.firstName} ${person.lastName}`
}));

// Result: { fullName: "John Doe" }
```

### Async and Sync APIs

Both synchronous and asynchronous parsing are supported:

```typescript
// Synchronous
const result = schema.parseSync(xmlString);

// Asynchronous
const result = await schema.parse(xmlString);

// Safe parsing (returns error object instead of throwing)
const result = schema.safeParseSync(xmlString);
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.issues);
}
```

## When to Use the Converter

**Use the converter when:**
- You know the XML structure ahead of time
- You need type safety and validation
- You want a declarative API
- You need to extract structured data

**Use an event reader or current-token stream reader when:**
- You need maximum performance and control
- XML structure is dynamic or unknown
- You want event-driven processing

Choose `EventReaderSync` or `StreamReaderSync` for synchronous string/byte
input, and `EventReader` or `StreamReader` for asynchronous byte input.
- You're building streaming applications

## Schema Builder (x)

The `x` object is your entry point to the converter API. It provides factory methods for creating schemas:

- `x.string()` - Parse string values
- `x.number()` - Parse numeric values
- `x.object({})` - Parse structured objects
- `x.array()` - Parse arrays of elements

All schemas are **immutable** - methods like `.xpath()`, `.min()`, `.transform()` return new schema instances.

## Next Steps

- Learn about [Core Concepts](/stax-xml/converter/core-concepts) and schema fundamentals
- Explore [Schema Types](/stax-xml/converter/schemas) for detailed API reference
- Master [XPath](/stax-xml/converter/xpath-guide) for element selection
- See [Examples](/stax-xml/converter/examples) for real-world usage patterns

## Example: RSS Feed Parser

Here's a more complex example parsing an RSS feed:

```typescript
const rssSchema = x.object({
  title: x.string().xpath('/rss/channel/title'),
  items: x.array(
    x.object({
      title: x.string().xpath('./title'),
      link: x.string().xpath('./link'),
      pubDate: x.string().xpath('./pubDate')
    }),
    '//item'
  )
});

type RSS = Infer<typeof rssSchema>;

const rss = rssSchema.parseSync(rssXml);
console.log(`Feed: ${rss.title}`);
rss.items.forEach(item => {
  console.log(`- ${item.title}: ${item.link}`);
});
```

The converter makes XML parsing simple, type-safe, and maintainable!
