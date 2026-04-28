# StAX-XML

[English](#english) | [한국어](#korean)

---

## English

A performance-first, pull-based XML parser for JavaScript/TypeScript inspired by Java's StAX (Streaming API for XML). StAX-XML is built around fast synchronous parsing paths, optional native acceleration, and byte-batch APIs that can parse large files without forcing the whole document through one JavaScript string. Use async streams when I/O must stay non-blocking; use the sync iterable path when a batch job can block and you want to avoid Promise overhead.

Current release benchmarks show StAX-XML as one of the fastest XML parser packages in the JavaScript ecosystem for large-file workloads. The JavaScript byte-batch parser stays portable across Node, Bun, Deno, browsers, and edge runtimes, while the published `@stax-xml/native-*` optional packages provide the fastest Node.js path when native addons are allowed.

### 🚀 Features

- **Fast sync byte-batch parsing**: Parse large `Uint8Array`/`Buffer` chunk streams synchronously without materializing one full XML string
- **Native acceleration by default**: `stax-xml` installs matching `@stax-xml/native-*` optional packages automatically, with wasm and JavaScript fallbacks
- **Low-overhead iterable API**: Batch-oriented event frames expose names, text, and attributes on demand so hot paths can avoid per-event object churn
- **Async stream parser**: Keep file/network I/O non-blocking while the parser consumes arrived byte batches synchronously
- **Cursor Reader API**: Thin cursor-style wrapper over `IterableReader` for one-event-at-a-time traversal
- **Declarative Converter API**: Zod-style schema API for type-safe XML parsing and writing with XPath support
- **Bidirectional Transformation**: Parse XML to objects and write objects back to XML
- **Synchronous Sink Writing**: Recommended high-throughput path for large XML output
- **Custom Mapping**: Map XML data to any structure you want, not just plain JSON objects
- **Universal Compatibility**: Works in Node.js, Bun, Deno, and web browsers, with WebAssembly recommended for browser performance paths and pure JavaScript kept as the compatibility fallback
- **Namespace Support**: Basic XML namespace handling
- **Entity Support**: Built-in entity decoding with custom entity support
- **Fragment-friendly by default**: `documentMode` defaults to `'fragment'`, with opt-in XML document shape checks via `'document'`
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

StAX-XML provides several parsing surfaces. Pick the one that matches the execution boundary:

| Workload | Recommended API | Why |
| --- | --- | --- |
| Large local files or batch jobs that may block | `stax-xml/iterable` or `stax-xml/iterable/node` | Fast synchronous byte-batch parsing, no Promise overhead, no full-string requirement |
| File/network I/O that must stay non-blocking | `EventReader` | Async iterator over `ReadableStream<Uint8Array>` |
| Ergonomic event traversal | `CursorReader` | Cursor-style accessors over the iterable backend |
| XML-to-object mapping | `stax-xml/converter` | Typed schema API with XPath and writer support |

#### Fast synchronous large-file parsing

For Node batch jobs, read and parse a file synchronously in fixed-size byte chunks. This path does not require `fs.readFileSync(path, 'utf8')`, does not keep one full XML string in memory, and avoids async iterator/Promise overhead.

```typescript
import {
  IterableEventType,
  NodeIterableReader,
  nodeFileByteBatchesSync
} from 'stax-xml/iterable/node';

const parser = new NodeIterableReader(
  nodeFileByteBatchesSync('./large.xml', {
    chunkSize: 1024 * 1024,
    batchSize: 16
  })
);

let elementCount = 0;

while (parser.nextBatch()) {
  for (let index = 0; index < parser.eventCount(); index++) {
    if (parser.eventType(index) === IterableEventType.START_ELEMENT) {
      elementCount++;
      // Names/text/attributes are copied only when requested.
      console.log(parser.copyName(index));
    }
  }
}

console.log(`Total elements processed: ${elementCount}`);
```

For portable byte sources, use `IterableReader` with `Iterable<Uint8Array[]>` batches from `stax-xml/iterable`. That is the same synchronous parsing model without Node's `Buffer`-specific file helpers.

#### Unknown XML to Tree or Object

Use the converter API when you know the target shape. When you just need to inspect unknown XML, StAX-XML also provides convenience helpers:

- `parseXmlTree()` / `parseXmlTreeSync()` return an order-preserving tree similar in spirit to Python's ElementTree.
- `parseXmlObject()` / `parseXmlObjectSync()` return a compact JavaScript object similar to txml or fast-xml-parser.

```typescript
import { parseXmlObjectSync, parseXmlTreeSync } from 'stax-xml';

const xml = '<catalog><book id="1"><title>One</title><tag>a</tag><tag>b</tag></book></catalog>';

const tree = parseXmlTreeSync(xml);
// tree.children[0] -> { type: 'element', name: 'catalog', attributes, children }

const object = parseXmlObjectSync(xml);
// {
//   catalog: {
//     book: {
//       '@id': '1',
//       title: 'One',
//       tag: ['a', 'b']
//     }
//   }
// }
```

Compact objects use `@` for attributes by default (`id` becomes `@id`) and `#text` / `#cdata` for mixed content. Containers are created with a null prototype, so XML names such as `__proto__`, `constructor`, and `prototype` remain data keys instead of mutating JavaScript prototypes. Use the tree helper when child order or mixed content order matters.

#### Fragment and Document Modes

`documentMode` defaults to `'fragment'` for real-world feeds and streams that may contain multiple top-level elements.

Use `documentMode: 'document'` when the input must be a single XML 1.0 document. Document mode rejects empty input, multiple root elements, non-whitespace text outside the document element, invalid XML names/chars, malformed attributes, invalid comments/processing instructions, and malformed entity/character references.

```typescript
import { EventReaderSync } from 'stax-xml';

// Default: fragment mode accepts sibling roots.
Array.from(new EventReaderSync('<item/><item/>'));

// Opt-in: document mode enforces one document element.
Array.from(new EventReaderSync('<root/>', { documentMode: 'document' }));
```

DTD validation, external entity fetching/expansion, XML 1.1, and UTF-16/encoding autodetection are intentionally outside the document-mode gate. External entity references are not resolved by default.

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
import { CursorEventType, CursorReader } from 'stax-xml/cursor';

const cursor = new CursorReader('<root><item id="1">Hello</item></root>');

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

When file or network I/O must stay non-blocking, use `EventReader`. The public API is an async iterator over a `ReadableStream<Uint8Array>`, while the backend still parses each arrived byte batch synchronously:

```typescript
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { EventReader, XmlEventType } from 'stax-xml';

const nodeStream = createReadStream('./large.xml', { highWaterMark: 1024 * 1024 });
const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
const parser = new EventReader(webStream);

for await (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log(event.name);
  }
}
```

### 💾 Memory-efficient sync writing

`WriterSync` returns an XML string by default, and `writeSync()` is still useful for small to medium documents.

For large documents, use `WriterSyncSink` with platform-specific sink adapters to write incrementally. The 1GiB writer benchmark shows the sync sink path has the best write throughput while keeping peak RSS in the same range as async writing.

```typescript
import { x } from 'stax-xml/converter';
import { openSync, writeFileSync, createWriteStream } from 'fs';

import WriterSync, { WriterSyncSink } from 'stax-xml';
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

// Optional: default import (package default is WriterSync)
new WriterSync();

// Optional: write to file synchronously in one shot
writeFileSync('./books-inline.xml', booksSchema.writeSync(books, { rootElement: 'catalog' }));

// Node target: truly synchronous local-file sink
const fd = openSync('./books-node-sync.xml', 'w');
const fileSink = new WriterSyncSink(
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
const streamSink = new WriterSyncSink(
  createNodeSyncTextSink(createWriteStream('./books-node-stream.xml'), { closeMethod: 'close' })
);
booksSchema.writeSync(books, { rootElement: 'catalog', writer: streamSink });
streamSink.close();

// Bun / Deno targets (subpath adapters)
// Bun: new WriterSyncSink(createBunSyncTextSink(Bun.stdout));
// Deno: new WriterSyncSink(createDenoSyncTextSink(Deno.stdout));
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

##### Basic Asynchronous Parsing (EventReader)

```typescript
import { EventReader, XmlEventType } from 'stax-xml';

const xmlContent = '<root><item>Hello</item></root>';
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlContent));
    controller.close();
  }
});

