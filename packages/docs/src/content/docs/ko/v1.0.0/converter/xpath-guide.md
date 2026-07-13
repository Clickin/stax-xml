---
title: Converter - XPath 가이드
description: Converter가 지원하는 streaming selector 표현식
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/xpath-guide.png
slug: ko/v1.0.0/converter/xpath-guide
---

Converter는 XML token을 streaming하는 동안 평가할 수 있는 작은 XPath-shaped
selector language만 지원합니다. DOM을 만들거나 일반 XPath 1.0 tree evaluator로
fallback하지 않습니다.

## 지원 selector

| 형태 | 예제 | 의미 |
| --- | --- | --- |
| Absolute path | `/catalog/book/title` | Document root부터 path를 match합니다. |
| Leading descendant | `//book/title` | 임의의 `book` 아래 path를 match합니다. `//`는 시작 위치에서만 지원합니다. |
| Relative path | `./title` | Object 또는 array item의 현재 element 아래를 match합니다. |
| Current element | `.` | 현재 contextual element를 선택합니다. |
| Attribute terminal | `./@id` | 선택한 element의 attribute를 읽습니다. |
| Direct text terminal | `./text()` | 선택한 element의 direct text를 수집합니다. |
| Positive position | `/catalog/book[2]/title` | 1-based sibling position 하나를 match합니다. |

```ts
import { x } from 'stax-xml/converter';

const catalog = x.object({
  books: x.array(
    x.object({
      id: x.string('./@id'),
      title: x.string('./title'),
    }),
    '/catalog/book',
  ),
});

const value = catalog.parseSync(xml);
```

Selector는 자동으로 compile되고 cache됩니다. Public `.compile()` 단계는 없습니다.
첫 parse의 일회성 IR lowering과 executor 생성 비용을 앞당기고 싶을 때만
`.precompile()`을 호출하세요. 예를 들어 server startup module에서 공유 schema를
warm-up할 수 있습니다.

```ts
export const catalogSchema = x.object({
  title: x.string('/catalog/title'),
}).precompile();

const catalog = catalogSchema.parseSync(requestBody);
```

Warm-up은 first-request latency만 옮기며 steady-state throughput은 바꾸지 않습니다.
동일 schema instance를 재사용하세요. Parse option은 warm-up 대상이 아니라 각 parse
호출에 적용되는 설정입니다.

## Namespace

이름은 XML stream에 나타난 qualified name으로 match합니다.
`/p:catalog/p:item` selector는 해당 prefix가 붙은 이름을 그대로 match합니다.
별도의 prefix-to-URI binding option은 없으므로 XML prefix가 바뀌면 selector도
바뀌어야 합니다. Prefix 없는 selector는 prefix 없는 XML name을 match합니다.

## 지원하지 않는 XPath 1.0 기능

Wildcard, nested `//`, arbitrary predicate, axis, union, variable, operator,
terminal `text()` 이외의 XPath function은 public converter contract가 아닙니다.
Unsupported expression은 document tree를 materialize하지 않고
`Unsupported streaming XPath` error를 throw합니다.

Unknown 또는 dynamic XML에는 `EventReader` / `EventReaderSync`를 사용하세요.
Stable event object보다 current-token traversal과 낮은 allocation이 중요하면
`StreamReader` / `StreamReaderSync`를 사용하세요.

정확한 boundary는 [conformance matrix](./xpath-1-conformance/)를 참고하세요.
