---
title: StAX-XML FAQ - JavaScript XML Parser Questions & Answers
description: FAQ covering StAX-XML usage, runtime support, performance, and the pure JavaScript parser decision.
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
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is StAX-XML?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "StAX-XML is a pure JavaScript, pull-style XML parser and writer for Node.js, Bun, Deno, browsers, and edge runtimes."
      }
    },
    {
      "@type": "Question",
      "name": "Which reader should I use?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Use EventReader or EventReaderSync for ergonomic XML event objects. Use StreamReader or StreamReaderSync when you need lower-overhead batch access over byte input."
      }
    },
    {
      "@type": "Question",
      "name": "Does StAX-XML use native addons or Wasm?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. Native and Wasm parser modes were removed because returning JavaScript strings and objects still requires decode, allocation, and wrapper work, while native or Wasm memory increases RSS."
      }
    }
  ]
}
</script>

## General Questions

### What is StAX-XML?

StAX-XML is a pure JavaScript, pull-style XML parser and writer for
JavaScript/TypeScript. It targets Node.js, Bun, Deno, browsers, and edge
runtimes without native addons, Wasm parser modules, or backend selection.

### Which reader should I start with?

Use `EventReader` for asynchronous `ReadableStream<Uint8Array>` input when you
want ergonomic event objects.

Use `EventReaderSync` for in-memory XML strings when ergonomic event objects are
more important than the lowest possible allocation count.

Use `StreamReader` or `StreamReaderSync` when you want lower-overhead batch
access over byte input. For large synchronous byte input, prefer
`StreamReaderSync` with `eventCount` plus index accessors rather than wrapper
event iteration.

```ts
import { StreamEventType, StreamReaderSync } from 'stax-xml';

const reader = new StreamReaderSync(byteBatches);

for (const batch of reader) {
  for (let index = 0; index < batch.eventCount; index++) {
    if (batch.typeAt(index) === StreamEventType.START_ELEMENT) {
      console.log(batch.nameAt(index));
    }
  }
}
```

### Why is there no native or Wasm backend mode?

Native and Wasm tokenizer experiments showed that byte scanning can be faster
outside JavaScript. The full public API still has to return JavaScript strings,
attributes, and event objects. JavaScript strings are immutable primitives, so
the parsed `char[]`-style data cannot be handed back as a reusable view.

That boundary adds decode, allocation, wrapper, and ownership costs. Native heap
or Wasm linear memory also increases RSS. For StAX-XML's goals, low memory,
large XML, and pull-style JavaScript consumption were more important than a
native scanner that loses much of its benefit at the JS boundary.

### How do I parse unknown XML?

Use the tree/object helpers when you do not have a fixed schema:

```ts
import { parseXmlObjectSync, parseXmlTreeSync } from 'stax-xml';

const tree = parseXmlTreeSync(xml);
const object = parseXmlObjectSync(xml);
```

Use `parseXmlTreeSync()` when element order and mixed content matter. Use
`parseXmlObjectSync()` when you want a compact object shape with attributes
stored under `@name` keys.

### How do I handle large files?

Keep I/O streaming at the boundary and parse received byte batches
synchronously. `EventReader` is the ergonomic async surface. `StreamReaderSync`
over `Iterable<Uint8Array[]>` is the lower-overhead sync batch surface when your
caller already batches bytes.

### How do I write XML?

Use `Writer` for `WritableStream<Uint8Array>`, `WriterSync` for in-memory string
output, and `WriterSyncSink` for synchronous incremental output without
retaining the full XML string.
