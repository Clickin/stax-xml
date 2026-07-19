---
title: Converter - XPath Guide
description: Master XPath expressions for precise XML element selection
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/xpath-guide.png
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
      content: https://clickin.github.io/stax-xml/og/converter/xpath-guide.png
slug: v0.6.1/converter/xpath-guide
---

XPath (XML Path Language) is the primary method for selecting elements in the StAX-XML converter. This guide covers all supported XPath patterns and best practices.

## What is XPath?

XPath is a query language for selecting nodes in XML documents. Think of it like CSS selectors for XML:

- **CSS Selector**: `div.container > p`
- **XPath**: `/div[@class='container']/p`

The converter uses XPath to specify **which** elements to extract from your XML.

## Why XPath?

XPath provides:

- **Precision**: Target exactly the elements you need
- **Flexibility**: Handle complex XML structures easily
- **Standard**: Well-documented, widely understood
- **Power**: Filter elements by attributes, position, and content

## XPath Basics

### Absolute Paths

Start from the document root with `/`:

```typescript
// Select <title> directly under <book>
x.string().xpath('/book/title')

// XML: <book><title>1984</title></book>
// Result: "1984"

// Nested path
x.string().xpath('/library/book/title')

// XML: <library><book><title>1984</title></book></library>
// Result: "1984"
```

### Descendant Search

Use `//` to search anywhere in the document:

```typescript
// Find <title> at any depth
x.string().xpath('//title')

// XML: <root><section><book><title>1984</title></book></section></root>
// Result: "1984"

// Useful for unknown structures
x.array(x.string(), '//error')  // All error messages
```

⚠️ **Performance Note**: `//` searches the entire document. Use absolute paths when possible for better performance.

⚠️ **Critical Limitation**: Multiple `//` operators in one path are **not supported**.

```typescript
// ❌ Invalid - causes parser errors
x.string().xpath('//root//books')
x.array(x.string(), '//section//item')

// ✅ Valid alternatives
x.string().xpath('//books')       // Single descendant
x.string().xpath('/root//name')   // Absolute + descendant
x.array(x.string(), '//item')     // Single descendant
```

**Technical Reason**: Event-based streaming parser without DOM. Multiple `//` would require nested full-document scans, causing infinite loops (`//node//node`).

### Relative Paths

Use `./` for paths relative to current context:

```typescript
const specs = x.object({
  cpu: x.string().xpath('./cpu'),      // Relative to specs
  ram: x.string().xpath('./ram'),      // Relative to specs
  storage: x.string().xpath('./storage') // Relative to specs
}).xpath('/product/specs');

// XML:
// <product>
//   <specs>
//     <cpu>Intel i7</cpu>
//     <ram>16GB</ram>
//     <storage>512GB</storage>
//   </specs>
// </product>
```

Relative paths only work when the parent object/array has an XPath set.

## Selecting Attributes

### Simple Attributes

Use `/@` to select attribute values:

```typescript
// Select id attribute
x.string().xpath('/book/@id')

// XML: <book id="123">Title</book>
// Result: "123"

// Nested attribute
x.number().xpath('/product/item/@price')

// XML: <product><item price="19.99">Widget</item></product>
// Result: 19.99
```

### Descendant Attributes

Search for attributes anywhere with `//@`:

```typescript
// Find any href attribute
x.string().xpath('//@href')

// XML: <html><body><a href="http://example.com">Link</a></body></html>
// Result: "http://example.com"

// All id attributes
x.array(x.string(), '//@id')

// XML: <root><item id="1"/><item id="2"/></root>
// Result: ["1", "2"]
```

### Attribute in Objects

```typescript
const book = x.object({
  id: x.number().xpath('/book/@id'),
  title: x.string().xpath('/book/title'),
  category: x.string().xpath('/book/@category')
});

// XML: <book id="123" category="fiction"><title>1984</title></book>
// Result: { id: 123, title: "1984", category: "fiction" }
```

## XPath Predicates

Predicates filter elements based on conditions using `[...]`.

### Attribute Value Predicates

```typescript
// Books with category="fiction"
const fictionBooks = x.array(
  x.object({
    title: x.string().xpath('./title'),
    author: x.string().xpath('./author')
  }),
  '//book[@category="fiction"]'
);

// XML:
// <library>
//   <book category="fiction"><title>1984</title><author>Orwell</author></book>
//   <book category="science"><title>Brief History</title><author>Hawking</author></book>
// </library>
//
// Result: [{ title: "1984", author: "Orwell" }]
```

### Multiple Conditions

```typescript
// Products that are available and in stock
x.array(
  x.object({...}),
  '//product[@available="true"][@inStock="true"]'
);

// Or combine with 'and'
x.array(
  x.object({...}),
  '//product[@available="true" and @inStock="true"]'
);
```

### Position Predicates

