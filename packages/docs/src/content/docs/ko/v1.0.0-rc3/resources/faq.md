---
title: StAX-XML FAQ - JavaScript XML Parser Questions & Answers
description: StAX-XML 사용법, runtime 지원, 성능, pure JavaScript parser 결정에 대한 FAQ.
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/ko/resources/faq.png
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
      content: https://clickin.github.io/stax-xml/og/ko/resources/faq.png
slug: ko/v1.0.0-rc3/resources/faq
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "StAX-XML은 무엇인가요?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "StAX-XML은 Node.js, Bun, Deno, browser, edge runtime에서 동작하는 pure JavaScript pull-style XML parser와 writer입니다."
      }
    },
    {
      "@type": "Question",
      "name": "어떤 reader를 사용해야 하나요?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Ergonomic XML event object가 필요하면 EventReader 또는 EventReaderSync를 사용하세요. Byte input 위의 저오버헤드 batch access가 필요하면 StreamReader 또는 StreamReaderSync를 사용하세요."
      }
    },
    {
      "@type": "Question",
      "name": "StAX-XML은 native addon이나 Wasm을 사용하나요?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "아니요. JavaScript string/object를 반환하는 과정에서 decode, allocation, wrapper 비용이 필요하고 native/Wasm memory가 RSS를 늘리기 때문에 native와 Wasm parser mode는 제거했습니다."
      }
    }
  ]
}
</script>

## 일반 질문

### StAX-XML은 무엇인가요?

StAX-XML은 JavaScript/TypeScript용 pure JavaScript pull-style XML parser와
writer입니다. Node.js, Bun, Deno, browser, edge runtime을 지원하며 native
addon, Wasm parser module, backend selection mode를 사용하지 않습니다.

### 어떤 reader부터 시작해야 하나요?

`ReadableStream<Uint8Array>` 입력에서 ergonomic event object가 필요하면
`EventReader`를 사용하세요.

인메모리 XML string에서 ergonomic event object가 필요하면 `EventReaderSync`를
사용하세요.

Byte input 위에서 더 낮은 overhead의 batch access가 필요하면 `StreamReader` 또는
`StreamReaderSync`를 사용하세요. 대용량 동기 byte input에서는 wrapper event
iteration보다 `eventCount`와 index accessor를 함께 쓰는 방식을 권장합니다.

```ts
import { StreamEventType, StreamReaderSync } from 'stax-xml';

const reader = new StreamReaderSync(byteBatches);

for (const batch of reader) {
  for (let index = 0; index < batch.eventCount; index++) {
    if (batch.typeAt(index) === StreamEventType.START_ELEMENT) {
      console.log(batch.nameAt(index));
    }
  }
}
```

### 왜 native 또는 Wasm backend mode가 없나요?

Native와 Wasm tokenizer 실험에서 byte scanning 자체는 JavaScript 밖에서 더
빨라질 수 있었습니다. 하지만 public API는 결국 JavaScript string, attribute,
event object를 반환해야 합니다. JavaScript string은 immutable primitive라서
파싱된 `char[]`식 데이터를 재사용 가능한 view로 넘길 수 없습니다.

이 boundary에는 decode, allocation, wrapper, ownership 비용이 들어갑니다.
Native heap이나 Wasm linear memory도 RSS를 증가시킵니다. StAX-XML의 목표는 낮은
메모리, 대용량 XML, pull 방식 JavaScript 소비이므로, JS boundary에서 이점을 많이
잃는 native scanner보다 portable pure JavaScript parser에 집중합니다.

### Unknown XML은 어떻게 파싱하나요?

고정 schema가 없을 때는 tree/object helper를 사용하세요.

```ts
import { parseXmlObjectSync, parseXmlTreeSync } from 'stax-xml';

const tree = parseXmlTreeSync(xml);
const object = parseXmlObjectSync(xml);
```

element 순서와 mixed content가 중요하면 `parseXmlTreeSync()`를 사용하세요.
attribute를 `@name` key로 담는 compact object가 필요하면 `parseXmlObjectSync()`를
사용하세요.

### 대용량 파일은 어떻게 처리하나요?

I/O boundary는 streaming으로 유지하고, 도착한 byte batch는 동기적으로
파싱하세요. Ergonomic async surface는 `EventReader`입니다. 호출자가 이미 byte를
batching할 수 있다면 `Iterable<Uint8Array[]>` 위의 `StreamReaderSync`가 더 낮은
overhead의 sync batch surface입니다.

### XML은 어떻게 작성하나요?

`WritableStream<Uint8Array>`에는 `Writer`, 인메모리 string 출력에는 `WriterSync`,
전체 XML string을 보관하지 않는 동기 incremental 출력에는 `WriterSyncSink`를
사용하세요.
