---
title: Converter - XML 쓰기
description: Converter Writer API로 JavaScript 객체를 XML로 직렬화
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/writing-xml.png
slug: ko/v0.5.2/converter/writing-xml
---

StAX-XML Converter는 `.writer()` 구성 메서드와 `.write()` / `.writeSync()` 메서드를 사용하여 JavaScript 객체를 다시 XML로 직렬화할 수 있습니다.

## 기본 XML 쓰기

### 문자열 스키마

```typescript
import { x } from 'stax-xml/converter';

// Writer 구성
const schema = x.string().writer({
  element: 'message'
});

// XML로 쓰기
const xml = schema.writeSync('안녕하세요');
// <message>안녕하세요</message>
```

### 루트 요소와 함께

루트 요소와 XML 선언 추가:

```typescript
const schema = x.string().writer({
  element: 'content'
});

const xml = schema.writeSync('안녕하세요', {
  rootElement: 'root',
  includeDeclaration: true
});
// <?xml version="1.0" encoding="UTF-8"?>
// <root><content>안녕하세요</content></root>
```

### 숫자 스키마

```typescript
const schema = x.number().writer({
  element: 'count'
});

const xml = schema.writeSync(42);
// <count>42</count>
```

## Writer 구성

`.writer()` 메서드는 구성 객체를 받습니다:

```typescript
interface XmlElementWriteConfig {
  element?: string;           // 요소 이름
  attribute?: string;         // 요소 대신 속성으로 쓰기
  cdata?: boolean;            // CDATA로 래핑
  namespace?: string;         // 요소 네임스페이스
  namespacePrefix?: string;   // 네임스페이스 접두사
}
```

### 요소 이름

```typescript
const schema = x.string().writer({
  element: 'title'
});

schema.writeSync('책 제목');
// <title>책 제목</title>
```

### 속성

요소 대신 속성으로 값 쓰기:

```typescript
const schema = x.number().writer({
  attribute: 'id'
});

// 참고: 속성에는 컨테이너 요소가 필요
schema.writeSync(123, { rootElement: 'item' });
// <item id="123"/>
```

### CDATA 섹션

특수 문자를 위해 내용을 CDATA로 래핑:

```typescript
const schema = x.string().writer({
  element: 'description',
  cdata: true
});

schema.writeSync('Text with <tags> & special chars');
// <description><![CDATA[Text with <tags> & special chars]]></description>
```

## 객체 쓰기

객체 스키마는 각 필드를 Writer 구성에 따라 씁니다:

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
  author: '조지 오웰',
  price: 15.99
};

const xml = bookSchema.writeSync(book, { rootElement: 'book' });
// <book id="123">
//   <title>1984</title>
//   <author>조지 오웰</author>
//   <price>15.99</price>
// </book>
```

### 중첩된 객체

```typescript
const personSchema = x.object({
  name: x.string().xpath('/person/name').writer({ element: 'name' }),
  address: x.object({
    street: x.string().xpath('./street').writer({ element: 'street' }),
    city: x.string().xpath('./city').writer({ element: 'city' }),
    zip: x.string().xpath('./zip').writer({ element: 'zip' })
  }).xpath('/person/address').writer({ element: 'address' })
});
```

### 혼합 속성 및 요소

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
```

## 배열 쓰기

배열은 각 요소를 별도의 XML 요소로 씁니다:

```typescript
const itemsSchema = x.array(
  x.string().writer({ element: 'item' }),
  '//item'
);

const items = ['사과', '바나나', '체리'];

const xml = itemsSchema.writeSync(items, { rootElement: 'list' });
// <list>
//   <item>사과</item>
//   <item>바나나</item>
//   <item>체리</item>
// </list>
```

### 객체 배열

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
  { title: '1984', author: '조지 오웰', year: 1949 },
  { title: '멋진 신세계', author: '올더스 헉슬리', year: 1932 }
];

const xml = booksSchema.writeSync(books, { rootElement: 'library' });
```

## 쓰기 옵션

`write()` 및 `writeSync()` 메서드는 옵션을 받습니다:

```typescript
interface XmlWriteOptions {
  rootElement?: string;        // 루트 요소 이름
  includeDeclaration?: boolean; // <?xml?> 선언 추가
  xmlVersion?: string;         // XML 버전 (기본: "1.0")
  encoding?: string;           // 인코딩 (기본: "UTF-8")
  prettyPrint?: boolean;       // 들여쓰기로 포맷
  indent?: string;             // 들여쓰기 문자열 (기본: "  ")
}
```

### Pretty Printing

```typescript
const schema = x.object({
  name: x.string().xpath('/name').writer({ element: 'name' }),
  value: x.number().xpath('/value').writer({ element: 'value' })
});

