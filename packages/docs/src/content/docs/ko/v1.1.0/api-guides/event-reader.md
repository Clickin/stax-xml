---
title: EventReader - 비동기 XML 파싱
description: JavaScript/TypeScript용 고성능 비동기 XML 파서
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/event-reader.png
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
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/event-reader.png
slug: ko/v1.1.0/api-guides/event-reader
---

## EventReader

`EventReader`는 비동기 stable-event API입니다.
`ReadableStream<Uint8Array>` 또는 `AsyncIterable<Uint8Array>`에서 byte를
받으며, buffered event가 없을 때 consumer 요청에 맞춰 다음 input chunk를 읽습니다.

```ts
import { EventReader, XmlEventType } from 'stax-xml';

for await (const event of new EventReader(response.body!)) {
  if (event.type === XmlEventType.START_ELEMENT) {
    const id = event.attributes.get('id')?.value;
    console.log(event.name, id);
  } else if (event.type === XmlEventType.CHARACTERS) {
    console.log(event.value);
  }
}
```

반환한 event와 attribute는 안정적인 JavaScript object이며 reader가 진행되어도
이전 값을 변경하지 않습니다.

v1.1부터 이 event를 `Writer.writeEvent()`에 직접 전달하고 중간에서 선택한
event만 교체할 수 있습니다. 동기/비동기 전체 예제는
[XML 변환 파이프라인](/stax-xml/ko/guide/event-pipelines/)을 참고하세요.

## 입력

```ts
type StreamReaderSource =
  | ReadableStream<Uint8Array>
  | AsyncIterable<Uint8Array>;

interface EventReaderOptions {
  documentMode?: 'document' | 'fragment';
  namespaceAware?: boolean; // 기본값: true
  autoDecodeEntities?: boolean; // 기본값: true
  addEntities?: { entity: string; value: string }[];
  encoding?: string; // 기본값: 'utf-8'
}
```

Byte input은 fatal `TextDecoder`로 incremental decoding합니다. `encoding`은 `utf-8`이
기본이며 host decoder가 지원하는 label을 받을 수 있습니다. XML declaration에서 label을
자동 추론하지 않습니다. Invalid byte sequence 또는
malformed XML은 `next()`를 reject하고 source를 반환합니다. DTD declaration을 해석하거나
external entity를 resolve하지 않고, 외부 I/O를 수행하지 않습니다.

`autoDecodeEntities` 기본값은 `true`이며 predefined, numeric, configured custom
entity를 single-pass decode합니다. `false`이면 validation을 유지하면서 반환하는
text와 attribute의 reference 표기를 보존합니다. CDATA는 항상 literal입니다.
`addEntities`는 DTD processing 없이 trusted internal definition을 제공하며 recursive
expansion이나 predefined entity override를 허용하지 않습니다.

Node.js `Readable`은 async iterable이고 `Buffer` chunk가 `Uint8Array`이므로 직접
전달할 수 있습니다.

```ts
import { createReadStream } from 'node:fs';
import { EventReader } from 'stax-xml';

const reader = new EventReader(createReadStream('large.xml'));
```

## Lifecycle

`EventReader`는 `AsyncIterable<AnyXmlEvent>`와 `AsyncIterator<AnyXmlEvent>`를
구현합니다. 첫 event는 `START_DOCUMENT`, 마지막 event는 `END_DOCUMENT`입니다.
`for await`를 중단하면 `return()`이 source를 cancel 또는 반환합니다. Manual
loop를 일찍 끝낼 때는 `await reader.return()`을 호출하세요. Concurrent `next()`는
reject됩니다.

첫 `next()`는 `START_DOCUMENT`를 반환하기 전에 input을 소비할 수 있습니다. 해당
event를 materialize하려면 BOM, XML declaration, DTD preamble을 먼저 확인해야 하므로
source error나 cancellation도 첫 호출에서 발생할 수 있습니다.

## Current-Token 대안

Event object 할당을 줄이는 것이 중요하면 같은 source를 받는 `StreamReader`를 사용합니다.
Attribute value는 index, qualified name, 또는 `(namespaceURI, localName)` 쌍으로
조회할 수 있습니다.

```ts
import { StreamReader, XmlEventType } from 'stax-xml';

const reader = new StreamReader(source);
try {
  while (await reader.next() !== null) {
    if (reader.eventType() === XmlEventType.START_ELEMENT) {
      console.log(reader.name(), reader.attributeValue('id'));
    }
  }
} finally {
  await reader.close();
}
```

Current-token accessor는 다음 성공한 `next()` 호출 전까지만 유효합니다.

## Event Shape

`AnyXmlEvent`는 document, start/end element, characters, CDATA, comment,
processing-instruction, DTD event를 포함합니다. Start-element attribute는
`EventAttributes`는 qualified name을 key로 사용하는 읽기 전용 Map입니다. value에는
`name`, `localName`, `prefix`, `namespaceURI`, `value`가 유지되고 source 순서대로
순회합니다. `JSON.stringify()` 결과는 `{}`가 아니라 JSON object입니다.
Namespace-aware mode에서는 namespace declaration도 XMLNS namespace의 attribute로
source 순서대로 포함되므로 `writeEvent()`가 qualified name의 binding을 재구성할 수
있습니다. Attribute가 없으면 `attributes`는 `undefined`입니다. Start-document
event에는 XML declaration metadata가, start-element event에는 `selfClosing`이
포함됩니다.
TypeScript narrowing에는 `isStartElement()`, `isCharacters()` 같은 type guard를
사용하세요.

Async string input은 제공하지 않습니다. 완성된 JavaScript string이 있다면 string을
직접 읽는 `EventReaderSync` 또는 `StreamReaderSync`를 사용하세요.
