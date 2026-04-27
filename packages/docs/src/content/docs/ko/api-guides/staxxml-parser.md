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

`StaxXmlParser`는 Java의 StAX(Streaming API for XML)에서 영감을 받은 JavaScript/TypeScript용 고성능 풀 기반 XML 파서입니다. 공개 API는 stream/backpressure 연동을 위해 비동기이며, tokenizer backend는 도착한 byte batch를 동기적으로 소비합니다.

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
      currentText += event.value;
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

#### 더 구조화된 방식으로 XML 문자열 파싱
```typescript
import { StaxXmlParser, isCharacters, isEndDocument, isEndElement, isStartElement } from 'stax-xml';


// XML 문자열에서 ReadableStream 을 만드는 섹션
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
interface Book {
  id: string
  title: string
  author: string
}

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlContent));
    controller.close();
  }
});

// pull 방식으로 xml 파싱 시작
const parser = new StaxXmlParser(stream);
const books: Book[] = [];

for await (const event of parser) {
  if (isEndDocument(event)) {
    break;
  }
  if (isStartElement(event) && event.name === 'book') {
    books.push(await parseBook(event.attributes?.id || '', parser));
  }
}

/**
 * 개별 book 파싱 
 */
async function parseBook(id: string, parser: StaxXmlParser): Promise<Book> {
  const currentBook = {
    id: id,
    title: '',
    author: ''
  };
  for await (const event of parser) {
    if (isEndElement(event) && event.name === 'book') {
      break;
    }
    else if (isStartElement(event)) {
      const charEvent = (await parser.next()).value;
      if (isCharacters(charEvent) && event.name === 'title') {
        currentBook.title = charEvent.value;
      }
      else if (isCharacters(charEvent) && event.name === 'author') {
        currentBook.author = charEvent.value;
      }
    }
  }
  return currentBook;
}
console.log(books);
// Output: [
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
          currentText += event.value;
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

#### While 기반 반복자 패턴 (StAX와 유사)

```typescript
import { StaxXmlParser, XmlEventType, isStartElement, isEndElement } from 'stax-xml';

// 중첩 구조를 가진 XML 데이터
const xmlContent = `
  <catalog>
    <products>
      <product id="1" category="electronics">
        <name>Laptop</name>
        <price currency="USD">999.99</price>
        <specifications>
          <cpu>Intel i7</cpu>
          <memory>16GB</memory>
          <storage>512GB SSD</storage>
        </specifications>
      </product>
      <product id="2" category="books">
        <name>JavaScript Guide</name>
        <price currency="USD">29.99</price>
        <author>John Doe</author>
      </product>
    </products>
  </catalog>
`;

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlContent));
    controller.close();
  }
});

// while 기반 반복을 사용한 메인 파싱 함수
async function parseCatalog(xmlStream: ReadableStream<Uint8Array>) {
  const parser = new StaxXmlParser(xmlStream);
  const catalog = { products: [] };

  const iterator = parser[Symbol.asyncIterator]();
  let result = await iterator.next();

  while (!result.done) {
    const event = result.value;

    if (isStartElement(event) && event.name === 'products') {
      await parseProducts(iterator, catalog);
    }

    result = await iterator.next();
  }

  return catalog;
}

// 제품들을 위한 별도 파싱 함수
async function parseProducts(iterator: AsyncIterator<any>, catalog: any) {
  let result = await iterator.next();

  while (!result.done) {
    const event = result.value;

    if (isStartElement(event) && event.name === 'product') {
      const product = await parseProduct(iterator, event);
      catalog.products.push(product);
    } else if (isEndElement(event) && event.name === 'products') {
      break;
    }

    result = await iterator.next();
  }
}

// 개별 제품을 위한 별도 파싱 함수
async function parseProduct(iterator: AsyncIterator<any>, startEvent: any) {
  const product = {
    id: startEvent.attributes?.id || '',
    category: startEvent.attributes?.category || '',
    name: '',
    price: { amount: '', currency: '' },
    specifications: {},
    author: ''
  };

  let result = await iterator.next();
  let currentText = '';

  while (!result.done) {
    const event = result.value;

    switch (event.type) {
      case XmlEventType.START_ELEMENT:
        currentText = '';
        if (event.name === 'price') {
          product.price.currency = event.attributes?.currency || '';
        } else if (event.name === 'specifications') {
          await parseSpecifications(iterator, product);
        }
        break;

      case XmlEventType.CHARACTERS:
        currentText += event.value;
        break;

      case XmlEventType.END_ELEMENT:
        if (event.name === 'name') {
          product.name = currentText.trim();
        } else if (event.name === 'price') {
          product.price.amount = currentText.trim();
        } else if (event.name === 'author') {
          product.author = currentText.trim();
        } else if (event.name === 'product') {
          return product;
        }
        break;
    }

    result = await iterator.next();
  }

  return product;
}

