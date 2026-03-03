# StAX-XML

[English](#english) | [한국어](#korean)

---

## English

A high-performance, pull-based XML parser for JavaScript/TypeScript inspired by Java's StAX (Streaming API for XML). It offers both **fully asynchronous, stream-based parsing** for large files and **synchronous parsing** for smaller, in-memory XML documents. Unlike traditional XML-to-JSON mappers, StAX-XML allows you to map XML data to any custom structure you desire while efficiently handling XML files through streaming or direct string processing.

### 🚀 Features

- **Declarative Converter API**: Zod-style schema API for type-safe XML parsing and writing
- **XPath Support**: Use XPath expressions for flexible element selection
- **Bidirectional Transformation**: Parse XML to objects and write objects back to XML
- **Fully Asynchronous (Stream-based)**: For memory-efficient processing of large XML files
- **Synchronous (String-based)**: For high-performance parsing of smaller, in-memory XML strings
- **Pull-based Parsing**: Stream-based approach for memory-efficient processing of large XML files
- **Custom Mapping**: Map XML data to any structure you want, not just plain JSON objects
- **High Performance**: Optimized for speed and low memory usage
- **Universal Compatibility**: Works in Node.js, Bun, Deno, and web browsers using only Web Standard APIs
- **Namespace Support**: Basic XML namespace handling
- **Entity Support**: Built-in entity decoding with custom entity support
- **TypeScript Ready**: Full TypeScript support with comprehensive type definitions

### 📦 Installation

```bash
# npm
npm install stax-xml
# yarn
yarn add stax-xml
# pnpm
pnpm add stax-xml
# bun
bun add stax-xml
# deno
deno add npm:stax-xml
```

### 🔧 Quick Start

Here are basic examples to get started. StAX-XML provides two parsing approaches:

1. **Event-based API**: Low-level streaming parser for fine-grained control
2. **Converter API**: Declarative, zod-style schema API for type-safe XML parsing

#### Declarative Parsing with Converter API (Recommended)

The converter module provides a zod-style declarative API for parsing and writing XML:

```typescript
import { x } from 'stax-xml/converter';

// Define schema with XPath
const bookSchema = x.object({
  title: x.string().xpath('/book/title'),
  author: x.string().xpath('/book/author'),
  price: x.number().xpath('/book/price'),
  tags: x.string().array().xpath('/book/tags/tag')
});

// Parse XML
const xml = `
  <book>
    <title>TypeScript Deep Dive</title>
    <author>John Smith</author>
    <price>29.99</price>
    <tags>
      <tag>programming</tag>
      <tag>typescript</tag>
    </tags>
  </book>
`;

const result = await bookSchema.parse(xml);
// Result: { title: 'TypeScript Deep Dive', author: 'John Smith', price: 29.99, tags: ['programming', 'typescript'] }

// Write XML back
const newXml = await bookSchema.write(result, { rootElement: 'book' });
```

Key features of the Converter API:
- **Type-safe parsing**: Infer TypeScript types from schemas
- **XPath support**: Use XPath expressions for element selection
- **Bidirectional**: Parse XML → Object and Object → XML
- **Composable**: Build complex schemas from simple primitives
- **Optional values**: Handle missing elements gracefully with `.optional()`
- **Transformations**: Apply custom transformations with `.transform()`

#### Event-based Parsing (Low-level API)

##### Basic Asynchronous Parsing (StaxXmlParser)

```typescript
import { StaxXmlParser, XmlEventType } from 'stax-xml';

const xmlContent = '<root><item>Hello</item></root>';
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlContent));
    controller.close();
  }
});

async function parseXml() {
  const parser = new StaxXmlParser(stream);
  for await (const event of parser) {
    console.log(event);
  }
}
parseXml();
```

##### Basic Synchronous Parsing (StaxXmlParserSync)

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

const xmlContent = '<data><value>123</value></data>';
const parser = new StaxXmlParserSync(xmlContent);

for (const event of parser) {
  console.log(event);
}
```


##### Cursor-style Synchronous Parsing (StaxXmlCursorReaderSync)

```typescript
import { StaxXmlCursorReaderSync, XmlEventType } from 'stax-xml';

const reader = new StaxXmlCursorReaderSync('<root id="1"><item>text</item></root>');

while (reader.read()) {
  const event = reader.requireEvent();

  if (event.type === XmlEventType.START_ELEMENT) {
    console.log(event.name, event.getAttributeCount());
    console.log(event.getAttributeValue('id'));
  }

  if (event.type === XmlEventType.CHARACTERS) {
    console.log(event.text);
  }
}
```

For detailed API documentation:
- [**Converter API Guide**](https://clickin.github.io/stax-xml): Declarative parsing with schemas
- [**StaxXmlParser (Asynchronous)**](https://clickin.github.io/stax-xml): Event-based parsing from streams
- [**StaxXmlParserSync (Synchronous)**](https://clickin.github.io/stax-xml): Event-based parsing from strings
- **StaxXmlCursorReaderSync (Synchronous Cursor)**: Cursor-style pull reader from strings

### 🌐 Platform Compatibility

StAX-XML uses only Web Standard APIs, making it compatible with:

- **Node.js** (v18+)
- **Bun** (any version)
- **Deno** (any version)
- **Web Browsers** (modern browsers)
- **Edge Runtime** (Vercel, Cloudflare Workers, etc.)

### 🧪 Testing

```bash
bun test
```

#### Benchmark Results

**Disclaimer:** These benchmarks were performed on a specific system (`cpu: 13th Gen Intel(R) Core(TM) i5-13600K`, `runtime: node 22.17.0 (x64-win32)`) and may vary on different hardware and environments.

**large.xml (97MB) parsing**

| Benchmark           | avg (min … max) | p75 / p99       | Memory (avg) |
| :------------------ | :-------------- | :-------------- | :----------- |
| stax-xml to object  | 4.36 s/iter     | 4.42 s          | 2.66 mb      |
| stax-xml consume    | 3.61 s/iter     | 3.65 s          | 3.13 mb      |
| xml2js              | 6.00 s/iter     | 6.00 s          | 1.80 mb      |
| fast-xml-parser     | 4.25 s/iter     | 4.26 s          | 151.81 mb    |
| txml                | 1.05 s/iter     | 1.06 s          | 179.81 mb    |

**midsize.xml (13MB) parsing**

| Benchmark           | avg (min … max) | p75 / p99       | Memory (avg) |
| :------------------ | :-------------- | :-------------- | :----------- |
| stax-xml to object  | 492.06 ms/iter  | 493.28 ms       | 326.28 kb    |
| stax-xml consume    | 469.66 ms/iter  | 471.54 ms       | 174.51 kb    |
| xml2js              | 163.26 µs/iter  | 161.20 µs       | 89.89 kb     |
| fast-xml-parser     | 529.99 ms/iter  | 531.12 ms       | 1.92 mb      |
| txml                | 112.81 ms/iter  | 113.26 ms       | 1.00 mb      |

**complex.xml (2KB) parsing**

| Benchmark           | avg (min … max) | p75 / p99       | Memory (avg) |
| :------------------ | :-------------- | :-------------- | :----------- |
| stax-xml to object  | 85.79 µs/iter   | 75.60 µs        | 105.11 kb    |
| stax-xml consume    | 50.38 µs/iter   | 49.43 µs        | 271.12 b     |
| xml2js              | 147.45 µs/iter  | 153.50 µs       | 89.42 kb     |
| fast-xml-parser     | 101.11 µs/iter  | 102.20 µs       | 92.92 kb     |
| txml                | 9.40 µs/iter    | 9.41 µs         | 125.89 b     |

**books.xml (4KB) parsing**

| Benchmark           | avg (min … max) | p75 / p99       | Memory (avg) |
| :------------------ | :-------------- | :-------------- | :----------- |
| stax-xml to object  | 166.73 µs/iter  | 156.20 µs       | 221.40 kb    |
| stax-xml consume    | 176.45 µs/iter  | 151.70 µs       | 202.08 kb    |
| xml2js              | 259.90 µs/iter  | 254.50 µs       | 161.25 kb    |
| fast-xml-parser     | 239.57 µs/iter  | 203.30 µs       | 226.17 kb    |
| txml                | 19.18 µs/iter   | 19.26 µs        | 303.13 b     |

### 📁 Sample File Sources

Sources of sample XML files used in testing:

- `books.xml`: [Microsoft XML Document Examples](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ms762271(v=vs.85))
- `simple-namespace.xml`: [W3Schools XML Namespaces Guide](https://www.w3schools.com/xml/xml_namespaces.asp)
- `treebank_e.xml`: [University of Washington XML Data Repository](https://aiweb.cs.washington.edu/research/projects/xmltk/xmldata/www/repository.html)

### 📄 License

MIT

### 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## Korean

Java의 StAX(Streaming API for XML)에서 영감을 받은 고성능 pull 방식의 JavaScript/TypeScript XML 파서입니다. **대용량 파일을 위한 완전 비동기 스트림 기반 파싱**과 **작은 인메모리 XML 문서를 위한 동기 파싱**을 모두 제공합니다. 기존의 XML-JSON 매퍼와 달리, StAX-XML을 사용하면 XML 데이터를 원하는 임의의 구조로 매핑할 수 있으며, 스트리밍 또는 직접 문자열 처리를 통해 XML 파일을 효율적으로 처리할 수 있습니다.

### 🚀 주요 기능

- **선언적 Converter API**: 타입 안전한 XML 파싱과 쓰기를 위한 Zod 스타일 스키마 API
- **XPath 지원**: 유연한 요소 선택을 위한 XPath 표현식 사용
- **양방향 변환**: XML을 객체로 파싱하고 객체를 다시 XML로 작성
- **완전 비동기 (스트림 기반)**: 대용량 XML 파일의 메모리 효율적 처리
- **동기 (문자열 기반)**: 작은 인메모리 XML 문자열의 고성능 파싱
- **사용자 정의 매핑**: 단순한 JSON 객체가 아닌 원하는 구조로 XML 데이터 매핑 가능
- **고성능**: 속도와 낮은 메모리 사용량에 최적화
- **범용 호환성**: 웹 표준 API만 사용하여 Node.js, Bun, Deno, 웹 브라우저에서 모두 동작
- **네임스페이스 지원**: 기본 XML 네임스페이스 처리
- **엔티티 지원**: 사용자 정의 엔티티 지원을 포함한 내장 엔티티 디코딩
- **TypeScript 지원**: 포괄적인 타입 정의로 완전한 TypeScript 지원

### 📦 설치

```bash
# npm
npm install stax-xml
# yarn
yarn add stax-xml
# pnpm
pnpm add stax-xml
# bun
bun add stax-xml
# deno
deno add npm:stax-xml
```

### 📖 문서

자세한 사용법, API 참조, 튜토리얼은 [**공식 문서**](https://clickin.github.io/stax-xml)를 참조하세요.

### 🔧 빠른 시작

StAX-XML은 두 가지 파싱 방식을 제공합니다:

1. **이벤트 기반 API**: 세밀한 제어를 위한 저수준 스트리밍 파서
2. **Converter API**: 타입 안전한 XML 파싱을 위한 선언적 Zod 스타일 스키마 API

#### Converter API를 사용한 선언적 파싱 (권장)

Converter 모듈은 XML 파싱 및 쓰기를 위한 Zod 스타일의 선언적 API를 제공합니다:

```typescript
import { x } from 'stax-xml/converter';

// XPath를 사용한 스키마 정의
const bookSchema = x.object({
  title: x.string().xpath('/book/title'),
  author: x.string().xpath('/book/author'),
  price: x.number().xpath('/book/price'),
  tags: x.string().array().xpath('/book/tags/tag')
});

// XML 파싱
const xml = `
  <book>
    <title>TypeScript 딥다이브</title>
    <author>홍길동</author>
    <price>29.99</price>
    <tags>
      <tag>프로그래밍</tag>
      <tag>타입스크립트</tag>
    </tags>
  </book>
`;

const result = await bookSchema.parse(xml);
// 결과: { title: 'TypeScript 딥다이브', author: '홍길동', price: 29.99, tags: ['프로그래밍', '타입스크립트'] }

// XML로 다시 쓰기
const newXml = await bookSchema.write(result, { rootElement: 'book' });
```

Converter API의 주요 기능:
- **타입 안전 파싱**: 스키마에서 TypeScript 타입 자동 추론
- **XPath 지원**: 요소 선택을 위한 XPath 표현식 사용
- **양방향**: XML → 객체, 객체 → XML 변환
- **조합 가능**: 단순 기본형에서 복잡한 스키마 구축
- **선택적 값**: `.optional()`로 누락된 요소 우아하게 처리
- **변환**: `.transform()`으로 사용자 정의 변환 적용

#### 이벤트 기반 파싱 (저수준 API)

##### 기본 비동기 파싱 (StaxXmlParser)

```typescript
import { StaxXmlParser, XmlEventType } from 'stax-xml';

const xmlContent = '<root><item>안녕하세요</item></root>';
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlContent));
    controller.close();
  }
});

