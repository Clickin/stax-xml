---
title: Converter - 스키마 타입
description: Converter API의 모든 XML 스키마 타입에 대한 완전한 가이드
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/schemas.png
slug: ko/v1.0.0-rc1/converter/schemas
---

StAX-XML Converter는 다양한 종류의 XML 데이터를 파싱하기 위한 네 가지 핵심 스키마 타입을 제공합니다: 문자열, 숫자, 객체, 배열.

## 문자열 스키마 (`x.string()`)

XML 요소 또는 속성에서 문자열 값을 파싱합니다.

### 기본 사용법

```typescript
import { x } from 'stax-xml/converter';

// 요소 텍스트 내용 파싱
const schema = x.string().xpath('/root/message');
const result = schema.parseSync('<root><message>안녕하세요</message></root>');
// "안녕하세요"
```

### 속성 선택

`/@` 접두사를 사용하여 속성 값 선택:

```typescript
const schema = x.string().xpath('/book/@id');
const result = schema.parseSync('<book id="123">제목</book>');
// "123"

// 하위 속성 검색
const schema = x.string().xpath('//@href');
const result = schema.parseSync('<a><link href="http://example.com"/></a>');
// "http://example.com"
```

### 메서드

#### `.xpath(path: string)`

요소 선택을 위한 XPath 표현식 설정

#### `.writer(config)`

XML 쓰기 동작 구성:

```typescript
const schema = x.string().writer({
  element: 'message',
  cdata: true  // CDATA 섹션으로 래핑
});
```

## 숫자 스키마 (`x.number()`)

유효성 검사를 지원하는 XML에서 숫자 값을 파싱합니다.

### 기본 사용법

```typescript
const schema = x.number().xpath('/data/count');
const result = schema.parseSync('<data><count>42</count></data>');
// 42
```

### 유효성 검사 메서드

#### `.min(value: number)`

최소값 제약 설정:

```typescript
const schema = x.number().xpath('/age').min(18);

schema.parseSync('<age>25</age>');  // ✅ 25
schema.parseSync('<age>15</age>');  // ❌ 에러: 값 15가 최소값 18보다 작음
```

#### `.max(value: number)`

최대값 제약 설정

#### `.int()`

정수 값 요구 (소수점 없음):

```typescript
const schema = x.number().xpath('/count').int();

schema.parseSync('<count>42</count>');    // ✅ 42
schema.parseSync('<count>42.5</count>');  // ❌ 에러: 정수 예상, 42.5 받음
```

### 유효성 검사 체이닝

```typescript
const ageSchema = x.number()
  .xpath('/person/age')
  .min(0)
  .max(120)
  .int();
```

## 객체 스키마 (`x.object()`)

구조화된 데이터를 타입이 지정된 객체로 파싱합니다.

### 기본 사용법

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
    <author>조지 오웰</author>
    <year>1949</year>
    <price>15.99</price>
  </book>
`;

const book = bookSchema.parseSync(xml);
// {
//   title: "1984",
//   author: "조지 오웰",
//   year: 1949,
//   price: 15.99
// }
```

### 타입 추론

TypeScript가 자동으로 객체 타입을 추론합니다:

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
//   active: boolean;  // 주의: transform이 타입을 변경함
// }
```

### 중첩된 객체

객체는 다른 객체를 포함할 수 있습니다:

```typescript
const personSchema = x.object({
  name: x.string().xpath('/person/name'),
  address: x.object({
    street: x.string().xpath('/person/address/street'),
    city: x.string().xpath('/person/address/city'),
    zip: x.string().xpath('/person/address/zip')
  })
});
```

### XPath 스코핑

객체 자체에 XPath를 사용하여 자식 XPath의 범위를 지정:

```typescript
// 객체 XPath 없이 - 절대 경로 필요
const schema1 = x.object({
  cpu: x.string().xpath('/product/specs/cpu'),
  ram: x.string().xpath('/product/specs/ram')
});

// 객체 XPath 사용 - 상대 경로 (더 깔끔함)
const schema2 = x.object({
  cpu: x.string().xpath('./cpu'),
  ram: x.string().xpath('./ram')
}).xpath('/product/specs');
```

## 배열 스키마 (`x.array()`)

반복되는 XML 요소를 배열로 파싱합니다.

### 기본 사용법

```typescript
// 문자열 배열
const schema = x.array(x.string(), '//item');

const xml = `
  <list>
    <item>사과</item>
    <item>바나나</item>
    <item>체리</item>
  </list>
`;

