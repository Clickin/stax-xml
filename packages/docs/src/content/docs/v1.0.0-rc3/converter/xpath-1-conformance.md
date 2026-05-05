---
title: Converter - XPath 1.0 Conformance
description: XPath 1.0 conformance matrix for the public converter surface
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/xpath-guide.png
slug: v1.0.0-rc3/converter/xpath-guide/xpath-1-conformance
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
- **Limited**: available for common XML text, but not guaranteed for the full
  XPath 1.0 edge-case semantics described in the note.

| XPath 1.0 area | Feature | Status | Converter behavior |
| --- | --- | --- | --- |
| Location paths | Absolute and relative paths | Supported | `/root/item`, `./name`, and context-relative object/array selectors evaluate against the selected context node. |
| Location paths | Descendant shortcuts | Supported | `//item`, `.//item`, and mixed descendant steps are evaluated by the XPath runtime. |
| Location paths | 13 axes | Supported | `ancestor`, `ancestor-or-self`, `attribute`, `child`, `descendant`, `descendant-or-self`, `following`, `following-sibling`, `namespace`, `parent`, `preceding`, `preceding-sibling`, and `self` are implemented. |
| Node tests | Name, wildcard, namespace wildcard, and node-type tests | Supported | Element/attribute names, `*`, `prefix:*`, `node()`, `text()`, `comment()`, and `processing-instruction()` participate in step matching. |
| Predicates | Numeric, boolean, positional, and nested predicates | Supported | Predicate context size and position are maintained, including `position()` and `last()`. |
| Operators | Boolean, equality, relational, arithmetic, and union operators | Supported | `or`, `and`, `=`, `!=`, `<`, `<=`, `>`, `>=`, `+`, `-`, `*`, `div`, `mod`, unary minus, and `|` are evaluated with XPath-style conversions. |
| Core function library | Node-set, string, boolean, and number functions | Supported | The XPath 1.0 core function library is implemented: `last`, `position`, `count`, `id`, `local-name`, `namespace-uri`, `name`, `string`, `concat`, `starts-with`, `contains`, `substring-before`, `substring-after`, `substring`, `string-length`, `normalize-space`, `translate`, `boolean`, `not`, `true`, `false`, `lang`, `number`, `sum`, `floor`, `ceiling`, and `round`. |
| Namespaces | Prefix resolution | Supported | Prefixes are resolved from converter `xpathNamespaces` options and from namespace nodes in the document model. |
| Variables | Variable references | Not exposed | `$name` syntax is recognized as XPath syntax, but the converter API has no variable binding parameter, so variable evaluation throws. |
| Extension functions | Non-core custom functions | Not exposed | Unknown functions throw instead of calling host-provided extension callbacks. |
| XML ID model | DTD ID typing | Partial | `id()` is supported for the common `id` attribute shape, but the XML parser does not validate DTDs or expose typed ID attributes. |
| XML language model | `lang()` inheritance | Supported | `xml:lang` is resolved through ancestors. |
| Entity/DTD layer | Entity expansion and DTD-derived metadata | Partial | XPath runs after XML parsing. The lightweight parser handles ordinary text/entities needed by converter tests, but it does not provide validating DTD metadata to XPath. |
| Unicode character semantics | Non-BMP `string-length()` and `substring()` behavior | Limited | Current string functions operate on JavaScript strings. BMP behavior is covered; supplementary-plane character semantics are not yet guaranteed as exact XPath character semantics. |
| Streaming | Full XPath over streaming input | Not exposed | Full XPath evaluation requires a lightweight in-memory document tree. Streaming reader surfaces remain parser surfaces, not XPath evaluator surfaces. |
