# StAX-XML

A performance-first, pull-based XML parser and writer for JavaScript and
TypeScript. The package is intentionally pure JavaScript: the parser core,
stream readers, event readers, converter, and writer all run
without binary parser modules or backend selection.

## Goals

- Keep memory usage low for large XML documents.
- Parse XML that is larger than JavaScript's single-string comfort zone by
  consuming streams and byte batches.
- Provide a StAX-style pull API so applications do not need to keep deep SAX
  state machines in user code.
- Keep async work at I/O ingress boundaries. Once a byte batch has arrived,
  tokenization and event draining stay synchronous.
- Stay portable across Node, Bun, Deno, browsers, and edge runtimes.

## Why Pure JavaScript?

We explored native and Wasm tokenizer acceleration first. Native code can scan
XML bytes very quickly, but the public `stax-xml` contract is JavaScript
consumption: callers read names, text, attributes, events, and objects as
JavaScript values.

That boundary adds decode, allocation, wrapper, and ownership costs. It also
adds native heap or Wasm linear memory to RSS. Because this package is optimized
for low memory, very large XML, and pull-based JavaScript consumption, the native
experiment was moved out of this package.

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

- `stax-xml`: `StreamReaderSync`, `EventReaderSync`, `StreamReader`,
  `EventReader`, and the writers.
- `stax-xml/converter`: recommended schema-driven XML-to-object parsing and XML writing.
- `StreamReaderSync` / `StreamReader`: allocation-sensitive current-token readers.
- `EventReaderSync` / `EventReader`: stable event-object readers built over the same token core.
- `Writer`, `WriterSync`, `WriterSyncSink`: XML output APIs, including a sync
  sink path for large output.

Both synchronous readers accept `string`, `Uint8Array`, or
`Iterable<Uint8Array>`. Strings are scanned directly as JavaScript strings;
they are never re-encoded to bytes. Both asynchronous readers accept
`ReadableStream<Uint8Array>` or `AsyncIterable<Uint8Array>` and decode UTF-8
incrementally. For known object output, start with the converter.

These are the only public package entry points. The package has no default
export, runtime adapters, tree/DOM helpers, or backend-selection API.

## Benchmarks

Benchmark scripts live under `packages/benchmark`. The maintained runtime
comparison is:

```bash
pnpm --dir packages/benchmark bench:runtime-matrix
```

It compares the same JavaScript reader workload across Node, Bun, and Deno when
those runtimes are installed.

## Release Guides

- [Migrating from v0.x](https://clickin.github.io/stax-xml/guide/migration-v0/)
  maps older application code to the pure JavaScript 1.0 reader and writer
  surfaces.
- [Web Server Integration](https://clickin.github.io/stax-xml/guide/server-integration/)
  shows request streaming patterns for Express, Fastify, Hono, Next.js, Bun,
  Deno, and edge runtimes.
- [Release Readiness](https://clickin.github.io/stax-xml/resources/release-readiness/)
  records the packaging, benchmark, docs, and merge checklist used before
  publishing.

## License

MIT
