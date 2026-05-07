---
title: Web Server Integration
description: Use StAX-XML with Node, Fastify, Hono, Next.js, Bun, Deno, and edge request streams.
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/guide/server-integration.png
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
      content: https://clickin.github.io/stax-xml/og/guide/server-integration.png
slug: v1.0.0-rc3/guide/server-integration
---

StAX-XML accepts web-standard `ReadableStream<Uint8Array>` input through
`EventReader`. The parser is pure JavaScript, so server deployments do not need
native addon installation, Lambda layers, Docker image rebuilds, or edge-runtime
fallbacks for binary parser artifacts.

## Server Checklist

- Prefer request streams over `request.text()` or `request.arrayBuffer()` for
  large XML.
- Keep body-size limits and timeouts in the web framework. The parser should
  not be the first resource limit.
- Use `EventReader` for normal async request streams.
- Use `StreamReaderSync` only when your application already owns bounded byte
  batches and can control where the synchronous CPU work runs.
- Pick a chunk size near 64 KiB to 1 MiB for file streams. Very tiny chunks add
  framework overhead; very large chunks increase latency before the parser can
  yield.
- Do not share a reader between requests. Create one reader per request body.

## Express

Express request objects are Node streams. Convert them to a web stream before
passing them to `EventReader`.

```ts
import express from 'express';
import { Readable } from 'node:stream';
import { EventReader, XmlEventType } from 'stax-xml';

const app = express();

app.post('/xml', async (req, res, next) => {
  try {
    const stream = Readable.toWeb(req) as ReadableStream<Uint8Array>;
    const reader = new EventReader(stream);
    let items = 0;

    for await (const event of reader) {
      if (event.type === XmlEventType.START_ELEMENT && event.name === 'item') {
        items++;
      }
    }

    res.json({ items });
  } catch (error) {
    next(error);
  }
});
```

Avoid `express.text()` for endpoints that may receive large XML. It buffers the
whole request body before your handler runs.

## Fastify

Use the raw request stream for streaming XML endpoints. Register any content
type parser so it does not eagerly buffer the body before the route handler.

```ts
import Fastify from 'fastify';
import { Readable } from 'node:stream';
import { EventReader, XmlEventType } from 'stax-xml';

const fastify = Fastify();

fastify.addContentTypeParser(
  ['application/xml', 'text/xml'],
  (_request, payload, done) => done(null, payload),
);

fastify.post('/xml', async (request, reply) => {
  const stream = Readable.toWeb(request.body as Readable) as ReadableStream<Uint8Array>;
  const reader = new EventReader(stream);
  let elements = 0;

  for await (const event of reader) {
    if (event.type === XmlEventType.START_ELEMENT) {
      elements++;
    }
  }

  return reply.send({ elements });
});
```

## Hono and Cloudflare Workers

Fetch-based runtimes already expose request bodies as web streams.

```ts
import { Hono } from 'hono';
import { EventReader, XmlEventType } from 'stax-xml';

const app = new Hono();

app.post('/xml', async (c) => {
  const body = c.req.raw.body;
  if (!body) {
    return c.json({ error: 'Missing request body' }, 400);
  }

  let elements = 0;
  for await (const event of new EventReader(body)) {
    if (event.type === XmlEventType.START_ELEMENT) {
      elements++;
    }
  }

  return c.json({ elements });
});

export default app;
```

## Next.js Route Handlers

Route handlers receive a standard `Request`. Use `request.body` directly in
Node and Edge runtimes.

```ts
import { EventReader, XmlEventType } from 'stax-xml';

export async function POST(request: Request) {
  if (!request.body) {
    return Response.json({ error: 'Missing request body' }, { status: 400 });
  }

  let elements = 0;
  for await (const event of new EventReader(request.body)) {
    if (event.type === XmlEventType.START_ELEMENT) {
      elements++;
    }
  }

  return Response.json({ elements });
}
```

## Bun

`Bun.serve()` also uses the Fetch `Request` model.

```ts
import { EventReader, XmlEventType } from 'stax-xml';

Bun.serve({
  async fetch(request) {
    if (!request.body) {
      return Response.json({ error: 'Missing request body' }, { status: 400 });
    }

    let elements = 0;
    for await (const event of new EventReader(request.body)) {
      if (event.type === XmlEventType.START_ELEMENT) {
        elements++;
      }
    }

    return Response.json({ elements });
  },
});
```

## Deno

Deno's server API is fetch-compatible, so the same stream path applies.

```ts
import { EventReader, XmlEventType } from 'npm:stax-xml';

Deno.serve(async (request) => {
  if (!request.body) {
    return Response.json({ error: 'Missing request body' }, { status: 400 });
  }

  let elements = 0;
  for await (const event of new EventReader(request.body)) {
    if (event.type === XmlEventType.START_ELEMENT) {
      elements++;
    }
  }

  return Response.json({ elements });
});
```

## Backpressure and CPU Work

`EventReader` awaits the request stream at the I/O boundary, then drains each
received byte batch synchronously. That keeps parsing predictable and portable,
but a very large batch still occupies the JavaScript thread while it is parsed.

For latency-sensitive servers, keep incoming chunks bounded and avoid doing
heavy business logic inside the parser loop. Extract the minimum needed fields,
then hand the domain work to a queue or worker when request latency matters more
than inline completion.
