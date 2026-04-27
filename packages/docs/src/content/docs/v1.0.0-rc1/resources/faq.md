---
title: StAX-XML FAQ - JavaScript XML Parser Questions & Answers
description: Comprehensive FAQ covering StAX-XML usage, troubleshooting, performance optimization, and best practices for JavaScript XML parsing.
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/resources/faq.png
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
      content: https://clickin.github.io/stax-xml/og/resources/faq.png
slug: v1.0.0-rc1/resources/faq
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is StAX-XML and how does it differ from other XML parsers?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "StAX-XML is a high-performance, pull-based XML parser for JavaScript/TypeScript providing both synchronous and asynchronous parsing. Unlike DOM parsers, it offers memory-efficient streaming, cross-platform compatibility, and event-driven processing for better performance."
      }
    },
    {
      "@type": "Question",
      "name": "When should I use synchronous vs asynchronous XML parsing?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Use StaxXmlParserSync for documents under 10MB or when you have the full XML string in memory for maximum performance. Use StaxXmlParser for large files, streaming scenarios, web applications, or when processing from ReadableStreams."
      }
    },
    {
      "@type": "Question",
      "name": "Does StAX-XML work in web browsers and Node.js?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes! StAX-XML uses Web Standard APIs and works in all modern browsers, Node.js, Bun, Deno, and edge runtimes like Cloudflare Workers. No additional configuration needed."
      }
    },
    {
      "@type": "Question",
      "name": "How do I handle large XML files without memory issues?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Use the asynchronous StaxXmlParser with streaming. It processes XML events one by one without loading the entire document into memory, maintaining constant memory usage regardless of file size."
      }
    },
    {
      "@type": "Question",
      "name": "How do I convert XML to JSON with StAX-XML?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Create a converter that processes START_ELEMENT, CHARACTERS, and END_ELEMENT events to build a JSON structure. Process events sequentially while maintaining a stack to track nested elements and their content."
      }
    }
  ]
}
</script>

## General Questions

### What is StAX-XML?

StAX-XML is a high-performance, pull-based XML parser for JavaScript/TypeScript that provides both synchronous and asynchronous parsing capabilities. It's designed to work across all JavaScript runtimes (Node.js, Bun, Deno, browsers) using only Web Standard APIs.

### How does StAX-XML differ from other XML parsers?

- **Pull-based parsing**: You control the parsing flow, processing one event at a time
- **Memory efficient**: Constant memory usage for streaming, no need to load entire document
- **High performance**: Optimized for speed with minimal object allocation
- **Cross-platform**: Works in browsers, Node.js, Bun, Deno, and edge runtimes
- **Both sync and async**: Choose the right approach for your use case

### When should I use the synchronous vs asynchronous parser?

- **StaxXmlParserSync**: Use for documents <10MB, when you have the full XML string in memory, or when you need maximum performance
- **StaxXmlParser**: Use for large files, streaming scenarios, web applications (non-blocking), or when processing from ReadableStreams

## Installation and Setup

### Which package manager should I use?

StAX-XML works with all package managers:

```bash
npm install stax-xml     # npm
yarn add stax-xml        # yarn
pnpm add stax-xml        # pnpm
bun add stax-xml         # bun
deno add npm:stax-xml    # deno
```

StAX-XML is published as an **ESM-only package**. Use `import { ... } from 'stax-xml'`; `require('stax-xml')` is not supported.

### Does StAX-XML work in browsers?

Yes! StAX-XML uses only Web Standard APIs, so it works in all modern browsers. You can use it with any bundler (Webpack, Vite, Rollup, etc.) or directly in browser environments.

### What TypeScript version is required?

StAX-XML works with TypeScript 4.5+ and includes full type definitions. No additional `@types` packages are needed.

## Parsing Questions

### How do I handle XML with namespaces?

StAX-XML automatically handles namespaces. Access namespace information through event properties:

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

for (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log('Element name:', event.name);           // Full name with prefix
    console.log('Local name:', event.localName);        // Name without prefix
    console.log('Namespace URI:', event.namespaceURI);  // Namespace URI
    console.log('Prefix:', event.prefix);               // Namespace prefix
  }
}
```

### How do I convert XML to JSON?

Here's a simple XML-to-JSON converter:

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

### How do I handle large XML files without running out of memory?

Use the asynchronous parser with streaming:

```typescript
import { StaxXmlParser, XmlEventType } from 'stax-xml';

