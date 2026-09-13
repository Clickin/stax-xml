# Iterable Parser Optimization Dossier

Date: 2026-04-23
Audience: external LLM deep research / performance review
Repository: `G:\programming\stax-xml`

## Purpose

This dossier summarizes what has already been tried while attempting to make
the `stax-xml` iterable parser approach Woodstox-class under string-return and
object-materialization workloads.

The intended use is to give another LLM enough context to propose only genuinely
new optimization hypotheses. If the remaining hypotheses also fail, the project
should document in the README that the generic iterable parser is close to the
practical V8 limit for this API shape, and that further large gains likely need
a different boundary such as schema-known converter materialization.

## Research Prompt For The Next LLM

Please review this dossier and propose additional optimization hypotheses for
the generic iterable parser only if they satisfy these constraints:

- Preserve StAX-style event pull semantics.
- Do not switch to full DOM.
- Do not require a user-facing mode flag such as `aggregateMode`,
  `checksumMode`, `denseMode`, or `fastMode`.
- Do not rely on knowing the user's workload at build time.
- Avoid dynamic hot-loop branches whose miss path is common or unpredictable.
- Avoid lazy first-access parsing or rescanning of attribute/text substrings.
- Avoid cache/pool designs unless lookup cost, branch cost, hit rate, and
  collision checks are explicitly accounted for.
- Compare against `quick-xml` and Woodstox under the same scenario contract.
- Use full-string/object-materialization workloads as primary; byte-only
  throughput is only a diagnostic upper bound.

Good output would be a short list of concrete, falsifiable hypotheses with:

- the exact parser layer to change,
- why it is not a previously failed idea,
- expected effect on `count-only`, `attr-object-loop`, and `full-string`,
- expected risks for V8 hidden classes, inline caches, GC, branch prediction,
  and string representation,
- an A/B or A/B/AB benchmark design.

## Current Parser Shape

The current iterable parser is not a DOM parser. It is a batch/event-frame
producer over byte buffers.

This document is intended to be standalone. File paths are included for local
follow-up, but the important code shapes, benchmark semantics, and measured
results are embedded below so a web-based LLM can reason without repository
access.

Relevant files:

- `packages/stax-xml/src/StaxXmlIterableParser.ts`
- `packages/stax-xml/src/iterable/node.ts`
- `packages/benchmark/node-string-return.mjs`
- `packages/benchmark/iterable-attr-materialization.mjs`
- `packages/benchmark/sax-object-shape.mjs`

Core properties:

- Neutral parser input: `Iterable<readonly Uint8Array[]>`.
- Node parser input: `Iterable<readonly Buffer[]>`.
- Event frames are typed-array-backed.
- Element and attribute names are interned by byte hash into `nameStrings`.
- Text and attribute values are materialized on demand through `copyText()` and
  `copyAttrValue()`.
- The Node parser uses `Buffer.toString('utf8', start, end)` in `decodeSpan()`.
- The neutral parser uses `TextDecoder.decode(currentBuffer.subarray(...))`.
- `copyAttributesObject()` exists in the current working tree as an experiment
  that fills a `Record<string, string>` for one event.
- The current working tree also contains an experimental
  `attributeScanner: 'simple'` option for the Node iterable parser. It has not
  been promoted as a default optimization.

Important line references from the current working tree:

- Neutral `decodeSpan` / `copyText` / `copyAttrValue`:
  `packages/stax-xml/src/StaxXmlIterableParser.ts:176`, `:189`, `:205`.
- Node `decodeSpan` / `copyText` / `copyAttrValue`:
  `packages/stax-xml/src/iterable/node.ts:187`, `:200`, `:216`.
- Node experimental simple attr scanner:
  `packages/stax-xml/src/iterable/node.ts:461`,
  `packages/stax-xml/src/iterable/node.ts:468`.
- Iterable attr benchmark scenarios and tiers:
  `packages/benchmark/iterable-attr-materialization.mjs:14`,
  `packages/benchmark/iterable-attr-materialization.mjs:15`.

### Hot Path Sketch

The Node iterable parser stores spans and materializes strings only when the
consumer asks for them:

```ts
decodeSpan(start: number, end: number): string {
  return this.currentBuffer.toString('utf8', start, end);
}

copyName(index: number): string | undefined {
  const nameId = this.nameIdsForEvents[index]!;
  if (nameId >= 0) return this.nameStrings[nameId];
  const start = this.nameStarts[index]!;
  return start < 0 ? undefined : this.decodeSpan(start, this.nameEnds[index]!);
}

copyText(index: number): string | undefined {
  const start = this.textStarts[index]!;
  return start < 0 ? undefined : this.decodeSpan(start, this.textEnds[index]!);
}

copyAttrName(eventIndex: number, attrIndex: number): string | undefined {
  const index = this.attrStarts[eventIndex]! + attrIndex;
  const nameId = this.attrNameIds[index]!;
  return nameId >= 0
    ? this.nameStrings[nameId]
    : this.decodeSpan(this.attrNameStarts[index]!, this.attrNameEnds[index]!);
}

copyAttrValue(eventIndex: number, attrIndex: number): string | undefined {
  return this.decodeSpan(
    this.attrValueStart(eventIndex, attrIndex),
    this.attrValueEnd(eventIndex, attrIndex),
  );
}
```

The experimental `copyAttributesObject()` avoids repeated public helper calls,
but still creates a dynamic object and decodes every value:

```ts
copyAttributesObject(eventIndex: number): Record<string, string> {
  const count = this.attrCounts[eventIndex]!;
  if (count === 0) return {};

  const attributes: Record<string, string> = {};
  let attrIndex = this.attrStarts[eventIndex]!;
  const attrEnd = attrIndex + count;
  while (attrIndex < attrEnd) {
    const nameId = this.attrNameIds[attrIndex]!;
    const name = nameId >= 0
      ? this.nameStrings[nameId]!
      : this.decodeSpan(this.attrNameStarts[attrIndex]!, this.attrNameEnds[attrIndex]!);
    attributes[name] = this.decodeSpan(this.attrValueStarts[attrIndex]!, this.attrValueEnds[attrIndex]!);
    attrIndex++;
  }
  return attributes;
}
```