async function parseXml() {
  const parser = new StaxXmlParser(stream);
  for await (const event of parser) {
    console.log(event);
  }
}
parseXml();
```

##### 기본 동기 파싱 (StaxXmlParserSync)

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

const xmlContent = '<data><value>123</value></data>';
const parser = new StaxXmlParserSync(xmlContent);

for (const event of parser) {
  console.log(event);
}
```

자세한 API 문서는 다음을 참조하세요:
- [**Converter API 가이드**](https://clickin.github.io/stax-xml): 스키마를 사용한 선언적 파싱
- [**StaxXmlParser (비동기)**](https://clickin.github.io/stax-xml): 스트림 기반 이벤트 파싱
- [**StaxXmlParserSync (동기)**](https://clickin.github.io/stax-xml): 문자열 기반 이벤트 파싱

### 🌐 플랫폼 호환성

StAX-XML은 웹 표준 API만을 사용하여 다음 환경에서 동작합니다:

- **Node.js** (v18+)
- **Bun** (모든 버전)
- **Deno** (모든 버전)
- **웹 브라우저** (최신 브라우저)
- **Edge Runtime** (Vercel, Cloudflare Workers 등)

### 📁 테스트 파일 출처

테스트에 사용된 샘플 파일들의 출처:

**XML 파일:**
- `books.xml`: [Microsoft XML 문서 예제](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ms762271(v=vs.85))
- `simple-namespace.xml`: [W3Schools XML 네임스페이스 가이드](https://www.w3schools.com/xml/xml_namespaces.asp)
- `treebank_e.xml`: [University of Washington XML Data Repository](https://aiweb.cs.washington.edu/research/projects/xmltk/xmldata/www/repository.html)

**JSON 파일:**
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser)

### 📄 라이선스

MIT

### 🤝 기여하기

기여를 환영합니다! Pull Request를 자유롭게 제출해 주세요.
