---
title: Converter - Writing XML
description: Serialize JavaScript objects to XML with the converter writer API
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/writing-xml.png
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
      content: https://clickin.github.io/stax-xml/og/converter/writing-xml.png
slug: v1.0.0-rc3/converter/writing-xml
---

The StAX-XML converter can serialize JavaScript objects back to XML using the `.writer()` configuration method and `.write()` / `.writeSync()` methods.

## Basic XML Writing

### String Schema

```typescript
import { x } from 'stax-xml/converter';

// Configure writer
const schema = x.string().writer({
  element: 'message'
});

// Write to XML
const xml = schema.writeSync('Hello World');
// <message>Hello World</message>
```

### With Root Element

Add a root element and XML declaration:

```typescript
const schema = x.string().writer({
  element: 'content'
});

const xml = schema.writeSync('Hello', {
  rootElement: 'root',
  includeDeclaration: true
});
// <?xml version="1.0" encoding="UTF-8"?>
// <root><content>Hello</content></root>
```

### Number Schema

```typescript
const schema = x.number().writer({
  element: 'count'
});

const xml = schema.writeSync(42);
// <count>42</count>
```

## Writer Configuration

The `.writer()` method accepts a configuration object:

```typescript
interface XmlElementWriteConfig {
  element?: string;           // Element name
  attribute?: string;         // Write as attribute instead
  cdata?: boolean;            // Wrap in CDATA
  namespace?: string;         // Element namespace
  namespacePrefix?: string;   // Namespace prefix
}
```

### Element Names

```typescript
const schema = x.string().writer({
  element: 'title'
});

schema.writeSync('Book Title');
// <title>Book Title</title>
```

### Attributes

Write values as attributes instead of elements:

```typescript
const schema = x.number().writer({
  attribute: 'id'
});

// Note: attributes need a container element
schema.writeSync(123, { rootElement: 'item' });
// <item id="123"/>
```

### CDATA Sections

Wrap content in CDATA for special characters:

```typescript
const schema = x.string().writer({
  element: 'description',
  cdata: true
});

schema.writeSync('Text with <tags> & special chars');
// <description><![CDATA[Text with <tags> & special chars]]></description>
```

### Namespaces

```typescript
const schema = x.string().writer({
  element: 'title',
  namespace: 'http://example.com/ns',
  namespacePrefix: 'ns'
});

schema.writeSync('Content');
// <ns:title xmlns:ns="http://example.com/ns">Content</ns:title>
```

## Writing Objects

Object schemas write each field according to its writer configuration:

```typescript
const bookSchema = x.object({
  id: x.number().xpath('/book/@id').writer({ attribute: 'id' }),
  title: x.string().xpath('/book/title').writer({ element: 'title' }),
  author: x.string().xpath('/book/author').writer({ element: 'author' }),
  price: x.number().xpath('/book/price').writer({ element: 'price' })
});

const book = {
  id: 123,
  title: '1984',
  author: 'George Orwell',
  price: 15.99
};

const xml = bookSchema.writeSync(book, { rootElement: 'book' });
// <book id="123">
//   <title>1984</title>
//   <author>George Orwell</author>
//   <price>15.99</price>
// </book>
```

### Nested Objects

```typescript
const personSchema = x.object({
  name: x.string().xpath('/person/name').writer({ element: 'name' }),
  address: x.object({
    street: x.string().xpath('./street').writer({ element: 'street' }),
    city: x.string().xpath('./city').writer({ element: 'city' }),
    zip: x.string().xpath('./zip').writer({ element: 'zip' })
  }).xpath('/person/address').writer({ element: 'address' })
});

const person = {
  name: 'John Doe',
  address: {
    street: '123 Main St',
    city: 'Springfield',
    zip: '12345'
  }
};

const xml = personSchema.writeSync(person, { rootElement: 'person' });
// <person>
//   <name>John Doe</name>
//   <address>
//     <street>123 Main St</street>
//     <city>Springfield</city>
//     <zip>12345</zip>
//   </address>
// </person>
```

### Mixed Attributes and Elements