async function processLargeXml(stream: ReadableStream<Uint8Array>) {
  const parser = new StaxXmlParser(stream);

  // Process events one by one without storing them all
  for await (const event of parser) {
    if (event.type === XmlEventType.START_ELEMENT) {
      // Process immediately, don't store
      await processElement(event);
    }
  }
}
```

### Why am I getting empty text events?

XML often contains whitespace between elements. Filter empty text:

```typescript
for (const event of parser) {
  if (event.type === XmlEventType.CHARACTERS) {
    const text = event.text.trim();
    if (text) {
      // Only process non-empty text
      console.log('Text:', text);
    }
  }
}
```

## Error Handling

### How do I handle malformed XML?

StAX-XML generates error events for invalid XML:

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

const parser = new StaxXmlParserSync(malformedXml);

for (const event of parser) {
  if (event.type === XmlEventType.ERROR) {
    console.error('Parse error:', event.message);
    console.error('Position:', event.position);
    // Handle the error - stop parsing or continue
    break;
  }
}
```

### What should I do when parsing fails?

1. **Check the XML syntax** - ensure it's well-formed
2. **Handle encoding issues** - StAX-XML expects UTF-8
3. **Validate input sources** - ensure ReadableStreams are properly configured
4. **Use try-catch** for synchronous parsing:

```typescript
try {
  const parser = new StaxXmlParserSync(xmlString);
  for (const event of parser) {
    // Process events
  }
} catch (error) {
  console.error('Parsing failed:', error.message);
}
```

### How do I validate XML structure while parsing?

Implement validation in your event handler:

```typescript
function validateXmlStructure(xmlString: string): boolean {
  const parser = new StaxXmlParserSync(xmlString);
  const elementStack: string[] = [];

  for (const event of parser) {
    switch (event.type) {
      case XmlEventType.START_ELEMENT:
        elementStack.push(event.name);

        // Custom validation rules
        if (event.name === 'book' && !event.attributes?.id) {
          throw new Error('Book element must have an id attribute');
        }
        break;

      case XmlEventType.END_ELEMENT:
        const expectedElement = elementStack.pop();
        if (expectedElement !== event.name) {
          throw new Error(`Unexpected end element: ${event.name}`);
        }
        break;

      case XmlEventType.ERROR:
        throw new Error(`XML error: ${event.message}`);
    }
  }

  return elementStack.length === 0;
}
```

## Performance Questions

### How can I improve parsing performance?

1. **Use StaxXmlParserSync** for documents <10MB
2. **Minimize object creation** in your event handlers
3. **Use switch statements** instead of if-else chains
4. **Process events immediately** rather than storing them
5. **Pre-compile regular expressions** outside the parsing loop

```typescript
// Good - efficient parsing
const targetElements = new Set(['title', 'author', 'price']);

for (const event of parser) {
  if (event.type === XmlEventType.START_ELEMENT) {
    if (targetElements.has(event.name)) {
      // Process only relevant elements
    }
  }
}
```

### Why is my parsing slow?

Common performance issues:

- **Using async parser for small documents** - use sync parser instead
- **Storing all events in memory** - process events immediately
- **Complex string operations** in event handlers
- **Not filtering unnecessary events** - skip whitespace and comments
- **Creating many temporary objects** - reuse objects when possible

### How much memory does StAX-XML use?

- **Synchronous parser**: Memory usage ≈ input string size
- **Asynchronous parser**: Constant memory usage (typically 1-10MB regardless of file size)
- **Per event**: ~200-500 bytes depending on element complexity

## Writer Questions

### How do I generate XML with proper formatting?

Use the formatting options:

```typescript
import { StaxXmlWriterSync } from 'stax-xml';

const writer = new StaxXmlWriterSync({
  prettyPrint: true,
  indentString: '  '
});

writer.writeStartDocument();
writer.writeStartElement('root');
writer.writeStartElement('child');
writer.writeCharacters('content');
writer.writeEndElement();
writer.writeEndElement();
writer.writeEndDocument();

console.log(writer.getXmlString());
```