async function parseXml() {
  const parser = new EventReader(stream);
  for await (const event of parser) {
    console.log(event);
  }
}
parseXml();
```

##### Basic Synchronous Parsing (EventReaderSync)

```typescript
import { EventReaderSync, XmlEventType } from 'stax-xml';

const xmlContent = '<data><value>123</value></data>';
const parser = new EventReaderSync(xmlContent);

for (const event of parser) {
  console.log(event);
}
```

For detailed API documentation:
- [**Converter API Guide**](https://clickin.github.io/stax-xml): Declarative parsing with schemas
- [**EventReader (Asynchronous)**](https://clickin.github.io/stax-xml): Event-based parsing from streams
- [**EventReaderSync (Synchronous)**](https://clickin.github.io/stax-xml): Event-based parsing from strings

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

For application container images, build the JavaScript/TypeScript application in the builder layer, then install production dependencies in the runtime layer from the package manager lockfile. This lets the runtime image resolve the native optional dependency for its own OS, CPU, and libc variant. Copying `node_modules` from the builder layer is not recommended, especially with pnpm, because the installed tree may contain store symlinks or hardlinks that are not valid after a direct copy.

```dockerfile
FROM node:20-bullseye AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bullseye-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/server.js"]
```

For pnpm projects, use a runtime production install or `pnpm deploy --prod` for workspace apps; do not copy the builder `node_modules` tree directly:

```dockerfile
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile
```

Use an Alpine runtime only when you want the musl package path, for example `@stax-xml/native-linux-x64-musl`. The production install must run inside that Alpine runtime layer so the musl optional dependency is selected.

### 🧪 Testing

```bash
pnpm test
pnpm test:w3c
```

`pnpm test:w3c` downloads the official W3C XML Test Suite 20130923 archive from `https://www.w3.org/XML/Test/`, verifies the pinned SHA256, caches it locally, and runs the XML 1.0 document-mode non-validating subset. The gate includes XML 1.0 valid/invalid/not-well-formed cases that do not require DTD validation, external entity resolution, XML 1.1, or unsupported encodings. Those intentionally unsupported areas are reported as skipped, not as conformance claims.

