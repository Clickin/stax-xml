---
title: Converter - Core Concepts
description: Understand the fundamental concepts of the declarative XML converter
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/core-concepts.png
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
      content: https://clickin.github.io/stax-xml/og/converter/core-concepts.png
---

This guide covers the fundamental concepts you need to understand to use the StAX-XML converter effectively.

## Schema Builder (`x`)

The `x` object is the primary interface for creating XML schemas. It provides factory methods for all schema types:

```typescript
import { x } from 'stax-xml/converter';

// Create schemas
const stringSchema = x.string();
const numberSchema = x.number();
const objectSchema = x.object({...});
const arraySchema = x.array(elementSchema, xpath);
```

### Fluent API Pattern

All schema methods return **new schema instances**, making the API immutable and chainable:

```typescript
const schema = x.number()
  .xpath('//price')
  .min(0)
  .max(1000);

// Each method returns a new schema
const baseNumber = x.number();
const withXPath = baseNumber.xpath('//value');  // New instance
const withMin = withXPath.min(0);               // New instance

// Original remains unchanged
console.log(baseNumber.options.xpath);  // undefined
console.log(withXPath.options.xpath);   // '//value'
```

This immutability ensures schemas are **reusable** and **composable**:

```typescript
// Base price schema
const priceSchema = x.number().min(0);

// Reuse with different XPath
const retailPrice = priceSchema.xpath('//retailPrice');
const wholesalePrice = priceSchema.xpath('//wholesalePrice');
```

## Parsing Modes

The converter provides multiple parsing methods for different use cases:

### Synchronous Parsing

Use `parseSync()` for synchronous, blocking parsing:

```typescript
const schema = x.string().xpath('//title');
const result = schema.parseSync(xmlString);
// Returns: string
```

**When to use:**
- XML is already in memory as a string
- You're in a synchronous context
- Blocking synchronous parsing is required

### Asynchronous Parsing

Use `parse()` for asynchronous parsing:

```typescript
const schema = x.object({
  name: x.string().xpath('//name'),
  value: x.number().xpath('//value')
});

const result = await schema.parse(xmlString);
// Returns: Promise<{ name: string; value: number; }>
```

**When to use:**
- Parsing large XML documents
- You're already in an async context
- You want non-blocking execution

### Safe Parsing

Safe parsing methods return a result object instead of throwing errors:

```typescript
const schema = x.number().xpath('//age').min(0).max(120);

// Safe sync parsing
const result = schema.safeParseSync('<age>150</age>');

if (result.success) {
  console.log(result.data);  // number
} else {
  console.log(result.error.issues);  // Array of error objects
}

// Safe async parsing
const result = await schema.safeParse('<age>150</age>');
```

**ParseResult type:**
```typescript
type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: Array<{ message: string; path?: string }> } };
```

**When to use:**
- You want to handle errors explicitly
- You're validating user input
- You don't want to use try/catch blocks

## Type Inference

The converter provides automatic TypeScript type inference using the `Infer` utility type:

```typescript
import { x, type Infer } from 'stax-xml/converter';

const userSchema = x.object({
  id: x.number().xpath('//id'),
  username: x.string().xpath('//username'),
  email: x.string().xpath('//email'),
  active: x.string().xpath('//active').transform(v => v === 'true')
});

// Automatically infer the type
type User = Infer<typeof userSchema>;
// {
//   id: number;
//   username: string;
//   email: string;
//   active: boolean;  // Note: transformed type!
// }

// Use the inferred type
const users: User[] = [];
```

### Complex Type Inference

Type inference works with nested structures and transformations:

```typescript
const productSchema = x.object({
  name: x.string().xpath('//name'),
  price: x.number().xpath('//price'),
  tags: x.array(x.string(), '//tag'),
  specs: x.object({
    weight: x.number().xpath('./weight'),
    dimensions: x.string().xpath('./dimensions')
  }).xpath('//specs').optional()
});

type Product = Infer<typeof productSchema>;
// {
//   name: string;
//   price: number;
//   tags: string[];
//   specs: { weight: number; dimensions: string; } | undefined;
// }
```

### Type Inference Best Practices

1. **Define schemas as const**:
   ```typescript
   const schema = x.object({...}) as const;
   ```

2. **Extract types early**:
   ```typescript
   type MyData = Infer<typeof mySchema>;
   ```

3. **Use in function signatures**:
   ```typescript
   function processData(data: Infer<typeof schema>) {
     // TypeScript knows the exact shape
   }
   ```

## XPath Integration

