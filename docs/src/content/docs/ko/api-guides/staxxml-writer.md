---
title: StaxXmlWriter - XML 문서 생성
description: 프로그래밍 방식으로 XML 문서를 생성하는 강력한 XML 라이터
---

## StaxXmlWriter - XML 문서 생성

StAX-XML에는 프로그래밍 방식으로 XML 문서를 생성할 수 있는 강력한 XML 라이터가 포함되어 있습니다. 이 라이터는 이제 완전히 동기식이며 메모리에서 XML 문자열을 빌드합니다.

### 🔧 빠른 시작

##### 로컬 파일에 쓰기

```typescript
import { StaxXmlWriter } from 'stax-xml';
import { writeFileSync } from 'fs'; // 동기식 쓰기를 위해 writeFileSync 사용

// Node.js용 - 로컬 파일에 동기식으로 쓰기
function createLocalXmlFile() {
  const writer = new StaxXmlWriter({
    prettyPrint: true,
    indentString: '  '
  });

  // XML 문서 작성
  writer.writeStartDocument('1.0', 'utf-8');
  
  writer.writeStartElement('catalog', { attributes: { version: '1.0' } });
  
  writer.writeStartElement('product', { attributes: { id: '001' } });
  
  writer.writeStartElement('name');
  writer.writeCharacters('Laptop Computer');
  writer.writeEndElement();
  
  writer.writeStartElement('price', { attributes: { currency: 'USD' } });
  writer.writeCharacters('999.99');
  writer.writeEndElement();
  
  writer.writeEndElement(); // product
  writer.writeEndElement(); // catalog
  
  writer.writeEndDocument();
  
  // 최종 XML 문자열을 가져와서 파일에 쓰기
  writeFileSync('./output.xml', writer.getXmlString());
  console.log('XML 파일이 성공적으로 생성되었습니다!');
}

createLocalXmlFile();
```

##### Express.js 미들웨어 - XML 응답

```typescript
import express from 'express';
import { StaxXmlWriter } from 'stax-xml';

const app = express();

// XML 응답을 생성하는 미들웨어
app.get('/api/users', (req, res) => {
  try {
    // 샘플 데이터
    const users = [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
    ];

    const writer = new StaxXmlWriter({
      prettyPrint: true,
      indentString: '  '
    });

    // 적절한 헤더 설정
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    // XML 작성
    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('users');
    
    for (const user of users) {
      writer.writeStartElement('user', { attributes: { id: user.id.toString() } });
      
      writer.writeStartElement('name');
      writer.writeCharacters(user.name);
      writer.writeEndElement();
      
      writer.writeStartElement('email');
      writer.writeCharacters(user.email);
      writer.writeEndElement();
      
      writer.writeEndElement(); // user
    }
    
    writer.writeEndElement(); // users
    writer.writeEndDocument();
    
    // 최종 XML 문자열 전송
    res.send(writer.getXmlString());
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate XML' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

##### Hono 프레임워크 - XML 응답 생성 (개념적 예제)

*참고: Hono의 스트리밍 응답은 일반적으로 ReadableStream과 함께 작동합니다. `StaxXmlWriter`가 이제 동기식이며 완전한 문자열을 반환하므로, 이전과 같은 직접적인 스트리밍 통합은 적용되지 않습니다. 전체 XML 문자열을 생성한 다음 응답으로 전송하는 방식을 사용합니다.*

```typescript
import { Hono } from 'hono';
import { StaxXmlWriter } from 'stax-xml';

const app = new Hono();