#### Benchmark Results

Benchmark tables are maintained in the generated root report:

- [BENCHMARK.md](../../BENCHMARK.md)

The release benchmark pipeline reruns the canonical benchmark set, writes raw JSON artifacts, and regenerates both `BENCHMARK.md` and the docs benchmark pages from those results.

### 🙏 Special Thanks

StAX-XML's native acceleration and structural-index work learned a lot from [`simdxml`](https://cigrainger.com/blog/simdxml), especially its flat-array indexing and SIMD-oriented XML parsing ideas. Special thanks to [Christopher Grainger](https://bsky.app/profile/cigrainger.bsky.social) for publishing that work and for explicitly permitting this acknowledgement in [this Bluesky thread](https://bsky.app/profile/cigrainger.bsky.social/post/3mkgqhprnn22k).

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

Java의 StAX(Streaming API for XML)에서 영감을 받은 성능 중심 pull 방식 JavaScript/TypeScript XML 파서입니다. StAX-XML은 빠른 동기 파싱 경로, optional native acceleration, 그리고 전체 문서를 하나의 JavaScript 문자열로 만들지 않아도 되는 byte-batch API를 중심으로 설계되어 있습니다. 파일/네트워크 I/O를 non-blocking으로 유지해야 하면 async stream을 사용하고, batch job에서 현재 worker/thread를 막아도 된다면 Promise overhead가 없는 sync iterable 경로를 사용하세요.