XPath is the primary method for selecting elements in XML documents.

### XPath Basics

```typescript
// Absolute path from root
x.string().xpath('/root/element/child')

// Descendant search (anywhere in document)
x.string().xpath('//element')

// Attribute access
x.string().xpath('/root/@id')
x.string().xpath('//link/@href')

// Combined
x.string().xpath('/root/item/@name')
```

### XPath in Different Schemas

**String and Number schemas:**
```typescript
const title = x.string().xpath('/book/title');
const price = x.number().xpath('/book/price');
```

**Object schemas:**
```typescript
// XPath on individual fields
const book = x.object({
  title: x.string().xpath('/book/title'),
  author: x.string().xpath('/book/author')
});

// XPath on entire object (scopes child XPaths)
const book = x.object({
  title: x.string().xpath('./title'),     // Relative to /book
  author: x.string().xpath('./author')     // Relative to /book
}).xpath('/book');
```

**Array schemas:**
```typescript
// XPath is REQUIRED for arrays
const items = x.array(
  x.string(),
  '//item'  // Selects all <item> elements
);

// Array of objects
const books = x.array(
  x.object({
    title: x.string().xpath('./title'),
    price: x.number().xpath('./price')
  }),
  '//book'  // Each book becomes an object
);
```

### Position Predicates

The streaming subset supports positive 1-based literal positions:

```typescript
x.array(
  x.object({...}),
  '//book[2]'
)

x.string().xpath('//item[1]')  // First item

// Attribute predicates and other XPath predicates are rejected at construction.
```

## Error Handling

The converter provides detailed error information when parsing fails:

### XmlParseError

```typescript
import { XmlParseError } from 'stax-xml/converter';

try {
  const result = schema.parseSync(invalidXml);
} catch (error) {
  if (error instanceof XmlParseError) {
    console.log(error.message);  // Human-readable message
    console.log(error.issues);    // Array of specific issues
  }
}
```

### Error Types

Common error scenarios:

**1. Validation Errors**
```typescript
const schema = x.number().xpath('//age').min(18);
schema.parseSync('<age>15</age>');
// Error: Value 15 is less than minimum 18
```

**2. Type Conversion Errors**
```typescript
const schema = x.number().xpath('//count');
schema.parseSync('<count>abc</count>');
// Error: Expected number, got NaN
```

**3. Missing Required Fields**
```typescript
const schema = x.object({
  required: x.string().xpath('//required')
});
schema.parseSync('<root></root>');
// Returns: { required: '' }  (empty string, not error)
```

**4. XPath Errors**
```typescript
const schema = x.array(x.string());  // Missing xpath
schema.parseSync('<root></root>');
// Error: Array schema requires xpath
```

### Error Recovery Strategies

**1. Use Optional**
```typescript
const schema = x.object({
  id: x.number().xpath('//id'),
  optional: x.string().xpath('//optional').optional()
});
// Returns: { id: number; optional: string | undefined }
```

**2. Use Safe Parsing**
```typescript
const result = schema.safeParseSync(xml);
if (!result.success) {
  // Handle errors gracefully
  return defaultValue;
}
return result.data;
```

**3. Use Transform for Defaults**
```typescript
const schema = x.string()
  .xpath('//value')
  .transform(v => v || 'default');
```

## Schema Composition

Schemas can be composed and reused:

### Reusing Schemas

```typescript
// Define reusable schemas
const priceSchema = x.number().min(0);
const idSchema = x.number().int().min(1);

// Compose in objects
const productSchema = x.object({
  id: idSchema.xpath('//id'),
  price: priceSchema.xpath('//price'),
  salePrice: priceSchema.xpath('//salePrice').optional()
});
```

### Nested Objects

```typescript
const addressSchema = x.object({
  street: x.string().xpath('./street'),
  city: x.string().xpath('./city'),
  zip: x.string().xpath('./zip')
}).xpath('/address');

const personSchema = x.object({
  name: x.string().xpath('/person/name'),
  address: addressSchema  // Nested object schema
});
```

### Schema Arrays

```typescript
const tagSchema = x.string();
const tagsArray = x.array(tagSchema, '//tag');

const articleSchema = x.object({
  title: x.string().xpath('//title'),
  tags: tagsArray
});
```

## Performance Considerations

### Synchronous vs Asynchronous

```typescript
// Synchronous - use when blocking parsing is appropriate
const result = schema.parseSync(smallXml);

// Asynchronous - better for large documents
const result = await schema.parse(largeXml);
```

### XPath Optimization