app.get('/api/products', (c) => {
  // 샘플 제품 데이터
  const products = [
    { id: 'P001', name: 'Smartphone', price: 699.99, category: 'Electronics' },
    { id: 'P002', name: 'Headphones', price: 199.99, category: 'Electronics' },
    { id: 'P003', name: 'Coffee Maker', price: 149.99, category: 'Appliances' }
  ];

  const writer = new StaxXmlWriter({
    prettyPrint: true,
    indentString: '    '
  });

  try {
    // XML 생성
    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('products', {
      attributes: {
        count: products.length.toString(),
        generated: new Date().toISOString()
      }
    });
    
    for (const product of products) {
      writer.writeStartElement('product', {
        attributes: {
          id: product.id,
          category: product.category
        }
      });
      
      writer.writeStartElement('name');
      writer.writeCharacters(product.name);
      writer.writeEndElement();
      
      writer.writeStartElement('price', { attributes: { currency: 'USD' } });
      writer.writeCharacters(product.price.toString());
      writer.writeEndElement();
      
      writer.writeEndElement(); // product
    }
    
    writer.writeEndElement(); // products
    writer.writeEndDocument();
    
    // 생성된 XML 문자열을 Response로 반환
    return c.text(writer.getXmlString(), 200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    
  } catch (error) {
    return c.text('XML 생성에 실패했습니다', 500);
  }
});

export default app;
```

##### 고급 라이터 기능

```typescript
import { StaxXmlWriter } from 'stax-xml';

// 사용자 정의 엔터티와 네임스페이스를 사용하여 메모리 내 XML 생성
function createAdvancedXml() {
  const writer = new StaxXmlWriter({
    prettyPrint: true,
    indentString: '  ',
    addEntities: [
      { entity: 'company', value: 'Acme Corporation' },
      { entity: 'copyright', value: '© 2024' }
    ],
    autoEncodeEntities: true
  });

  // 네임스페이스와 사용자 정의 엔터티로 XML 작성
  writer.writeStartDocument('1.0', 'utf-8');
  
  writer.writeStartElement('document', { 
    prefix: 'doc', 
    uri: 'http://example.com/document', 
    attributes: { version: '2.0' } 
  });
  writer.writeNamespace('meta', 'http://example.com/metadata');
  
  writer.writeStartElement('header', { prefix: 'meta' });
  writer.writeStartElement('title');
  writer.writeCharacters('Product Catalog');
  writer.writeEndElement();
  
  writer.writeStartElement('company');
  writer.writeCharacters('&company;'); // 자동으로 인코딩됩니다
  writer.writeEndElement();
  writer.writeEndElement(); // header
  
  writer.writeStartElement('content');
  writer.writeStartElement('item', { attributes: { type: 'featured' } });

  // 자체 닫는 엘리먼트
  writer.writeStartElement('thumbnail', {
    attributes: {
      src: 'image.jpg',
      alt: 'Product Image'
    },
    selfClosing: true
  });
  
  writer.writeStartElement('description');
  writer.writeCDATA('<p>This is <b>HTML</b> content in CDATA</p>');
  writer.writeEndElement();
  
  writer.writeEndElement(); // item
  writer.writeEndElement(); // content
  writer.writeEndElement(); // document
  
  writer.writeEndDocument();
  
  return writer.getXmlString();
}

// 사용법
console.log('생성된 XML:', createAdvancedXml());
```

##### 새로운 통합 WriteElementOptions API

StaxXmlWriter는 이제 모든 옵션을 단일 `WriteElementOptions` 객체로 통합하여 엘리먼트 생성을 단순화하는 새로운 통합 API를 지원합니다:

```typescript
import { StaxXmlWriter, WriteElementOptions } from 'stax-xml';

function createXmlWithNewAPI() {
  const writer = new StaxXmlWriter({ prettyPrint: true });

  writer.writeStartDocument();
  
  // 속성이 있는 기본 엘리먼트
  writer.writeStartElement('catalog', {
    attributes: { version: '2.0', xmlns: 'http://example.com/catalog' }
  });
  
  // 네임스페이스와 속성이 있는 엘리먼트
  writer.writeStartElement('product', {
    prefix: 'cat',
    uri: 'http://example.com/catalog',
    attributes: { id: '001', featured: 'true' }
  });
  
  writer.writeStartElement('name');
  writer.writeCharacters('Premium Laptop');
  writer.writeEndElement();
  
  // 속성이 있는 자체 닫는 엘리먼트
  writer.writeStartElement('thumbnail', {
    attributes: {
      src: 'image.jpg',
      alt: 'Product Image',
      width: '200'
    },
    selfClosing: true  // writeEndElement() 호출 불필요
  });
  
  // 간단한 자체 닫는 엘리먼트
  writer.writeStartElement('br', { selfClosing: true });
  
  writer.writeEndElement(); // product
  writer.writeEndElement(); // catalog
  
  writer.writeEndDocument();
  return writer.getXmlString();
}

// Output:
// <?xml version="1.0" encoding="UTF-8"?>
// <catalog version="2.0" xmlns="http://example.com/catalog">
//   <cat:product id="001" featured="true" xmlns:cat="http://example.com/catalog">
//     <name>Premium Laptop</name>
//     <thumbnail src="image.jpg" alt="Product Image" width="200"/>
//     <br/>
//   </cat:product>
// </catalog>
```

**통합 API의 주요 장점:**

- **통합된 매개변수**: 모든 엘리먼트 옵션(속성, 네임스페이스, 자체 닫기)이 단일 옵션 객체로 통합됨
- **자체 닫기 지원**: `selfClosing: true`로 설정하여 `writeEndElement()` 호출 없이 자동으로 엘리먼트 닫기
- **깔끔한 구문**: 더 직관적이고 읽기 쉬운 코드 구조
- **타입 안전성**: 포괄적인 타입 정의와 함께 완전한 TypeScript 지원

**사용 예제:**

```typescript
// 속성이 있는 간단한 엘리먼트
writer.writeStartElement('img', {
  attributes: {
    src: 'image.jpg',
    alt: 'Image'
  },
  selfClosing: true
});

// 네임스페이스가 있는 엘리먼트
writer.writeStartElement('title', {
  prefix: 'html',
  uri: 'http://www.w3.org/1999/xhtml',
  attributes: { lang: 'en' }
});
```

### 📚 API 참조

```typescript
class StaxXmlWriter {
  constructor(
    options?: StaxXmlWriterOptions
  )

  // 문서 레벨 메서드
  writeStartDocument(version?: string, encoding?: string): this
  writeEndDocument(): void

  // 엘리먼트 작성 메서드
  writeStartElement(localName: string, options?: WriteElementOptions): this
  writeEndElement(): this

  // 속성 및 네임스페이스 메서드
  writeAttribute(localName: string, value: string, prefix?: string, uri?: string): this
  writeNamespace(prefix: string, uri: string): this

  // 콘텐츠 작성 메서드
  writeCharacters(text: string): this
  writeCDATA(cdata: string): this
  writeComment(comment: string): this
  writeProcessingInstruction(target: string, data?: string): this

  // 유틸리티 메서드
  setPrettyPrint(enabled: boolean): this
  setIndentString(indentString: string): this
  isPrettyPrintEnabled(): boolean
  getIndentString(): string
}

interface StaxXmlWriterOptions {
  encoding?: string; // 기본값: 'utf-8'
  prettyPrint?: boolean; // 기본값: false
  indentString?: string; // 기본값: '  '
  addEntities?: { entity: string, value: string }[];
  autoEncodeEntities?: boolean; // 기본값: true
  namespaces?: NamespaceDeclaration[];
}

interface XmlAttribute {
  localName: string;
  value: string;
  prefix?: string;
  uri?: string;
}

interface NamespaceDeclaration {
  prefix?: string;
  uri: string;
}
```