현재 릴리스 벤치마크 기준으로 StAX-XML은 대용량 XML workload에서 JavaScript 생태계의 XML parser package 중 최상위권 처리량을 보입니다. JavaScript byte-batch parser는 Node, Bun, Deno, browser, edge runtime에서 동작하고, native addon을 허용하는 Node.js 환경에서는 배포된 `@stax-xml/native-*` optional package가 가장 빠른 경로를 제공합니다.

### 🚀 주요 기능

- **빠른 동기 byte-batch 파싱**: 대용량 `Uint8Array`/`Buffer` chunk stream을 하나의 전체 XML 문자열로 만들지 않고 동기적으로 파싱
- **기본 native acceleration**: `stax-xml` 설치만으로 현재 platform에 맞는 `@stax-xml/native-*` optional package가 설치되며, wasm/JavaScript fallback을 유지
- **저오버헤드 iterable API**: batch 단위 event frame에서 name, text, attribute를 필요할 때만 복사하여 hot path의 per-event object churn을 줄임
- **Async stream parser**: 파일/네트워크 I/O는 non-blocking으로 유지하고, 도착한 byte batch는 parser가 동기적으로 소비
- **커서 Reader API**: one-event-at-a-time 순회를 위한 `IterableReader` 위의 얇은 cursor-style wrapper
- **선언적 Converter API**: XPath를 지원하는 타입 안전 XML 파싱/쓰기용 Zod 스타일 스키마 API
- **양방향 변환**: XML을 객체로 파싱하고 객체를 다시 XML로 작성
- **동기 sink 쓰기**: 대용량 XML 출력에 권장되는 고처리량 경로
- **사용자 정의 매핑**: 단순한 JSON 객체가 아닌 원하는 구조로 XML 데이터 매핑 가능
- **범용 호환성**: Node.js, Bun, Deno, 웹 브라우저에서 동작하며, 브라우저 고성능 경로는 WebAssembly를 권장하고 순수 JavaScript 파서는 호환 fallback으로 유지
- **네임스페이스 지원**: 기본 XML 네임스페이스 처리
- **엔티티 지원**: 사용자 정의 엔티티 지원을 포함한 내장 엔티티 디코딩
- **Fragment 기본 모드**: `documentMode` 기본값은 `'fragment'`이며, XML document shape 검사는 `'document'`로 선택 적용
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

StAX-XML은 여러 parsing surface를 제공합니다. 실행 경계에 맞는 API를 선택하세요:

| Workload | 권장 API | 이유 |
| --- | --- | --- |
| 현재 worker/thread를 막아도 되는 대용량 로컬 파일 또는 batch job | `stax-xml/iterable` 또는 `stax-xml/iterable/node` | 빠른 동기 byte-batch 파싱, Promise overhead 없음, 전체 문자열 강제 없음 |
| 파일/네트워크 I/O를 non-blocking으로 유지해야 하는 작업 | `EventReader` | `ReadableStream<Uint8Array>` 기반 async iterator |
| ergonomic event 순회 | `CursorReader` | iterable backend 위의 cursor-style accessor |
| XML-to-object 매핑 | `stax-xml/converter` | XPath와 writer를 지원하는 typed schema API |

#### 빠른 동기 대용량 파일 파싱

Node batch job에서는 파일을 고정 크기 byte chunk로 동기적으로 읽고 파싱할 수 있습니다. 이 경로는 `fs.readFileSync(path, 'utf8')`를 요구하지 않고, 전체 XML 문자열을 메모리에 유지하지 않으며, async iterator/Promise overhead도 피합니다.

```typescript
import {
  IterableEventType,
  NodeIterableReader,
  nodeFileByteBatchesSync
} from 'stax-xml/iterable/node';

const parser = new NodeIterableReader(
  nodeFileByteBatchesSync('./large.xml', {
    chunkSize: 1024 * 1024,
    batchSize: 16
  })
);

let elementCount = 0;

while (parser.nextBatch()) {
  for (let index = 0; index < parser.eventCount(); index++) {
    if (parser.eventType(index) === IterableEventType.START_ELEMENT) {
      elementCount++;
      // name/text/attribute는 요청할 때만 복사합니다.
      console.log(parser.copyName(index));
    }
  }
}

console.log(`처리한 전체 요소 수: ${elementCount}`);
```

