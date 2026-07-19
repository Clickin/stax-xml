---
title: FAQ
description: StAX-XML의 자주 묻는 질문과 문제 해결 가이드
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
slug: ko/v0.5.1/resources/faq
---

## 일반적인 질문

### StAX-XML이란 무엇인가요?

StAX-XML은 동기 및 비동기 파싱 기능을 모두 제공하는 JavaScript/TypeScript용 고성능 풀 기반 XML 파서입니다. 웹 표준 API만을 사용하여 모든 JavaScript 런타임(Node.js, Bun, Deno, 브라우저)에서 작동하도록 설계되었습니다.

### StAX-XML은 다른 XML 파서와 어떻게 다른가요?

- **풀 기반 파싱**: 파싱 흐름을 제어하며, 한 번에 하나의 이벤트를 처리합니다
- **메모리 효율적**: 스트리밍을 위한 일정한 메모리 사용량, 전체 문서를 로드할 필요 없음
- **고성능**: 최소한의 객체 할당으로 속도에 최적화됨
- **크로스 플랫폼**: 브라우저, Node.js, Bun, Deno 및 엣지 런타임에서 작동
- **동기 및 비동기 모두**: 사용 사례에 맞는 올바른 접근법 선택

### 동기 vs 비동기 파서를 언제 사용해야 하나요?

- **StaxXmlParserSync**: 10MB 미만의 문서, 전체 XML 문자열이 메모리에 있을 때, 또는 최대 성능이 필요할 때 사용
- **StaxXmlParser**: 대용량 파일, 스트리밍 시나리오, 웹 애플리케이션(논블로킹) 또는 ReadableStream에서 처리할 때 사용

## 설치 및 설정

### 어떤 패키지 매니저를 사용해야 하나요?

StAX-XML은 모든 패키지 매니저와 호환됩니다:

```bash
npm install stax-xml     # npm
yarn add stax-xml        # yarn
pnpm add stax-xml        # pnpm
bun add stax-xml         # bun
deno add npm:stax-xml    # deno
```

### StAX-XML은 브라우저에서 작동하나요?

네! StAX-XML은 웹 표준 API만을 사용하므로 모든 최신 브라우저에서 작동합니다. 모든 번들러(Webpack, Vite, Rollup 등)와 함께 사용하거나 브라우저 환경에서 직접 사용할 수 있습니다.

### 어떤 TypeScript 버전이 필요한가요?

StAX-XML은 TypeScript 4.5+와 호환되며 완전한 타입 정의를 포함합니다. 추가 `@types` 패키지는 필요하지 않습니다.

## 파싱 질문

### 네임스페이스가 있는 XML을 어떻게 처리하나요?

StAX-XML은 네임스페이스를 자동으로 처리합니다. 이벤트 속성을 통해 네임스페이스 정보에 액세스하세요:

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

for (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log('요소 이름:', event.name);           // 접두사가 포함된 전체 이름
    console.log('로컬 이름:', event.localName);        // 접두사 없는 이름
    console.log('네임스페이스 URI:', event.namespaceURI);  // 네임스페이스 URI
    console.log('접두사:', event.prefix);               // 네임스페이스 접두사
  }
}
```

### XML을 JSON으로 변환하는 방법은?

간단한 XML-to-JSON 변환기입니다:

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

function xmlToJson(xmlString: string): any {
  const parser = new StaxXmlParserSync(xmlString);
  const stack: any[] = [];
  let result: any = null;

  for (const event of parser) {
    switch (event.type) {
      case XmlEventType.START_ELEMENT:
        const element: any = {};
        if (event.attributes) {
          element['@attributes'] = event.attributes;
        }

        if (stack.length === 0) {
          result = { [event.name]: element };
          stack.push(result[event.name]);
        } else {
          const parent = stack[stack.length - 1];
          if (!parent[event.name]) {
            parent[event.name] = element;
          } else if (Array.isArray(parent[event.name])) {
            parent[event.name].push(element);
          } else {
            parent[event.name] = [parent[event.name], element];
          }
          stack.push(element);
        }
        break;

      case XmlEventType.CHARACTERS:
        const text = event.text.trim();
        if (text && stack.length > 0) {
          const current = stack[stack.length - 1];
          current['#text'] = text;
        }
        break;

      case XmlEventType.END_ELEMENT:
        stack.pop();
        break;
    }
  }

  return result;
}
```

### 메모리 부족 없이 대용량 XML 파일을 처리하는 방법은?

스트리밍과 함께 비동기 파서를 사용하세요:

```typescript
import { StaxXmlParser, XmlEventType } from 'stax-xml';

async function processLargeXml(stream: ReadableStream<Uint8Array>) {
  const parser = new StaxXmlParser(stream);

  // 모든 이벤트를 저장하지 않고 하나씩 처리
  for await (const event of parser) {
    if (event.type === XmlEventType.START_ELEMENT) {
      // 즉시 처리, 저장하지 않음
      await processElement(event);
    }
  }
}
```

### 빈 텍스트 이벤트가 발생하는 이유는?

XML은 종종 요소 사이에 공백을 포함합니다. 빈 텍스트를 필터링하세요:

```typescript
for (const event of parser) {
  if (event.type === XmlEventType.CHARACTERS) {
    const text = event.text.trim();
    if (text) {
      // 비어있지 않은 텍스트만 처리
      console.log('텍스트:', text);
    }
  }
}
```

## 오류 처리

### 잘못된 형식의 XML을 처리하는 방법은?

StAX-XML은 유효하지 않은 XML에 대한 오류 이벤트를 생성합니다:

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

const parser = new StaxXmlParserSync(malformedXml);

for (const event of parser) {
  if (event.type === XmlEventType.ERROR) {
    console.error('파싱 오류:', event.message);
    console.error('위치:', event.position);
    // 오류 처리 - 파싱 중단 또는 계속
    break;
  }
}
```

### 파싱이 실패할 때 어떻게 해야 하나요?

1. **XML 구문 확인** - 올바른 형식인지 확인
2. **인코딩 문제 처리** - StAX-XML은 UTF-8을 예상
3. **입력 소스 검증** - ReadableStream이 제대로 구성되었는지 확인
4. **동기 파싱에 try-catch 사용**:

```typescript
try {
  const parser = new StaxXmlParserSync(xmlString);
  for (const event of parser) {
    // 이벤트 처리
  }
} catch (error) {
  console.error('파싱 실패:', error.message);
}
```

## 성능 질문

### 파싱 성능을 향상시키는 방법은?

1. **10MB 미만 문서에는 StaxXmlParserSync 사용**
2. **이벤트 핸들러에서 객체 생성 최소화**
3. **if-else 체인 대신 switch 문 사용**
4. **이벤트를 저장하지 말고 즉시 처리**
5. **파싱 루프 외부에서 정규식 미리 컴파일**

```typescript
// 좋음 - 효율적인 파싱
const targetElements = new Set(['title', 'author', 'price']);

for (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    if (targetElements.has(event.name)) {
      // 관련 요소만 처리
    }
  }
}
```

### 파싱이 느린 이유는?

일반적인 성능 문제:

- **작은 문서에 비동기 파서 사용** - 대신 동기 파서 사용
- **모든 이벤트를 메모리에 저장** - 이벤트를 즉시 처리
- **이벤트 핸들러에서 복잡한 문자열 작업**
- **불필요한 이벤트 필터링하지 않음** - 공백과 주석 건너뛰기
- **많은 임시 객체 생성** - 가능하면 객체 재사용

## 문제 해결

### "Module not found" 오류

올바른 경로에서 가져오는지 확인하세요:

```typescript
// 올바른 import
import { StaxXmlParser, StaxXmlParserSync } from 'stax-xml';
import { StaxXmlWriter, StaxXmlWriterSync } from 'stax-xml';
import { XmlEventType } from 'stax-xml';
```

### TypeScript 오류

`tsconfig.json`에 다음이 포함되어 있는지 확인하세요:

```json
{
  "compilerOptions": {
    "target": "ES2018",
    "lib": ["ES2018", "DOM"],
    "moduleResolution": "node"
  }
}
```

### 도움 받기

여전히 문제가 있다면:

1. 유사한 사용 사례는 [예제](/stax-xml/ko/v0.5.1/guide/examples/) 페이지 확인
2. 자세한 메서드 서명은 [API 문서](/stax-xml/ko/v0.5.1/api/) 검토
3. 기존 솔루션은 [GitHub Issues](https://github.com/Clickin/stax-xml/issues) 검색
4. 최소 재현 사례와 함께 새 이슈 생성

## 모범 사례

### 메모리 관리

- 이벤트를 저장하지 말고 즉시 처리
- 자주 생성되는 객체에 객체 풀링 사용
- 처리 완료 시 참조 정리

### 오류 처리

- 파서 루프에서 항상 ERROR 이벤트 처리
- 동기 파싱에는 try-catch 블록 사용
- 가능하면 파싱 전에 입력 검증

### 성능

- 사용 사례에 맞는 올바른 파서 유형 선택
- 이벤트 핸들러에서 작업 최소화
- 조회를 위해 효율적인 데이터 구조(Set, Map) 사용

### 보안

- 신뢰할 수 없는 소스의 XML 입력 검증 및 살균
- XML 폭탄과 깊게 중첩된 구조 주의
- 프로덕션 사용을 위한 파싱 제한 구현 고려