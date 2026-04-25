# stax-xml native and iterable release audit

This checklist is for the manual review pass before publishing a build that includes
the Rust native aggregate probe, the iterable parser, or converter paths built on top
of the iterable parser.

## Scope

Review these areas together because they share parsing and materialization contracts:

- `packages/native-aggregate`: Rust/napi-rs native and wasm aggregate probe.
- `packages/native-*`: publishable optional platform package manifests.
- `packages/stax-xml/src/StaxXmlIterableParser.ts`: browser-compatible `Uint8Array` iterable parser.
- `packages/stax-xml/src/iterable/node.ts`: Node `Buffer` iterable parser variant.
- `packages/stax-xml/src/runtime`: optional native/wasm/JS backend resolver.
- `packages/stax-xml/src/converter/CompiledRootProcessor.ts`: compiled converter execution path.
- `packages/stax-xml/scripts/branch-coverage-report.mjs`: release branch-coverage gate.

Current migration state:

- Compiled converter `parseSync(string)` is routed through `StaxXmlIterableParser`.
- Compiled converter async stream/event input still preserves the existing event-object path.
- Uncompiled converter schemas still use `XmlParserInternal` and `XmlParsingStateMachine`.
- Public parser and cursor classes still have independent string scanners.
- The native/wasm resolver is opt-in through `stax-xml/runtime`; it is not yet wired into public parser/converter execution.
- Do not describe parser/cursor/converter migration as complete until those remaining paths are moved or explicitly deprecated.

## Required automated checks

Run these from the workspace root:

```sh
pnpm --filter stax-xml exec tsc -p tsconfig.json --noEmit
pnpm --filter stax-xml coverage
pnpm --dir packages/stax-xml coverage:branch-gate
pnpm --filter stax-xml build
pnpm --dir packages/stax-xml pack --dry-run
```

Run these for the native probe when the Rust target/toolchain is available:

```sh
pnpm --dir packages/native-aggregate build:native
pnpm --dir packages/native-aggregate smoke
```

The release branch gate covers every `src/**/*.ts` file with branch data and fails
unless each file has 100% branch coverage. Until the remaining legacy parser,
cursor, converter, writer, and adapter misses are either tested or deleted, this
gate is expected to block release.

## Dead-branch policy

Branch coverage misses must be handled in this order:

1. Delete unreachable defensive branches.
2. Narrow types or invariants so impossible states cannot be represented locally.
3. Add tests only for states that can occur through supported public or internal APIs.

Avoid adding `v8 ignore` for new code. If a branch is truly impossible because the
compiled lowering step guarantees an invariant, prefer a cast or smaller private
contract over a runtime fallback that cannot be exercised.

## Native review checklist

- Confirm exported napi functions validate all input lengths, offsets, and chunk counts before indexing.
- Confirm no Rust slice, pointer, or borrowed view can outlive the napi call unless ownership is explicitly transferred.
- Confirm every `unsafe` block has a local invariant that can be checked from nearby code.
- Confirm panic paths are converted to JavaScript errors or are unreachable by construction.
- Confirm wasm builds do not depend on Node `Buffer`; browser-facing inputs must be `Uint8Array`.
- Confirm native and wasm smoke tests cover empty input, malformed XML, multibyte UTF-8, and large repeated chunks.

## Iterable parser review checklist

- Frame arrays returned by `batchFrame()` are valid only until the next batch call.
- Name interning must not rely on hashes alone for correctness if collisions become observable.
- Text and attribute values are materialized only at the consumer boundary.
- Chunk-boundary tests must cover split tags, split attributes, split UTF-8, CDATA, comments, and declarations.
- Browser path must stay `Uint8Array` based; Node-specific `Buffer` optimizations stay in `src/iterable/node.ts`.

## Converter review checklist

- Compiled sync string parsing must keep behavior parity for attributes, CDATA, direct `text()`, optional arrays, transforms, max depth, max events, and `decodeEntities`.
- Entity decoding belongs at materialization boundaries; the iterable parser should not start returning decoded text implicitly.
- Async/event iterator compatibility must remain until its migration is planned and tested separately.
- Fallback/runtime compiled plans must not be sent into `CompiledRootProcessor`.
- Documentation must distinguish compiled fast path from uncompiled converter behavior.

## Packaging review checklist

- Keep `packages/native-aggregate` as a benchmark/probe package until the release workflow copies its artifacts into `packages/native-*`.
- Verify `stax-xml` optional dependencies exactly match the published platform package version.
- Verify each `packages/native-*` manifest has the correct `os`, `cpu`, and Linux `libc` fields before npm publication.
- Verify package names and publish visibility before any npm release.
- Native prebuild resolution must be documented before publishing platform-specific artifacts.
- Wasm fallback must document expected performance tradeoffs and browser requirements.
- Do not mark native or wasm support as stable until install, import, and smoke tests pass on a clean checkout.
