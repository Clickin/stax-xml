---
title: StreamReader - 비동기 current-token XML 파싱
description: JavaScript와 TypeScript용 저할당 비동기 XML stream reader
slug: ko/v1.0.0/api-guides/stream-reader
---

`StreamReader`는 `ReadableStream<Uint8Array>` 또는
`AsyncIterable<Uint8Array>`를 처리하는 저할당 비동기 reader입니다. `next()`는
현재 `XmlEventType`을 반환하며, 다음 `next()` 전에 accessor로 token을 읽습니다.

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

```ts
interface StreamReaderOptions {
  documentMode?: 'document' | 'fragment';
}
```

UTF-8를 incremental decoding하며 XML 기본 entity 5개와 numeric character
reference만 인식합니다. Invalid UTF-8, malformed XML, unsupported named entity는
`next()`를 reject하고 custom/external entity는 resolve하지 않습니다.

Accessor는 `eventType()`, `name()`, `text()`, `localName()`, `prefix()`,
`namespaceURI()`, `attributeCount()`, `attributeName()`,
`attributeLocalName()`, `attributePrefix()`, `attributeNamespaceURI()`,
`attributeValue()`, `namespaceURIForPrefix()`를 제공합니다.
`attributeValue()`는 index, qualified name, 또는 `(namespaceURI, localName)` 쌍을
받습니다.

중단할 때는 `await reader.close()`를 호출하세요. close는 idempotent이며 underlying
iterator를 닫고 `ReadableStream`을 cancel합니다. Concurrent `next()` 호출은
reject됩니다. stable event object가 필요하면
[`EventReader`](/stax-xml/ko/api-guides/event-reader)를 사용하세요.
