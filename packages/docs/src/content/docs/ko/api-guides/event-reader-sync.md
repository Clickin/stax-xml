---
title: EventReaderSync - 동기식 XML 파싱
description: JavaScript/TypeScript용 고성능 동기식 XML 파서
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/event-reader-sync.png
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
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/event-reader-sync.png
---

## EventReaderSync

`EventReaderSync`는 동기 stable-event API입니다. JavaScript string, 하나의
`Uint8Array`, 또는 `Iterable<Uint8Array>`를 받습니다.

```ts
import { EventReaderSync, XmlEventType } from 'stax-xml';

const xml = '<catalog><book id="b1">StAX</book></catalog>';

for (const event of new EventReaderSync(xml)) {
  if (event.type === XmlEventType.START_ELEMENT) {
    const id = event.attributes.find((attribute) => attribute.name === 'id')?.value;
    console.log(event.name, id);
  }
}
```

String input은 JavaScript string 상태로 직접 읽으며 먼저 `Uint8Array`로 encoding하지
않습니다. Byte input은 fatal UTF-8로 incremental decoding합니다.

## 입력

```ts
type StreamReaderSyncInput =
  | string
  | Uint8Array
  | Iterable<Uint8Array>;

interface EventReaderSyncOptions {
  documentMode?: 'document' | 'fragment';
  namespaceAware?: boolean; // 기본값: true
}
```

첫 event는 `START_DOCUMENT`, 마지막 event는 `END_DOCUMENT`입니다.
`Iterable<AnyXmlEvent>`와 `Iterator<AnyXmlEvent>`를 모두 구현합니다. `for...of`를
중단하면 `return()`이 input iterator를 반환합니다. Manual loop를 일찍 끝낼 때는
`reader.return()`을 호출하세요.

반환된 event와 attribute는 reader가 진행된 뒤에도 안정적입니다.

## Current-Token 대안

Stable event object 할당을 피하려면 `StreamReaderSync`를 사용합니다.

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

Accessor에는 `eventType()`, `name()`, `text()`, `localName()`, `prefix()`,
`namespaceURI()`, indexed attribute metadata, `attributeValue(indexOrName)`,
`attributeValue(namespaceURI, localName)`,
`namespaceURIForPrefix()`가 있습니다. 모두 현재 token만 설명합니다.

## Event Shape와 Error

`AnyXmlEvent`는 document, start/end element, characters, CDATA, comment,
processing-instruction, DTD event를 포함합니다. Start-element attribute는
`EventAttribute[]`이며 namespace declaration은 attribute에 포함되지 않습니다.

Malformed XML, 지원하지 않는 named entity reference, invalid UTF-8은 error를
throw합니다. DTD declaration은 event로 노출하지만 해석하지 않습니다. XML
predefined entity 5개와 numeric character reference만 decoding하며,
custom/external entity를 resolve하거나 외부 I/O를 수행하지 않습니다.
TypeScript narrowing에는 `isStartElement()`, `isCharacters()` 같은 type guard를
사용하세요.
