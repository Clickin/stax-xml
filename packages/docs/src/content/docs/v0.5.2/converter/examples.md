---
title: Converter - Real-World Examples
description: Comprehensive examples of using the XML converter in production scenarios
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/examples.png
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
      content: https://clickin.github.io/stax-xml/og/converter/examples.png
slug: v0.5.2/converter/examples
---

This guide provides complete, production-ready examples of using the StAX-XML converter for common XML parsing scenarios.

## RSS Feed Parser

Parse RSS/Atom feeds with full type safety:

```typescript
import { x, type Infer } from 'stax-xml/converter';

const rssSchema = x.object({
  channelTitle: x.string().xpath('/rss/channel/title'),
  channelLink: x.string().xpath('/rss/channel/link'),
  channelDescription: x.string().xpath('/rss/channel/description'),
  items: x.array(
    x.object({
      title: x.string().xpath('./title'),
      link: x.string().xpath('./link'),
      description: x.string().xpath('./description'),
      pubDate: x.string().xpath('./pubDate'),
      guid: x.string().xpath('./guid').optional()
    }).transform(item => ({
      ...item,
      url: new URL(item.link),
      publishedAt: new Date(item.pubDate)
    })),
    '//item'
  )
});

type RSSFeed = Infer<typeof rssSchema>;

// Usage
const xml = await fetch('https://example.com/feed.xml').then(r => r.text());
const feed = rssSchema.parseSync(xml);

console.log(`Feed: ${feed.channelTitle}`);
feed.items.forEach(item => {
  console.log(`- [${item.publishedAt.toLocaleDateString()}] ${item.title}`);
  console.log(`  ${item.url.href}`);
});

// Type-safe access
const latestItem = feed.items[0];
// latestItem is: {
//   title: string;
//   link: string;
//   description: string;
//   pubDate: string;
//   guid: string | undefined;
//   url: URL;
//   publishedAt: Date;
// }
```

**XML Example:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Tech Blog</title>
    <link>https://techblog.example.com</link>
    <description>Latest tech articles</description>
    <item>
      <title>Getting Started with TypeScript</title>
      <link>https://techblog.example.com/typescript-intro</link>
      <description>Learn the basics of TypeScript</description>
      <pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>
      <guid>typescript-intro</guid>
    </item>
    <item>
      <title>Advanced React Patterns</title>
      <link>https://techblog.example.com/react-patterns</link>
      <description>Deep dive into React patterns</description>
      <pubDate>Tue, 16 Jan 2024 14:30:00 GMT</pubDate>
    </item>
  </channel>
</rss>
```

## E-Commerce Product Catalog

Parse product catalogs with specifications, categories, and pricing:

```typescript
const productSchema = x.object({
  id: x.number().xpath('/product/@id').int(),
  sku: x.string().xpath('/product/@sku'),
  name: x.string().xpath('/product/name'),
  price: x.number().xpath('/product/price').min(0),
  currency: x.string().xpath('/product/price/@currency'),
  stock: x.number().xpath('/product/stock').int().min(0),
  categories: x.array(x.string(), '//category'),
  specs: x.array(
    x.object({
      name: x.string().xpath('./@name'),
      value: x.string().xpath('.')
    }),
    '//spec'
  ),
  images: x.array(
    x.string().xpath('./@src'),
    '//image'
  ).optional()
}).transform(product => ({
  ...product,
  inStock: product.stock > 0,
  specsMap: Object.fromEntries(
    product.specs.map(s => [s.name, s.value])
  ),
  formattedPrice: `${product.currency} ${product.price.toFixed(2)}`
}));

type Product = Infer<typeof productSchema>;

// Parse catalog
const catalogXml = `
  <product id="12345" sku="LAPTOP-001">
    <name>Professional Laptop</name>
    <price currency="USD">999.99</price>
    <stock>15</stock>
    <categories>
      <category>Electronics</category>
      <category>Computers</category>
      <category>Laptops</category>
    </categories>
    <specs>
      <spec name="CPU">Intel i7-13700H</spec>
      <spec name="RAM">16GB DDR5</spec>
      <spec name="Storage">512GB NVMe SSD</spec>
      <spec name="Display">15.6" FHD</spec>
      <spec name="GPU">NVIDIA RTX 4050</spec>
    </specs>
    <images>
      <image src="https://example.com/images/laptop-front.jpg"/>
      <image src="https://example.com/images/laptop-side.jpg"/>
    </images>
  </product>
`;