```typescript
const productSchema = x.object({
  id: x.number().xpath('./@id').writer({ attribute: 'id' }),
  sku: x.string().xpath('./@sku').writer({ attribute: 'sku' }),
  name: x.string().xpath('./name').writer({ element: 'name' }),
  price: x.number().xpath('./price').writer({ element: 'price' }),
  description: x.string().xpath('./description').writer({
    element: 'description',
    cdata: true
  })
});

const product = {
  id: 456,
  sku: 'WIDGET-001',
  name: 'Super Widget',
  price: 29.99,
  description: 'A <special> widget with many features & benefits'
};

const xml = productSchema.writeSync(product, { rootElement: 'product' });
// <product id="456" sku="WIDGET-001">
//   <name>Super Widget</name>
//   <price>29.99</price>
//   <description><![CDATA[A <special> widget with many features & benefits]]></description>
// </product>
```

## Writing Arrays

Arrays write each element as a separate XML element:

```typescript
const itemsSchema = x.array(
  x.string().writer({ element: 'item' }),
  '//item'
);

const items = ['Apple', 'Banana', 'Cherry'];

const xml = itemsSchema.writeSync(items, { rootElement: 'list' });
// <list>
//   <item>Apple</item>
//   <item>Banana</item>
//   <item>Cherry</item>
// </list>
```

### Array of Objects

```typescript
const booksSchema = x.array(
  x.object({
    title: x.string().xpath('./title').writer({ element: 'title' }),
    author: x.string().xpath('./author').writer({ element: 'author' }),
    year: x.number().xpath('./year').writer({ element: 'year' })
  }),
  '//book'
).writer({ element: 'book' });

const books = [
  { title: '1984', author: 'George Orwell', year: 1949 },
  { title: 'Brave New World', author: 'Aldous Huxley', year: 1932 }
];

const xml = booksSchema.writeSync(books, { rootElement: 'library' });
// <library>
//   <book>
//     <title>1984</title>
//     <author>George Orwell</author>
//     <year>1949</year>
//   </book>
//   <book>
//     <title>Brave New World</title>
//     <author>Aldous Huxley</author>
//     <year>1932</year>
//   </book>
// </library>
```

### Array with Attributes

```typescript
const productsSchema = x.array(
  x.object({
    id: x.number().xpath('./@id').writer({ attribute: 'id' }),
    name: x.string().xpath('./name').writer({ element: 'name' }),
    price: x.number().xpath('./price').writer({ element: 'price' })
  }),
  '//product'
).writer({ element: 'product' });

const products = [
  { id: 1, name: 'Widget', price: 19.99 },
  { id: 2, name: 'Gadget', price: 29.99 }
];

const xml = productsSchema.writeSync(products, { rootElement: 'catalog' });
// <catalog>
//   <product id="1">
//     <name>Widget</name>
//     <price>19.99</price>
//   </product>
//   <product id="2">
//     <name>Gadget</name>
//     <price>29.99</price>
//   </product>
// </catalog>
```

## Write Options

The `write()` and `writeSync()` methods accept options:

```typescript
interface XmlWriteOptions {
  rootElement?: string;        // Root element name
  includeDeclaration?: boolean; // Add <?xml?> declaration
  xmlVersion?: string;         // XML version (default: "1.0")
  encoding?: string;           // Encoding (default: "UTF-8")
  prettyPrint?: boolean;       // Format with indentation
  indentString?: string;       // Indent string (default: "  ")
  writer?: StaxXmlWriterSync | StaxXmlWriterSyncSink | StaxXmlWriter; // Optional injected writer
}
```

### Sink-Based Sync Writing

Use `writeSync()` with an injected `StaxXmlWriterSyncSink` to avoid building the whole XML string in memory. This is the recommended converter write path for large XML output.

```typescript
import { x } from 'stax-xml/converter';
import { openSync } from 'fs';
import {
  StaxXmlWriterSyncSink,
  StaxXmlWriterSync
} from 'stax-xml';
import { createNodeFileSyncTextSink } from 'stax-xml/adapters/node';

const schema = x.object({
  id: x.number().xpath('/book/@id').writer({ attribute: 'id' }),
  title: x.string().xpath('/book/title').writer({ element: 'title' }),
  price: x.number().xpath('/book/price').writer({ element: 'price' })
});

const fd = openSync('./catalog.xml', 'w');
const sink = new StaxXmlWriterSyncSink(
  createNodeFileSyncTextSink(fd),
  { flushThreshold: 0.8, enableAutoFlush: true }
);

const data = {
  id: 1001,
  title: 'High-Performance XML',
  price: 12345
};

schema.writeSync(data, {
  rootElement: 'book',
  writer: sink,
  prettyPrint: true
});

// Because writer is injected, writeSync writes directly to the sink
// and returns an empty string.
sink.flush();
sink.close();
```

