# Token cursor SPI / AssemblyScript Wasm 실험 보고서

**결론: Outcome 3 — 대표 byte workload에서 의미 있는 승리 없음.** 기본 `stax-xml`은 JS로 유지한다. SPI와 기능이 완성된 opt-in `@stax-xml/wasm`은 재현 가능한 실험 및 후속 최적화의 기준으로 보존하며, 자동 선택/기본 backend 승격은 하지 않는다.

## 1. 변경 파일과 컴포넌트

- `packages/stax-xml/src/core/TokenCursorSpi.ts`, `core/internal/token-backend.ts`, `experimental/backend.ts`: cursor/session/factory 계약과 실험용 주입 경계.
- `TokenCursor.ts`, core exports, event materializer, sync/async readers, `converter/converter/CompiledRootProcessor.ts`: primitive attribute 접근 및 session 소유권으로 전환. XML 선언 분할과 연속 wide-attribute 요소의 duplicate-table generation 회귀도 수정.
- `packages/wasm/`: loader, JS facade/session, reader/converter exports, `assembly/tokenizer.ts`, scalar/SIMD 빌드, 전용 AS runner, 계약/메모리/수명 테스트, README/패키징.
- `packages/benchmark/wasm-backend.mjs`, `common/parser-scenarios.mjs`: 기존 문서 projection을 재사용하는 비교 측정. root scripts, workspace/lockfile, release verifier, W3C runner와 CHANGELOG 갱신.
- 기존 사용자 변경은 보존했다. 계획의 reviewed SHA는 `9a839ffb6824a25c4cc2fa6698e860daea5b5816`, 실제 시작점은 더 최신인 `5990c034a97f6dc6cc651d40b57cfe15d5dd0a2e`이며 구현은 별도 `next/wasm` 브랜치에서 유지한다.

## 2. 최종 SPI와 선택 이유

`TokenCursorSpi`는 `next()`, current-token getters, indexed primitive attribute getters, declaration/namespace lookup, `dispose()`를 제공한다. `next()`는 token / `NEED_INPUT` / EOF를 구분한다. `TokenInputSessionSpi`는 `cursor`, `pushBytes(bytes, final?)`, `dispose()`를 소유한다. `TokenBackendFactory`는 string cursor와 byte session 생성을 분리한다.

기존 Reader/converter에 decoder를 남기지 않고 JS session만 TextDecoder를 소유한다. 문자열은 JS로 직접 파싱하며 Wasm으로 재인코딩하지 않는다. `withTokenBackend`는 options에 non-enumerable symbol을 붙이는 실험용 API다. `TokenAttribute` 객체는 SPI에 없으며 이벤트가 실제 요청될 때 materialize한다. 기존 concrete `attribute()`는 계획에서 허용한 내부 호환 용도로만 남겼다.

## 3. Wasm ABI

숫자와 raw memory span만 전달한다: `initialize`, `reserve`/`commit`, `next`, `fieldPtr`/`fieldLen`, attribute count/self-closing/declaration flags, namespace scratch lookup, custom-entity 등록, error code/position/message span, `dispose`, input-capacity 진단.

입력은 Wasm memory로 복사하고 UTF-8 검증/토큰화는 AS에서 수행한다. JS facade는 요청한 필드만 TextDecoder로 변환하고 현재 token에 캐시한다. managed AS string/array를 hot ABI로 넘기지 않는다. memory.grow 이후 view를 갱신한다.

## 4. AssemblyScript runtime / memory 모델

AssemblyScript 0.28.20, `minimal` runtime, optimizeLevel 3, shrinkLevel 2, noAssert. cursor마다 독립 Wasm instance를 만들고 compiled module은 variant별로 캐시한다. raw heap 할당으로 input/state/scratch를 관리하며 소비한 입력을 compact한다. entity 변환이 없는 값은 입력 span을 빌리고 변환이 필요한 값만 scratch에 쓴다.

보유량은 전체 문서가 아니라 live chunk/token/open-state 크기에 좌우된다. 단일 거대 token이나 chunk의 저장 비용까지 상수라고 주장하지 않는다. wasm32 범위를 사용하며 stringref, Wasm GC, JS Text Encoding Builtins는 필수 의존성이 아니다.

