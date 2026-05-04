# StAX-XML

A performance-first, pull-based XML parser and writer for JavaScript and
TypeScript. The package is intentionally pure JavaScript: the parser core,
cursor readers, stream readers, event readers, converter, and writer all run
without binary parser modules or backend selection.

## Goals

- Keep memory usage low for large XML documents.
- Parse XML that is larger than JavaScript's single-string comfort zone by
  consuming streams, byte batches, and pull-style cursors.
- Provide a StAX-style pull API so applications do not need to keep deep SAX
  state machines in user code.
- Stay portable across Node, Bun, Deno, browsers, and edge runtimes.

## Install

```bash
npm install stax-xml
```

The package is ESM-only.

```ts
import { EventReaderSync, XmlEventType } from 'stax-xml';

const reader = new EventReaderSync('<root><item id="1">hello</item></root>');

for (const event of reader) {
  if (event.type === XmlEventType.START_ELEMENT) {
    console.log(event.name, event.attributes);
  }
}
```

## Public Surfaces

- `EventReaderSync` / `EventReader`: ergonomic string event readers.
- `StreamReaderSync` / `StreamReader`: batch-first pull readers for byte input.
- `CursorReader` / `CursorReaderAsync`: low-allocation cursor APIs.
- `parseXmlTree*()` / `parseXmlObject*()`: convenience helpers for unknown XML.
- `stax-xml/converter`: schema-driven XML-to-object parsing and XML writing.
- `Writer`, `WriterSync`, `WriterSyncSink`: XML output APIs, including a sync
  sink path for large output.

## Benchmarks

Benchmark scripts live under `packages/benchmark`. The maintained runtime
comparison is:

```bash
pnpm --dir packages/benchmark bench:runtime-matrix
```

It compares the same JavaScript reader workload across Node, Bun, and Deno when
those runtimes are installed.

## License

MIT