```typescript
// First book
x.object({...}).xpath('//book[1]')

// Second book
x.object({...}).xpath('//book[2]')

// Third book
x.object({...}).xpath('//book[3]')
```

⚠️ **Position Limitation**: Only numeric positions like `[1]`, `[2]` are supported. Functions like `last()` and `position()` are not supported due to streaming parser constraints (would require buffering entire document).

## XPath with Different Schemas

### String Schema

```typescript
// Element content (includes nested elements)
x.string().xpath('/message')

// Direct text content only (excludes nested elements)
x.string().xpath('/message/text()')

// Example difference:
// XML: <div>Hello <span>World</span></div>
x.string().xpath('/div')        // "Hello World" (all text)
x.string().xpath('/div/text()')  // "Hello " (direct text only)

// Attribute
x.string().xpath('/@type')

// Nested element
x.string().xpath('/response/data/value')

// Descendant
x.string().xpath('//error')
```

### Number Schema

```typescript
// Parse numeric content
x.number().xpath('/product/price')

// Parse numeric attribute
x.number().xpath('/item/@quantity')

// With validation
x.number().xpath('//age').min(0).max(120)
```

### Object Schema - Two Approaches

**Approach 1: Absolute paths in fields**
```typescript
const user = x.object({
  name: x.string().xpath('/user/name'),
  email: x.string().xpath('/user/email'),
  age: x.number().xpath('/user/age')
});
```

**Approach 2: Object XPath with relative fields** (Recommended)
```typescript
const user = x.object({
  name: x.string().xpath('./name'),
  email: x.string().xpath('./email'),
  age: x.number().xpath('./age')
}).xpath('/user');
```

Both produce the same result, but Approach 2 is more maintainable.

### Array Schema

Arrays **require** XPath to specify which elements to collect:

```typescript
// Array of strings
x.array(x.string(), '//item')

// Array of numbers
x.array(x.number(), '//value')

// Array of objects with predicate
x.array(
  x.object({
    name: x.string().xpath('./name'),
    price: x.number().xpath('./price')
  }),
  '//product[@available="true"]'
)
```

## Real-World XPath Examples

### RSS Feed Parsing

```typescript
const rss = x.object({
  channelTitle: x.string().xpath('/rss/channel/title'),
  channelLink: x.string().xpath('/rss/channel/link'),
  items: x.array(
    x.object({
      title: x.string().xpath('./title'),
      link: x.string().xpath('./link'),
      description: x.string().xpath('./description'),
      pubDate: x.string().xpath('./pubDate')
    }),
    '/rss/channel/item'
  )
});
```

### SVG Document

```typescript
const svg = x.object({
  width: x.number().xpath('/svg/@width'),
  height: x.number().xpath('/svg/@height'),
  circles: x.array(
    x.object({
      cx: x.number().xpath('./@cx'),
      cy: x.number().xpath('./@cy'),
      r: x.number().xpath('./@r'),
      fill: x.string().xpath('./@fill')
    }),
    '//circle'
  ),
  rectangles: x.array(
    x.object({
      x: x.number().xpath('./@x'),
      y: x.number().xpath('./@y'),
      width: x.number().xpath('./@width'),
      height: x.number().xpath('./@height')
    }),
    '//rect'
  )
});
```

### Configuration File

```typescript
const config = x.object({
  appName: x.string().xpath('/config/app/name'),
  version: x.string().xpath('/config/app/version'),
  database: x.object({
    host: x.string().xpath('./host'),
    port: x.number().xpath('./port').int(),
    name: x.string().xpath('./database'),
    credentials: x.object({
      username: x.string().xpath('./username'),
      password: x.string().xpath('./password')
    }).xpath('./credentials')
  }).xpath('/config/database'),
  features: x.array(
    x.object({
      name: x.string().xpath('./@name'),
      enabled: x.string().xpath('./@enabled').transform(v => v === 'true')
    }),
    '/config/features/feature'
  )
});
```

### E-Commerce Product Catalog

```typescript
const catalog = x.object({
  storeName: x.string().xpath('/catalog/@name'),
  categories: x.array(
    x.object({
      id: x.number().xpath('./@id'),
      name: x.string().xpath('./@name'),
      products: x.array(
        x.object({
          id: x.number().xpath('./@id'),
          name: x.string().xpath('./name'),
          price: x.number().xpath('./price').min(0),
          inStock: x.string().xpath('./@inStock').transform(v => v === 'true'),
          tags: x.array(x.string(), './tag')
        }),
        './product'
      )
    }),
    '/catalog/category'
  )
});
```

### HTML-like Document

```typescript
const html = x.object({
  title: x.string().xpath('/html/head/title'),
  metaDescription: x.string().xpath('/html/head/meta[@name="description"]/@content'),
  links: x.array(
    x.object({
      href: x.string().xpath('./@href'),
      text: x.string().xpath('.')
    }),
    '//a'
  ),
  images: x.array(
    x.string().xpath('./@src'),
    '//img'
  )
});
```

