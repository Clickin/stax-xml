---
title: Converter - 시작하기
description: 타입 안전한 스키마를 사용하는 선언적 XML 컨버터 API 사용 방법
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/getting-started.png
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
      content: https://clickin.github.io/stax-xml/og/converter/getting-started.png
slug: ko/v0.5.2/converter/getting-started
---

StAX-XML Converter는 완전한 타입 안전성과 XPath 지원을 갖춘 선언적이고 Zod 스타일의 API를 제공합니다.

## Converter란?

Converter는 다음을 가능하게 하는 고수준 XML 파싱 API입니다:

- **타입 안전한 스키마 정의** - 유연한 빌더 API 사용
- **XPath로 요소 선택** - 정확한 요소 타겟팅
- **데이터 유효성 검사** - 내장된 검증 메서드
- **결과 변환** - 후처리 함수 제공
- **TypeScript 타입 자동 추론** - 스키마에서 자동 추론

저수준 이벤트 기반 `StaxXmlParser`와 달리, Converter는 XML에서 구조화된 데이터를 추출하는 선언적 방법을 제공합니다.

:::note[Zod에서 영감을 받았습니다]
Converter API 디자인은 인기 있는 TypeScript 우선 스키마 검증 라이브러리인 [Zod](https://github.com/colinhacks/zod)에서 많은 영감을 받았습니다. XML 파싱을 위해 Zod의 우아한 fluent API 패턴과 타입 추론 방식을 채택했습니다. Zod에 익숙하다면 Converter도 편안하게 사용하실 수 있습니다!
:::

## 설치

Converter는 `stax-xml` 패키지에 포함되어 있으며 별도로 import할 수 있습니다:

```typescript
import { x } from 'stax-xml/converter';
```

또는 특정 타입을 import:

```typescript
import { x, type Infer, XmlParseError } from 'stax-xml/converter';
```

## 빠른 예제

다음은 책 XML 문서를 파싱하는 간단한 예제입니다:

```typescript
import { x, type Infer } from 'stax-xml/converter';

// 스키마 정의
const bookSchema = x.object({
  title: x.string().xpath('/book/title'),
  author: x.string().xpath('/book/author'),
  year: x.number().xpath('/book/year'),
  price: x.number().xpath('/book/price').min(0)
});

// TypeScript 타입 추론
type Book = Infer<typeof bookSchema>;
// { title: string; author: string; year: number; price: number; }

// XML 파싱
const xml = `
  <book>
    <title>위대한 개츠비</title>
    <author>F. Scott Fitzgerald</author>
    <year>1925</year>
    <price>10.99</price>
  </book>
`;

const book = bookSchema.parseSync(xml);
console.log(book);
// {
//   title: "위대한 개츠비",
//   author: "F. Scott Fitzgerald",
//   year: 1925,
//   price: 10.99
// }
```

## 주요 기능

### 타입 안전성

Converter는 완전한 TypeScript 타입 추론을 제공합니다. IDE가 파싱된 데이터의 정확한 형태를 알 수 있습니다:

```typescript
const schema = x.object({
  name: x.string().xpath('//name'),
  count: x.number().xpath('//count')
});

const result = schema.parseSync(xml);
// TypeScript가 알고 있음: { name: string; count: number; }
```

### XPath 지원

XPath 표현식을 사용하여 XML에서 요소를 정확하게 타겟팅:

```typescript
// 절대 경로
x.string().xpath('/root/element')

// 하위 요소 검색
x.string().xpath('//element')

// 속성
x.string().xpath('/@id')

// 조건절
x.array(x.object({...}), '//book[@category="fiction"]')
```

### 유효성 검사

내장된 유효성 검사 메서드로 데이터가 요구사항을 충족하는지 확인:

```typescript
const schema = x.object({
  age: x.number().xpath('//age').min(0).max(120).int(),
  email: x.string().xpath('//email'),
  score: x.number().xpath('//score').min(0).max(100)
});
```

### 변환

사용자 정의 함수로 파싱된 데이터 변환:

```typescript
const schema = x.object({
  firstName: x.string().xpath('//firstName'),
  lastName: x.string().xpath('//lastName')
}).transform(person => ({
  fullName: `${person.firstName} ${person.lastName}`
}));

// 결과: { fullName: "홍 길동" }
```

### 동기 및 비동기 API

동기 및 비동기 파싱 모두 지원:

```typescript
// 동기
const result = schema.parseSync(xmlString);

// 비동기
const result = await schema.parse(xmlString);

// 안전한 파싱 (예외 대신 에러 객체 반환)
const result = schema.safeParseSync(xmlString);
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.issues);
}
```

## Converter를 사용해야 하는 경우

**Converter 사용:**
- XML 구조를 미리 알고 있을 때
- 타입 안전성과 유효성 검사가 필요할 때
- 선언적 API를 원할 때
- 구조화된 데이터 추출이 필요할 때

**저수준 StaxXmlParser 사용:**
- 최대 성능과 제어가 필요할 때
- XML 구조가 동적이거나 알 수 없을 때
- 이벤트 기반 처리를 원할 때
- 스트리밍 애플리케이션을 구축할 때

## 스키마 빌더 (x)

`x` 객체는 Converter API의 진입점입니다. 스키마 생성을 위한 팩토리 메서드를 제공합니다:

- `x.string()` - 문자열 값 파싱
- `x.number()` - 숫자 값 파싱
- `x.object({})` - 구조화된 객체 파싱
- `x.array()` - 요소 배열 파싱

모든 스키마는 **불변**입니다 - `.xpath()`, `.min()`, `.transform()` 같은 메서드는 새 스키마 인스턴스를 반환합니다.

## 다음 단계

- [핵심 개념](/stax-xml/ko/v0.5.2/converter/core-concepts)에서 스키마 기본 사항 학습
- [스키마 타입](/stax-xml/ko/v0.5.2/converter/schemas)에서 상세한 API 레퍼런스 탐색
- [XPath](/stax-xml/ko/v0.5.2/converter/xpath-guide)로 요소 선택 마스터
- [예제](/stax-xml/ko/v0.5.2/converter/examples)에서 실전 사용 패턴 확인

## 예제: RSS 피드 파서

다음은 RSS 피드를 파싱하는 더 복잡한 예제입니다:

```typescript
const rssSchema = x.object({
  title: x.string().xpath('/rss/channel/title'),
  items: x.array(
    x.object({
      title: x.string().xpath('./title'),
      link: x.string().xpath('./link'),
      pubDate: x.string().xpath('./pubDate')
    }),
    '//item'
  )
});

type RSS = Infer<typeof rssSchema>;

const rss = rssSchema.parseSync(rssXml);
console.log(`피드: ${rss.title}`);
rss.items.forEach(item => {
  console.log(`- ${item.title}: ${item.link}`);
});
```

Converter는 XML 파싱을 간단하고, 타입 안전하며, 유지보수하기 쉽게 만듭니다!