// 사양을 위한 별도 파싱 함수
async function parseSpecifications(iterator: AsyncIterator<any>, product: any) {
  let result = await iterator.next();
  let currentText = '';

  while (!result.done) {
    const event = result.value;

    switch (event.type) {
      case XmlEventType.START_ELEMENT:
        currentText = '';
        break;

      case XmlEventType.CHARACTERS:
        currentText += event.value;
        break;

      case XmlEventType.END_ELEMENT:
        if (event.name === 'specifications') {
          return;
        } else if (event.name === 'cpu' || event.name === 'memory' || event.name === 'storage') {
          product.specifications[event.name] = currentText.trim();
        }
        break;
    }

    result = await iterator.next();
  }
}

// 사용법
parseCatalog(stream).then(result => {
  console.log(JSON.stringify(result, null, 2));
  // 출력:
  // {
  //   "products": [
  //     {
  //       "id": "1",
  //       "category": "electronics",
  //       "name": "Laptop",
  //       "price": { "amount": "999.99", "currency": "USD" },
  //       "specifications": {
  //         "cpu": "Intel i7",
  //         "memory": "16GB",
  //         "storage": "512GB SSD"
  //       },
  //       "author": ""
  //     },
  //     {
  //       "id": "2",
  //       "category": "books",
  //       "name": "JavaScript Guide",
  //       "price": { "amount": "29.99", "currency": "USD" },
  //       "specifications": {},
  //       "author": "John Doe"
  //     }
  //   ]
  // }
});
```

#### 대용량 파일 처리

```typescript
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { StaxXmlParser, XmlEventType } from 'stax-xml';

const nodeStream = createReadStream('./large.xml', { highWaterMark: 1024 * 1024 });
const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
const parser = new StaxXmlParser(webStream);

for await (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    processElement(event.name, event.attributes);
  }
}
```

이 경로는 API 경계에서 stream backpressure를 유지합니다. `StaxXmlParser`는 consumer가 다음 event 또는 batch를 요청할 때 다음 `ReadableStream` chunk를 읽습니다. 내부에서는 도착한 byte batch가 tokenizer로 넘어가 동기적으로 처리되므로, 큰 batch를 처리하는 동안에는 현재 worker를 점유할 수 있습니다.

latency-sensitive main thread 작업에서는 batch 크기를 제한하거나 Web Worker 또는 Node worker thread로 parsing을 offload하세요. batch job에서는 synchronous iterable parser가 byte chunk를 직접 소비할 수도 있으므로, parsing을 위해 전체 XML string을 강제할 필요가 없습니다.

#### Unknown XML Tree Object Helper

미리 정의한 converter schema 없이 XML 문서를 그대로 살펴보고 싶을 때는 main package의 tree/object helper를 사용할 수 있습니다:

```typescript
import { parseXmlObjectSync, parseXmlTreeSync } from 'stax-xml';

const xml = '<book id="1"><title>StAX</title><tag>fast</tag><tag>xml</tag></book>';

const tree = parseXmlTreeSync(xml);
console.log(tree.children[0]);

const object = parseXmlObjectSync(xml);
console.log(object.book);
// {
//   '@id': '1',
//   title: 'StAX',
//   tag: ['fast', 'xml']
// }
```

`parseXmlTree()` / `parseXmlTreeSync()`는 Python ElementTree와 비슷한 순서 보존 tree를 반환합니다. `parseXmlObject()` / `parseXmlObjectSync()`는 attribute를 `@` prefix 아래에, text를 `#text`, CDATA를 `#cdata` 아래에 두는 compact object shape을 반환합니다. object helper는 결과 전체를 materialize하므로, unbounded input을 streaming projection해야 한다면 event, cursor, converter API를 사용하세요.

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

