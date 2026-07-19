---
title: Converter - 핵심 개념
description: 선언적 XML Converter의 기본 개념 이해
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/core-concepts.png
slug: ko/v0.5.0/converter/core-concepts
---

이 가이드는 StAX-XML Converter를 효과적으로 사용하기 위해 이해해야 할 기본 개념을 다룹니다.

## 스키마 빌더 (`x`)

`x` 객체는 XML 스키마를 생성하는 주요 인터페이스입니다:

```typescript
import { x } from 'stax-xml/converter';

// 스키마 생성
const stringSchema = x.string();
const numberSchema = x.number();
const objectSchema = x.object({...});
const arraySchema = x.array(elementSchema, xpath);
```

### Fluent API 패턴

모든 스키마 메서드는 **새 스키마 인스턴스를 반환**하여 API를 불변하고 체이닝 가능하게 만듭니다:

```typescript
const schema = x.number()
  .xpath('//price')
  .min(0)
  .max(1000);

// 각 메서드는 새 스키마를 반환
const baseNumber = x.number();
const withXPath = baseNumber.xpath('//value');  // 새 인스턴스
const withMin = withXPath.min(0);               // 새 인스턴스

// 원본은 변경되지 않음
console.log(baseNumber.options.xpath);  // undefined
console.log(withXPath.options.xpath);   // '//value'
```

## 파싱 모드

Converter는 다양한 사용 사례를 위한 여러 파싱 메서드를 제공합니다:

### 동기 파싱

동기, 블로킹 파싱을 위해 `parseSync()` 사용:

```typescript
const schema = x.string().xpath('//title');
const result = schema.parseSync(xmlString);
// 반환: string
```

**사용 시기:**
- XML이 이미 문자열로 메모리에 있을 때
- 동기 컨텍스트에 있을 때
- 성능이 중요할 때 (비동기보다 약간 빠름)

### 비동기 파싱

비동기 파싱을 위해 `parse()` 사용:

```typescript
const schema = x.object({
  name: x.string().xpath('//name'),
  value: x.number().xpath('//value')
});

const result = await schema.parse(xmlString);
// 반환: Promise<{ name: string; value: number; }>
```

### 안전한 파싱

안전한 파싱 메서드는 예외를 던지는 대신 결과 객체를 반환합니다:

```typescript
const schema = x.number().xpath('//age').min(0).max(120);

// 안전한 동기 파싱
const result = schema.safeParseSync('<age>150</age>');

if (result.success) {
  console.log(result.data);  // number
} else {
  console.log(result.issues);  // 에러 객체 배열
}
```

## 타입 추론

Converter는 `Infer` 유틸리티 타입을 사용하여 자동 TypeScript 타입 추론을 제공합니다:

```typescript
import { x, type Infer } from 'stax-xml/converter';

const userSchema = x.object({
  id: x.number().xpath('//id'),
  username: x.string().xpath('//username'),
  email: x.string().xpath('//email'),
  active: x.string().xpath('//active').transform(v => v === 'true')
});

// 자동으로 타입 추론
type User = Infer<typeof userSchema>;
// {
//   id: number;
//   username: string;
//   email: string;
//   active: boolean;  // 주의: 변환된 타입!
// }

// 추론된 타입 사용
const users: User[] = [];
```

### 복잡한 타입 추론

타입 추론은 중첩 구조 및 변환과 함께 작동합니다:

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

## XPath 통합

XPath는 XML 문서에서 요소를 선택하는 주요 방법입니다.

### XPath 기초

```typescript
// 루트에서 절대 경로
x.string().xpath('/root/element/child')

// 하위 요소 검색 (문서 어디서나)
x.string().xpath('//element')

// 속성 접근
x.string().xpath('/@id')
x.string().xpath('//@href')

// 결합
x.string().xpath('/root/item/@name')
```

### 다양한 스키마의 XPath

**String 및 Number 스키마:**
```typescript
const title = x.string().xpath('/book/title');
const price = x.number().xpath('/book/price');
```

