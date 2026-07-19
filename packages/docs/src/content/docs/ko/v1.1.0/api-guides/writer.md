---
title: Writer - 비동기 XML 스트림 라이터
description: 대용량 문서와 실시간 생성을 위한 스트림 기반 비동기 XML 라이터
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/writer.png
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
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/writer.png
slug: ko/v1.1.0/api-guides/writer
---

## Writer - 비동기 XML 스트림 라이터

`Writer`는 논블로킹 `WritableStream` 워크플로우, 스트리밍 응답, 실시간 XML 생성을 위한 비동기 스트림 기반 XML 라이터입니다.

v1.1의 `writeEvent()`는 `EventReader`가 반환한 안정적인 object를 직접 받습니다.
따라서 reader → modify → writer 변환을 하나의 streaming pipeline으로 구성할 수
있습니다. [XML 변환 파이프라인](/stax-xml/ko/guide/event-pipelines/)을 참고하세요.

대용량 파일이나 대용량 문서를 최대 처리량으로 생성해야 한다면 [`WriterSyncSink`](/stax-xml/ko/api-guides/writer-sync/#sink-기반-증분-쓰기)를 권장합니다. 1GiB writer 벤치마크에서 sync sink 경로가 가장 높은 쓰기 처리량을 보였고, peak RSS는 async 쓰기와 같은 범위에 머물렀습니다.

### 주요 기능

- **스트림 기반**: 메모리 효율성을 위해 WritableStream에 직접 작성
- **비동기**: 논블로킹 작업을 위해 모든 메서드가 promise 반환
- **대용량 문서 지원**: 비동기 스트림 아키텍처가 필요한 경우 임의 크기의 XML 문서 처리
- **메모리 효율적**: 전체 XML을 메모리에 저장할 필요 없음
- **실시간 생성**: 스트리밍 API와 라이브 데이터에 완벽

> **참고**: 작은 동기식 출력에는 문자열 builder인 `WriterSync`를 사용하고, 대용량 파일 출력에는 `WriterSyncSink`를 사용하세요.

### 외부 encoder 연결

기본 `WritableStream<Uint8Array>` 경로는 UTF-8을 출력합니다. `iconv-lite` 같은
streaming encoder를 연결하려면 `AsyncTextSink`를 전달합니다. Sink의 `encoding`이 XML
declaration에 사용되고 `write()` promise로 backpressure를 전달합니다. 명시한 declaration
encoding과 sink encoding이 다르면 선제 거부합니다.

```typescript
import iconv from 'iconv-lite';
import { createWriteStream } from 'node:fs';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Writer, type AsyncTextSink } from 'stax-xml';

const encoder = iconv.encodeStream('shift_jis');
const completed = pipeline(encoder, createWriteStream('./catalog.xml'));
const output = Writable.toWeb(encoder).getWriter();
const sink: AsyncTextSink = {
  encoding: 'Shift_JIS',
  write: chunk => output.write(chunk),
  close: () => output.close(),
};

const writer = new Writer(sink);
await writer.writeStartDocument();
await writer.writeStartElement('catalog');
await writer.writeCharacters('日本語');
await writer.close();
await completed;
```

### 🔧 빠른 시작

```typescript
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { Writer } from 'stax-xml';

const app = new Hono();

app.get('/api/products', (c) => {
  // 샘플 제품 데이터
  const products = [
    { id: 'P001', name: 'Smartphone', price: 699.99, category: 'Electronics' },
    { id: 'P002', name: 'Headphones', price: 199.99, category: 'Electronics' },
    { id: 'P003', name: 'Coffee Maker', price: 149.99, category: 'Appliances' }
  ];

  // 적절한 헤더 설정
  c.header('Content-Type', 'application/xml; charset=utf-8');
  c.header('Cache-Control', 'no-cache');

  return stream(c, async (stream) => {
    const writer = new Writer(stream, {
      prettyPrint: true,
      indentString: '    '
    });

    try {
      // 스트림에 직접 XML 생성 - 모든 메서드에 await 필요
      await writer.writeStartDocument('1.0', 'utf-8');
      await writer.writeStartElement('products', {
        attributes: {
          count: products.length.toString(),
          generated: new Date().toISOString()
        }
      });

      for (const product of products) {
        await writer.writeStartElement('product', {
          attributes: {
            id: product.id,
            category: product.category
          }
        });

        await writer.writeStartElement('name');
        await writer.writeCharacters(product.name);
        await writer.writeEndElement();

        await writer.writeStartElement('price', { attributes: { currency: 'USD' } });
        await writer.writeCharacters(product.price.toString());
        await writer.writeEndElement();

        await writer.writeEndElement(); // product
      }

      await writer.writeEndElement(); // products
      await writer.writeEndDocument();
      await writer.close(); // 중요: 스트림 닫기

    } catch (error) {
      console.error('XML 생성 오류:', error);
      // 참고: 스트리밍 컨텍스트에서 오류 처리는 제한적입니다
    }
  });
});

export default app;
```

##### 네임스페이스와 사용자 정의 엔터티를 포함한 고급 기능

```typescript
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { Writer } from 'stax-xml';

const app = new Hono();

app.get('/api/catalog', (c) => {
  const items = [
    { id: '001', name: 'Premium Laptop', featured: true },
    { id: '002', name: 'Wireless Mouse', featured: false }
  ];

  c.header('Content-Type', 'application/xml; charset=utf-8');

  return stream(c, async (stream) => {
    const writer = new Writer(stream, {
      prettyPrint: true,
      indentString: '  ',
      addEntities: [
        { entity: 'company', value: 'Acme Corporation' },
        { entity: 'copyright', value: '© 2024' }
      ],
      autoEncodeEntities: true
    });

    try {
      // 네임스페이스와 사용자 정의 엔터티로 XML 작성
      await writer.writeStartDocument('1.0', 'utf-8');

      await writer.writeStartElement('catalog', {
        prefix: 'cat',
        uri: 'http://example.com/catalog',
        attributes: { version: '2.0' }
      });
      await writer.writeStartElement('header', {
        prefix: 'meta',
        uri: 'http://example.com/metadata'
      });
      await writer.writeStartElement('title');
      await writer.writeCharacters('Product Catalog');
      await writer.writeEndElement();

      await writer.writeStartElement('company');
      await writer.writeCharacters('&company;'); // 자동으로 인코딩됩니다
      await writer.writeEndElement();
      await writer.writeEndElement(); // header

      await writer.writeStartElement('products');
      for (const item of items) {
        await writer.writeStartElement('product', {
          attributes: { id: item.id, featured: item.featured.toString() }
        });

        await writer.writeStartElement('name');
        await writer.writeCharacters(item.name);
        await writer.writeEndElement();

        // 자체 닫는 엘리먼트
        await writer.writeStartElement('thumbnail', {
          attributes: {
            src: `${item.id}.jpg`,
            alt: 'Product Image'
          },
          selfClosing: true
        });

        await writer.writeStartElement('description');
        await writer.writeCData('<p>This is <b>HTML</b> content in CDATA</p>');
        await writer.writeEndElement();

        await writer.writeEndElement(); // product
      }
      await writer.writeEndElement(); // products
      await writer.writeEndElement(); // catalog

      await writer.writeEndDocument();
      await writer.close();

    } catch (error) {
      console.error('XML 생성 오류:', error);
    }
  });
});

export default app;
```

##### WriteElementOptions API

`Writer`는 엘리먼트 생성을 단순화하는 통합 API를 지원합니다:

```typescript
// 속성이 있는 자체 닫는 엘리먼트
await writer.writeStartElement('img', {
  attributes: {
    src: 'image.jpg',
    alt: 'Image'
  },
  selfClosing: true  // writeEndElement() 호출 불필요
});

// 네임스페이스가 있는 엘리먼트
await writer.writeStartElement('title', {
  prefix: 'html',
  uri: 'http://www.w3.org/1999/xhtml',
  attributes: { lang: 'ko' }
});
```

### 📚 API 참조

#### Writer (비동기식, 스트림 기반)

```typescript
class Writer {
  constructor(output: WritableStream<Uint8Array> | AsyncTextSink, options?: WriterOptions)

  // 문서 레벨 메서드
  writeStartDocument(version?: '1.0', encoding?: string, standalone?: boolean): Promise<this> // output encoding과 일치
  writeEndDocument(): Promise<void>

  // 엘리먼트 작성 메서드
  writeStartElement(localName: string, options?: WriteElementOptions): Promise<this>
  writeEndElement(): Promise<this>
  writeAttribute(localName: string, value: string, prefix?: string): Promise<this>
  writeNamespace(prefix: string, uri: string): Promise<this>

  // 콘텐츠 작성 메서드
  writeCharacters(text: string): Promise<this>
  writeCData(cdata: string): Promise<this>
  writeComment(comment: string): Promise<this>
  writeProcessingInstruction(target: string, data?: string): Promise<this>
  writeDTD(value: string): Promise<this>
  writeEvent(event: AnyXmlEvent): Promise<this>
  writeRaw(xml: string): Promise<this>

  // 스트림 관리
  close(): Promise<void>  // 기본 스트림 닫기
  flush(): Promise<void>  // 수동 플러시
}

interface WriterOptions {
  encoding?: string; // Byte stream: UTF-8; text sink: sink.encoding과 일치
  prettyPrint?: boolean; // 기본값: false
  indentString?: string; // 기본값: '  '
  addEntities?: { entity: string, value: string }[];
  autoEncodeEntities?: boolean; // 기본값: true
  bufferSize?: number; // 기본값: 16384
  flushThreshold?: number; // 기본값: 0.8
  enableAutoFlush?: boolean; // 기본값: true
}

interface AsyncTextSink {
  readonly encoding: string;
  write(chunk: string): void | Promise<void>;
  flush?(): void | Promise<void>;
  close?(): void | Promise<void>;
}
```

`WritableStream<Uint8Array>` 경로는 web platform `TextEncoder`가 UTF-8-only이므로
항상 UTF-8 byte를 출력합니다. `AsyncTextSink`는 다른 encoding을 선언하고 외부
encoding을 수행할 수 있으며, `options.encoding`과 `writeStartDocument()`는 sink
metadata와 일치해야 합니다.
Declaration version은 XML 1.0입니다. Parser와 writer validation 계약이 XML 1.0이므로
XML 1.1은 거부합니다.

`writeDTD()`는 validation을 거친 document type declaration을 기록합니다.
`writeEvent()`는 DTD event를 전달할 수 있지만 reader와 writer는 entity declaration을
자동 적용하거나 external entity를 resolve하지 않습니다. 애플리케이션이 선택한
신뢰할 수 있는 replacement만 `addEntities`로 제공하세요. `writeRaw()`는
`AnyXmlEvent`로 표현되지 않습니다. Java StAX의 `XMLEventWriter`에도 RAW event는
없습니다.

#### 인터페이스

```typescript
interface WriteElementOptions {
  prefix?: string;
  uri?: string;
  attributes?: Record<string, string | AttributeInfo>;
  selfClosing?: boolean;
  comment?: string;
}

interface AttributeInfo {
  value: string;
  prefix?: string;
  uri?: string;
}

```

Record key가 attribute local name입니다. Namespaced attribute는 prefix를 제공하고,
해당 element에서 binding을 선언하려면 URI도 제공할 수 있습니다.

### 🚀 Writer를 언제 사용해야 할까요?

**Writer를 사용하는 경우:**
- 클라이언트에 실시간 XML 스트리밍
- 메모리 효율성이 중요한 경우
- 비동기/스트리밍 아키텍처 작업
- 메모리에 맞지 않는 데이터 처리
- 응답을 스트리밍해야 하는 API 구축
- 라이브 데이터 소스에서 실시간 XML 생성

**대용량 파일 생성**에는 [WriterSyncSink](/ko/api-guides/writer-sync/#sink-기반-증분-쓰기)를 권장합니다. **소규모 문서나 동기식 작업**에는 XML을 메모리에서 문자열로 구성하는 [WriterSync](/ko/api-guides/writer-sync/)를 사용하세요.
