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
slug: ko/v1.0.0/api-guides/event-reader-sync
---

## EventReaderSync

`EventReaderSync`는 동기 stable-event API입니다. JavaScript string, 하나의
`Uint8Array`, 또는 `Iterable<Uint8Array>`를 받습니다.

```ts
import { EventReaderSync, XmlEventType } from 'stax-xml';

const xml = '<catalog><book id="b1">StAX</book></catalog>';

for (const event of new EventReaderSync(xml)) {
  if (event.type === XmlEventType.START_ELEMENT) {
    const id = event.attributes.get('id')?.value;
    console.log(event.name, id);
  }
}
```

String input은 JavaScript string 상태로 직접 읽으며 먼저 `Uint8Array`로 encoding하지
않습니다. Byte input은 fatal `TextDecoder`로 incremental decoding합니다. `encoding`
기본값은 `utf-8`이며 host decoder가 지원하는 label을 지정할 수 있습니다. XML
declaration에서 label을 자동 추론하지 않습니다.

## 입력

```ts
type StreamReaderSyncInput =
  | string
  | Uint8Array
  | Iterable<Uint8Array>;

interface EventReaderSyncOptions {
  documentMode?: 'document' | 'fragment';
  namespaceAware?: boolean; // 기본값: true
  autoDecodeEntities?: boolean; // 기본값: true
  addEntities?: { entity: string; value: string }[];
  encoding?: string; // byte input 전용, 기본값: 'utf-8'
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
`EventAttributes`는 qualified name을 key로 사용하는 읽기 전용 Map입니다. value에는
`name`, `localName`, `prefix`, `namespaceURI`, `value`가 유지되고 source 순서대로
순회합니다. `JSON.stringify()` 결과는 `{}`가 아니라 JSON object입니다. namespace
declaration은 attribute에 포함되지 않습니다.

Malformed XML, 지원하지 않는 named entity reference, 선택한 encoding의 invalid byte sequence는 error를
throw합니다. DTD declaration은 event로 노출하지만 해석하지 않으며 external entity를
resolve하거나 외부 I/O를 수행하지 않습니다.

`autoDecodeEntities` 기본값은 `true`입니다. Predefined entity 5개, numeric
character reference, `addEntities`로 제공한 trusted custom definition을 single-pass
decode합니다. `false`로 설정하면 XML reference validation은 유지하면서 반환하는
text와 attribute의 reference 표기를 보존합니다. CDATA는 항상 literal입니다.
Custom definition은 recursive expansion을 하지 않고 predefined entity를 override할
수 없습니다.
TypeScript narrowing에는 `isStartElement()`, `isCharacters()` 같은 type guard를
사용하세요.
