---
title: IterableReader - 배치 XML 파싱
description: 높은 처리량의 XML 스캔을 위한 저수준 iterable byte-batch parser API
---

## IterableReader - 배치 XML 파싱

`IterableReader`는 public parser, cursor, converter fast path의 기반이 되는 저수준 synchronous event-frame backend입니다. byte chunk 위에서 최대 처리량을 얻고, batch-local span을 직접 소비하거나 필요한 string만 materialize하고 싶을 때 사용합니다.

DOM parser가 아니며 이전 event를 보관하지 않습니다. 모든 batch view는 다음 `nextBatch()` 또는 `nextBatchFrame()` 호출 전까지만 유효합니다.

XML parsing은 CPU-intensive 작업입니다. chunk가 `AsyncIterable`에서 오더라도 tokenization loop는 awaited batch마다 동기적으로 실행되며 현재 event loop thread를 block할 수 있습니다. UI thread나 latency-sensitive Node service에서 큰 파일을 파싱한다면 Web Worker 또는 Node worker thread로 offload할지 결정하세요.

### Import 경로

```typescript
import {
  IterableEventType,
  IterableReader,
  toAsyncByteBatches,
  toByteBatches,
  type ByteBatch,
  type IterableReaderBatchFrame,
} from 'stax-xml/iterable';

import {
  NodeIterableReader,
  nodeFileByteBatchesSync,
} from 'stax-xml/iterable/node';
```

`stax-xml/iterable`은 browser-compatible `Uint8Array` batch용입니다. `stax-xml/iterable/node`는 `Buffer`와 blocking file I/O를 사용할 수 있는 Node batch job에서만 사용하세요.

### 기본 사용법

```typescript
import { IterableEventType, IterableReader, toByteBatches } from 'stax-xml/iterable';

const encoder = new TextEncoder();
const chunks = [
  encoder.encode('<catalog><book id="b1">'),
  encoder.encode('<title>Native XML</title></book></catalog>'),
];

const parser = new IterableReader(toByteBatches(chunks, { batchSize: 2 }));

while (parser.nextBatch()) {
  for (let index = 0; index < parser.eventCount(); index++) {
    if (parser.eventType(index) === IterableEventType.START_ELEMENT) {
      console.log(parser.copyName(index), parser.copyAttributesObject(index));
    }
  }
}
```

### 생성자

```typescript
new IterableReader(source, options?)
```

`source`는 `Iterable<ByteBatch>`이고, `ByteBatch`는 `readonly Uint8Array[]`입니다.

Options:

| Option | Type | Default | 의미 |
| --- | --- | --- | --- |
| `encoding` | `string` | `'utf-8'` | `decodeSpan()`과 copy helper가 사용하는 encoding입니다. |
| `incompleteFinalMarkupMessage` | `string` | 기본 parser message | 마지막 batch가 markup 중간에서 끝날 때 사용할 error message입니다. |
| `emitStartDocumentBatchImmediately` | `boolean` | `false` | `START_DOCUMENT`만 포함한 첫 batch를 즉시 반환합니다. |

### Batch helper

```typescript
toByteBatches(source, { batchSize?: number })
toAsyncByteBatches(source, { batchSize?: number })
```

`toByteBatches()`는 `Iterable<Uint8Array>`를 `ByteBatch` 배열로 묶습니다. `toAsyncByteBatches()`는 `AsyncIterable<Uint8Array>`에 같은 처리를 합니다. 단, `IterableReader` 자체는 synchronous parser이므로 awaited batch를 synchronous parser loop에 넘겨야 합니다.

### Batch loop

| Method | Returns | 의미 |
| --- | --- | --- |
| `nextBatch()` | `boolean` | 다음 event frame으로 진행합니다. |
| `nextBatchFrame()` | `IterableReaderBatchFrame \| undefined` | 진행한 뒤 현재 typed-array frame을 반환합니다. |
| `eventCount()` | `number` | 현재 frame의 event 수입니다. |
| `batchFrame()` | `IterableReaderBatchFrame` | 진행하지 않고 현재 frame을 반환합니다. |
| `buffer()` | `Uint8Array` | span offset이 가리키는 현재 batch buffer입니다. |