### Pretty Printing

```typescript
const schema = x.object({
  name: x.string().xpath('/name').writer({ element: 'name' }),
  value: x.number().xpath('/value').writer({ element: 'value' })
});

const data = { name: 'Test', value: 42 };

// Without pretty print
const compact = schema.writeSync(data, { rootElement: 'data' });
// <data><name>Test</name><value>42</value></data>

// With pretty print
const formatted = schema.writeSync(data, {
  rootElement: 'data',
  prettyPrint: true,
  indentString: '  '
});
// <data>
//   <name>Test</name>
//   <value>42</value>
// </data>
```

### XML Declaration

```typescript
const xml = schema.writeSync(data, {
  rootElement: 'root',
  includeDeclaration: true,
  xmlVersion: '1.0',
  encoding: 'UTF-8'
});
// <?xml version="1.0" encoding="UTF-8"?>
// <root>...</root>
```

### Custom Indentation

```typescript
const xml = schema.writeSync(data, {
  rootElement: 'root',
  prettyPrint: true,
  indentString: '\t'  // Use tabs
});
```

## Async Writing

For consistency, async writing is also supported:

```typescript
// Async write
const xml = await schema.write(data, { rootElement: 'root' });

// Sync write
const xml = schema.writeSync(data, { rootElement: 'root' });

// Both produce the same output
```

## Bi-directional Schemas

Schemas can be used for both parsing and writing:

```typescript
const userSchema = x.object({
  id: x.number().xpath('/user/@id').writer({ attribute: 'id' }),
  username: x.string().xpath('/user/username').writer({ element: 'username' }),
  email: x.string().xpath('/user/email').writer({ element: 'email' }),
  active: x.string()
    .xpath('/user/@active')
    .writer({ attribute: 'active' })
    .transform(v => v === 'true')  // Parse: string -> boolean
});

// Parse XML to object
const xml = '<user id="123" active="true"><username>john</username><email>john@example.com</email></user>';
const user = userSchema.parseSync(xml);
// { id: 123, username: "john", email: "john@example.com", active: true }

// Write object to XML
const reverseData = {
  id: 456,
  username: 'jane',
  email: 'jane@example.com',
  active: 'true'  // Note: need to provide string, not boolean
};

const outputXml = userSchema.writeSync(reverseData, { rootElement: 'user' });
// <user id="456" active="true">
//   <username>jane</username>
//   <email>jane@example.com</email>
// </user>
```

**Note**: Transforms only apply during parsing, not writing. You need to provide data in the format expected by the writer.

## Entity Escaping

The writer automatically escapes special XML characters:

```typescript
const schema = x.string().writer({ element: 'text' });

const xml = schema.writeSync('Text with <tags> & "quotes"', { rootElement: 'root' });
// <root><text>Text with &lt;tags&gt; &amp; &quot;quotes&quot;</text></root>
```

Use CDATA to avoid escaping:

```typescript
const schema = x.string().writer({ element: 'text', cdata: true });

const xml = schema.writeSync('Text with <tags> & "quotes"', { rootElement: 'root' });
// <root><text><![CDATA[Text with <tags> & "quotes"]]></text></root>
```

## Real-World Examples

### Configuration File

```typescript
const configSchema = x.object({
  appName: x.string().xpath('/config/app/name').writer({ element: 'name' }),
  version: x.string().xpath('/config/app/version').writer({ element: 'version' }),
  database: x.object({
    host: x.string().xpath('./host').writer({ element: 'host' }),
    port: x.number().xpath('./port').writer({ element: 'port' }),
    name: x.string().xpath('./database').writer({ element: 'database' })
  }).xpath('/config/database').writer({ element: 'database' }),
  features: x.array(
    x.object({
      name: x.string().xpath('./@name').writer({ attribute: 'name' }),
      enabled: x.string().xpath('./@enabled').writer({ attribute: 'enabled' })
    }),
    '/config/features/feature'
  ).writer({ element: 'feature' })
}).xpath('/config');

const config = {
  appName: 'MyApp',
  version: '1.0.0',
  database: {
    host: 'localhost',
    port: 5432,
    name: 'mydb'
  },
  features: [
    { name: 'analytics', enabled: 'true' },
    { name: 'darkMode', enabled: 'false' }
  ]
};

const xml = configSchema.writeSync(config, {
  rootElement: 'config',
  includeDeclaration: true,
  prettyPrint: true
});
// <?xml version="1.0" encoding="UTF-8"?>
// <config>
//   <name>MyApp</name>
//   <version>1.0.0</version>
//   <database>
//     <host>localhost</host>
//     <port>5432</port>
//     <database>mydb</database>
//   </database>
//   <feature name="analytics" enabled="true"/>
//   <feature name="darkMode" enabled="false"/>
// </config>
```