portable byte source에는 `stax-xml/iterable`의 `IterableReader`와 `Iterable<Uint8Array[]>` batch를 사용하세요. Node의 `Buffer` 전용 file helper 없이 같은 동기 파싱 모델을 사용할 수 있습니다.

#### Unknown XML을 Tree 또는 Object로 파싱

목표 shape를 알고 있다면 converter API를 사용하세요. 스키마가 없는 unknown XML을 빠르게 확인해야 한다면 convenience helper를 사용할 수 있습니다:

- `parseXmlTree()` / `parseXmlTreeSync()`는 Python ElementTree와 비슷한 순서 보존 tree를 반환합니다.
- `parseXmlObject()` / `parseXmlObjectSync()`는 txml 또는 fast-xml-parser처럼 compact JavaScript object를 반환합니다.

```typescript
import { parseXmlObjectSync, parseXmlTreeSync } from 'stax-xml';

const xml = '<catalog><book id="1"><title>One</title><tag>a</tag><tag>b</tag></book></catalog>';

const tree = parseXmlTreeSync(xml);
// tree.children[0] -> { type: 'element', name: 'catalog', attributes, children }

const object = parseXmlObjectSync(xml);
// {
//   catalog: {
//     book: {
//       '@id': '1',
//       title: 'One',
//       tag: ['a', 'b']
//     }
//   }
// }
```

Compact object는 기본적으로 attribute에 `@` prefix를 붙이고(`id`는 `@id`), mixed content에는 `#text` / `#cdata` key를 사용합니다. Container는 null-prototype object로 생성하므로 `__proto__`, `constructor`, `prototype` 같은 XML name도 JavaScript prototype을 변경하지 않고 데이터 key로 남습니다. Child order나 mixed content order가 중요하면 tree helper를 사용하세요.

#### Fragment 모드와 Document 모드

`documentMode` 기본값은 `'fragment'`입니다. 여러 top-level element가 이어지는 현실 feed나 stream을 기본으로 허용합니다.

입력이 하나의 XML 1.0 document여야 한다면 `documentMode: 'document'`를 선택하세요. Document 모드는 빈 입력, 여러 root element, document element 밖의 non-whitespace text, 잘못된 XML name/char, 잘못된 attribute, 잘못된 comment/processing instruction, 잘못된 entity/character reference를 reject합니다.

```typescript
import { EventReaderSync } from 'stax-xml';

// 기본값: fragment mode는 sibling root를 허용합니다.
Array.from(new EventReaderSync('<item/><item/>'));

// 선택값: document mode는 하나의 document element를 강제합니다.
Array.from(new EventReaderSync('<root/>', { documentMode: 'document' }));
```

DTD validation, external entity fetch/expand, XML 1.1, UTF-16/encoding autodetect는 document-mode gate 범위에서 의도적으로 제외합니다. External entity reference는 기본적으로 resolve하지 않습니다.

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
import { CursorEventType, CursorReader } from 'stax-xml/cursor';

const cursor = new CursorReader('<root><item id="1">안녕</item></root>');

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

파일 또는 네트워크 I/O를 non-blocking으로 유지해야 한다면 `EventReader`를 사용하세요. 공개 API는 `ReadableStream<Uint8Array>` 위의 async iterator이고, backend는 도착한 byte batch를 동기적으로 파싱합니다:

```typescript
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { EventReader, XmlEventType } from 'stax-xml';

const nodeStream = createReadStream('./large.xml', { highWaterMark: 1024 * 1024 });
const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
const parser = new EventReader(webStream);

for await (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log(event.name);
  }
}
```

### 💾 메모리 효율적인 동기 쓰기

`WriterSync`는 기본적으로 최종 XML 문자열을 반환합니다. 대용량 문서에서는 `WriterSyncSink`를 사용해 증분 쓰기를 하세요. 1GiB writer 벤치마크 기준으로 sync sink 경로가 가장 높은 쓰기 처리량을 보이면서 peak RSS는 async 쓰기와 같은 범위에 머뭅니다.

