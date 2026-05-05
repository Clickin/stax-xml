---
title: Converter - XPath 1.0 Conformance
description: XPath 1.0 conformance matrix for the public converter surface
slug: converter/xpath-guide/xpath-1-conformance
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/xpath-guide.png
---

This matrix describes the public converter XPath surface. XPath expressions are
evaluated by the TypeScript XPath 1.0 runtime over the converter's lightweight
document tree.

Status values:

- **Supported**: covered by converter XPath tests and available through
  `x.*().xpath(...)`.
- **Partial**: the expression parses and evaluates, but XML parser metadata or
  host integration does not expose the complete XPath 1.0 semantics.
- **Not exposed**: XPath 1.0 defines the concept, but the converter public API
  does not currently provide the corresponding binding surface.
- **Needs audit**: implemented through JavaScript string operations where exact
  XPath character semantics need additional non-BMP verification.

| XPath 1.0 area | Feature | Status | Converter behavior | Verification anchor |
| --- | --- | --- | --- | --- |
| Location paths | Absolute and relative paths | Supported | `/root/item`, `./name`, and context-relative object/array selectors evaluate against the selected context node. | `test/converter/xpath-1-full.test.ts` |
| Location paths | Descendant shortcuts | Supported | `//item`, `.//item`, and mixed descendant steps are evaluated by the XPath runtime. | `test/converter/xpath-1-full.test.ts` |
| Location paths | 13 axes | Supported | `ancestor`, `ancestor-or-self`, `attribute`, `child`, `descendant`, `descendant-or-self`, `following`, `following-sibling`, `namespace`, `parent`, `preceding`, `preceding-sibling`, and `self` are implemented. | `test/converter/xpath-1-coverage.test.ts` |
| Node tests | Name, wildcard, namespace wildcard, and node-type tests | Supported | Element/attribute names, `*`, `prefix:*`, `node()`, `text()`, `comment()`, and `processing-instruction()` participate in step matching. | `test/converter/xpath-1-coverage.test.ts` |
| Predicates | Numeric, boolean, positional, and nested predicates | Supported | Predicate context size and position are maintained, including `position()` and `last()`. | `test/converter/xpath-1-full.test.ts` |
| Operators | Boolean, equality, relational, arithmetic, and union operators | Supported | `or`, `and`, `=`, `!=`, `<`, `<=`, `>`, `>=`, `+`, `-`, `*`, `div`, `mod`, unary minus, and `|` are evaluated with XPath-style conversions. | `test/converter/xpath-1-full.test.ts` |
| Core function library | Node-set, string, boolean, and number functions | Supported | The XPath 1.0 core function library is implemented: `last`, `position`, `count`, `id`, `local-name`, `namespace-uri`, `name`, `string`, `concat`, `starts-with`, `contains`, `substring-before`, `substring-after`, `substring`, `string-length`, `normalize-space`, `translate`, `boolean`, `not`, `true`, `false`, `lang`, `number`, `sum`, `floor`, `ceiling`, and `round`. | `test/converter/xpath-1-full.test.ts` |
| Namespaces | Prefix resolution | Supported | Prefixes are resolved from converter `xpathNamespaces` options and from namespace nodes in the document model. | `test/converter/xpath-1-coverage.test.ts` |
| Variables | Variable references | Not exposed | `$name` syntax is recognized as XPath syntax, but the converter API has no variable binding parameter, so variable evaluation throws. | `test/converter/xpath-1-coverage.test.ts` |
| Extension functions | Non-core custom functions | Not exposed | Unknown functions throw instead of calling host-provided extension callbacks. | `test/converter/xpath-1-coverage.test.ts` |
| XML ID model | DTD ID typing | Partial | `id()` is supported for the common `id` attribute shape, but the XML parser does not validate DTDs or expose typed ID attributes. | `test/converter/xpath-1-full.test.ts` |
| XML language model | `lang()` inheritance | Supported | `xml:lang` is resolved through ancestors. | `test/converter/xpath-1-full.test.ts` |
| Entity/DTD layer | Entity expansion and DTD-derived metadata | Partial | XPath runs after XML parsing. The lightweight parser handles ordinary text/entities needed by converter tests, but it does not provide validating DTD metadata to XPath. | XML parser and converter tests |
| Unicode character semantics | Non-BMP `string-length()` and `substring()` behavior | Needs audit | Current string functions operate on JavaScript strings. BMP behavior is covered; supplementary-plane character semantics require dedicated conformance tests before claiming exact XPath character behavior. | Gap item |
| Streaming | Full XPath over streaming input | Not exposed | Full XPath evaluation requires a lightweight in-memory document tree. Streaming reader surfaces remain parser surfaces, not XPath evaluator surfaces. | API contract |

## Current Claim

The converter has broad XPath 1.0 coverage for ordinary XML selection,
predicates, axes, operators, namespaces, and the core function library. It should
not be described as fully XPath 1.0 conformant without qualifying the missing
variable binding API, lack of DTD ID typing, and unresolved non-BMP character
semantics.