### 🛡️ 타입 가드 함수

타입 가드 함수는 XML 이벤트에 대한 런타임 타입 확인과 TypeScript 타입 좁히기를 제공합니다. 이러한 함수들은 XML 이벤트와 함께 작업할 때 타입 안전한 코드를 작성하는 데 필수적이며, TypeScript가 특정 이벤트 타입을 적절히 추론하고 타입별 속성에 접근할 수 있게 해줍니다.

#### 타입 가드란 무엇인가요?

타입 가드는 값의 타입을 결정하기 위해 런타임 확인을 수행하는 함수이며, 동시에 TypeScript에 타입 정보를 제공합니다. stax-xml의 맥락에서, 타입 가드는 타입 오류 없이 이벤트별 속성에 안전하게 접근할 수 있도록 도와줍니다.

#### 사용 가능한 타입 가드 함수

```typescript
import {
  isStartDocument,
  isEndDocument,
  isStartElement,
  isEndElement,
  isCharacters,
  isCdata,
  isError
} from 'stax-xml';
```

#### 타입 가드 사용의 이점

1. **타입 안전성**: 특정 이벤트 타입에 존재하는 속성만 접근하도록 보장하여 런타임 오류를 방지
2. **IntelliSense 지원**: 더 나은 IDE 자동완성 및 제안
3. **깔끔한 코드**: `event.type === XmlEventType.START_ELEMENT`와 같은 수동 타입 확인보다 더 읽기 쉬움
4. **타입 좁히기**: TypeScript가 자동으로 타입을 좁혀주어 타입별 속성에 접근 가능

#### 기본 사용 예제

```typescript
import { StaxXmlParser, isStartElement, isEndElement, isCharacters } from 'stax-xml';

const xmlContent = `
  <book id="123">
    <title>TypeScript Guide</title>
    <author>John Doe</author>
  </book>
`;

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlContent));
    controller.close();
  }
});

const parser = new StaxXmlParser(stream);

for await (const event of parser) {
  // 타입 가드가 타입 안전성과 좁히기를 제공
  if (isStartElement(event)) {
    // TypeScript가 이것이 StartElementEvent임을 인식
    console.log('엘리먼트:', event.name);
    console.log('속성:', event.attributes);
    // event.attributes를 여기서 안전하게 접근 가능
  } else if (isCharacters(event)) {
    // TypeScript가 이것이 CharactersEvent임을 인식
    console.log('텍스트 내용:', event.value);
    // event.value를 여기서 안전하게 접근 가능
  } else if (isEndElement(event)) {
    // TypeScript가 이것이 EndElementEvent임을 인식
    console.log('닫는 엘리먼트:', event.name);
    // event.name을 여기서 안전하게 접근 가능
  }
}
```

#### 오류 처리와 함께하는 고급 사용법

```typescript
import { StaxXmlParser, isStartElement, isCharacters, isError } from 'stax-xml';

async function parseWithErrorHandling(xmlStream: ReadableStream<Uint8Array>) {
  const parser = new StaxXmlParser(xmlStream);
  const result = { elements: [], errors: [] };

  for await (const event of parser) {
    if (isError(event)) {
      // 파싱 오류를 안전하게 처리
      console.error('파싱 오류:', event.error.message);
      result.errors.push(event.error);
      break; // 오류 시 파싱 중단
    } else if (isStartElement(event)) {
      result.elements.push({
        name: event.name,
        attributes: event.attributes
      });
    }
  }

  return result;
}
```

#### 타입 가드 함수 참조

| 함수 | 목적 | 참을 반환하는 경우 | 사용 가능한 속성 |
|------|------|------------------|------------------|
| `isStartDocument(event)` | 문서 시작 | `START_DOCUMENT` 이벤트 | `type` |
| `isEndDocument(event)` | 문서 끝 | `END_DOCUMENT` 이벤트 | `type` |
| `isStartElement(event)` | 여는 태그 | `START_ELEMENT` 이벤트 | `type`, `name`, `localName`, `prefix`, `uri`, `attributes`, `attributesWithPrefix` |
| `isEndElement(event)` | 닫는 태그 | `END_ELEMENT` 이벤트 | `type`, `name`, `localName`, `prefix`, `uri` |
| `isCharacters(event)` | 텍스트 내용 | `CHARACTERS` 이벤트 | `type`, `value` |
| `isCdata(event)` | CDATA 섹션 | `CDATA` 이벤트 | `type`, `value` |
| `isError(event)` | 파싱 오류 | `ERROR` 이벤트 | `type`, `error` |

