---
title: StAX-XML FAQ - JavaScript XML Parser Questions & Answers
description: StAX-XML 사용법, runtime 지원, 성능, package 실행 모델에 대한 FAQ.
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
slug: ko/v1.0.0/resources/faq
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
        "text": "아니요. StAX-XML은 순수 JavaScript 패키지로 배포됩니다. 공개 API가 JavaScript 문자열과 객체를 반환하므로 parsing과 값 생성을 JavaScript runtime 안에서 처리합니다."
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

### StAX-XML은 native addon이나 Wasm을 사용하나요?

아니요. StAX-XML은 순수 JavaScript 패키지로 배포됩니다. 설치하거나 선택해야 하는
native addon, Wasm parser module, backend selection 단계가 없습니다. 공개 API가
JavaScript 문자열, attribute, event object, converter output object를 반환하므로
지원하는 실행 모델은 parsing과 값 생성을 JavaScript 안에서 처리합니다. 자세한
설명은 [실행 모델](/stax-xml/ko/resources/runtime-model/)을 참고하세요.

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
파싱하세요. 읽기 쉬운 async API가 필요하면 `EventReader`를 사용하면 됩니다.
호출자가 이미 byte를 batching할 수 있다면 `Iterable<Uint8Array[]>` 위의
`StreamReaderSync`가 더 낮은 overhead의 sync batch API입니다.

### XML은 어떻게 작성하나요?

`WritableStream<Uint8Array>`에는 `Writer`, 인메모리 string 출력에는 `WriterSync`,
전체 XML string을 보관하지 않는 동기 incremental 출력에는 `WriterSyncSink`를
사용하세요.
