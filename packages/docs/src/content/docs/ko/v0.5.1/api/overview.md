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
slug: ko/v0.5.1/api/overview
---

## API 레퍼런스

현재는 포괄적인 API 가이드를 참조해 주세요:

- [StaxXmlParser](/stax-xml/ko/v0.5.1/api-guides/staxxml-parser/) - 비동기 XML 파싱
- [StaxXmlParserSync](/stax-xml/ko/v0.5.1/api-guides/staxxml-parser-sync/) - 동기 XML 파싱
- [StaxXmlWriter](/stax-xml/ko/v0.5.1/api-guides/staxxml-writer/) - 비동기 XML 작성
- [StaxXmlWriterSync](/stax-xml/ko/v0.5.1/api-guides/staxxml-writer-sync/) - 동기 XML 작성


## 타입 정의

StAX-XML에서 내보내는 주요 타입들:

- `XmlEventType` - XML 이벤트 타입 열거형
- `AnyXmlEvent` - 모든 XML 이벤트의 합집합 타입
- `StartElementEvent` - 속성을 포함한 시작 요소 이벤트
- `CharactersEvent` - 텍스트 콘텐츠 이벤트
- `ErrorEvent` - 파싱 오류 이벤트
- `XmlAttribute` - XML 속성 인터페이스
- `WriteElementOptions` - XML 작성 옵션

자세한 타입 정보와 메서드 시그니처는 위의 개별 API 가이드를 참조하세요.