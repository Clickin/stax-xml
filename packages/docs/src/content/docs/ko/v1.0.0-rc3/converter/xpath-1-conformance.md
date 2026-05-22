---
title: Converter - XPath 1.0 준수 매트릭스
description: public converter surface 기준 XPath 1.0 준수 매트릭스
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/xpath-guide.png
slug: ko/v1.0.0-rc3/converter/xpath-1-conformance
---

이 매트릭스는 public converter XPath surface를 기준으로 합니다. XPath 표현식은
converter의 lightweight document tree 위에서 TypeScript XPath 1.0 runtime이
평가합니다.

상태 값:

- **Supported**: converter XPath 테스트로 보호되며 `x.*().xpath(...)`로 사용할 수 있습니다.
- **Partial**: 표현식은 동작하지만 XML parser metadata 또는 host integration이 XPath 1.0 의미 전체를 노출하지 않습니다.
- **Not exposed**: XPath 1.0 개념은 존재하지만 converter public API에 해당 binding surface가 없습니다.
- **Limited**: 일반 XML text에서는 사용할 수 있지만, 설명에 적힌 XPath 1.0 edge-case 의미 전체를 보장하지 않습니다.

| XPath 1.0 영역 | 기능 | 상태 | Converter 동작 |
| --- | --- | --- | --- |
| Location paths | Absolute and relative paths | Supported | `/root/item`, `./name`, context-relative object/array selector가 선택된 context node 기준으로 평가됩니다. |
| Location paths | Descendant shortcuts | Supported | `//item`, `.//item`, mixed descendant step을 XPath runtime이 평가합니다. |
| Location paths | 13 axes | Supported | `ancestor`, `ancestor-or-self`, `attribute`, `child`, `descendant`, `descendant-or-self`, `following`, `following-sibling`, `namespace`, `parent`, `preceding`, `preceding-sibling`, `self`를 구현합니다. |
| Node tests | Name, wildcard, namespace wildcard, node-type tests | Supported | Element/attribute names, `*`, `prefix:*`, `node()`, `text()`, `comment()`, `processing-instruction()`이 step matching에 참여합니다. |
| Predicates | Numeric, boolean, positional, nested predicates | Supported | `position()`과 `last()`를 포함해 predicate context size와 position을 유지합니다. |
| Operators | Boolean, equality, relational, arithmetic, union operators | Supported | `or`, `and`, `=`, `!=`, `<`, `<=`, `>`, `>=`, `+`, `-`, `*`, `div`, `mod`, unary minus, `|`를 XPath-style conversion으로 평가합니다. |
| Core function library | Node-set, string, boolean, number functions | Supported | XPath 1.0 core function library인 `last`, `position`, `count`, `id`, `local-name`, `namespace-uri`, `name`, `string`, `concat`, `starts-with`, `contains`, `substring-before`, `substring-after`, `substring`, `string-length`, `normalize-space`, `translate`, `boolean`, `not`, `true`, `false`, `lang`, `number`, `sum`, `floor`, `ceiling`, `round`를 구현합니다. |
| Namespaces | Prefix resolution | Supported | Converter `xpathNamespaces` 옵션과 document model의 namespace node로 prefix를 해석합니다. |
| Variables | Variable references | Not exposed | `$name` 문법은 XPath 문법으로 인식되지만 converter API에 variable binding parameter가 없어서 평가 시 throw합니다. |
| Extension functions | Non-core custom functions | Not exposed | 알 수 없는 함수는 host-provided extension callback을 호출하지 않고 throw합니다. |
| XML ID model | DTD ID typing | Partial | `id()`는 일반적인 `id` 속성 형태를 지원하지만 XML parser가 DTD를 검증하거나 typed ID attribute를 XPath에 제공하지 않습니다. |
| XML language model | `lang()` inheritance | Supported | `xml:lang`을 ancestor chain에서 해석합니다. |
| Entity/DTD layer | Entity expansion and DTD-derived metadata | Partial | XPath는 XML parsing 이후에 실행됩니다. lightweight parser는 일반 text/entity 처리를 수행하지만 validating DTD metadata는 XPath에 제공하지 않습니다. |
| Unicode character semantics | Non-BMP `string-length()` and `substring()` behavior | Limited | 현재 string function은 JavaScript string 위에서 동작합니다. BMP 동작은 지원하지만 supplementary-plane character semantics를 정확한 XPath character semantics로 보장하지는 않습니다. |
| Streaming | Full XPath over streaming input | Not exposed | Full XPath 평가는 lightweight in-memory document tree가 필요합니다. Streaming reader surface는 parser surface이며 XPath evaluator surface가 아닙니다. |
