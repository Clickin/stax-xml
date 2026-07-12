---
title: StreamReader - 비동기 current-token XML 파싱
description: JavaScript와 TypeScript용 저할당 비동기 XML stream reader
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/stream-reader.png
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
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/stream-reader.png
slug: ko/v1.0.0/api-guides/stream-reader
---

## StreamReader

`StreamReader`는 event object를 매 token마다 할당하지 않는 저할당 비동기 XML
reader입니다. `ReadableStream<Uint8Array>` 또는 `AsyncIterable<Uint8Array>`를
받고 current token을 accessor로 노출합니다.

```ts
import { StreamReader, XmlEventType } from 'stax-xml';

const reader = new StreamReader(response.body!);
try {
  while (await reader.next() !== null) {
    if (reader.eventType() === XmlEventType.START_ELEMENT) {
      console.log(reader.name(), reader.attributeValue('id'));
    } else if (reader.eventType() === XmlEventType.CHARACTERS) {
      console.log(reader.text());
    }
  }
} finally {
  await reader.close();
}
```

성능과 allocation rate가 stable event object 보존보다 중요할 때 사용하세요.
Accessor는 current token만 설명하므로 다음 `next()` 호출 전에 읽어야 합니다.

## 입력과 옵션

```ts
type StreamReaderSource =
  | ReadableStream<Uint8Array>
  | AsyncIterable<Uint8Array>;

interface StreamReaderOptions {
  documentMode?: 'document' | 'fragment';
}
```

Byte input은 fatal UTF-8로 incremental decoding합니다. Invalid UTF-8, malformed
XML, unsupported named entity는 `next()`를 reject합니다. XML 기본 entity 5개와
numeric character reference만 인식하며 custom/external entity는 resolve하지
않고 외부 I/O도 수행하지 않습니다.

## Current-token accessor

reader는 `START_DOCUMENT`로 시작하고 `END_DOCUMENT`로 끝납니다.

```ts
reader.eventType();
reader.name();
reader.text();
reader.localName();
reader.prefix();
reader.namespaceURI();
reader.attributeCount();
reader.attributeName(index);
reader.attributeLocalName(index);
reader.attributePrefix(index);
reader.attributeNamespaceURI(index);
reader.attributeValue(indexOrName);
reader.attributeValue(namespaceURI, localName);
reader.namespaceURIForPrefix(prefix);
```

`attributeValue()`는 index, qualified name, 또는 `(namespaceURI, localName)` 쌍을
받습니다. 없는 attribute는 `undefined`를 반환합니다.

## Lifecycle과 동시성

중간에 중단할 때는 `await reader.close()`를 호출하세요. close는 idempotent이며
underlying async iterator를 닫거나 `ReadableStream`을 cancel합니다. source error도
reader를 닫은 뒤 원래 error를 다시 throw합니다. Concurrent `next()` 호출은
reject되므로 이전 호출을 await한 뒤 진행해야 합니다.

stable event object가 필요하면 [`EventReader`](/stax-xml/ko/api-guides/event-reader)를,
완성된 JavaScript string을 동기 처리하려면
[`StreamReaderSync`](/stax-xml/ko/api-guides/stream-reader-sync)를 사용하세요.
