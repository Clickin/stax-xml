# stax-xml 네이티브 SIMD Human Review Guide

이 문서는 native acceleration 작업의 human review 안내서입니다. publish
지시서가 아닙니다. 자동화된 SIMD/native correctness gate는 최신 근거 기준으로
닫혔고, 남은 엔지니어링 gate는 사람이 직접 수행하는 line-by-line review입니다.
실제 npm publish 전에는 이 문서 하단의 패키징/운영 체크도 별도로 완료해야
합니다.

## 현재 상태

2026-04-26 기준 `origin/master`의 최신 기준 커밋은 `db560f4`입니다.

- `stax-xml`은 계속 public facade package입니다.
- `packages/native-*` 아래에 scoped optional platform package가 있습니다.
- `packages/native-aggregate`는 Rust/napi-rs 기반 native implementation probe이며,
  benchmark와 platform package staging에 사용됩니다. 이 패키지 자체는 private이고
  최종 publish 대상 platform package가 아닙니다.
- `packages/stax-xml`은 platform package들을 exact-version optional dependency로
  선언합니다.
- runtime resolver는 native package, wasm package, JavaScript fallback 순서로
  시도합니다.
- public parser, sync parser, sync cursor, async cursor, compiled converter sync
  string parsing, converter stream parsing은 iterable event backend 위로 이동했습니다.
- uncompiled converter schema는 아직 legacy-compatible state-machine executor를
  사용하지만, 가능한 경우 string/stream/parser-provider input을 iterable backend
  event로 소비합니다.
- 기존 event-object input compatibility는 의도적으로 유지합니다.
- 이미 소비된 parser input은 wrapper를 통해 처음부터 재시작하면 안 되고 현재
  backend position에서 이어서 소비해야 합니다.
- TypeScript whole-source branch coverage는
  `packages/stax-xml/scripts/branch-coverage-report.mjs`가 gate입니다.
- Rust native branch coverage는
  `packages/native-aggregate/scripts/native-branch-coverage.mjs`가 gate입니다. 이
  스크립트는 Rust core를 `--no-default-features`로 빌드하여 coverage binary가
  `napi`를 링크하지 않게 합니다.
- default native addon build는 여전히 `napi-bindings` feature를 켭니다. 따라서
  N-API wrapper 동작은 native build/smoke check에서 별도로 검증합니다.
- native aggregate implementation은 `auto`, `off`, `avx2`, `sse42`, `neon`
  explicit SIMD policy를 노출합니다. 사용할 수 없는 explicit policy는 다른 SIMD
  경로로 조용히 대체하지 않고 error를 반환해야 합니다.
- simdxml 비교는 Node 기반 benchmark harness와 external Rust shim을 통해서만
  수행합니다. stax-xml native code를 standalone Rust binary로 직접 benchmark하지
  않습니다.

## 최신 근거

아래 근거는 human review 시작점입니다. 코드나 benchmark contract가 바뀌면 모두
다시 실행해야 합니다.

- Windows x86_64에서 `pnpm coverage:native`가 Rust native core branch coverage
  `1352/1352 (100.00%)`로 통과했습니다.
- Apple Silicon M4/macOS arm64에서 사용자가 생성한
  `native-branch-summary 복사본.json` 기준 Rust native core branch coverage가
  `1332/1332 (100.00%)`로 통과했습니다. 이 raw JSON 복사본은 local evidence이며
  git에 추가하지 않습니다.
- default feature Rust test는 41개 test가 통과했고, N-API wrapper entrypoint
  coverage를 포함합니다.
- no-default-feature Rust test는 40개 test가 통과했고, `napi` 없이 core Rust만
  검증합니다.
- `cargo clippy`는 default-feature와 no-default-feature 양쪽에서 통과했습니다.
- `pnpm --filter benchmark run build:native-aggregate`와
  `pnpm --filter benchmark run smoke:native-aggregate`가 최종 N-API linkage 분리
  이후 통과했습니다.
- `git diff --check`가 통과했습니다. Windows에서는 Git의 LF/CRLF warning이 보일
  수 있습니다.

## 남은 Gate

엔지니어링 release readiness는 아래 항목이 끝날 때까지 완료로 보지 않습니다.

- 이 문서의 모든 섹션에 대한 human line-by-line review.
- SIMD/native benchmark claim이 체크인된 benchmark artifact와 일치하는지 확인.
- benchmark가 우리에게 유리한 fixture에만 기대지 않는지 확인.
- simdxml에서 차용했거나 simdxml 구조에 명시적으로 영향을 받은 code path가
  source notice를 갖고 있는지 확인.