The start-tag path records the element name, parses attribute spans, then records
`attrStart` and `attrCount` for the event:

```ts
private parseStartTag(buffer: Buffer, position: number, isFinal: boolean): number {
  const tagEnd = findTagEnd(buffer, position + 1);
  let actualEnd = tagEnd;
  while (actualEnd > position + 1 && isWhitespace(buffer[actualEnd - 1]!)) actualEnd--;

  let selfClosing = false;
  if (actualEnd > position + 1 && buffer[actualEnd - 1] === 47) {
    selfClosing = true;
    actualEnd--;
    while (actualEnd > position + 1 && isWhitespace(buffer[actualEnd - 1]!)) actualEnd--;
  }

  let nameStart = position + 1;
  let nameEnd = nameStart;
  while (nameEnd < actualEnd) {
    const byte = buffer[nameEnd]!;
    if (isWhitespace(byte) || byte === 47 || byte === 62) break;
    nameEnd++;
  }

  const nameId = this.internName(buffer, nameStart, nameEnd);
  const eventIndex = this.addEvent(START_ELEMENT, nameStart, nameEnd, -1, -1, nameId);
  const attrStart = this.attrCursor;
  this.parseAttributes(buffer, nameEnd, actualEnd);
  this.attrStarts[eventIndex] = attrStart;
  this.attrCounts[eventIndex] = this.attrCursor - attrStart;

  if (selfClosing) this.addEvent(END_ELEMENT, nameStart, nameEnd, -1, -1, nameId);
  else this.elementNameIds.push(nameId);
  return tagEnd + 1;
}
```

The general attribute scanner is simple and branch-light:

```ts
private parseAttributesGeneral(buffer: Buffer, start: number, end: number): void {
  let index = start;
  while (index < end) {
    while (index < end && isWhitespace(buffer[index]!)) index++;
    if (index >= end) break;

    const nameStart = index;
    while (index < end) {
      const byte = buffer[index]!;
      if (byte === 61 || isWhitespace(byte)) break;
      index++;
    }
    const nameEnd = index;

    while (index < end && isWhitespace(buffer[index]!)) index++;
    if (index >= end || buffer[index] !== 61) {
      this.addAttribute(buffer, nameStart, nameEnd, nameStart, nameEnd);
      continue;
    }

    index++;
    while (index < end && isWhitespace(buffer[index]!)) index++;
    if (index >= end) break;

    const quote = buffer[index]!;
    if (quote !== 34 && quote !== 39) break;
    index++;
    const valueStart = index;
    while (index < end && buffer[index] !== quote) index++;
    const valueEnd = index;
    this.addAttribute(buffer, nameStart, nameEnd, valueStart, valueEnd);
    index++;
  }
}
```

The experimental simple quoted scanner adds a fallback branch. It only accepts
`name="value"` or `name='value'` without whitespace around `=`. If it sees
whitespace in the name/equals area, missing `=`, or unquoted values, it resets
`attrCursor` and falls back to the general scanner:

```ts
private tryParseSimpleQuotedAttributes(buffer: Buffer, start: number, end: number): boolean {
  const initialAttrCursor = this.attrCursor;
  let index = start;
  while (index < end) {
    while (index < end) {
      const byte = buffer[index]!;
      if (byte !== 32 && byte !== 9 && byte !== 10 && byte !== 13) break;
      index++;
    }
    if (index >= end) break;

    const nameStart = index;
    while (index < end) {
      const byte = buffer[index]!;
      if (byte === 61) break;
      if (byte === 32 || byte === 9 || byte === 10 || byte === 13 || byte === 34 || byte === 39) {
        this.attrCursor = initialAttrCursor;
        return false;
      }
      index++;
    }
    if (index >= end || index === nameStart || buffer[index] !== 61) {
      this.attrCursor = initialAttrCursor;
      return false;
    }
    const nameEnd = index;

    index++;
    if (index >= end) {
      this.attrCursor = initialAttrCursor;
      return false;
    }
    const quote = buffer[index]!;
    if (quote !== 34 && quote !== 39) {
      this.attrCursor = initialAttrCursor;
      return false;
    }
    index++;
    const valueStart = index;
    while (index < end && buffer[index] !== quote) index++;
    if (index >= end) {
      this.attrCursor = initialAttrCursor;
      return false;
    }
    const valueEnd = index;
    this.addAttribute(buffer, nameStart, nameEnd, valueStart, valueEnd);
    index++;
  }
  return true;
}
```

### Benchmark Consumer Shapes

The key iterable attr benchmark consumes parser batches like this:

```ts
while (parser.nextBatch()) {
  for (let index = 0; index < parser.eventCount(); index++) {
    const type = parser.eventType(index);
    const attrCount = parser.attrCount(index);
    checksum = mixChecksum(checksum, type);

    if (tier === 'count-only') {
      attrCountTotal += attrCount;
      checksum = mixChecksum(checksum, attrCount);
    } else if (tier === 'attr-object-loop') {
      if (type === START_ELEMENT) {
        const attributes = {};
        for (let attr = 0; attr < attrCount; attr++) {
          attributes[parser.copyAttrName(index, attr)] = parser.copyAttrValue(index, attr);
        }
        checksum = checksumAttributesObject(checksum, attributes);
      }
    } else if (tier === 'attr-object-batch') {
      if (type === START_ELEMENT) {
        const attributes = parser.copyAttributesObject(index);
        checksum = checksumAttributesObject(checksum, attributes);
      }
    } else if (tier === 'attr-direct-loop') {
      if (type === START_ELEMENT) {
        checksum = checksumAttributesDirect(parser, index, attrCount, checksum);
      }
    } else if (tier === 'full-string-loop') {
      checksum = consumeFullStringLoop(parser, index, type, attrCount, checksum);
    } else if (tier === 'full-string-direct') {
      checksum = consumeFullStringDirect(parser, index, type, attrCount, checksum);
    }
  }
}
```

The important distinction:

- `attr-object-loop` and `full-string-loop` build dynamic JS attribute objects.
- `attr-direct-loop` and `full-string-direct` avoid object traversal and are
  diagnostic only; they are not a generic product API.
