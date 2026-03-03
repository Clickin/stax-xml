# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

