---
title: Converter - Transformations
description: Transform and process parsed XML data with powerful methods
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/transformations.png
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
      content: https://clickin.github.io/stax-xml/og/converter/transformations.png
---

Transformations allow you to process and reshape data after parsing. The converter provides three powerful methods: `.transform()`, `.optional()`, and `.array()`.

## Transform Method

The `.transform()` method applies a function to the parsed value, allowing you to modify the output.

### Basic Usage

```typescript
import { x } from 'stax-xml/converter';

// Parse string and transform to uppercase
const schema = x.string()
  .xpath('/message')
  .transform(value => value.toUpperCase());

const xml = '<message>hello world</message>';
const result = schema.parseSync(xml);
// "HELLO WORLD"
```

### Type Transformation

Transform can change the output type:

```typescript
// String to boolean
const boolSchema = x.string()
  .xpath('/enabled')
  .transform(value => value === 'true');

// XML: <enabled>true</enabled>
// Result: true (boolean, not string)

// String to Date
const dateSchema = x.string()
  .xpath('/publishDate')
  .transform(value => new Date(value));

// XML: <publishDate>2024-01-15</publishDate>
// Result: Date object

// Number to string with formatting
const priceSchema = x.number()
  .xpath('/price')
  .transform(value => `$${value.toFixed(2)}`);

// XML: <price>19.99</price>
// Result: "$19.99"
```

### Type Inference with Transform

TypeScript infers the transformed type:

```typescript
import { type Infer } from 'stax-xml/converter';

const schema = x.string()
  .xpath('/value')
  .transform(v => parseInt(v));

type Output = Infer<typeof schema>;
// number (not string)

const numericSchema = x.number()
  .xpath('/value')
  .transform(v => v > 10);

type BoolOutput = Infer<typeof numericSchema>;
// boolean
```

### Object Transformation

Transform entire objects to reshape data:

```typescript
const personSchema = x.object({
  firstName: x.string().xpath('/person/firstName'),
  lastName: x.string().xpath('/person/lastName'),
  age: x.number().xpath('/person/age')
}).transform(person => ({
  fullName: `${person.firstName} ${person.lastName}`,
  age: person.age,
  isAdult: person.age >= 18
}));

// XML: <person><firstName>John</firstName><lastName>Doe</lastName><age>25</age></person>
// Result: { fullName: "John Doe", age: 25, isAdult: true }

type Person = Infer<typeof personSchema>;
// { fullName: string; age: number; isAdult: boolean; }
```

### Chaining Transforms

Multiple transforms can be chained:

```typescript
const schema = x.string()
  .xpath('/value')
  .transform(v => v.trim())           // First: trim whitespace
  .transform(v => v.toLowerCase())    // Then: lowercase
  .transform(v => v.split(','))       // Then: split to array
  .transform(v => v.map(s => s.trim())); // Finally: trim each

// XML: <value>  Apple, Banana,  Cherry  </value>
// Result: ["apple", "banana", "cherry"]
```

### Use Cases

**1. Boolean Parsing**
```typescript
const activeSchema = x.string()
  .xpath('/user/@active')
  .transform(v => v === 'true' || v === '1');
```

**2. Enum Mapping**
```typescript
type Status = 'active' | 'inactive' | 'pending';

const statusSchema = x.string()
  .xpath('/status')
  .transform(v => v.toLowerCase() as Status);
```

**3. Data Cleanup**
```typescript
const emailSchema = x.string()
  .xpath('/email')
  .transform(v => v.trim().toLowerCase());
```

**4. Calculations**
```typescript
const totalSchema = x.object({
  price: x.number().xpath('/price'),
  quantity: x.number().xpath('/quantity'),
  tax: x.number().xpath('/tax')
}).transform(item => ({
  ...item,
  total: (item.price * item.quantity) * (1 + item.tax)
}));
```

**5. URL Normalization**
```typescript
const urlSchema = x.string()
  .xpath('/link')
  .transform(url => {
    if (!url.startsWith('http')) {
      return `https://${url}`;
    }
    return url;
  });
```

## Optional Method

The `.optional()` method makes a field return `undefined` instead of throwing an error when parsing fails.

### Basic Usage

```typescript
const schema = x.string()
  .xpath('/missing')
  .optional();

const result = schema.parseSync('<root></root>');
// undefined (not empty string)
```

### With Type Inference

```typescript
import { type Infer } from 'stax-xml/converter';

const schema = x.number()
  .xpath('/value')
  .optional();

type Output = Infer<typeof schema>;
// number | undefined
```

### In Objects

Optional is particularly useful in object schemas:

```typescript
const userSchema = x.object({
  id: x.number().xpath('/user/id'),                    // Required
  username: x.string().xpath('/user/username'),         // Required
  email: x.string().xpath('/user/email').optional(),    // Optional
  phone: x.string().xpath('/user/phone').optional()     // Optional
});