- `count-only` parses events and attribute spans but does not materialize
  strings.

## Benchmark Contract

The benchmark contract was narrowed over the investigation:

- Primary target is string-return and object-materialization, not raw byte scan.
- XML is parsed as events. At minimum, all start elements and text events are
  visited.
- Full checksum folds event type, names, text, and attribute values.
- Whitespace-only text is skipped.
- Text is trimmed before checksum.
- Entity decode is off unless specifically stated.
- Namespace is off unless specifically stated.
- Comments, PI, and DOCTYPE are skipped.
- CDATA is a separate event.
- Comparator baselines are Woodstox and `quick-xml`.

Earlier accepted gate for the Node string-return line:

- Full-string improvement: at least `10%` or at least `190 MiB/s`.
- Count-only regression: under `3%`.

## Baseline Gap: String Return Is The Problem

Primary artifact:

- `packages/benchmark/results/node-string-return-primary-20260422-195118.json`

512 MiB / 1024 MiB full-string throughput summary:

| Fixture | Size | Neutral | Node | Woodstox | quick-xml |
| --- | ---: | ---: | ---: | ---: | ---: |
| repeated-ascii | 512 MiB | 55.3 | 78.8 | 149.8 | 152.7 |
| high-cardinality | 512 MiB | 91.2 | 87.8 | 191.4 | 200.0 |
| mixed-utf8 | 512 MiB | 75.8 | 81.9 | 161.4 | 164.1 |
| repeated-ascii | 1024 MiB | 74.9 | 85.1 | 148.8 | 152.5 |
| high-cardinality | 1024 MiB | 91.8 | 88.3 | 183.7 | 200.8 |
| mixed-utf8 | 1024 MiB | 77.2 | 82.5 | 157.5 | 163.0 |

Count-only parser throughput was often already comparable to or faster than the
external comparators in these generated fixtures. For example, at 1024 MiB:

- high-cardinality count-only: neutral `268.1 MiB/s`, node `256.2 MiB/s`,
  Woodstox `207.8 MiB/s`, quick-xml `226.3 MiB/s`.
- mixed-utf8 count-only: neutral `227.8 MiB/s`, node `211.0 MiB/s`,
  Woodstox `170.2 MiB/s`, quick-xml `181.7 MiB/s`.

Interpretation: raw scanning is not the main remaining gap. The gap appears
when JS strings and dynamic attribute objects are materialized.

## Prior Research Documents And Their Hypotheses

Input documents in the workspace:

- `CHATGPT_XML 파싱 최적화 방법.md`
- `CHATGPT_deep-research-report.md`
- `GEMINI_RESEARCH.md`

Main claims extracted from those documents:

- JS has no public zero-copy API that aliases UTF-8 bytes as JS strings.
- `Uint8Array`/`Buffer` can be sliced or viewed without copying, but string
  materialization is a separate layer.
- Token positions can be found in bytes, but byte offset to UTF-16 string offset
  mapping is only valid for raw lexical spans, not entity-normalized semantic
  values.
- Page or batch decode may reduce `TextDecoder.decode()` call frequency, but it
  needs strict UTF-8 validation, carry handling, and BOM rules.
- QName / local name / attribute-name pooling is plausible because names repeat.
- Attribute value pooling is much riskier because values may be high-cardinality.
- Dynamic decode routing for short ASCII / short UTF-8 / long native decode was
  proposed, but it introduces hot-loop branch complexity.
- Cross-chunk no-concat strategies are useful mostly for scan throughput and
  long text handling.
- Wasm is not automatically blocked by memory copying; its main problem here is
  many small JS/Wasm boundary crossings and JS string/event object creation.
- Native/Rust can be useful for coarse aggregate, but native-to-JS per-event and
  per-string materialization erodes the benefit.

Corrections made during this investigation:

- An "adaptive text cache" hypothesis was introduced by mistake and dropped. It
  was not part of the original three research docs.
- The intended goal is not to invent new generic cache hypotheses, but to verify
  document-backed hypotheses and preserve negative results.

## Hypotheses Already Tested

### H1. Node `Buffer.toString()` Instead Of Neutral `TextDecoder`

Boundary:

- Node-only iterable subpath/class.
- Neutral parser remains Buffer-free.

Result:

- Helped repeated ASCII full-string workloads.
- Did not close the Woodstox / quick-xml gap.
- Was sometimes neutral or worse on high-cardinality and mixed UTF-8.

Evidence:

- `packages/benchmark/results/node-string-return-primary-20260422-195118.json`

Conclusion:

- Keep Node-only decode path as a useful platform specialization, but it is not
  a breakthrough.

### H2. Short ASCII JS Decode

Artifacts:

- `packages/benchmark/results/node-string-return-real-short-ascii.json`
- `packages/benchmark/results/node-string-return-real-short-ascii-16-all-tiers.json`

Results on repeated-ascii:

| Size | Tier | Neutral | short-ascii-js-16 |
| ---: | --- | ---: | ---: |
| 512 MiB | full-string | 72.4 | 80.2 |
| 1024 MiB | full-string | 74.6 | 85.1 |
| 512 MiB | attr-value-string-only | 128.3 | 169.7 |
| 1024 MiB | attr-value-string-only | 127.8 | 176.9 |

But count-only movement was not always clean:

- 512 MiB count-only: neutral `210.2`, short-ascii-js-16 `202.1`.
- 1024 MiB count-only: neutral `204.6`, short-ascii-js-16 `207.2`.

Conclusion:

- Useful signal on repeated ASCII.
- Not enough by itself for robust promotion because the gate was unstable and
  fixture coverage was narrow.

### H3. ASCII Chunk Cache / Sliced String Avoidance

Artifacts:

- `packages/benchmark/results/node-string-return-real-ascii-chunk-cache.json`
- `packages/benchmark/results/node-string-return-hypothesis-matrix-20260422-201625.json`

Mixed evidence:

- 1024 MiB repeated-ascii full-string:
  - neutral `71.2`
  - short-ascii-js-16 `83.0`
  - ascii-chunk-cache-slice `95.3`
  - ascii-chunk-cache-copy-small `87.8`