- 해당 notice가 simdxml의 MIT license option과 충돌하지 않는지 확인.

실제 npm publish는 별도 운영 절차입니다. publish 전에는 platform artifact,
packed install, npm organization, trusted publishing check를 이 문서 하단 절차에
따라 별도로 완료해야 합니다.

## 자동 검증 명령

workspace root에서 실행합니다.

```sh
pnpm --filter stax-xml exec tsc -p tsconfig.json --noEmit
pnpm --filter stax-xml test
pnpm --filter stax-xml coverage
pnpm --dir packages/stax-xml coverage:branch-report
pnpm --dir packages/stax-xml coverage:branch-gate
pnpm --filter stax-xml build
pnpm coverage:native
pnpm coverage:all
pnpm --filter benchmark run release:expanded
pnpm --filter benchmark run release:cross-runtime -- --native-simd=auto --simdxml-max-mib=64
pnpm --filter benchmark run release:simdxml-upstream
git diff --check
```

native probe 검증:

```sh
cargo test --manifest-path packages/native-aggregate/Cargo.toml
cargo test --manifest-path packages/native-aggregate/Cargo.toml --no-default-features
cargo clippy --manifest-path packages/native-aggregate/Cargo.toml --all-targets
cargo clippy --manifest-path packages/native-aggregate/Cargo.toml --all-targets --no-default-features
pnpm --filter benchmark run build:native-aggregate
pnpm --filter benchmark run smoke:native-aggregate
```

coverage 해석 규칙:

- Windows/x86_64와 macOS/arm64는 target-specific SIMD code가 다르므로 전체 branch
  count가 다를 수 있습니다. CPU 간 branch count 동일성보다 `covered == count`와
  `notcovered == 0`을 확인합니다.
- macOS coverage rustc command에 `--extern napi=...`가 나타나면
  no-default-feature coverage 분리가 깨진 것입니다.
- default-feature smoke에서 malformed XML은 JS exception으로 throw되어야 합니다.
  `Error` object를 반환하는 것은 napi-rs wrapper signature regression입니다.

## 패키징 검증

artifact가 생성된 뒤 실행합니다.

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

tarball rule:

- `stax-xml` tarball은 `dist`, package metadata, README, license만 포함합니다.
- native platform tarball은 package metadata, README, license, `index.mjs`, 대상
  `.node` binary만 포함합니다.
- wasm tarball은 package metadata, README, license, `index.mjs`, 대상 `.wasm`
  artifact만 포함합니다.
- 어떤 tarball도 `target/`, `node_modules/`, benchmark raw report, `.omx/`, source
  build leftover, workspace-only path를 포함하면 안 됩니다.

## 리뷰 순서

아래 순서로 human review를 수행합니다. 심각한 문제가 나오면 즉시 멈추고 고치거나
blocker로 기록합니다.

1. Package manifest와 export
2. Runtime loader와 fallback resolver
3. Iterable event backend
4. Public parser wrapper
5. Cursor wrapper
6. Converter wrapper와 compiled executor
7. Legacy-compatible converter/event path
8. Native Rust boundary
9. SIMD와 benchmark evidence
10. Wasm initialization path
11. Runtime sample과 browser Worker behavior
12. GitHub workflow와 release sequencing
13. Documentation과 README claim

## Package Manifest Review

대상 파일:

- `packages/stax-xml/package.json`
- `packages/native-*/package.json`
- `packages/native-*/index.mjs`
- `packages/native-*/README.md`
- `packages/native-aggregate/package.json`

확인 항목:

- `stax-xml` public export가 안정적이고 기존 import path를 제거하지 않습니다.
- optional dependency version이 facade package version과 정확히 일치합니다.
- 모든 platform package의 `name`, `version`, `os`, `cpu`, Linux `libc` field가
  올바릅니다.
- `@stax-xml/native-wasm32-wasi`는 platform-native replacement가 아니라 fallback로
  취급됩니다.
- `files` allowlist가 의도한 publish artifact만 허용합니다.
- publish 대상 scoped package는 `publishConfig.access`가 `public`입니다.
- placeholder package를 binary 삽입 전 stable package로 publish하지 않습니다.
- binary download를 위해 `postinstall`을 사용하지 않습니다.

결정 기록:

- `stax-xml`은 facade로 유지합니다.
- package-manager optional dependency selection을 위해 optional platform package를
  사용합니다.
- runtime network download는 사용하지 않습니다.
- facade와 platform package version은 exact version으로 맞춥니다.

## Runtime Resolver Review

대상 파일:

- `packages/stax-xml/src/runtime/native-backend.ts`
- `packages/stax-xml/src/runtime/index.ts`
- `packages/stax-xml/test/runtime-backend.test.ts`

확인 항목:

- resolution order는 native package, wasm package, JS fallback입니다.
- Linux libc detection default가 의도되어 있고 test로 보호됩니다.
- unsupported platform은 install failure가 아니라 JS fallback으로 이어집니다.
- failed optional import error는 diagnostic을 위해 보존됩니다.
- browser/no-process 환경에서 Node-only package를 고르지 않습니다.
- resolver는 packed native artifact와 runtime smoke로 end-to-end acceleration이
  증명되기 전까지 resolver plumbing으로 문서화됩니다.

## Iterable Event Backend Review

대상 파일:

- `packages/stax-xml/src/StaxXmlIterableParser.ts`
- `packages/stax-xml/src/IterableEventBackend.ts`
- `packages/stax-xml/src/converter/IterableEventBackend.ts`
- `packages/stax-xml/src/iterable/node.ts`
- `packages/stax-xml/test/iterable-parser.test.ts`
- `packages/stax-xml/test/iterable-node-parser.test.ts`
- `packages/stax-xml/test/release-parity.test.ts`

확인 항목:

- browser-compatible path는 `Uint8Array` 기반으로 유지됩니다.
- Node-only `Buffer` optimization은 `src/iterable/node.ts`에 격리됩니다.
- frame array와 span index는 유효한 batch lifetime을 넘겨 보관하지 않습니다.
- text/attribute materialization은 consumer boundary에서만 일어납니다.
- entity decoding이 iterable parser 내부로 조용히 이동하지 않습니다.
- chunk-boundary test가 split tag, attribute, UTF-8, CDATA, comment, declaration,
  malformed XML을 포함합니다.
- name interning/cache가 collision-safe check 없이 correctness dependency가 되지
  않습니다.

dead-branch watch:

- 내부 parser state상 논리적으로 불가능한 상태만 방어하는 branch는 삭제합니다.
- public parser input으로 도달 가능한 malformed XML state test는 유지합니다.

## Parser Wrapper Review

대상 파일:

- `packages/stax-xml/src/StaxXmlParser.ts`
- `packages/stax-xml/src/StaxXmlParserSync.ts`
- `packages/stax-xml/test/release-parity.test.ts`

확인 항목:

- async parser stream은 `IterableEventBackendIterator`를 생성하고 소비합니다.
- sync parser string은 `StaxXmlIterableParser`를 생성하고 소비합니다.
- public event 반환값은 live frame view가 아니라 owned snapshot입니다.
- `STAX_XML_EVENT_BACKEND`는 compatible consumer를 위해 현재 backend를 노출합니다.
- converter에 전달된 consumed parser는 현재 backend position에서 이어서 소비됩니다.
- public error message는 기존 test와 사용자에게 충분히 compatible합니다.

## Cursor Wrapper Review

대상 파일:

- `packages/stax-xml/src/cursor/StaxXmlCursorReader.ts`
- `packages/stax-xml/src/cursor/StaxXmlCursorReaderAsync.ts`
- `packages/stax-xml/src/cursor/CursorEventView.ts`
- `packages/stax-xml/src/cursor/types.ts`
- `packages/stax-xml/test/release-parity.test.ts`

확인 항목:

- cursor reader는 iterable backend를 소비하며 독립 XML scanner를 유지하지 않습니다.
- cursor view는 active event에 대해서만 live합니다.
- 모든 cursor state transition은 이전 live view를 invalidate합니다.
- event 이동 후 attribute lookup이 계속 정확합니다.
- async cursor backpressure와 stream chunking이 문서화된 cursor state보다 앞서
  pre-consume하지 않습니다.

## Converter Review

대상 파일:

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

확인 항목:

- explicit `compile()`은 codegen 없이 compile time에 dispatch plan을 고정합니다.
- uncompiled `parse()`와 `parseSync()`는 schema shape가 compiled executor에서 지원될
  때만 auto-route할 수 있습니다.
- unsupported schema shape는 legacy-compatible executor로 fallback합니다.
- legacy-compatible executor는 얇게 유지하며 가능한 경우 iterable backend event를
  소비합니다.
- 기존 event-object iterator input은 계속 지원합니다.
- 이미 소비된 parser input은 현재 backend position에서 소비합니다.
- attribute, CDATA, `text()`, optional array, transform, max depth, max events,
  `decodeEntities` 동작이 안정적입니다.
- runtime fallback compiled plan은 `CompiledRootProcessor`로 전달하지 않습니다.
- GPT식 방어 코드가 예상한 불가능한 상태만을 위한 branch는 ignore comment로 숨기지
  말고 삭제하거나 좁힙니다.

