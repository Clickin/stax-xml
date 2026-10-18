# StAX-XML

[English](#english) | [한국어](#korean)

---

## English

`stax-xml` is a StAX-style, pull-based XML parser and writer for JavaScript and
TypeScript, built to process multi-gigabyte XML documents with a small, constant
memory footprint.

It is 100% pure JavaScript. The parser core, stream readers, event readers,
converter, and writer all run without native addons, WebAssembly modules, or
backend selection, so parsed values are created directly as JavaScript values
in a single heap.

### Goals

- **Small, constant memory for massive files:** Parse XML documents far larger
  than JavaScript's single-string limit (~512MB–1GB) without `Out of Memory`
  crashes by consuming streams and byte batches.
- **No native bridge, single heap:** Keep parsing inside JavaScript so results
  never cross an FFI/Wasm bridge and no second native or Wasm heap is needed.
- **StAX-style pull API:** Let application code pull events with standard loops
  instead of maintaining deep SAX callback state machines.
- **Sync core, async boundaries:** Keep async work strictly at I/O ingress
  boundaries. Once a byte batch arrives, tokenization and event draining run in
  a synchronous loop.
- **Universal portability:** Run identically across Node.js, Bun, Deno,
  browsers, and edge runtimes.

### Why pure JavaScript?

We built and benchmarked native (N-API) and WebAssembly tokenizers first. Native
code scans raw XML bytes quickly in isolation, but `stax-xml` is not a raw
tokenizer benchmark. In a real application, the parser must deliver element
names, text, attributes, events, and objects as JavaScript values.

That boundary changes the tradeoff:

1. **No FFI/Wasm bridge cost:** Native code can read JavaScript
   `Buffer`/`ArrayBuffer` input without copying, but every parsed string and
   object still has to cross back into JavaScript. Because JavaScript strings
   are immutable primitives rather than reusable `char[]` views, crossing the
   bridge incurs UTF-8 decoding, allocation, and wrapper overhead on every token.
2. **No second heap:** Wasm requires a separate linear memory island, and
   native addons allocate on the native heap alongside V8. Staying in
   JavaScript keeps all parser state and results in the V8 heap.

For that reason, the native experiment was moved out of this package, and
`stax-xml` centers on byte-oriented pure JavaScript for XML-to-object
conversion, event reading, cursor reading, and writing.

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

Without a bundler, import the pinned ESM bundle directly from jsDelivr:

```html
<script type="module">
  import {
    EventReaderSync,
    XmlEventType,
  } from 'https://cdn.jsdelivr.net/npm/stax-xml@1.1.2/dist/index.js';

  for (const event of new EventReaderSync('<root><item>ok</item></root>')) {
    if (event.type === XmlEventType.START_ELEMENT) console.log(event.name);
  }
</script>
```

The same files are available from unpkg:
`https://unpkg.com/stax-xml@1.1.2/dist/index.js` and
`https://unpkg.com/stax-xml@1.1.2/dist/converter.js`. The converter bundle is
also available at
`https://cdn.jsdelivr.net/npm/stax-xml@1.1.2/dist/converter.js`. These are ESM
URLs, not classic global `<script src>` files. Pin an exact version in
production.

### Public API

- `stax-xml/converter`: Recommended schema-driven XML-to-object parsing and XML writing.
- `EventReaderSync` / `EventReader`: Ergonomic event readers for applications that inspect events directly.
- `StreamReaderSync` / `StreamReader`: Zero-allocation current-token cursor readers for performance-critical paths.
- `Writer`, `WriterSync`, `WriterSyncSink`: XML output APIs, including a synchronous sink path for large outputs.

When your target object structure is known, start with the converter. The
package exposes only `stax-xml` and `stax-xml/converter`; there are no adapter,
tree/DOM, or backend selection subpaths.

### Performance

Numbers from the v1.1.0 release benchmark (Node 26.5.0, Apple M4). See
[Benchmarks](https://clickin.github.io/stax-xml/resources/benchmarks/) for the
full tables and methodology.

**Node XML libraries:** parse a 13 MiB file (`midsize.xml`) into the same
JavaScript object array. Output parity is checked before timing.

| Library | API | Avg time | Heap |
| --- | --- | ---: | ---: |
| stax-xml | Converter API | 113.8 ms | 11.8 MiB |
| stax-xml | `StreamReaderSync` | 115.8 ms | 17.8 MiB |
| stax-xml | `EventReaderSync` | 124.7 ms | 8.4 MiB |
| txml | `parse` | 91.5 ms | 126.8 MiB |
| xml2js | `parseString` | 463.2 ms | 105.5 MiB |
| fast-xml-parser | `XMLParser` | 542.0 ms | 135.3 MiB |

**Across languages:** the reader parses a 16 MiB UTF-8 file and materializes
every element name, text, and attribute. The writer emits the same 10.3 MiB
compact XML to a file. Both include file I/O.

| Library | Language | Reader (16 MiB) | Writer (10.3 MiB) |
| --- | --- | ---: | ---: |
| stax-xml | JavaScript (Node 26.5.0) | 97.4 MiB/s | 149.1 MiB/s |
| Woodstox 6.7.0 | Java 25 | 284.4 MiB/s | 106.5 MiB/s |
| quick-xml 0.40.1 | Rust 1.95 | 597.6 MiB/s | 185.9 MiB/s |

Woodstox and quick-xml produce JVM and Rust values rather than JavaScript
values. Their rows are included for reference.

### Guides & Documentation

- [Full Documentation](https://clickin.github.io/stax-xml/)
- [Migrating from v0.x](https://clickin.github.io/stax-xml/guide/migration-v0/)
  maps older application code to the pure JavaScript 1.0+ reader and writer APIs.
- [Web Server Integration](https://clickin.github.io/stax-xml/guide/server-integration/)
  shows how to keep XML request bodies streaming in Express, Fastify, Hono,
  Next.js, Bun, Deno, and edge runtimes.
- [Release Readiness](https://clickin.github.io/stax-xml/resources/release-readiness/)
  records the pure JavaScript packaging, benchmark, docs, and merge checklist.

### Runtime Matrix

Benchmark scripts live under `packages/benchmark`. To run the cross-runtime
comparison:

```bash
pnpm --dir packages/benchmark bench:runtime-matrix
```

This compares the same JavaScript reader workload across Node and Bun when
those runtimes are installed.

---

## Korean

`stax-xml`은 수 기가바이트(GB) 단위의 대용량 XML 문서도 아주 적은 고정 메모리로
빠르게 처리할 수 있도록 설계된 JavaScript 및 TypeScript용 StAX(Pull 방식) XML
파서 및 라이터입니다.

이 패키지는 100% 순수 JavaScript로 동작합니다. 파서 코어, 스트림 리더, 이벤트
리더, 컨버터, 라이터 모두 네이티브 애드온(N-API), Wasm 모듈, 백엔드 선택 없이
동작하므로, 파싱 결과가 하나의 힙 안에서 곧바로 JavaScript 값으로 만들어집니다.

### 핵심 목표

- **적은 메모리로 대용량 파일 처리:** JavaScript의 단일 문자열 크기 한계(약
  512MB~1GB)를 넘는 대용량 XML도 스트림과 바이트 배치(Byte batch) 단위로 읽어,
  메모리 부족(OOM) 없이 일정하고 낮은 메모리 사용량을 유지합니다.
- **네이티브 브릿지 없는 단일 힙:** 파싱을 JavaScript 안에서 끝내므로 결과가
  FFI/Wasm 브릿지를 넘지 않고, 별도의 네이티브/Wasm 힙도 필요하지 않습니다.
- **StAX 스타일 Pull API:** 복잡한 SAX 콜백 상태 머신(State machine)을 직접
  유지할 필요 없이, 일반 루프로 파싱 흐름을 직접 제어합니다.
- **비동기 I/O 경계 분리:** 비동기(Async) 작업은 I/O 유입 경계에만 둡니다. 바이트
  배치가 메모리에 도착한 뒤의 토크나이징과 이벤트 처리는 빠른 동기 루프로
  동작합니다.
- **완벽한 이식성:** Node.js, Bun, Deno, 브라우저, Edge 런타임 어디서나 빌드나
  환경 제약 없이 동일하게 동작합니다.

### 왜 순수 JavaScript인가?

처음에는 네이티브 애드온(N-API)과 Wasm 기반의 토크나이저 가속을 먼저 구현해
검증했습니다. 순수하게 XML 바이트를 스캔하는 작업만 놓고 보면 네이티브 코드가
빠르지만, `stax-xml`의 목적은 단순 스캔 벤치마크가 아닙니다. 실제 사용자는 태그
이름, 텍스트, 속성, 이벤트, 객체를 **JavaScript 값**으로 읽어야 합니다.

이 경계(Boundary)에서 득실이 달라집니다.

1. **브릿지(Bridge) 비용 제거:** 네이티브 코드가 JavaScript `Buffer`/`ArrayBuffer`
   입력을 복사 없이(Zero-copy) 읽더라도, 파싱된 결과는 결국 JavaScript 문자열과
   객체로 넘어와야 합니다. JavaScript 문자열은 재사용 가능한 `char[]` 뷰가 아니라
   불변(Immutable) 원시 값이므로, 경계를 넘을 때마다 디코딩, 메모리 할당, 래퍼
   생성 비용이 발생합니다.
2. **두 번째 힙 불필요:** Wasm은 별도의 선형 메모리 공간을 요구하고, 네이티브
   애드온은 V8 힙 외에 추가 네이티브 힙을 사용합니다. 모든 처리를 JavaScript
   안에서 끝내면 파서 상태와 결과가 모두 V8 힙 하나에 머뭅니다.

이 때문에 네이티브 실험 코드는 패키지에서 분리했고, `stax-xml`은 바이트 지향 순수
JavaScript 엔진을 중심으로 XML-객체 변환, 이벤트/커서 리더, 라이터를 제공합니다.

### 설치

```bash
npm install stax-xml # 혹은 pnpm, yarn, bun 등 원하시는 패키지 매니저로
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

### Browser CDN

번들러 없이 jsDelivr에서 버전이 고정된 ESM 번들을 직접 import할 수 있습니다.

```html
<script type="module">
  import {
    EventReaderSync,
    XmlEventType,
  } from 'https://cdn.jsdelivr.net/npm/stax-xml@1.1.2/dist/index.js';

  for (const event of new EventReaderSync('<root><item>ok</item></root>')) {
    if (event.type === XmlEventType.START_ELEMENT) console.log(event.name);
  }
</script>
```

동일한 파일을 unpkg에서도 불러올 수 있습니다:
`https://unpkg.com/stax-xml@1.1.2/dist/index.js`,
`https://unpkg.com/stax-xml@1.1.2/dist/converter.js`. 컨버터 번들은
`https://cdn.jsdelivr.net/npm/stax-xml@1.1.2/dist/converter.js`에서도 제공됩니다.
이 주소들은 전역 `<script src>`용 파일이 아니라 ESM 전용 URL입니다. 프로덕션
환경에서는 정확한 버전을 고정해서 사용하세요.

### 주요 API (Public API)

- `stax-xml/converter`: **[권장]** 스키마 기반의 XML-객체 변환(파싱) 및 XML 생성.
- `EventReaderSync` / `EventReader`: 이벤트를 직접 순회하며 처리하는 애플리케이션용 리더.
- `StreamReaderSync` / `StreamReader`: 객체 할당 비용을 최소화해야 하는 고성능 구간용 커서(현재 토큰) 리더.
- `Writer`, `WriterSync`, `WriterSyncSink`: 대용량 출력을 위한 동기식 Sink 경로(`WriterSyncSink`)를 포함한 XML 생성 API.

변환할 객체 형태가 정해져 있다면 `converter`부터 시작하는 것을 권장합니다. 패키지
진입점은 `stax-xml`과 `stax-xml/converter` 두 가지뿐이며, 별도의 어댑터나
DOM/백엔드 선택용 서브패스는 제공하지 않습니다.

### 성능

v1.1.0 릴리스 벤치마크 결과입니다(Node 26.5.0, Apple M4). 전체 표와 측정 방법은
[벤치마크](https://clickin.github.io/stax-xml/ko/resources/benchmarks/) 문서를
참고하세요.

**Node XML 라이브러리:** 13 MiB 파일(`midsize.xml`)을 동일한 JavaScript 객체
배열로 변환합니다. 측정 전에 모든 라이브러리의 결과가 같은지 검증합니다.

| 라이브러리 | API | 평균 시간 | 힙 |
| --- | --- | ---: | ---: |
| stax-xml | Converter API | 113.8 ms | 11.8 MiB |
| stax-xml | `StreamReaderSync` | 115.8 ms | 17.8 MiB |
| stax-xml | `EventReaderSync` | 124.7 ms | 8.4 MiB |
| txml | `parse` | 91.5 ms | 126.8 MiB |
| xml2js | `parseString` | 463.2 ms | 105.5 MiB |
| fast-xml-parser | `XMLParser` | 542.0 ms | 135.3 MiB |

**언어별 비교:** 리더는 16 MiB UTF-8 파일을 읽어 모든 요소 이름, 텍스트, 속성을
값으로 꺼냅니다. 라이터는 동일한 10.3 MiB compact XML을 파일로 씁니다. 둘 다 파일
I/O를 포함합니다.

| 라이브러리 | 언어 | 리더 (16 MiB) | 라이터 (10.3 MiB) |
| --- | --- | ---: | ---: |
| stax-xml | JavaScript (Node 26.5.0) | 97.4 MiB/s | 149.1 MiB/s |
| Woodstox 6.7.0 | Java 25 | 284.4 MiB/s | 106.5 MiB/s |
| quick-xml 0.40.1 | Rust 1.95 | 597.6 MiB/s | 185.9 MiB/s |

Woodstox와 quick-xml은 JavaScript 값이 아니라 JVM/Rust 값을 만듭니다. 참고용으로
함께 실었습니다.

### 가이드 및 문서

- [공식 문서 홈](https://clickin.github.io/stax-xml/ko/)
- [v0.x 마이그레이션](https://clickin.github.io/stax-xml/ko/guide/migration-v0/)은
  기존 애플리케이션 코드를 순수 JavaScript 1.0+ 리더/라이터 API로 옮기는 기준을
  정리합니다.
- [Web Server 연동](https://clickin.github.io/stax-xml/ko/guide/server-integration/)은
  Express, Fastify, Hono, Next.js, Bun, Deno, Edge 런타임에서 XML 요청 본문을
  스트리밍으로 처리하는 방법을 보여줍니다.
- [릴리스 준비](https://clickin.github.io/stax-xml/ko/resources/release-readiness/)는
  순수 JavaScript 패키징, 벤치마크, 문서, 병합 체크리스트를 기록합니다.

### Runtime Matrix

벤치마크 스크립트는 `packages/benchmark` 아래에 있습니다. 런타임 간 성능 비교는
다음 명령어로 실행합니다.

```bash
pnpm --dir packages/benchmark bench:runtime-matrix
```

로컬에 설치된 Node, Bun 환경에서 동일한 JavaScript 리더 워크로드 성능을
비교합니다.

## License

MIT
