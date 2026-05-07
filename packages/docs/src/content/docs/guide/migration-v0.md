---
title: Migrating from v0.x
description: Move existing StAX-XML applications to the pure JavaScript 1.0 API surface.
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/guide/migration-v0.png
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
      content: https://clickin.github.io/stax-xml/og/guide/migration-v0.png
---

StAX-XML 1.0 is centered on the pure JavaScript package. Install stays simple:

```bash
npm install stax-xml
```

There are no platform-specific `@stax-xml/native-*` packages to install, no
Wasm parser module to copy, and no runtime backend option to choose.

## Migration Checklist

- Remove any direct dependency on `@stax-xml/native-*` or experimental native
  parser packages from your application.
- Use ESM imports: `import { EventReaderSync } from 'stax-xml'`.
- Use `EventReaderSync` for XML strings already in memory.
- Use `EventReader` for `ReadableStream<Uint8Array>` input.
- Use `StreamReaderSync` or `StreamReader` when large byte input needs lower
  allocation overhead than event objects.
- Keep converter schemas for schema-known projections and call `.compile()` if
  the same schema is reused heavily.
- Replace experimental cursor or iterable facade APIs with the stream/event
  reader APIs listed below.
- Re-run your production-sized XML workload with the release benchmark commands
  from the [Benchmarks](/stax-xml/resources/benchmarks/) page.

## Reader Mapping

| v0.x usage | 1.0 path | Notes |
| --- | --- | --- |
| In-memory string event parsing | `EventReaderSync` | Keeps the ergonomic event-object model. |
| Async stream parsing | `EventReader` | Accepts `ReadableStream<Uint8Array>` and drains byte batches incrementally. |
| Experimental cursor/facade APIs | `StreamReaderSync` or `StreamReader` | Consume `StreamBatch` with `eventCount` and index accessors. |
| Unknown XML to object/tree | `parseXmlObject*()` or `parseXmlTree*()` | Use tree mode when mixed content or order matters. |
| Declarative extraction | `stax-xml/converter` | Keep schemas near application boundaries. |
| Incremental large output | `WriterSyncSink` or `Writer` | Avoid retaining the whole XML string for large output. |

## CommonJS Projects

The package is ESM-only. In a CommonJS application, either move the XML parsing
module to ESM or load StAX-XML with dynamic import:

```js
async function parse(xml) {
  const { EventReaderSync, XmlEventType } = await import('stax-xml');
  let count = 0;

  for (const event of new EventReaderSync(xml)) {
    if (event.type === XmlEventType.START_ELEMENT) {
      count++;
    }
  }

  return count;
}
```

## Large Files

Do not call `readFileSync(path, 'utf8')`, `request.text()`, or
`response.text()` for large XML. Those APIs materialize the whole document as
one JavaScript string before parsing starts.

For Node.js files, pass a web stream to `EventReader`:

```ts
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { EventReader, XmlEventType } from 'stax-xml';

export async function countElements(path: string) {
  const stream = Readable.toWeb(createReadStream(path, {
    highWaterMark: 1024 * 1024,
  })) as ReadableStream<Uint8Array>;
  const reader = new EventReader(stream);
  let count = 0;

  for await (const event of reader) {
    if (event.type === XmlEventType.START_ELEMENT) {
      count++;
    }
  }

  return count;
}
```

If you already have byte batches, `StreamReaderSync` avoids event wrapper
allocation:

```ts
import { StreamEventType, StreamReaderSync } from 'stax-xml';

export function countFromBatches(batches: Iterable<Uint8Array[]>) {
  let count = 0;

  for (const batch of new StreamReaderSync(batches)) {
    for (let index = 0; index < batch.eventCount; index++) {
      if (batch.typeAt(index) === StreamEventType.START_ELEMENT) {
        count++;
      }
    }
  }

  return count;
}
```

## Converter Migration

Converter schemas remain the right surface when the XML shape is known and the
application wants typed projection instead of manual event handling. For hot
paths, compile the schema once:

```ts
import { x } from 'stax-xml/converter';

const feedSchema = x.object({
  title: x.string('/rss/channel/title'),
  items: x.array(
    x.object({
      title: x.string('./title'),
      link: x.string('./link'),
    }),
    '/rss/channel/item',
  ),
});

const feedParser = feedSchema.compile();
const feed = feedParser.parseSync(xmlBytes);
```

## Verification

After migration, run the same production-shaped XML through both the old and
new code paths and compare domain-level output, not only event counts. For
large files, record RSS or heap delta along with throughput so the migration
does not accidentally reintroduce whole-document buffering.
