# stax-xml native and iterable release audit

This is the human review packet for the release-readiness branch. It is not a
publish instruction. Do not publish from this branch until every publish blocker
below is resolved and checked on a clean install.

## Current status

As of this review packet:

- `stax-xml` remains the public facade package.
- Scoped optional platform packages exist under `packages/native-*`.
- `packages/native-aggregate` is still the Rust/napi-rs probe crate and is not
  itself the final platform package.
- The platform packages currently contain package metadata, README, license, and
  JS placeholder entrypoints. They do not yet contain built `.node` or `.wasm`
  artifacts.
- `packages/stax-xml` declares exact-version optional dependencies for the
  platform packages.
- The runtime resolver tries native first, wasm second, and JS fallback last.
- Public parser, sync parser, sync cursor, async cursor, compiled converter sync
  string parsing, and converter stream parsing have been moved onto the iterable
  event backend.
- Uncompiled converter schemas still use the legacy-compatible state-machine
  executor, but that executor now consumes iterable backend events for strings,
  streams, and parser-provider inputs where possible.
- Converter compatibility for existing event-object inputs is intentionally
  preserved. Already-consumed parser inputs must continue from their current
  backend position, not restart through a wrapper.
- TypeScript whole-source branch coverage is currently gated by
  `packages/stax-xml/scripts/branch-coverage-report.mjs`.
- Rust native branch coverage is currently gated by
  `packages/native-aggregate/scripts/native-branch-coverage.mjs`.

Recent local evidence:

- `pnpm coverage:all` passed with TypeScript branch coverage `2454/2454` and
  Rust native branch coverage `372/372`.
- `cargo test --manifest-path packages/native-aggregate/Cargo.toml --locked --lib`
  passed with 18 tests.
- `cargo clippy --manifest-path packages/native-aggregate/Cargo.toml --locked --lib --tests -- -D warnings`
  passed.
- `pnpm --filter benchmark run release:expanded` passed and regenerated:
  - `packages/benchmark/results/release/latest-summary.json`
  - `packages/benchmark/results/release/runtime-matrix.json`
  - `packages/benchmark/results/release/cross-runtime-comparison.json`
  - `BENCHMARK.md`
- Runtime matrix evidence covered Node 24.15.0, Bun 1.3.13, and Deno 2.7.13
  on the same generated 16 MiB XML fixture.
- Cross-runtime evidence compared `stax-xml` on Node with Woodstox on Java 8
  and `quick-xml` 0.39.2; Woodstox Java 25 was measured as a separate
  verification row and not used as the public baseline.
- `git diff --check` passed, with only LF/CRLF warnings from Git on Windows.

Re-run the evidence before final signoff. Treat these numbers as stale once code
changes.

## Publish blockers

These are not optional review comments. Release is blocked until they are closed:

- Platform packages must receive real `.node` or `.wasm` artifacts in CI.
- GitHub workflow must build the native/wasm artifacts on the intended matrix and
  expose them as artifacts for inspection.
- `npm pack --dry-run` must be run for `stax-xml` and every platform package.
- Packed tarballs must be installed into fresh temp projects, not workspace links.
- Node, Bun, Deno, and browser smoke tests must run against packed artifacts.
- Browser sample must measure main-thread parse vs Worker parse and record whether
  Worker offload is recommended.
- npm organization `@stax-xml` must exist before trusted publishing setup.
- Trusted publishing must be configured and tested with canary or `next`, not
  directly with `latest`.
- Human line-by-line review must be completed for all sections below.

## Automated gate commands

Run from the workspace root:

```sh
pnpm --filter stax-xml exec tsc -p tsconfig.json --noEmit
pnpm --filter stax-xml coverage
pnpm --dir packages/stax-xml coverage:branch-report
pnpm --dir packages/stax-xml coverage:branch-gate
pnpm --filter stax-xml build
pnpm coverage:native
pnpm coverage:all
pnpm --filter benchmark run release:expanded
git diff --check
```

Native probe checks:

```sh
cargo test --manifest-path packages/native-aggregate/Cargo.toml --locked --lib
cargo clippy --manifest-path packages/native-aggregate/Cargo.toml --locked --lib --tests -- -D warnings
pnpm --dir packages/native-aggregate build:native
pnpm --dir packages/native-aggregate smoke
```

Packaging checks to run after artifacts are produced:

```sh
pnpm --dir packages/stax-xml pack --dry-run
pnpm --dir packages/native-linux-x64-gnu pack --dry-run
pnpm --dir packages/native-linux-x64-musl pack --dry-run
pnpm --dir packages/native-linux-arm64-gnu pack --dry-run
pnpm --dir packages/native-linux-arm64-musl pack --dry-run
pnpm --dir packages/native-darwin-x64 pack --dry-run
pnpm --dir packages/native-darwin-arm64 pack --dry-run
pnpm --dir packages/native-win32-x64-msvc pack --dry-run
pnpm --dir packages/native-win32-arm64-msvc pack --dry-run
pnpm --dir packages/native-wasm32-wasi pack --dry-run
```

Expected artifact rule:

- `stax-xml` tarball contains `dist`, package metadata, README, and license only.
- Native platform tarballs contain only package metadata, README, license,
  `index.mjs`, and the matching `.node` binary.
- Wasm tarball contains only package metadata, README, license, `index.mjs`, and
  the matching `.wasm` artifact.
- No tarball contains `target/`, `node_modules/`, benchmark reports, `.omx/`,
  source build leftovers, or workspace-only paths.

## Review order

Use this order for the human pass. Stop at the first serious issue and either
fix it or record it as a blocker.

1. Package manifests and exports
2. Runtime loader and fallback resolver
3. Iterable event backend
4. Public parser wrappers
5. Cursor wrappers
6. Converter wrappers and compiled executor
7. Legacy-compatible converter/event paths
8. Native Rust boundary
9. Wasm initialization path
10. Runtime samples and browser Worker behavior
11. GitHub workflows and release sequencing
12. Documentation and README claims

## Package manifest review

Files:

- `packages/stax-xml/package.json`
- `packages/native-*/package.json`
- `packages/native-*/index.mjs`
- `packages/native-*/README.md`
- `packages/native-aggregate/package.json`

Check:

- `stax-xml` public exports are stable and do not remove existing import paths.
- Optional dependency versions exactly match the facade package version.
- Every platform package has the correct `name`, `version`, `os`, `cpu`, and
  Linux `libc` fields.
- `@stax-xml/native-wasm32-wasi` is treated as fallback, not a platform-native
  replacement.
- `files` allowlists are tight and include only intended publish artifacts.
- `publishConfig.access` is `public` for scoped packages that will be published.
- Placeholder packages are not published as stable packages before binaries are
  inserted.
- No package uses `postinstall` to download binaries.

Decision log:

- Keep `stax-xml` as facade.
- Use optional platform packages for automatic package-manager selection.
- Avoid runtime network downloads.
- Use exact versions between facade and platform packages.

## Runtime resolver review

Files:

- `packages/stax-xml/src/runtime/native-backend.ts`
- `packages/stax-xml/src/runtime/index.ts`
- `packages/stax-xml/test/runtime-backend.test.ts`

Check:

- Resolution order is native package, wasm package, JS fallback.
- Linux libc detection defaults are intentional and tested.
- Unsupported platform behavior returns JS fallback instead of failing install.
- Errors from failed optional imports are preserved for diagnostics.
- Browser/no-process behavior does not accidentally choose a Node-only package.
- The resolver is documented as resolver plumbing until packed native artifacts
  and runtime smoke tests prove end-to-end acceleration.

## Iterable event backend review

Files:

- `packages/stax-xml/src/StaxXmlIterableParser.ts`
- `packages/stax-xml/src/IterableEventBackend.ts`
- `packages/stax-xml/src/converter/IterableEventBackend.ts`
- `packages/stax-xml/src/iterable/node.ts`
- `packages/stax-xml/test/iterable-parser.test.ts`
- `packages/stax-xml/test/iterable-node-parser.test.ts`
- `packages/stax-xml/test/release-parity.test.ts`