## Native Rust Review

대상 파일:

- `packages/native-aggregate/Cargo.toml`
- `packages/native-aggregate/src/lib.rs`
- `packages/native-aggregate/src/error.rs`
- `packages/native-aggregate/src/aggregate.rs`
- `packages/native-aggregate/src/aggregate/api.rs`
- `packages/native-aggregate/src/aggregate/model.rs`
- `packages/native-aggregate/src/aggregate/aggregate_parse.rs`
- `packages/native-aggregate/src/aggregate/simd_classifier.rs`
- `packages/native-aggregate/src/aggregate/span_table.rs`
- `packages/native-aggregate/src/aggregate/projection.rs`
- `packages/native-aggregate/src/xpath_index.rs`
- `packages/native-aggregate/build.rs`
- `packages/native-aggregate/build.mjs`
- `packages/native-aggregate/index.mjs`
- `packages/native-aggregate/smoke.mjs`
- `packages/native-aggregate/scripts/native-branch-coverage.mjs`

확인 항목:

- core parser/projection/index module은 `crate::error::{Error, Result}`를 사용하고
  `napi` type에 의존하지 않습니다.
- `napi` type과 `napi::Result` 변환은 `api.rs` 또는 명시적인 N-API wrapper boundary에만
  존재합니다.
- `Cargo.toml`의 default feature는 `napi-bindings`이고, coverage는
  `--no-default-features`로 core만 측정합니다.
- `pnpm coverage:native` 실행 중 rustc command에 `--extern napi=...`가 나타나지
  않습니다.
- 모든 exported napi function은 indexing 전에 input shape를 검증합니다.
- 모든 `unsafe` block에는 가까운 invariant comment가 있거나 local invariant가
  명확합니다.
- borrowed slice/pointer가 napi call보다 오래 살지 않습니다. ownership transfer가
  필요하면 명시되어야 합니다.
- FFI null pointer, unknown tier, parse error status가 test로 보호됩니다.
- malformed XML, empty input, multibyte UTF-8/UTF-16, CDATA, comment, DOCTYPE,
  large attribute table이 test로 보호됩니다.
- `Uint8Array` support는 Node `Buffer` assumption과 분리되어 있습니다.
- default-feature smoke는 malformed XML에서 JS exception을 throw합니다.
- no-default-feature test는 native core를 `napi` 없이 검증합니다.

## SIMD와 Benchmark Evidence Review

대상 파일:

- `packages/native-aggregate/src/aggregate/simd_classifier.rs`
- `packages/native-aggregate/src/aggregate/tests.rs`
- `packages/benchmark/cross-runtime-comparison.mjs`
- `packages/benchmark/simdxml-upstream-comparison.mjs`
- `packages/benchmark/external/simdxml-bench/src/main.rs`
- `packages/benchmark/results/release/cross-runtime-comparison.md`
- `packages/benchmark/results/release/simdxml-upstream-comparison.md`
- `packages/benchmark/knowledge/reports/iterable/STRUCTURAL_INDEX_MVP_EVIDENCE_2026-04-26.md`
- `packages/benchmark/knowledge/reports/iterable/STRUCTURAL_INDEX_ACCELERATION_PLAN_2026-04-26.md`

확인 항목:

- `auto` policy가 안전한 platform default만 사용합니다.
- `off` policy는 scalar path를 강제합니다.
- `avx2`, `sse42`, `neon` explicit policy는 target/CPU에서 사용할 수 없을 때 error를
  반환합니다.
- quote mask가 single quote와 double quote를 모두 처리하고, quoted `<`, `>`, `=`를
  structural byte로 잘못 분류하지 않습니다.
- x86_64에서는 AVX2/SSE4.2 path가 scalar와 같은 event count/checksum을 냅니다.
- arm64에서는 NEON path가 scalar와 같은 event count/checksum을 냅니다.
- Windows/x86_64와 macOS/arm64 coverage branch count 차이는 target cfg 차이로
  설명됩니다.
- benchmark는 Node+napi wrapper를 통해 stax-xml native addon을 호출합니다. 직접 Rust
  binary benchmark 결과를 release claim으로 쓰면 안 됩니다.
- simdxml comparator는 `simdxml::parse` 기반 external shim이며, fixture size cap
  `--simdxml-max-mib`를 지킵니다.
- simdxml fixture/test script를 가져온 사실과 memory-size cap이 benchmark markdown에
  명시되어 있습니다.
