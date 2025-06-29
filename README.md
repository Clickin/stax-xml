# StAX-XML

[English](#english) | [한국어](#korean)

---

## English

A high-performance, pull-based XML parser for JavaScript/TypeScript inspired by Java's StAX (Streaming API for XML). Unlike traditional XML-to-JSON mappers, StAX-XML allows you to map XML data to any custom structure you desire while efficiently handling large XML files.

### 🚀 Features

- **Pull-based Parsing**: Stream-based approach for memory-efficient processing of large XML files
- **Custom Mapping**: Map XML data to any structure you want, not just plain JSON objects
- **High Performance**: Optimized for speed and low memory usage
- **Universal Compatibility**: Works in Node.js, Bun, Deno, and web browsers using only Web Standard APIs
- **Namespace Support**: Basic XML namespace handling
- **Entity Support**: Built-in entity decoding with custom entity support
- **TypeScript Ready**: Full TypeScript support with comprehensive type definitions

### 📦 Installation

```bash
# npm
npm install stax-xml
# yarn
yarn add stax-xml
# pnpm
pnpm add stax-xml
# bun
bun add stax-xml
# deno
deno add npm:stax-xml
```

### 🔧 Quick Start

#### Parsing XML String

```typescript
import { StaxXmlParser, XmlEventType } from 'stax-xml';

// Create a ReadableStream from XML string
const xmlContent = `
  <books>
    <book id="1">
      <title>The Great Gatsby</title>
      <author>F. Scott Fitzgerald</author>
    </book>
    <book id="2">
      <title>To Kill a Mockingbird</title>
      <author>Harper Lee</author>
    </book>
  </books>
`;

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlContent));
    controller.close();
  }
});

// Parse XML with pull-based approach
const parser = new StaxXmlParser(stream);
const books = [];
let currentBook = null;
let currentText = '';

for await (const event of parser) {
  switch (event.type) {
    case XmlEventType.START_ELEMENT:
      if (event.name === 'book') {
        currentBook = { id: event.attributes?.id || '', title: '', author: '' };
      }
      currentText = '';
      break;
      
    case XmlEventType.CHARACTERS:
      currentText += event.data;
      break;
      
    case XmlEventType.END_ELEMENT:
      if (currentBook) {
        if (event.name === 'title') {
          currentBook.title = currentText.trim();
        } else if (event.name === 'author') {
          currentBook.author = currentText.trim();
        } else if (event.name === 'book') {
          books.push(currentBook);
          currentBook = null;
        }
      }
      break;
  }
}

console.log(books);
// Output: [
//   { id: "1", title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
//   { id: "2", title: "To Kill a Mockingbird", author: "Harper Lee" }
// ]
```

#### Parsing Remote XML with Fetch

```typescript
import { StaxXmlParser, XmlEventType } from 'stax-xml';

async function parseRemoteXml(url: string) {
  try {
    // Fetch XML from remote URL
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Get the response body as a ReadableStream
    const xmlStream = response.body;
    
    if (!xmlStream) {
      throw new Error('No response body');
    }
    
    // Parse the XML stream directly
    const parser = new StaxXmlParser(xmlStream);
    const results = [];
    let currentItem = {};
    let currentText = '';
    
    for await (const event of parser) {
      switch (event.type) {
        case XmlEventType.START_ELEMENT:
          if (event.name === 'item') {
            currentItem = {};
          }
          currentText = '';
          break;
          
        case XmlEventType.CHARACTERS:
          currentText += event.data;
          break;
          
        case XmlEventType.END_ELEMENT:
          if (event.name === 'title' || event.name === 'description') {
            currentItem[event.name] = currentText.trim();
          } else if (event.name === 'item') {
            results.push(currentItem);
          }
          break;
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error parsing remote XML:', error);
    throw error;
  }
}

// Usage examples
const rssUrl = 'https://example.com/feed.xml';
const xmlApiUrl = 'https://api.example.com/data.xml';

// Parse RSS feed
parseRemoteXml(rssUrl)
  .then(items => {
    console.log('RSS items:', items);
  })
  .catch(error => {
    console.error('Failed to parse RSS:', error);
  });

// Parse API response
parseRemoteXml(xmlApiUrl)
  .then(data => {
    console.log('API data:', data);
  })
  .catch(error => {
    console.error('Failed to parse API response:', error);
  });
```

### 🌐 Platform Compatibility

StAX-XML uses only Web Standard APIs, making it compatible with:

- **Node.js** (v18+)
- **Bun** (any version)
- **Deno** (any version)
- **Web Browsers** (modern browsers)
- **Edge Runtime** (Vercel, Cloudflare Workers, etc.)

### ⚡ Advanced Usage

#### StaxXmlWriter - Creating XML Documents

StAX-XML also includes a powerful XML writer that allows you to generate XML documents programmatically.

##### Writing to Local File

```typescript
import { StaxXmlWriter } from 'stax-xml';
import { createWriteStream } from 'fs';

// For Node.js - create a WritableStream from fs
async function createLocalXmlFile() {
  const fileStream = createWriteStream('./output.xml');
  
  // Convert Node.js WriteStream to Web Standard WritableStream
  const writableStream = new WritableStream<Uint8Array>({
    write(chunk) {
      fileStream.write(chunk);
    },
    close() {
      fileStream.end();
    }
  });

  const writer = new StaxXmlWriter(writableStream, {
    prettyPrint: true,
    indentString: '  '
  });

  // Write XML document
  writer.writeStartDocument('1.0', 'utf-8');
  
  writer.writeStartElement('catalog', undefined, undefined, { version: '1.0' });
  
  writer.writeStartElement('product', undefined, undefined, { id: '001' });
  
  writer.writeStartElement('name');
  writer.writeCharacters('Laptop Computer');
  writer.writeEndElement();
  
  writer.writeStartElement('price', undefined, undefined, { currency: 'USD' });
  writer.writeCharacters('999.99');
  writer.writeEndElement();
  
  writer.writeEndElement(); // product
  writer.writeEndElement(); // catalog
  
  await writer.writeEndDocument();
  console.log('XML file created successfully!');
}

createLocalXmlFile();
```

##### Express.js Middleware - XML Response

```typescript
import express from 'express';
import { StaxXmlWriter } from 'stax-xml';

const app = express();

// Middleware to create XML response
app.get('/api/users', async (req, res) => {
  try {
    // Sample data
    const users = [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
    ];

    // Create a WritableStream that writes to Express response
    const writableStream = new WritableStream<Uint8Array>({
      write(chunk) {
        res.write(chunk);
      },
      close() {
        res.end();
      }
    });

    const writer = new StaxXmlWriter(writableStream, {
      prettyPrint: true,
      indentString: '  '
    });

    // Set appropriate headers
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    // Write XML
    writer.writeStartDocument('1.0', 'utf-8');
    writer.writeStartElement('users');
    
    for (const user of users) {
      writer.writeStartElement('user', undefined, undefined, { id: user.id.toString() });
      
      writer.writeStartElement('name');
      writer.writeCharacters(user.name);
      writer.writeEndElement();
      
      writer.writeStartElement('email');
      writer.writeCharacters(user.email);
      writer.writeEndElement();
      
      writer.writeEndElement(); // user
    }
    
    writer.writeEndElement(); // users
    await writer.writeEndDocument();
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate XML' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

##### Hono Framework - Streaming XML Response

```typescript
import { Hono } from 'hono';
import { StaxXmlWriter } from 'stax-xml';

const app = new Hono();

app.get('/api/products', async (c) => {
  // Sample product data
  const products = [
    { id: 'P001', name: 'Smartphone', price: 699.99, category: 'Electronics' },
    { id: 'P002', name: 'Headphones', price: 199.99, category: 'Electronics' },
    { id: 'P003', name: 'Coffee Maker', price: 149.99, category: 'Appliances' }
  ];

  // Create ReadableStream for streaming response
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Create a WritableStream that enqueues data to the controller
      const writableStream = new WritableStream<Uint8Array>({
        write(chunk) {
          controller.enqueue(chunk);
        },
        close() {
          controller.close();
        },
        abort(reason) {
          controller.error(reason);
        }
      });

      const writer = new StaxXmlWriter(writableStream, {
        prettyPrint: true,
        indentString: '    '
      });

      try {
        // Generate XML
        writer.writeStartDocument('1.0', 'utf-8');
        writer.writeStartElement('products', undefined, undefined, {
          count: products.length.toString(),
          generated: new Date().toISOString()
        });
        
        for (const product of products) {
          writer.writeStartElement('product', undefined, undefined, {
            id: product.id,
            category: product.category
          });
          
          writer.writeStartElement('name');
          writer.writeCharacters(product.name);
          writer.writeEndElement();
          
          writer.writeStartElement('price', undefined, undefined, { currency: 'USD' });
          writer.writeCharacters(product.price.toString());
          writer.writeEndElement();
          
          writer.writeEndElement(); // product
        }
        
        writer.writeEndElement(); // products
        await writer.writeEndDocument();
        
      } catch (error) {
        controller.error(error);
      }
    }
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked'
    }
  });
});