Check:

- Browser-compatible path stays `Uint8Array` based.
- Node-only `Buffer` optimizations stay isolated in `src/iterable/node.ts`.
- Frame arrays and span indices are not retained past their valid batch lifetime.
- Text and attribute materialization happen at consumer boundaries.
- Entity decoding is not silently moved into the iterable parser.
- Chunk-boundary tests cover split tags, attributes, UTF-8, CDATA, comments,
  declarations, and malformed XML.
- Name interning or caching never becomes a correctness dependency without a
  collision-safe check.

Dead-branch watch:

- Delete branches that only protect against impossible internal parser states.
- Keep tests for malformed XML states reachable through public parser input.

## Parser wrapper review

Files:

- `packages/stax-xml/src/StaxXmlParser.ts`
- `packages/stax-xml/src/StaxXmlParserSync.ts`
- `packages/stax-xml/test/release-parity.test.ts`

Check:

- Async parser streams create and consume `IterableEventBackendIterator`.
- Sync parser strings create and consume `StaxXmlIterableParser`.
- Returned public events are owned snapshots, not live frame views.
- `STAX_XML_EVENT_BACKEND` exposes the current backend for compatible consumers.
- A consumed parser passed to converter continues from the current backend
  position.
- Public error messages remain compatible enough for existing tests and users.

## Cursor wrapper review

Files:

- `packages/stax-xml/src/cursor/StaxXmlCursorReader.ts`
- `packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts`
- `packages/stax-xml/src/cursor/CursorEventView.ts`
- `packages/stax-xml/src/cursor/types.ts`
- `packages/stax-xml/test/release-parity.test.ts`

Check:

- Cursor readers consume the iterable backend and do not maintain independent XML
  scanners.
- Cursor views are live only for the active event.
- Any cursor state transition invalidates prior live views.
- Attribute lookup remains correct after moving between events.
- Async cursor backpressure and stream chunking do not pre-consume beyond the
  documented cursor state.

## Converter review

Files:

- `packages/stax-xml/src/converter/base.ts`
- `packages/stax-xml/src/converter/index.ts`
- `packages/stax-xml/src/converter/CompiledXmlSchema.ts`
- `packages/stax-xml/src/converter/CompiledRootProcessor.ts`
- `packages/stax-xml/src/converter/XmlParserInternal.ts`
- `packages/stax-xml/src/converter/XmlParsingStateMachine.ts`
- `packages/stax-xml/src/converter/XPathEngine.ts`
- `packages/stax-xml/test/converter/internal-coverage.test.ts`
- `packages/stax-xml/test/converter/async-event-batch-iterator.test.ts`
- `packages/stax-xml/test/converter/object-position.test.ts`
- `packages/stax-xml/test/converter/string-position-parsing.test.ts`
- `packages/stax-xml/test/converter/iterable-event-backend.test.ts`
- `packages/stax-xml/test/release-parity.test.ts`

Check:

- Explicit `compile()` fixes the dispatch plan at compile time without codegen.
- Uncompiled `parse()` and `parseSync()` may auto-route only when the schema shape
  is supported by the compiled executor.
- Unsupported schema shapes fall back to the legacy-compatible executor.
- Legacy-compatible executor is thin and consumes iterable backend events where
  possible.
- Existing event-object iterator inputs remain supported.
- Already-consumed parser inputs are consumed from current backend position.
- Converter behavior remains stable for attributes, CDATA, `text()`, optional
  arrays, transforms, max depth, max events, and `decodeEntities`.
- Runtime fallback compiled plans are not passed into `CompiledRootProcessor`.
- Branches that exist only because GPT-style defensive code anticipated
  impossible states are deleted or narrowed, not hidden with ignore comments.

## Native Rust review

Files:

- `packages/native-aggregate/src/lib.rs`
- `packages/native-aggregate/build.rs`
- `packages/native-aggregate/build.mjs`
- `packages/native-aggregate/index.mjs`
- `packages/native-aggregate/smoke.mjs`
- `packages/native-aggregate/scripts/native-branch-coverage.mjs`

Check:

- All exported napi functions validate input shape before indexing.
- Every `unsafe` block has a nearby invariant comment or obvious local invariant.
- No borrowed slice or pointer outlives the napi call unless ownership is
  explicitly transferred.
- FFI null pointer, unknown tier, and parse error statuses are tested.
- Malformed XML, empty input, multibyte UTF-8/UTF-16, CDATA, comments, DOCTYPE,
  and large attribute tables are tested.
- `Uint8Array` support remains separate from Node `Buffer` assumptions.
- `cargo llvm-cov --branch` uses nightly only in the coverage gate, not in normal
  build requirements.

## Wasm review

Files:

- `packages/native-aggregate/package.json`
- `packages/native-wasm32-wasi/package.json`
- `packages/native-wasm32-wasi/index.mjs`
- Browser sample and Worker files once added or updated.

Check:

- Wasm package does not import Node-only APIs.
- Browser-facing inputs are `Uint8Array`.
- Worker path is the recommended path when parsing causes long tasks or visible
  UI delay.
- Main-thread sample records heartbeat drift or Long Task evidence.
- Wasm fallback performance is documented separately from native N-API
  `Uint8Array` performance.
- Threaded wasm requirements and cross-origin isolation caveats are documented if
  threaded wasm is used.

## Workflow review

Files:

- `.github/workflows/ci.yml`
- Future release workflow file once added.

Check current CI:

- Node 24 is used.
- `pnpm install` runs before JS tests.
- Rust native branch coverage installs `cargo-llvm-cov` from source with
  `cargo install --locked`.
- Nightly Rust is used only for branch coverage instrumentation.

Check future release workflow:

- Matrix includes Linux/macOS/Windows x64 and arm64 where feasible.
- Linux musl builds are produced separately.
- Built artifacts are uploaded for inspection before npm publishing.
- Platform packages are published before the `stax-xml` facade.
- Canary or `next` dist-tag is used before `latest`.
- Trusted publishing is used instead of npm tokens once npm org setup is done.
- Workflow verifies installed package resolves the correct optional dependency on
  each runner and falls back cleanly when optional deps are omitted.

## Runtime smoke review

Required packed-install smoke matrix:

- Node: native first, wasm fallback if native missing, JS fallback if optional
  deps omitted.
- Bun: confirm `.node` loading where supported, then fallback behavior.
- Deno: confirm npm package behavior; document `--allow-ffi` implications if
  native is used.
- Browser: wasm Worker sample and JS fallback.

For each smoke:

- Install from tarballs in a fresh temp project.
- Avoid workspace links.
- Parse the same fixture matrix.
- Compare checksum or normalized event output across JS, native, and wasm.
- Include malformed XML and invalid UTF-8 behavior.

## Human signoff template

Use this template while reviewing:

```text
Section:
Files reviewed:
Result: pass | blocked | needs follow-up
Reachable branches tested:
Dead branches deleted or requested:
Public API drift:
Browser/runtime compatibility:
Packaging/artifact concerns:
Notes:
```

Final signoff must answer:

- Can `stax-xml` be installed without native artifacts and still work?
- Can native artifacts be omitted and fallback cleanly?
- Does any public import path change without a documented semver decision?
- Are any branch misses hidden by ignore comments or unreachable guards?
- Are platform packages safe to publish with their current file contents?
- Has every generated binary artifact been inspected from a packed tarball?

## npm organization and trusted publishing checklist

Human steps:

- Create `@stax-xml` on npm if it does not already exist.
- Enable account/org 2FA.
- Seed scoped packages with a canary version before trusted publishing setup if
  npm requires package existence.
- Configure trusted publisher for each package and the release workflow.
- Verify canary install before enabling stronger org restrictions.
- After trusted publishing is verified, enable stricter token/2FA policy.

Do not perform these steps from Codex unless explicitly instructed.
