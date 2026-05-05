# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-rc3] - 2026-05-05

### Changed

- Re-centered the package on the pure JavaScript implementation: no native addon,
  Wasm parser module, or backend-selection mode is part of the public package
  contract.
- Updated the release documentation around `StreamReaderSync`, `EventReader`,
  converter, writer, runtime behavior, and XPath conformance for the rc3
  surface.
- Replaced hardcoded benchmark tables in the docs with generated tables that
  read the rc3 benchmark JSON snapshot.

### Performance

- Refreshed the release benchmark set on Node 24.15.0, Bun 1.3.13, and Deno
  2.7.13 with 16 MiB runtime rows, a 4 GiB `StreamReaderSync` index-first row,
  converter compiled batch-plan rows, and the 1 GiB writer artifact.
- Optimized converter compiled batch dispatch for the pure JavaScript path while
  keeping converter positioned as a convenience/schema wrapper over the lower
  level stream reader surface.

### Removed

- Removed native-addon and Wasm-parser positioning from release-facing docs and
  benchmarks. Historical implementation notes are kept out of the public docs.

## [0.7.0] - 2026-04-19

### Added

#### Cursor Reader API — Zero-Allocation XML Traversal

A new cursor-based XML reader API that provides a **mutable singleton cursor** instead of creating event objects per node. Ideal for high-throughput and memory-constrained environments.

- `StaxXmlCursorReader` — Sync cursor for in-memory XML strings
- `StaxXmlCursorReaderAsync` — Async cursor for `ReadableStream` (Web Standard), chunk-based parsing for multi-GB files
- `CursorEventType` — SMI integer constants (0–6) for cursor event types

Import from `stax-xml/cursor`:

```typescript
import { StaxXmlCursorReader, StaxXmlCursorReaderAsync, CursorEventType } from 'stax-xml/cursor';
```

**Design Principles:**
- All mutable cursor fields are V8 SMI (Small Integer) to **bypass write barriers**
- Sync cursor uses absolute positions (JS string max ≪ SMI max)
- Async cursor uses relative offsets from a `_base` anchor, enabling multi-GB stream parsing
- Position-based element stack eliminates string allocations during traversal
- Lazy attribute parsing defers work until `getAttribute*()` is called
- Namespace fast-path (`_nsActive` flag) skips namespace resolution for non-namespaced XML

**Benchmark Results (vs event parser):**

| Size | Iterate (cursor) | Selective (cursor) | Consume (cursor) | GC Memory |
|------|-------------------|--------------------|-------------------|-----------|
| 2KB  | 10% faster        | 5% faster          | 11% slower        | 10 KB     |
| 4KB  | 12% faster        | ~parity            | 24% slower        | 10 KB     |
| 13MB | 40% faster        | 34% faster         | 24% faster        | 78 KB     |
| 98MB | **47% faster**    | **38% faster**     | **30% faster**    | 80 KB     |

Cursor excels at large files where reduced GC pressure and skipped work compound. Small-file consume is slower due to per-getter string slicing overhead vs parser's V8-optimized young-gen scavenger.

#### Memory-efficient sync writer sinks

- Added `StaxXmlWriterSyncSink` for incremental synchronous XML writing without building the full XML string in memory.
- Added platform adapter subpaths:
  - `stax-xml/adapters/node` with `createNodeSyncTextSink()` and `createNodeFileSyncTextSink()`
  - `stax-xml/adapters/bun` with `createBunSyncTextSink()`
  - `stax-xml/adapters/deno` with `createDenoSyncTextSink()`
- `writeSync()` can now accept an injected `StaxXmlWriterSyncSink` through `WriteOptions.writer`.

### Changed

- Updated README and docs for the cursor API, sync writer sinks, and converter writer injection.
- Refreshed canonical release benchmark artifacts and docs benchmark pages from local benchmark output.
- Added a writer benchmark case for `StaxXmlWriterSyncSink` with an in-memory file-like target.
- Split performance tests out of the unit-test matrix; performance validation remains a manual benchmark workflow.

