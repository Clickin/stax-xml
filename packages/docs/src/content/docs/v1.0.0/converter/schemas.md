---
title: Converter - Schema Types
description: Complete guide to all XML schema types in the converter API
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/schemas.png
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
      content: https://clickin.github.io/stax-xml/og/converter/schemas.png
slug: v1.0.0/converter/schemas
---

The StAX-XML converter provides four core schema types for parsing different kinds of XML data: strings, numbers, objects, and arrays.

## String Schema (`x.string()`)

Parse string values from XML elements or attributes.

### Basic Usage

```typescript
import { x } from 'stax-xml/converter';

// Parse element text content
const schema = x.string().xpath('/root/message');
const result = schema.parseSync('<root><message>Hello World</message></root>');
// "Hello World"
```

### Selecting Attributes

Use the `/@` prefix to select attribute values:

```typescript
const schema = x.string().xpath('/book/@id');
const result = schema.parseSync('<book id="123">Title</book>');
// "123"

// Descendant element with a terminal attribute
const schema = x.string().xpath('//link/@href');
const result = schema.parseSync('<a><link href="http://example.com"/></a>');
// "http://example.com"
```

### Methods

#### `.xpath(path: string)`

Set the XPath expression for element selection:

```typescript
x.string().xpath('/root/element')
x.string().xpath('//element')
x.string().xpath('//element/@attribute')
```

#### `.writer(config)`

Configure XML writing behavior:

```typescript
const schema = x.string().writer({
  element: 'message',
  cdata: true  // Wrap in CDATA section
});

const xml = schema.writeSync('Hello <World>');
// <message><![CDATA[Hello <World>]]></message>
```

### Examples

**Parse CDATA sections:**
```typescript
const xml = '<description><![CDATA[Text with <tags>]]></description>';
const schema = x.string().xpath('/description');
const result = schema.parseSync(xml);
// "Text with <tags>"
```

**Parse nested text:**
```typescript
const xml = `
  <article>
    <title>Main Title</title>
    <content>Paragraph 1. Paragraph 2.</content>
  </article>
`;

const title = x.string().xpath('/article/title').parseSync(xml);
// "Main Title"

const content = x.string().xpath('/article/content').parseSync(xml);
// "Paragraph 1. Paragraph 2."
```

**Empty string handling:**
```typescript
const schema = x.string().xpath('/missing');
const result = schema.parseSync('<root></root>');
// "" (empty string)
```

## Number Schema (`x.number()`)

Parse numeric values from XML with validation support.

### Basic Usage

```typescript
const schema = x.number().xpath('/data/count');
const result = schema.parseSync('<data><count>42</count></data>');
// 42
```

### Number Types

```typescript
// Integer
const xml = '<value>100</value>';
x.number().xpath('/value').parseSync(xml);  // 100

// Float
const xml = '<price>19.99</price>';
x.number().xpath('/price').parseSync(xml);  // 19.99

// Negative
const xml = '<temp>-15.5</temp>';
x.number().xpath('/temp').parseSync(xml);  // -15.5

// Scientific notation
const xml = '<large>1.5e10</large>';
x.number().xpath('/large').parseSync(xml);  // 15000000000
```

### Validation Methods

#### `.min(value: number)`

Set minimum value constraint:

```typescript
const schema = x.number().xpath('/age').min(18);

schema.parseSync('<age>25</age>');  // ✅ 25
schema.parseSync('<age>15</age>');  // ❌ Error: Value 15 is less than minimum 18
```

#### `.max(value: number)`

Set maximum value constraint:

```typescript
const schema = x.number().xpath('/score').max(100);

schema.parseSync('<score>85</score>');   // ✅ 85
schema.parseSync('<score>150</score>');  // ❌ Error: Value 150 is greater than maximum 100
```

#### `.int()`

Require integer values (no decimals):

```typescript
const schema = x.number().xpath('/count').int();

schema.parseSync('<count>42</count>');    // ✅ 42
schema.parseSync('<count>42.5</count>');  // ❌ Error: Expected integer, got 42.5
```

### Chaining Validations

```typescript
const ageSchema = x.number()
  .xpath('/person/age')
  .min(0)
  .max(120)
  .int();

ageSchema.parseSync('<person><age>30</age></person>');  // ✅ 30
ageSchema.parseSync('<person><age>-5</age></person>');  // ❌ Error: less than minimum
ageSchema.parseSync('<person><age>150</age></person>'); // ❌ Error: greater than maximum
ageSchema.parseSync('<person><age>25.5</age></person>');// ❌ Error: not an integer
```

### Examples

**Parse prices with validation:**
```typescript
const priceSchema = x.number().xpath('//price').min(0);

const xml = `
  <products>
    <item><name>A</name><price>19.99</price></item>
    <item><name>B</name><price>29.99</price></item>
  </products>
`;

const prices = x.array(priceSchema, '//price').parseSync(xml);
// [19.99, 29.99]
```