**Object 스키마:**
```typescript
// 개별 필드의 XPath
const book = x.object({
  title: x.string().xpath('/book/title'),
  author: x.string().xpath('/book/author')
});

// 전체 객체의 XPath (자식 XPath 범위 지정)
const book = x.object({
  title: x.string().xpath('./title'),     // /book에 상대적
  author: x.string().xpath('./author')     // /book에 상대적
}).xpath('/book');
```

**Array 스키마:**
```typescript
// 배열에는 XPath 필수
const items = x.array(
  x.string(),
  '//item'  // 모든 <item> 요소 선택
);
```

## 에러 처리

Converter는 파싱이 실패할 때 상세한 에러 정보를 제공합니다:

### XmlParseError

```typescript
import { XmlParseError } from 'stax-xml/converter';

try {
  const result = schema.parseSync(invalidXml);
} catch (error) {
  if (error instanceof XmlParseError) {
    console.log(error.message);  // 사람이 읽을 수 있는 메시지
    console.log(error.issues);    // 구체적인 문제 배열
  }
}
```

### 에러 복구 전략

**1. Optional 사용**
```typescript
const schema = x.object({
  id: x.number().xpath('//id'),
  optional: x.string().xpath('//optional').optional()
});
// 반환: { id: number; optional: string | undefined }
```

**2. 안전한 파싱 사용**
```typescript
const result = schema.safeParseSync(xml);
if (!result.success) {
  // 에러를 우아하게 처리
  return defaultValue;
}
return result.data;
```

**3. 기본값을 위한 Transform 사용**
```typescript
const schema = x.string()
  .xpath('//value')
  .transform(v => v || 'default');
```

## 스키마 구성

스키마는 구성하고 재사용할 수 있습니다:

### 스키마 재사용

```typescript
// 재사용 가능한 스키마 정의
const priceSchema = x.number().min(0);
const idSchema = x.number().int().min(1);

// 객체에서 구성
const productSchema = x.object({
  id: idSchema.xpath('//id'),
  price: priceSchema.xpath('//price'),
  salePrice: priceSchema.xpath('//salePrice').optional()
});
```

### 중첩 객체

```typescript
const addressSchema = x.object({
  street: x.string().xpath('./street'),
  city: x.string().xpath('./city'),
  zip: x.string().xpath('./zip')
}).xpath('/address');

const personSchema = x.object({
  name: x.string().xpath('/person/name'),
  address: addressSchema  // 중첩된 객체 스키마
});
```

## 성능 고려사항

### 동기 vs 비동기

```typescript
// 동기 - 작은 문서에 약간 더 빠름
const result = schema.parseSync(smallXml);

// 비동기 - 큰 문서에 더 좋음
const result = await schema.parse(largeXml);
```

### XPath 최적화

```typescript
// ❌ 느림 - 전체 문서를 여러 번 검색
const schema = x.object({
  a: x.string().xpath('//a'),
  b: x.string().xpath('//b'),
  c: x.string().xpath('//c')
});

// ✅ 더 좋음 - 단일 루트 XPath, 상대 자식
const schema = x.object({
  a: x.string().xpath('./a'),
  b: x.string().xpath('./b'),
  c: x.string().xpath('./c')
}).xpath('/root');
```

### 스키마 재사용

```typescript
// ❌ 매번 새 스키마 생성
function parseUser(xml: string) {
  const schema = x.object({...});
  return schema.parseSync(xml);
}

// ✅ 스키마를 한 번 정의하고 재사용
const userSchema = x.object({...});

function parseUser(xml: string) {
  return userSchema.parseSync(xml);
}
```

## 다음 단계

- [스키마 타입](/stax-xml/ko/v0.5.0/converter/schemas)에서 상세 API 레퍼런스 탐색
- [XPath 패턴](/stax-xml/ko/v0.5.0/converter/xpath-guide)으로 요소 선택 학습
- [변환](/stax-xml/ko/v0.5.0/converter/transformations)에서 데이터 처리 확인
- [예제](/stax-xml/ko/v0.5.0/converter/examples)에서 실전 패턴 확인