- 512 MiB repeated-ascii full-string:
  - neutral `73.8`
  - ascii-chunk-cache-slice `85.4`
  - ascii-chunk-cache-copy-small `87.2`
- But high-cardinality and mixed-utf8 did not show stable broad wins:
  - high-cardinality 512 MiB full-string in matrix:
    neutral `90.3`, ascii-chunk-cache-slice `112.6`,
    ascii-chunk-cache-copy-small `109.3`, but cache combined with attr-value
    cache collapsed back near baseline.
  - mixed-utf8 512 MiB full-string in matrix:
    neutral `75.2`, ascii-chunk-cache-slice `72.6`,
    ascii-chunk-cache-copy-small `72.9`.

Memory concern from previous summary:

- `ascii-chunk-cache-slice` showed large retention RSS deltas in real runs
  (`+411.6 MiB` at 512 MiB, `+822.4 MiB` at 1024 MiB).

Conclusion:

- Do not promote. Sliced/chunk string retention and fixture instability are too
  risky.

### H4. Attr Value Tiny Cache

Artifacts:

- `packages/benchmark/results/node-string-return-real-attr-value-cache.json`
- `packages/benchmark/results/node-string-return-hypothesis-matrix-20260422-201625.json`

Repeated-ascii showed gains:

| Size | Tier | Neutral | attr-value-tiny-cache |
| ---: | --- | ---: | ---: |
| 512 MiB | attr-value-string-only | 111.6 | 137.9 |
| 512 MiB | full-string | 72.2 | 80.5 |
| 1024 MiB | attr-value-string-only | 113.0 | 133.9 |
| 1024 MiB | full-string | 62.5 | 79.6 |

But matrix evidence showed instability:

- high-cardinality 512 MiB full-string:
  neutral `90.3`, attr-value-tiny-cache `84.6`.
- mixed-utf8 512 MiB full-string:
  neutral `75.2`, attr-value-tiny-cache `77.4`.
- Combined variants often failed to compose.

Conceptual issue:

- Attribute values may be high-cardinality.
- A Map/cache lookup can cost more than the saved decode when hit rate is low.
- A string-keyed cache is useless if the string must already be decoded.
- A byte-keyed cache needs hash, length, ASCII flag, collision checks, and
  branch management.

Conclusion:

- Do not retry generic attr-value cache without a fundamentally different proof
  that lookup/branch/hit-rate costs are dominated.

### H5. Page Dual-View / Boundary Bridge

Artifacts:

- `packages/benchmark/results/node-string-return-hypothesis4-page-dual-view-regular-20260422-2127.json`
- `packages/benchmark/results/node-string-return-hypothesis4-page-dual-view-cross-chunk-20260422-2130.json`
- related H5 boundary bridge smoke/mixed results.

Research-doc claim:

- Decode once per page and map byte offsets to UTF-16 indices.

Practical blockers:

- Public JS cannot zero-copy alias UTF-8 bytes into JS strings.
- Mapping raw lexical spans does not solve semantic value normalization.
- Carry/BOM/fatal UTF-8 correctness must be handled.
- Big decoded page strings can retain memory or create sliced-string problems.

Conclusion:

- Useful as a research direction, but the tested artifacts did not provide a
  clear product-ready win for generic string-return parsing.

### H6. Wasm Parser And Wasm JS String Materialization

Artifacts:

- `packages/benchmark/results/node-string-return-wasm-js-string-regular-20260422-2152.json`
- `packages/benchmark/results/node-string-return-wasm-js-string-cross-chunk-20260422-2158.json`
- Native/Wasm branch: `experiment/native-napi-aggregate`

128 MiB regular fixtures:

| Fixture | Tier | Neutral | Node | Woodstox | quick-xml | wasm-parser | wasm-js-string |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| repeated-ascii | full-string | 64.9 | 74.1 | 147.7 | 149.6 | 522.1 | 87.3 |
| high-cardinality | full-string | 83.2 | 93.9 | 181.8 | 199.0 | 563.0 | 113.4 |
| mixed-utf8 | full-string | 69.4 | 75.0 | 155.1 | 160.4 | 528.0 | 83.3 |

128 MiB cross-chunk long text:

| Tier | Neutral | Node | Woodstox | quick-xml | wasm-parser | wasm-js-string |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| full-string | 247.1 | 246.4 | 476.8 | 694.1 | 549.9 | 482.8 |

Interpretation:

- Raw Wasm parser numbers were very high.
- Once JS strings were materialized, regular XML workloads dropped near JS
  parser territory and remained far below Woodstox/quick-xml.
- Cross-chunk long text was a special case where Wasm JS string could be closer
  to Woodstox, but it is not representative of attribute-heavy object
  materialization.

Conclusion:

- Wasm is not a generic answer for a JS event/string pull API.
- It can be reconsidered only for coarse-grained aggregate or if most parsing
  and materialization remain inside Wasm/native.

### H7. Native Rust / N-API Aggregate

Branch:

- `experiment/native-napi-aggregate`
- Commit: `1ea88e5 Preserve native parsing experiments`

Artifacts on that branch:

- `packages/benchmark/results/node-string-return-native-aggregate-512m-full-20260422-2223.json`
- `packages/benchmark/results/node-string-return-event-object-full-512m-20260422-2254.json`
- `packages/benchmark/results/node-string-return-event-object-512m-20260422-2244.json`

512 MiB native aggregate full-string:

| Fixture | Neutral | Node | Woodstox | quick-xml | native-aggregate | wasm-parser | wasm-js-string |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| repeated-ascii | 76.3 | 84.4 | 149.8 | 153.5 | 565.7 | 515.2 | 87.7 |
| high-cardinality | 91.7 | 95.3 | 167.4 | 199.5 | 629.7 | 556.5 | 114.1 |
| mixed-utf8 | 73.4 | 78.5 | 156.0 | 167.0 | 574.7 | 526.2 | 86.1 |
| cross-chunk-long-text | 229.5 | 206.4 | 429.3 | 718.8 | 935.0 | 607.4 | 491.5 |

But when event objects and JS strings were materialized:

| Fixture | Tier | Neutral | Node | Woodstox | quick-xml | native-aggregate | wasm-parser | wasm-js-string |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| repeated-ascii | event-object-full | 76.7 | 81.4 | 145.2 | 166.3 | 100.2 | 102.4 | 103.1 |
| high-cardinality | event-object-full | 82.4 | 87.9 | 158.7 | 187.0 | 114.7 | 119.8 | 115.9 |
| mixed-utf8 | event-object-full | 59.7 | 62.7 | 115.1 | 128.2 | 70.2 | 86.9 | 100.5 |
| cross-chunk-long-text | event-object-full | 193.0 | 354.6 | 432.5 | 785.7 | 611.7 | 498.9 | 500.9 |

And for "startElement + text event object" only:

| Fixture | Tier | Neutral | Node | Woodstox | quick-xml | native-aggregate |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| repeated-ascii | event-object-start-text | 116.3 | 116.6 | 218.5 | 278.8 | 182.3 |
| high-cardinality | event-object-start-text | 149.4 | 151.9 | 264.5 | 372.0 | 241.6 |
| mixed-utf8 | event-object-start-text | 111.1 | 111.8 | 223.9 | 299.4 | 170.3 |
| cross-chunk-long-text | event-object-start-text | 434.6 | 551.4 | 433.5 | 803.4 | 633.5 |

Conclusion:

- Native aggregate is extremely fast when it avoids per-event JS object/string
  creation.
- Native is not a shortcut for the generic JS string/object event API.
- The native branch is preserved separately; master returned to the JS parser
  path.

### H8. SAX Parser Comparison With Same Object Shape

Artifacts:

- `packages/benchmark/sax-object-shape.mjs`
- `packages/benchmark/results/sax-object-shape-mixed-utf8-512m-20260423.json`
- `packages/benchmark/results/sax-object-shape-txml-mixed-utf8-128m-20260423.json`
- `packages/benchmark/results/sax-object-shape-txml-baseline-mixed-utf8-512m-20260423.json`

Same object shape:

- START_ELEMENT materializes `{ type, name, attrs: [{ name, value }] }`.
- CHARACTERS/CDATA materializes `{ type, text }`.
- Objects escape through a fixed ring buffer.

512 MiB mixed-utf8 results:

| Parser | Throughput | Notes |
| --- | ---: | --- |
| stax-node | 105.6 MiB/s | fastest streaming parser under same object shape |
| sax-stream | 14.2 MiB/s | much slower |
| sax-string | 17.4 MiB/s | huge memory |
| saxes-stream | 74.1 MiB/s | slower |
| saxes-string | 77.5 MiB/s | huge memory |
| saxophone-stream | 79.6 MiB/s | slower |
| saxophone-string | 95.9 MiB/s | close but huge memory |
| htmlparser2-stream | 76.0 MiB/s | slower |
| htmlparser2-string | 73.6 MiB/s | huge memory |
| xml-stream | failed | `node-expat.node` invalid on current Windows/Node |

txml:

- 128 MiB mixed-utf8: `txml-dom-walk=80.0 MiB/s`, `rss~1554.6 MiB`,
  `heap~1419.4 MiB`.
- 512 MiB txml full DOM was not viable in this line; it OOMed or was excluded
  from the 512 MiB baseline.

Conclusion:

- SAX libraries did not reveal a faster generic streaming object materialization
  strategy.
- txml's DOM strategy is outside the StAX/event-pull contract and has excessive
  memory for large inputs.

### H9. `copyAttributesObject()` Batch Materialization

Artifacts:

- `packages/benchmark/results/iterable-attr-materialization-128m-20260423.json`
- `packages/benchmark/results/iterable-attr-materialization-512m-20260423.json`

Results:

| Fixture | Size | attr-object-loop | attr-object-batch | full-string-loop | full-string-batch |
| --- | ---: | ---: | ---: | ---: | ---: |
| attribute-heavy | 128 MiB | 72.7 | 74.4 | 70.3 | 70.2 |
| mixed-utf8 | 128 MiB | 82.4 | 82.6 | 64.8 | 63.4 |
| attribute-heavy | 512 MiB | 73.9 | 75.6 | 70.3 | 69.9 |
| mixed-utf8 | 512 MiB | 81.7 | 82.2 | 64.6 | 62.6 |

Conclusion:

- Batch copying attributes into an object gives only a small attr-only gain and
  does not improve full-string.
- It does not solve dynamic attribute object shape.

### H10. Direct Attribute Checksum Without Object Traversal

Artifact:

- `packages/benchmark/results/iterable-attr-direct-128m-20260423.json`

Results:

| Fixture | attr-object-loop | attr-direct-loop | full-string-loop | full-string-direct |
| --- | ---: | ---: | ---: | ---: |
| attribute-heavy | 66.1 | 77.9 | 57.3 | 69.9 |
| mixed-utf8 | 69.6 | 70.1 | 48.7 | 55.1 |

Conclusion:

- Avoiding object traversal is a strong diagnostic signal.
- It is not a generic product path because checksum/aggregate-specific direct
  folding requires knowing the consumer workload.
- A user-facing flag for this would be bad UX and would add workload-specific
  branches.

### H11. `parseAttributes` Simple Quoted Fast Path

Current-session experiment:

- Added `attributeScanner: 'simple'` to `StaxXmlNodeIterableParser` in the
  working tree.
- Added `node-simple-attrs` scenario to
  `packages/benchmark/iterable-attr-materialization.mjs`.
- First version used `Buffer.indexOf` for closing quote and was negative.
- Second version used a plain loop for closing quote and was neutral/weakly
  positive in some cases.

Artifacts:

- `packages/benchmark/results/iterable-simple-attrs-loop-128m.json`
- `packages/benchmark/results/iterable-simple-attrs-loop-512m.json`

Results:

| Fixture | Size | Tier | node | node-simple-attrs | Direction |
| --- | ---: | --- | ---: | ---: | --- |
| attribute-heavy | 128 MiB | count-only | 122.5 | 123.1 | +0.5% |
| attribute-heavy | 128 MiB | attr-object-loop | 64.5 | 65.0 | +0.8% |
| attribute-heavy | 128 MiB | full-string-loop | 57.9 | 59.2 | +2.2% |
| mixed-utf8 | 128 MiB | count-only | 98.7 | 98.8 | +0.1% |
| mixed-utf8 | 128 MiB | attr-object-loop | 67.9 | 69.0 | +1.6% |
| mixed-utf8 | 128 MiB | full-string-loop | 51.0 | 51.3 | +0.6% |
| attribute-heavy | 512 MiB | count-only | 122.5 | 123.1 | +0.5% |
| attribute-heavy | 512 MiB | attr-object-loop | 64.8 | 67.5 | +4.2% |
| attribute-heavy | 512 MiB | full-string-loop | 59.1 | 58.4 | -1.2% |
| mixed-utf8 | 512 MiB | count-only | 100.5 | 98.5 | -2.0% |
| mixed-utf8 | 512 MiB | attr-object-loop | 68.2 | 67.7 | -0.7% |
| mixed-utf8 | 512 MiB | full-string-loop | 49.3 | 51.4 | +4.3% |

Conclusion:

- Do not promote as a default yet.
- The result is too weak and fixture-sensitive.
- Keep only as an experimental toggle until a combination test proves stable
  value.

## Cursor And Lazy API Failure Evidence

Primary doc:

- `packages/benchmark/knowledge/reports/cursor/CURSOR_API_FAILURE_DOSSIER_2026-04-18.md`

Key lessons:

- "Cursor = allocation reduction = faster" failed as a broad hypothesis.
- Wrapper allocation was not the center of the problem.
- Cursor laziness often moved cost to access time rather than removing it.
- `parseStartTag` / `parseAttributesFast` remained hot.
- Buffer cursor surface did more work than the release string parser:
  byte span decode, attribute maps, parser snapshots, live view contracts.
- Lazy attr store, `Map`, attribute promotion, repeated `slice`/decode, and
  fallback materialization were not automatically cheaper than stable plain
  parser events.

Representative profile excerpt from that dossier for
`attribute-heavy / cursor-attr-read`:

- `parseAttributesFast`: `44.79%` self time.
- `parseStartTag`: `21.29%`.
- `fromEvent`: `18.78%`.

Published regression snapshot:

- `packages/benchmark/results/published-regression/published-cursor-vs-parser-regression-1776489558318.md`
- `attribute-heavy.xml`: current `675.37 ms`, published `19.64 ms`,
  delta `+3339.0%`, checksum matched.

Parser optimization final report:

- `packages/benchmark/PARSER_OPTIMIZATION_FINAL_REPORT.md`

Successful historical parser optimizations:

- Sync parser state machine / generator removal: `+20.67%`.
- Async parser circular queue / `Array.shift()` removal: about `+15%`.

Failed historical parser optimizations:

- Lazy attribute parsing: `-47.59%`.
- Fast path for simple tags: `-4.53%`.
- String interning: `-8%` to `-10%`.
- Function inlining: `-6.15%`, memory `+52.17%`.
- Object pooling: `0%`.

Important lesson:

- Big algorithmic changes worked.
- Micro-optimizations that added detection, lookup, branch, pool management, or
  lazy accessor complexity usually failed.

## V8 Object Shape Findings

Stable outer event objects are good for V8:

- Same field order.
- Same hidden class.
- Same access path.
- Short-lived monomorphic objects are handled well by young-generation GC.

Dynamic attribute objects are different:

- `attributes: { [attrName]: value }` has a key set that changes by XML shape.
- `attrs[nameStrings[nameId]] = value` avoids attr-name decoding but does not
  make object creation hidden-class friendly.
- Object key insertion order and attr set variability can make inline caches
  polymorphic or megamorphic.
- `Object.keys(attrs)` is slow not only because key traversal costs time, but
  because the preceding dynamic object creation is structurally unfriendly.

Implication:

- A generic iterable parser cannot make arbitrary XML attribute objects fully
  hidden-class friendly.
- Fixed-shape attribute objects are possible only when a converter/schema knows
  the key set in advance.
- That is outside generic iterable parser optimization and belongs to a
  schema-known converter/materializer layer.

## Woodstox `char[]` Analogy And Why It Does Not Port Directly

Woodstox benefits from reusable `char[]` and text buffer machinery. It can
operate on character arrays and expose text through APIs such as
`getTextCharacters`, `getTextStart`, and `getTextLength` style access patterns
depending on usage.

The nearest JS equivalent is not a string cache; it is the existing byte span:

- `buffer`
- `start`
- `end`
- optional metadata

But JS/V8 does not expose a public API to create a JS `String` as a zero-copy
view over a `Uint8Array`, `Buffer`, or `Uint16Array`.

Consequences:

- `DataView` can read bytes/words, but it is not a string view.
- `Buffer.toString()` and `TextDecoder.decode()` allocate JS strings.
- `String.fromCharCode()` also creates a new JS string.
- A large decoded page string plus substring/slice may trigger sliced-string or
  retention risks.
- Native V8 external strings are not a simple JS-level solution; they introduce
  lifetime, finalizer, and cross-boundary complexity.

Implication:

- Woodstox's char-buffer model maps well to internal scan/span metadata, but not
  to generic JS string-return APIs.

## Node `simdutf` Consideration

The user asked whether `simdutf` could improve text decoding performance.

Important context from the current discussion:

- Modern Node already uses `simdutf` in its internal UTF-8 string creation path.
- The main cost in this parser is not just UTF-8 transcoding throughput; it is
  frequent JS string allocation, per-token materialization, and dynamic object
  construction.
- Direct native/simdutf decode into JS strings would still need V8 string
  creation and would add a native boundary if implemented as an addon.

Conclusion:

- `simdutf` is plausible for native aggregate internals.
- It is unlikely to unlock generic per-token JS string-return performance beyond
  Node's existing `Buffer.toString()`/V8 path.

## Current Working Tree State

At the time this dossier was written, `master` had local experimental changes:

- Modified:
  - `packages/benchmark/package.json`
  - `packages/stax-xml/src/StaxXmlIterableParser.ts`
  - `packages/stax-xml/src/iterable/node.ts`
  - `packages/stax-xml/test/iterable-node-parser.test.ts`
  - `packages/stax-xml/test/iterable-parser.test.ts`