// All of these are valid:
userSchema.parseSync('<user><id>1</id><username>john</username></user>');
// { id: 1, username: "john", email: undefined, phone: undefined }

userSchema.parseSync('<user><id>1</id><username>john</username><email>j@example.com</email></user>');
// { id: 1, username: "john", email: "j@example.com", phone: undefined }
```

### With Validation

Optional works with validation - validation only runs if value exists:

```typescript
const schema = x.number()
  .xpath('/age')
  .min(0)
  .max(120)
  .optional();

schema.parseSync('<root></root>');          // ✅ undefined
schema.parseSync('<root><age>25</age></root>');   // ✅ 25
schema.parseSync('<root><age>150</age></root>');  // ❌ Error: greater than max
```

### Optional vs Empty

**Without optional:**
```typescript
x.string().xpath('/value').parseSync('<root></root>');
// "" (empty string)

x.number().xpath('/value').parseSync('<root></root>');
// NaN
```

**With optional:**
```typescript
x.string().xpath('/value').optional().parseSync('<root></root>');
// undefined

x.number().xpath('/value').optional().parseSync('<root></root>');
// undefined
```

### Optional with Transform

Optional can be combined with transform:

```typescript
// Transform only if value exists
const schema = x.string()
  .xpath('/date')
  .optional()
  .transform(v => v ? new Date(v) : undefined);

// Or with default value
const withDefault = x.string()
  .xpath('/value')
  .optional()
  .transform(v => v ?? 'default');
```

### Use Cases

**1. Optional Configuration**
```typescript
const config = x.object({
  host: x.string().xpath('/config/host'),
  port: x.number().xpath('/config/port').optional(),     // Defaults available
  ssl: x.string().xpath('/config/ssl').optional(),
  timeout: x.number().xpath('/config/timeout').optional()
});
```

**2. Partial User Data**
```typescript
const user = x.object({
  id: x.number().xpath('/user/@id'),
  name: x.string().xpath('/user/name'),
  bio: x.string().xpath('/user/bio').optional(),
  avatar: x.string().xpath('/user/avatar').optional(),
  website: x.string().xpath('/user/website').optional()
});
```

**3. Feature Flags**
```typescript
const features = x.object({
  analytics: x.string().xpath('/features/analytics').optional().transform(v => v === 'true'),
  darkMode: x.string().xpath('/features/darkMode').optional().transform(v => v === 'true'),
  beta: x.string().xpath('/features/beta').optional().transform(v => v === 'true')
});
```

## Array Method

The `.array()` method converts any schema into an array schema.

### Basic Usage

```typescript
// Convert string schema to array
const stringSchema = x.string();
const arraySchema = stringSchema.array('//item');

const xml = '<root><item>A</item><item>B</item><item>C</item></root>';
const result = arraySchema.parseSync(xml);
// ["A", "B", "C"]

// Direct creation (equivalent)
const directArray = x.array(x.string(), '//item');
```

### With Object Schemas

```typescript
const bookSchema = x.object({
  title: x.string().xpath('./title'),
  author: x.string().xpath('./author')
});

// Convert to array
const booksArray = bookSchema.array('//book');

// Or use x.array()
const booksArray2 = x.array(bookSchema, '//book');
```

### Type Inference

```typescript
const itemSchema = x.object({
  id: x.number().xpath('./id'),
  name: x.string().xpath('./name')
});

const arraySchema = itemSchema.array('//item');

type Items = Infer<typeof arraySchema>;
// Array<{ id: number; name: string; }>

// Get single item type
type Item = Infer<typeof arraySchema>[number];
// { id: number; name: string; }
```

### With Transform

Transform can be applied before or after array conversion:

```typescript
// Transform each element
const transformed = x.string()
  .transform(v => v.toUpperCase())
  .array('//item');

// XML: <root><item>a</item><item>b</item></root>
// Result: ["A", "B"]

// Transform the entire array
const arrayTransformed = x.string()
  .array('//item')
  .transform(arr => arr.filter(s => s.length > 0));
```

### With Optional

```typescript
// Optional array (undefined if no elements)
const optionalArray = x.string()
  .array('//item')
  .optional();

// Empty array vs undefined
x.array(x.string(), '//item').parseSync('<root></root>');
// [] (empty array)

x.array(x.string(), '//item').optional().parseSync('<root></root>');
// [] (still empty array, optional doesn't change this)

// Use transform for undefined on empty
x.array(x.string(), '//item')
  .transform(arr => arr.length === 0 ? undefined : arr);
```

## Method Chaining

All transformation methods return new schema instances and can be chained.

### Chaining Order Matters

```typescript
// Transform then make optional
const schema1 = x.string()
  .xpath('/value')
  .transform(v => v.toUpperCase())
  .optional();

// Make optional then transform
const schema2 = x.string()
  .xpath('/value')
  .optional()
  .transform(v => v ? v.toUpperCase() : undefined);

