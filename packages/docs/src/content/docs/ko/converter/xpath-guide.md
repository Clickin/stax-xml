---
title: Converter - XPath 가이드
description: 정확한 XML 요소 선택을 위한 XPath 표현식 마스터
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/xpath-guide.png
---

XPath (XML Path Language)는 StAX-XML Converter에서 요소를 선택하는 주요 방법입니다. 이 가이드는 지원되는 모든 XPath 패턴과 모범 사례를 다룹니다.

## XPath란?

XPath는 XML 문서에서 노드를 선택하는 쿼리 언어입니다. XML용 CSS 선택자와 같습니다:

- **CSS 선택자**: `div.container > p`
- **XPath**: `/div[@class='container']/p`

Converter는 XPath를 사용하여 XML에서 **어떤** 요소를 추출할지 지정합니다.

## XPath 기초

### 절대 경로

`/`로 문서 루트에서 시작:

```typescript
// <book> 바로 아래의 <title> 선택
x.string().xpath('/book/title')

// 중첩 경로
x.string().xpath('/library/book/title')
```

### 하위 요소 검색

`//`를 사용하여 문서 어디서나 검색:

```typescript
// 어떤 깊이에서든 <title> 찾기
x.string().xpath('//title')

// 알 수 없는 구조에 유용
x.array(x.string(), '//error')  // 모든 에러 메시지
```

⚠️ **성능 참고**: `//`는 전체 문서를 검색합니다. 가능하면 절대 경로를 사용하세요.

XPath 1.0 런타임 평가기를 사용하는 경로에서는 여러 descendant step도 지원됩니다:

```typescript
x.string().xpath('//root//books')
x.array(x.string(), '//section//item')

// 구조를 알고 있다면 여전히 더 빠른 형태
x.string().xpath('/root/catalog/books')
```

**성능 참고**: full XPath 1.0 표현식은 경량 문서 트리 위에서 평가됩니다. 단순 converter selector는 기존 compiled event-table fast path를 계속 사용할 수 있습니다.

### 상대 경로

`./`를 현재 컨텍스트에 상대적인 경로로 사용:

```typescript
const specs = x.object({
  cpu: x.string().xpath('./cpu'),
  ram: x.string().xpath('./ram'),
  storage: x.string().xpath('./storage')
}).xpath('/product/specs');
```

## 속성 선택

### 단순 속성

`/@`를 사용하여 속성 값 선택:

```typescript
// id 속성 선택
x.string().xpath('/book/@id')

// 중첩 속성
x.number().xpath('/product/item/@price')
```

### 하위 속성

`//@`로 어디서나 속성 검색:

```typescript
// 모든 href 속성 찾기
x.string().xpath('//@href')

// 모든 id 속성
x.array(x.string(), '//@id')
```

### 텍스트 콘텐츠 선택

`text()`를 사용하여 직접 텍스트 콘텐츠만 선택:

```typescript
// 요소 콘텐츠 (중첩 요소 포함)
x.string().xpath('/message')

// 직접 텍스트 콘텐츠만 (중첩 요소 제외)
x.string().xpath('/message/text()')

// 차이점 예제:
// XML: <div>안녕 <span>세계</span></div>
x.string().xpath('/div')        // "안녕 세계" (모든 텍스트)
x.string().xpath('/div/text()')  // "안녕 " (직접 텍스트만)
```

## XPath 조건절

조건절은 `[...]`를 사용하여 조건에 따라 요소를 필터링합니다.

### 속성 값 조건절

```typescript
// category="fiction"인 책
const fictionBooks = x.array(
  x.object({
    title: x.string().xpath('./title'),
    author: x.string().xpath('./author')
  }),
  '//book[@category="fiction"]'
);
```

### 다중 조건

```typescript
// 사용 가능하고 재고가 있는 제품
x.array(
  x.object({...}),
  '//product[@available="true"][@inStock="true"]'
);
```

### 위치 조건절

```typescript
// 첫 번째 책
x.object({...}).xpath('//book[1]')

// 두 번째 책
x.object({...}).xpath('//book[2]')

// 세 번째 책
x.object({...}).xpath('//book[3]')
```

XPath 1.0 런타임 평가기에서는 위치 함수도 지원됩니다:

```typescript
x.object({...}).xpath('//book[last()]')
x.object({...}).xpath('//book[position() = 2]')
```

## 실전 XPath 예제

### RSS 피드 파싱

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

### 전자상거래 제품 카탈로그

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

## XPath 모범 사례

### 1. 구체적으로 작성