export default app;
```

##### Advanced Writer Features

```typescript
import { StaxXmlWriter } from 'stax-xml';

// Create in-memory XML with custom entities and namespaces
async function createAdvancedXml() {
  let xmlOutput = '';
  
  const writableStream = new WritableStream<Uint8Array>({
    write(chunk) {
      xmlOutput += new TextDecoder().decode(chunk);
    }
  });

  const writer = new StaxXmlWriter(writableStream, {
    prettyPrint: true,
    indentString: '  ',
    addEntities: [
      { entity: 'company', value: 'Acme Corporation' },
      { entity: 'copyright', value: '© 2024' }
    ],
    autoEncodeEntities: true
  });

  // Write XML with namespaces and custom entities
  writer.writeStartDocument('1.0', 'utf-8');
  
  writer.writeStartElement('document', 'doc', 'http://example.com/document', { version: '2.0' });
  writer.writeNamespace('meta', 'http://example.com/metadata');
  
  writer.writeStartElement('header', 'meta');
  writer.writeStartElement('title');
  writer.writeCharacters('Product Catalog');
  writer.writeEndElement();
  
  writer.writeStartElement('company');
  writer.writeCharacters('&company;'); // Will be encoded automatically
  writer.writeEndElement();
  writer.writeEndElement(); // header
  
  writer.writeStartElement('content');
  writer.writeStartElement('item', undefined, undefined, { type: 'featured' });
  
  // Self-closing element
  writer.writeStartElement('thumbnail', undefined, undefined, {
    src: 'image.jpg',
    alt: 'Product Image'
  });
  writer.writeEndElementSelfClosing();
  
  writer.writeStartElement('description');
  writer.writeCDATA('<p>This is <b>HTML</b> content in CDATA</p>');
  writer.writeEndElement();
  
  writer.writeEndElement(); // item
  writer.writeEndElement(); // content
  writer.writeEndElement(); // document
  
  await writer.writeEndDocument();
  
  return xmlOutput;
}

