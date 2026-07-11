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
---

이 가이드는 StAX-XML로 첫 번째 XML 문서를 파싱하는 방법을 도와드립니다.

**ESM-only 패키지:** 모든 예제는 `import` 문법을 사용합니다. `require('stax-xml')`는 지원되지 않습니다.

## 기본 비동기 파싱

비동기 event reader를 사용하여 `ReadableStream`에서 XML을 파싱하는 방법입니다:

```typescript
import { EventReader, XmlEventType } from 'stax-xml';

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
  const reader = new EventReader(stream);

  for await (const event of reader) {
    if (event.type === XmlEventType.START_ELEMENT) {
      console.log(`시작 요소: ${event.name}`);
      if (event.attributes) {
        console.log('속성:', event.attributes);
      }
    } else if (event.type === XmlEventType.CHARACTERS) {
      const text = event.value.trim();
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

작은 XML 문자열의 경우 동기 event reader를 사용할 수 있습니다:

```typescript
import { EventReaderSync, XmlEventType } from 'stax-xml';

const xmlString = '<greeting>안녕하세요, 세계!</greeting>';
const reader = new EventReaderSync(xmlString);

for (const event of reader) {
  console.log(event.type, event);
}
```

## Unknown XML 파싱

XML shape를 미리 알 수 없다면 tree를 materialize하지 않고 event stream을
검사하세요.

```typescript
import { EventReaderSync, XmlEventType } from 'stax-xml';

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

for (const event of new EventReaderSync(xmlString)) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log('start', event.name, event.attributes);
  } else if (event.type === XmlEventType.CHARACTERS) {
    console.log('text', event.value);
  }
}
```

Event object allocation이 중요하면 `StreamReaderSync`를 사용하세요. 알려진 shape의
typed domain object에는 converter API를 사용합니다.

## 오류 처리

StAX-XML은 잘못된 형식의 XML에 대한 오류 이벤트를 제공합니다:

```typescript
import { EventReaderSync, XmlEventType } from 'stax-xml';

const malformedXml = '<root><unclosed>';
const reader = new EventReaderSync(malformedXml);

for (const event of reader) {
  if (event.type === XmlEventType.ERROR) {
    console.error('XML 파싱 오류:', event.error.message);
  }
}
```

## 다음 단계

- 고급 사용 사례를 위한 [예제](/stax-xml/ko/guide/examples/) 탐색하기
- 성능 비교를 위한 [벤치마크](/stax-xml/ko/resources/benchmarks/) 보기