## 5. 포팅한 의미론

프로젝트가 지원하는 XML 선언/BOM, document·fragment 모드, start/end/self-closing, attributes와 duplicate detection, namespace shadowing/restoration 및 qualified/local/prefix/URI 접근, text/CDATA/comments/PI, 지원 범위의 DOCTYPE, XML 문자/UTF-8 검증, predefined/numeric/custom entities, autoDecodeEntities, incremental NEED_INPUT, 오류와 dispose를 구현했다. UTF-8 bytes는 실제 Wasm 경로이며 non-UTF-8는 JS/TextDecoder로 보낸다.

## 6. 알려진 범위와 parity 제한

공유 계약·분할·fuzz·W3C 실행 범위에서 불일치/실패는 없었다. 이는 XML 전체 규격이나 모든 입력에 대한 형식적 동등성 증명은 아니다. JS와 Wasm의 오류 문구/위치 단위까지 동일하다고 보장하지 않는다. 기존 JS에서 지원하지 않는 DTD 검증/외부 entity 기능을 추가하지 않았다. W3C skip 203건을 통과로 계산하지 않았다.

## 7. 테스트 / conformance / 실행 증거

- JS: 기존 658개 → 최종 **662개 통과**. statements 3400/3400, branches 2501/2501, functions 508/508, lines 3135/3135: 기존 **100% gate 유지**.
- Wasm JS integration: **29개 통과**. AS 전용 `vitest-pool-assemblyscript@0.18.0`: scalar 9 + SIMD 9 = **18개 통과**. Vitest 4.1.4 사용.
- AS source coverage: statements **84.05%**, branches **77.69%**, functions **93.02%**, lines **95.13%**. 이 수치는 전용 AS suite의 coverage이며 W3C 실행까지 합산한 수치가 아니다.
- JS/scalar/SIMD 각각 W3C **805 passed / 203 skipped / 0 failed**. Wasm variant별 실제 UTF-8 경로 800건, non-UTF-8 JS fallback 5건.
- skip 분류: named entity 78, unsupported declaration 2, not-wf DTD 117, namespace-incompatible name 4, strict document mode 2.
- 모든 byte boundary 공유 fixture와 backend별 300 seeded differential cases, UTF-8 분할, retained strings, memory growth, 반복 파싱 및 128 MiB streaming 검증.
- Chrome 150에서 실제 HTTP asset 로딩, scalar/SIMD, converter subpath 초기화 공유, 1-byte async UTF-8 chunks, Wasm 없는 기본 JS/string fallback 확인.
- 두 패키지를 pack하고 workspace link 없는 별도 consumer에 tarball로 설치하여 root/converter/공개 wasm asset exports를 실행했다. 로컬 stax-xml tarball override를 사용했으며 registry publish는 하지 않았다.

실제 실행한 검증 명령:

```sh
pnpm install
pnpm build
pnpm test
pnpm test:w3c
pnpm coverage
pnpm verify:release-surfaces
pnpm build:wasm
pnpm test:wasm
pnpm --dir packages/wasm coverage:assembly
pnpm --dir packages/wasm test:js test/memory.test.ts --reporter=verbose --silent=false
pnpm --dir packages/stax-xml pack --pack-destination /tmp/stax/pack
pnpm --dir packages/wasm pack --pack-destination /tmp/stax/pack
```

별도 `/tmp/stax/packed-consumer`에서 `pnpm install --offline && node smoke.mjs`도 실행했다. 임시 consumer/server/profiling script는 제거했고 실행한 smoke source와 결과는 `verification.json`, `profile.json`에 보존했다.

## 8. JS before/after SPI 회귀 gate

동일 Node 24.21.0 / Apple M4에서 baseline bundle과 SPI bundle을 paired 비교했다. 아래는 ms median이며 양수는 느려짐이다. 최대 회귀 **+0.58%**, 모든 항목이 2% gate 안이다. 이후 여러 backend를 한 process에서 섞는 전체 matrix의 절대 JS 시간으로 이 gate를 대체하지 않는다.