```typescript
// ❌ 너무 광범위 - 모든 name과 일치
x.string().xpath('//name')

// ✅ 구체적인 경로
x.string().xpath('/user/profile/name')

// ✅ 조건절 사용
x.string().xpath('//user[@role="admin"]/name')
```

### 2. 객체와 함께 상대 경로 사용

```typescript
// ❌ 반복적인 절대 경로
const user = x.object({
  name: x.string().xpath('/user/profile/details/name'),
  email: x.string().xpath('/user/profile/details/email'),
  phone: x.string().xpath('/user/profile/details/phone')
});

// ✅ 객체 XPath로 더 깔끔하게
const user = x.object({
  name: x.string().xpath('./name'),
  email: x.string().xpath('./email'),
  phone: x.string().xpath('./phone')
}).xpath('/user/profile/details');
```

### 3. 필터링에 조건절 사용

```typescript
// ❌ 모든 제품을 가져와 코드에서 필터
const products = x.array(x.object({...}), '//product');
const available = products.filter(p => p.available);

// ✅ XPath로 필터링
const available = x.array(
  x.object({...}),
  '//product[@available="true"]'
);
```

### 4. 하위 요소보다 절대 경로 선호

```typescript
// ❌ 느림 - 전체 문서 검색
x.string().xpath('//deeply/nested/element')

// ✅ 빠름 - 직접 경로
x.string().xpath('/root/section/deeply/nested/element')
```

## 일반 XPath 패턴 치트시트

| 패턴 | 예제 | 설명 |
|------|------|------|
| `/element` | `/book` | 루트 요소 |
| `/parent/child` | `/book/title` | 직접 자식 |
| `//element` | `//title` | 문서 어디서나 |
| `/@attr` | `/@id` | 현재 요소의 속성 |
| `//@attr` | `//@href` | 어디서나 속성 |
| `/element/@attr` | `/book/@id` | 특정 요소의 속성 |
| `//element[@attr="value"]` | `//book[@category="fiction"]` | 속성 값이 있는 요소 |
| `//element[1]` | `//book[1]` | 첫 번째 일치 요소 |
| `//element[2]` | `//book[2]` | 두 번째 일치 요소 |
| `/element/text()` | `/message/text()` | 직접 텍스트 콘텐츠만 |
| `./child` | `./name` | 상대 자식 |
| `./@attr` | `./@id` | 상대 속성 |

## XPath 1.0 지원 범위

Converter는 런타임 평가기를 통해 XPath 1.0 표현식을 지원합니다. 포함되는 범위는 다음과 같습니다:

- 13개 XPath axis 전체: `ancestor`, `ancestor-or-self`, `attribute`, `child`, `descendant`, `descendant-or-self`, `following`, `following-sibling`, `namespace`, `parent`, `preceding`, `preceding-sibling`, `self`
- Node test: `node()`, `text()`, `comment()`, `processing-instruction()`, 이름 테스트, wildcard
- `position()`과 `last()`를 포함한 predicate
- boolean, equality, relational, arithmetic expression
- `contains()`, `starts-with()`, `substring()`, `normalize-space()`, `translate()`, `count()`, `sum()`, `name()`, `local-name()`, `namespace-uri()` 같은 XPath 1.0 core function
- `ParseOptions.xpathNamespaces`를 통한 namespaced element/attribute 이름

```typescript
const title = x.string()
  .xpath('string(//p:book[last()]/p:title)')
  .parseSync(xml, {
    xpathNamespaces: { p: 'urn:books' }
  });
```

XPath 1.0은 namespace 규칙이 XML 기본 namespace와 다릅니다. prefix 없는 name test는 namespace가 없는 노드만 매칭합니다. 기본 namespace를 쓰는 XML은 `xpathNamespaces`에 prefix를 바인딩한 뒤 XPath 표현식에서도 그 prefix를 사용하세요.

Full XPath 표현식은 이벤트를 직접 streaming 평가하지 않습니다. compiled fast path로 낮출 수 없는 표현식은 먼저 경량 in-memory document representation을 만들고 그 트리 위에서 XPath를 평가합니다.

## 다음 단계

- [변환](/stax-xml/ko/converter/transformations)에서 후처리 학습
- [스키마 타입](/stax-xml/ko/converter/schemas)에서 유효성 검사 옵션 확인
- [예제](/stax-xml/ko/converter/examples)에서 실전 XPath 사용 탐색
- [XML 쓰기](/stax-xml/ko/converter/writing-xml)에서 직렬화 확인
