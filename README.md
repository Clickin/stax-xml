# StAX-XML

[English](#english) | [한국어](#korean)

---

## English

A high-performance, pull-based XML parser for JavaScript/TypeScript inspired by Java's StAX (Streaming API for XML). It offers both **fully asynchronous, stream-based parsing** for large files and **synchronous parsing** for smaller, in-memory XML documents. Unlike traditional XML-to-JSON mappers, StAX-XML allows you to map XML data to any custom structure you desire while efficiently handling XML files through streaming or direct string processing.

### 🚀 Features

- **Cursor Reader API**: Zero-allocation cursor-based XML traversal for maximum throughput
- **Declarative Converter API**: Zod-style schema API for type-safe XML parsing and writing
- **XPath Support**: Use XPath expressions for flexible element selection
- **Bidirectional Transformation**: Parse XML to objects and write objects back to XML
- **Synchronous Sink Writing**: Recommended high-throughput path for large XML output
- **Fully Asynchronous (Stream-based)**: For memory-efficient processing of large XML files
- **Synchronous (String-based)**: For high-performance parsing of smaller, in-memory XML strings
- **Pull-based Parsing**: Stream-based approach for memory-efficient processing of large XML files
- **Custom Mapping**: Map XML data to any structure you want, not just plain JSON objects
- **High Performance**: Optimized for speed and low memory usage
- **Universal Compatibility**: Works in Node.js, Bun, Deno, and web browsers, with WebAssembly recommended for browser performance paths and pure JavaScript kept as the compatibility fallback
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

**ESM-only package:** StAX-XML is published as ESM-only. Use `import { ... } from 'stax-xml'`; `require('stax-xml')` is not supported.

### 🔧 Quick Start

Here are basic examples to get started. StAX-XML provides two parsing approaches:

1. **Cursor Reader API**: Zero-allocation cursor for maximum throughput and minimal memory
2. **Event-based API**: Low-level streaming parser for fine-grained control
3. **Converter API**: Declarative, zod-style schema API for type-safe XML parsing

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

#### Cursor Reader API (Zero-Allocation)

The cursor API provides a **mutable singleton cursor** that advances through XML events without creating objects per node. It offers dramatically lower memory usage and higher throughput on large files.

```typescript
import { StaxXmlCursorReader, CursorEventType } from 'stax-xml/cursor';

const xml = '<root><item id="1">Hello</item><item id="2">World</item></root>';
const cursor = new StaxXmlCursorReader(xml);

while (cursor.next()) {
  switch (cursor.eventType()) {
    case CursorEventType.START_ELEMENT:
      console.log(`<${cursor.name()}>`);         // element name
      console.log(cursor.getAttributeValue('id'));// attribute access
      break;
    case CursorEventType.CHARACTERS:
      console.log(cursor.text());                 // text content
      break;
  }
}
```

For large files via `ReadableStream`:

```typescript
import { StaxXmlCursorReaderAsync, CursorEventType } from 'stax-xml/cursor';

const response = await fetch('https://example.com/large.xml');
const cursor = new StaxXmlCursorReaderAsync(response.body!);

while (await cursor.next()) {
  if (cursor.eventType() === CursorEventType.START_ELEMENT) {
    console.log(cursor.name());
  }
}
```

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

For detailed API documentation:
- [**Converter API Guide**](https://clickin.github.io/stax-xml): Declarative parsing with schemas
- [**StaxXmlParser (Asynchronous)**](https://clickin.github.io/stax-xml): Event-based parsing from streams
- [**StaxXmlParserSync (Synchronous)**](https://clickin.github.io/stax-xml): Event-based parsing from strings

### 🌐 Platform Compatibility

StAX-XML keeps a Web Standard API baseline, making it compatible with:

- **Node.js** (v18+)
- **Bun** (any version)
- **Deno** (any version)
- **Web Browsers** (modern browsers)
- **Edge Runtime** (Vercel, Cloudflare Workers, etc.)

For performance-sensitive browser workloads, prefer the WebAssembly runtime when it is available. The pure JavaScript parser remains the compatibility fallback for environments that cannot load Wasm, cannot enable cross-origin isolation, or need a no-binary policy.

#### Native and Wasm Resolution

`stax-xml` remains the public facade package. Platform artifacts are published as exact-version optional dependencies under `@stax-xml/*`, and runtime-specific probing is available through the `stax-xml/runtime` subpath:

```typescript
import { resolveStaxXmlRuntimeBackend } from 'stax-xml/runtime';

const backend = await resolveStaxXmlRuntimeBackend();
// backend.kind is "native", "wasm", or "js"
```

Resolution order is native for the current Node-API platform, then `@stax-xml/native-wasm32-wasi`, then the JavaScript implementation in `stax-xml`. Browser applications should run wasm parsing in a Worker when parsing creates long tasks or visible UI delay; threaded wasm requires cross-origin isolation.

### 🧪 Testing

```bash
bun test
```

#### Benchmark Results

**Disclaimer:** These parser benchmarks were rerun on a specific system (`cpu: 13th Gen Intel(R) Core(TM) i5-13600K`, `runtime: node 24.12.0 (x64-win32)`) and may vary on different hardware and environments.

**large.xml (97MB) parsing**

| Benchmark           | avg (min … max) | p75 / p99       | Memory (avg) |
| :------------------ | :-------------- | :-------------- | :----------- |
| stax-xml to object  | 676.93 ms/iter  | 689.57 ms       | 7.38 mb      |
| stax-xml consume    | 660.41 ms/iter  | 682.57 ms       | 35.12 mb     |
| xml2js              | 9.30 s/iter     | 11.09 s         | 656.68 mb    |
| fast-xml-parser     | 7.85 s/iter     | 9.70 s          | 1.08 gb      |
| txml                | 1.93 s/iter     | 1.97 s          | 890.28 mb    |

**midsize.xml (13MB) parsing**

| Benchmark                   | avg (min … max) | p75 / p99       | Memory (avg) |
| :-------------------------- | :-------------- | :-------------- | :----------- |
| stax-xml to object          | 95.21 ms/iter   | 96.31 ms        | 35.41 mb     |
| stax-xml consume            | 89.07 ms/iter   | 90.81 ms        | 4.93 mb      |
| xml2js                      | 663.47 µs/iter  | 713.90 µs       | 323.69 kb    |
| fast-xml-parser             | 642.49 ms/iter  | 651.85 ms       | 128.11 mb    |
| txml                        | 128.58 ms/iter  | 128.63 ms       | 126.90 mb    |

**complex.xml (2KB) parsing**

| Benchmark           | avg (min … max) | p75 / p99       | Memory (avg) |
| :------------------ | :-------------- | :-------------- | :----------- |
| stax-xml to object  | 260.88 µs/iter  | 300.20 µs       | 28.51 kb     |
| stax-xml consume    | 269.33 µs/iter  | 303.20 µs       | 24.28 kb     |
| xml2js              | 1.00 ms/iter    | 1.23 ms         | 203.56 kb    |
| fast-xml-parser     | 555.92 µs/iter  | 681.60 µs       | 129.73 kb    |
| txml                | 121.03 µs/iter  | 131.50 µs       | 26.41 kb     |

**books.xml (4KB) parsing**

| Benchmark           | avg (min … max) | p75 / p99       | Memory (avg) |
| :------------------ | :-------------- | :-------------- | :----------- |
| stax-xml to object  | 342.66 µs/iter  | 392.70 µs       | 52.95 kb     |
| stax-xml consume    | 295.36 µs/iter  | 347.80 µs       | 45.30 kb     |
| xml2js              | 1.28 ms/iter    | 1.63 ms         | 544.96 kb    |
| fast-xml-parser     | 727.33 µs/iter  | 898.40 µs       | 560.08 kb    |
| txml                | 126.53 µs/iter  | 138.10 µs       | 46.32 kb     |

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

- **커서 Reader API**: 최대 처리량을 위한 제로 할당 커서 기반 XML 순회
- **선언적 Converter API**: 타입 안전한 XML 파싱과 쓰기를 위한 Zod 스타일 스키마 API
- **XPath 지원**: 유연한 요소 선택을 위한 XPath 표현식 사용
- **양방향 변환**: XML을 객체로 파싱하고 객체를 다시 XML로 작성
- **동기 sink 쓰기**: 대용량 XML 출력에 권장되는 고처리량 경로
- **완전 비동기 (스트림 기반)**: 대용량 XML 파일의 메모리 효율적 처리
- **동기 (문자열 기반)**: 작은 인메모리 XML 문자열의 고성능 파싱
- **사용자 정의 매핑**: 단순한 JSON 객체가 아닌 원하는 구조로 XML 데이터 매핑 가능
- **고성능**: 속도와 낮은 메모리 사용량에 최적화
- **범용 호환성**: Node.js, Bun, Deno, 웹 브라우저에서 동작하며, 브라우저 고성능 경로는 WebAssembly를 권장하고 순수 JavaScript 파서는 호환 fallback으로 유지
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

1. **커서 Reader API**: 최대 처리량과 최소 메모리를 위한 제로 할당 커서
2. **이벤트 기반 API**: 세밀한 제어를 위한 저수준 스트리밍 파서
3. **Converter API**: 타입 안전한 XML 파싱을 위한 선언적 Zod 스타일 스키마 API

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

#### 커서 Reader API (제로 할당)

커서 API는 노드마다 객체를 생성하지 않고 **뮤터블 싱글톤 커서**를 통해 XML 이벤트를 순회합니다. 대용량 파일에서 극적으로 낮은 메모리 사용량과 높은 처리량을 제공합니다.

```typescript
import { StaxXmlCursorReader, CursorEventType } from 'stax-xml/cursor';

const xml = '<root><item id="1">안녕</item><item id="2">세계</item></root>';
const cursor = new StaxXmlCursorReader(xml);

while (cursor.next()) {
  switch (cursor.eventType()) {
    case CursorEventType.START_ELEMENT:
      console.log(`<${cursor.name()}>`);         // 요소 이름
      console.log(cursor.getAttributeValue('id'));// 속성 접근
      break;
    case CursorEventType.CHARACTERS:
      console.log(cursor.text());                 // 텍스트 내용
      break;
  }
}
```

대용량 파일을 `ReadableStream`으로 처리:

```typescript
import { StaxXmlCursorReaderAsync, CursorEventType } from 'stax-xml/cursor';

const response = await fetch('https://example.com/large.xml');
const cursor = new StaxXmlCursorReaderAsync(response.body!);

while (await cursor.next()) {
  if (cursor.eventType() === CursorEventType.START_ELEMENT) {
    console.log(cursor.name());
  }
}
```

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

StAX-XML은 웹 표준 API 기반의 기본 호환성을 유지하여 다음 환경에서 동작합니다:

- **Node.js** (v18+)
- **Bun** (모든 버전)
- **Deno** (모든 버전)
- **웹 브라우저** (최신 브라우저)
- **Edge Runtime** (Vercel, Cloudflare Workers 등)

브라우저에서 처리량이 중요한 워크로드에는 WebAssembly 런타임을 우선 권장합니다. 순수 JavaScript 파서는 Wasm을 로드할 수 없거나, 교차 출처 격리를 사용할 수 없거나, 바이너리 없는 정책이 필요한 환경을 위한 호환 fallback으로 유지합니다.

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