const product = productSchema.parseSync(catalogXml);

console.log(`${product.name} - ${product.formattedPrice}`);
console.log(`Stock: ${product.inStock ? `${product.stock} available` : 'Out of stock'}`);
console.log(`Categories: ${product.categories.join(', ')}`);
console.log('Specifications:');
Object.entries(product.specsMap).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

// Output:
// Professional Laptop - USD 999.99
// Stock: 15 available
// Categories: Electronics, Computers, Laptops
// Specifications:
//   CPU: Intel i7-13700H
//   RAM: 16GB DDR5
//   Storage: 512GB NVMe SSD
//   Display: 15.6" FHD
//   GPU: NVIDIA RTX 4050
```

## Application Configuration

Parse complex configuration files with validation:

```typescript
const configSchema = x.object({
  appName: x.string().xpath('/config/app/name'),
  version: x.string().xpath('/config/app/version'),
  environment: x.string().xpath('/config/app/environment'),
  database: x.object({
    host: x.string().xpath('./host'),
    port: x.number().xpath('./port').int().min(1).max(65535),
    name: x.string().xpath('./name'),
    ssl: x.string().xpath('./ssl').transform(v => v === 'true'),
    credentials: x.object({
      username: x.string().xpath('./username'),
      password: x.string().xpath('./password')
    }).xpath('./credentials')
  }).xpath('/config/database'),
  cache: x.object({
    enabled: x.string().xpath('./enabled').transform(v => v === 'true'),
    ttl: x.number().xpath('./ttl').int().min(0).optional(),
    maxSize: x.number().xpath('./maxSize').int().min(0).optional()
  }).xpath('/config/cache'),
  features: x.array(
    x.object({
      name: x.string().xpath('./@name'),
      enabled: x.string().xpath('./@enabled').transform(v => v === 'true'),
      config: x.string().xpath('.').optional().transform(v =>
        v ? JSON.parse(v) : undefined
      )
    }),
    '/config/features/feature'
  ),
  logging: x.object({
    level: x.string().xpath('./level'),
    format: x.string().xpath('./format').optional(),
    outputs: x.array(x.string(), './output')
  }).xpath('/config/logging')
});

type AppConfig = Infer<typeof configSchema>;

const configXml = `
  <config>
    <app>
      <name>MyApplication</name>
      <version>2.1.0</version>
      <environment>production</environment>
    </app>
    <database>
      <host>db.example.com</host>
      <port>5432</port>
      <name>myapp_prod</name>
      <ssl>true</ssl>
      <credentials>
        <username>app_user</username>
        <password>secure_password_here</password>
      </credentials>
    </database>
    <cache>
      <enabled>true</enabled>
      <ttl>3600</ttl>
      <maxSize>1000</maxSize>
    </cache>
    <features>
      <feature name="authentication" enabled="true"/>
      <feature name="analytics" enabled="true">{"provider": "google", "id": "UA-12345"}</feature>
      <feature name="beta_features" enabled="false"/>
    </features>
    <logging>
      <level>info</level>
      <format>json</format>
      <output>console</output>
      <output>file</output>
      <output>syslog</output>
    </logging>
  </config>
`;

const config = configSchema.parseSync(configXml);

// Use configuration
console.log(`Starting ${config.appName} v${config.version}`);
console.log(`Environment: ${config.environment}`);
console.log(`Database: ${config.database.host}:${config.database.port}/${config.database.name}`);
console.log(`SSL: ${config.database.ssl ? 'enabled' : 'disabled'}`);
console.log(`Cache: ${config.cache.enabled ? 'enabled' : 'disabled'}`);
if (config.cache.ttl) {
  console.log(`Cache TTL: ${config.cache.ttl}s`);
}

