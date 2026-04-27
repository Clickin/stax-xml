---
title: StaxXmlIterableParser - Batch XML Parsing
description: Low-level iterable byte-batch parser API for high-throughput XML scanning
slug: v1.0.0-rc1/api-guides/staxxml-iterable-parser
---

## StaxXmlIterableParser - Batch XML Parsing

`StaxXmlIterableParser` is the low-level synchronous event-frame backend used by the public parser, cursor, and converter fast paths. Use it when you want maximum throughput over byte chunks and can consume batch-local spans or materialize only the strings you need.

It is not a DOM parser and it does not retain old events. Every batch view is valid only until the next `nextBatch()` or `nextBatchFrame()` call.

Parsing is CPU-intensive. Even when chunks come from an `AsyncIterable`, the tokenization loop runs synchronously for each awaited batch and can block the current event loop thread. For large files on a UI thread or latency-sensitive Node service, decide whether to offload parsing to a Web Worker or Node worker thread.

### Import Paths

```typescript
import {
  IterableEventType,
  StaxXmlIterableParser,
  toAsyncByteBatches,
  toByteBatches,
  type ByteBatch,
  type StaxXmlIterableBatchFrame,
} from 'stax-xml/iterable';

import {
  StaxXmlNodeIterableParser,
  nodeFileByteBatchesSync,
} from 'stax-xml/iterable/node';
```

Use `stax-xml/iterable` for browser-compatible `Uint8Array` batches. Use `stax-xml/iterable/node` only for Node batch jobs that can depend on `Buffer` and blocking file I/O.

### Basic Usage

```typescript
import { IterableEventType, StaxXmlIterableParser, toByteBatches } from 'stax-xml/iterable';

const encoder = new TextEncoder();
const chunks = [
  encoder.encode('<catalog><book id="b1">'),
  encoder.encode('<title>Native XML</title></book></catalog>'),
];

const parser = new StaxXmlIterableParser(toByteBatches(chunks, { batchSize: 2 }));

while (parser.nextBatch()) {
  for (let index = 0; index < parser.eventCount(); index++) {
    if (parser.eventType(index) === IterableEventType.START_ELEMENT) {
      console.log(parser.copyName(index), parser.copyAttributesObject(index));
    }
  }
}
```

### Constructor

```typescript
new StaxXmlIterableParser(source, options?)
```

`source` is an `Iterable<ByteBatch>`, where `ByteBatch` is `readonly Uint8Array[]`.

Options:

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `encoding` | `string` | `'utf-8'` | Encoding used by `decodeSpan()` and copy helpers. |
| `incompleteFinalMarkupMessage` | `string` | default parser message | Error message when the final batch ends inside markup. |
| `emitStartDocumentBatchImmediately` | `boolean` | `false` | Return a first batch containing only `START_DOCUMENT`. |

### Batch Helpers

```typescript
toByteBatches(source, { batchSize?: number })
toAsyncByteBatches(source, { batchSize?: number })
```

`toByteBatches()` groups an `Iterable<Uint8Array>` into `ByteBatch` arrays. `toAsyncByteBatches()` does the same for `AsyncIterable<Uint8Array>`, but `StaxXmlIterableParser` itself is synchronous, so awaited batches must be handed to a synchronous parser loop.

### Batch Loop

| Method | Returns | Meaning |
| --- | --- | --- |
| `nextBatch()` | `boolean` | Advances to the next event frame. |
| `nextBatchFrame()` | `StaxXmlIterableBatchFrame \| undefined` | Advances and returns the current typed-array frame. |
| `eventCount()` | `number` | Number of events in the current frame. |
| `batchFrame()` | `StaxXmlIterableBatchFrame` | Returns the current frame without advancing. |
| `buffer()` | `Uint8Array` | Current batch buffer that span offsets point into. |

Frame fields such as `eventTypes`, `nameStarts`, `nameEnds`, `textStarts`, `attrStarts`, and `attrCounts` are parser-owned typed arrays. Read them before advancing the parser.

### Event And Span Access

