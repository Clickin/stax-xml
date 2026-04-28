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
---

## API 레퍼런스

현재는 포괄적인 API 가이드를 참조해 주세요:

- [EventReader](/stax-xml/ko/api-guides/event-reader/) - 비동기 XML 파싱
- [EventReaderSync](/stax-xml/ko/api-guides/event-reader-sync/) - 동기 XML 파싱
- [Tree/Object helper](/stax-xml/ko/api-guides/event-reader/#unknown-xml-tree-object-helper) - unknown XML을 ElementTree식 tree 또는 compact object로 projection
- [CursorReader](/stax-xml/ko/api-guides/cursor-reader/) - `IterableReader` 위의 얇은 cursor wrapper
- [Writer](/stax-xml/ko/api-guides/writer/) - 비동기 XML 작성
- [WriterSync](/stax-xml/ko/api-guides/writer-sync/) - 동기 XML 작성
- [WriterSyncSink](/stax-xml/ko/api/main/#writersyncsink) - sink 기반 동기 쓰기의 생성된 TypeDoc 레퍼런스

## Public Surface Map

패키지 import 경로가 이미 `stax-xml` namespace 역할을 하므로 canonical class name에는 `StaxXml` prefix를 붙이지 않습니다. 기존 prefixed alias는 의도적으로 export하지 않습니다.

| Surface | Import path | 목적 | 구현체 메모 |
| --- | --- | --- | --- |
| `EventReader` | `stax-xml` | `ReadableStream<Uint8Array>` 입력용 async event reader. | public boundary에서는 stream backpressure를 유지하고, 내부 iterable event backend에서 XML event를 materialize합니다. runtime acceleration은 reader option이 아니라 `initStaxXml()`에서만 선택합니다. |
| `EventReaderSync` | `stax-xml` | 메모리의 XML string을 순회하는 sync event reader. | string에서 `AnyXmlEvent`를 동기 iterator로 제공합니다. runtime backend가 초기화되어 있으면 내부적으로 structural-index table을 사용할 수 있고, 설정 시 parse error를 JavaScript reader fallback으로 처리할 수 있습니다. |
| `IterableReader` | `stax-xml/iterable` 또는 `stax-xml` | browser-compatible `Uint8Array` batch용 low-level sync byte-batch reader. | batch-local typed-array frame과 span/copy helper를 노출합니다. 상위 reader, cursor, converter fast path가 공유하는 낮은 수준의 reader입니다. |
| `NodeIterableReader` | `stax-xml/iterable/node` | Node `Buffer` batch와 blocking file read용 sync byte-batch reader. | sink adapter가 아니라 별도 Node 구현체입니다. Buffer 지향 scanner, `node:fs` batch helper, 초기화된 runtime handoff를 직접 가집니다. |
| `CursorReader` | `stax-xml/cursor` 또는 `stax-xml` | XML string용 sync cursor-style reader. | event/table parsing 위에 `name()`, `text()`, `getAttributeValue()` 같은 current-event accessor를 제공합니다. |
| `CursorReaderAsync` | `stax-xml/cursor` 또는 `stax-xml` | `ReadableStream<Uint8Array>`용 async cursor-style reader. | 같은 cursor accessor 모델을 유지하면서 async stream을 pull하고, `close()`로 stream/native resource를 닫습니다. |
| `Writer` | `stax-xml` | `WritableStream<Uint8Array>`용 async writer. | web writable stream으로 encoded XML을 incremental하게 씁니다. |
| `WriterSync` | `stax-xml` | 메모리 기반 동기 writer. | XML string을 구성해 반환합니다. 패키지 default export는 계속 `WriterSync`입니다. |
| `WriterSyncSink` | `stax-xml` | 대용량 출력용 synchronous sink writer. | 전체 XML string을 들고 있지 않고 `SyncTextSink`로 증분 출력합니다. |
| Tree/object helper | `stax-xml` | `parseXmlTree*()`와 `parseXmlObject*()` convenience API. | 같은 reader stack으로 unknown XML을 order-preserving tree 또는 compact object로 projection합니다. |
| Runtime acceleration | `stax-xml/runtime` | `initStaxXml()`, `getStaxXmlRuntime()`, backend resolution helper. | backend preference는 여기에 속합니다. reader option은 더 이상 `backend`를 노출하지 않습니다. |

## 타입 정의

StAX-XML에서 내보내는 주요 타입들:

- `XmlEventType` - XML 이벤트 타입 열거형
- `CursorEventType` - 숫자형 cursor 이벤트 상수
- `AnyXmlEvent` - 모든 XML 이벤트의 합집합 타입
- `StartElementEvent` - 속성을 포함한 시작 요소 이벤트
- `CharactersEvent` - 텍스트 콘텐츠 이벤트
- `ErrorEvent` - 파싱 오류 이벤트
- `XmlAttribute` - XML 속성 인터페이스
- `WriteElementOptions` - XML 작성 옵션
- `XmlTreeDocument` / `XmlTreeElement` - 순서 보존 tree helper 결과 타입
- `XmlObjectRecord` / `XmlObjectValue` - compact object helper 결과 타입
- `ParseXmlTreeOptions` / `ParseXmlObjectOptions` - tree/object helper 옵션
- `SyncTextSink` - `WriterSyncSink`용 사용자 정의 동기 sink target
- `EventReaderOptions` / `EventReaderSyncOptions` - event reader 옵션
- `IterableReaderOptions` / `IterableReaderBatchFrame` - low-level byte-batch reader 옵션과 frame view
- `NodeIterableReaderOptions` / `NodeIterableReaderBackendKind` - Node 전용 iterable reader 옵션과 선택된 runtime kind
- `WriterOptions` / `WriterSyncOptions` - async/sync writer 옵션
- `WriterSyncSinkOptions` - sink 기반 동기 writer 옵션
- `CursorReaderOptions` - 동기 cursor reader 옵션
- `CursorReaderAsyncOptions` - 비동기 cursor reader 옵션

자세한 타입 정보와 메서드 시그니처는 위의 개별 API 가이드를 참조하세요.
