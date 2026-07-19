---
title: Converter - 실전 예제
description: 프로덕션 시나리오에서 XML Converter 사용에 대한 종합 예제
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/examples.png
slug: ko/v0.6.0/converter/examples
---

이 가이드는 일반적인 XML 파싱 시나리오에 StAX-XML Converter를 사용하는 완전한 프로덕션 준비 예제를 제공합니다.

## RSS 피드 파서

완전한 타입 안전성으로 RSS/Atom 피드 파싱:

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

// 사용법
const xml = await fetch('https://example.com/feed.xml').then(r => r.text());
const feed = rssSchema.parseSync(xml);

console.log(`피드: ${feed.channelTitle}`);
feed.items.forEach(item => {
  console.log(`- [${item.publishedAt.toLocaleDateString()}] ${item.title}`);
  console.log(`  ${item.url.href}`);
});
```

## 전자상거래 제품 카탈로그

사양, 카테고리 및 가격으로 제품 카탈로그 파싱:

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
  formattedPrice: `${product.currency} ${product.price.toLocaleString()}`
}));

type Product = Infer<typeof productSchema>;

const catalogXml = `
  <product id="12345" sku="LAPTOP-001">
    <name>프로페셔널 노트북</name>
    <price currency="KRW">999000</price>
    <stock>15</stock>
    <categories>
      <category>전자제품</category>
      <category>컴퓨터</category>
    </categories>
    <specs>
      <spec name="CPU">Intel i7-13700H</spec>
      <spec name="RAM">16GB DDR5</spec>
      <spec name="저장공간">512GB NVMe SSD</spec>
    </specs>
  </product>
`;

const product = productSchema.parseSync(catalogXml);
console.log(`${product.name} - ${product.formattedPrice}`);
console.log(`재고: ${product.inStock ? `${product.stock}개 이용 가능` : '품절'}`);
```

## 애플리케이션 구성

유효성 검사를 사용하여 복잡한 구성 파일 파싱:

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
      enabled: x.string().xpath('./@enabled').transform(v => v === 'true')
    }),
    '/config/features/feature'
  )
});

type AppConfig = Infer<typeof configSchema>;

// 구성 사용
const config = configSchema.parseSync(configXml);
console.log(`${config.appName} v${config.version} 시작 중`);
console.log(`환경: ${config.environment}`);
console.log(`데이터베이스: ${config.database.host}:${config.database.port}`);
```

## 사용자 데이터 및 유효성 검사

사용자 레코드 파싱 및 유효성 검사:

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
    bio: x.string().xpath('./bio').optional()
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
type Users = Infer<typeof usersSchema>;

const users = usersSchema.parseSync(usersXml);
users.forEach(user => {
  console.log(`${user.fullName} (${user.email})`);
  console.log(`  나이: ${user.age} (${user.isAdult ? '성인' : '미성년자'})`);
  console.log(`  상태: ${user.isActive ? '활성' : '비활성'}`);
  console.log(`  계정 나이: ${user.accountAge}일`);
});
```

## 판매 분석

판매 데이터 파싱 및 집계:

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

  // 집계 계산
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalDiscount = sales.reduce((sum, s) => sum + s.discountAmount, 0);
  const avgOrderValue = totalRevenue / sales.length;

  // 제품별 그룹화
  const productSales = sales.reduce((acc, sale) => {
    if (!acc[sale.product]) {
      acc[sale.product] = { quantity: 0, revenue: 0 };
    }
    acc[sale.product].quantity += sale.quantity;
    acc[sale.product].revenue += sale.total;
    return acc;
  }, {} as Record<string, { quantity: number; revenue: number }>);

  return {
    sales,
    summary: {
      totalSales: sales.length,
      totalRevenue,
      totalDiscount,
      avgOrderValue,
      productSales
    }
  };
});

type SalesReport = Infer<typeof salesSchema>;

const report = salesSchema.parseSync(salesXml);
console.log('=== 판매 요약 ===');
console.log(`총 판매: ${report.summary.totalSales}`);
console.log(`총 수익: ₩${report.summary.totalRevenue.toLocaleString()}`);
console.log(`평균 주문 금액: ₩${report.summary.avgOrderValue.toLocaleString()}`);
```

## SVG 문서 파싱

SVG에서 도형 및 속성 추출:

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
        fill: x.string().xpath('./@fill').optional()
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
    ).optional()
  })
}).transform(svg => ({
  ...svg,
  aspectRatio: svg.width / svg.height,
  totalShapes:
    (svg.shapes.rectangles?.length || 0) +
    (svg.shapes.circles?.length || 0)
}));

type SVG = Infer<typeof svgSchema>;

const svg = svgSchema.parseSync(svgXml);
console.log(`SVG: ${svg.width}x${svg.height} (${svg.aspectRatio}:1)`);
console.log(`총 도형: ${svg.totalShapes}`);
```

## 타입 안전한 API 응답

완전히 타입 안전한 API 응답 파서 생성:

```typescript
// 스키마 정의
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

// 타입 추출
type ApiResponse = Infer<typeof apiResponseSchema>;

// API 클라이언트에서 사용
async function fetchUsers(page: number = 1): Promise<ApiResponse> {
  const xml = await fetch(`/api/users?page=${page}`)
    .then(r => r.text());

  return apiResponseSchema.parseSync(xml);
}

// TypeScript가 정확한 형태를 알고 있음!
const response = await fetchUsers(1);
console.log(`${response.userCount}명의 사용자 가져옴`);
console.log(`인증됨: ${response.verifiedCount}`);
console.log(`다음 페이지 있음: ${response.hasNextPage}`);
```

## 모범 사례 요약

### 1. 타입 추론 사용

```typescript
// ✅ 스키마 정의, 타입 추출
const schema = x.object({...});
type Data = Infer<typeof schema>;

// 코드베이스 전체에서 타입 사용
function process(data: Data) { ... }
```

### 2. 유용성을 위한 Transform

```typescript
// ✅ 유용한 타입으로 변환
x.string().xpath('/date').transform(v => new Date(v))
x.string().xpath('/bool').transform(v => v === 'true')
x.string().xpath('/url').transform(v => new URL(v))
```

### 3. 조기 유효성 검사

```typescript
// ✅ 제약 조건 추가
x.number().xpath('/age').min(0).max(120).int()
x.number().xpath('/port').min(1).max(65535)
```

### 4. Optional을 현명하게 사용

```typescript
// ✅ 진정으로 선택적인 필드에만 optional
const user = x.object({
  id: x.number().xpath('/id'),                    // 필수
  bio: x.string().xpath('/bio').optional()        // 선택사항
});
```

### 5. Transform에서 집계

```typescript
// ✅ 최종 transform에서 집계 계산
.transform(data => ({
  ...data,
  total: data.items.reduce((sum, item) => sum + item.value, 0),
  average: data.items.length > 0
    ? data.items.reduce((sum, item) => sum + item.value, 0) / data.items.length
    : 0
}))
```

## 다음 단계

- [스키마 타입](/stax-xml/ko/v0.6.0/converter/schemas)에서 사용 가능한 모든 메서드 검토
- [변환](/stax-xml/ko/v0.6.0/converter/transformations)에서 데이터 처리 학습
- [XPath](/stax-xml/ko/v0.6.0/converter/xpath-guide)로 요소 선택 마스터
- [XML 쓰기](/stax-xml/ko/v0.6.0/converter/writing-xml)에서 직렬화 확인