// Usage
createAdvancedXml().then(xml => {
  console.log('Generated XML:', xml);
});
```

#### Custom Entity Support

```typescript
const parser = new StaxXmlParser(stream, {
  addEntities: [
    { entity: 'custom', value: 'Custom Value' },
    { entity: 'special', value: '★' }
  ]
});
```

#### Large File Processing

```typescript
// Efficient processing of large XML files
const parser = new StaxXmlParser(largeXmlStream, {
  maxBufferSize: 128 * 1024, // 128KB buffer
  enableBufferCompaction: true
});

// Process events as they come, without loading entire file into memory
for await (const event of parser) {
  // Handle each event individually
  processEvent(event);
}
```

#### Namespace Handling

```typescript
// XML with namespaces
const xmlWithNamespaces = `
  <root xmlns:ns="http://example.com/namespace">
    <ns:element>Content</ns:element>
  </root>
`;

for await (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log('Element:', event.name);
    console.log('Local name:', event.localName);
    console.log('Namespace URI:', event.uri);
    console.log('Prefix:', event.prefix);
  }
}
```

### 🎯 Event Types

- `START_DOCUMENT`: Beginning of XML document
- `END_DOCUMENT`: End of XML document
- `START_ELEMENT`: Opening XML tag
- `END_ELEMENT`: Closing XML tag
- `CHARACTERS`: Text content between tags
- `CDATA`: CDATA section content
- `ERROR`: Parse error occurred

### 📚 API Reference

#### StaxXmlParser

```typescript
class StaxXmlParser {
  constructor(
    xmlStream: ReadableStream<Uint8Array>,
    options?: StaxXmlParserOptions
  )
}

