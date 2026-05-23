# stax-xml Reader Gap Runtime Triage

Status: research handoff for the next implementation goal
Date: 2026-05-23

## Objective

Reduce the reader/writer release gap as much as possible before release, while
staying on the pure JavaScript, browser-compatible package contract. This note
does not implement a change. It narrows the next implementation candidates
using current repository evidence plus V8, JavaScriptCore, quick-xml, and
Woodstox implementation constraints.

The target is not to revive the native addon, Wasm tokenizer, lazy getter, or
Map-localName-cache lines. Native addon work is excluded until a native backend
can demonstrably and safely construct JavaScript events plus UTF-16 or UTF-8
string values for Node without moving the bottleneck back to per-event
materialization. The other lines are treated as rejected unless new benchmark
evidence contradicts the existing measurements.

## Current Evidence

The release benchmark on Node 24.15.0 / V8 13.6.233.17-node.48 shows the
asymmetry clearly:

- `StreamReaderSync index-first (4GiB generated batches)`: `81.38 MiB/s`
  with bounded RSS delta.
- `WriterSyncSink` 1 GiB memory sink: `278.17 MiB/s`.
- `WriterSyncSink` 1 GiB temp file: `263.03 MiB/s`.

The reader and writer rows are intentionally not equivalent workloads. The
writer receives already-known JavaScript strings and appends deterministic
output. The reader must scan arbitrary input, classify XML, track nesting and
attributes, and materialize JavaScript strings or event objects when the public
API asks for them.

The current byte reader path already keeps much of the work span-based:

- `StreamReaderSync` wraps `createJavaScriptIterableReader` and exposes
  batch/index accessors.
- `IterableReader` scans `Uint8Array` batches, records typed-array event and
  attribute spans, and decodes spans only through accessor paths.
- The Node-specialized internal reader uses `Buffer.indexOf()` for `<` and
  `Buffer.toString('utf8', start, end)` for materialization, but it is a
  Node-only reference point, not the general cross-runtime public stream path.
- A prior 128 MiB iterable/object-shape record did not justify a Node Buffer
  lane: neutral iterable vs node iterable was `105.5 / 99.6 MiB/s` on
  attribute-heavy, `102.2 / 98.9 MiB/s` on mixed-utf8,
  `46.0 / 45.4 MiB/s` on high-cardinality, and `98.5 / 88.3 MiB/s` on
  shuffled-attribute-order.
- `StringEventParserSync` uses `String#indexOf()` and `slice()` for in-memory
  fragment parsing, which is fast but unsuitable as the large streaming default
  because retained slices can keep parent chunks live.

The 2026-05-22 chunked string spike confirmed the core tradeoff: direct string
slices are faster when nothing escapes, but retained slices made a 4 GiB run
keep about 1.22 GiB of heap live for about 50k retained characters. The product
default should remain byte offsets plus owned string materialization.

## Runtime Findings

### V8

V8 favors stable object shapes. Its docs describe hidden classes as the object
shape mechanism behind inline caches; objects with the same properties in the
same order share a hidden class, while dynamic property additions create
transitions. This supports keeping parser outputs as monomorphic plain records
when records must be materialized, and it argues against lazy getter objects,
stateful live cursors, and ad hoc promoted attribute maps.

V8 string internals also explain why the direct string-slice route cannot be
the large-file default. V8 has `SlicedString`: a substring points at a parent
string plus offset and length, with a minimum sliced-string length of 13, and
the source comments still list missing parent truncation as a limitation. That
matches the repository retention spike.

V8's public C++ string API distinguishes copy creation from external strings:
`NewFromUtf8()` allocates a new string from UTF-8 data; external strings require
the resource to outlive the V8 heap string and be disposed by V8. That is not a
pure JavaScript optimization and it does not provide a safe ordinary JS string
view over parser-owned bytes.

### JavaScriptCore

JavaScriptCore has the same broad constraint from the JavaScript side: strings
are engine-owned JS values, while no-copy APIs are available for ArrayBuffer or
typed-array backing stores rather than ordinary string values. WebKit source
shows `JSString` / `JSRopeString` and substring-sharing helpers in the string
prototype path. That makes JSC friendly to string search and rope/slice
operations, but it does not create a portable public borrowed-string contract.

For stax-xml this means:

- typed-array/span work can be portable across V8 and JSC;
- public JavaScript strings still need materialization;
- large-file retained-substring hazards should be treated as cross-engine risk,
  not as a V8-only quirk.

