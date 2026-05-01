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
- [Writer](/stax-xml/ko/api-guides/writer/) - 비동기 XML 작성
- [WriterSync](/stax-xml/ko/api-guides/writer-sync/) - 동기 XML 작성
- [WriterSyncSink](/stax-xml/ko/api/main/#writersyncsink) - sink 기반 동기 쓰기의 생성된 TypeDoc 레퍼런스
- [ProjectionReader](/stax-xml/ko/api/projection/) - unknown schema full-document projection 및 native row fast path

## Public Surface Map

패키지 import 경로가 이미 `stax-xml` namespace 역할을 하므로 canonical class name에는 `StaxXml` prefix를 붙이지 않습니다. 기존 prefixed alias는 의도적으로 export하지 않습니다.

권장 방향: 목표 XML-to-object shape를 알고 있다면 converter API를 먼저 사용하세요. 전체 XML 순회가 필요할 때 가벼운 per-event 작업이면 `EventReader` 또는 `EventReaderSync`를 먼저 시도하고, unknown-schema 작업이 tree, node, row materialization처럼 무거워지면 `ProjectionReader`를 사용하세요.

| Surface | Import path | 목적 | 구현체 메모 |
| --- | --- | --- | --- |
| `EventReader` | `stax-xml` | `ReadableStream<Uint8Array>` 입력용 async event reader. | public boundary에서는 stream backpressure를 유지합니다. 초기화된 native streaming batch backend가 있으면 생성 시점에 native backend를 선택하고, 아니면 내부 JavaScript reader를 사용합니다. |
| `EventReaderSync` | `stax-xml` | 메모리의 XML string을 순회하는 sync event reader. | string에서 lean `AnyXmlEvent`를 동기 iterator로 제공합니다. runtime backend가 초기화되어 있으면 내부적으로 structural-index table을 사용할 수 있고, 확장 namespace field가 필요하면 `namespaceAware: true`를 설정합니다. |
| `Writer` | `stax-xml` | `WritableStream<Uint8Array>`용 async writer. | web writable stream으로 encoded XML을 incremental하게 씁니다. |
| `WriterSync` | `stax-xml` | 메모리 기반 동기 writer. | XML string을 구성해 반환합니다. 패키지 default export는 계속 `WriterSync`입니다. |
| `WriterSyncSink` | `stax-xml` | 대용량 출력용 synchronous sink writer. | 전체 XML string을 들고 있지 않고 `SyncTextSink`로 증분 출력합니다. |
| Tree/object helper | `stax-xml` | `parseXmlTree*()`와 `parseXmlObject*()` convenience API. | 같은 reader stack으로 unknown XML을 order-preserving tree 또는 compact object로 projection합니다. convenience shape만으로 충분할 때 사용하고, known-schema 추출은 converter API를 사용하세요. |
| `ProjectionReader` | `stax-xml/projection` | `Buffer` 또는 `Uint8Array` 입력용 unknown-schema full-document projection 및 Native/Wasm row fast path. | `parseXmlNodes*()`는 txml-style order-preserving object tree를 반환합니다. 가벼운 event-reader traversal만으로 부족한 무거운 unknown-schema materialization에 사용하고, projection row helper는 lower-level native fast path로 남깁니다. public 이름에는 의도적으로 `Node` prefix를 붙이지 않습니다. |
| Runtime acceleration | `stax-xml/runtime` | `initStaxXml()`, `getStaxXmlRuntime()`, backend resolution helper. | backend preference는 여기에 속합니다. reader option은 더 이상 `backend`를 노출하지 않습니다. |

## 타입 정의

StAX-XML에서 내보내는 주요 타입들:

- `XmlEventType` - XML 이벤트 타입 열거형
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
- `WriterOptions` / `WriterSyncOptions` - async/sync writer 옵션
- `WriterSyncSinkOptions` - sink 기반 동기 writer 옵션
- `ParseXmlNodesOptions` / `XmlNode` / `XmlElementNode` - unknown-schema txml-style full-document projection 타입
- `ProjectionReaderOptions` / `ObjectRowsProjectionSpec` - public native projection surface 옵션과 row projection spec

자세한 타입 정보와 메서드 시그니처는 위의 개별 API 가이드를 참조하세요.