config.features.forEach(feature => {
  console.log(`Feature "${feature.name}": ${feature.enabled ? 'ON' : 'OFF'}`);
  if (feature.config) {
    console.log(`  Config:`, feature.config);
  }
});
```

## User Data with Validation

Parse and validate user records:

```typescript
const userSchema = x.object({
  id: x.number().xpath('./id').int().min(1),
  email: x.string().xpath('./email')
    .transform(v => v.trim().toLowerCase()),
  username: x.string().xpath('./username')
    .transform(v => v.trim()),
  age: x.number().xpath('./age').int().min(13).max(120),
  active: x.string().xpath('./active')
    .transform(v => v === 'true' || v === '1'),
  role: x.string().xpath('./role').optional(),
  createdAt: x.string().xpath('./createdAt')
    .transform(v => new Date(v)),
  profile: x.object({
    firstName: x.string().xpath('./firstName'),
    lastName: x.string().xpath('./lastName'),
    bio: x.string().xpath('./bio').optional(),
    avatar: x.string().xpath('./avatar').optional()
  }).xpath('./profile').optional()
}).transform(user => ({
  ...user,
  fullName: user.profile
    ? `${user.profile.firstName} ${user.profile.lastName}`
    : user.username,
  isAdult: user.age >= 18,
  isActive: user.active,
  accountAge: Math.floor(
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  )
}));

const usersSchema = x.array(userSchema, '//user');

type User = Infer<typeof userSchema>;
type Users = Infer<typeof usersSchema>;

const usersXml = `
  <users>
    <user>
      <id>1</id>
      <email>  JOHN@EXAMPLE.COM  </email>
      <username>john_doe</username>
      <age>30</age>
      <active>true</active>
      <role>admin</role>
      <createdAt>2023-01-15T10:00:00Z</createdAt>
      <profile>
        <firstName>John</firstName>
        <lastName>Doe</lastName>
        <bio>Software engineer passionate about TypeScript</bio>
        <avatar>https://example.com/avatars/john.jpg</avatar>
      </profile>
    </user>
    <user>
      <id>2</id>
      <email>JANE@EXAMPLE.COM</email>
      <username>jane_smith</username>
      <age>25</age>
      <active>1</active>
      <createdAt>2023-06-20T14:30:00Z</createdAt>
    </user>
    <user>
      <id>3</id>
      <email>bob@example.com</email>
      <username>bob_jones</username>
      <age>17</age>
      <active>false</active>
      <createdAt>2024-01-10T09:00:00Z</createdAt>
    </user>
  </users>
`;

const users = usersSchema.parseSync(usersXml);

users.forEach(user => {
  console.log(`${user.fullName} (${user.email})`);
  console.log(`  ID: ${user.id}`);
  console.log(`  Age: ${user.age} (${user.isAdult ? 'Adult' : 'Minor'})`);
  console.log(`  Status: ${user.isActive ? 'Active' : 'Inactive'}`);
  console.log(`  Account age: ${user.accountAge} days`);
  if (user.role) {
    console.log(`  Role: ${user.role}`);
  }
  if (user.profile?.bio) {
    console.log(`  Bio: ${user.profile.bio}`);
  }
  console.log('');
});
```

## Sales Analytics Dashboard

Parse and aggregate sales data:

```typescript
const salesSchema = x.object({
  sales: x.array(
    x.object({
      id: x.number().xpath('./@id'),
      date: x.string().xpath('./date'),
      product: x.string().xpath('./product'),
      quantity: x.number().xpath('./quantity').int().min(0),
      unitPrice: x.number().xpath('./unitPrice').min(0),
      discount: x.number().xpath('./discount').min(0).max(100).optional(),
      customer: x.object({
        id: x.number().xpath('./@id'),
        name: x.string().xpath('./name'),
        segment: x.string().xpath('./@segment')
      }).xpath('./customer')
    }).transform(sale => {
      const subtotal = sale.quantity * sale.unitPrice;
      const discountAmount = sale.discount
        ? subtotal * (sale.discount / 100)
        : 0;
      const total = subtotal - discountAmount;

      return {
        ...sale,
        subtotal,
        discountAmount,
        total,
        saleDate: new Date(sale.date)
      };
    }),
    '//sale'
  )
}).transform(data => {
  const sales = data.sales;

  // Calculate aggregates
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalDiscount = sales.reduce((sum, s) => sum + s.discountAmount, 0);
  const avgOrderValue = totalRevenue / sales.length;

  // Group by product
  const productSales = sales.reduce((acc, sale) => {
    if (!acc[sale.product]) {
      acc[sale.product] = { quantity: 0, revenue: 0 };
    }
    acc[sale.product].quantity += sale.quantity;
    acc[sale.product].revenue += sale.total;
    return acc;
  }, {} as Record<string, { quantity: number; revenue: number }>);

  // Group by customer segment
  const segmentSales = sales.reduce((acc, sale) => {
    const segment = sale.customer.segment;
    if (!acc[segment]) {
      acc[segment] = { count: 0, revenue: 0 };
    }
    acc[segment].count += 1;
    acc[segment].revenue += sale.total;
    return acc;
  }, {} as Record<string, { count: number; revenue: number }>);

  return {
    sales,
    summary: {
      totalSales: sales.length,
      totalRevenue,
      totalDiscount,
      avgOrderValue,
      productSales,
      segmentSales
    }
  };
});

