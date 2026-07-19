---
title: Converter - 변환
description: 강력한 메서드로 파싱된 XML 데이터를 변환하고 처리
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/transformations.png
slug: ko/v0.6.1/converter/transformations
---

변환을 사용하면 파싱 후 데이터를 처리하고 재구성할 수 있습니다. Converter는 세 가지 강력한 메서드를 제공합니다: `.transform()`, `.optional()`, `.array()`.

## Transform 메서드

`.transform()` 메서드는 파싱된 값에 함수를 적용하여 출력을 수정할 수 있게 합니다.

### 기본 사용법

```typescript
import { x } from 'stax-xml/converter';

// 문자열을 파싱하고 대문자로 변환
const schema = x.string()
  .xpath('/message')
  .transform(value => value.toUpperCase());

const xml = '<message>안녕하세요</message>';
const result = schema.parseSync(xml);
// "안녕하세요" (대문자로)
```

### 타입 변환

Transform은 출력 타입을 변경할 수 있습니다:

```typescript
// 문자열을 불린으로
const boolSchema = x.string()
  .xpath('/enabled')
  .transform(value => value === 'true');

// 문자열을 Date로
const dateSchema = x.string()
  .xpath('/publishDate')
  .transform(value => new Date(value));

// 숫자를 포맷팅된 문자열로
const priceSchema = x.number()
  .xpath('/price')
  .transform(value => `₩${value.toLocaleString()}`);
```

### Transform을 사용한 타입 추론

TypeScript는 변환된 타입을 추론합니다:

```typescript
import { type Infer } from 'stax-xml/converter';

const schema = x.string()
  .xpath('/value')
  .transform(v => parseInt(v));

type Output = Infer<typeof schema>;
// number (문자열이 아님)
```

### 객체 변환

전체 객체를 변환하여 데이터를 재구성:

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

type Person = Infer<typeof personSchema>;
// { fullName: string; age: number; isAdult: boolean; }
```

### Transform 체이닝

여러 Transform을 체이닝할 수 있습니다:

```typescript
const schema = x.string()
  .xpath('/value')
  .transform(v => v.trim())           // 1단계: 공백 제거
  .transform(v => v.toLowerCase())    // 2단계: 소문자로
  .transform(v => v.split(','))       // 3단계: 배열로 분할
  .transform(v => v.map(s => s.trim())); // 4단계: 각 항목 공백 제거

// XML: <value>  사과, 바나나,  체리  </value>
// 결과: ["사과", "바나나", "체리"]
```

## Optional 메서드

`.optional()` 메서드는 파싱이 실패할 때 에러를 던지는 대신 `undefined`를 반환하도록 만듭니다.

### 기본 사용법

```typescript
const schema = x.string()
  .xpath('/missing')
  .optional();

const result = schema.parseSync('<root></root>');
// undefined (빈 문자열이 아님)
```

### 타입 추론과 함께

```typescript
import { type Infer } from 'stax-xml/converter';

const schema = x.number()
  .xpath('/value')
  .optional();

type Output = Infer<typeof schema>;
// number | undefined
```

### 객체에서

Optional은 특히 객체 스키마에서 유용합니다:

```typescript
const userSchema = x.object({
  id: x.number().xpath('/user/id'),                    // 필수
  username: x.string().xpath('/user/username'),         // 필수
  email: x.string().xpath('/user/email').optional(),    // 선택사항
  phone: x.string().xpath('/user/phone').optional()     // 선택사항
});
```

### 유효성 검사와 함께

Optional은 유효성 검사와 함께 작동 - 값이 존재할 때만 유효성 검사를 실행:

```typescript
const schema = x.number()
  .xpath('/age')
  .min(0)
  .max(120)
  .optional();

schema.parseSync('<root></root>');          // ✅ undefined
schema.parseSync('<root><age>25</age></root>');   // ✅ 25
schema.parseSync('<root><age>150</age></root>');  // ❌ 에러: 최대값 초과
```

### Optional vs 빈 값

**Optional 없이:**
```typescript
x.string().xpath('/value').parseSync('<root></root>');
// "" (빈 문자열)

x.number().xpath('/value').parseSync('<root></root>');
// NaN
```

**Optional과 함께:**
```typescript
x.string().xpath('/value').optional().parseSync('<root></root>');
// undefined

x.number().xpath('/value').optional().parseSync('<root></root>');
// undefined
```

### Transform과 Optional

Optional은 Transform과 결합할 수 있습니다:

```typescript
// 값이 존재할 때만 변환
const schema = x.string()
  .xpath('/date')
  .optional()
  .transform(v => v ? new Date(v) : undefined);

