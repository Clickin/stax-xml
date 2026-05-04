# Pure JavaScript Parser Decision History

`stax-xml` is intentionally a pure JavaScript XML parser. This document records
why the native addon and Wasm experiments were moved out of this package, and
what constraints should guide future acceleration work.

## Product Goals

The core goals are:

- keep memory usage low for large XML documents;
- parse XML larger than JavaScript's practical single-string limit;
- expose a pull-style API so application code does not need to keep deep SAX
  state machines;
- support Node, Bun, Deno, browsers, and edge runtimes without requiring binary
  parser packages;
- keep async work at stream or file ingress boundaries while tokenization and
  cursor draining run synchronously inside each byte batch.

These goals are broader than raw tokenizer throughput. The public contract is a
JavaScript pull parser that lets callers read names, text, attributes, events,
and objects as JavaScript values.

## Native Tokenization Worked

The native addon experiments showed that native code can tokenize XML bytes very
quickly. Rust code can scan byte buffers, keep compact span tables, and use
CPU-oriented implementation techniques that are awkward in JavaScript.

That made native code attractive for the narrow tokenizer problem. It did not
settle the public parser problem.

## The JavaScript Boundary Dominated

The input side can be efficient. A native addon can view a JavaScript
`Buffer`/`ArrayBuffer` without copying the whole XML document into native-owned
memory.

The output side is different. Parsed XML is useful to JavaScript callers only
after names, text, attribute values, and objects cross back into JavaScript.
Those values are not reusable native views:

- JavaScript strings are immutable primitives, not mutable `char[]` objects.
- A native span or pointer cannot be returned as a JavaScript string without
  decode/materialization.
- Attribute maps and event objects require JavaScript allocation and shape
  management.
- Passing data through a wrapper layer adds dispatch and ownership costs.

Native code could fill its own tables very quickly, but the public facade still
had to materialize JavaScript strings and objects. As more realistic consumers
were measured, the advantage of the native tokenizer narrowed toward the pure
JavaScript cursor path.

## Why Wasm Did Not Change the Decision

Wasm has the same public-boundary issue and an additional memory boundary.
Parser state and result spans live in Wasm linear memory, while JavaScript
callers need JavaScript values.

That means names, text, attributes, and detail objects still need to be decoded
or copied into JavaScript. Lazy pointer-backed detail objects are also fragile
unless the producer can guarantee memory lifetime.

As an external comparison, `sax-wasm` exposes a generator-like API over
`ReadableStream.getReader()`. In local tests, the generator path yielded lazy
detail objects backed by Wasm memory; accessing those details after a write
could hit a detached `ArrayBuffer` when the Wasm memory changed. Its immediate
event-handler path could be measured, but that is a different callback-style
consumption model.

This reinforced the boundary lesson: Wasm can accelerate internal scanning, but
it does not remove JavaScript materialization or memory-lifetime costs.

## Memory Was Part of the Decision

For this package, peak RSS is a first-class requirement. Large XML parsing is
not useful if the parser avoids JavaScript's string limit but replaces it with a
large native heap, Wasm linear memory, bridge buffers, or retained wrapper state.

Native and Wasm implementations add memory regions outside the normal
JavaScript parser state:

- native heap allocations;
- Wasm linear memory;
- bridge buffers between JS and native/Wasm;
- wrapper objects that keep native/Wasm state reachable.

Even when native scanning was faster internally, this memory profile was less
aligned with the package goal than a pure JavaScript byte-batch cursor core.

## The Current Design

`stax-xml` now keeps the parser implementation in JavaScript:

- byte-oriented scanning over `Uint8Array` batches;
- synchronous tokenizer and cursor draining inside each batch;
- lazy string materialization through public accessors;
- `ReadableStream` support where `await` happens at chunk or batch ingress, not
  once per XML event;
- no backend mode, native addon selection, or Wasm parser fallback.

The result is easier to reason about across runtimes and easier to benchmark
honestly. Node, Bun, and Deno compare the same JavaScript implementation instead
of comparing different parser engines behind one facade.

## Native Work Belongs Elsewhere

The native work is still valuable, but it fits a different product boundary. A
Rust crate with a native StAX-style API can expose spans, borrowed data, and
Rust-owned structures without repeatedly crossing into JavaScript. That is the
right place for quick-xml-style parser acceleration.

For `stax-xml`, the public boundary is JavaScript. Optimizations should improve
the pure JavaScript cursor, stream, converter, and writer paths unless new
evidence shows that an acceleration layer improves the full public workload and
does not violate the memory goals.

## Reconsideration Bar

Do not reintroduce a native or Wasm backend mode just because a tokenizer
microbenchmark is faster. Reconsider only if evidence shows all of the
following:

- full public parser workloads improve, including string and attribute
  materialization;
- peak RSS does not regress for large XML documents;
- the API does not require users to choose runtime backends;
- Node, Bun, Deno, and browser behavior remain explainable;
- failure modes around memory lifetime, fallback, and packaging are simpler
  than the current pure JavaScript path.

Until then, native parser work should live in a separate Rust-focused project,
and `stax-xml` should remain a pure JavaScript pull parser.
