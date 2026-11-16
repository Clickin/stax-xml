# StAX-XML

[English](#english) | [한국어](#korean)

---

## English

`stax-xml` is a pull-based (StAX) XML parser and writer for JavaScript and TypeScript, built to handle multi-gigabyte XML files with constant memory.

It is 100% pure JavaScript—no native addons or WebAssembly—so parsed values are created directly on the JS heap.

### Goals

- **Constant memory on huge files:** Stream XML well past JavaScript's single-string limit (~512MB–1GB) in byte chunks without running out of memory.
- **Pull-based API:** Read XML with regular `for` loops instead of juggling SAX callback state.
- **Sync core, async I/O:** Only reading from the stream is async; once a chunk arrives, tokenizing and parsing run in a synchronous loop.
- **Runs anywhere:** Works in Node.js, Bun, browsers, and edge runtimes without build steps or native bindings.

### Why pure JavaScript?

We built and benchmarked N-API and WebAssembly tokenizers first. Native code scans raw bytes faster on its own, but real applications need element names, text, attributes, and objects as **JavaScript values**.

That boundary changes the math:

1. **Bridge overhead:** Even when native code reads a JS `Buffer` or `ArrayBuffer` without copying, every parsed string still has to cross back into JavaScript. Because JS strings are immutable values rather than reusable `char[]` views, crossing the boundary means UTF-8 decoding, allocation, and wrapper overhead on every token.
2. **One heap instead of two:** WebAssembly uses separate linear memory, and native addons allocate on a native heap alongside V8. Keeping the parser in JavaScript leaves all state and parsed results on the V8 heap.

So we moved the native experiments out of this package and focused `stax-xml` on byte-oriented pure JavaScript for parsing, object conversion, and writing.

### Install

```bash
npm install stax-xml # or pnpm, yarn, bun whatever you prefer
```

`stax-xml` is ESM-only.

```ts
import { EventReaderSync, XmlEventType } from 'stax-xml';

const reader = new EventReaderSync('<root><item id="1">hello</item></root>');

for (const event of reader) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log(event.name, event.attributes);
  }
}
```

### Browser CDN

Without a bundler, import the ESM bundle from jsDelivr:

```html
<script type="module">
  import {
    EventReaderSync,
    XmlEventType,
  } from 'https://cdn.jsdelivr.net/npm/stax-xml@latest/dist/index.js';

  for (const event of new EventReaderSync('<root><item>ok</item></root>')) {
    if (event.type === XmlEventType.START_ELEMENT) console.log(event.name);
  }
</script>
```

The converter bundle (`https://cdn.jsdelivr.net/npm/stax-xml@latest/dist/converter.js`) and unpkg mirrors (`https://unpkg.com/stax-xml@latest/dist/index.js`, `https://unpkg.com/stax-xml@latest/dist/converter.js`) are also available. All of them are ESM URLs—not global `<script src>` files—so load them with `type="module"`, and pin an exact version (for example, `stax-xml@<version>`) in production.

### Public API

`stax-xml` exposes two entry points: `stax-xml` and `stax-xml/converter`.

- `stax-xml/converter` *(recommended)*: Schema-driven XML-to-object parsing and XML writing. Start here if you already know the shape of the objects you want.
- `EventReaderSync` / `EventReader`: Event-by-event readers for iterating over parsed XML events directly.
- `StreamReaderSync` / `StreamReader`: Cursor-based readers that inspect the current token in place to minimize allocations.
- `Writer`, `WriterSync`, `WriterSyncSink`: XML writers, with `WriterSyncSink` for streaming large outputs directly to a synchronous sink.

### Performance

Numbers from the v1.1.0 release benchmark (Node 26.5.0, Apple M4). See [Benchmarks](https://clickin.github.io/stax-xml/resources/benchmarks/) for the full tables and methodology.

**Node XML libraries:** parse a 13 MiB file (`midsize.xml`) into the same JavaScript object array. Outputs are verified to match before timing.

| Library | API | Avg time | Heap |
| --- | --- | ---: | ---: |
| stax-xml | Converter API | 113.8 ms | 11.8 MiB |
| stax-xml | `StreamReaderSync` | 115.8 ms | 17.8 MiB |
| stax-xml | `EventReaderSync` | 124.7 ms | 8.4 MiB |
| txml | `parse` | 91.5 ms | 126.8 MiB |
| xml2js | `parseString` | 463.2 ms | 105.5 MiB |
| fast-xml-parser | `XMLParser` | 542.0 ms | 135.3 MiB |

**Across languages:** the reader parses a 16 MiB UTF-8 file and materializes every element name, text, and attribute. The writer emits the same 10.3 MiB compact XML to a file. Both include file I/O.

| Library | Language | Reader (16 MiB) | Writer (10.3 MiB) |
| --- | --- | ---: | ---: |
| stax-xml | JavaScript (Node 26.5.0) | 97.4 MiB/s | 149.1 MiB/s |
| Woodstox 6.7.0 | Java 25 | 284.4 MiB/s | 106.5 MiB/s |
| quick-xml 0.40.1 | Rust 1.95 | 597.6 MiB/s | 185.9 MiB/s |

Woodstox and quick-xml produce JVM and Rust values rather than JavaScript values. Their rows are included for reference.

### Guides & Documentation

- [Full Documentation](https://clickin.github.io/stax-xml/)
- [Migrating from v0.x](https://clickin.github.io/stax-xml/guide/migration-v0/): Upgrading older code to the pure JS 1.0+ reader and writer APIs.
- [Web Server Integration](https://clickin.github.io/stax-xml/guide/server-integration/): Streaming XML request bodies in Express, Fastify, Hono, Next.js, Bun, and edge runtimes.

### Runtime Matrix

Benchmark scripts live in `packages/benchmark`. To compare the reader workload across installed Node and Bun runtimes:

```bash
pnpm --dir packages/benchmark bench:runtime-matrix
```

---

## Korean

`stax-xml`은 수 GB짜리 XML 문서도 적은 메모리로 처리할 수 있는 JavaScript·TypeScript용 Pull 방식(StAX) XML 파서·라이터입니다.

네이티브 애드온이나 Wasm 없이 100% 순수 JavaScript로 동작합니다. 파싱 결과도 별도 브릿지를 거치지 않고 곧바로 JS 힙에 생성됩니다.

### 설계 목표

- **대용량 파일도 일정한 메모리로:** 스트림을 바이트 단위로 조금씩 읽어 들이기 때문에, JS 문자열 한계(약 512MB~1GB)를 넘는 파일도 OOM 없이 처리할 수 있습니다.
- **Pull 방식 API:** SAX처럼 콜백 안에서 상태를 일일이 관리할 필요 없이, 일반 `for` 루프로 필요한 만큼만 가져와 읽습니다.
- **동기식 파싱 코어:** 비동기는 I/O에서 데이터를 받아올 때만 씁니다. 청크가 메모리에 올라온 뒤 토크나이징과 파싱은 전부 동기 루프로 돕니다.
- **어디서나 동일한 실행:** 빌드나 네이티브 의존성 없이 Node.js, Bun, 브라우저, Edge 런타임에서 똑같이 돌아갑니다.

### 왜 순수 JavaScript인가?

처음에는 N-API 네이티브 애드온과 Wasm 토크나이저도 직접 구현해 벤치마크해 보았습니다. 바이트만 훑는 속도는 네이티브가 빠르지만, 실제 애플리케이션에서는 결국 태그 이름, 텍스트, 속성, 객체를 **JavaScript 값**으로 받아 써야 합니다. 여기서 손익이 달라집니다.

1. **브릿지 비용:** 네이티브 코드가 JS `Buffer`나 `ArrayBuffer`를 복사 없이 읽더라도, 파싱된 문자열과 객체는 결국 JS 쪽으로 넘겨줘야 합니다. JS 문자열은 재사용 가능한 `char[]` 뷰가 아닌 불변 값이라, 토큰마다 UTF-8 디코딩과 새 메모리 할당, 래퍼 생성 비용이 발생합니다.
2. **단일 힙:** Wasm은 별도의 선형 메모리를 쓰고, 네이티브 애드온은 V8 밖의 네이티브 힙을 따로 씁니다. 처리를 전부 JS 안에서 끝내면 파서 상태와 결과물이 모두 V8 힙 하나에만 남습니다.

그래서 네이티브 실험 코드는 패키지에서 걷어내고, 바이트 기반 순수 JavaScript로 파싱과 객체 변환, 쓰기 API를 구현하는 데 집중했습니다.

### 설치

```bash
npm install stax-xml # pnpm, yarn, bun 등
```

`stax-xml`은 ESM 전용 패키지입니다.

```ts
import { EventReaderSync, XmlEventType } from 'stax-xml';

const reader = new EventReaderSync('<root><item id="1">hello</item></root>');

for (const event of reader) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log(event.name, event.attributes);
  }
}
```

### 브라우저 CDN

번들러 없이 jsDelivr의 ESM 번들을 바로 불러다 쓸 수도 있습니다.

```html
<script type="module">
  import {
    EventReaderSync,
    XmlEventType,
  } from 'https://cdn.jsdelivr.net/npm/stax-xml@latest/dist/index.js';

  for (const event of new EventReaderSync('<root><item>ok</item></root>')) {
    if (event.type === XmlEventType.START_ELEMENT) console.log(event.name);
  }
</script>
```

jsDelivr 컨버터 번들(`https://cdn.jsdelivr.net/npm/stax-xml@latest/dist/converter.js`)과 unpkg(`https://unpkg.com/stax-xml@latest/dist/index.js`, `https://unpkg.com/stax-xml@latest/dist/converter.js`)도 같은 방식으로 쓸 수 있습니다. 모두 ESM 전용 URL이므로 일반 `<script src>`로는 동작하지 않으며, 프로덕션에서는 `@latest` 대신 특정 버전(예: `stax-xml@<version>`)으로 고정해 두는 편이 안전합니다.

### 주요 API

패키지 진입점은 `stax-xml`과 `stax-xml/converter` 두 가지입니다.

- `stax-xml/converter` *(권장)*: 스키마를 정해 XML과 JS 객체를 서로 변환합니다. 원하는 객체 형태가 정해져 있다면 이쪽부터 시작하는 편이 가장 간단합니다.
- `EventReaderSync` / `EventReader`: 시작 태그나 텍스트 같은 이벤트를 하나씩 꺼내 다루는 리더입니다.
- `StreamReaderSync` / `StreamReader`: 현재 토큰만 가리키는 커서 방식 리더입니다. 이벤트 객체를 매번 만들지 않으므로 메모리 할당을 더 줄여야 할 때 적합합니다.
- `Writer`, `WriterSync`, `WriterSyncSink`: XML 출력용 API입니다. 큰 XML을 한 번에 문자열로 만들지 않고 바로 내보내려면 `WriterSyncSink`를 쓰면 됩니다.

### 성능

v1.1.0 릴리스 기준 벤치마크입니다(Node 26.5.0, Apple M4). 전체 결과와 측정 조건은 [벤치마크 문서](https://clickin.github.io/stax-xml/ko/resources/benchmarks/)에서 볼 수 있습니다.

**Node XML 라이브러리 비교:** 13 MiB 파일(`midsize.xml`)을 동일한 JS 객체 배열로 파싱한 결과입니다. 측정 전에 모든 라이브러리의 출력이 일치하는지 확인했습니다.

| 라이브러리 | API | 평균 시간 | 힙 |
| --- | --- | ---: | ---: |
| stax-xml | Converter API | 113.8 ms | 11.8 MiB |
| stax-xml | `StreamReaderSync` | 115.8 ms | 17.8 MiB |
| stax-xml | `EventReaderSync` | 124.7 ms | 8.4 MiB |
| txml | `parse` | 91.5 ms | 126.8 MiB |
| xml2js | `parseString` | 463.2 ms | 105.5 MiB |
| fast-xml-parser | `XMLParser` | 542.0 ms | 135.3 MiB |

**언어별 비교:** 리더는 16 MiB UTF-8 파일을 읽어 모든 요소 이름·텍스트·속성을 꺼내는 작업, 라이터는 10.3 MiB compact XML을 파일로 쓰는 작업이며 모두 파일 I/O를 포함합니다.

| 라이브러리 | 언어 | 리더 (16 MiB) | 라이터 (10.3 MiB) |
| --- | --- | ---: | ---: |
| stax-xml | JavaScript (Node 26.5.0) | 97.4 MiB/s | 149.1 MiB/s |
| Woodstox 6.7.0 | Java 25 | 284.4 MiB/s | 106.5 MiB/s |
| quick-xml 0.40.1 | Rust 1.95 | 597.6 MiB/s | 185.9 MiB/s |

Woodstox와 quick-xml은 JS 값이 아니라 각각 JVM과 Rust 값을 생성하므로 참고용으로만 실었습니다.

### 가이드 및 문서

- [공식 문서](https://clickin.github.io/stax-xml/ko/)
- [v0.x 마이그레이션](https://clickin.github.io/stax-xml/ko/guide/migration-v0/): 기존 코드를 순수 JS 1.0+ 리더·라이터 API로 옮기는 가이드
- [웹 서버 연동](https://clickin.github.io/stax-xml/ko/guide/server-integration/): Express, Fastify, Hono, Next.js, Bun, Edge 런타임에서 XML 요청 본문을 스트리밍으로 처리하는 방법

### 런타임 비교

벤치마크 스크립트는 `packages/benchmark`에 있습니다. 로컬에 설치된 Node와 Bun에서 동일한 리더 워크로드를 비교하려면 아래 명령을 실행하세요.

```bash
pnpm --dir packages/benchmark bench:runtime-matrix
```

## License

MIT
