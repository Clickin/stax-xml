# stax-xml/projection Design

Status: fixed design note for follow-up implementation planning
Date: 2026-05-23

## Decision

Add a future `stax-xml/projection` subpath as an independent streaming
projection engine. It is not a SAX facade and it is not an XPath replacement.
The purpose is to extract repeated records from very large XML inputs while
materializing only the fields requested by a compiled projection plan.

The subpath should reuse the existing byte-batch parser assets behind
`StreamReaderSync`, especially raw batch and index-first traversal paths. The
projection layer should decide whether an event matters before exposing it to
user code. Unmatched events must not become public JavaScript event objects.

## Motivation

The current StAX surfaces are strong for bounded-memory large-file parsing, but
general StAX consumers often need to inspect `localName`, `qName`, and
attributes to decide whether the current event is relevant. That inspection
pulls string decoding and event materialization into the hot path even when the
application wants only a small subset of the document.

Existing Node SAX parsers are also event-oriented. They make migration familiar,
but a SAX-compatible `onopentag(node)` shape tends to require name and attribute
objects for every start element. That repeats the same materialization pressure
that limits the StAX reader path.

`stax-xml/projection` should instead make the selection predicate part of the
parser-side plan. The fast path is a negative path: most events are scanned and
matched structurally, then discarded without public event construction.

## Public Shape

The first public shape should be plan-first and projection-first:

```ts
import { attr, childText, compileProjection, many, projectXmlSync } from 'stax-xml/projection';

const projection = compileProjection({
  books: many('/catalog/book', {
    id: attr('id'),
    category: attr('category'),
    title: childText('title'),
  }),
});

for (const record of projectXmlSync(input, projection)) {
  // record is already projected: { id, category, title }
}
```

A callback sink can be added for memory-sensitive pipelines:

```ts
projectXmlSync(input, projection, {
  onRecord(record) {
    // The callback receives projected records, not SAX events.
  },
});
```

The callback form should be a sink API, not a per-event visitor API. Calling
user code for every XML event would make the callback boundary the new hot path.

## Initial Selector Subset

The first implementation should support only streaming-safe selectors:

- absolute child paths such as `/catalog/book`
- repeated record extraction with `many(path, fields)`
- direct attribute capture with `attr(name)`
- direct child text capture with `childText(name)`
- optional fields
- simple attribute equality predicates
- `namespaceAware: false` as the initial large-file fast lane

The first implementation should not support:

- SAX-compatible event objects
- full XPath semantics
- descendant-axis search with `//`
- parent or sibling axes
- arbitrary predicates
- full attribute maps by default
- mixed-content fidelity beyond explicit projected fields
- lazy getters on projected records

## Internal Model

Projection compilation should turn paths, field names, and predicates into a
compact matcher. Runtime matching should prefer byte spans or stable name IDs
from raw batches when available, falling back to decode only when the projection
actually captures a field or needs a string value for the result.

Projected records should be fresh owned snapshots. Internal cursor or raw-batch
views can be ephemeral, but public results must not depend on the lifetime of an
active parser batch.

The first implementation should stay in pure JavaScript and reuse existing
`stax-xml` parser internals. Native, Wasm, FFI, or external-string strategies
should not be part of this design slice; previous experiments showed that once
ordinary JavaScript strings and events are required, materialization dominates
the tokenizer boundary.

## Converter Integration

Do not start by changing the converter API. First prove the projection engine as
an isolated `stax-xml/projection` subpath with focused benchmarks.

If the benchmark evidence is positive, add a converter-facing projection
builder or backend later. Prefer a distinct projection schema over silently
reusing the XPath schema, because XPath expressiveness and streaming projection
performance have different contracts.

Possible later shape:

```ts
import { projectionSchema, attr, childText, many } from 'stax-xml/projection';

const schema = projectionSchema({
  books: many('/catalog/book', {
    id: attr('id'),
    title: childText('title'),
  }),
});
```

## Benchmark Contract

The projection package must prove both CPU and memory value against the current
release benchmark set:

- compare against `StreamReaderSync` index-first traversal
- compare against `EventReaderSync`, `sax`, and `saxes`
- include low-selectivity and high-selectivity generated fixtures
- include 1 GiB and 4 GiB generated byte-batch runs
- measure RSS, heap allocation, and GC share where practical
- report positive and negative-path costs separately

Success means the low-selectivity projection path clearly reduces materialized
strings, public objects, and heap pressure while keeping large-input memory
bounded. High-selectivity workloads may approach StAX cost, but should not be
substantially worse than `StreamReaderSync` index-first traversal.

## Next Step

The next session should turn this design into an implementation plan. The first
implementation slice should be a narrow proof harness and a minimal
`stax-xml/projection` subpath, not converter integration.
