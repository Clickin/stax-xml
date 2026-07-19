---
title: StAX-XML FAQ - JavaScript XML Parser Questions & Answers
description: FAQ covering StAX-XML usage, runtime support, performance, and the package runtime model.
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
slug: v1.1.0/resources/faq
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
        "text": "Use EventReader or EventReaderSync for stable XML event objects. Use StreamReader or StreamReaderSync for lower-allocation current-token traversal."
      }
    },
    {
      "@type": "Question",
      "name": "Does StAX-XML use native addons or Wasm?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. StAX-XML is distributed as a pure JavaScript package. The public API returns JavaScript strings and objects, so parsing and value materialization stay inside the JavaScript runtime."
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

Use `StreamReaderSync` for lower-overhead synchronous traversal over strings or
byte input. It exposes a current-token pull loop without allocating one event
object per XML event.

```ts
import { StreamReaderSync, XmlEventType } from 'stax-xml';

const reader = new StreamReaderSync(byteChunks);

while (reader.next() !== null) {
  if (reader.eventType() === XmlEventType.START_ELEMENT) {
    console.log(reader.name());
  }
}
```

### Does StAX-XML use native addons or Wasm?

No. StAX-XML is distributed as a pure JavaScript package. There is no optional
native addon, Wasm parser module, or backend selection step. The public API
returns JavaScript strings, attributes, event objects, and converter output
objects, so the supported runtime model keeps parsing and value materialization
inside JavaScript. See [Runtime Model](/stax-xml/resources/runtime-model/) for
the rationale.

### How do I parse unknown XML?

Use an event reader when you do not have a fixed schema:

```ts
import { EventReaderSync, XmlEventType } from 'stax-xml';

for (const event of new EventReaderSync(xml)) {
  if (event.type === XmlEventType.START_ELEMENT) console.log(event.name);
}
```

Use `StreamReaderSync` when allocation matters, or the converter when the target
object shape is known.

### How do I handle large files?

Keep I/O streaming at the boundary. `EventReader` is the ergonomic async
surface and `StreamReader` is its lower-allocation current-token counterpart.
Use `StreamReaderSync` when your caller already owns a synchronous byte source.

### How do I write XML?

Use `Writer` for `WritableStream<Uint8Array>`, `WriterSync` for in-memory string
output, and `WriterSyncSink` for synchronous incremental output without
retaining the full XML string.