| Fixture | 경로 | 이전 ms | SPI ms | 변화 |
|---|---|---|---|---|
| 13 MiB | stax-xml EventReaderSync (JS object) | 114.641 | 114.082 | -0.49% |
| 13 MiB | stax-xml StreamReaderSync (JS object) | 98.509 | 97.008 | -1.52% |
| 13 MiB | stax-xml Converter API (JS object) | 97.533 | 95.469 | -2.12% |
| 98 MiB | stax-xml EventReaderSync (JS object) | 831.946 | 836.791 | +0.58% |
| 98 MiB | stax-xml StreamReaderSync (JS object) | 680.630 | 675.828 | -0.71% |
| 98 MiB | stax-xml Converter API (JS object) | 649.183 | 641.227 | -1.23% |
| 16 MiB | compiled converter | 206.337 | 204.764 | -0.76% |

## 9. JS / scalar / SIMD 성능 및 문서 수치 비교

현재 측정: Node 24.21.0 / V8 13.6.233.17-node.53 / macOS 25.5.0 arm64 / Apple M4. 각 matrix는 warmup 2회 + 측정 5회. 생성 fixture와 catalog는 16 MiB이며 문서의 13/98 MiB fixture는 실제 12.96/97.16 MiB다. byte copy, 요청한 decoding, JS materialization 비용을 포함한다. 문서 projection은 full-result parity를 timing 밖에서 확인했다.

### 문서와 동일 projection: 두 GC 조건 모두 보존 (median ms)

| 조건 | Fixture | 경로 | JS | scalar | SIMD |
|---|---|---|---|---|---|
| 자연 GC | docs-13mib | EventReaderSync (string, JS fallback) | 129.57 | 132.27 | 130.81 |
| 자연 GC | docs-13mib | StreamReaderSync (bytes) | 95.40 | 225.14 | 224.40 |
| 자연 GC | docs-13mib | Converter (bytes) | 79.44 | 225.83 | 217.10 |
| 자연 GC | docs-98mib | EventReaderSync (string, JS fallback) | 984.83 | 1768.13 | 1017.96 |
| 자연 GC | docs-98mib | StreamReaderSync (bytes) | 706.52 | 1760.31 | 1706.57 |
| 자연 GC | docs-98mib | Converter (bytes) | 616.12 | 1670.61 | 1869.05 |
| 샘플 전 GC | docs-13mib | EventReaderSync (string, JS fallback) | 215.45 | 114.86 | 114.80 |
| 샘플 전 GC | docs-13mib | StreamReaderSync (bytes) | 190.00 | 224.79 | 222.09 |
| 샘플 전 GC | docs-13mib | Converter (bytes) | 96.50 | 224.82 | 222.42 |
| 샘플 전 GC | docs-98mib | EventReaderSync (string, JS fallback) | 1644.68 | 883.80 | 873.18 |
| 샘플 전 GC | docs-98mib | StreamReaderSync (bytes) | 1431.65 | 1736.01 | 1703.91 |
| 샘플 전 GC | docs-98mib | Converter (bytes) | 648.41 | 1683.90 | 1644.00 |

**주의:** EventReader string 행의 scalar/SIMD 열도 실제로는 JS fallback이다. 그 차이를 Wasm 가속으로 해석하면 안 된다. 자연 GC matrix의 일부 표본은 큰 분산을 보였고, 샘플 전 GC matrix에서는 일부 JS reader/string 행의 수준 자체가 달라졌다. backend 혼합/JIT/GC history가 원인 후보이나 정확한 원인은 확정하지 않았다. 두 matrix는 backend별 격리 process 측정이 아니며 어느 한 숫자를 보편적인 배율로 주장하지 않는다. 원본 표본을 모두 남겼다. 두 조건 모두 대표 byte Reader에서 Wasm의 승리는 없다.

### 실제 기존 문서 수치와 평균끼리 비교 (ms)

문서 `resources/benchmarks.mdx`가 읽는 `results/release/latest-summary.json`은 **Node 26.5.0, 평균(avgNs)**이다. 아래 현재 값은 샘플 전 GC matrix의 평균이다. runtime/측정 history가 다르므로 차이를 이번 코드 변경의 인과 효과로 해석하지 않는다. 역사적 수치와 현재 측정을 구분하기 위한 비교다.