### Performance Improvements

#### Converter API true compile path

- Reworked converter API `.compile()` so supported schemas lower to a true dispatch-based compiled path instead of the previous matcher/state-machine execution path.
- Static XPath selectors are analyzed at compile time and executed as fixed XML event dispatch during parsing. This covers absolute selectors, simple descendant selectors, relative selectors inside object or array items, attributes, `text()`, nested objects, scalar arrays, object arrays, optional fields, and transforms.
- Unsupported compiled shapes now fall back directly to the normal runtime converter path, preserving compatibility without pretending to use the fast path.
- The `converter-plain-output` benchmark now shows the compiled converter path running close to the handwritten parser path while remaining declarative.

### Fixed

- Tightened sync sink close/flush semantics and added regression coverage.
- Improved converter, cursor, parser, and writer branch coverage. The package test suite now reports 100% branch coverage.

---

## [0.6.1] - 2026-04-18

### Performance Improvements

#### Async parser batch semantics and throughput

- `StaxXmlParser.nextBatch()` and `batchedIterator()` now operate on chunk-derived batches instead of caller-sized batches.
- Async parsing no longer yields on every event while buffered events are still available; chunk boundaries are now the primary async suspension points.
- Nested converter parsing paths reuse buffered async batches instead of repeatedly calling `await iterator.next()`.

#### Converter compile path

- Compiled converter execution continues to use a single root processor while reducing async overhead in nested parsing paths.
- Bare `x.array(...).compile()` and root-processor async cases were rerun against the new batch-backed iterator behavior.

## [0.6.0] - 2026-04-18

### Performance Improvements

#### StaxXmlParser (Async) — Promoted Fast-Path Architecture

The async XML parser has been completely rewritten with a new fast-path architecture, replacing the previous generator-based implementation. `StaxXmlParserFastPathExperimental` is now the main `StaxXmlParser` (the old name remains as a backward-compatible alias).

**Key optimizations applied:**

1. **Sync Fast-Path in Custom Async Iterator** — `next()` returns a plain `{ value, done }` object synchronously when buffered events are available, bypassing the microtask queue. A `Promise` is only created when a new chunk is needed from the stream. This eliminates thousands of Promise allocations per document.

2. **Single-string Pending Tail** — Replaced `pendingStructuralSegments: string[]` with a single `pendingTail: string`, removing array allocation overhead at chunk boundaries.

3. **Circular Buffer Queue (O(1) dequeue)** — Event queue uses a circular buffer with head/tail pointers instead of `Array.shift()`, eliminating O(n) dequeue cost.

4. **Simple-Element Fast Path** — Elements with no namespace prefix and no attributes (≈65% of elements in typical XML) bypass attribute parsing entirely and share the parent namespace map (no `new Map()` copy).

5. **Lazy Namespace Map Copy** — `new Map(parentNamespaces)` is deferred until the first `xmlns` attribute is encountered, avoiding allocations for non-namespace elements.

6. **xmlns Pre-filter** — Attribute namespace checks gate on `charCodeAt(0) === 120` (`x`) before any string comparison, skipping the check for non-xmlns attributes in a single instruction.

7. **Native `string.indexOf()` for tag scanning** — Replaced manual `charCodeAt` loops with `string.indexOf('<', pos)` and `string.indexOf('>', pos)`, leveraging V8's SIMD-optimized native search.

8. **Whitespace check without `trim()`** — `flushTextSegments` checks whitespace via `charCodeAt` loop instead of allocating a trimmed copy.

**Benchmark Results (midsize.xml — 13MB):**
- `stax-xml` async (experimental → main): **309ms** vs published v0.5.2 **516ms** (−40%)
- `stax-xml` async vs txml: **309ms** vs **516ms** (txml comparison on same dataset)
- `stax-xml` sync consume: **108ms** vs txml **156ms** (−31%)

