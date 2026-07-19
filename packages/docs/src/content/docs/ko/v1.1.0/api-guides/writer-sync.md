---
title: WriterSync - 동기식 XML 생성
description: 메모리 내 문자열과 sink 기반 대용량 출력을 지원하는 동기식 XML writer
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/writer-sync.png
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
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/writer-sync.png
slug: ko/v1.1.0/api-guides/writer-sync
---

## WriterSync - 동기식 XML 생성

StAX-XML에는 프로그래밍 방식으로 XML 문서를 생성하는 동기식 XML writer가 포함되어 있습니다. `WriterSync`는 완성된 XML 문자열을 메모리에 만듭니다. `WriterSyncSink`는 같은 동기 writer 모델을 사용하면서 sink로 증분 출력하므로, 대용량 출력에서도 전체 XML 문자열을 보관하지 않고 높은 처리량을 유지할 수 있습니다.

v1.1의 `writeEvent()`는 `EventReaderSync` event를 직접 받으므로 fixture → reader
→ modify → writer pipeline을 manual event dispatch 없이 구성할 수 있습니다.
[XML 변환 파이프라인](/stax-xml/ko/guide/event-pipelines/)을 참고하세요.

대용량 파일 출력에는 sink 경로를 권장합니다. 1GiB writer 벤치마크에서 `WriterSyncSink`가 가장 높은 쓰기 처리량을 보였고, peak RSS는 async 쓰기와 같은 범위에 머물렀습니다.

### 🔧 빠른 시작

##### 로컬 파일에 쓰기

```typescript
import { WriterSync } from 'stax-xml';
import { writeFileSync } from 'fs';

// Node.js용 - 로컬 파일에 동기식으로 쓰기
function createLocalXmlFile() {
  const writer = new WriterSync({
    prettyPrint: true,
    indentString: '  '
  });

  // XML 문서 작성
  writer.writeStartDocument('1.0', 'utf-8');

  writer.writeStartElement('catalog', { attributes: { version: '1.0' } });

  writer.writeStartElement('product', { attributes: { id: '001' } });

  writer.writeStartElement('name');
  writer.writeCharacters('노트북 컴퓨터');
  writer.writeEndElement();

  writer.writeStartElement('price', { attributes: { currency: 'KRW' } });
  writer.writeCharacters('1200000');
  writer.writeEndElement();

  writer.writeEndElement(); // product
  writer.writeEndElement(); // catalog

  writer.writeEndDocument();

  // 최종 XML 문자열을 가져와서 파일에 쓰기
  writeFileSync('./output.xml', writer.getXmlString());
  console.log('XML 파일이 성공적으로 생성되었습니다!');
}

createLocalXmlFile();
```

##### Express.js 미들웨어 - XML 응답

```typescript
import express from 'express';
import { WriterSync } from 'stax-xml';

const app = express();

// XML 응답을 생성하는 미들웨어
app.get('/api/users', (req, res) => {
  try {
    // 샘플 데이터
    const users = [
      { id: 1, name: '홍길동', email: 'hong@example.com' },
      { id: 2, name: '김영희', email: 'kim@example.com' }
    ];

    const writer = new WriterSync({
      prettyPrint: true,
      indentString: '  '
    });

    // 적절한 헤더 설정
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    // XML 작성
    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('users');

    for (const user of users) {
      writer.writeStartElement('user', { attributes: { id: user.id.toString() } });

      writer.writeStartElement('name');
      writer.writeCharacters(user.name);
      writer.writeEndElement();

      writer.writeStartElement('email');
      writer.writeCharacters(user.email);
      writer.writeEndElement();

      writer.writeEndElement(); // user
    }

    writer.writeEndElement(); // users
    writer.writeEndDocument();

    // 최종 XML 문자열 전송
    res.send(writer.getXmlString());

  } catch (error) {
    res.status(500).json({ error: 'XML 생성에 실패했습니다' });
  }
});

app.listen(3000, () => {
  console.log('서버가 포트 3000에서 실행 중입니다');
});
```

##### Hono 프레임워크 - XML 응답