- Untracked:
  - `CHATGPT_XML 파싱 최적화 방법.md`
  - `CHATGPT_deep-research-report.md`
  - `GEMINI_RESEARCH.md`
  - `packages/benchmark/iterable-attr-materialization.mjs`
  - `packages/benchmark/sax-object-shape.mjs`
  - this dossier.

These are experiment artifacts, not finalized public API changes.

Verification run during the simple attr scanner experiment:

- `pnpm --dir packages/stax-xml exec vitest run --pool=threads test/iterable-node-parser.test.ts`
  passed: 9 tests.
- `node --check packages/benchmark/iterable-attr-materialization.mjs` passed.
- `pnpm --dir packages/stax-xml build` passed.
- `pnpm --dir packages/stax-xml test` passed: 52 files, 943 tests.

## Decisions So Far

### Keep

- Node-only iterable parser subpath/class for Buffer-specific decode behavior.
- Benchmark artifacts that preserve negative and mixed evidence.
- Typed-array event frames and name interning for element/attribute names.
- StAX/event-pull contract.
- Woodstox and quick-xml as comparators.

### Do Not Promote

- Adaptive text cache.
- Generic attr-value cache.
- ASCII chunk string cache / slice retention path.
- Lazy string materialization that only moves cost to access time.
- Full Wasm parser for the generic JS event/string pull API.
- Native/Rust as the generic event object/string materialization path.
- Generic dynamic attribute object hidden-class optimization via `nameStrings`.
- Simple quoted attr fast path as a default, based on current evidence.

### Preserve Only As Diagnostic

- Byte-span checksum/direct fold.
- Native aggregate.
- Raw Wasm parser.
- `attr-direct-loop`.

These show lower bounds or alternative API ceilings, but they do not solve the
generic iterable parser's public string/object workload.

## Negative Pattern Summary

These patterns have already failed or produced unstable results. A new proposal
should explicitly explain why it is different.

| Pattern | Why it was attractive | What happened | Current stance |
| --- | --- | --- | --- |
| Lazy attr/string materialization | Avoid up-front object/string creation | Moved cost to access time; introduced rescans, branches, accessors, or cache misses | Do not retry generically |
| String / attr-value interning | XML names/values may repeat | Name interning helps; value cache depends on hit rate and failed on high-cardinality/mixed workloads | Names yes, values no |
| Map/cache lookup | Avoid repeated decode/allocation | Lookup, hash, collision, and branch costs can exceed saved decode | Only with measured hit-rate proof |
| Simple fast path branch | Common XML tags/attrs are simple | Detection/fallback cost and V8 IC effects often offset wins | Only if broad A/B proves it |
| Object pooling | Avoid allocation | V8 young-generation GC and monomorphic short-lived objects were cheaper | Do not retry |
| Function inlining | Avoid calls | Larger code hurt instruction cache / V8 optimization | Do not retry blindly |
| Sliced/page strings | Decode once, slice many | Retention and sliced-string risk; mixed fixture regressions | Do not promote |
| Native/Wasm parser | Faster scanner/core | Per-event JS object/string materialization dominates when API is JS pull events | Only for aggregate/coarse APIs |
| Dynamic attr object fill | Avoid helper overhead | `attrs[name] = value` still creates arbitrary dynamic object shapes | Generic parser limit |

## Condensed Numeric Evidence

If only one section is read, read this one.

### Baseline full-string gap

`stax-xml` Node parser remained around half of Woodstox/quick-xml on normal
full-string workloads:

| Fixture | Size | Node | Woodstox | quick-xml |
| --- | ---: | ---: | ---: | ---: |
| repeated-ascii | 1024 MiB | 85.1 | 148.8 | 152.5 |
| high-cardinality | 1024 MiB | 88.3 | 183.7 | 200.8 |
| mixed-utf8 | 1024 MiB | 82.5 | 157.5 | 163.0 |

### Raw scan was not the limiting factor

On the same primary artifact, count-only for generated fixtures was already
competitive:

| Fixture | Size | Neutral count-only | Node count-only | Woodstox count-only | quick-xml count-only |
| --- | ---: | ---: | ---: | ---: | ---: |
| high-cardinality | 1024 MiB | 268.1 | 256.2 | 207.8 | 226.3 |
| mixed-utf8 | 1024 MiB | 227.8 | 211.0 | 170.2 | 181.7 |

### Object/string materialization hurt

`copyAttributesObject()` was weak:

| Fixture | Size | attr-object-loop | attr-object-batch | full-string-loop | full-string-batch |
| --- | ---: | ---: | ---: | ---: | ---: |
| attribute-heavy | 512 MiB | 73.9 | 75.6 | 70.3 | 69.9 |
| mixed-utf8 | 512 MiB | 81.7 | 82.2 | 64.6 | 62.6 |

Avoiding object traversal was much faster diagnostically, but not a generic API:

| Fixture | attr-object-loop | attr-direct-loop | full-string-loop | full-string-direct |
| --- | ---: | ---: | ---: | ---: |
| attribute-heavy | 66.1 | 77.9 | 57.3 | 69.9 |
| mixed-utf8 | 69.6 | 70.1 | 48.7 | 55.1 |

### Simple attr scanner was unstable

At 512 MiB:

| Fixture | Tier | node | node-simple-attrs |
| --- | --- | ---: | ---: |
| attribute-heavy | count-only | 122.5 | 123.1 |
| attribute-heavy | attr-object-loop | 64.8 | 67.5 |
| attribute-heavy | full-string-loop | 59.1 | 58.4 |
| mixed-utf8 | count-only | 100.5 | 98.5 |
| mixed-utf8 | attr-object-loop | 68.2 | 67.7 |
| mixed-utf8 | full-string-loop | 49.3 | 51.4 |

### SAX and txml did not reveal a better generic strategy

512 MiB mixed-utf8 same object shape:

| Parser | Throughput |
| --- | ---: |
| stax-node | 105.6 |
| saxes-stream | 74.1 |
| saxophone-stream | 79.6 |
| saxophone-string | 95.9, but huge memory |
| htmlparser2-stream | 76.0 |
| sax-stream | 14.2 |