const fruits = schema.parseSync(xml);
// ["사과", "바나나", "체리"]
```

### XPath 필수

**배열은 항상 XPath가 필요합니다** - 어떤 요소를 포함할지 선택:

```typescript
// ❌ 에러: xpath 누락
x.array(x.string());

// ✅ 올바름
x.array(x.string(), '//item');
x.array(x.number(), '//value');
```

### 객체 배열

가장 일반적인 사용 사례 - 구조화된 반복 요소 파싱:

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
      <author>조지 오웰</author>
      <year>1949</year>
    </book>
    <book>
      <title>멋진 신세계</title>
      <author>올더스 헉슬리</author>
      <year>1932</year>
    </book>
  </library>
`;

const books = booksSchema.parseSync(xml);
// [
//   { title: "1984", author: "조지 오웰", year: 1949 },
//   { title: "멋진 신세계", author: "올더스 헉슬리", year: 1932 }
// ]

type Book = Infer<typeof booksSchema>[number];
// { title: string; author: string; year: number; }
```

### XPath 조건절

XPath 조건절로 배열 요소 필터링:

```typescript
// 픽션 책만
const fictionBooks = x.array(
  x.object({
    title: x.string().xpath('./title'),
    author: x.string().xpath('./author')
  }),
  '//book[@category="fiction"]'
);
```

### 중첩 배열

배열은 객체 내에 중첩될 수 있습니다:

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

### 빈 배열

일치하는 요소가 없으면 배열은 빈 `[]`를 반환:

```typescript
const schema = x.array(x.string(), '//item');
const result = schema.parseSync('<root></root>');
// []
```

## 스키마 비교표

| 기능 | String | Number | Object | Array |
|------|--------|--------|--------|-------|
| **목적** | 텍스트 값 | 숫자 값 | 구조화된 데이터 | 반복 요소 |
| **XPath** | 선택사항 | 선택사항 | 선택사항 | **필수** |
| **유효성 검사** | - | min, max, int | 필드별 | 요소별 |
| **중첩** | - | - | 예 (객체 in 객체) | 예 (배열 in 객체) |
| **타입 추론** | `string` | `number` | `{ ... }` | `T[]` |
| **빈 결과** | `""` | `NaN` | `{}` with NaN/empty | `[]` |
| **Transform** | ✅ | ✅ | ✅ | ✅ |
| **Optional** | ✅ | ✅ | ✅ | ✅ |
| **Writer** | ✅ | ✅ | ✅ | ✅ |

## 모범 사례

### 1. 구체적인 XPath 사용

```typescript
// ❌ 너무 광범위
x.string().xpath('//name')  // 모든 name 요소와 일치

// ✅ 구체적인 경로
x.string().xpath('/user/profile/name')
```

### 2. 조기 유효성 검사

```typescript
// ✅ 유효성 검사를 추가하여 조기에 에러 발견
const schema = x.object({
  age: x.number().xpath('//age').min(0).max(120).int(),
  email: x.string().xpath('//email')
});
```

### 3. 스키마 재사용

```typescript
// ✅ 한 번 정의하고 재사용
const priceSchema = x.number().min(0);
const idSchema = x.number().int().min(1);

const productSchema = x.object({
  id: idSchema.xpath('//id'),
  price: priceSchema.xpath('//price'),
  salePrice: priceSchema.xpath('//salePrice').optional()
});
```

### 4. 스코핑을 위한 객체 XPath 사용

```typescript
// ✅ 객체 XPath로 더 깔끔하게
const specs = x.object({
  cpu: x.string().xpath('./cpu'),
  ram: x.string().xpath('./ram'),
  storage: x.string().xpath('./storage')
}).xpath('/product/specs');
```

### 5. 결과 타입 지정

```typescript
// ✅ 재사용을 위한 타입 추출
const userSchema = x.object({...});
type User = Infer<typeof userSchema>;

function processUsers(users: User[]) {
  // TypeScript가 정확한 형태를 알고 있음
}
```

## 다음 단계

- [XPath 패턴](/stax-xml/ko/converter/xpath-guide)으로 고급 요소 선택 학습
- [변환](/stax-xml/ko/converter/transformations)에서 데이터 처리 탐색
- [XML 쓰기](/stax-xml/ko/converter/writing-xml)에서 직렬화 확인
- [예제](/stax-xml/ko/converter/examples)에서 실전 패턴 확인
