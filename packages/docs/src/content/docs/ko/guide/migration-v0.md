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
---

StAX-XML 1.0은 실험적 reader matrix를 하나의 pure JavaScript token core와 네
public reader 역할로 교체합니다. `stax-xml`만 설치하면 되며 native, Wasm,
runtime adapter, backend selection package는 없습니다.

## 마이그레이션 표

| v0.x 요구사항 | 1.0 surface |
| --- | --- |
| XML string을 안정적인 event로 parsing | `EventReaderSync` |
| String 또는 동기 byte source에서 current token pull | `StreamReaderSync` |
| 비동기 byte source에서 안정적인 event iteration | `EventReader` |
| 비동기 byte source에서 current token pull | `StreamReader` |
| 알려진 XML을 typed object로 projection | `stax-xml/converter` |
| 메모리에서 XML string 생성 | `WriterSync` |
| Incremental writing | `WriterSyncSink` 또는 `Writer` |

실험적 cursor, batch, adapter, tree/object helper, native, backend API import는
제거하세요. Package entry point는 `stax-xml`과 `stax-xml/converter` 두 개뿐이며
root default export는 없습니다.

## 메모리의 String

동기 reader는 string을 직접 받으며 먼저 `Uint8Array`로 encoding하지 않습니다.

```ts
import { EventReaderSync, XmlEventType } from 'stax-xml';

for (const event of new EventReaderSync('<root><item/></root>')) {
  if (event.type === XmlEventType.START_ELEMENT) console.log(event.name);
}
```

Event object 할당을 줄이는 것이 중요하면 `StreamReaderSync`를 사용합니다.

```ts
import { StreamReaderSync, XmlEventType } from 'stax-xml';

const reader = new StreamReaderSync('<root><item id="1"/></root>');
while (reader.next() !== null) {
  if (reader.eventType() === XmlEventType.START_ELEMENT) {
    console.log(reader.name(), reader.attributeValue('id'));
  }
}
```

같은 reader는 `Uint8Array` 또는 `Iterable<Uint8Array>`도 받습니다.

Byte reader의 `encoding` option에는 host `TextDecoder`가 지원하는 label을 지정할 수
있습니다. 기본값은 `utf-8`이며 decode 오류는 즉시 throw됩니다. `documentMode`의
기본값은 `fragment`이고, root element가 정확히 하나여야 한다면 `document`를
선택합니다. Namespace 처리는 기본 활성화되며 raw qualified name만 필요하면
`namespaceAware: false`로 끌 수 있습니다. Parser와 writer의 계약은 XML 1.0이므로
XML 1.1 declaration은 거부됩니다.

## Node.js Stream

비동기 reader는 web `ReadableStream<Uint8Array>` 또는
`AsyncIterable<Uint8Array>`를 받습니다. Node.js `Readable`의 `Buffer` chunk는
`Uint8Array`이므로 stream을 직접 전달할 수 있습니다.

```ts
import { createReadStream } from 'node:fs';
import { EventReader, XmlEventType } from 'stax-xml';

export async function countElements(path: string) {
  let count = 0;
  for await (const event of new EventReader(createReadStream(path))) {
    if (event.type === XmlEventType.START_ELEMENT) count++;
  }
  return count;
}
```

`for await`를 일찍 끝내면 event reader가 source를 반환합니다. Manual pull loop를
일찍 끝낼 때는 `StreamReader.close()`를 호출하세요.

## Converter

Schema는 compiled dispatch plan을 자동으로 재사용하므로 public `.compile()` 단계가
없습니다.

```ts
import { x } from 'stax-xml/converter';

const feed = x.object({
  title: x.string('/rss/channel/title'),
  items: x.array(x.string('./title'), '/rss/channel/item'),
});

const value = feed.parseSync(xmlString);
```

Converter는 streaming 방식이며 DOM parser를 도입하지 않습니다. XML shape를 미리
알 수 없다면 네 reader API를 사용하세요.

## CommonJS

Package는 ESM-only입니다. CommonJS에서는 dynamic import를 사용할 수 있습니다.

```js
import('stax-xml').then(({ EventReaderSync }) => {
  for (const event of new EventReaderSync('<root/>')) console.log(event.type);
});
```
