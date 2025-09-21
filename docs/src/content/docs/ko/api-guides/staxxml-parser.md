---
title: StaxXmlParser - 비동기 XML 파싱
description: JavaScript/TypeScript용 고성능 비동기 XML 파서
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/staxxml-parser.png
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
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/staxxml-parser.png
---

## StaxXmlParser - 비동기 XML 파싱

`StaxXmlParser`는 Java의 StAX(Streaming API for XML)에서 영감을 받은 JavaScript/TypeScript용 고성능 풀 기반 XML 파서입니다. 모든 파싱 작업이 완전히 비동기적으로 수행되어 메인 스레드를 차단하지 않고 대용량 XML 파일을 처리하기에 이상적입니다.

### 🔧 빠른 시작

#### XML 문자열 파싱

```typescript
import { StaxXmlParser, XmlEventType } from 'stax-xml';

// XML 문자열로부터 ReadableStream 생성
const xmlContent = `
  <books>
    <book id="1">
      <title>The Great Gatsby</title>
      <author>F. Scott Fitzgerald</author>
    </book>
    <book id="2">
      <title>To Kill a Mockingbird</title>
      <author>Harper Lee</author>
    </book>
  </books>
`;

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlContent));
    controller.close();
  }
});

// 풀 기반 방식으로 XML 파싱
const parser = new StaxXmlParser(stream);
const books = [];
let currentBook = null;
let currentText = '';

for await (const event of parser) {
  switch (event.type) {
    case XmlEventType.START_ELEMENT:
      if (event.name === 'book') {
        currentBook = { id: event.attributes?.id || '', title: '', author: '' };
      }
      currentText = '';
      break;
      
    case XmlEventType.CHARACTERS:
      currentText += event.data;
      break;
      
    case XmlEventType.END_ELEMENT:
      if (currentBook) {
        if (event.name === 'title') {
          currentBook.title = currentText.trim();
        } else if (event.name === 'author') {
          currentBook.author = currentText.trim();
        } else if (event.name === 'book') {
          books.push(currentBook);
          currentBook = null;
        }
      }
      break;
  }
}

console.log(books);
// 출력: [
//   { id: "1", title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
//   { id: "2", title: "To Kill a Mockingbird", author: "Harper Lee" }
// ]
```

#### Fetch를 사용한 원격 XML 파싱

```typescript
import { StaxXmlParser, XmlEventType } from 'stax-xml';

async function parseRemoteXml(url: string) {
  try {
    // 원격 URL에서 XML 가져오기
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // 응답 본문을 ReadableStream으로 가져오기
    const xmlStream = response.body;
    
    if (!xmlStream) {
      throw new Error('No response body');
    }
    
    // XML 스트림을 직접 파싱
    const parser = new StaxXmlParser(xmlStream);
    const results = [];
    let currentItem = {};
    let currentText = '';
    
    for await (const event of parser) {
      switch (event.type) {
        case XmlEventType.START_ELEMENT:
          if (event.name === 'item') {
            currentItem = {};
          }
          currentText = '';
          break;
          
        case XmlEventType.CHARACTERS:
          currentText += event.data;
          break;
          
        case XmlEventType.END_ELEMENT:
          if (event.name === 'title' || event.name === 'description') {
            currentItem[event.name] = currentText.trim();
          } else if (event.name === 'item') {
            results.push(currentItem);
          }
          break;
      }
    }
    
    return results;
  } catch (error) {
    console.error('원격 XML 파싱 오류:', error);
    throw error;
  }
}

// 사용 예제
const rssUrl = 'https://example.com/feed.xml';
const xmlApiUrl = 'https://api.example.com/data.xml';

// RSS 피드 파싱
parseRemoteXml(rssUrl)
  .then(items => {
    console.log('RSS 항목:', items);
  })
  .catch(error => {
    console.error('RSS 파싱 실패:', error);
  });

// API 응답 파싱
parseRemoteXml(xmlApiUrl)
  .then(data => {
    console.log('API 데이터:', data);
  })
  .catch(error => {
    console.error('API 응답 파싱 실패:', error);
  });
```

#### 사용자 정의 엔티티 지원

```typescript
const parser = new StaxXmlParser(stream, {
  addEntities: [
    { entity: 'custom', value: 'Custom Value' },
    { entity: 'special', value: '★' }
  ]
});
```

#### 대용량 파일 처리

```typescript
// 대용량 XML 파일의 효율적인 처리
const parser = new StaxXmlParser(largeXmlStream, {
  maxBufferSize: 128 * 1024, // 128KB 버퍼
  enableBufferCompaction: true
});

// 전체 파일을 메모리에 로드하지 않고 이벤트가 발생할 때마다 처리
for await (const event of parser) {
  // 각 이벤트를 개별적으로 처리
  processEvent(event);
}
```

#### 네임스페이스 처리

```typescript
// 네임스페이스가 있는 XML
const xmlWithNamespaces = `
  <root xmlns:ns="http://example.com/namespace">
    <ns:element>Content</ns:element>
  </root>
`;

for await (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log('엘리먼트:', event.name);
    console.log('로컬 이름:', event.localName);
    console.log('네임스페이스 URI:', event.uri);
    console.log('접두사:', event.prefix);
  }
}
```

### 🎯 이벤트 타입

- `START_DOCUMENT`: XML 문서의 시작
- `END_DOCUMENT`: XML 문서의 끝
- `START_ELEMENT`: XML 여는 태그
- `END_ELEMENT`: XML 닫는 태그
- `CHARACTERS`: 태그 사이의 텍스트 내용
- `CDATA`: CDATA 섹션 내용
- `ERROR`: 파싱 오류 발생

### 📚 API 참조

```typescript
class StaxXmlParser {
  constructor(
    xmlStream: ReadableStream<Uint8Array>,
    options?: StaxXmlParserOptions
  )
}

interface StaxXmlParserOptions {
  encoding?: string; // Default: 'utf-8'
  addEntities?: { entity: string, value: string }[];
  autoDecodeEntities?: boolean; // 기본값: true
  maxBufferSize?: number; // 기본값: 64KB
  enableBufferCompaction?: boolean; // 기본값: true
}
```