#### 여러 타입 가드를 사용한 복잡한 파싱 예제

```typescript
import {
  StaxXmlParser,
  isStartDocument,
  isEndDocument,
  isStartElement,
  isEndElement,
  isCharacters,
  isCdata,
  isError
} from 'stax-xml';

interface Article {
  title: string;
  content: string;
  author: string;
  publishDate: string;
}

async function parseArticles(xmlStream: ReadableStream<Uint8Array>): Promise<Article[]> {
  const parser = new StaxXmlParser(xmlStream);
  const articles: Article[] = [];
  let currentArticle: Partial<Article> | null = null;
  let currentElement = '';
  let textBuffer = '';

  for await (const event of parser) {
    if (isStartDocument(event)) {
      console.log('문서 파싱 시작...');
    } else if (isEndDocument(event)) {
      console.log('문서 파싱 완료');
      break;
    } else if (isError(event)) {
      throw new Error(`파싱 실패: ${event.error.message}`);
    } else if (isStartElement(event)) {
      currentElement = event.name;
      textBuffer = '';

      if (event.name === 'article') {
        currentArticle = {
          title: '',
          content: '',
          author: '',
          publishDate: event.attributes?.publishDate || ''
        };
      }
    } else if (isCharacters(event) || isCdata(event)) {
      // CHARACTERS와 CDATA 이벤트 모두 'value' 속성을 가짐
      textBuffer += event.value;
    } else if (isEndElement(event)) {
      const trimmedText = textBuffer.trim();

      if (currentArticle && event.name !== 'article') {
        switch (event.name) {
          case 'title':
            currentArticle.title = trimmedText;
            break;
          case 'content':
            currentArticle.content = trimmedText;
            break;
          case 'author':
            currentArticle.author = trimmedText;
            break;
        }
      } else if (event.name === 'article' && currentArticle) {
        // 모든 필수 필드가 존재하는지 확인
        if (currentArticle.title && currentArticle.content && currentArticle.author) {
          articles.push(currentArticle as Article);
        }
        currentArticle = null;
      }

      textBuffer = '';
      currentElement = '';
    }
  }

  return articles;
}

// 사용 예제
const articleXml = `
  <articles>
    <article publishDate="2024-01-15">
      <title>타입 가드 이해하기</title>
      <author>김철수</author>
      <content><![CDATA[타입 가드는 타입 안전한 TypeScript 개발에 필수적입니다...]]></content>
    </article>
    <article publishDate="2024-01-20">
      <title>XML 파싱 모범 사례</title>
      <author>이영희</author>
      <content>XML을 파싱할 때는 항상 오류를 우아하게 처리해야 합니다...</content>
    </article>
  </articles>
`;

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(articleXml));
    controller.close();
  }
});

parseArticles(stream).then(articles => {
  console.log('파싱된 기사:', articles);
}).catch(error => {
  console.error('파싱 실패:', error);
});
```

#### 비교: 타입 가드 사용 vs 미사용

**타입 가드 미사용 (오류 가능성):**
```typescript
for await (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    // TypeScript가 event에 'attributes' 속성이 있는지 모름
    // 런타임 오류를 발생시킬 수 있음
    console.log(event.attributes?.id); // TypeScript 경고
  }
}
```

**타입 가드 사용 (타입 안전):**
```typescript
for await (const event of parser) {
  if (isStartElement(event)) {
    // TypeScript가 event가 StartElementEvent임을 인식
    // 완전한 IntelliSense 지원과 타입 안전성
    console.log(event.attributes.id); // TypeScript 경고 없음
  }
}
```

### 📚 API 참조

```typescript
class StaxXmlParser {
  constructor(
    xmlStream: ReadableStream<Uint8Array>,
    options?: StaxXmlParserOptions
  )
}

interface StaxXmlParserOptions {
  encoding?: string; // 기본값: 'utf-8'
  addEntities?: { entity: string, value: string }[];
  autoDecodeEntities?: boolean; // 기본값: true
  maxBufferSize?: number; // 기본값: 64KB
  enableBufferCompaction?: boolean; // 기본값: true
}
```