### quick-xml

quick-xml's main transferable idea is not "Rust is faster". It is the API
contract: events borrow byte buffers with `Cow` where possible, callers can
reuse or clear buffers, attributes remain raw bytes until iterated or decoded,
and decoding can produce `Cow<str>`.

JavaScript cannot expose Rust-style lifetimes, so this cannot become a public
borrowed event API. The transferable form is internal:

- keep raw byte spans inside a batch;
- match structure before decoding;
- decode only fields that survive a compiled selection plan;
- keep public records owned and fresh.

### Woodstox

Woodstox's symbol table is a specialized char-array-to-String table. It is
optimized for parser symbol reuse: primary bucket matches are common after
warm-up, returned strings can be reused, and child tables can merge back to a
master table.

A direct JS `Map<string, string>` localName cache is the wrong translation
because creating the key string or hash work already costs too much in the hot
path. The useful translation is narrower:

- plan-specific byte/name matching before string creation;
- numeric name IDs inside a batch/core where a name has already been seen;
- no public symbol table or per-event localName cache.

## Candidate Ranking

### 1. Projection negative path - strongest candidate

Build from the existing `docs/plans/2026-05-23-stax-xml-projection-design.md`
direction. The parser-side plan should decide whether an event matters before
public event construction. Most events in low-selectivity extraction workloads
should be scanned, matched structurally, and discarded without name/text/attr
string materialization.

Why it fits the engines:

- V8/JSC can optimize typed-array loops and stable record shapes.
- It avoids creating JS event objects on the negative path.
- It converts quick-xml's borrowed event idea into an internal span lifecycle
  that JavaScript can safely expose as owned projected records only at the end.

Next proof:

- benchmark against current `StreamReaderSync` index-first traversal,
  `EventReaderSync`, `sax`, and `saxes`;
- split low-selectivity and high-selectivity fixtures;
- report negative-path cost separately from record materialization cost;
- require bounded RSS on 1 GiB and 4 GiB generated byte-batch runs.

### 2. Plan-compiled byte matcher - high candidate

Compile target element and attribute names into byte patterns and match spans
without making strings. Do not use a general `Map` cache. Use length, first
byte, and straight byte comparisons, with generated or prebuilt small matcher
functions for the known projection plan.

This is the closest JS-portable version of Woodstox symbol reuse and quick-xml
raw-name matching. It should live inside projection or converter fast paths
first, not in the general StAX event surface.

Next proof:

- a micro lab comparing byte span equality strategies on Node/V8 and Bun/JSC;
- include high-cardinality, repeated-name, namespace-off, and attribute-heavy
  fixtures;
- reject if matcher overhead beats string decode only in synthetic count-only
  cases.

### 3. Attribute capture by requested name - high candidate inside projection

For projection plans, parse attributes as spans but only decode values whose
attribute names are selected by the plan or needed for predicates. This avoids
the SAX-style `attributes` object for every start tag.

This should not be implemented as a general attribute `Map`. It should be a
plan-specific scan over the current start-tag span, with owned output only for
captured fields.

Next proof:

- fixture pair: many irrelevant attributes vs few requested attributes;
- measure decoded string count, object count, heap/RSS, and throughput;
- compare to current manual `StreamReaderSync` projection.

### 4. Browser-compatible TextDecoder discipline - implementation constraint

Keep stream-reader materialization on `Uint8Array`/`ArrayBufferView` plus
`TextDecoder.decode()`. A Node `Buffer` surface lowers browser compatibility,
adds API confusion, and previous neutral-vs-Node iterable experiments did not
show a release-relevant win over the browser-compatible path.

The internal Node reader can remain a diagnostic baseline, but not a release
optimization lane. The next useful work is reducing when materialization
happens, not swapping the materializer to `Buffer.toString()`.

Next proof:

- run projection candidates on the browser-compatible `Uint8Array` reader
  first;
- report any internal Node reader comparison separately as a diagnostic row;
- reject benchmarks that mix projection gains with Node-only decode gains.

### 5. String-input specialization - medium/low candidate

`StringEventParserSync` already benefits from `String#indexOf()` and `slice()`
for in-memory fragment parsing. V8 and JSC both have sophisticated string
search and substring machinery, so string-input specialization can win for
small and medium strings already held fully in memory.

It should not become the large streaming default. Retained substring behavior
and the current large-file positioning make it unsafe as the answer to the
4 GiB reader gap.

