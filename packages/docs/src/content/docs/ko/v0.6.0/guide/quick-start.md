---
title: 빠른 시작
description: StAX-XML로 몇 분 안에 시작하고 실행하기
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/ko/guide/quick-start.png
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
      content: https://clickin.github.io/stax-xml/og/ko/guide/quick-start.png
slug: ko/v0.6.0/guide/quick-start
---

이 가이드는 StAX-XML로 첫 번째 XML 문서를 파싱하는 방법을 도와드립니다.

**ESM-only 패키지:** 모든 예제는 `import` 문법을 사용합니다. `require('stax-xml')`는 지원되지 않습니다.

## 기본 비동기 파싱

비동기 파서를 사용하여 `ReadableStream`에서 XML을 파싱하는 방법입니다:

```typescript
import { StaxXmlParser, XmlEventType } from 'stax-xml';

const xmlContent = `
<bookstore>
  <book id="1">
    <title>위대한 개츠비</title>
    <author>F. 스콧 피츠제럴드</author>
    <price>12.99</price>
  </book>
  <book id="2">
    <title>앵무새 죽이기</title>
    <author>하퍼 리</author>
    <price>14.99</price>
  </book>
</bookstore>
`;

// XML 문자열에서 ReadableStream 생성
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlContent));
    controller.close();
  }
});

async function parseBooks() {
  const parser = new StaxXmlParser(stream);

  for await (const event of parser) {
    if (event.type === XmlEventType.START_ELEMENT) {
      console.log(`시작 요소: ${event.name}`);
      if (event.attributes) {
        console.log('속성:', event.attributes);
      }
    } else if (event.type === XmlEventType.CHARACTERS) {
      const text = event.text.trim();
      if (text) {
        console.log(`텍스트: ${text}`);
      }
    } else if (event.type === XmlEventType.END_ELEMENT) {
      console.log(`종료 요소: ${event.name}`);
    }
  }
}

parseBooks();
```

## 기본 동기 파싱

작은 XML 문자열의 경우 동기 파서를 사용할 수 있습니다:

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

const xmlString = '<greeting>안녕하세요, 세계!</greeting>';
const parser = new StaxXmlParserSync(xmlString);

for (const event of parser) {
  console.log(event.type, event);
}
```

## 객체로 파싱

XML을 JavaScript 객체로 파싱하는 실용적인 예제입니다:

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

interface Book {
  id: string;
  title: string;
  author: string;
  price: number;
}

function parseBooks(xmlString: string): Book[] {
  const parser = new StaxXmlParserSync(xmlString);
  const books: Book[] = [];
  let currentBook: Partial<Book> = {};
  let currentElement = '';

  for (const event of parser) {
    switch (event.type) {
      case XmlEventType.START_ELEMENT:
        if (event.name === 'book') {
          currentBook = { id: event.attributes?.id || '' };
        }
        currentElement = event.name;
        break;

      case XmlEventType.CHARACTERS:
        const text = event.text.trim();
        if (text && currentBook && ['title', 'author', 'price'].includes(currentElement)) {
          if (currentElement === 'price') {
            currentBook.price = parseFloat(text);
          } else {
            (currentBook as any)[currentElement] = text;
          }
        }
        break;

      case XmlEventType.END_ELEMENT:
        if (event.name === 'book' && currentBook.id) {
          books.push(currentBook as Book);
          currentBook = {};
        }
        currentElement = '';
        break;
    }
  }

  return books;
}

const xmlString = `
<bookstore>
  <book id="1">
    <title>위대한 개츠비</title>
    <author>F. 스콧 피츠제럴드</author>
    <price>12.99</price>
  </book>
  <book id="2">
    <title>앵무새 죽이기</title>
    <author>하퍼 리</author>
    <price>14.99</price>
  </book>
</bookstore>
`;

const books = parseBooks(xmlString);
console.log(books);
// 출력: [
//   { id: '1', title: '위대한 개츠비', author: 'F. 스콧 피츠제럴드', price: 12.99 },
//   { id: '2', title: '앵무새 죽이기', author: '하퍼 리', price: 14.99 }
// ]
```

## 오류 처리

StAX-XML은 잘못된 형식의 XML에 대한 오류 이벤트를 제공합니다:

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

const malformedXml = '<root><unclosed>';
const parser = new StaxXmlParserSync(malformedXml);

for (const event of parser) {
  if (event.type === XmlEventType.ERROR) {
    console.error('XML 파싱 오류:', event.message);
    console.error('위치:', event.position);
  }
}
```

## 다음 단계

- 고급 사용 사례를 위한 [예제](/stax-xml/ko/v0.6.0/guide/examples/) 탐색하기
- 성능 비교를 위한 [벤치마크](/stax-xml/ko/v0.6.0/resources/benchmarks/) 보기
