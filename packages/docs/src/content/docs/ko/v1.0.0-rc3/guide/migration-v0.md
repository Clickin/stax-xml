---
title: v0.x에서 마이그레이션
description: 기존 StAX-XML 애플리케이션을 pure JavaScript 1.0 API surface로 옮기는 방법.
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/ko/guide/migration-v0.png
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
      content: https://clickin.github.io/stax-xml/og/ko/guide/migration-v0.png
slug: ko/v1.0.0-rc3/guide/migration-v0
---

StAX-XML 1.0은 pure JavaScript package를 중심으로 정리되어 있습니다. 설치는
단순합니다.

```bash
npm install stax-xml
```

Platform별 `@stax-xml/native-*` package를 설치하거나, Wasm parser module을
복사하거나, runtime backend option을 선택할 필요가 없습니다.

## 마이그레이션 체크리스트

- 애플리케이션에서 `@stax-xml/native-*` 또는 실험용 native parser package를 직접
  의존하고 있었다면 제거하세요.
- ESM import를 사용하세요: `import { EventReaderSync } from 'stax-xml'`.
- 이미 메모리에 있는 XML string은 `EventReaderSync`를 사용하세요.
- `ReadableStream<Uint8Array>` 입력은 `EventReader`를 사용하세요.
- 큰 byte input에서 event object 할당을 줄여야 하면 `StreamReaderSync` 또는
  `StreamReader`를 사용하세요.
- Schema가 고정된 projection에는 converter schema를 유지하고, 같은 schema를 자주
  재사용하면 `.compile()`을 사용하세요.
- 실험적 cursor 또는 iterable facade API를 사용했다면 아래 stream/event reader
  API로 바꾸세요.
- [벤치마크](/stax-xml/ko/resources/benchmarks/) 페이지의 release benchmark
  command로 production 크기의 XML workload를 다시 측정하세요.

## Reader 매핑

| v0.x 사용 방식 | 1.0 경로 | 비고 |
| --- | --- | --- |
| 인메모리 string event parsing | `EventReaderSync` | 읽기 쉬운 event object 모델을 유지합니다. |
| 비동기 stream parsing | `EventReader` | `ReadableStream<Uint8Array>`를 받아 byte batch를 순차적으로 drain합니다. |
| 실험적 cursor/facade API | `StreamReaderSync` 또는 `StreamReader` | `StreamBatch`를 `eventCount`와 index accessor로 소비하세요. |
| Unknown XML을 object/tree로 변환 | `parseXmlObject*()` 또는 `parseXmlTree*()` | Mixed content나 순서가 중요하면 tree mode를 사용하세요. |
| 선언적 필드 추출 | `stax-xml/converter` | Schema는 애플리케이션 boundary 가까이에 두세요. |
| 큰 XML incremental output | `WriterSyncSink` 또는 `Writer` | 전체 XML string을 보관하지 않는 출력 경로입니다. |

## CommonJS 프로젝트

Package는 ESM-only입니다. CommonJS 애플리케이션에서는 XML parsing module을 ESM으로
옮기거나 dynamic import를 사용하세요.

```js
async function parse(xml) {
  const { EventReaderSync, XmlEventType } = await import('stax-xml');
  let count = 0;

  for (const event of new EventReaderSync(xml)) {
    if (event.type === XmlEventType.START_ELEMENT) {
      count++;
    }
  }

  return count;
}
```

## 큰 파일

큰 XML에서는 `readFileSync(path, 'utf8')`, `request.text()`,
`response.text()`를 먼저 호출하지 마세요. 이런 API는 parsing 시작 전에 문서 전체를
하나의 JavaScript string으로 만듭니다.

Node.js 파일은 web stream으로 바꿔 `EventReader`에 전달하세요.

```ts
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { EventReader, XmlEventType } from 'stax-xml';

export async function countElements(path: string) {
  const stream = Readable.toWeb(createReadStream(path, {
    highWaterMark: 1024 * 1024,
  })) as ReadableStream<Uint8Array>;
  const reader = new EventReader(stream);
  let count = 0;

  for await (const event of reader) {
    if (event.type === XmlEventType.START_ELEMENT) {
      count++;
    }
  }

  return count;
}
```

이미 byte batch를 가지고 있다면 `StreamReaderSync`로 event wrapper 할당을 줄일 수
있습니다.

```ts
import { StreamEventType, StreamReaderSync } from 'stax-xml';

export function countFromBatches(batches: Iterable<Uint8Array[]>) {
  let count = 0;

  for (const batch of new StreamReaderSync(batches)) {
    for (let index = 0; index < batch.eventCount; index++) {
      if (batch.typeAt(index) === StreamEventType.START_ELEMENT) {
        count++;
      }
    }
  }

  return count;
}
```

## Converter 마이그레이션

XML shape가 고정되어 있고 수동 event handling보다 typed projection이 중요하면
converter schema가 맞는 surface입니다. Hot path에서는 schema를 한 번 compile하세요.

```ts
import { x } from 'stax-xml/converter';

const feedSchema = x.object({
  title: x.string('/rss/channel/title'),
  items: x.array(
    x.object({
      title: x.string('./title'),
      link: x.string('./link'),
    }),
    '/rss/channel/item',
  ),
});

const feedParser = feedSchema.compile();
const feed = feedParser.parseSync(xmlBytes);
```

## 검증

마이그레이션 후에는 같은 production 형태의 XML을 이전 코드와 새 코드에 모두
흘려보내고, event count만이 아니라 domain output을 비교하세요. 큰 파일은 throughput
뿐 아니라 RSS 또는 heap delta를 같이 기록해 전체 문서 buffering이 다시 들어오지
않았는지 확인하세요.
