---
title: Converter - Selector Conformance
description: Streaming selector boundary for the public converter surface
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/converter/xpath-guide.png
slug: v1.0.0/converter/xpath-1-conformance
---

The converter implements a streaming XPath-shaped selector subset, not a full
XPath 1.0 evaluator.

| Capability | Status | Public behavior |
| --- | --- | --- |
| Absolute child paths | Supported | `/a/b/c` |
| Leading descendant path | Supported | `//item/name`; nested `//` is rejected. |
| Relative contextual path | Supported | `./name` inside an object or array item. |
| Current contextual element | Supported | `.` |
| Attribute terminal | Supported | `./@id` |
| Direct text terminal | Supported | `./text()` |
| Positive positional predicate | Supported | `item[2]`; positions are 1-based. |
| Qualified names | Lexical | `p:item` matches the exact XML QName. There is no external namespace binding option. |
| Wildcards and arbitrary predicates | Unsupported | Rejected before parsing. |
| Axes, unions, operators, variables | Unsupported | Rejected before parsing. |
| XPath function library | Unsupported | No general function evaluator or tree fallback is included. |
| DOM/tree materialization | Not used | All supported selectors run over streaming tokens. |

Unsupported expressions throw an `Unsupported streaming XPath` error. Adding a
new selector form is backward-compatible, but the table above is the 1.0
contract.