```typescript
// ❌ Slow - searches entire document multiple times
const schema = x.object({
  a: x.string().xpath('//a'),
  b: x.string().xpath('//b'),
  c: x.string().xpath('//c')
});

// ✅ Better - single root XPath, relative children
const schema = x.object({
  a: x.string().xpath('./a'),
  b: x.string().xpath('./b'),
  c: x.string().xpath('./c')
}).xpath('/root');
```

### Automatic IR Dispatch and Optional Warm-up

Schemas automatically build and cache their IR dispatch program on first use.
There is no public `compile()` step. Use `precompile()` only when you want to
move that one-time work into server or worker startup:

```typescript
const personSchema = x.object({
  id: x.number().xpath('./@id').int(),
  name: x.string().xpath('./name'),
  age: x.number().xpath('./age').int(),
  birthday: x.string().xpath('./birthday'),
  married: x.string()
    .xpath('./married')
    .transform(value => value === 'true'),
  firstTime: x.string().xpath('./married/@firstTime'),
  nickname: x.string().xpath('./nickname').optional(),
  address: x.object({
    city: x.string().xpath('./city'),
    zip: x.string().xpath('./zip/text()')
  }).xpath('./address'),
  aliases: x.array(x.string(), './alias'),
  contacts: x.array(
    x.object({
      type: x.string().xpath('./@type'),
      value: x.string().xpath('./value/text()')
    }),
    './contact'
  )
});

const schema = x.object({
  datasetId: x.string().xpath('/dataset/@id'),
  title: x.string().xpath('/dataset/title/text()'),
  metadata: x.object({
    source: x.string().xpath('./source'),
    generatedAt: x.string().xpath('./generatedAt')
  }).xpath('/dataset/metadata'),
  labels: x.array(x.string(), '/dataset/labels/label'),
  people: x.array(personSchema, '//person')
}).precompile();

// Request-time parsing uses the already-warmed program.
const result = schema.parseSync(xml);
```

Calling `precompile()` is optional: `parse()` and `parseSync()` perform the same
work automatically and reuse the cached program. Warm-up changes first-request
latency, not steady-state throughput. The fastest path is available for every
supported public selector shape that can be lowered to fixed XML event dispatch.

The schema above combines the common fast-path shapes in one compiled schema: absolute element and attribute selectors, direct `text()` selectors, a descendant array boundary with `//person`, relative selectors inside each person item, nested objects, scalar arrays, object arrays, optional fields, and transforms. Numeric validation like `.int()` is still applied after text extraction.

**Fast-path friendly shapes:**

| Shape | Example |
|-------|---------|
| Absolute element paths | `/catalog/book/title` |
| Descendant element paths | `//book` |
| Absolute or relative attributes | `/catalog/book/@id`, `./@id` |
| Relative fields inside object or array items | `./title`, `./author/name` |
| Direct text selection | `/message/text()`, `./title/text()` |
| Objects with scalar fields | `x.object({ title: x.string().xpath('./title') }).xpath('/book')` |
| Arrays of scalars or objects | `x.array(x.string(), '/tags/tag')`, `x.array(bookSchema, '/catalog/book')` |
| Nested objects, optional fields, transforms | `x.object({...}).optional().transform(...)` |

**Unsupported streaming selector or schema shapes:**

| Shape | Example |
|-------|---------|
| Wildcards | `/catalog/*` |
| Arbitrary predicates | `//book[@id="1"]`, `//book[last()]` |
| Ambiguous relative paths without `./` | `title` |
| Nested arrays | `x.array(x.array(x.string(), './value'), '/group')` |
| Arrays that define both an array XPath and an element XPath | `x.array(x.string().xpath('./title'), '/book')` |
| Custom or unsupported schema wrappers | User-defined schema subclasses |

Unsupported XPath expressions fail explicitly instead of silently switching to
a document-tree evaluator. See the [XPath contract](./xpath-guide/) for the
full supported selector set.

### Schema Reuse

```typescript
// ❌ Creates new schema every time
function parseUser(xml: string) {
  const schema = x.object({...});
  return schema.parseSync(xml);
}

// ✅ Define schema once, reuse
const userSchema = x.object({...});

function parseUser(xml: string) {
  return userSchema.parseSync(xml);
}
```

## Next Steps

- Explore [Schema Types](/stax-xml/converter/schemas) for detailed API reference
- Learn [XPath patterns](/stax-xml/converter/xpath-guide) for element selection
- See [Transformations](/stax-xml/converter/transformations) for data processing
- Check [Examples](/stax-xml/converter/examples) for real-world patterns