type SalesReport = Infer<typeof salesSchema>;

const salesXml = `
  <report>
    <sale id="1">
      <date>2024-01-15</date>
      <product>Laptop Pro</product>
      <quantity>2</quantity>
      <unitPrice>999.99</unitPrice>
      <discount>10</discount>
      <customer id="101" segment="enterprise">
        <name>Acme Corp</name>
      </customer>
    </sale>
    <sale id="2">
      <date>2024-01-16</date>
      <product>Mouse Wireless</product>
      <quantity>5</quantity>
      <unitPrice>29.99</unitPrice>
      <customer id="102" segment="retail">
        <name>John Smith</name>
      </customer>
    </sale>
    <sale id="3">
      <date>2024-01-16</date>
      <product>Laptop Pro</product>
      <quantity>1</quantity>
      <unitPrice>999.99</unitPrice>
      <discount>5</discount>
      <customer id="103" segment="education">
        <name>Springfield University</name>
      </customer>
    </sale>
  </report>
`;

const report = salesSchema.parseSync(salesXml);

console.log('=== Sales Summary ===');
console.log(`Total Sales: ${report.summary.totalSales}`);
console.log(`Total Revenue: $${report.summary.totalRevenue.toFixed(2)}`);
console.log(`Total Discounts: $${report.summary.totalDiscount.toFixed(2)}`);
console.log(`Average Order Value: $${report.summary.avgOrderValue.toFixed(2)}`);

console.log('\n=== Product Performance ===');
Object.entries(report.summary.productSales).forEach(([product, stats]) => {
  console.log(`${product}:`);
  console.log(`  Quantity Sold: ${stats.quantity}`);
  console.log(`  Revenue: $${stats.revenue.toFixed(2)}`);
});

console.log('\n=== Segment Analysis ===');
Object.entries(report.summary.segmentSales).forEach(([segment, stats]) => {
  console.log(`${segment}:`);
  console.log(`  Orders: ${stats.count}`);
  console.log(`  Revenue: $${stats.revenue.toFixed(2)}`);
  console.log(`  Avg per Order: $${(stats.revenue / stats.count).toFixed(2)}`);
});
```

## SVG Document Parsing

Extract shapes and attributes from SVG:

```typescript
const svgSchema = x.object({
  width: x.number().xpath('/svg/@width'),
  height: x.number().xpath('/svg/@height'),
  viewBox: x.string().xpath('/svg/@viewBox').optional(),
  shapes: x.object({
    rectangles: x.array(
      x.object({
        x: x.number().xpath('./@x'),
        y: x.number().xpath('./@y'),
        width: x.number().xpath('./@width'),
        height: x.number().xpath('./@height'),
        fill: x.string().xpath('./@fill').optional(),
        stroke: x.string().xpath('./@stroke').optional()
      }),
      '//rect'
    ).optional(),
    circles: x.array(
      x.object({
        cx: x.number().xpath('./@cx'),
        cy: x.number().xpath('./@cy'),
        r: x.number().xpath('./@r'),
        fill: x.string().xpath('./@fill').optional()
      }),
      '//circle'
    ).optional(),
    paths: x.array(
      x.object({
        d: x.string().xpath('./@d'),
        fill: x.string().xpath('./@fill').optional(),
        stroke: x.string().xpath('./@stroke').optional(),
        strokeWidth: x.number().xpath('./@stroke-width').optional()
      }),
      '//path'
    ).optional()
  })
}).transform(svg => ({
  ...svg,
  aspectRatio: svg.width / svg.height,
  totalShapes:
    (svg.shapes.rectangles?.length || 0) +
    (svg.shapes.circles?.length || 0) +
    (svg.shapes.paths?.length || 0)
}));

type SVG = Infer<typeof svgSchema>;

const svgXml = `
  <svg width="200" height="200" viewBox="0 0 200 200">
    <rect x="10" y="10" width="180" height="180" fill="lightblue" stroke="navy"/>
    <circle cx="100" cy="100" r="50" fill="red"/>
    <circle cx="60" cy="60" r="20" fill="yellow"/>
    <circle cx="140" cy="60" r="20" fill="yellow"/>
    <path d="M 60 120 Q 100 150 140 120" stroke="black" stroke-width="3" fill="none"/>
  </svg>
`;