## XPath Best Practices

### 1. Be Specific

```typescript
// ❌ Too broad - matches all names
x.string().xpath('//name')

// ✅ Specific path
x.string().xpath('/user/profile/name')

// ✅ With predicate
x.string().xpath('//user[@role="admin"]/name')
```

### 2. Use Relative Paths with Objects

```typescript
// ❌ Repetitive absolute paths
const user = x.object({
  name: x.string().xpath('/user/profile/details/name'),
  email: x.string().xpath('/user/profile/details/email'),
  phone: x.string().xpath('/user/profile/details/phone')
});

// ✅ Cleaner with object XPath
const user = x.object({
  name: x.string().xpath('./name'),
  email: x.string().xpath('./email'),
  phone: x.string().xpath('./phone')
}).xpath('/user/profile/details');
```

### 3. Use Predicates for Filtering

```typescript
// ❌ Get all products, filter in code
const products = x.array(x.object({...}), '//product');
const available = products.filter(p => p.available);

// ✅ Filter with XPath
const available = x.array(
  x.object({...}),
  '//product[@available="true"]'
);
```

### 4. Prefer Absolute Over Descendant

```typescript
// ❌ Slower - searches entire document
x.string().xpath('//deeply/nested/element')

// ✅ Faster - direct path
x.string().xpath('/root/section/deeply/nested/element')
```

Use `//` only when:
- Structure is unknown or variable
- Element can appear at multiple levels
- Convenience outweighs performance

### 5. Combine Attributes and Elements

```typescript
const book = x.object({
  id: x.string().xpath('./@id'),           // Attribute
  isbn: x.string().xpath('./@isbn'),       // Attribute
  title: x.string().xpath('./title'),      // Element
  author: x.string().xpath('./author'),    // Element
  category: x.string().xpath('./@category') // Attribute
}).xpath('//book');
```

## Common XPath Patterns Cheat Sheet

| Pattern | Example | Description |
|---------|---------|-------------|
| `/element` | `/book` | Root element |
| `/parent/child` | `/book/title` | Direct child |
| `//element` | `//title` | Anywhere in document |
| `/@attr` | `/@id` | Attribute of current element |
| `//@attr` | `//@href` | Attribute anywhere |
| `/element/@attr` | `/book/@id` | Specific element's attribute |
| `//element[@attr="value"]` | `//book[@category="fiction"]` | Element with attribute value |
| `//element[1]` | `//book[1]` | First matching element |
| `//element[2]` | `//book[2]` | Second matching element |
| `/element/text()` | `/message/text()` | Direct text content only |
| `./child` | `./name` | Relative child |
| `./@attr` | `./@id` | Relative attribute |
| `//element[@a="x"][@b="y"]` | `//product[@available="true"][@inStock="true"]` | Multiple conditions |

## XPath Limitations

The converter supports a **subset of XPath 1.0**:

### ✅ Supported
- Absolute paths: `/root/element`
- Descendant search: `//element`
- Attributes: `/@attr`, `//@attr`
- Predicates: `[@attr="value"]`
- Numeric position: `[1]`, `[2]`, `[3]` (specific position only)
- Text node function: `text()` (for direct text content)
- Relative paths: `./child`

### ❌ Not Supported
- Axes: `following-sibling::`, `ancestor::`
- Position functions: `last()`, `position()` (streaming parser limitation)
- String functions: `contains()`, `starts-with()`, `substring()`
- Complex expressions: math operations
- Namespaces: `//ns:element`
- Multiple descendant operators: `//parent//child` (causes infinite loop)

For unsupported features, use `.transform()` to process data after parsing.

## Troubleshooting XPath

### No Match Returns Empty/NaN

```typescript
const schema = x.string().xpath('/missing');
const result = schema.parseSync('<root></root>');
// Result: "" (empty string)

const numSchema = x.number().xpath('/missing');
const numResult = numSchema.parseSync('<root></root>');
// Result: NaN
```

Use `.optional()` to get `undefined` instead:
```typescript
x.string().xpath('/missing').optional();
// Result: undefined
```

### Wrong Element Selected

```typescript
// ❌ Gets first name found
x.string().xpath('//name')
// Could match: /user/name OR /company/name

// ✅ Be specific
x.string().xpath('/user/name')
```

### Array Returns Empty

```typescript
const items = x.array(x.string(), '//item').parseSync('<root></root>');
// Result: []

// Check your XPath matches elements
// Verify XML structure
```

## Next Steps

- Learn about [Transformations](/stax-xml/v0.6.1/converter/transformations) for post-processing
- See [Schema Types](/stax-xml/v0.6.1/converter/schemas) for validation options
- Explore [Examples](/stax-xml/v0.6.1/converter/examples) for real-world XPath usage
- Check [Writing XML](/stax-xml/v0.6.1/converter/writing-xml) for serialization