`eventTypes`, `nameStarts`, `nameEnds`, `textStarts`, `attrStarts`, `attrCounts` 같은 frame field는 parser가 소유한 typed array입니다. parser를 다음 batch로 진행하기 전에 읽어야 합니다.

### Event와 span 접근

| Method | Returns | 의미 |
| --- | --- | --- |
| `eventType(index)` | `IterableEventType` | 숫자 event type입니다. |
| `nameStart(index)` / `nameEnd(index)` | `number` | start/end event의 element name byte span입니다. |
| `textStart(index)` / `textEnd(index)` | `number` | text/CDATA event의 text byte span입니다. 없으면 start가 음수입니다. |
| `attrCount(index)` | `number` | start element의 attribute 수입니다. |
| `attrNameStart(eventIndex, attrIndex)` / `attrNameEnd(...)` | `number` | attribute name byte span입니다. |
| `attrValueStart(eventIndex, attrIndex)` / `attrValueEnd(...)` | `number` | attribute value byte span입니다. |

checksum, filtering, byte-level routing만 필요하면 span을 사용하세요. JavaScript string이 필요한 경우에만 copy helper를 사용합니다.

### String materialization helper

| Method | Returns | 의미 |
| --- | --- | --- |
| `decodeSpan(start, end)` | `string` | 현재 buffer의 임의 span을 decode합니다. |
| `copyName(index)` | `string \| undefined` | element name을 materialize합니다. |
| `copyText(index)` | `string \| undefined` | text 또는 CDATA를 materialize합니다. |
| `copyAttrName(eventIndex, attrIndex)` | `string \| undefined` | attribute name 하나를 materialize합니다. |
| `copyAttrValue(eventIndex, attrIndex)` | `string \| undefined` | attribute value 하나를 materialize합니다. |
| `copyAttributesObject(eventIndex)` | `Record<string, string>` | event 하나의 모든 attribute를 object로 materialize합니다. |
| `isImplicitAttributeValue(eventIndex, attrIndex)` | `boolean` | 명시적인 value 없이 parse된 attribute이면 true입니다. |

### Node file batch

```typescript
import { IterableEventType } from 'stax-xml/iterable';
import { NodeIterableReader, nodeFileByteBatchesSync } from 'stax-xml/iterable/node';

const parser = new NodeIterableReader(
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

`NodeIterableReader`는 `IterableReader`와 같은 span/copy method를 제공합니다. 차이는 `buffer()`가 Node `Buffer`를 반환한다는 점입니다. 현재 option은 `attributeScanner?: 'general' | 'simple'`입니다.

### Async file I/O와 sync batch parsing

파일 I/O는 async여야 하지만 CPU parse loop는 명시적인 sync batch parser로 처리하고 싶다면, awaited batch를 synchronous iterable parser source에 넘기면 됩니다. 이렇게 하면 메모리 사용량을 bounded 상태로 유지할 수 있습니다.

Async file I/O를 사용해도 XML parsing 자체가 non-blocking이 되지는 않습니다. 각 `parser.nextBatch()` 호출은 해당 batch tokenization이 끝날 때까지 현재 thread를 점유할 수 있으므로 main event loop responsive 상태가 중요하면 worker를 사용하세요.

```typescript
import { open } from 'node:fs/promises';
import { NodeIterableReader } from 'stax-xml/iterable/node';

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
  const parser = new NodeIterableReader(source);
  const file = await open(path, 'r');

  try {
    for await (const chunk of file.createReadStream({ highWaterMark: 1024 * 1024 })) {
      source.push([chunk]);
      parser.nextBatch();
      // 여기에서 parser.eventCount(), parser.eventType(), span을 소비합니다.
    }
  } finally {
    await file.close();
    source.close();
  }

  while (parser.nextBatch()) {
    // END_DOCUMENT 또는 carry된 tail event를 flush합니다.
  }
}
```

완전한 async public API ergonomics가 필요하면 `EventReader`를 사용하세요. backend throughput과 bounded batch job이 우선이면 iterable parser를 직접 사용합니다.