const svg = svgSchema.parseSync(svgXml);

console.log(`SVG: ${svg.width}x${svg.height} (${svg.aspectRatio}:1)`);
console.log(`Total shapes: ${svg.totalShapes}`);
console.log(`Rectangles: ${svg.shapes.rectangles?.length || 0}`);
console.log(`Circles: ${svg.shapes.circles?.length || 0}`);
console.log(`Paths: ${svg.shapes.paths?.length || 0}`);

svg.shapes.circles?.forEach((circle, i) => {
  console.log(`Circle ${i + 1}: center=(${circle.cx}, ${circle.cy}), radius=${circle.r}, fill=${circle.fill}`);
});
```

## Type-Safe API Response

Create fully type-safe API response parsers:

```typescript
// Define the schema
const apiResponseSchema = x.object({
  status: x.string().xpath('/response/status'),
  timestamp: x.string().xpath('/response/timestamp')
    .transform(v => new Date(v)),
  data: x.object({
    users: x.array(
      x.object({
        id: x.number().xpath('./@id').int(),
        name: x.string().xpath('./name'),
        email: x.string().xpath('./email'),
        verified: x.string().xpath('./@verified')
          .transform(v => v === 'true')
      }),
      '//user'
    )
  }).xpath('/response/data'),
  pagination: x.object({
    page: x.number().xpath('./page').int(),
    perPage: x.number().xpath('./perPage').int(),
    total: x.number().xpath('./total').int(),
    totalPages: x.number().xpath('./totalPages').int()
  }).xpath('/response/pagination')
}).transform(response => ({
  ...response,
  hasNextPage: response.pagination.page < response.pagination.totalPages,
  hasPrevPage: response.pagination.page > 1,
  userCount: response.data.users.length,
  verifiedCount: response.data.users.filter(u => u.verified).length
}));

// Extract the type
type ApiResponse = Infer<typeof apiResponseSchema>;

// Use in an API client
async function fetchUsers(page: number = 1): Promise<ApiResponse> {
  const xml = await fetch(`/api/users?page=${page}`)
    .then(r => r.text());

  return apiResponseSchema.parseSync(xml);
}

// TypeScript knows the exact shape!
const response = await fetchUsers(1);
console.log(`Fetched ${response.userCount} users`);
console.log(`Verified: ${response.verifiedCount}`);
console.log(`Has next page: ${response.hasNextPage}`);

response.data.users.forEach(user => {
  // Full type safety
  console.log(`${user.name} <${user.email}> ${user.verified ? '✓' : ''}`);
});
```

## Best Practices Summary

### 1. Use Type Inference

```typescript
// ✅ Define schema, extract type
const schema = x.object({...});
type Data = Infer<typeof schema>;

// Use type throughout codebase
function process(data: Data) { ... }
```

### 2. Transform for Usability

```typescript
// ✅ Transform to useful types
x.string().xpath('/date').transform(v => new Date(v))
x.string().xpath('/bool').transform(v => v === 'true')
x.string().xpath('/url').transform(v => new URL(v))
```

### 3. Validate Early

```typescript
// ✅ Add constraints
x.number().xpath('/age').min(0).max(120).int()
x.number().xpath('/port').min(1).max(65535)
```

### 4. Use Optional Wisely

```typescript
// ✅ Optional for truly optional fields
const user = x.object({
  id: x.number().xpath('/id'),                    // Required
  bio: x.string().xpath('/bio').optional()        // Optional
});
```

### 5. Aggregate in Transforms

```typescript
// ✅ Calculate aggregates in final transform
.transform(data => ({
  ...data,
  total: data.items.reduce((sum, item) => sum + item.value, 0),
  average: data.items.length > 0
    ? data.items.reduce((sum, item) => sum + item.value, 0) / data.items.length
    : 0
}))
```

## Next Steps

- Review [Schema Types](/stax-xml/v0.5.2/converter/schemas) for all available methods
- Learn [Transformations](/stax-xml/v0.5.2/converter/transformations) for data processing
- Master [XPath](/stax-xml/v0.5.2/converter/xpath-guide) for element selection
- Check [Writing XML](/stax-xml/v0.5.2/converter/writing-xml) for serialization