```typescript
import { Hono } from 'hono';
import { WriterSync } from 'stax-xml';

const app = new Hono();

app.get('/api/products', (c) => {
  // 샘플 제품 데이터
  const products = [
    { id: 'P001', name: '스마트폰', price: 800000, category: '전자제품' },
    { id: 'P002', name: '헤드폰', price: 250000, category: '전자제품' },
    { id: 'P003', name: '커피메이커', price: 180000, category: '가전제품' }
  ];

  const writer = new WriterSync({
    prettyPrint: true,
    indentString: '    '
  });

  try {
    // XML 생성
    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('products', {
      attributes: {
        count: products.length.toString(),
        generated: new Date().toISOString()
      }
    });

    for (const product of products) {
      writer.writeStartElement('product', {
        attributes: {
          id: product.id,
          category: product.category
        }
      });

      writer.writeStartElement('name');
      writer.writeCharacters(product.name);
      writer.writeEndElement();

      writer.writeStartElement('price', { attributes: { currency: 'KRW' } });
      writer.writeCharacters(product.price.toString());
      writer.writeEndElement();

      writer.writeEndElement(); // product
    }

    writer.writeEndElement(); // products
    writer.writeEndDocument();

    // 생성된 XML 문자열을 응답으로 반환
    return c.text(writer.getXmlString(), 200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-cache',
    });

  } catch (error) {
    return c.text('XML 생성에 실패했습니다', 500);
  }
});

export default app;
```

##### Sink 기반 증분 쓰기

`WriterSyncSink`는 작은 `SyncTextSink` interface를 구현한 모든 object에 쓸 수
있습니다. Runtime standard library로 필요한 target을 구성하세요.

외부 encoder를 쓸 때는 sink에 `encoding` metadata를 지정하고 각 text chunk를 sink에서
encoding합니다. XML declaration은 이 값과 일치해야 합니다. Stateful encoder는
`close()`에서 마지막 byte를 반드시 flush해야 합니다.

```typescript
import iconv from 'iconv-lite';
import { closeSync, openSync, writeSync } from 'node:fs';
import { WriterSyncSink } from 'stax-xml';

const fd = openSync('./catalog-euc-kr.xml', 'w');
const encoder = iconv.getEncoder('euc-kr');
const writer = new WriterSyncSink({
  encoding: 'EUC-KR',
  write(chunk) { writeSync(fd, encoder.write(chunk)); },
  close() {
    const tail = encoder.end();
    if (tail) writeSync(fd, tail);
    closeSync(fd);
  },
});

writer.writeStartDocument();
writer.writeStartElement('catalog').writeCharacters('한국어').writeEndElement();
writer.close();
```

```typescript
import { closeSync, openSync, writeSync } from 'node:fs';
import { WriterSyncSink } from 'stax-xml';

const fd = openSync('./catalog.xml', 'w');
const writer = new WriterSyncSink(
  {
    write(chunk) { writeSync(fd, chunk); },
    close() { closeSync(fd); }
  },
  {
    bufferSize: 4096,
    enableAutoFlush: true,
    flushThreshold: 0.7
  }
);

writer.writeStartDocument('1.0', 'utf-8');
writer.writeStartElement('catalog', { attributes: { version: '1.0' } });
writer.writeStartElement('product', { attributes: { id: '001' } });
writer.writeStartElement('name');
writer.writeCharacters('노트북 컴퓨터');
writer.writeEndElement();
writer.writeEndElement(); // product
writer.writeEndElement(); // catalog
writer.close();
```

`writer.flush()`는 writer 버퍼를 비우고 가능하면 `sink.flush()`도 호출합니다.
`writer.close()`는 필요하면 문서를 마무리하고, 설정에 따라 `sink.flush()`를 호출한 뒤 target을 닫습니다.

##### 고급 라이터 기능

