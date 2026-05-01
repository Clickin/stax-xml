# Bytes Mainline Policy - 2026-05-01

## Decision

`stax-xml` public parsing surfaces keep accepting `string` input for convenience, but
the internal acceleration mainline is **always UTF-8 bytes**.

That means:

- `EventReaderSync`
- `CursorReader`
- `XmlObject` tree/object helpers
- `ProjectionReader`
- compiled `converter` dispatch

all canonicalize `string` input to UTF-8 bytes before they choose a native or wasm
accelerated path.

## Why

### 1. It keeps one mainline policy across Node and browser

Mixed `bytes` and direct UTF-16 acceleration paths caused repeated planning drift:
agents kept treating legacy UTF-16 helpers as if they were the mainline public path.

### 2. Large-input feasibility dominates hypothetical string wins

Ad-hoc conversion probes showed:

- `midsize.xml` (`~14 MB`)
  - `bytes -> string` decode: about `3.17 ms`
  - `string -> bytes` encode: about `11.85 ms`
- `large.xml` (`~105 MB`)
  - `bytes -> string` decode: about `29.91 ms`
  - `string -> bytes` encode: about `91.15 ms`
- synthetic `900 MB`
  - `bytes -> string` decode failed with `ERR_STRING_TOO_LONG`
  - giant string construction failed with `RangeError: Invalid string length`

So a `string`-mainline policy does not scale to the largest intended inputs even before
parser work is considered.

### 3. Converter and projection measurements did not justify policy bifurcation

Current probes showed:

- `converter` strongly prefers `bytes` paths; direct `string` parsing is materially slower.
- `ProjectionReader` had mixed results across runtimes, but not enough to justify keeping
  a second source-kind mainline throughout the public facade.

The project is better served by one stable rule than by per-surface/per-runtime divergence.

## Consequences

### Public API guidance

- `string` input remains supported.
- Internally it is treated as convenience input and is encoded to UTF-8 bytes.
- For very large XML, users should prefer byte/stream/file surfaces instead of building one giant string.

### Code-reading guidance for future agents

- If you see low-level exports such as:
  - `parseAggregateStringUtf16`
  - `parseSpanTableStringUtf16`
  - `parseStructuralIndexStringUtf16`
  - `parseDocumentNodesStringUtf16`
  they are **not evidence that the public runtime policy is UTF-16-mainline**.
- Those low-level helpers are legacy diagnostics/compatibility entry points unless a future
  benchmark-backed decision explicitly reopens them.

### Design rule

Do not add new source-level direct UTF-16 fast paths to the public `stax-xml` facade without:

1. a fresh benchmark comparing end-to-end `string` vs `bytes` behavior,
2. a large-input feasibility check, and
3. a deliberate policy decision that reopens bytes-mainline.
