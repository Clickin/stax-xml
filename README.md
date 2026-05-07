# StAX-XML

[English](#english) | [한국어](#korean)

---

## English

`stax-xml` is a performance-first, pull-based XML parser and writer for
JavaScript and TypeScript. It is intentionally pure JavaScript: the parser core,
stream readers, event readers, converter, and writer all run
without native addons, Wasm parser modules, or backend selection.

### Goals

- Keep memory usage low for large XML documents.
- Parse XML that is larger than JavaScript's practical single-string limit by
  consuming streams and byte batches.
- Provide a StAX-style pull API so applications do not need to keep deep SAX
  state machines in user code.
- Keep async work at I/O ingress boundaries. Once a byte batch has arrived,
  tokenization and event draining stay synchronous.
- Stay portable across Node, Bun, Deno, browsers, and edge runtimes.

### Why pure JavaScript?

We explored native and Wasm tokenizer acceleration first. Native code can scan
XML bytes very quickly, but `stax-xml` is not a raw tokenizer benchmark. Its
public contract is JavaScript consumption: callers read names, text, attributes,
events, and objects as JavaScript values.

That boundary changes the tradeoff. Native code can view JavaScript
`Buffer`/`ArrayBuffer` input without copying, but parsed results still have to
cross back into JavaScript as strings and objects. JavaScript strings are
immutable primitives, not reusable `char[]` views, and Wasm uses a separate
linear memory island. The bridge adds decode, allocation, wrapper, and ownership
costs, while native heap or Wasm memory also increases RSS.

For that reason, the native experiment was moved out of this package and
`stax-xml` is centered on byte-oriented pure JavaScript stream and event
readers.

### Install

```bash
npm install stax-xml
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

### Public Surfaces

- `EventReaderSync` / `EventReader`: ergonomic event readers.
- `StreamReaderSync` / `StreamReader`: batch-first pull readers for byte input.
- `parseXmlTree*()` / `parseXmlObject*()`: convenience helpers for unknown XML.
- `stax-xml/converter`: schema-driven XML-to-object parsing and XML writing.
- `Writer`, `WriterSync`, `WriterSyncSink`: XML output APIs, including a sync
  sink path for large output.

For projection-heavy workloads, `StreamReaderSync` is the lower-level
performance surface. The converter API is a schema wrapper for readability and
validation, and it may trade throughput for that abstraction.

### Release Guides

- [Migrating from v0.x](https://clickin.github.io/stax-xml/guide/migration-v0/)
  maps older application code to the pure JavaScript 1.0 reader and writer
  surfaces.
- [Web Server Integration](https://clickin.github.io/stax-xml/guide/server-integration/)
  shows how to keep XML request bodies streaming in Express, Fastify, Hono,
  Next.js, Bun, Deno, and edge runtimes.
- [Release Readiness](https://clickin.github.io/stax-xml/resources/release-readiness/)
  records the pure JavaScript packaging, benchmark, docs, and merge checklist.

### Runtime Matrix

Benchmark scripts live under `packages/benchmark`. The maintained runtime
comparison is:

```bash
pnpm --dir packages/benchmark bench:runtime-matrix
```

It compares the same JavaScript reader workload across Node, Bun, and Deno when
those runtimes are installed.

---

## Korean

`stax-xml`은 JavaScript와 TypeScript를 위한 성능 중심 pull 방식 XML parser 및
writer입니다. 이 패키지는 의도적으로 pure JavaScript로 유지됩니다. parser core,
stream reader, event reader, converter, writer 모두 native addon,
Wasm parser module, backend selection 없이 동작합니다.

### 목표

- 큰 XML 문서에서도 낮은 메모리 사용량을 유지합니다.
- JavaScript의 실질적인 단일 문자열 한계를 넘는 XML을 stream, byte batch,
  pull-style reader로 처리합니다.
- 애플리케이션 코드가 깊은 SAX state machine을 직접 유지하지 않아도 되도록
  StAX-style pull API를 제공합니다.
- async 작업은 I/O ingress boundary에만 둡니다. byte batch가 도착한 뒤의
  tokenization과 event drain은 동기 loop로 유지합니다.
- Node, Bun, Deno, browser, edge runtime에서 portable하게 동작합니다.

### 왜 pure JavaScript인가?

처음에는 native addon과 Wasm 기반 tokenizer acceleration을 실험했습니다. native
code는 XML byte scan 자체를 매우 빠르게 수행할 수 있습니다. 하지만 `stax-xml`의
public contract는 raw tokenizer가 아니라 JavaScript 소비 모델입니다. 사용자는
element name, text, attribute, event, object를 JavaScript 값으로 읽습니다.

이 경계가 tradeoff를 바꿉니다. native code가 JavaScript `Buffer`/`ArrayBuffer`
입력을 copy 없이 view로 읽는 것은 가능하지만, 파싱 결과는 결국 JavaScript string과
object로 넘어와야 합니다. JavaScript string은 재사용 가능한 mutable `char[]` view가
아닌 immutable primitive이고, Wasm은 별도의 linear memory island를 사용합니다. 이
bridge에는 decode, allocation, wrapper, ownership 비용이 생기며, native heap이나
Wasm memory는 RSS도 증가시킵니다.

그래서 native 실험은 이 패키지 밖으로 분리하고, `stax-xml`은 byte-oriented pure
JavaScript stream/event reader 중심으로 다시 정립했습니다.

### 설치

```bash
npm install stax-xml
```

`stax-xml`은 ESM-only package입니다.

```ts
import { EventReaderSync, XmlEventType } from 'stax-xml';

const reader = new EventReaderSync('<root><item id="1">hello</item></root>');

for (const event of reader) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log(event.name, event.attributes);
  }
}
```

### Public Surface

- `EventReaderSync` / `EventReader`: 사용하기 쉬운 event reader.
- `StreamReaderSync` / `StreamReader`: byte input을 위한 batch-first pull reader.
- `parseXmlTree*()` / `parseXmlObject*()`: unknown XML을 위한 convenience helper.
- `stax-xml/converter`: schema 기반 XML-to-object parsing 및 XML writing.
- `Writer`, `WriterSync`, `WriterSyncSink`: 큰 출력에 적합한 sync sink path를 포함한
  XML output API.

projection 중심 workload에서는 `StreamReaderSync`가 lower-level performance
surface입니다. converter API는 readability와 validation을 위한 schema wrapper라서
그 abstraction 비용만큼 throughput을 양보할 수 있습니다.

### 릴리스 가이드

- [v0.x 마이그레이션](https://clickin.github.io/stax-xml/ko/guide/migration-v0/)은
  기존 애플리케이션 코드를 pure JavaScript 1.0 reader/writer surface로 옮기는 기준을
  정리합니다.
- [Web Server 연동](https://clickin.github.io/stax-xml/ko/guide/server-integration/)은
  Express, Fastify, Hono, Next.js, Bun, Deno, edge runtime에서 XML request body를
  streaming으로 유지하는 방법을 보여줍니다.
- [릴리스 준비](https://clickin.github.io/stax-xml/ko/resources/release-readiness/)는
  pure JavaScript packaging, benchmark, docs, merge checklist를 기록합니다.

### Runtime Matrix

benchmark script는 `packages/benchmark` 아래에 있습니다. 유지되는 runtime 비교는
다음 명령입니다.

```bash
pnpm --dir packages/benchmark bench:runtime-matrix
```

설치된 runtime에 대해 같은 JavaScript reader workload를 Node, Bun, Deno에서
비교합니다.

## License

MIT