```typescript
import { WriterSync } from 'stax-xml';

// 사용자 정의 엔티티와 네임스페이스를 사용한 메모리 내 XML 생성
function createAdvancedXml() {
  const writer = new WriterSync({
    prettyPrint: true,
    indentString: '  ',
    addEntities: [
      { entity: 'company', value: 'Acme Corporation' },
      { entity: 'copyright', value: '© 2024' }
    ],
    autoEncodeEntities: true
  });

  // 네임스페이스와 사용자 정의 엔티티를 사용한 XML 작성
  writer.writeStartDocument('1.0', 'utf-8');

  writer.writeStartElement('document', {
    prefix: 'doc',
    uri: 'http://example.com/document',
    attributes: { version: '2.0' }
  });
  writer.writeNamespace('meta', 'http://example.com/metadata');

  writer.writeStartElement('header', { prefix: 'meta' });
  writer.writeStartElement('title');
  writer.writeCharacters('제품 카탈로그');
  writer.writeEndElement();

  writer.writeStartElement('company');
  writer.writeCharacters('&company;'); // 자동으로 인코딩됩니다
  writer.writeEndElement();
  writer.writeEndElement(); // header

  writer.writeStartElement('content');
  writer.writeStartElement('item', { attributes: { type: 'featured' } });

  // 자체 닫힘 요소
  writer.writeStartElement('thumbnail', {
    attributes: {
      src: 'image.jpg',
      alt: '제품 이미지'
    },
    selfClosing: true
  });

  writer.writeStartElement('description');
  writer.writeCData('<p>이것은 CDATA 안의 <b>HTML</b> 콘텐츠입니다</p>');
  writer.writeEndElement();

  writer.writeEndElement(); // item
  writer.writeEndElement(); // content
  writer.writeEndElement(); // document

  writer.writeEndDocument();

  return writer.getXmlString();
}

// 사용법
console.log('생성된 XML:', createAdvancedXml());
```

##### 통합 WriteElementOptions API

WriterSync는 모든 옵션을 단일 `WriteElementOptions` 객체로 통합하여 요소 생성을 단순화하는 통합 API를 지원합니다:

```typescript
import { WriterSync, WriteElementOptions } from 'stax-xml';

function createXmlWithNewAPI() {
  const writer = new WriterSync({ prettyPrint: true });

  writer.writeStartDocument();

  // 속성이 있는 기본 요소
  writer.writeStartElement('catalog', {
    attributes: { version: '2.0', xmlns: 'http://example.com/catalog' }
  });

  // 네임스페이스와 속성이 있는 요소
  writer.writeStartElement('product', {
    prefix: 'cat',
    uri: 'http://example.com/catalog',
    attributes: { id: '001', featured: 'true' }
  });

  writer.writeStartElement('name');
  writer.writeCharacters('프리미엄 노트북');
  writer.writeEndElement();

  // 속성이 있는 자체 닫힘 요소
  writer.writeStartElement('thumbnail', {
    attributes: {
      src: 'image.jpg',
      alt: '제품 이미지',
      width: '200'
    },
    selfClosing: true  // writeEndElement() 호출 불필요
  });

  // 간단한 자체 닫힘 요소
  writer.writeStartElement('br', { selfClosing: true });

  writer.writeEndElement(); // product
  writer.writeEndElement(); // catalog

  writer.writeEndDocument();
  return writer.getXmlString();
}

// 출력:
// <?xml version="1.0" encoding="UTF-8"?>
// <catalog version="2.0" xmlns="http://example.com/catalog">
//   <cat:product id="001" featured="true" xmlns:cat="http://example.com/catalog">
//     <name>프리미엄 노트북</name>
//     <thumbnail src="image.jpg" alt="제품 이미지" width="200"/>
//     <br/>
//   </cat:product>
// </catalog>
```

**통합 API의 주요 장점:**

- **통합 매개변수**: 모든 요소 옵션(속성, 네임스페이스, 자체 닫힘)이 단일 옵션 객체로 통합됨
- **자체 닫힘 지원**: `selfClosing: true` 설정으로 `writeEndElement()` 호출 없이 자동으로 요소 닫힘
- **깔끔한 구문**: 더 직관적이고 읽기 쉬운 코드 구조
- **타입 안전성**: 포괄적인 타입 정의를 통한 완전한 TypeScript 지원

**사용 예제:**

```typescript
// 속성이 있는 간단한 요소
writer.writeStartElement('img', {
  attributes: {
    src: 'image.jpg',
    alt: '이미지'
  },
  selfClosing: true
});

// 네임스페이스가 있는 요소
writer.writeStartElement('title', {
  prefix: 'html',
  uri: 'http://www.w3.org/1999/xhtml',
  attributes: { lang: 'ko' }
});
```

### 📚 API 참조