const data = { name: 'Test', value: 42 };

// Pretty print 없이
const compact = schema.writeSync(data, { rootElement: 'data' });
// <data><name>Test</name><value>42</value></data>

// Pretty print와 함께
const formatted = schema.writeSync(data, {
  rootElement: 'data',
  prettyPrint: true,
  indent: '  '
});
// <data>
//   <name>Test</name>
//   <value>42</value>
// </data>
```

### XML 선언

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

## 비동기 쓰기

일관성을 위해 비동기 쓰기도 지원됩니다:

```typescript
// 비동기 쓰기
const xml = await schema.write(data, { rootElement: 'root' });

// 동기 쓰기
const xml = schema.writeSync(data, { rootElement: 'root' });

// 두 가지 모두 동일한 출력 생성
```

## 양방향 스키마

스키마는 파싱과 쓰기 모두에 사용할 수 있습니다:

```typescript
const userSchema = x.object({
  id: x.number().xpath('/user/@id').writer({ attribute: 'id' }),
  username: x.string().xpath('/user/username').writer({ element: 'username' }),
  email: x.string().xpath('/user/email').writer({ element: 'email' }),
  active: x.string()
    .xpath('/user/@active')
    .writer({ attribute: 'active' })
    .transform(v => v === 'true')  // 파싱: 문자열 -> 불린
});

// XML을 객체로 파싱
const xml = '<user id="123" active="true"><username>john</username><email>john@example.com</email></user>';
const user = userSchema.parseSync(xml);

// 객체를 XML로 쓰기
const reverseData = {
  id: 456,
  username: 'jane',
  email: 'jane@example.com',
  active: 'true'  // 참고: 불린이 아닌 문자열 제공 필요
};

const outputXml = userSchema.writeSync(reverseData, { rootElement: 'user' });
```

**참고**: Transform은 파싱 중에만 적용되며 쓰기 중에는 적용되지 않습니다. Writer가 기대하는 형식의 데이터를 제공해야 합니다.

## 엔티티 이스케이핑

Writer는 자동으로 특수 XML 문자를 이스케이프합니다:

```typescript
const schema = x.string().writer({ element: 'text' });

const xml = schema.writeSync('Text with <tags> & "quotes"', { rootElement: 'root' });
// <root><text>Text with &lt;tags&gt; &amp; &quot;quotes&quot;</text></root>
```

이스케이프를 피하려면 CDATA 사용:

```typescript
const schema = x.string().writer({ element: 'text', cdata: true });

const xml = schema.writeSync('Text with <tags> & "quotes"', { rootElement: 'root' });
// <root><text><![CDATA[Text with <tags> & "quotes"]]></text></root>
```

## 모범 사례

### 1. 일관된 파싱/쓰기 스키마

```typescript
// ✅ 양방향으로 작동하는 스키마
const schema = x.object({
  id: x.number().xpath('/@id').writer({ attribute: 'id' }),
  name: x.string().xpath('/name').writer({ element: 'name' })
});
```

### 2. 사용자 콘텐츠에 CDATA 사용

```typescript
// ✅ HTML/특수 콘텐츠에 CDATA
const schema = x.string().writer({
  element: 'content',
  cdata: true
});
```

### 3. 모든 필드 구성

```typescript
// ✅ 모든 필드에 writer 구성
const schema = x.object({
  a: x.string().xpath('/a').writer({ element: 'a' }),
  b: x.number().xpath('/b').writer({ element: 'b' })
});

// ❌ writer 구성 누락
const incomplete = x.object({
  a: x.string().xpath('/a').writer({ element: 'a' }),
  b: x.number().xpath('/b')  // writer 없음!
});
```

### 4. Optional 필드 처리

```typescript
// Optional 필드는 undefined이면 건너뜀
const schema = x.object({
  required: x.string().xpath('/required').writer({ element: 'required' }),
  optional: x.string().xpath('/optional').optional().writer({ element: 'optional' })
});

schema.writeSync({ required: 'value', optional: undefined });
// <required>value</required>
// (optional 요소는 포함되지 않음)
```

## 다음 단계

- [예제](/stax-xml/ko/v0.5.2/converter/examples)에서 완전한 양방향 스키마 확인
- [스키마 타입](/stax-xml/ko/v0.5.2/converter/schemas)에서 쓰기 중 유효성 검사 검토
- [변환](/stax-xml/ko/v0.5.2/converter/transformations)에서 데이터 준비 확인
- [XPath](/stax-xml/ko/v0.5.2/converter/xpath-guide)로 정확한 필드 매핑 학습
