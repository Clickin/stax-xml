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

## Public API diff

아래 표는 v0.7 public surface와 1.0 대체 API를 symbol 단위로 비교합니다.
Stable event object가 필요한지, 재사용되는 current-token view면 충분한지에 따라
reader를 선택하세요.

| v0.x API | 1.0 대체 API | 계약 변경 |
| --- | --- | --- |
| `StaxXmlParserSync` | `EventReaderSync` | 동기 iterable은 유지되며 start-element attribute는 record 대신 읽기 전용 Map입니다. |
| `StaxXmlParserSync` | `StreamReaderSync` | Stable event object가 필요 없을 때 선택합니다. `next()` 후 getter로 current token을 읽습니다. |
| `StaxXmlParser` | `EventReader` 또는 `StreamReader` | `ReadableStream<Uint8Array>`와 `AsyncIterable<Uint8Array>`를 받으며 concurrent `next()`는 거부합니다. |
| `StaxXmlCursorReader` | `StreamReaderSync` | `next()`가 `boolean` 대신 `XmlEventType` 또는 `null`을 반환하고 getter의 `get` prefix가 사라집니다. |
| `StaxXmlCursorReaderAsync` | `StreamReader` | 동기 reader와 같은 token/getter 계약을 사용합니다. |
| `StaxXmlWriterSync` / default export | `WriterSync` | Named import를 사용하세요. Package default export는 없습니다. |
| `StaxXmlWriterSyncSink` | `WriterSyncSink` | 계속 caller가 `SyncTextSink`를 제공합니다. |
| `StaxXmlWriter` | `Writer` | `WritableStream<Uint8Array>` 또는 `AsyncTextSink`를 제공합니다. |
| `XmlEventType.ERROR`, `ErrorEvent`, `isError` | 대체 event 없음 | Parse/decode 실패는 동기 reader에서 throw되고 비동기 read를 reject합니다. |
| `attributes: Record<string, string>` / `attributesWithPrefix` | `attributes: EventAttributes` | qualified name을 key로 쓰는 읽기 전용 Map이며 각 value가 `name`, `localName`, `prefix`, `namespaceURI`, `value`를 가집니다. |
| Element `uri` | `namespaceURI` | Prefix와 namespace URI가 없을 때는 빈 string을 사용합니다. |
| `stax-xml/cursor` / platform adapter subpath | Root reader/writer export | Export되는 package path는 `stax-xml`과 `stax-xml/converter`뿐입니다. |

Cursor를 옮길 때는 `getAttributeCount()`를 `attributeCount()`로,
`getAttributeName()`을 `attributeName()`으로, `getAttributeLocalName()`을
`attributeLocalName()`으로, `getAttributePrefix()`를 `attributePrefix()`로,
`getAttributeValue()`를 `attributeValue()`로, `uri()`를 `namespaceURI()`로
바꾸세요. 1.0 reader는 `attributeNamespaceURI()`와
`attributeValue(namespaceURI, localName)` namespace-aware lookup도 제공합니다.

## Parser option diff

1.0 reader는 더 엄격하지만 v0 entity policy option은 유지합니다. Queue 구현
세부사항을 노출하던 option은 제거됐습니다.

| v0.x parser option | 1.0 동작 또는 대체 방법 |
| --- | --- |
| `autoDecodeEntities` | 유지, 기본값 `true`. 활성화하면 predefined entity 5개, 10진수/16진수 numeric reference, configured custom entity를 text와 attribute에서 single-pass decode합니다. `false`면 원본 reference 표기를 반환합니다. CDATA는 두 mode 모두 literal입니다. |
| `addEntities` | DTD processing을 원하지 않는 application이 trusted internal entity vocabulary를 제공할 수 있도록 유지됩니다. Text와 attribute에 적용되며 unknown entity는 계속 거부됩니다. 같은 이름의 writer option은 별도 계약입니다. |
| `eventFilter` | 제거. `EventReader` event를 consumer에서 filter하거나 `StreamReader`를 사용해 필요 없는 token field를 읽지 마세요. |
| `maxBufferSize`, `enableBufferCompaction`, `initialQueueCapacity` | 제거. Buffering, queueing, compaction은 internal 구현 세부사항입니다. |
| `encoding` | Byte input에 유지. Host `TextDecoder`에 전달되며 malformed input은 fatal입니다. JavaScript string은 이미 decode된 input입니다. |
| v0 대응 없음 | `documentMode: 'fragment' | 'document'`는 single-root validation을 제어하고, `namespaceAware: false`는 namespace resolution을 끄는 option입니다. |

`autoDecodeEntities: false`는 lexical-value mode입니다. Character/attribute value의
reference 표기는 보존하지만 unterminated, unknown, invalid numeric reference는 계속
거부합니다. Namespace processing의 정확성을 위해 namespace binding은 internal decode합니다.
`addEntities`는 document DTD를 해석하거나 external I/O를 하지 않고 DTD-like application
definition을 제공합니다. Predefined entity 5개를 override할 수 없고 recursive expansion을
하지 않으며 value는 유효한 XML character로 구성되어야 합니다.

다음 예제가 entity 계약을 모두 보여줍니다.

```ts
import { EventReaderSync, XmlEventType } from 'stax-xml';

const xml = '<mi title="&theta;">&#x398;&amp;#x398;<![CDATA[&theta;]]></mi>';
const addEntities = [{ entity: 'theta', value: 'Θ' }];

for (const event of new EventReaderSync(xml, { addEntities })) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log(event.attributes.get('title')?.value);
    // Θ
  }
  if (event.type === XmlEventType.CHARACTERS) console.log(event.value);
  // Θ&#x398; -- &amp;는 &로 변하지만 결과 text를 다시 decode하지 않음
  if (event.type === XmlEventType.CDATA) console.log(event.value);
  // &theta;
}

// autoDecodeEntities: false이면 text는 "&#x398;&amp;#x398;",
// title attribute는 "&theta;"로 반환됩니다.
```

## Event와 attribute diff

가장 자주 필요한 TypeScript 변경은 attribute access입니다.

```ts
// v0.x
for (const event of new StaxXmlParserSync(xml, {
  autoDecodeEntities: true,
  eventFilter: {
    includeAttributes: true,
    includeCharacters: true,
    includeCdata: false,
  },
})) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log(event.uri, event.attributes.title);
  }
}

// 1.0
for (const event of new EventReaderSync(xml)) {
  if (event.type === XmlEventType.CDATA) continue;
  if (event.type === XmlEventType.START_ELEMENT) {
    const title = event.attributes.get('title')?.value;
    console.log(event.namespaceURI, title);
  }
}
```

Materialized event는 qualified name을 O(1)로 조회하고, 순회할 때 source 순서를
유지하며, attribute를 JSON object로 직렬화합니다. `__proto__`, `constructor` 같은
JavaScript 예약 key도 일반 Map key로 안전하게 처리합니다. allocation을 최소화하려면
current-token API를 사용하세요.

```ts
const reader = new StreamReaderSync(xml);
while (reader.next() !== null) {
  if (reader.eventType() === XmlEventType.START_ELEMENT) {
    console.log(reader.namespaceURI(), reader.attributeValue('title'));
  }
}
```

`EventReaderSync`/`EventReader`가 반환하는 stable object는 보관해도 됩니다.
`StreamReaderSync`/`StreamReader`는 current token만 노출하므로 다음 `next()`를
호출하기 전에 getter value를 소비하세요.

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
