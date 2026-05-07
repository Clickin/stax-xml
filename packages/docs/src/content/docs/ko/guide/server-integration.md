---
title: Web Server 연동
description: Node, Fastify, Hono, Next.js, Bun, Deno, edge request stream에서 StAX-XML을 사용하는 방법.
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/ko/guide/server-integration.png
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
      content: https://clickin.github.io/stax-xml/og/ko/guide/server-integration.png
---

StAX-XML은 `EventReader`를 통해 web standard `ReadableStream<Uint8Array>` 입력을
받습니다. Parser가 pure JavaScript이므로 server deploy에서 native addon 설치,
Lambda layer, Docker image rebuild, edge runtime용 binary fallback이 필요하지
않습니다.

## 서버 체크리스트

- 큰 XML에서는 `request.text()`나 `request.arrayBuffer()`보다 request stream을
  사용하세요.
- Body size limit과 timeout은 web framework에서 먼저 설정하세요. Parser가 첫 번째
  resource limit이 되면 안 됩니다.
- 일반적인 async request stream은 `EventReader`를 사용하세요.
- 애플리케이션이 bounded byte batch를 이미 가지고 있고 synchronous CPU work가 실행될
  위치를 통제할 수 있을 때만 `StreamReaderSync`를 사용하세요.
- File stream chunk size는 64 KiB에서 1 MiB 근처가 적당합니다. 너무 작은 chunk는
  framework overhead를 늘리고, 너무 큰 chunk는 parser가 yield하기 전 latency를
  키웁니다.
- Request 사이에 reader를 공유하지 마세요. Request body마다 reader를 하나씩 새로
  만드세요.

## Express

Express request object는 Node stream입니다. `EventReader`에 넘기기 전에 web stream으로
변환하세요.

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

큰 XML을 받을 수 있는 endpoint에서는 `express.text()`를 피하세요. Handler가 실행되기
전에 전체 body를 buffering합니다.

## Fastify

Streaming XML endpoint에서는 raw request stream을 사용하세요. Route handler 전에
body를 eager buffering하지 않도록 content type parser를 등록하세요.

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

## Hono와 Cloudflare Workers

Fetch 기반 runtime은 request body를 이미 web stream으로 노출합니다.

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

## Next.js Route Handler

Route handler는 standard `Request`를 받습니다. Node runtime과 Edge runtime에서
`request.body`를 그대로 사용하세요.

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

`Bun.serve()`도 Fetch `Request` 모델을 사용합니다.

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

Deno server API도 fetch-compatible이므로 같은 stream 경로를 사용합니다.

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

## Backpressure와 CPU work

`EventReader`는 I/O boundary에서 request stream을 await한 뒤, 도착한 byte batch를
동기적으로 drain합니다. 이 방식은 parsing을 예측 가능하고 portable하게 유지하지만,
매우 큰 batch는 parsing되는 동안 JavaScript thread를 점유합니다.

Latency에 민감한 server에서는 incoming chunk를 bounded하게 유지하고 parser loop 안에
무거운 business logic을 넣지 마세요. 필요한 field만 최소한으로 추출한 뒤, request
latency보다 inline completion이 덜 중요하면 queue나 worker로 domain work를 넘기는
편이 낫습니다.
