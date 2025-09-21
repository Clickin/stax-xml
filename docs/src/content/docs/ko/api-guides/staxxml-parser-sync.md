---
title: StaxXmlParserSync - 동기식 XML 파싱
description: JavaScript/TypeScript용 고성능 동기식 XML 파서
---

## StaxXmlParserSync - 동기식 XML 파싱

`StaxXmlParserSync`는 XML 문자열의 동기식 처리를 위해 설계된 JavaScript/TypeScript용 고성능 풀 기반 XML 파서입니다. 전체 XML 문서가 이미 메모리에 있는 환경, 예를 들어 소규모에서 중간 규모의 XML 페이로드를 처리하는 웹 서버에서 이상적입니다. 비동기 스트림의 오버헤드를 피할 수 있습니다.

### 🔧 빠른 시작

#### XML 문자열 파싱

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

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

const parser = new StaxXmlParserSync(xmlContent);
const products = [];
let currentProduct = null;
let currentText = '';

for (const event of parser) { // 동기식 반복을 위해 for...of 사용
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

### 📚 API 참조

```typescript
class StaxXmlParserSync {
  constructor(
    xmlString: string,
    options?: StaxXmlParserSyncOptions
  )
}

interface StaxXmlParserSyncOptions {
  autoDecodeEntities?: boolean; // 기본값: true
  addEntities?: { entity: string, value: string }[];
}
```
