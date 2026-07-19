---
title: StaxXmlCursorReader - 제로 할당 XML Cursor
description: 고처리량 XML 파싱을 위한 뮤터블 cursor 기반 순회
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/staxxmlcursorreader.png
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
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/staxxmlcursorreader.png
slug: ko/v0.7.0/api-guides/staxxmlcursorreader
---

## StaxXmlCursorReader - 제로 할당 XML Cursor

`StaxXmlCursorReader`는 XML을 순차적으로 훑는 hot path에서 최대 처리량을 얻기 위한 저수준 cursor API입니다. 노드마다 이벤트 객체를 새로 만들지 않고 하나의 뮤터블 cursor를 재사용하므로, accessor는 현재 cursor 위치를 읽는 메서드 형태입니다.

XML 이벤트를 최소 할당으로 검사, 필터링, 집계하려면 cursor API를 사용하세요. 이벤트 객체, async iteration 편의성, 선언적 객체 매핑이 필요하면 `StaxXmlParser`나 Converter API가 더 적합합니다.

### 빠른 시작

```typescript
import { CursorEventType, StaxXmlCursorReader } from 'stax-xml/cursor';

const cursor = new StaxXmlCursorReader('<root><item id="1">안녕</item></root>');

while (cursor.next()) {
  switch (cursor.eventType()) {
    case CursorEventType.START_ELEMENT:
      console.log(cursor.name());
      console.log(cursor.getAttributeValue('id'));
      break;
    case CursorEventType.CHARACTERS:
      console.log(cursor.text());
      break;
  }
}
```

### Async Streams

`StaxXmlCursorReaderAsync`는 web standard `ReadableStream<Uint8Array>`를 받고 같은 accessor 형태를 유지합니다.

```typescript
import { CursorEventType, StaxXmlCursorReaderAsync } from 'stax-xml/cursor';

const response = await fetch('/large.xml');
const cursor = new StaxXmlCursorReaderAsync(response.body!);

while (await cursor.next()) {
  if (cursor.eventType() === CursorEventType.START_ELEMENT) {
    console.log(cursor.localName());
  }
}

await cursor.close();
```

### Accessors

| Method | Description |
| --- | --- |
| `next()` | 다음 이벤트로 이동합니다. `END_DOCUMENT` 이후에는 `false`를 반환합니다. |
| `eventType()` | 현재 이벤트의 `CursorEventType` 숫자 상수를 반환합니다. |
| `name()` | start/end element 이벤트의 qualified element name을 반환합니다. |
| `localName()` | prefix를 제외한 local element 또는 attribute name을 반환합니다. |
| `prefix()` | namespace prefix가 있으면 반환합니다. |
| `uri()` | namespace tracking이 활성화된 경우 현재 element의 namespace URI를 반환합니다. |
| `text()` | text 이벤트의 character 또는 CDATA 값을 반환합니다. |
| `depth()` | 현재 element stack depth를 반환합니다. |
| `getAttributeCount()` | 현재 start element의 attribute 개수를 반환합니다. |
| `getAttributeName(index)` | index 기준 attribute qualified name을 반환합니다. |
| `getAttributeValue(indexOrName)` | index 또는 qualified name 기준 attribute 값을 반환합니다. |
| `getAttributeLocalName(index)` | index 기준 attribute local name을 반환합니다. |
| `getAttributePrefix(index)` | index 기준 attribute prefix를 반환합니다. |
| `getAttributeUri(index)` | namespace tracking이 활성화된 경우 index 기준 attribute namespace URI를 반환합니다. |

### Options

```typescript
const cursor = new StaxXmlCursorReader(xml, {
  autoDecodeEntities: true,
  addEntities: [{ entity: '&copy;', value: '©' }]
});

const asyncCursor = new StaxXmlCursorReaderAsync(stream, {
  encoding: 'utf-8',
  autoDecodeEntities: true
});
```

`autoDecodeEntities`의 기본값은 `true`입니다. async reader의 기본 encoding은 `utf-8`입니다.
