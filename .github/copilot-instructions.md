## 환경설정
이 프로젝트는 Bun 런타임을 사용하기 때문에 npm, yarn, pnpm 등 다른 패키지 매니저로 호출하지 마십시오.

## 필수사항
Web Standard API만을 사용하고, 가능한 한 추가적인 dependency 없이 동작하도록 설계해야합니다.
XmlEvent를 Any나 unknown으로 선언하지 말고, 항상 정확한 타입을 사용해야 합니다. 예를 들어, `XmlEvent` 타입을 사용하는 경우, `XmlStartElementEvent`, `XmlEndElementEvent` 등 구체적인 타입을 사용해야 합니다.

## 테스트
이 프로젝트는 테스트 커버리지 100%입니다. 만약 새로운 기능을 추가하거나 버그를 수정했다면, 반드시 테스트를 작성해야 합니다. 테스트는 `bun test` 명령어로 실행할 수 있습니다.