Next proof:

- keep it limited to `EventReaderSync` in-memory inputs;
- explicitly measure retained-substring behavior for documents where event
  strings escape;
- do not use it to justify stream-reader claims.

### 6. ASCII short-span materialization tuning - low candidate

The portable reader already has a short ASCII decode helper before
`TextDecoder.decode()`. Keep this as a portable materialization question only:
a narrow lab can test whether the helper should remain, be tightened, or be
removed for short ASCII spans.

This is low priority because previous name-cache and scanner micro work showed
that isolated wins can disappear once event/materialization costs are included.
Only keep it if a full-parser selected-row benchmark survives.

## Rejected For This Goal

- Native addon event streaming: excluded until the native boundary can
  demonstrably and safely create JavaScript events and UTF-16 or UTF-8 strings
  for Node. Tokenizer speed alone is not a candidate because it does not
  survive JS string/event materialization.
- Wasm tokenizer: bytes can cross as ArrayBuffer, but strings/events still need
  JS materialization.
- Decoded chunk string scanner as default: faster CPU path, unsafe retained
  parent memory under streaming retention.
- Direct `slice()` / substring return for large stream results: same retained
  parent issue.
- Lazy getters on event fields: only helps count-only scenarios and destabilizes
  cache consistency.
- General `Map`-based localName cache: hashing/key creation overhead already
  lost.
- Node `Buffer` / `Buffer.toString()` as the primary stream fast lane: lowers
  browser compatibility, creates a second public mental model, and previous
  neutral-vs-Node iterable experiments did not show enough benefit to justify
  the split.
- Stateful public cursor/live view: weaker fit for V8 hidden-class and inline
  cache behavior than stable plain objects, and hard to make safe across batch
  lifetimes.
- SAX-compatible facade as the optimization path: it repeats per-event object
  materialization and attribute object pressure.
- Repeated JS `Buffer.indexOf()` as a memchr3 clone: it is not the same machine
  code shape as quick-xml's native `memchr`/`memchr3` usage, and it does not
  address public string/object cost.

## Recommended Next Implementation Goal

Start with projection, not generic StAX micro-optimization.

1. Add a narrow benchmark harness for low-selectivity projection over generated
   byte batches, using the same event-count/checksum discipline as release
   benches.
2. Implement a minimal internal compiled byte matcher for element paths and
   requested attribute/text fields.
3. Return stable owned projected records only when a record matches.
4. Compare against current manual `StreamReaderSync` index-first projection and
   `EventReaderSync` event traversal.
5. Promote only if it reduces materialized strings/objects and improves
   throughput on both 1 GiB and 4 GiB bounded-memory runs.

Expected outcome: this will not make the fully generic StAX reader as fast as
the writer, because the writer's work is fundamentally simpler. It can reduce
the practical reader gap for the extraction workloads that matter before
release, while staying consistent with V8/JSC and the pure JavaScript contract.

## Sources Checked

- Current release benchmark summary:
  `packages/benchmark/results/release/latest-summary.json`
- Current 4 GiB stream reader benchmark:
  `packages/benchmark/results/release/stream-reader-4gb.md`
- Current writer 1 GiB raw result:
  `packages/benchmark/results/release/raw/writer-1gb.json`
- Existing chunked-string decision:
  `packages/benchmark/knowledge/reports/string-decoding/CHUNKED_STRING_DECODE_REJECTION_2026-05-22.md`
- Existing projection design:
  `docs/plans/2026-05-23-stax-xml-projection-design.md`
- V8 hidden classes:
  `https://v8.dev/docs/hidden-classes`
- V8 fast properties:
  `https://v8.dev/blog/fast-properties`
- V8 string internals:
  `https://chromium.googlesource.com/v8/v8/+/HEAD/src/objects/string.h`
- V8 public string API:
  `https://v8.github.io/api/head/classv8_1_1String.html`
- JavaScriptCore string source:
  `https://github.com/WebKit/WebKit/blob/main/Source/JavaScriptCore/runtime/JSString.h`
  and
  `https://github.com/WebKit/WebKit/blob/main/Source/JavaScriptCore/runtime/StringPrototypeInlines.h`
- quick-xml source and README:
  `https://github.com/tafia/quick-xml`
- Woodstox symbol table source:
  `https://github.com/FasterXML/woodstox/blob/master/src/main/java/com/ctc/wstx/util/SymbolTable.java`
