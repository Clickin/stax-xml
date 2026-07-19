---
title: XML 변환 파이프라인
description: 이벤트 또는 current-token 방식으로 XML을 읽고, 수정하고, 다시 씁니다.
slug: ko/v1.1.0/guide/event-pipelines
---

StAX-XML 1.1은 reader와 writer를 두 가지 pull 기반 변환 파이프라인으로
연결합니다. 안정적인 타입 객체가 유용한 변환에는 materialized event를 사용하고,
할당 최소화가 중요한 경로에는 current-token reader를 사용하세요.

## Event 파이프라인

`EventReader`와 `EventReaderSync`는 안정적인 `AnyXmlEvent` 객체를 반환합니다.
Writer는 이 객체를 `writeEvent()`로 받으므로, 그대로 둘 이벤트는 직접 전달하고
원하는 이벤트만 교체할 수 있습니다.

```ts
import {
  EventReaderSync,
  WriterSync,
  XmlEventType,
  type AnyXmlEvent,
} from 'stax-xml';

const fixture = `<?xml version="1.0"?>
<catalog xmlns="urn:catalog"><item id="1">기존</item><empty/></catalog>`;
const writer = new WriterSync();

for (const event of new EventReaderSync(fixture)) {
  const modified: AnyXmlEvent =
    event.type === XmlEventType.CHARACTERS && event.value === '기존'
      ? { ...event, value: '변경' }
      : event;
  writer.writeEvent(modified);
}

const xml = writer.getXmlString();
```

비동기 reader와 writer도 같은 형태로 연결합니다.

```ts
import { EventReader, Writer, XmlEventType } from 'stax-xml';

const writer = new Writer(output);
for await (const event of new EventReader(input)) {
  await writer.writeEvent(
    event.type === XmlEventType.COMMENT
      ? { ...event, value: event.value.trim() }
      : event,
  );
}
```

`writeEvent()`는 `AnyXmlEvent`가 표현하는 표준 이벤트, 즉 문서 경계, element,
문자열, CDATA, comment, processing instruction, DTD를 처리합니다. `writeRaw()`는
신뢰할 수 있는 직접 출력용 escape hatch로 유지됩니다. Java StAX의
`XMLEventWriter`와 마찬가지로 RAW를 비표준 event type으로 추가하지는 않습니다.

## Current-token 파이프라인

`StreamReader`와 `StreamReaderSync`는 event 객체를 materialize하지 않습니다.
현재 token의 accessor를 읽고 대응하는 writer method를 호출합니다. 코드는 더
길지만 hot path에서 token마다 객체를 하나씩 할당하지 않고 XML을 복사하거나
수정할 수 있습니다.

일반적인 namespace 보존 복사에는 event 파이프라인을 권장합니다. Namespace
선언은 start-element attribute에 포함되며 `writeEvent()`가 이를 올바르게
처리합니다. Current-token 파이프라인에서는 namespace 선언을 일반 attribute가
아닌 `writeNamespace()`로 분기해야 합니다.

## Fidelity와 event field

- `START_DOCUMENT`는 XML declaration에 명시된 `version`, `encoding`,
  `standalone`을 제공합니다.
- `START_ELEMENT`는 qualified/expanded name, source-order attribute,
  `selfClosing`을 제공하여 `<empty/>`와 `<empty></empty>`를 구별합니다.
- `namespaceAware: true`에서는 namespace 선언을 XMLNS namespace URI를 가진
  `EventAttributes` 항목으로 유지하므로 writer가 필요한 binding을 재구성할 수
  있습니다.
- Attribute가 없으면 `attributes`는 `undefined`입니다. 내부적으로는 예측 가능한
  hidden class를 위해 event runtime object의 property layout을 고정합니다.

## DTD와 entity 보안 경계

Reader는 완전한 DTD declaration을 event로 제공하고 writer는 `writeDTD()` 또는
`writeEvent()`로 기록할 수 있습니다. StAX-XML은 DTD entity declaration을 자동
적용하거나 external entity를 resolve하지 않으며 filesystem/network에 접근하지
않습니다. 애플리케이션이 검토한 신뢰할 수 있는 internal declaration만 reader와
writer의 `addEntities`에 replacement value로 명시하세요.

따라서 XML input에 ambient I/O 권한을 주지 않으면서도 DTD 검사, validation,
round-trip output을 구현할 수 있습니다.