interface StaxXmlParserOptions {
  encoding?: string; // Default: 'utf-8'
  addEntities?: { entity: string, value: string }[];
  autoDecodeEntities?: boolean; // Default: true
  maxBufferSize?: number; // Default: 64KB
  enableBufferCompaction?: boolean; // Default: true
}
```

#### StaxXmlWriter

```typescript
class StaxXmlWriter {
  constructor(
    outputStream: WritableStream<Uint8Array>,
    options?: StaxXmlWriterOptions
  )

  // Document Level Methods
  writeStartDocument(version?: string, encoding?: string): this
  writeEndDocument(): Promise<void>

  // Element Writing Methods
  writeStartElement(localName: string, prefix?: string, uri?: string, 
                   attributes?: { [key: string]: string }): this
  writeEndElement(): this
  writeEndElementSelfClosing(): this
  writeEmptyElement(localName: string, prefix?: string, uri?: string, 
                   attributes?: XmlAttribute[], namespaces?: NamespaceDeclaration[]): this

  // Attribute and Namespace Methods
  writeAttribute(localName: string, value: string, prefix?: string, uri?: string): this
  writeNamespace(prefix: string, uri: string): this

  // Content Writing Methods
  writeCharacters(text: string): this
  writeCDATA(cdata: string): this
  writeComment(comment: string): this
  writeProcessingInstruction(target: string, data?: string): this

  // Utility Methods
  setPrettyPrint(enabled: boolean): this
  setIndentString(indentString: string): this
  isPrettyPrintEnabled(): boolean
  getIndentString(): string
}

interface StaxXmlWriterOptions {
  encoding?: string; // Default: 'utf-8'
  prettyPrint?: boolean; // Default: false
  indentString?: string; // Default: '  '
  addEntities?: { entity: string, value: string }[];
  autoEncodeEntities?: boolean; // Default: true
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

### 🧪 Testing

```bash
bun test
```

### 📄 License

MIT

### 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## Korean

Java의 StAX(Streaming API for XML)에서 영감을 받은 고성능 pull 방식의 JavaScript/TypeScript XML 파서입니다. 기존의 XML-JSON 매퍼와 달리, StAX-XML을 사용하면 XML 데이터를 원하는 임의의 구조로 매핑할 수 있으며, 큰 XML 파일도 효율적으로 처리할 수 있습니다.

### 🚀 주요 기능

- **Pull 방식 파싱**: 대용량 XML 파일의 메모리 효율적 처리를 위한 스트림 기반 접근
- **사용자 정의 매핑**: 단순한 JSON 객체가 아닌 원하는 구조로 XML 데이터 매핑 가능
- **고성능**: 속도와 낮은 메모리 사용량에 최적화
- **범용 호환성**: 웹 표준 API만 사용하여 Node.js, Bun, Deno, 웹 브라우저에서 모두 동작
- **네임스페이스 지원**: 기본적인 XML 네임스페이스 처리
- **엔티티 지원**: 내장 엔티티 디코딩 및 사용자 정의 엔티티 지원
- **TypeScript 지원**: 포괄적인 타입 정의로 완전한 TypeScript 지원

### 📦 설치

```bash
# npm
npm install stax-xml
# yarn
yarn add stax-xml
# pnpm
pnpm add stax-xml
# bun
bun add stax-xml
# deno
deno add npm:stax-xml
```

### 🔧 빠른 시작

#### XML 문자열 파싱

```typescript
import { StaxXmlParser, XmlEventType } from 'stax-xml';

// XML 문자열로부터 ReadableStream 생성
const xmlContent = `
  <books>
    <book id="1">
      <title>위대한 개츠비</title>
      <author>F. 스콧 피츠제럴드</author>
    </book>
    <book id="2">
      <title>앵무새 죽이기</title>
      <author>하퍼 리</author>
    </book>
  </books>
`;

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(xmlContent));
    controller.close();
  }
});

// Pull 방식으로 XML 파싱
const parser = new StaxXmlParser(stream);
const books = [];
let currentBook = null;
let currentText = '';

for await (const event of parser) {
  switch (event.type) {
    case XmlEventType.START_ELEMENT:
      if (event.name === 'book') {
        currentBook = { id: event.attributes?.id || '', title: '', author: '' };
      }
      currentText = '';
      break;
      
    case XmlEventType.CHARACTERS:
      currentText += event.data;
      break;
      
    case XmlEventType.END_ELEMENT:
      if (currentBook) {
        if (event.name === 'title') {
          currentBook.title = currentText.trim();
        } else if (event.name === 'author') {
          currentBook.author = currentText.trim();
        } else if (event.name === 'book') {
          books.push(currentBook);
          currentBook = null;
        }
      }
      break;
  }
}

console.log(books);
// 출력: [
//   { id: "1", title: "위대한 개츠비", author: "F. 스콧 피츠제럴드" },
//   { id: "2", title: "앵무새 죽이기", author: "하퍼 리" }
// ]
```

#### Fetch로 원격 XML 파싱

```typescript
import { StaxXmlParser, XmlEventType } from 'stax-xml';

async function parseRemoteXml(url: string) {
  try {
    // 원격 URL에서 XML 가져오기
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP 오류! 상태: ${response.status}`);
    }
    
    // 응답 본문을 ReadableStream으로 가져오기
    const xmlStream = response.body;
    
    if (!xmlStream) {
      throw new Error('응답 본문이 없습니다');
    }
    
    // XML 스트림을 직접 파싱
    const parser = new StaxXmlParser(xmlStream);
    const results = [];
    let currentItem = {};
    let currentText = '';
    
    for await (const event of parser) {
      switch (event.type) {
        case XmlEventType.START_ELEMENT:
          if (event.name === 'item') {
            currentItem = {};
          }
          currentText = '';
          break;
          
        case XmlEventType.CHARACTERS:
          currentText += event.data;
          break;
          
        case XmlEventType.END_ELEMENT:
          if (event.name === 'title' || event.name === 'description') {
            currentItem[event.name] = currentText.trim();
          } else if (event.name === 'item') {
            results.push(currentItem);
          }
          break;
      }
    }
    
    return results;
  } catch (error) {
    console.error('원격 XML 파싱 오류:', error);
    throw error;
  }
}