```typescript
import { x } from 'stax-xml/converter';
import { openSync, writeFileSync, createWriteStream } from 'fs';

import {
  WriterSync,
  WriterSyncSink
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

// 기본 import 방식 (패키지 기본 export가 WriterSync)
new WriterSync();

// 동기/인메모리: 문자열로 한 번에 생성
writeFileSync('./books-inline.xml', booksSchema.writeSync(books, { rootElement: 'catalog' }));

// Node 대상: 진짜 동기 로컬 파일 sink
const fd = openSync('./books-node-sync.xml', 'w');
const fileSink = new WriterSyncSink(
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
const streamSink = new WriterSyncSink(
  createNodeSyncTextSink(createWriteStream('./books-node-stream.xml'), { closeMethod: 'close' })
);
booksSchema.writeSync(books, { rootElement: 'catalog', writer: streamSink });
streamSink.close();

// Bun / Deno 대상 (subpath adapter)
// Bun: new WriterSyncSink(createBunSyncTextSink(Bun.stdout));
// Deno: new WriterSyncSink(createDenoSyncTextSink(Deno.stdout));
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

##### 기본 비동기 파싱 (EventReader)

```typescript
import { EventReader, XmlEventType } from 'stax-xml';

const xmlContent = '<root><item>안녕하세요</item></root>';
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlContent));
    controller.close();
  }
});

async function parseXml() {
  const parser = new EventReader(stream);
  for await (const event of parser) {
    console.log(event);
  }
}
parseXml();
```

##### 기본 동기 파싱 (EventReaderSync)

```typescript
import { EventReaderSync, XmlEventType } from 'stax-xml';

const xmlContent = '<data><value>123</value></data>';
const parser = new EventReaderSync(xmlContent);

for (const event of parser) {
  console.log(event);
}
```

자세한 API 문서는 다음을 참조하세요:
- [**Converter API 가이드**](https://clickin.github.io/stax-xml): 스키마를 사용한 선언적 파싱
- [**EventReader (비동기)**](https://clickin.github.io/stax-xml): 스트림 기반 이벤트 파싱
- [**EventReaderSync (동기)**](https://clickin.github.io/stax-xml): 문자열 기반 이벤트 파싱

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

애플리케이션 컨테이너 이미지는 builder layer에서 JavaScript/TypeScript 애플리케이션을 빌드하고, runtime layer에서는 package manager lockfile로 production dependency를 다시 설치하는 방식을 권장합니다. 그래야 runtime image의 OS, CPU, libc variant에 맞는 native optional dependency가 선택됩니다. 특히 pnpm은 store symlink/hardlink 구조를 사용하므로 builder의 `node_modules`를 runtime에 직접 복사하는 방식은 권장하지 않습니다.

```dockerfile
FROM node:20-bullseye AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bullseye-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/server.js"]
```

pnpm project에서는 runtime production install이나 workspace app 대상 `pnpm deploy --prod`를 사용하세요. builder의 `node_modules` tree를 직접 복사하지 않습니다:

```dockerfile
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile
```

Alpine runtime은 musl package 경로가 필요할 때만 사용하세요. 예를 들어 x64 Alpine에서는 `@stax-xml/native-linux-x64-musl`이 선택됩니다. musl optional dependency가 선택되도록 production install도 해당 Alpine runtime layer 안에서 실행해야 합니다.

### 🙏 특별 감사

StAX-XML의 native acceleration과 structural-index 작업은 [`simdxml`](https://cigrainger.com/blog/simdxml)의 flat-array indexing 및 SIMD 기반 XML 파싱 아이디어에서 많은 힌트를 얻었습니다. 해당 작업을 공개하고 [Bluesky thread](https://bsky.app/profile/cigrainger.bsky.social/post/3mkgqhprnn22k)를 통해 이 acknowledgement를 명시적으로 허가해 준 [Christopher Grainger](https://bsky.app/profile/cigrainger.bsky.social)에게 특별히 감사드립니다.

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