| Fixture | 경로 | 문서 JS 평균 | 현재 JS 평균 | scalar 평균 | SIMD 평균 |
|---|---|---|---|---|---|
| docs-13mib | EventReaderSync (string, JS fallback) | 124.75 | 216.15 | 114.97 | 114.82 |
| docs-13mib | StreamReaderSync (bytes) | 115.81 | 191.31 | 225.05 | 222.18 |
| docs-13mib | Converter (bytes) | 113.80 | 96.66 | 226.37 | 231.83 |
| docs-98mib | EventReaderSync (string, JS fallback) | 825.55 | 1640.66 | 882.60 | 877.82 |
| docs-98mib | StreamReaderSync (bytes) | 691.88 | 1435.71 | 1735.13 | 1704.87 |
| docs-98mib | Converter (bytes) | 635.84 | 656.44 | 1691.40 | 1657.68 |

### 생성 fixture 전체 경로 (샘플 전 GC, median ms)

| Fixture | 경로 | JS | scalar | SIMD |
|---|---|---|---|---|
| simple-ascii | tokenizer-type-only | 111.41 | 158.89 | 157.53 |
| simple-ascii | stream-sync-type-only | 120.87 | 156.24 | 152.24 |
| simple-ascii | stream-sync-accessors | 180.55 | 1257.57 | 1246.52 |
| simple-ascii | stream-sync-chunked | 182.69 | 1317.83 | 1232.39 |
| simple-ascii | stream-async | 236.90 | 1340.33 | 1356.39 |
| attribute-heavy | tokenizer-type-only | 106.87 | 133.88 | 126.80 |
| attribute-heavy | stream-sync-type-only | 129.67 | 133.22 | 126.45 |
| attribute-heavy | stream-sync-accessors | 206.89 | 1277.62 | 1299.81 |
| attribute-heavy | stream-sync-chunked | 200.32 | 1267.28 | 1256.91 |
| attribute-heavy | stream-async | 209.54 | 1316.44 | 1405.79 |
| attribute-heavy | event-sync-materialized | 208.21 | 1108.03 | 1090.18 |
| namespace-heavy | tokenizer-type-only | 130.05 | 187.80 | 182.47 |
| namespace-heavy | stream-sync-type-only | 148.13 | 184.52 | 176.85 |
| namespace-heavy | stream-sync-accessors | 228.20 | 1100.73 | 1116.22 |
| namespace-heavy | stream-sync-chunked | 227.23 | 1107.13 | 1105.55 |
| namespace-heavy | stream-async | 258.86 | 1160.44 | 1161.04 |
| unicode-heavy | tokenizer-type-only | 73.61 | 90.99 | 101.34 |
| unicode-heavy | stream-sync-type-only | 87.27 | 89.62 | 99.97 |
| unicode-heavy | stream-sync-accessors | 124.67 | 634.51 | 642.12 |
| unicode-heavy | stream-sync-chunked | 125.35 | 653.29 | 641.18 |
| unicode-heavy | stream-async | 146.49 | 669.77 | 691.78 |

### 16 MiB compiled catalog converter (median ms)

| 조건 | JS | scalar | SIMD |
|---|---|---|---|
| 자연 GC | 177.07 | 741.92 | 803.59 |
| 샘플 전 GC | 197.52 | 459.70 | 442.47 |

같은 139,458-record catalog의 기존 문서 converter 평균은 **184.210 ms**다. 현재 샘플 전 GC 평균은 JS **197.068 ms (+6.98%)**, scalar **461.836 ms (+150.71%)**, SIMD **442.833 ms (+140.40%)**다. 이 역사적 비교에도 Node 26/24 차이가 있으므로 SPI 회귀 판정으로 사용하지 않는다.

실행한 baseline/최종 benchmark 명령:

```sh
pnpm --dir packages/benchmark bench:parser:13mb --json --out=/tmp/stax/baseline-parser-13mb.json
pnpm --dir packages/benchmark bench:parser:98mb --json --out=/tmp/stax/baseline-parser-98mb.json
pnpm --dir packages/benchmark bench:converter:compiled-batch --json-out=/tmp/stax/baseline-converter.json
node --expose-gc packages/benchmark/wasm-backend.mjs --size-mib=16 --runs=5 --warmups=2 --fixtures=13,98 --baseline-commit=5990c034a97f6dc6cc651d40b57cfe15d5dd0a2e --out=/tmp/stax/wasm-final.json
pnpm benchmark:wasm --size-mib=16 --runs=5 --warmups=2 --fixtures=13,98 --baseline-commit=5990c034a97f6dc6cc651d40b57cfe15d5dd0a2e --out=/tmp/stax/wasm-final-controlled.json
```

첫 전체 matrix의 최종 serializer에서 문서 전용 mode 선택 오류가 발견되어 수정한 뒤 성공한 실행만 위 evidence로 보존했다. 두 번째 matrix는 GC를 측정 구간 밖에서 실행하며 `options.gcBeforeSample`을 기록한다. 미타타 baseline evidence에서는 거대한 noop calibration 배열과 생성된 debug source만 생략했고 실제 측정 samples/statistics는 보존했다.

## 10. Cold start와 memory

샘플 전 GC 실행에서 관측한 cold 지표(ms):

| Backend | compile | init | instance median | first parse |
|---|---|---|---|---|
| js | — | — | — | 0.6222 |
| scalar | 0.2480 | 0.0327 | 0.0755 | 0.5496 |
| simd | 0.1058 | 0.0038 | 0.3552 | 0.3468 |

compile/init/first parse는 단일 관측이고 variant를 같은 process에서 순서대로 초기화했다. module import·파일 I/O는 제외되며 engine startup/cache 영향을 받는다. 따라서 SIMD cold-start 우위라고 결론내리지 않는다. 자연 GC 실행의 scalar compile은 6.872 ms였으므로 단일 cold 수치를 일반화할 수 없다.

- 64 KiB chunk의 전체 fixture memory probe: scalar/SIMD 모두 최대 input capacity **131,072 bytes**, linear memory **6 pages = 384 KiB**.
- 별도 **134,217,741-byte** 문서를 1 MiB 재사용 chunks로 처리: 최대 input capacity **1 MiB**, linear memory **19 pages = 1.1875 MiB**. 8 MiB 지점부터 끝까지 capacity/pages가 증가하지 않았다.
- dispose 후 facade의 pages/capacity는 0이다. 이것은 보유 참조 해제이며 OS RSS가 즉시 0이 된다는 뜻이 아니다.
- 반복 5회 파싱 후 GC endpoint:

| Backend | JS heap MiB | RSS MiB |
|---|---|---|
| js | 81.44 | 598.34 |
| scalar | 81.39 | 582.72 |
| simd | 81.30 | 483.03 |

위 heap/RSS는 fixtures와 module 등을 포함하는 공유 process 전체 값이며 backend별 격리 peak RSS가 아니다. retention의 before 값은 모두 동일한 post-GC baseline도 아니므로 그 delta로 allocator 우열을 단정하지 않는다. 전체 samples/endpoints 및 반복 Wasm probe는 JSON에 남겼다.

## 11. Wasm artifact 크기와 SIMD 증거

- scalar: **20,990 bytes**; SHA-256 `8b3469872d3a9d15da70f444e221a7a16da9d0bed916a3fcb908373db082c974`.
- SIMD: **21,216 bytes**; SHA-256 `77d54da7b8811571d4e8054408e58cfb89a4fa7814ae62e509d55ad4c0b83c09`.
- SIMD는 scalar 파일 복사가 아니다. `--enable simd`로 별도 컴파일하고 실제 emitted `v128.load`, `v128.store`, `i8x16.bitmask`, `i8x16.eq`, `i8x16.lt_u`를 확인했다. profile용 binary가 배포 binary와 byte-identical한 것도 확인했다.

## 12. Packaging / runtime 제한

Node 24.21.0 ESM tarball consumer와 Chrome 150 HTTP loading을 검증했다. Node 20/22, Bun/Deno, Firefox/Safari 및 bundler matrix 전체를 검증한 것은 아니다. UTF-8 opt-in 사용 전에 `initWasm()`이 필요하며 미초기화 UTF-8은 명시적으로 실패한다. JS 기본 경로, direct strings, non-UTF-8는 별도로 유지된다. stable package에 Wasm asset/dependency를 강제로 넣지 않았다.