| Method | Returns | Meaning |
| --- | --- | --- |
| `eventType(index)` | `IterableEventType` | Numeric event type. |
| `nameStart(index)` / `nameEnd(index)` | `number` | Element name byte span for start/end events. |
| `textStart(index)` / `textEnd(index)` | `number` | Text byte span for text/CDATA events, or negative start when absent. |
| `attrCount(index)` | `number` | Attribute count for a start element. |
| `attrNameStart(eventIndex, attrIndex)` / `attrNameEnd(...)` | `number` | Attribute name byte span. |
| `attrValueStart(eventIndex, attrIndex)` / `attrValueEnd(...)` | `number` | Attribute value byte span. |

Use spans when checksums, filtering, or byte-level routing are enough. Use copy helpers only when you need JavaScript strings.

### String Materialization Helpers

| Method | Returns | Meaning |
| --- | --- | --- |
| `decodeSpan(start, end)` | `string` | Decode an arbitrary span from the current buffer. |
| `copyName(index)` | `string \| undefined` | Materialize the element name. |
| `copyText(index)` | `string \| undefined` | Materialize text or CDATA. |
| `copyAttrName(eventIndex, attrIndex)` | `string \| undefined` | Materialize one attribute name. |
| `copyAttrValue(eventIndex, attrIndex)` | `string \| undefined` | Materialize one attribute value. |
| `copyAttributesObject(eventIndex)` | `Record<string, string>` | Materialize all attributes for one event. |
| `isImplicitAttributeValue(eventIndex, attrIndex)` | `boolean` | True when an attribute was parsed without an explicit value. |

### Node File Batches

```typescript
import { IterableEventType } from 'stax-xml/iterable';
import { StaxXmlNodeIterableParser, nodeFileByteBatchesSync } from 'stax-xml/iterable/node';

const parser = new StaxXmlNodeIterableParser(
  nodeFileByteBatchesSync('./large.xml', {
    chunkSize: 1024 * 1024,
    batchSize: 1,
  }),
);

let elements = 0;
while (parser.nextBatch()) {
  for (let index = 0; index < parser.eventCount(); index++) {
    if (parser.eventType(index) === IterableEventType.START_ELEMENT) {
      elements++;
    }
  }
}
```

`StaxXmlNodeIterableParser` exposes the same span and copy methods as `StaxXmlIterableParser`, but `buffer()` returns a Node `Buffer`. Its options currently include `attributeScanner?: 'general' | 'simple'`.

### Async File I/O With Sync Batch Parsing

If file I/O must be async, read chunks asynchronously and hand each awaited batch to a synchronous iterable parser source. This keeps memory bounded while making the CPU parse loop explicit.

Async file I/O does not make XML parsing itself non-blocking. Each `parser.nextBatch()` call can occupy the current thread until that batch is tokenized, so use a worker when the main event loop must stay responsive.

```typescript
import { open } from 'node:fs/promises';
import { StaxXmlNodeIterableParser } from 'stax-xml/iterable/node';

class OneBatchSource implements Iterable<readonly Buffer[]> {
  private batch?: readonly Buffer[];
  private done = false;

  [Symbol.iterator]() {
    return this;
  }

  push(batch: readonly Buffer[]) {
    this.batch = batch;
  }

  close() {
    this.done = true;
  }

  next(): IteratorResult<readonly Buffer[]> {
    if (this.batch) {
      const value = this.batch;
      this.batch = undefined;
      return { value, done: false };
    }
    if (this.done) {
      return { value: undefined, done: true };
    }
    throw new Error('Parser requested a batch before async file I/O provided one.');
  }
}

async function parseAsyncFile(path: string) {
  const source = new OneBatchSource();
  const parser = new StaxXmlNodeIterableParser(source);
  const file = await open(path, 'r');

  try {
    for await (const chunk of file.createReadStream({ highWaterMark: 1024 * 1024 })) {
      source.push([chunk]);
      parser.nextBatch();
      // Consume parser.eventCount(), parser.eventType(), and spans here.
    }
  } finally {
    await file.close();
    source.close();
  }

  while (parser.nextBatch()) {
    // Flush END_DOCUMENT or any carried tail events.
  }
}
```

For fully async public API ergonomics, use `StaxXmlParser`. For backend throughput and bounded batch jobs, use the iterable parser directly.
