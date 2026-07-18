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
slug: ko/v1.0.0/api-guides/event-reader
---

## EventReader

`EventReader`는 비동기 stable-event API입니다.
`ReadableStream<Uint8Array>` 또는 `AsyncIterable<Uint8Array>`에서 byte를
받으며, buffered event가 없을 때 consumer 요청에 맞춰 다음 input chunk를 읽습니다.

```ts
import { EventReader, XmlEventType } from 'stax-xml';

for await (const event of new EventReader(response.body!)) {
  if (event.type === XmlEventType.START_ELEMENT) {
    const id = event.attributes.find((attribute) => attribute.name === 'id')?.value;
    console.log(event.name, id);
  } else if (event.type === XmlEventType.CHARACTERS) {
    console.log(event.value);
  }
}
```

반환한 event와 attribute는 안정적인 JavaScript object이며 reader가 진행되어도
이전 값을 변경하지 않습니다.

## 입력

```ts
type StreamReaderSource =
  | ReadableStream<Uint8Array>
  | AsyncIterable<Uint8Array>;

interface EventReaderOptions {
  documentMode?: 'document' | 'fragment';
  namespaceAware?: boolean; // 기본값: true
  encoding?: string; // 기본값: 'utf-8'
}
```

Byte input은 fatal `TextDecoder`로 incremental decoding합니다. `encoding`은 `utf-8`이
기본이며 host decoder가 지원하는 label을 받을 수 있습니다. XML declaration에서 label을
자동 추론하지 않습니다. Invalid byte sequence 또는
malformed XML은 `next()`를 reject하고 source를 반환합니다. DTD declaration을 해석하거나
custom/external entity를 resolve하지 않고, 외부 I/O를 수행하지 않습니다.
XML predefined entity 5개와 numeric character reference만 decoding합니다.

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
`EventAttribute[]`이며 namespace declaration은 attribute에 포함되지 않습니다.
TypeScript narrowing에는 `isStartElement()`, `isCharacters()` 같은 type guard를
사용하세요.

Async string input은 제공하지 않습니다. 완성된 JavaScript string이 있다면 string을
직접 읽는 `EventReaderSync` 또는 `StreamReaderSync`를 사용하세요.