## 13. Outcome 판정과 Phase P

**Outcome 3.** 샘플 전 GC 기준 type-only tokenizer에서도 네 대표 fixture 모두 SIMD가 JS보다 느렸다. full-accessor Reader, 실제 byte projection, compiled converter에서도 의미 있는 승리가 없다. 따라서 tokenizer 승리를 string 경계만 잃어버린 Outcome 2로 포장하지 않는다.

SPI는 회귀 gate를 통과했으므로 유지한다. Wasm 구현은 실제 parsing/conformance 및 재현 가능한 성능 기준이라는 유지 가치를 인정하여 opt-in 실험 패키지로 보존한다. 기본 backend로 승격하거나 public API를 성능 수치에 맞춰 왜곡하지 않는다.

계획의 Phase P는 현재 작업 완료 조건이 아니라 향후 기본 승격 조건이다. 각 조건의 현재 판단:

| 향후 조건 | 현재 상태 |
|---|---|
| Full semantic/conformance parity | 공유 계약과 명시한 W3C subset 통과; 전체 규격 증명 아님 |
| Node LTS + 주요 browser matrix | 미충족: Node 24 / Chrome만 검증 |
| 모든 지원 packaging 환경 | 부분 검증: Node ESM tarball / HTTP browser; bundler matrix 미검증 |
| 지속적·실질적인 end-to-end 우위 | 미충족 |
| 허용 가능한 peak RSS/Wasm memory | streaming Wasm retention 통과; 격리 peak RSS gate는 미평가 |
| 작은 문서 cold 비용 또는 합리적 선택 정책 | 단일 cold 관측만 있음; 자동 선택 정책 도입 안 함 |
| direct JS string 경로 | JS 유지 |
| non-UTF-8 | JS/TextDecoder 유지 및 검증 |
| Wasm 없는 runtime fallback | 기본 JS 및 opt-in string fallback 검증; opt-in UTF-8은 명시적 init 요구 |

## 14. 병목과 구체적인 다음 단계

회귀를 그대로 수용하기 전에 중복 validation/copy를 제거하고 plain span을 빌리도록 바꿨으며, profile에서 컸던 generic Array.fill 기반 cache 초기화도 재사용 배열 loop로 바꿨다. 최종 결과는 이 최적화 이후의 수치다.

실제 13 MiB StreamReader projection 12회 CPU profile에서 self sample은 parseStart **11.30%**, nextInternal **8.89%**, decodeSpan **5.25%**, readField **8.72%**, clearCaches **6.49%**였다. decodeUTF8 **8.11%** + Node decode **2.78%**로 약 **10.89%**다. 별도 계수 실행은 442,369회 TextDecoder 호출로 2,691,076 bytes를 변환했다. 이는 sampling attribution이며 allocation 전체의 정밀 비용 분해는 아니다.

**JS Text Encoding Builtins만 기다려도 해결된다는 근거는 없다.** 이미 문자열을 요청하지 않는 tokenizer 비교도 뒤처지며 structural parsing/state와 facade 비용이 남는다. 다음 실험은 backend별 fresh-process 측정으로 JIT/GC 혼합을 분리하고, parseStart/state 처리와 작은 getter의 JS↔Wasm 호출 수를 줄이는 것이 우선이다. 그 후 encoding builtins가 해당 boundary 비용을 얼마나 줄이는지 별도로 측정해야 한다. 이번 결과로 default 전환을 추진하지 않는다.

## Evidence index

- `verification.json`: 테스트·정확한 명령·compiler/version·artifact hash·실행한 smoke source.
- `spi-gate.json`: paired before/after 원본 samples.
- `documented-reference.json`: 기존 문서가 사용하는 환경/평균값 snapshot.
- `baseline-parser-13mb.json`, `baseline-parser-98mb.json`, `baseline-converter.json`: 변경 전 명령의 결과.
- `benchmark-natural-gc.json`, `benchmark-controlled-gc.json`: 두 전체 matrix의 모든 samples, cold, heap/RSS, Wasm probes.
- `retention-128mib.json`, `profile.json`, `browser-smoke-result.json`, `packed-consumer-result.json`: 추가 검증 증거.