```typescript
class WriterSync {
  constructor(
    options?: WriterSyncOptions
  )

  // 문서 레벨 메서드
  writeStartDocument(version?: '1.0', encoding?: string, standalone?: boolean): this // UTF-8 only
  writeEndDocument(): void

  // 요소 작성 메서드
  writeStartElement(localName: string, options?: WriteElementOptions): this
  writeEndElement(): this

  // 속성 및 네임스페이스 메서드
  writeAttribute(localName: string, value: string, prefix?: string): this
  writeNamespace(prefix: string, uri: string): this

  // 콘텐츠 작성 메서드
  writeCharacters(text: string): this
  writeCData(cdata: string): this
  writeComment(comment: string): this
  writeProcessingInstruction(target: string, data?: string): this
  writeDTD(value: string): this
  writeEvent(event: AnyXmlEvent): this
  writeRaw(xml: string): this

  // 유틸리티 메서드
  setPrettyPrint(enabled: boolean): this
  setIndentString(indentString: string): this
  isPrettyPrintEnabled(): boolean
  getIndentString(): string
  getXmlString(): string
}

interface WriterSyncOptions {
  encoding?: string; // WriterSync: UTF-8; WriterSyncSink: sink.encoding과 일치
  prettyPrint?: boolean; // 기본값: false
  indentString?: string; // 기본값: '  '
  addEntities?: { entity: string, value: string }[];
  autoEncodeEntities?: boolean; // 기본값: true
}

interface SyncTextSink {
  readonly encoding?: string; // 외부 sink가 생성할 encoding; 기본값: UTF-8
  write(chunk: string): void;
  flush?(): void;
  close?(): void;
}

interface WriterSyncSinkOptions extends WriterSyncOptions {
  bufferSize?: number;       // 기본값: 16 * 1024
  enableAutoFlush?: boolean; // 기본값: true
  flushThreshold?: number;   // 기본값: 0.8 또는 절대 문자 수
  flushOnClose?: boolean;    // 기본값: false
}

class WriterSyncSink {
  constructor(
    sink: SyncTextSink,
    options?: WriterSyncSinkOptions
  )

  // 문서 레벨 메서드
  flush(): void
  close(): void
}

```

`WriterSync`와 `WriterSyncSink`는 encoded byte가 아니라 JavaScript text를
생성합니다. `WriterSync`의 declaration metadata는 UTF-8로 제한됩니다.
`WriterSyncSink`는 `sink.encoding`으로 다른 encoding을 선언할 수 있으며 sink가 실제
외부 encoding을 수행해야 하고 `options.encoding`도 같은 값이어야 합니다.

### 🚀 주요 기능

- **동기식 작업**: 완성된 XML 문자열이 즉시 필요하면 `WriterSync` 사용
- **Sink 기반 대용량 출력**: performance와 memory를 함께 챙겨야 하면 `WriterSyncSink` 사용
- **프리티 프린팅**: 구성 가능한 들여쓰기 및 포맷팅
- **네임스페이스 지원**: 접두사 관리를 통한 완전한 XML 네임스페이스 처리
- **엔티티 인코딩**: 자동 또는 사용자 정의 엔티티 인코딩
- **자체 닫힘 요소**: 자체 닫힘 태그에 대한 내장 지원
- **타입 안전성**: 세부적인 타입 정의를 통한 완전한 TypeScript 지원
- **메모리 효율적**: sink 경로에서는 전체 XML 문자열을 보관하지 않고 증분 출력

### 💡 WriterSync 사용 시기

다음과 같은 경우에 `WriterSync` / `WriterSyncSink`를 사용하세요:
- 완전한 XML 문서를 메모리에서 즉시 필요로 할 때
- `WriterSyncSink`를 통해 커스텀 sync sink로 직접 쓰고 싶을 때
- 웹 API용 XML 응답 빌드 시
- 구성 파일이나 데이터 내보내기 생성 시
- 블로킹이 허용되는 동기식 워크플로우에서 작업 시
- 동기식 응답/파일 쓰기가 필요한 워크플로우에서 작업 시

Web `WritableStream` response workflow에는 async `Writer`를 사용하세요. 대용량 동기식 파일/응답 쓰기에는 `WriterSyncSink`를 사용하세요.