#### StaxXmlParserSync

The sync parser received the same hot-path optimizations: native `indexOf` for scanning, `startsWith` for pattern matching, simple-element fast path, lazy namespace copy, and xmlns pre-filter.

### API

- `StaxXmlParser` now uses the new fast-path implementation
- `StaxXmlParserFastPathExperimental` remains exported as a backward-compatible alias for `StaxXmlParser`
- `createStaxXmlParser()` factory function added (mirrors existing `createStaxXmlParserFastPathExperimental`)
- The package now publishes ESM-only artifacts; CommonJS entrypoints were removed before the first `0.6.0` npm release
- All 800 unit tests pass

---

## [0.5.2] - 2025-10-19

### Performance Improvements

#### StaxXmlWriter Optimization (+31.7% average improvement)

The XML Writer has been significantly optimized through three key algorithmic improvements:

1. **Regex Caching** (+9.3%)
   - Static readonly patterns for basic XML entities
   - Construction-time compilation for custom entities
   - Eliminates repeated regex creation overhead

2. **Attribute String Batching** (+36.5%)
   - Single string concatenation before write operation
   - Reduces function call overhead from 4 calls to 1 per attribute
   - Exceptional improvement in attribute-heavy documents

3. **Early Entity Check** (+25.6%)
   - Fast string.includes() checks before regex operations
   - Avoids expensive regex when no entities are present
   - Significant performance gain for clean text content

**Benchmark Results (50,000 elements):**
- Realistic documents: +18.4% (180ms → 147ms)
- Mixed content: +54.1% (99ms → 46ms)
- Deep nested structures: +63.8% (86ms → 31ms)
- Attribute-heavy: +35.8%

All optimizations maintain 100% API compatibility and pass all 796 test cases with identical output.

#### StaxXmlParserSync Optimization (+20.67% improvement)

Replaced generator-based implementation with a state machine approach:

**Key Improvements:**
- Eliminated generator overhead (~95ns → ~10ns per event)
- IteratorResult object reuse (zero allocations)
- Pending event queue for self-closing tag handling
- 95%+ code reuse from existing parsing logic

**Benchmark Results (10MB XML file):**
- Generator baseline: 115.98ms
- State machine: 92.00ms
- **Improvement: +20.67%**

#### StaxXmlParser (Async) Optimization (~15% improvement)

Replaced Array-based queue with a circular buffer implementation:

**Key Improvements:**
- Eliminated O(n) Array.shift() operations → O(1) dequeue
- Improved memory locality with circular buffer pattern
- Queue operation cost reduced from 50ns to 10ns
- Dynamic queue growth when needed

**Benchmark Results (1GB XML file):**
- Array-based queue: baseline
- Circular buffer: ~15% faster
- All 796 tests passed with 100% API compatibility

### Changed

- Writer performance improved by 20-60% depending on XML structure
- Sync parser performance improved by 20.67%
- Async parser performance improved by ~15% on large files

### Technical Details

For detailed performance analysis and benchmarking methodology, see:
- Writer optimization: `packages/benchmark/writer-optimization/results/FINAL-ANALYSIS.md`
- Parser optimization: `packages/benchmark/PARSER_OPTIMIZATION_FINAL_REPORT.md`

### Internal

- Removed unused internal methods
- Enhanced benchmarking infrastructure
- Comprehensive documentation of optimization attempts and learnings

---

## [0.5.1] - 2025-10-XX

### Changed

- Improved NPM publish workflow for monorepo
- Updated package README with converter features

### Fixed

- Configured NPM authentication for pnpm publish
- Added canvaskit-wasm dependency for astro-og-canvas
- Added frontmatter to TypeDoc generated files for Astro
- Resolved TypeScript type assertion errors in XmlArraySchema

### Internal

- Added specs/ to gitignore
- Replaced eval-based ConverterDemo with iframe embed for better security

---

## [0.5.0] - Previous releases

(Release notes to be added for previous versions)