// 또는 기본값과 함께
const withDefault = x.string()
  .xpath('/value')
  .optional()
  .transform(v => v ?? 'default');
```

## Array 메서드

`.array()` 메서드는 모든 스키마를 배열 스키마로 변환합니다.

### 기본 사용법

```typescript
// 문자열 스키마를 배열로 변환
const stringSchema = x.string();
const arraySchema = stringSchema.array('//item');

const xml = '<root><item>A</item><item>B</item><item>C</item></root>';
const result = arraySchema.parseSync(xml);
// ["A", "B", "C"]

// 직접 생성 (동일)
const directArray = x.array(x.string(), '//item');
```

### Transform과 함께

Transform은 배열 변환 전후에 적용할 수 있습니다:

```typescript
// 각 요소 변환
const transformed = x.string()
  .transform(v => v.toUpperCase())
  .array('//item');

// XML: <root><item>a</item><item>b</item></root>
// 결과: ["A", "B"]

// 전체 배열 변환
const arrayTransformed = x.string()
  .array('//item')
  .transform(arr => arr.filter(s => s.length > 0));
```

## 메서드 체이닝

모든 변환 메서드는 새 스키마 인스턴스를 반환하며 체이닝할 수 있습니다.

### 체이닝 순서가 중요

```typescript
// Transform 후 optional 만들기
const schema1 = x.string()
  .xpath('/value')
  .transform(v => v.toUpperCase())
  .optional();

// Optional 만든 후 transform
const schema2 = x.string()
  .xpath('/value')
  .optional()
  .transform(v => v ? v.toUpperCase() : undefined);
```

### 복잡한 체이닝

```typescript
const schema = x.string()
  .xpath('/data')
  .transform(v => v.trim())           // 공백 정리
  .transform(v => v.toLowerCase())    // 소문자로
  .optional()                         // Optional 만들기
  .array('//data')                    // 배열로 변환
  .transform(arr => [...new Set(arr)]); // 중복 제거

// XML: <root><data>  사과  </data><data>  바나나  </data><data>  사과  </data></root>
// 결과: ["사과", "바나나"]
```

### 실전 예제

```typescript
// 제품 데이터 파싱 및 처리
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
```

## 모범 사례

### 1. 타입 변환에 Transform 사용

```typescript
// ✅ 타입 변경에 transform 사용
const bool = x.string().xpath('/flag').transform(v => v === 'true');
const date = x.string().xpath('/date').transform(v => new Date(v));
```

### 2. 누락된 필드에 Optional 사용

```typescript
// ✅ 진정으로 선택적인 필드에 optional 사용
const user = x.object({
  id: x.number().xpath('/id'),
  bio: x.string().xpath('/bio').optional()
});
```

### 3. Transform 전에 유효성 검사

```typescript
// ✅ 변환 전 유효성 검사
const age = x.number()
  .xpath('/age')
  .min(0)
  .max(120)
  .transform(age => age >= 18 ? 'adult' : 'minor');
```

### 4. Transform을 단순하게 유지

```typescript
// ✅ 간단하고 명확한 transform
const upperCase = x.string()
  .xpath('/value')
  .transform(v => v.toUpperCase());

// ❌ Transform에 복잡한 로직 (테스트/유지보수 어려움)
// 대신: 여러 transform으로 분할하거나 코드에서 처리
```

### 5. 기본값과 함께 Optional 사용

```typescript
// ✅ Optional 값에 기본값 제공
const config = x.object({
  port: x.number().xpath('/port').optional().transform(v => v ?? 8080),
  host: x.string().xpath('/host').optional().transform(v => v ?? 'localhost')
});
```

## 일반 패턴

### 쉼표로 구분된 목록 파싱

```typescript
const tags = x.string()
  .xpath('/tags')
  .transform(v => v.split(',').map(s => s.trim()));
```

### 불린 변형 파싱

```typescript
const bool = x.string()
  .xpath('/enabled')
  .transform(v => {
    const normalized = v.toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  });
```

### 합계 계산

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

## 다음 단계

- [XML 쓰기](/stax-xml/ko/v0.6.1/converter/writing-xml)에서 직렬화 학습
- [예제](/stax-xml/ko/v0.6.1/converter/examples)에서 실전 transform 사용 확인
- [스키마 타입](/stax-xml/ko/v0.6.1/converter/schemas)에서 유효성 검사 옵션 검토
- [핵심 개념](/stax-xml/ko/v0.6.1/converter/core-concepts)에서 기본 사항 확인
