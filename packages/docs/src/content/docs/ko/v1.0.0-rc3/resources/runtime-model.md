---
title: 실행 모델
description: StAX-XML의 배포 형태와 JavaScript 공개 API 기준.
slug: ko/v1.0.0-rc3/resources/runtime-model
---

StAX-XML은 순수 JavaScript 패키지로 배포됩니다. 설치하거나 선택해야 하는 native
addon, Wasm parser module, backend selection 단계가 없습니다. 같은 패키지가
Node.js, Bun, Deno, browser, edge runtime에서 동작하도록 구성되어 있습니다.

이 기준이 중요한 이유는 공개 API가 JavaScript 값을 반환하기 때문입니다.
사용자가 받는 값은 문자열, attribute, event object, array, converter output
object입니다. 더 낮은 수준의 scanner가 XML token 경계를 더 빨리 찾을 수는
있지만, 사용자가 값을 소비하려면 결국 JavaScript 문자열과 객체가 되어야 합니다.

Parser를 JavaScript 안에 두면 다음 기준이 명확해집니다.

- 설치와 실행 방식이 runtime 사이에서 단순하게 유지됩니다.
- 메모리 사용량을 가능한 한 JavaScript runtime 안에서 볼 수 있습니다.
- 대용량 XML 처리에서 문서 전체를 하나의 문자열로 만들지 않아도 됩니다.
- DOM 상태를 들고 있지 않고 pull 방식 reader로 event를 순차적으로 받을 수 있습니다.

할당 비용을 낮추고 싶다면 `StreamReader` 또는 `StreamReaderSync`를 사용하고,
각 batch를 `eventCount`와 index accessor로 소비하세요. 애플리케이션 코드에서
읽기 쉬운 API가 필요하면 `EventReader`, `EventReaderSync`, converter schema를
사용하면 됩니다.