txml DOM walk at 128 MiB was `80.0 MiB/s` with about `1.55 GiB RSS` and
`1.42 GiB heap`. It is outside the event-pull contract and not viable for
large streaming inputs.

### Native/Wasm aggregate showed the API boundary problem

512 MiB native aggregate full-string was extremely fast when it avoided JS
per-event materialization:

| Fixture | Node | Woodstox | quick-xml | native-aggregate |
| --- | ---: | ---: | ---: | ---: |
| repeated-ascii | 84.4 | 149.8 | 153.5 | 565.7 |
| high-cardinality | 95.3 | 167.4 | 199.5 | 629.7 |
| mixed-utf8 | 78.5 | 156.0 | 167.0 | 574.7 |

But with JS event objects and strings:

| Fixture | Node event-object-full | Woodstox | quick-xml | native-aggregate event-object-full |
| --- | ---: | ---: | ---: | ---: |
| repeated-ascii | 81.4 | 145.2 | 166.3 | 100.2 |
| high-cardinality | 87.9 | 158.7 | 187.0 | 114.7 |
| mixed-utf8 | 62.7 | 115.1 | 128.2 | 70.2 |

This strongly suggests that the bottleneck is not only parser core speed; it is
the JS event/string/object boundary.

## Most Likely Current Conclusion

The generic iterable parser is already reasonably optimized as a scan/event
producer. Remaining large gaps are mostly due to V8-level materialization costs:

- JS string creation for text and attribute values.
- Dynamic attribute object creation.
- Object key insertion and traversal.
- Hidden-class instability for arbitrary XML attribute bags.
- Branch/cache/lookup overhead in attempts to avoid the above.

If another LLM proposes a new hypothesis, it should explain how it avoids these
known failure modes. Otherwise, the next meaningful performance frontier is not
the generic iterable parser, but a different boundary:

- schema-known converter materialization,
- fixed-shape output objects,
- native aggregate for coarse results,
- or explicit non-string span APIs for advanced consumers.

## Open Questions For External Deep Research

1. Is there any V8-friendly way to create arbitrary attribute objects with stable
   hidden classes without knowing the schema/key set in advance?
2. Can an attr signature factory be built without adding Map/branch/cache costs
   that repeat the known failures?
3. Is there a JS-only string materialization technique that beats
   `Buffer.toString()`/`TextDecoder` for short UTF-8 values across
   high-cardinality and mixed-UTF8 fixtures, not only repeated ASCII?
4. Can the parser restructure attr object creation so the object shape is fixed
   at creation time rather than mutated dynamically, while still supporting
   arbitrary XML attributes?
5. Can V8 external strings or internal APIs be used safely from Node native
   addon without per-token FFI and lifetime overhead dominating?
6. Is there a branchless or predictably monomorphic way to choose decode paths
   for ASCII vs UTF-8 values in a generic parser?
7. Are there known V8 deopt patterns in the current `copyAttributesObject()` or
   benchmark consumer loops that have not been inspected yet?
8. Is there a benchmark semantics bug that over-penalizes JS relative to
   Woodstox/quick-xml, especially around attributes object shape?

## Required Evidence For Any New Proposal

Any new proposal should include at least these measurements:

- correctness parity with existing iterable tests,
- `count-only`,
- `attr-object-loop`,
- `full-string-loop`,
- `mixed-utf8` and `attribute-heavy`,
- at least 128 MiB for quick screening,
- at least 512 MiB for promotion consideration,
- comparison against current `node` scenario,
- if relevant, comparison against Woodstox and quick-xml,
- CPU profile or deopt evidence if the change adds branches, caches, factories,
  Maps, or hidden-class-sensitive code.

## Local Reference Artifact Index

This section is only for local follow-up. A web deep-research LLM can ignore it;
the core evidence is already summarized above.

Current branch artifacts:

- `packages/benchmark/results/node-string-return-primary-20260422-195118.json`
- `packages/benchmark/results/node-string-return-real-short-ascii.json`
- `packages/benchmark/results/node-string-return-real-short-ascii-16-all-tiers.json`
- `packages/benchmark/results/node-string-return-real-ascii-chunk-cache.json`
- `packages/benchmark/results/node-string-return-real-attr-value-cache.json`
- `packages/benchmark/results/node-string-return-hypothesis-matrix-20260422-201625.json`
- `packages/benchmark/results/node-string-return-wasm-js-string-regular-20260422-2152.json`
- `packages/benchmark/results/node-string-return-wasm-js-string-cross-chunk-20260422-2158.json`
- `packages/benchmark/results/iterable-attr-materialization-128m-20260423.json`
- `packages/benchmark/results/iterable-attr-materialization-512m-20260423.json`
- `packages/benchmark/results/iterable-attr-direct-128m-20260423.json`
- `packages/benchmark/results/iterable-simple-attrs-loop-128m.json`
- `packages/benchmark/results/iterable-simple-attrs-loop-512m.json`
- `packages/benchmark/results/sax-object-shape-mixed-utf8-512m-20260423.json`
- `packages/benchmark/results/sax-object-shape-txml-mixed-utf8-128m-20260423.json`
- `packages/benchmark/results/sax-object-shape-txml-baseline-mixed-utf8-512m-20260423.json`
- `packages/benchmark/knowledge/reports/cursor/CURSOR_API_FAILURE_DOSSIER_2026-04-18.md`
- `packages/benchmark/PARSER_OPTIMIZATION_FINAL_REPORT.md`

Native branch artifacts:

- Branch: `experiment/native-napi-aggregate`
- Commit: `1ea88e5 Preserve native parsing experiments`
- `packages/benchmark/results/node-string-return-native-aggregate-512m-full-20260422-2223.json`
- `packages/benchmark/results/node-string-return-event-object-full-512m-20260422-2254.json`
- `packages/benchmark/results/node-string-return-event-object-512m-20260422-2244.json`

Input research docs:

- `CHATGPT_XML 파싱 최적화 방법.md`
- `CHATGPT_deep-research-report.md`
- `GEMINI_RESEARCH.md`
