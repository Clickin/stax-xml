---
title: StreamReaderSync - 동기 current-token XML 파싱
description: JavaScript와 TypeScript용 저할당 동기 XML stream reader
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/stream-reader-sync.png
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
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/stream-reader-sync.png
slug: ko/v1.0.0/api-guides/stream-reader-sync
---

## StreamReaderSync

`StreamReaderSync`는 string, `Uint8Array`, 또는 `Iterable<Uint8Array>`를 받는
동기 current-token reader입니다.

```ts
import { StreamReaderSync, XmlEventType } from 'stax-xml';

const reader = new StreamReaderSync('<catalog><book id="b1">StAX</book></catalog>');
try {
  while (reader.next() !== null) {
    if (reader.eventType() === XmlEventType.START_ELEMENT) {
      console.log(reader.name(), reader.attributeValue('id'));
    }
  }
} finally {
  reader.close();
}
```

String input은 byte로 encoding하지 않고 직접 scan합니다. Byte input은 fatal
UTF-8로 incremental decoding합니다.

```ts
interface StreamReaderSyncOptions {
  documentMode?: 'document' | 'fragment';
  namespaceAware?: boolean; // 기본값: true
}
```

`namespaceAware`의 기본값은 `true`입니다. raw qualified name만 필요하면 `false`로 설정하세요. namespace URI는 `''`가 되고, `xmlns` 선언은 일반 attribute로 노출되며, 선언되지 않은 prefix도 거부하지 않습니다.

`eventType()`, `name()`, `text()`, `localName()`, `prefix()`, `namespaceURI()`,
attribute metadata, `attributeValue()`, `namespaceURIForPrefix()`를 제공합니다.
Accessor는 current token만 설명합니다. XML 기본 entity 5개와 numeric character
reference만 decode하며 custom/external entity는 resolve하지 않습니다.

중단할 때는 `reader.close()`를 호출하세요. close는 idempotent이며 underlying byte
iterator를 닫습니다. stable event object가 필요하면
[`EventReaderSync`](/stax-xml/ko/api-guides/event-reader-sync)를 사용하세요.
