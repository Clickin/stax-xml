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

public package는 pure JavaScript StAX-style parser와 writer입니다.

- [StreamReader](/stax-xml/ko/api/main/#streamreader) - 비동기 batch-first StAX core
- [StreamReaderSync](/stax-xml/ko/api/main/#streamreadersync) - 동기 batch-first StAX core
- [EventReader](/stax-xml/ko/api-guides/event-reader/) - 비동기 XML 파싱
- [EventReaderSync](/stax-xml/ko/api-guides/event-reader-sync/) - 동기 XML 파싱
- [Tree/Object helper](/stax-xml/ko/api-guides/event-reader/#unknown-xml-tree-object-helper) - unknown XML을 ElementTree식 tree 또는 compact object로 projection
- [Writer](/stax-xml/ko/api-guides/writer/) - 비동기 XML 작성
- [WriterSync](/stax-xml/ko/api-guides/writer-sync/) - 동기 XML 작성
- [WriterSyncSink](/stax-xml/ko/api/main/#writersyncsink) - sink 기반 동기 쓰기의 생성된 TypeDoc 레퍼런스

## Public Surface Map

목표 XML-to-object shape를 알고 있다면 converter API를 먼저 사용하세요. 저오버헤드
StAX core가 필요하면 `StreamReader` 또는 `StreamReaderSync`부터 시작하세요.
대용량 동기 byte input에서는 각 batch를 `eventCount`와 index accessor로
소비하는 방식을 권장합니다. ergonomic event object가 필요하면 `EventReader`
또는 `EventReaderSync`를 사용하세요.

| Surface | Import path | 목적 | 구현체 메모 |
| --- | --- | --- | --- |
| `StreamReader` | `stax-xml` | `ReadableStream<Uint8Array>` 입력용 async batch-first StAX core. | JavaScript byte reader를 사용하고 `StreamBatch` view를 반환합니다. |
| `StreamReaderSync` | `stax-xml` | `Uint8Array` 또는 byte-batch iterable용 sync batch-first StAX core. | JavaScript byte reader를 사용합니다. `eventCount`는 batch-local이며 다음 `nextBatch()` 호출 시 이전 view는 invalid 됩니다. |
| `EventReader` | `stax-xml` | `ReadableStream<Uint8Array>` 입력용 async event reader. | public boundary에서 stream backpressure를 유지합니다. |
| `EventReaderSync` | `stax-xml` | 메모리의 XML string을 순회하는 sync event reader. | JavaScript reader stack에서 `AnyXmlEvent` 값을 materialize합니다. |
| `Writer` | `stax-xml` | `WritableStream<Uint8Array>`용 async writer. | web writable stream으로 encoded XML을 incremental하게 씁니다. |
| `WriterSync` | `stax-xml` | 메모리 기반 동기 writer. | XML string을 구성해 반환합니다. 패키지 default export는 계속 `WriterSync`입니다. |
| `WriterSyncSink` | `stax-xml` | 대용량 출력용 synchronous sink writer. | 전체 XML string을 들고 있지 않고 `SyncTextSink`로 증분 출력합니다. |
| Tree/object helper | `stax-xml` | `parseXmlTree*()`와 `parseXmlObject*()` convenience API. | 같은 reader stack으로 unknown XML을 order-preserving tree 또는 compact object로 projection합니다. |

패키지는 native, Wasm, backend-selection mode를 노출하지 않습니다. Public
contract는 pure JavaScript이며, JavaScript string/object를 반환하는 boundary
cost까지 측정 workload에 포함합니다.

## 타입 정의

StAX-XML에서 내보내는 주요 타입들:

- `XmlEventType` - XML 이벤트 타입 열거형
- `AnyXmlEvent` - 모든 XML 이벤트의 합집합 타입
- `StartElementEvent` - 속성을 포함한 시작 요소 이벤트
- `CharactersEvent` - 텍스트 콘텐츠 이벤트
- `ErrorEvent` - 파싱 오류 이벤트
- `XmlAttribute` - XML 속성 인터페이스
- `XmlTreeDocument` / `XmlTreeElement` - 순서 보존 tree helper 결과 타입
- `XmlObjectRecord` / `XmlObjectValue` - compact object helper 결과 타입
- `ParseXmlTreeOptions` / `ParseXmlObjectOptions` - tree/object helper 옵션
- `SyncTextSink` - `WriterSyncSink`용 사용자 정의 동기 sink target
- `EventReaderOptions` / `EventReaderSyncOptions` - event reader 옵션
- `WriterOptions` / `WriterSyncOptions` - async/sync writer 옵션
- `WriterSyncSinkOptions` - sink 기반 동기 writer 옵션

자세한 타입 정보와 메서드 시그니처는 위의 개별 API 가이드를 참조하세요.