### How do I handle special characters in XML content?

StAX-XML automatically escapes special characters:

```typescript
writer.writeCharacters('Text with <brackets> & "quotes"');
// Outputs: Text with &lt;brackets&gt; &amp; &quot;quotes&quot;

writer.writeAttribute('attr', 'value with "quotes"');
// Outputs: attr="value with &quot;quotes&quot;"
```

### Can I stream XML generation?

Yes. For large file output, prefer the synchronous sink writer. It writes incrementally without building the full XML string, and the 1GiB writer benchmark shows it has the best throughput while peak RSS stays in the same range as async writing.

```typescript
import { openSync } from 'fs';
import { StaxXmlWriterSyncSink } from 'stax-xml';
import { createNodeFileSyncTextSink } from 'stax-xml/adapters/node';

const fd = openSync('./large.xml', 'w');
const writer = new StaxXmlWriterSyncSink(createNodeFileSyncTextSink(fd), {
  bufferSize: 64 * 1024,
  enableAutoFlush: true,
  flushThreshold: 0.8,
  flushOnClose: true
});

writer.writeStartDocument();
writer.writeStartElement('largeDocument');

for (let i = 0; i < 100000; i++) {
  writer.writeStartElement('item', { attributes: { id: i.toString() } });
  writer.writeCharacters(`Item ${i}`);
  writer.writeEndElement();
}

writer.writeEndElement();
writer.writeEndDocument();
writer.close();
```

Use `StaxXmlWriter` instead when the surrounding architecture requires an asynchronous `WritableStream`, such as HTTP streaming responses.

## Compatibility Questions

### Does StAX-XML work with React/Vue/Angular?

Yes! StAX-XML is framework-agnostic and works with any JavaScript framework. Use it in components, services, or utilities as needed.

### Can I use StAX-XML in a web worker?

Absolutely! StAX-XML uses only Web Standard APIs, so it works perfectly in web workers for off-main-thread XML processing.

### Does it work with Cloudflare Workers or Vercel Edge Functions?

Yes, StAX-XML is designed for edge runtimes and works in:
- Cloudflare Workers
- Vercel Edge Functions
- Deno Deploy
- Any Web Standards-compliant runtime

### What about Node.js streams?

Convert Node.js streams to Web ReadableStreams:

```typescript
import { Readable } from 'stream';
import { StaxXmlParser } from 'stax-xml';

function nodeStreamToReadableStream(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });

      nodeStream.on('end', () => {
        controller.close();
      });

      nodeStream.on('error', (error) => {
        controller.error(error);
      });
    }
  });
}
```

## Troubleshooting

### "Module not found" error

Ensure you're importing from the correct path:

```typescript
// Correct imports
import { StaxXmlParser, StaxXmlParserSync } from 'stax-xml';
import { StaxXmlWriter, StaxXmlWriterSync } from 'stax-xml';
import { XmlEventType } from 'stax-xml';
```

### TypeScript errors

Make sure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2018",
    "lib": ["ES2018", "DOM"],
    "moduleResolution": "node"
  }
}
```

### Bundle size concerns

StAX-XML is lightweight (~20KB minified), but you can tree-shake unused parts:

```typescript
// Only import what you need
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';
```

### Getting help

If you're still having issues:

1. Check the [Examples](/stax-xml/guide/examples/) page for similar use cases
2. Review the [API documentation](/stax-xml/api/) for detailed method signatures
3. Search [GitHub Issues](https://github.com/Clickin/stax-xml/issues) for existing solutions
4. Create a new issue with a minimal reproduction case

## Best Practices

### Memory Management

- Process events immediately rather than storing them
- Use object pooling for frequently created objects
- Clear references when done processing

### Error Handling

- Always handle ERROR events in your parser loop
- Use try-catch blocks for synchronous parsing
- Validate input before parsing when possible

### Performance

- Choose the right parser type for your use case
- Minimize work in event handlers
- Use efficient data structures (Set, Map) for lookups

### Security

- Validate and sanitize XML input from untrusted sources
- Be aware of XML bombs and deeply nested structures
- Consider implementing parsing limits for production use
