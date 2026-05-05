# Public Docs Internal Notes

Date: 2026-05-05

These notes were removed or softened from the public documentation because they
are useful project evidence, but not useful first-read user documentation.

## XPath 1.0 Conformance

The public page should expose supported, limited, and not-exposed behavior. It
should not expose repo test file paths or internal claim wording.

Internal verification anchors:

- Absolute/relative paths and descendant shortcuts:
  `packages/stax-xml/test/converter/xpath-1-full.test.ts`
- Axes, node tests, namespace prefix resolution, variables, and extension
  functions:
  `packages/stax-xml/test/converter/xpath-1-coverage.test.ts`
- Predicates, operators, core function library, `id()`, and `lang()`:
  `packages/stax-xml/test/converter/xpath-1-full.test.ts`

Internal wording removed from public docs:

- `Current Claim`
- `현재 주장 범위`
- `Verification anchor`
- `검증 기준`
- `Gap item`
- `Needs audit`

The user-facing page should say that supplementary-plane character handling for
`string-length()` and `substring()` is limited until exact XPath character
semantics are covered by dedicated tests.

## Benchmark Evidence Paths

The public benchmark page should show commands users can run and generated
result tables, but it should not ask readers to care about internal release
artifact paths.

Internal release evidence paths:

- `packages/benchmark/results/release/runtime-matrix.json`
- `packages/benchmark/results/release/stream-reader-4gb.json`
- `packages/benchmark/results/release/converter-compiled-batch-plan.json`
- `packages/benchmark/results/release/raw/writer-1gb.json`
- `packages/docs/src/data/benchmarks/v1.0.0-rc3/*.json`

Internal benchmark semantics preserved here:

- Converter comparison uses a hand-written `StreamReaderSync` projection to
  establish the lower-level projection surface.
- Converter rows use `schema.parseSync(bytes)` and
  `schema.compile().parseSync(bytes)`.
- The manual projection was adjusted to match the selected object shape of the
  converter output before timing comparisons.

Public wording should call this a "hand-written StreamReaderSync projection",
not a "fixture-specific lower bound".

## Runtime Model Notes

Detailed runtime-engine notes, including native/Wasm experiment history, V8
string behavior, and memory-boundary analysis, belong in knowledge documents or
blog posts. Public docs should focus on the current package contract:

- pure JavaScript package;
- no native addon, Wasm parser module, or backend-selection mode;
- JavaScript strings and objects are part of the public API boundary;
- low-memory large XML workloads should use stream/event readers or sink
  writers instead of whole-document materialization.
