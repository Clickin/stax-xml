---
title: Converter - Selector Conformance
description: Public converter surface의 streaming selector boundary
slug: ko/converter/xpath-guide/xpath-1-conformance
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/xpath-guide.png
---

Converter는 full XPath 1.0 evaluator가 아니라 streaming XPath-shaped selector
subset을 구현합니다.

| Capability | 상태 | Public behavior |
| --- | --- | --- |
| Absolute child path | Supported | `/a/b/c` |
| Leading descendant path | Supported | `//item/name`; nested `//`는 reject합니다. |
| Relative contextual path | Supported | Object 또는 array item 안의 `./name` |
| Current contextual element | Supported | `.` |
| Attribute terminal | Supported | `./@id` |
| Direct text terminal | Supported | `./text()` |
| Positive positional predicate | Supported | `item[2]`; position은 1-based입니다. |
| Qualified name | Lexical | `p:item`은 XML QName을 그대로 match합니다. 외부 namespace binding option은 없습니다. |
| Wildcard와 arbitrary predicate | Unsupported | Parsing 전에 reject합니다. |
| Axis, union, operator, variable | Unsupported | Parsing 전에 reject합니다. |
| XPath function library | Unsupported | General function evaluator 또는 tree fallback을 포함하지 않습니다. |
| DOM/tree materialization | 사용하지 않음 | 지원 selector는 모두 streaming token 위에서 동작합니다. |

Unsupported expression은 `Unsupported streaming XPath` error를 throw합니다. 새
selector form의 추가는 backward-compatible하지만 위 표가 1.0 contract입니다.