// 사용 예제
const rssUrl = 'https://example.com/feed.xml';
const xmlApiUrl = 'https://api.example.com/data.xml';

// RSS 피드 파싱
parseRemoteXml(rssUrl)
  .then(items => {
    console.log('RSS 항목:', items);
  })
  .catch(error => {
    console.error('RSS 파싱 실패:', error);
  });

// API 응답 파싱
parseRemoteXml(xmlApiUrl)
  .then(data => {
    console.log('API 데이터:', data);
  })
  .catch(error => {
    console.error('API 응답 파싱 실패:', error);
  });
```

### 🌐 플랫폼 호환성

StAX-XML은 웹 표준 API만을 사용하여 다음 환경에서 동작합니다:

- **Node.js** (v18+)
- **Bun** (모든 버전)
- **Deno** (모든 버전)
- **웹 브라우저** (최신 브라우저)
- **Edge Runtime** (Vercel, Cloudflare Workers 등)

### ⚡ 고급 사용법

#### StaxXmlWriter - XML 문서 생성

StAX-XML은 프로그래밍 방식으로 XML 문서를 생성할 수 있는 강력한 XML 작성기도 포함하고 있습니다.

##### 로컬 파일 생성

```typescript
import { StaxXmlWriter } from 'stax-xml';
import { createWriteStream } from 'fs';

