---
title: EventReaderSync - 동기식 XML 파싱
description: JavaScript/TypeScript용 고성능 동기식 XML 파서
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/event-reader-sync.png
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
      content: https://clickin.github.io/stax-xml/og/ko/api-guides/event-reader-sync.png
---

## EventReaderSync - 동기식 XML 파싱

`EventReaderSync`는 XML 문자열의 동기식 처리를 위해 설계된 JavaScript/TypeScript용 고성능 풀 기반 XML 파서입니다. 전체 XML 문서가 이미 메모리에 있는 환경, 예를 들어 소규모에서 중간 규모의 XML 페이로드를 처리하는 웹 서버에서 이상적입니다. 비동기 스트림의 오버헤드를 피할 수 있습니다.

### 🔧 빠른 시작

#### XML 문자열 파싱

```typescript
import { EventReaderSync, XmlEventType } from 'stax-xml';

const xmlContent = `
  <catalog>
    <product id="P001">
      <name>Laptop</name>
      <price>1200</price>
    </product>
    <product id="P002">
      <name>Mouse</name>
      <price>25</price>
    </product>
  </catalog>
`;

const parser = new EventReaderSync(xmlContent);
const products = [];
let currentProduct = null;
let currentText = '';

for (const event of parser) { // 동기식 이터레이터 반복을 위해 for...of 사용
  switch (event.type) {
    case XmlEventType.START_ELEMENT:
      if (event.name === 'product') {
        currentProduct = { id: event.attributes?.id || '', name: '', price: 0 };
      } else if (event.name === 'name' || event.name === 'price') {
        currentText = ''; // 새 엘리먼트에 대해 텍스트 버퍼 재설정
      }
      break;
      
    case XmlEventType.CHARACTERS:
      currentText += event.value; // 동기식 파서에서는 event.value 사용
      break;
      
    case XmlEventType.END_ELEMENT:
      if (currentProduct) {
        if (event.name === 'name') {
          currentProduct.name = currentText.trim();
        } else if (event.name === 'price') {
          currentProduct.price = parseFloat(currentText.trim());
        } else if (event.name === 'product') {
          products.push(currentProduct);
          currentProduct = null;
        }
      }
      break;
  }
}

console.log(products);
// 출력: [
//   { id: "P001", name: "Laptop", price: 1200 },
//   { id: "P002", name: "Mouse", price: 25 }
// ]
```

### 🛡️ 타입 가드 함수

타입 가드 함수는 XML 이벤트에 대한 런타임 타입 확인과 TypeScript 타입 좁히기를 제공합니다. 이러한 함수들은 비동기와 동기 파서 모두에서 작동하며, `EventReaderSync`에도 동일한 타입 안전성 혜택을 제공합니다.

#### 동기식 파서에서 타입 가드 사용하기

```typescript
import { EventReaderSync, isStartElement, isEndElement, isCharacters, isError } from 'stax-xml';

const xmlContent = `
  <products>
    <product id="P001" category="electronics">
      <name>Laptop</name>
      <price>1200</price>
      <description><![CDATA[개발자를 위한 고성능 노트북]]></description>
    </product>
    <product id="P002" category="accessories">
      <name>Mouse</name>
      <price>25</price>
    </product>
  </products>
`;

const parser = new EventReaderSync(xmlContent);
const products = [];
let currentProduct = null;
let currentElement = '';
let textBuffer = '';

for (const event of parser) {
  // 타입 가드는 동기식 파서에서도 동일하게 작동
  if (isStartElement(event)) {
    currentElement = event.name;
    textBuffer = '';

    if (event.name === 'product') {
      currentProduct = {
        id: event.attributes?.id || '',
        category: event.attributes?.category || '',
        name: '',
        price: 0,
        description: ''
      };
    }
  } else if (isCharacters(event)) {
    // 타입 가드가 'value' 속성에 안전한 접근을 보장
    textBuffer += event.value;
  } else if (isEndElement(event)) {
    const trimmedText = textBuffer.trim();

    if (currentProduct && event.name !== 'product') {
      switch (event.name) {
        case 'name':
          currentProduct.name = trimmedText;
          break;
        case 'price':
          currentProduct.price = parseFloat(trimmedText);
          break;
        case 'description':
          currentProduct.description = trimmedText;
          break;
      }
    } else if (event.name === 'product' && currentProduct) {
      products.push(currentProduct);
      currentProduct = null;
    }

    textBuffer = '';
  } else if (isError(event)) {
    // 타입 가드를 사용한 안전한 오류 처리
    console.error('파싱 오류:', event.error.message);
    break;
  }
}

console.log(products);
```

