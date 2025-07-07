## StaxXmlParser - Asynchronous XML Parsing

`StaxXmlParser` is a high-performance, pull-based XML parser for JavaScript/TypeScript inspired by Java's StAX (Streaming API for XML). All parsing operations are fully asynchronous, making it ideal for handling large XML files without blocking the main thread.

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