### RSS Feed Generation

```typescript
const rssSchema = x.object({
  title: x.string().xpath('/rss/channel/title').writer({ element: 'title' }),
  link: x.string().xpath('/rss/channel/link').writer({ element: 'link' }),
  description: x.string().xpath('/rss/channel/description').writer({ element: 'description' }),
  items: x.array(
    x.object({
      title: x.string().xpath('./title').writer({ element: 'title' }),
      link: x.string().xpath('./link').writer({ element: 'link' }),
      description: x.string().xpath('./description').writer({ element: 'description', cdata: true }),
      pubDate: x.string().xpath('./pubDate').writer({ element: 'pubDate' })
    }),
    '//item'
  ).writer({ element: 'item' })
});

const rss = {
  title: 'My Blog',
  link: 'https://example.com',
  description: 'Latest posts',
  items: [
    {
      title: 'First Post',
      link: 'https://example.com/post-1',
      description: 'This is the <b>first</b> post',
      pubDate: 'Mon, 15 Jan 2024 10:00:00 GMT'
    }
  ]
};

const xml = rssSchema.writeSync(rss, {
  rootElement: 'channel',
  prettyPrint: true
});
```

### SVG Generation

```typescript
const svgSchema = x.object({
  width: x.number().xpath('/svg/@width').writer({ attribute: 'width' }),
  height: x.number().xpath('/svg/@height').writer({ attribute: 'height' }),
  circles: x.array(
    x.object({
      cx: x.number().xpath('./@cx').writer({ attribute: 'cx' }),
      cy: x.number().xpath('./@cy').writer({ attribute: 'cy' }),
      r: x.number().xpath('./@r').writer({ attribute: 'r' }),
      fill: x.string().xpath('./@fill').writer({ attribute: 'fill' })
    }),
    '//circle'
  ).writer({ element: 'circle' })
});

const svg = {
  width: 200,
  height: 200,
  circles: [
    { cx: 50, cy: 50, r: 40, fill: 'red' },
    { cx: 150, cy: 150, r: 30, fill: 'blue' }
  ]
};

const xml = svgSchema.writeSync(svg, {
  rootElement: 'svg',
  prettyPrint: true
});
// <svg width="200" height="200">
//   <circle cx="50" cy="50" r="40" fill="red"/>
//   <circle cx="150" cy="150" r="30" fill="blue"/>
// </svg>
```

## Best Practices

### 1. Consistent Parse/Write Schemas

```typescript
// ✅ Schema works for both directions
const schema = x.object({
  id: x.number().xpath('/@id').writer({ attribute: 'id' }),
  name: x.string().xpath('/name').writer({ element: 'name' })
});

// Can parse and write
const parsed = schema.parseSync(xml);
const written = schema.writeSync(data, { rootElement: 'item' });
```

### 2. Use CDATA for User Content

```typescript
// ✅ CDATA for HTML/special content
const schema = x.string().writer({
  element: 'content',
  cdata: true
});
```

### 3. Configure All Fields

```typescript
// ✅ All fields have writer config
const schema = x.object({
  a: x.string().xpath('/a').writer({ element: 'a' }),
  b: x.number().xpath('/b').writer({ element: 'b' })
});

// ❌ Missing writer config
const incomplete = x.object({
  a: x.string().xpath('/a').writer({ element: 'a' }),
  b: x.number().xpath('/b')  // No writer!
});
```

### 4. Handle Optional Fields

```typescript
// Optional fields are skipped if undefined
const schema = x.object({
  required: x.string().xpath('/required').writer({ element: 'required' }),
  optional: x.string().xpath('/optional').optional().writer({ element: 'optional' })
});

schema.writeSync({ required: 'value', optional: undefined });
// <required>value</required>
// (optional element not included)
```

## Next Steps

- See [Examples](/stax-xml/converter/examples) for complete bi-directional schemas
- Review [Schema Types](/stax-xml/converter/schemas) for validation during writing
- Check [Transformations](/stax-xml/converter/transformations) for data preparation
- Learn [XPath](/stax-xml/converter/xpath-guide) for precise field mapping