#### 타입 가드를 사용한 동기식 오류 처리

```typescript
import { EventReaderSync, isStartElement, isCharacters, isError } from 'stax-xml';

function parseProductsSafely(xmlString: string) {
  try {
    const parser = new EventReaderSync(xmlString);
    const result = { products: [], errors: [] };

    for (const event of parser) {
      if (isError(event)) {
        // 타입 가드가 오류 세부 정보에 안전한 접근을 제공
        result.errors.push({
          message: event.error.message,
          timestamp: new Date().toISOString()
        });
        break; // 오류 발생 시 파싱 중단
      } else if (isStartElement(event) && event.name === 'product') {
        // 타입 가드가 'attributes' 속성이 사용 가능함을 보장
        result.products.push({
          id: event.attributes?.id || 'unknown',
          category: event.attributes?.category || 'uncategorized'
        });
      }
    }

    return result;
  } catch (error) {
    return { products: [], errors: [{ message: error.message, timestamp: new Date().toISOString() }] };
  }
}

// 사용법
const result = parseProductsSafely(xmlContent);
if (result.errors.length > 0) {
  console.error('파싱 오류:', result.errors);
} else {
  console.log('파싱된 제품:', result.products);
}
```

#### 동기식 파서를 위한 타입 가드 함수 참조

모든 타입 가드 함수는 `EventReader`와 `EventReaderSync` 모두에서 동일하게 작동합니다:

| 함수 | 목적 | 동기 파서에서의 사용법 |
|------|------|----------------------|
| `isStartDocument(event)` | 문서 시작 | 문서 시작 확인 |
| `isEndDocument(event)` | 문서 끝 | 문서 완료 확인 |
| `isStartElement(event)` | 여는 태그 | 엘리먼트 이름과 속성에 안전한 접근 |
| `isEndElement(event)` | 닫는 태그 | 엘리먼트 종료를 안전하게 처리 |
| `isCharacters(event)` | 텍스트 내용 | 텍스트 값에 안전한 접근 |
| `isCdata(event)` | CDATA 섹션 | CDATA 내용에 안전한 접근 |
| `isError(event)` | 파싱 오류 | 파싱 오류를 우아하게 처리 |

#### 동기식 파싱의 이점

1. **일관된 API**: 비동기와 동기 파서 모두에서 동일한 타입 가드 함수 사용 가능
2. **타입 안전성**: 이벤트에서 정의되지 않은 속성에 접근하는 것을 방지
3. **향상된 오류 처리**: 파싱 오류와 내용 이벤트를 안전하게 구분
4. **향상된 유지보수성**: 수동 타입 확인에 비해 더 읽기 쉬운 코드

#### 비교: 수동 타입 확인 vs 타입 가드

**수동 타입 확인 (권장하지 않음):**
```typescript
for (const event of parser) {
  if (event.type === 'START_ELEMENT') {
    // 타입 안전성 없음 - TypeScript가 'attributes'에 대해 알지 못함
    console.log(event.attributes?.id); // 잠재적 런타임 오류
  }
}
```

**타입 가드 (권장):**
```typescript
for (const event of parser) {
  if (isStartElement(event)) {
    // 완전한 타입 안전성 - TypeScript가 이것이 StartElementEvent임을 인식
    console.log(event.attributes.id); // 안전한 접근, 경고 없음
  }
}
```

### 📚 API 참조

```typescript
class EventReaderSync {
  constructor(
    xmlString: string,
    options?: EventReaderSyncOptions
  )
}

interface EventReaderSyncOptions {
  autoDecodeEntities?: boolean; // 기본값: true
  addEntities?: { entity: string, value: string }[];
}
```
