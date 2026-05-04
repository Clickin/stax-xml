---
title: Getting Started
description: Learn how to install and set up StAX-XML in your project
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/guide/getting-started.png
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
      content: https://clickin.github.io/stax-xml/og/guide/getting-started.png
---

StAX-XML is a high-performance, pull-based XML parser for JavaScript/TypeScript that works across JavaScript runtimes with a pure JavaScript parser core.

## Installation

Install StAX-XML using your preferred package manager:

```bash
# npm
npm install stax-xml

# yarn
yarn add stax-xml

# pnpm
pnpm add stax-xml

# bun
bun add stax-xml

# deno
deno add npm:stax-xml
```

**ESM-only package:** StAX-XML is published as ESM-only. Use `import { ... } from 'stax-xml'`; `require('stax-xml')` is not supported.

## Platform Compatibility

StAX-XML keeps a Web Standard API baseline, making it compatible with:

- **Node.js** (v20.19+)
- **Bun** (any version)
- **Deno** (any version)
- **Web Browsers** (modern browsers)
- **Edge Runtime** (Vercel, Cloudflare Workers, etc.)

Browser parsing uses the same JavaScript parser path as server runtimes, so deployments do not need binary parser artifacts.

## Core Concepts

StAX-XML provides two main parsing approaches:

### Asynchronous Parsing (StaxXmlParser)
For memory-efficient processing of large XML files using streams:

```typescript
import { StaxXmlParser } from 'stax-xml';

const parser = new StaxXmlParser(readableStream);
for await (const event of parser) {
  // Process XML events
}
```

### Synchronous Parsing (StaxXmlParserSync)
For high-performance parsing of smaller, in-memory XML strings:

```typescript
import { StaxXmlParserSync } from 'stax-xml';

const parser = new StaxXmlParserSync(xmlString);
for (const event of parser) {
  // Process XML events
}
```

## Next Steps

- [Quick Start Guide](/stax-xml/guide/quick-start/) - Jump right in with practical examples
- [Examples](/stax-xml/guide/examples/) - See real-world usage patterns