// Node.js용 - fs에서 WritableStream 생성
async function createLocalXmlFile() {
  const fileStream = createWriteStream('./output.xml');
  
  // Node.js WriteStream을 웹 표준 WritableStream으로 변환
  const writableStream = new WritableStream<Uint8Array>({
    write(chunk) {
      fileStream.write(chunk);
    },
    close() {
      fileStream.end();
    }
  });

  const writer = new StaxXmlWriter(writableStream, {
    prettyPrint: true,
    indentString: '  '
  });

  // XML 문서 작성
  writer.writeStartDocument('1.0', 'utf-8');
  
  writer.writeStartElement('catalog', undefined, undefined, { version: '1.0' });
  
  writer.writeStartElement('product', undefined, undefined, { id: '001' });
  
  writer.writeStartElement('name');
  writer.writeCharacters('노트북 컴퓨터');
  writer.writeEndElement();
  
  writer.writeStartElement('price', undefined, undefined, { currency: 'KRW' });
  writer.writeCharacters('1299000');
  writer.writeEndElement();
  
  writer.writeEndElement(); // product
  writer.writeEndElement(); // catalog
  
  await writer.writeEndDocument();
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
app.get('/api/users', async (req, res) => {
  try {
    // 샘플 데이터
    const users = [
      { id: 1, name: '김철수', email: 'kim@example.com' },
      { id: 2, name: '이영희', email: 'lee@example.com' }
    ];

    // Express 응답에 쓰는 WritableStream 생성
    const writableStream = new WritableStream<Uint8Array>({
      write(chunk) {
        res.write(chunk);
      },
      close() {
        res.end();
      }
    });

    const writer = new StaxXmlWriter(writableStream, {
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
      writer.writeStartElement('user', undefined, undefined, { id: user.id.toString() });
      
      writer.writeStartElement('name');
      writer.writeCharacters(user.name);
      writer.writeEndElement();
      
      writer.writeStartElement('email');
      writer.writeCharacters(user.email);
      writer.writeEndElement();
      
      writer.writeEndElement(); // user
    }
    
    writer.writeEndElement(); // users
    await writer.writeEndDocument();
    
  } catch (error) {
    res.status(500).json({ error: 'XML 생성에 실패했습니다' });
  }
});

app.listen(3000, () => {
  console.log('서버가 포트 3000에서 실행 중입니다');
});
```

##### Hono 프레임워크 - 스트리밍 XML 응답

```typescript
import { Hono } from 'hono';
import { StaxXmlWriter } from 'stax-xml';

const app = new Hono();

app.get('/api/products', async (c) => {
  // 샘플 제품 데이터
  const products = [
    { id: 'P001', name: '스마트폰', price: 899000, category: '전자기기' },
    { id: 'P002', name: '헤드폰', price: 259000, category: '전자기기' },
    { id: 'P003', name: '커피메이커', price: 189000, category: '가전제품' }
  ];

  // 스트리밍 응답용 ReadableStream 생성
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      // 컨트롤러에 데이터를 큐잉하는 WritableStream 생성
      const writableStream = new WritableStream<Uint8Array>({
        write(chunk) {
          controller.enqueue(chunk);
        },
        close() {
          controller.close();
        },
        abort(reason) {
          controller.error(reason);
        }
      });

      const writer = new StaxXmlWriter(writableStream, {
        prettyPrint: true,
        indentString: '    '
      });

      try {
        // XML 생성
        writer.writeStartDocument('1.0', 'utf-8');
        writer.writeStartElement('products', undefined, undefined, {
          count: products.length.toString(),
          generated: new Date().toISOString()
        });
        
        for (const product of products) {
          writer.writeStartElement('product', undefined, undefined, {
            id: product.id,
            category: product.category
          });
          
          writer.writeStartElement('name');
          writer.writeCharacters(product.name);
          writer.writeEndElement();
          
          writer.writeStartElement('price', undefined, undefined, { currency: 'KRW' });
          writer.writeCharacters(product.price.toString());
          writer.writeEndElement();
          
          writer.writeEndElement(); // product
        }
        
        writer.writeEndElement(); // products
        await writer.writeEndDocument();
        
      } catch (error) {
        controller.error(error);
      }
    }
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked'
    }
  });
});

export default app;
```

##### 고급 Writer 기능

```typescript
import { StaxXmlWriter } from 'stax-xml';