// Both work, but handle missing values differently
```

### Complex Chaining

```typescript
const schema = x.string()
  .xpath('/data')
  .transform(v => v.trim())           // Clean whitespace
  .transform(v => v.toLowerCase())    // Lowercase
  .optional()                         // Make optional
  .array('//data')                    // Convert to array
  .transform(arr => [...new Set(arr)]); // Remove duplicates

// XML: <root><data>  APPLE  </data><data>  Banana  </data><data>  APPLE  </data></root>
// Result: ["apple", "banana"]
```

### Real-World Example

```typescript
// Parse and process product data
const productSchema = x.object({
  id: x.number().xpath('./@id').int(),
  name: x.string().xpath('./name').transform(v => v.trim()),
  price: x.number().xpath('./price').min(0),
  discount: x.number().xpath('./discount').optional(),
  tags: x.array(
    x.string().transform(v => v.toLowerCase()),
    './tag'
  ).optional(),
  inStock: x.string()
    .xpath('./@inStock')
    .transform(v => v === 'true')
}).transform(product => ({
  ...product,
  finalPrice: product.discount
    ? product.price * (1 - product.discount / 100)
    : product.price,
  tags: product.tags ?? []
}));

type Product = Infer<typeof productSchema>;
// {
//   id: number;
//   name: string;
//   price: number;
//   discount: number | undefined;
//   tags: string[];
//   inStock: boolean;
//   finalPrice: number;
// }
```

## Best Practices

### 1. Transform for Type Conversion

```typescript
// ✅ Use transform for type changes
const bool = x.string().xpath('/flag').transform(v => v === 'true');
const date = x.string().xpath('/date').transform(v => new Date(v));

// ❌ Don't do type conversion in code
const str = x.string().xpath('/flag');
const result = str.parseSync(xml);
const bool = result === 'true';  // Do this in transform instead
```

### 2. Optional for Missing Fields

```typescript
// ✅ Use optional for genuinely optional fields
const user = x.object({
  id: x.number().xpath('/id'),
  bio: x.string().xpath('/bio').optional()
});

// ❌ Don't use optional for required fields
const user = x.object({
  id: x.number().xpath('/id').optional()  // ID should be required!
});
```

### 3. Validate Before Transform

```typescript
// ✅ Validation before transformation
const age = x.number()
  .xpath('/age')
  .min(0)
  .max(120)
  .transform(age => age >= 18 ? 'adult' : 'minor');

// Validation catches invalid data before transform runs
```

### 4. Keep Transforms Simple

```typescript
// ✅ Simple, clear transforms
const upperCase = x.string()
  .xpath('/value')
  .transform(v => v.toUpperCase());

// ❌ Complex logic in transforms (hard to test/maintain)
const complex = x.string()
  .xpath('/value')
  .transform(v => {
    if (v.includes('special')) {
      return v.split(',').map(x => x.trim()).filter(Boolean).join(';');
    } else {
      return v.toUpperCase().replace(/\s+/g, '_');
    }
  });

// Better: Break into multiple transforms or handle in code
```

### 5. Use Optional with Defaults

```typescript
// ✅ Provide defaults for optional values
const config = x.object({
  port: x.number().xpath('/port').optional().transform(v => v ?? 8080),
  host: x.string().xpath('/host').optional().transform(v => v ?? 'localhost')
});
```

## Common Patterns

### Parse Comma-Separated Lists

```typescript
const tags = x.string()
  .xpath('/tags')
  .transform(v => v.split(',').map(s => s.trim()));

// XML: <tags>apple, banana, cherry</tags>
// Result: ["apple", "banana", "cherry"]
```

### Parse Boolean Variations

```typescript
const bool = x.string()
  .xpath('/enabled')
  .transform(v => {
    const normalized = v.toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  });
```

### Calculate Totals

```typescript
const order = x.object({
  items: x.array(
    x.object({
      price: x.number().xpath('./price'),
      quantity: x.number().xpath('./quantity')
    }),
    '//item'
  )
}).transform(order => ({
  items: order.items,
  subtotal: order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
}));
```

### Normalize URLs

```typescript
const link = x.string()
  .xpath('//@href')
  .transform(url => {
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `https://example.com${url}`;
    if (!url.startsWith('http')) return `https://${url}`;
    return url;
  });
```

### Parse Nested JSON Strings

```typescript
const metadata = x.string()
  .xpath('/metadata')
  .transform(v => JSON.parse(v));

// XML: <metadata>{"key": "value"}</metadata>
// Result: { key: "value" }
```

## Next Steps

- Learn about [Writing XML](/stax-xml/converter/writing-xml) for serialization
- See [Examples](/stax-xml/converter/examples) for real-world transform usage
- Review [Schema Types](/stax-xml/converter/schemas) for validation options
- Check [Core Concepts](/stax-xml/converter/core-concepts) for fundamentals