**ID validation:**
```typescript
const idSchema = x.number().xpath('/user/@id').int().min(1);

idSchema.parseSync('<user id="123"/>');  // ✅ 123
idSchema.parseSync('<user id="0"/>');    // ❌ Error
idSchema.parseSync('<user id="1.5"/>');  // ❌ Error
```

**NaN handling:**
```typescript
const schema = x.number().xpath('/value');
schema.parseSync('<value>not-a-number</value>');
// Throws XmlParseError (invalid_number)
```

## Object Schema (`x.object()`)

Parse structured data into typed objects.

### Basic Usage

```typescript
const bookSchema = x.object({
  title: x.string().xpath('/book/title'),
  author: x.string().xpath('/book/author'),
  year: x.number().xpath('/book/year'),
  price: x.number().xpath('/book/price')
});

const xml = `
  <book>
    <title>1984</title>
    <author>George Orwell</author>
    <year>1949</year>
    <price>15.99</price>
  </book>
`;

const book = bookSchema.parseSync(xml);
// {
//   title: "1984",
//   author: "George Orwell",
//   year: 1949,
//   price: 15.99
// }
```

### Type Inference

TypeScript automatically infers the object type:

```typescript
import { type Infer } from 'stax-xml/converter';

const schema = x.object({
  id: x.number().xpath('//id'),
  name: x.string().xpath('//name'),
  active: x.string().xpath('//active').transform(v => v === 'true')
});

type MyType = Infer<typeof schema>;
// {
//   id: number;
//   name: string;
//   active: boolean;  // Note: transform changes type
// }
```

### Nested Objects

Objects can contain other objects:

```typescript
const personSchema = x.object({
  name: x.string().xpath('/person/name'),
  address: x.object({
    street: x.string().xpath('/person/address/street'),
    city: x.string().xpath('/person/address/city'),
    zip: x.string().xpath('/person/address/zip')
  })
});

const xml = `
  <person>
    <name>John Doe</name>
    <address>
      <street>123 Main St</street>
      <city>Springfield</city>
      <zip>12345</zip>
    </address>
  </person>
`;

const person = personSchema.parseSync(xml);
// {
//   name: "John Doe",
//   address: {
//     street: "123 Main St",
//     city: "Springfield",
//     zip: "12345"
//   }
// }
```

### XPath Scoping

Use XPath on the object itself to scope child XPaths:

```typescript
// Without object XPath - absolute paths needed
const schema1 = x.object({
  cpu: x.string().xpath('/product/specs/cpu'),
  ram: x.string().xpath('/product/specs/ram')
});

// With object XPath - relative paths (cleaner)
const schema2 = x.object({
  cpu: x.string().xpath('./cpu'),
  ram: x.string().xpath('./ram')
}).xpath('/product/specs');

// Both produce the same result
```

### Mixing Fields and Objects

```typescript
const productSchema = x.object({
  id: x.number().xpath('/product/@id'),
  name: x.string().xpath('/product/name'),
  price: x.number().xpath('/product/price'),
  specs: x.object({
    weight: x.number().xpath('./weight'),
    dimensions: x.string().xpath('./dimensions')
  }).xpath('/product/specs')
});
```

### Examples

**User profile with validation:**
```typescript
const userSchema = x.object({
  id: x.number().xpath('//id').int().min(1),
  username: x.string().xpath('//username'),
  email: x.string().xpath('//email'),
  age: x.number().xpath('//age').min(13).max(120).int(),
  verified: x.string().xpath('//verified').transform(v => v === 'true')
});

type User = Infer<typeof userSchema>;
```

**Configuration object:**
```typescript
const configSchema = x.object({
  database: x.object({
    host: x.string().xpath('./host'),
    port: x.number().xpath('./port').int(),
    name: x.string().xpath('./name')
  }).xpath('/config/database'),
  cache: x.object({
    enabled: x.string().xpath('./enabled').transform(v => v === 'true'),
    ttl: x.number().xpath('./ttl').int()
  }).xpath('/config/cache')
});
```

## Array Schema (`x.array()`)

Parse repeating XML elements into arrays.

### Basic Usage

```typescript
// Array of strings
const schema = x.array(x.string(), '//item');

const xml = `
  <list>
    <item>Apple</item>
    <item>Banana</item>
    <item>Cherry</item>
  </list>
`;

const fruits = schema.parseSync(xml);
// ["Apple", "Banana", "Cherry"]
```

### XPath Requirement

**Arrays always require an XPath** to select which elements to include:

```typescript
// ❌ Error: Missing xpath
x.array(x.string());

// ✅ Correct
x.array(x.string(), '//item');
x.array(x.number(), '//value');
```

### Array of Objects

The most common use case - parsing structured repeating elements:

```typescript
const booksSchema = x.array(
  x.object({
    title: x.string().xpath('./title'),
    author: x.string().xpath('./author'),
    year: x.number().xpath('./year').int()
  }),
  '//book'
);

const xml = `
  <library>
    <book>
      <title>1984</title>
      <author>George Orwell</author>
      <year>1949</year>
    </book>
    <book>
      <title>Brave New World</title>
      <author>Aldous Huxley</author>
      <year>1932</year>
    </book>
  </library>
