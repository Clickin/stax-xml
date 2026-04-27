# StAX-XML

[English](#english) | [한국어](#korean)

---

## English

A high-performance, pull-based XML parser for JavaScript/TypeScript inspired by Java's StAX (Streaming API for XML). It offers both **fully asynchronous, stream-based parsing** for large files and **synchronous parsing** for smaller, in-memory XML documents. Unlike traditional XML-to-JSON mappers, StAX-XML allows you to map XML data to any custom structure you desire while efficiently handling XML files through streaming or direct string processing.

### 🚀 Features

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

Here are basic examples to get started. StAX-XML provides three parsing approaches:

1. **Event-based API**: Low-level streaming parser for fine-grained control
2. **Converter API**: Declarative, zod-style schema API for type-safe XML parsing
3. **Cursor API**: Thin cursor-style wrapper over `StaxXmlIterableParser`

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

#### Cursor Reader API (IterableParser Wrapper)

For code that prefers cursor traversal, use the cursor API from the `stax-xml/cursor` subpath. It is a thin wrapper over the iterable parser backend and exposes one-event-at-a-time accessors such as `name()`, `text()`, and `getAttributeValue()`.

```typescript
import { CursorEventType, StaxXmlCursorReader } from 'stax-xml/cursor';

const cursor = new StaxXmlCursorReader('<root><item id="1">Hello</item></root>');

while (cursor.next()) {
  if (cursor.eventType() === CursorEventType.START_ELEMENT) {
    console.log(cursor.name());
    console.log(cursor.getAttributeValue('id'));
  }

  if (cursor.eventType() === CursorEventType.CHARACTERS) {
    console.log(cursor.text());
  }
}
```

For large files, choose the boundary that matches the workload:

- Use `StaxXmlParser` when file/network I/O should stay async. The public API is end-to-end async, while the parser backend consumes byte batches synchronously after chunks arrive.
- Use the iterable parser when a batch job can block the current worker/thread and you want to avoid creating one full XML string.

```typescript
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { StaxXmlParser, XmlEventType } from 'stax-xml';

const nodeStream = createReadStream('./large.xml', { highWaterMark: 1024 * 1024 });
const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
const parser = new StaxXmlParser(webStream);

for await (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log(event.name);
  }
}
```

```typescript
import { open } from 'node:fs/promises';
import { IterableEventType, StaxXmlIterableParser, toByteBatches } from 'stax-xml/iterable';

async function readFileChunks(path: string): Promise<Uint8Array[]> {
  const file = await open(path, 'r');
  const chunks: Uint8Array[] = [];

  try {
    for await (const chunk of file.createReadStream({ highWaterMark: 1024 * 1024 })) {
      chunks.push(chunk);
    }
  } finally {
    await file.close();
  }

  return chunks;
}

const chunks = await readFileChunks('./large.xml');
const parser = new StaxXmlIterableParser(toByteBatches(chunks, { batchSize: 8 }));

while (parser.nextBatch()) {
  for (let index = 0; index < parser.eventCount(); index++) {
    if (parser.eventType(index) === IterableEventType.START_ELEMENT) {
      console.log(parser.copyName(index));
    }
  }
}
```

For Node-only batch jobs where blocking file I/O is acceptable, `stax-xml/iterable/node` also exposes `nodeFileByteBatchesSync()` and `StaxXmlNodeIterableParser()` so the file can be read and parsed synchronously in fixed-size byte chunks.

### 💾 Memory-efficient sync writing

`StaxXmlWriterSync` returns an XML string by default, and `writeSync()` is still useful for small to medium documents.

For large documents, use `StaxXmlWriterSyncSink` with platform-specific sink adapters to write incrementally. The 1GiB writer benchmark shows the sync sink path has the best write throughput while keeping peak RSS in the same range as async writing.

```typescript
import { x } from 'stax-xml/converter';
import { openSync, writeFileSync, createWriteStream } from 'fs';

import StaxXmlWriterSync, { StaxXmlWriterSyncSink } from 'stax-xml';
import {
  createNodeFileSyncTextSink,
  createNodeSyncTextSink
} from 'stax-xml/adapters/node';
import { createBunSyncTextSink } from 'stax-xml/adapters/bun';
import { createDenoSyncTextSink } from 'stax-xml/adapters/deno';

// Parser/import examples
const booksSchema = x.object({
  title: x.string().xpath('/book/title').writer({ element: 'title' }),
  author: x.string().xpath('/book/author').writer({ element: 'author' })
});

const books = [
  { title: 'TypeScript Deep Dive', author: 'John Smith' },
  { title: 'StAX-XML Guide', author: 'The Team' }
];

// Optional: default import (package default is StaxXmlWriterSync)
new StaxXmlWriterSync();

// Optional: write to file synchronously in one shot
writeFileSync('./books-inline.xml', booksSchema.writeSync(books, { rootElement: 'catalog' }));

// Node target: truly synchronous local-file sink
const fd = openSync('./books-node-sync.xml', 'w');
const fileSink = new StaxXmlWriterSyncSink(
  createNodeFileSyncTextSink(fd),
  {
    enableAutoFlush: true,
    flushThreshold: 0.75,
    flushOnClose: true
  }
);
booksSchema.writeSync(books, { rootElement: 'catalog', writer: fileSink });
fileSink.close();

// Node writable streams are still supported through the stream adapter
const streamSink = new StaxXmlWriterSyncSink(
  createNodeSyncTextSink(createWriteStream('./books-node-stream.xml'), { closeMethod: 'close' })
);
booksSchema.writeSync(books, { rootElement: 'catalog', writer: streamSink });
streamSink.close();

// Bun / Deno targets (subpath adapters)
// Bun: new StaxXmlWriterSyncSink(createBunSyncTextSink(Bun.stdout));
// Deno: new StaxXmlWriterSyncSink(createDenoSyncTextSink(Deno.stdout));
```

When `writer` is provided to `writeSync()`, output is written directly to the sink and the return value is an empty string.

`writer.flush()` drains the writer buffer and calls `sink.flush()` when available.
`writer.close()` finalizes the document if needed, optionally flushes the sink, and closes the target.

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

For detailed API documentation:
- [**Converter API Guide**](https://clickin.github.io/stax-xml): Declarative parsing with schemas
- [**StaxXmlParser (Asynchronous)**](https://clickin.github.io/stax-xml): Event-based parsing from streams
- [**StaxXmlParserSync (Synchronous)**](https://clickin.github.io/stax-xml): Event-based parsing from strings

### 🌐 Platform Compatibility

StAX-XML keeps a Web Standard API baseline, making it compatible with:

- **Node.js** (v20.19+)
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

Native packages are installed automatically through exact-version optional dependencies; users do not need to choose a platform package manually. Release builds stage `stax_xml_native.node` into the matching `@stax-xml/native-*` package before packing. Native OS/variant tarballs must be packed on their matching runner; the publish job only publishes those tarballs and must not repack them on Ubuntu. The wasm package is platform-neutral and may be packed on any runner. For local release checks, build and stage the current platform first, then use `npm pack --dry-run` because `pnpm pack` does not provide a dry-run mode:

```bash
pnpm --dir packages/native-aggregate run build:native
pnpm --dir packages/native-aggregate run stage:platform
npm pack --dry-run --json ./packages/native-linux-x64-gnu
```

Native aggregate counters such as `eventCount`, `attrCountTotal`, and `objectCount` are `u32` counters by contract and wrap modulo 2^32. This keeps the N-API shape compact and matches the benchmark-oriented aggregate API; callers that need exact counts beyond 4,294,967,295 events should partition the input and sum externally.

Release publishing uses npm trusted publishing through GitHub Actions OIDC. Each published package, including every `@stax-xml/native-*` package, must have npm trusted publisher settings pointed at `.github/workflows/release.yml`. Do not add `NPM_TOKEN` or `NODE_AUTH_TOKEN` to the release workflow unless the package is intentionally moved away from OIDC publishing.

The supported runtime floor for published packages is Node.js 20.19. Repository build/test tooling runs on Node.js 20.19+ because the TypeScript build and test tools require it, and the OIDC publish job runs on Node.js 24 to satisfy npm trusted publishing requirements. Linux glibc native packages are built inside a `node:20-bullseye` container so they target Debian 11's older glibc baseline instead of the newer GitHub runner glibc.

For application container images, do not copy a full `node_modules` tree into the runtime layer. Bundle the JavaScript/TypeScript application in the builder layer, then copy only the bundle plus the native addon package that matches the runtime image:

```dockerfile
FROM node:20-bullseye AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bullseye AS native
WORKDIR /native
RUN npm init -y >/dev/null \
  && npm install --omit=dev stax-xml @stax-xml/native-linux-x64-gnu

FROM node:20-bullseye-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=native /native/node_modules/@stax-xml/native-linux-x64-gnu ./node_modules/@stax-xml/native-linux-x64-gnu
COPY --from=native /native/node_modules/stax-xml/package.json ./node_modules/stax-xml/package.json
COPY --from=native /native/node_modules/stax-xml/dist ./node_modules/stax-xml/dist
CMD ["node", "server.js"]
```

Use an Alpine base only when you want the musl package path, for example `@stax-xml/native-linux-x64-musl`.

### 🧪 Testing

```bash
bun test
```

#### Benchmark Results

Benchmark tables are maintained in the generated root report:

- [BENCHMARK.md](../../BENCHMARK.md)

The release benchmark pipeline reruns the canonical benchmark set, writes raw JSON artifacts, and regenerates both `BENCHMARK.md` and the docs benchmark pages from those results.

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

StAX-XML은 세 가지 파싱 방식을 제공합니다:

1. **이벤트 기반 API**: 세밀한 제어를 위한 저수준 스트리밍 파서
2. **Converter API**: 타입 안전한 XML 파싱을 위한 선언적 Zod 스타일 스키마 API
3. **Cursor API**: `StaxXmlIterableParser` 위의 얇은 cursor-style wrapper

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

#### Cursor Reader API (IterableParser Wrapper)

cursor 순회를 선호하는 코드에서는 `stax-xml/cursor` subpath의 cursor API를 사용하세요. 이 API는 iterable parser backend 위의 얇은 wrapper이며 `name()`, `text()`, `getAttributeValue()` 같은 one-event-at-a-time accessor를 제공합니다.

```typescript
import { CursorEventType, StaxXmlCursorReader } from 'stax-xml/cursor';

const cursor = new StaxXmlCursorReader('<root><item id="1">안녕</item></root>');

while (cursor.next()) {
  if (cursor.eventType() === CursorEventType.START_ELEMENT) {
    console.log(cursor.name());
    console.log(cursor.getAttributeValue('id'));
  }

  if (cursor.eventType() === CursorEventType.CHARACTERS) {
    console.log(cursor.text());
  }
}
```

대용량 파일은 workload 경계에 맞춰 선택하세요:

- 파일/네트워크 I/O까지 비동기로 유지해야 하면 `StaxXmlParser`를 사용합니다. 공개 API는 end-to-end async이고, 내부 parser backend는 도착한 byte batch를 동기적으로 소비합니다.
- 현재 worker/thread를 막아도 되는 batch job에서는 iterable parser를 사용하면 전체 XML 문자열을 만들지 않고 byte chunk 단위로 파싱할 수 있습니다.

```typescript
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { StaxXmlParser, XmlEventType } from 'stax-xml';

const nodeStream = createReadStream('./large.xml', { highWaterMark: 1024 * 1024 });
const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
const parser = new StaxXmlParser(webStream);

for await (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log(event.name);
  }
}
```

```typescript
import { open } from 'node:fs/promises';
import { IterableEventType, StaxXmlIterableParser, toByteBatches } from 'stax-xml/iterable';

async function readFileChunks(path: string): Promise<Uint8Array[]> {
  const file = await open(path, 'r');
  const chunks: Uint8Array[] = [];

  try {
    for await (const chunk of file.createReadStream({ highWaterMark: 1024 * 1024 })) {
      chunks.push(chunk);
    }
  } finally {
    await file.close();
  }

  return chunks;
}

const chunks = await readFileChunks('./large.xml');
const parser = new StaxXmlIterableParser(toByteBatches(chunks, { batchSize: 8 }));

while (parser.nextBatch()) {
  for (let index = 0; index < parser.eventCount(); index++) {
    if (parser.eventType(index) === IterableEventType.START_ELEMENT) {
      console.log(parser.copyName(index));
    }
  }
}
```

Node 전용 batch job에서 blocking 파일 I/O가 허용된다면 `stax-xml/iterable/node`의 `nodeFileByteBatchesSync()`와 `StaxXmlNodeIterableParser()`로 파일 읽기와 파싱을 모두 고정 크기 byte chunk 단위의 동기 작업으로 처리할 수 있습니다.

### 💾 메모리 효율적인 동기 쓰기

`StaxXmlWriterSync`는 기본적으로 최종 XML 문자열을 반환합니다. 대용량 문서에서는 `StaxXmlWriterSyncSink`를 사용해 증분 쓰기를 하세요. 1GiB writer 벤치마크 기준으로 sync sink 경로가 가장 높은 쓰기 처리량을 보이면서 peak RSS는 async 쓰기와 같은 범위에 머뭅니다.

```typescript
import { x } from 'stax-xml/converter';
import { openSync, writeFileSync, createWriteStream } from 'fs';

import {
  StaxXmlWriterSync,
  StaxXmlWriterSyncSink
} from 'stax-xml';
import {
  createNodeFileSyncTextSink,
  createNodeSyncTextSink
} from 'stax-xml/adapters/node';
import { createBunSyncTextSink } from 'stax-xml/adapters/bun';
import { createDenoSyncTextSink } from 'stax-xml/adapters/deno';

const booksSchema = x.object({
  title: x.string().xpath('/book/title').writer({ element: 'title' }),
  author: x.string().xpath('/book/author').writer({ element: 'author' })
});

const books = [
  { title: 'TypeScript Deep Dive', author: '홍길동' },
  { title: 'StAX-XML 가이드', author: '팀' }
];

// 기본 import 방식 (패키지 기본 export가 StaxXmlWriterSync)
new StaxXmlWriterSync();

// 동기/인메모리: 문자열로 한 번에 생성
writeFileSync('./books-inline.xml', booksSchema.writeSync(books, { rootElement: 'catalog' }));

// Node 대상: 진짜 동기 로컬 파일 sink
const fd = openSync('./books-node-sync.xml', 'w');
const fileSink = new StaxXmlWriterSyncSink(
  createNodeFileSyncTextSink(fd),
  {
    enableAutoFlush: true,
    flushThreshold: 0.75,
    flushOnClose: true
  }
);
booksSchema.writeSync(books, { rootElement: 'catalog', writer: fileSink });
fileSink.close();

// Node writable stream도 별도 stream adapter로 계속 지원됩니다.
const streamSink = new StaxXmlWriterSyncSink(
  createNodeSyncTextSink(createWriteStream('./books-node-stream.xml'), { closeMethod: 'close' })
);
booksSchema.writeSync(books, { rootElement: 'catalog', writer: streamSink });
streamSink.close();

// Bun / Deno 대상 (subpath adapter)
// Bun: new StaxXmlWriterSyncSink(createBunSyncTextSink(Bun.stdout));
// Deno: new StaxXmlWriterSyncSink(createDenoSyncTextSink(Deno.stdout));
```

`writeSync()`에 `writer`를 전달하면 sink로 바로 쓰며 반환 문자열은 빈 문자열(`""`)입니다.
`writer.flush()`는 writer 버퍼를 비우고 가능하면 `sink.flush()`도 호출합니다.
`writer.close()`는 필요하면 문서를 마무리하고, 설정에 따라 sink를 flush한 뒤 target을 닫습니다.

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

StAX-XML은 웹 표준 API 기반의 기본 호환성을 유지하여 다음 환경에서 동작합니다:

- **Node.js** (v20.19+)
- **Bun** (모든 버전)
- **Deno** (모든 버전)
- **웹 브라우저** (최신 브라우저)
- **Edge Runtime** (Vercel, Cloudflare Workers 등)

브라우저에서 처리량이 중요한 워크로드에는 WebAssembly 런타임을 우선 권장합니다. 순수 JavaScript 파서는 Wasm을 로드할 수 없거나, 교차 출처 격리를 사용할 수 없거나, 바이너리 없는 정책이 필요한 환경을 위한 호환 fallback으로 유지합니다.

#### Native 및 Wasm 해석

`stax-xml`은 공개 facade package로 유지됩니다. 플랫폼별 바이너리는 `@stax-xml/native-*` optional dependency로 같은 버전에 맞춰 설치되므로 사용자가 직접 플랫폼 package를 고를 필요가 없습니다. 릴리스 빌드는 pack 전에 현재 platform package 안에 `stax_xml_native.node`를 stage합니다. native OS/variant tarball은 반드시 해당 OS/variant runner에서 pack하고, publish job은 그 tarball을 그대로 배포해야 하며 Ubuntu에서 다시 pack하지 않습니다. wasm package는 플랫폼 중립이므로 어떤 runner에서 pack해도 됩니다. 로컬 릴리스 검증은 먼저 현재 플랫폼 바이너리를 빌드/stage한 뒤, `pnpm pack`에는 dry-run 모드가 없으므로 `npm pack --dry-run`을 사용합니다:

```bash
pnpm --dir packages/native-aggregate run build:native
pnpm --dir packages/native-aggregate run stage:platform
npm pack --dry-run --json ./packages/native-linux-x64-gnu
```

native aggregate가 반환하는 `eventCount`, `attrCountTotal`, `objectCount` 같은 counter는 API 계약상 `u32`이며 2^32 기준으로 wrap됩니다. N-API shape를 작게 유지하기 위한 benchmark/API 계약이므로, 4,294,967,295개를 초과하는 정확한 event count가 필요하면 입력을 나누어 외부에서 합산하세요.

npm 배포는 GitHub Actions OIDC 기반 trusted publishing을 사용합니다. 모든 publish 대상 package, 특히 각 `@stax-xml/native-*` package의 npm trusted publisher 설정은 `.github/workflows/release.yml`을 가리켜야 합니다. 의도적으로 OIDC 배포를 포기하는 경우가 아니라면 release workflow에 `NPM_TOKEN`이나 `NODE_AUTH_TOKEN`을 추가하지 마세요.

배포 package의 지원 runtime 하한은 Node.js 20.19입니다. 저장소 build/test tooling은 TypeScript build/test 도구의 요구사항 때문에 Node.js 20.19+에서 실행하고, OIDC publish job은 npm trusted publishing 요구사항 때문에 Node.js 24에서 실행합니다. Linux glibc native package는 `node:20-bullseye` container 안에서 빌드해서, 최신 GitHub runner glibc가 아니라 Debian 11의 더 낮은 glibc 기준에 맞춥니다.

애플리케이션 컨테이너 이미지는 runtime layer에 전체 `node_modules`를 복사하지 않는 편이 좋습니다. builder layer에서 JavaScript/TypeScript 애플리케이션을 하나의 산출물로 번들링하고, runtime image에는 번들 결과와 실행 환경에 맞는 native addon package만 복사하세요:

```dockerfile
FROM node:20-bullseye AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bullseye AS native
WORKDIR /native
RUN npm init -y >/dev/null \
  && npm install --omit=dev stax-xml @stax-xml/native-linux-x64-gnu

FROM node:20-bullseye-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=native /native/node_modules/@stax-xml/native-linux-x64-gnu ./node_modules/@stax-xml/native-linux-x64-gnu
COPY --from=native /native/node_modules/stax-xml/package.json ./node_modules/stax-xml/package.json
COPY --from=native /native/node_modules/stax-xml/dist ./node_modules/stax-xml/dist
CMD ["node", "server.js"]
```

Alpine base는 musl package 경로가 필요할 때만 사용하세요. 예를 들어 x64 Alpine에서는 `@stax-xml/native-linux-x64-musl`이 선택됩니다.

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