// 사용자 정의 엔티티와 네임스페이스를 사용한 메모리 내 XML 생성
async function createAdvancedXml() {
  let xmlOutput = '';
  
  const writableStream = new WritableStream<Uint8Array>({
    write(chunk) {
      xmlOutput += new TextDecoder().decode(chunk);
    }
  });

  const writer = new StaxXmlWriter(writableStream, {
    prettyPrint: true,
    indentString: '  ',
    addEntities: [
      { entity: 'company', value: '아크메 코퍼레이션' },
      { entity: 'copyright', value: '© 2024' }
    ],
    autoEncodeEntities: true
  });

  // 네임스페이스와 사용자 정의 엔티티가 포함된 XML 작성
  writer.writeStartDocument('1.0', 'utf-8');
  
  writer.writeStartElement('document', 'doc', 'http://example.com/document', { version: '2.0' });
  writer.writeNamespace('meta', 'http://example.com/metadata');
  
  writer.writeStartElement('header', 'meta');
  writer.writeStartElement('title');
  writer.writeCharacters('제품 카탈로그');
  writer.writeEndElement();
  
  writer.writeStartElement('company');
  writer.writeCharacters('&company;'); // 자동으로 인코딩됩니다
  writer.writeEndElement();
  writer.writeEndElement(); // header
  
  writer.writeStartElement('content');
  writer.writeStartElement('item', undefined, undefined, { type: 'featured' });
  
  // Self-closing 요소
  writer.writeStartElement('thumbnail', undefined, undefined, {
    src: 'image.jpg',
    alt: '제품 이미지'
  });
  writer.writeEndElementSelfClosing();
  
  writer.writeStartElement('description');
  writer.writeCDATA('<p>이것은 CDATA 내의 <b>HTML</b> 콘텐츠입니다</p>');
  writer.writeEndElement();
  
  writer.writeEndElement(); // item
  writer.writeEndElement(); // content
  writer.writeEndElement(); // document
  
  await writer.writeEndDocument();
  
  return xmlOutput;
}

// 사용법
createAdvancedXml().then(xml => {
  console.log('생성된 XML:', xml);
});
```

#### 사용자 정의 엔티티 지원

```typescript
const parser = new StaxXmlParser(stream, {
  addEntities: [
    { entity: 'custom', value: '사용자 정의 값' },
    { entity: 'special', value: '★' }
  ]
});
```

#### 대용량 파일 처리

```typescript
// 대용량 XML 파일의 효율적 처리
const parser = new StaxXmlParser(largeXmlStream, {
  maxBufferSize: 128 * 1024, // 128KB 버퍼
  enableBufferCompaction: true
});

// 전체 파일을 메모리에 로드하지 않고 이벤트를 순차적으로 처리
for await (const event of parser) {
  // 각 이벤트를 개별적으로 처리
  processEvent(event);
}
```

#### 네임스페이스 처리

```typescript
// 네임스페이스가 있는 XML
const xmlWithNamespaces = `
  <root xmlns:ns="http://example.com/namespace">
    <ns:element>내용</ns:element>
  </root>
`;

for await (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log('요소명:', event.name);
    console.log('로컬명:', event.localName);
    console.log('네임스페이스 URI:', event.uri);
    console.log('접두사:', event.prefix);
  }
}
```

### 🎯 이벤트 타입

- `START_DOCUMENT`: XML 문서 시작
- `END_DOCUMENT`: XML 문서 끝
- `START_ELEMENT`: XML 시작 태그
- `END_ELEMENT`: XML 끝 태그
- `CHARACTERS`: 태그 사이의 텍스트 내용
- `CDATA`: CDATA 섹션 내용
- `ERROR`: 파싱 오류 발생

### 📚 API 참조

#### StaxXmlParser

```typescript
class StaxXmlParser {
  constructor(
    xmlStream: ReadableStream<Uint8Array>,
    options?: StaxXmlParserOptions
  )
}

interface StaxXmlParserOptions {
  encoding?: string; // 기본값: 'utf-8'
  addEntities?: { entity: string, value: string }[];
  autoDecodeEntities?: boolean; // 기본값: true
  maxBufferSize?: number; // 기본값: 64KB
  enableBufferCompaction?: boolean; // 기본값: true
}
```

#### StaxXmlWriter

```typescript
class StaxXmlWriter {
  constructor(
    outputStream: WritableStream<Uint8Array>,
    options?: StaxXmlWriterOptions
  )

  // 문서 레벨 메서드
  writeStartDocument(version?: string, encoding?: string): this
  writeEndDocument(): Promise<void>

  // 요소 작성 메서드
  writeStartElement(localName: string, prefix?: string, uri?: string, 
                   attributes?: { [key: string]: string }): this
  writeEndElement(): this
  writeEndElementSelfClosing(): this
  writeEmptyElement(localName: string, prefix?: string, uri?: string, 
                   attributes?: XmlAttribute[], namespaces?: NamespaceDeclaration[]): this

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

### 🧪 테스트

```bash
bun test
```

### 📄 라이선스

MIT

### 🤝 기여하기

기여를 환영합니다! Pull Request를 자유롭게 제출해 주세요.
