---
title: API 레퍼런스 개요
description: StAX-XML의 완전한 API 레퍼런스
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/ko/api/overview.png
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
      content: https://clickin.github.io/stax-xml/og/ko/api/overview.png
slug: ko/v1.0.0/api/overview
---

## API Reference

StAX-XML 1.0에는 두 ESM entry point만 있습니다.

- `stax-xml` — 네 개의 pull reader와 세 개의 writer
- `stax-xml/converter` — schema 기반 converter

Runtime, adapter, backend selection, tree, DOM, native, Wasm용 public subpath는
제공하지 않습니다.

## Public Surface Map

| Surface | 입력 또는 출력 | 용도 |
| --- | --- | --- |
| `StreamReaderSync` | `string`, `Uint8Array`, `Iterable<Uint8Array>` | 할당을 줄인 동기 current-token API가 필요할 때 사용합니다. String은 재인코딩하지 않고 직접 읽습니다. |
| `EventReaderSync` | 같은 동기 입력 | 안정적인 event object와 동기 iteration이 필요할 때 사용합니다. |
| `StreamReader` | `ReadableStream<Uint8Array>`, `AsyncIterable<Uint8Array>` | Backpressure를 유지하는 비동기 current-token API가 필요할 때 사용합니다. |
| `EventReader` | 같은 비동기 입력 | 안정적인 event object와 `for await` iteration이 필요할 때 사용합니다. |
| Converter | `stax-xml/converter` | XML shape를 알고 있고 DOM 없이 typed object projection을 만들 때 사용합니다. |
| `WriterSync` | JavaScript string 출력 | 전체 출력이 메모리에 충분히 들어갈 때 사용합니다. |
| `WriterSyncSink` | 동기 text sink | 동기 incremental output 또는 외부 encoder에 사용합니다. |
| `Writer` | `WritableStream<Uint8Array>` 또는 `AsyncTextSink` | 비동기 UTF-8 output 또는 외부 encoder에 사용합니다. |

네 reader는 같은 token core를 사용하고 `START_DOCUMENT`와 `END_DOCUMENT`를
발생시킵니다. `StreamReaderSync`와 `StreamReader`는 `eventType()`, `name()`,
`text()`, `attributeValue()`, `namespaceURI()` 같은 accessor로 현재 token을
제공합니다. Event reader는 같은 token에서 안정적인 `AnyXmlEvent` object를
materialize합니다.

## Imports

```ts
import {
  EventReader,
  EventReaderSync,
  StreamReader,
  StreamReaderSync,
  Writer,
  WriterSync,
  WriterSyncSink,
  XmlEventType,
} from 'stax-xml';

import { x } from 'stax-xml/converter';
```

Package는 ESM-only이며 root default export는 없습니다.

## 주요 타입

- `AnyXmlEvent`, `EventAttribute`, export된 event interface
- `XmlEventType`
- `EventReaderOptions` / `EventReaderSyncOptions`
- `StreamReaderOptions` / `StreamReaderSyncOptions`
- `StreamReaderSource` / `StreamReaderSyncInput`
- `WriterOptions` / `WriterSyncOptions` / `WriterSyncSinkOptions`
- `SyncTextSink`
- `DocumentMode`

Lifecycle 예제는 reader와 writer guide를 참고하세요. Generated TypeDoc
reference는 release 전에 같은 package entry point에서 다시 생성합니다.
