---
title: StreamReaderSync - 동기 current-token XML 파싱
description: JavaScript와 TypeScript용 저할당 동기 XML stream reader
slug: ko/v1.0.0/api-guides/stream-reader-sync
---

`StreamReaderSync`는 string, `Uint8Array`, `Iterable<Uint8Array>`용 동기
current-token reader입니다.

```ts
import { StreamReaderSync, XmlEventType } from 'stax-xml';

const reader = new StreamReaderSync(xml);
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

String은 직접 scan하고 byte input은 fatal incremental UTF-8 decoding을 사용합니다.
XML 기본 entity 5개와 numeric character reference만 인식하며 custom/external
entity는 resolve하지 않습니다.

`eventType()`, `name()`, `text()`, `localName()`, `prefix()`, `namespaceURI()`,
attribute metadata, `attributeValue()`, `namespaceURIForPrefix()`가 current token을
설명합니다. 중단할 때 `reader.close()`를 호출하세요.