- simdxml-informed code에는 source notice가 있습니다. 현재 반드시 확인할 곳은
  `src/aggregate/model.rs`, `src/xpath_index.rs`,
  `benchmark/external/simdxml-bench/src/main.rs`입니다.
- raw generated benchmark bundle은 repo policy에 따라 evidence branch에 보존하고,
  mainline에는 curated summary와 reproduction command만 둡니다.

## Wasm Review

대상 파일:

- `packages/native-aggregate/package.json`
- `packages/native-wasm32-wasi/package.json`
- `packages/native-wasm32-wasi/index.mjs`
- browser sample과 Worker file이 추가되거나 갱신된 경우 해당 파일.

확인 항목:

- wasm package는 Node-only API를 import하지 않습니다.
- browser-facing input은 `Uint8Array`입니다.
- parsing이 long task나 visible UI delay를 만들면 Worker path를 추천합니다.
- main-thread sample은 heartbeat drift 또는 Long Task evidence를 기록합니다.
- wasm fallback performance는 native N-API `Uint8Array` performance와 별도로
  문서화합니다.
- threaded wasm을 사용하면 cross-origin isolation caveat를 문서화합니다.

## Workflow Review

대상 파일:

- `.github/workflows/ci.yml`
- future release workflow file이 추가된 경우 해당 파일.

현재 CI 확인:

- Node 24를 사용합니다.
- JS test 전에 `pnpm install`을 실행합니다.
- Rust native branch coverage는 `cargo install --locked`로 `cargo-llvm-cov`를
  설치합니다.
- nightly Rust는 branch coverage instrumentation에만 사용합니다.

미래 release workflow 확인:

- feasible한 범위에서 Linux/macOS/Windows x64와 arm64 matrix를 포함합니다.
- Linux musl build는 별도 산출물로 생성합니다.
- built artifact는 npm publish 전에 inspection용 artifact로 upload합니다.
- platform package를 `stax-xml` facade보다 먼저 publish합니다.
- `latest` 전에 canary 또는 `next` dist-tag를 사용합니다.
- npm org setup이 끝난 뒤 trusted publishing을 npm token 대신 사용합니다.
- 각 runner에서 installed package가 올바른 optional dependency를 resolve하고,
  optional dependency가 빠졌을 때 clean fallback하는지 검증합니다.

## Runtime Smoke Review

packed install smoke matrix:

- Node: native first, native missing 시 wasm fallback, optional dependency 생략 시 JS
  fallback.
- Bun: `.node` loading 지원 여부와 fallback behavior.
- Deno: npm package behavior. native 사용 시 `--allow-ffi` implication을 문서화합니다.
- Browser: wasm Worker sample과 JS fallback.

각 smoke 공통 규칙:

- fresh temp project에 tarball로 install합니다.
- workspace link를 사용하지 않습니다.
- 같은 fixture matrix를 parse합니다.
- JS/native/wasm 간 checksum 또는 normalized event output을 비교합니다.
- malformed XML과 invalid UTF-8 behavior를 포함합니다.

## Human Signoff Template

리뷰할 때 아래 template을 사용합니다.

```text
Section:
Files reviewed:
Result: pass | blocked | needs follow-up
Reachable branches tested:
Dead branches deleted or requested:
Public API drift:
Browser/runtime compatibility:
Packaging/artifact concerns:
SIMD/benchmark concerns:
Notes:
```

최종 signoff는 아래 질문에 답해야 합니다.

- native artifact 없이 `stax-xml`을 install해도 동작하는가?
- native artifact가 빠져도 clean fallback하는가?
- 문서화된 semver decision 없이 public import path가 바뀌었는가?
- ignore comment나 unreachable guard로 branch miss를 숨겼는가?
- native SIMD policy가 target CPU에서 명시적으로 설명 가능한가?
- simdxml 비교가 Node+napi 기준 stax-xml native addon과 공정하게 비교되는가?
- platform package는 현재 file content로 publish해도 안전한가?
- generated binary artifact를 packed tarball에서 직접 검사했는가?

## npm Organization과 Trusted Publishing Checklist

사람이 직접 수행할 단계:

- npm에 `@stax-xml` organization이 없으면 생성합니다.
- account/org 2FA를 활성화합니다.
- npm이 package existence를 요구하면 trusted publishing setup 전에 canary version으로
  scoped package를 seed합니다.
- 각 package와 release workflow에 trusted publisher를 설정합니다.
- 강한 org restriction을 켜기 전에 canary install을 검증합니다.
- trusted publishing 검증 후 token/2FA policy를 강화합니다.

Codex는 명시적인 요청 없이는 이 npm 운영 단계를 수행하지 않습니다.