`;

const books = booksSchema.parseSync(xml);
// [
//   { title: "1984", author: "George Orwell", year: 1949 },
//   { title: "Brave New World", author: "Aldous Huxley", year: 1932 }
// ]

type Book = Infer<typeof booksSchema>[number];
// { title: string; author: string; year: number; }
```

### Position Predicates

The streaming subset supports positive 1-based literal positions:

```typescript
const fictionBooks = x.array(
  x.object({
    title: x.string().xpath('./title'),
    author: x.string().xpath('./author')
  }),
  '//book[2]'
);

// Wildcards and arbitrary predicates such as [@category="fiction"] are rejected.
```

### Nested Arrays

Arrays can be nested within objects:

```typescript
const catalogSchema = x.object({
  name: x.string().xpath('/catalog/name'),
  categories: x.array(
    x.object({
      name: x.string().xpath('./@name'),
      products: x.array(
        x.object({
          id: x.number().xpath('./@id'),
          name: x.string().xpath('./name'),
          price: x.number().xpath('./price')
        }),
        './product'
      )
    }),
    '//category'
  )
});
```

### Empty Arrays

Arrays return empty `[]` when no elements match:

```typescript
const schema = x.array(x.string(), '//item');
const result = schema.parseSync('<root></root>');
// []
```

### Examples

**Parse RSS feed items:**
```typescript
const rssSchema = x.object({
  title: x.string().xpath('/rss/channel/title'),
  items: x.array(
    x.object({
      title: x.string().xpath('./title'),
      link: x.string().xpath('./link'),
      description: x.string().xpath('./description'),
      pubDate: x.string().xpath('./pubDate')
    }),
    '//item'
  )
});
```

**E-commerce product list:**
```typescript
const productsSchema = x.array(
  x.object({
    id: x.number().xpath('./@id').int(),
    name: x.string().xpath('./name'),
    price: x.number().xpath('./price').min(0),
    inStock: x.string().xpath('./@inStock').transform(v => v === 'true'),
    tags: x.array(x.string(), './tag')
  }),
  '//product'
);
```

**Extract all links:**
```typescript
const linksSchema = x.array(
  x.string().xpath('./@href'),
  '//a'
);

const xml = `
  <html>
    <body>
      <a href="https://example.com">Link 1</a>
      <a href="https://test.com">Link 2</a>
    </body>
  </html>
`;

const links = linksSchema.parseSync(xml);
// ["https://example.com", "https://test.com"]
```

## Schema Comparison Table

| Feature | String | Number | Object | Array |
|---------|--------|--------|--------|-------|
| **Purpose** | Text values | Numeric values | Structured data | Repeating elements |
| **XPath** | Optional | Optional | Optional | **Required** |
| **Validation** | - | min, max, int | Per field | Per element |
| **Nesting** | - | - | Yes (objects in objects) | Yes (arrays in objects) |
| **Type Inference** | `string` | `number` | `{ ... }` | `T[]` |
| **Empty Result** | `""` | `NaN` | `{}` with NaN/empty | `[]` |
| **Transform** | ✅ | ✅ | ✅ | ✅ |
| **Optional** | ✅ | ✅ | ✅ | ✅ |
| **Writer Support** | ✅ | ✅ | ✅ | ✅ |

## Best Practices

### 1. Use Specific XPaths

```typescript
// ❌ Too broad
x.string().xpath('//name')  // Matches ALL name elements

// ✅ Specific path
x.string().xpath('/user/profile/name')
```

### 2. Validate Early

```typescript
// ✅ Add validation to catch errors early
const schema = x.object({
  age: x.number().xpath('//age').min(0).max(120).int(),
  email: x.string().xpath('//email')
});
```

### 3. Reuse Schemas

```typescript
// ✅ Define once, reuse
const priceSchema = x.number().min(0);
const idSchema = x.number().int().min(1);

const productSchema = x.object({
  id: idSchema.xpath('//id'),
  price: priceSchema.xpath('//price'),
  salePrice: priceSchema.xpath('//salePrice').optional()
});
```

### 4. Use Object XPath for Scoping

```typescript
// ✅ Cleaner with object XPath
const specs = x.object({
  cpu: x.string().xpath('./cpu'),
  ram: x.string().xpath('./ram'),
  storage: x.string().xpath('./storage')
}).xpath('/product/specs');
```

### 5. Type Your Results

```typescript
// ✅ Extract type for reuse
const userSchema = x.object({...});
type User = Infer<typeof userSchema>;

function processUsers(users: User[]) {
  // TypeScript knows the exact shape
}
```

## Next Steps

- Learn [XPath patterns](/stax-xml/converter/xpath-guide) for advanced element selection
- Explore [Transformations](/stax-xml/converter/transformations) for data processing
- See [Writing XML](/stax-xml/converter/writing-xml) for serialization
- Check [Examples](/stax-xml/converter/examples) for real-world patterns
