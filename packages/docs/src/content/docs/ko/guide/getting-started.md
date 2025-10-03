---
title: 시작하기
description: 프로젝트에서 StAX-XML을 설치하고 설정하는 방법을 배워보세요
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/ko/guide/getting-started.png
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
      content: https://clickin.github.io/stax-xml/og/ko/guide/getting-started.png
---

StAX-XML은 모든 JavaScript 런타임에서 작동하는 JavaScript/TypeScript용 고성능 풀 기반 XML 파서입니다.

## 설치

원하시는 패키지 매니저를 사용하여 StAX-XML을 설치하세요:

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

## 플랫폼 호환성

StAX-XML은 웹 표준 API만을 사용하여 다음과 호환됩니다:

- **Node.js** (v18+)
- **Bun** (모든 버전)
- **Deno** (모든 버전)
- **웹 브라우저** (최신 브라우저)
- **엣지 런타임** (Vercel, Cloudflare Workers 등)

## 핵심 개념

StAX-XML은 두 가지 주요 파싱 방법을 제공합니다:

### 비동기 파싱 (StaxXmlParser)
스트림을 사용한 대용량 XML 파일의 메모리 효율적인 처리:

```typescript
import { StaxXmlParser } from 'stax-xml';

const parser = new StaxXmlParser(readableStream);
for await (const event of parser) {
  // XML 이벤트 처리
}
```

### 동기 파싱 (StaxXmlParserSync)
작은 인메모리 XML 문자열의 고성능 파싱:

```typescript
import { StaxXmlParserSync } from 'stax-xml';

const parser = new StaxXmlParserSync(xmlString);
for (const event of parser) {
  // XML 이벤트 처리
}
```

## 다음 단계

- [빠른 시작 가이드](/stax-xml/ko/guide/quick-start/) - 실용적인 예제로 바로 시작하기
- [예제](/stax-xml/ko/guide/examples/) - 실제 사용 패턴 확인하기