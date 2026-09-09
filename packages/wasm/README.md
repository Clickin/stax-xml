# @stax-xml/wasm

Experimental, opt-in UTF-8 tokenizer for `stax-xml`. The normal `stax-xml`
package remains pure JavaScript and does not import or initialize Wasm.
This package is not a recommendation to replace the default backend.

## Readers

```ts
import { EventReaderSync, initWasm } from "@stax-xml/wasm";

await initWasm({ variant: "simd" }); // or "scalar"
const bytes = new TextEncoder().encode("<book><title>Hello</title></book>");
const reader = new EventReaderSync(bytes);
try {
  console.log([...reader]);
} finally {
  reader.close();
}
```

`StreamReaderSync`, `EventReaderSync`, `StreamReader`, and `EventReader` reuse
existing reader implementations through the experimental backend SPI.
Sync byte iterables and async byte streams are supported.

- UTF-8 bytes use the explicitly initialized Wasm module.
- Direct JavaScript strings and non-UTF-8 encodings use the JS backend.
- UTF-8 byte parsing before `initWasm()` fails explicitly; it does not silently
  select a different backend.
- Importing the package does not read files, fetch assets, or compile Wasm.
- `initWasm()` caches compiled modules, while each cursor owns an isolated
  instance. Existing cursors are unaffected by selecting another variant.

## Converter

Keep the existing schema API. Inject the backend into parse options:

```ts
import { initWasm } from "@stax-xml/wasm";
import { withWasmBackend } from "@stax-xml/wasm/converter";
import { x } from "stax-xml/converter";

await initWasm({ variant: "simd" });
const schema = x.object({ title: x.string("/book/title") });
const bytes = new TextEncoder().encode("<book><title>Hello</title></book>");
console.log(schema.parseSync(bytes, withWasmBackend({})));
```

`withWasmBackend()` clones options and attaches the non-enumerable experimental
backend symbol. Pass that result directly; object spread does not preserve
non-enumerable properties. The converter subpath shares initialization state
with the main package entrypoint.

## Loading and packaging

The package is ESM. Node loads the adjacent asset through `node:fs/promises`;
HTTP(S) module URLs use `fetch`. The default variant is fixed-width SIMD.
No automatic SIMD capability selection or fallback is performed.

Bundlers can supply their own asset bytes or compiled module:

```ts
await initWasm({ variant: "simd", bytes: wasmBytes });
// Alternatively: await initWasm({ variant: "simd", module: compiledModule });
```

Public asset subpaths are `@stax-xml/wasm/tokenizer.scalar.wasm` and
`@stax-xml/wasm/tokenizer.simd.wasm`. Use the bundler's asset-loading mechanism
for those paths. Keep both assets next to the built JS when using default URL
loading. This workspace requires the matching `stax-xml` build that exposes
`stax-xml/experimental/backend`; a coordinated release is necessary.

Node 24 and Chromium have been exercised. Other Node LTS versions, Firefox,
Safari, and bundler-specific production builds are not a verified runtime
matrix. On runtimes without Wasm, use normal `stax-xml`; direct string and
non-UTF-8 fallback paths do not require Wasm initialization.

## ABI and memory

AssemblyScript emits a Wasm32 module using its `minimal` runtime and explicitly
freed raw heap blocks. The ABI consists of numeric event/status codes,
`reserve`/`commit`, a borrowed `tokenView()` header, namespace/entity
operations, diagnostics, and `dispose`. No managed AssemblyScript strings or
arrays cross the hot ABI.

`tokenView()` exposes 13 little-endian 32-bit words: the current field pointer
and length tables, input base, attribute count, self-closing and standalone
flags, and the seven attribute span tables. The facade obtains it lazily once
per token; subsequent getters read linear memory without another Wasm call.
Type-only traversal does not request a view. This raw ABI is unstable: ship
the JS facade and Wasm assets from the same build.

Input bytes are copied into a compacting Wasm input window. Plain values borrow
spans from that window; entity replacements use reusable scratch storage.
Names and namespace state needed by open elements live in reusable retained
storage. Qualified/local/prefix names share one retained name span. Incomplete
tokens retain scan offsets and lexical state across feeds, rather than scanning
their entire prefix again. SIMD scans only complete 16-byte blocks, with scalar
tails and non-ASCII/entity handling.

The JS facade decodes requested spans lazily, caches current-token values, and
refreshes memory views after operations that may grow memory. Empty spans need
no decoder call; cache invalidation touches only fields read for the preceding
token, not every previously used attribute slot. Borrowed spans
are not valid after advancing or pushing input. Materialized public events own
stable JavaScript values. Memory is bounded by the largest live chunk/token,
open-element state, and configured entities—not by total bytes already parsed.
A single huge token still requires proportionate memory. Wasm buffers and
integer diagnostics have Wasm32 limits; error messages and positions are not
promised to be identical to JS errors.

The same supported XML subset is targeted: declarations, document/fragment
mode, namespaces, attributes, text, CDATA, comments, PI, DTD events, character
validation, and explicit entity replacements. DTDs are not applied and external
entities are not fetched. The W3C runner retains its existing classified corpus
exclusions; passing that subset is not full XML-conformance certification.

Implementation responsibilities:

- The stable backend factory/session owns backend choice and JS byte decoding.
- `assembly/utf8.ts` owns incremental UTF-8 validation and XML character rules.
- `assembly/scan.ts` owns pointer/limit lexical scanners, without parser state.
- `assembly/tokenizer.ts` owns XML parser/resume state, arenas, namespaces,
  entities, and the raw ABI.
- `src/TokenCursorWasm.ts` owns lazy JS string access, not lexical parsing or
  event/object construction.

## Development

From the repository root:

```sh
pnpm install
pnpm build
pnpm build:wasm
pnpm test:wasm
pnpm --dir packages/wasm coverage:assembly
pnpm benchmark:wasm --size-mib=16 --runs=5 --warmups=2 --fixtures=13,98
node --expose-gc packages/benchmark/wasm-isolated.mjs --out=/tmp/wasm-isolated.json
```

The isolated driver runs each backend/fixture in a fresh process and compares
complete projection digests before reporting byte Reader/converter timings.
`--wasm-entry=/path/to/preserved/dist/index.js` measures an earlier build with
the same driver. Heap/RSS samples are endpoints, not peak-memory measurements.

`vitest-pool-assemblyscript` runs tests written in AssemblyScript against both
scalar and SIMD builds and measures AssemblyScript source coverage. Separate
JS tests cover public readers/converters, byte splits, deterministic
JS-vs-Wasm differential cases, and streaming retention. Benchmarks include
byte ingress, requested string decoding, cold costs, and memory; tokenizer-only
throughput is not the default-backend decision criterion.
