# 구현

**미채택. `EventReaderSync`와 `EventReader`의 기본 연결은 모두 R0로 복원했다.**

- 기준: 실제 `origin/master` = `9a839ffb6824a25c4cc2fa6698e860daea5b5816`.
- 작업: `/tmp/stax-entity-single-eval`, 로컬 branch `experiment/purejs-entity-single-eval`. Baseline: `/tmp/stax-entity-single-eval-r0`.
- Evidence: `/tmp/stax-entity-single-eval-evidence`. `product.patch`는 0 bytes. commit/push/publish/master 병합 없음. 원래 사용자 worktree에는 수정하지 않았다.
- W0/A1/AT1을 정적 build로 구현했다. Event 전용 subclass, private Symbol request envelope, AST generator, attribute/namespace 결과 재사용, AT1 text completion/resume, 첫 entity에서 fragments를 만들고 join하는 normalizer다. 일반 cursor runtime은 visibility/export 제거 후 R0와 동일했다.
- 후보의 변경 파일: `src/core/TokenCursor.ts`, `src/core/index.ts`, `src/core/internal/{MaterializingTokenCursor,entity-normalizer,materialized-reader-options}.ts`, sync/async EventReader·StreamReader, generator, package test hook, vitest config, `test/entity-single-eval*.test.ts` 3개. 전부 `candidates/*.patch`에 보존했다.
- 재현 driver 6개 파일은 실험 worktree의 `packages/benchmark/entity-single-eval.mjs`, `entity-single-eval/{fixtures,consume,analyze,retention}.mjs`, `test/entity-single-eval-contract.test.mjs`에 남겼다. `harness.patch`와 `harness/`에도 보존했다.

모든 후보의 source 식별자는 위 baseline SHA + `builds.json`의 patch SHA-256이다. 후보 commit SHA를 만들지 않았다.

| Build | dist SHA-256 |
|---|---|
| R0 | `8474ddd7ba97c0debfb80b4439d75c6c9db9009c5914281cac40598ea784e0c9` |
| W0 | `5ebb7ce72a9f21825d724819ba832dee1fb178f912d3a90084db78360276410d` |
| A1 | `31ec017538d8a9bd5b263bf38bc1a7ada78effd6974e5d3fd1d881cad6134280` |
| AT1 | `d653a200935e2eaf35e4e351e0d1a8043f6976fa91504277e4bcb51f19443055` |

# 검증

- 최종 R0: build PASS, unit **658 PASS**, W3C **805 PASS / 기존 203 skip / 0 FAIL**, coverage **100%** gate PASS, release surfaces PASS. 명령·출구 코드는 `tests/final-product-checks.json`, 로그는 `logs/final-*.log`.
- A1/AT1: 각각 unit **719 PASS**, W3C 805 PASS/기존 203 skip. Node 24.21.0/Bun 1.3.14에서 각각 **1,487개 trace × 4 builds** 일치. byte split, 오류 prefix/종류/메시지, pending close, cleanup, retained event/Map, ReadableStream 취소를 포함한다. `tests/trace-differential.json`, `tests/*-trace.json`.
- 추가 실제 엔진: Firefox **151.0.1**에서 **598개 trace × 4 builds**, 시스템 JSC에서 **16개 direct-string case × 4 builds** 일치. 모두 actual ordinary/retention smoke도 실행했다. `firefox-smoke.json`, `firefox-smoke-replay.json`, `jsc-smoke.json`, `runtimes.json`.
- JSC shell에는 TextDecoder가 없어 standalone byte/async는 **NOT RUN**. Bun/JSC와 Firefox의 native TextDecoder로 byte/async를 검증했으며 polyfill은 넣지 않았다. 처음 PATH 조회에서 놓친 Firefox.app·시스템 JSC는 실제 경로를 찾아 실행했다.
- Node/Bun의 같은 process에서 Event/Stream sync/async와 큰/작은 문서를 교대하고 이전 event를 보관한 smoke도 PASS: `tests/mixed-runtime-parity.json`. 이것은 막힌 G6 throughput의 대체 결과가 아니다.
- 추가 Function/eval 없이 CSP public import/parse PASS; root/converter declaration byte parity PASS; event own key 순서 13개 유지. `tests/declaration-parity.json`, `logs/AT1-CSP.log`, `logs/regular-cursor-runtime.log`.
- 별도 계측 build의 완전한 예제(entity 6개): **R0 13회 → A1 7회 → AT1 6회** resolver 호출. AT1 후속 namespace/materializer 재해석 0회. Raw 및 일반 Stream type-only는 기존 7회 유지. `occurrences.json`, `logs/*-occurrence.log`. 계측 build는 timing에서 사용하지 않았다.

**남은 실패를 통과로 바꾸지 않았다.**

1. 필수 `id + 16개 일반 attribute` 행이 반복되면 **R0부터 `Duplicate attribute: a15`**로 실패한다. Namespace case는 a12. `tests/wide-baseline.xml`은 xmllint 검증을 통과한다. 기존 중복검사 table 재사용 문제이며 일반 parser 수정을 이번 가설에 섞지 않았다. Benchmark contract는 6 PASS / 1 FAIL; `logs/fixture-contract.log`, `wide-baseline-repro.mjs`.
2. 후보 coverage는 FAIL. A1 lines/statements/branches = **98.88/98.67/97.66%**, AT1 = **97.62/97.45/95.30%**; functions는 둘 다 100%. Threshold/exclusion/skip을 완화하지 않았다. 최종 제품은 원래 100%로 복원됐다.
3. `inputs/stax-purejs-new-frontier-research.zip` 및 접근 가능한 동일 첨부가 없어 ZIP의 kernels/check/retention 재실행은 **NOT RUN**. 이전 dossier/rejection 문서는 git history에서 읽어 `dossier.txt`, `retention-history.txt`로 보존했다.
4. 첫 추가 Firefox smoke의 자체 iterator-loop 오류로 OOM이 났다. IteratorResult를 event로 취급한 **smoke driver 오류**였으며 for-of/for-await-of로 수정하고 isolated Firefox를 재시작했다. 정상 driver 재실행 PASS. `logs/firefox-initial-driver-error.json`, `logs/firefox-replay.log`. Primary timing 이후의 별도 작업이다.

# 성능

Node 24.21.0 / Apple M4 / Darwin 25.5.0, natural GC. 준비된 bytes/string 입력이므로 파일 I/O 제외. 실제 공개 Event API의 모든 문자열 code unit을 소비하고 256-event ring을 보관했다.

- Pilot: 4 MiB, 3 blocks / warmup 3 / samples 5, R0/W0/A1. 당시 manifest는 `pilot-builds.json`에 고정했다.
- Primary/guard: 합성 16 MiB 및 실제 13,584,398 / 101,882,907-byte XML, 7 blocks / warmup 6 / samples 5. 경계가 겹친 7개 runnable case만 block 7–13을 추가했다. 블록별 새 process, seeded variant order, paired bootstrap **10,000**. Cold는 예열 없이 새 process에서 constructor→first next→close 및 첫 full iteration을 별도로 기록했다.
- 아래 ms는 block median의 기하평균, ratio는 candidate/R0. N=`namespaceAware`, D=`autoDecodeEntities`. 보통 case의 CI 상한 한계 1.02, cold 1.10. 반올림 전 값으로 판정했다.

| API / 입력 | fixture / 측정 | 옵션 | 후보 | R0 ms | 후보 ms | 시간비 | 95% CI | 판정 |
|---|---|---|---|---:|---:|---:|---|---|
| event-sync / bytes | midsize.xml | N=1,D=1 | W0 | 358.881 | 353.975 | 0.986328 | [0.973012, 0.998740] | PASS |
| event-sync / bytes | midsize.xml | N=1,D=1 | A1 | 358.881 | 386.537 | 1.077060 | [1.060393, 1.092452] | FAIL |
| event-sync / bytes | midsize.xml | N=1,D=1 | AT1 | 358.881 | 383.313 | 1.068077 | [1.055953, 1.079727] | FAIL |
| event-sync / bytes | large.xml | N=1,D=1 | W0 | 2705.098 | 2741.992 | 1.013639 | [0.996854, 1.034628] | INCONCLUSIVE |
| event-sync / bytes | large.xml | N=1,D=1 | A1 | 2705.098 | 2937.136 | 1.085778 | [1.078889, 1.092245] | FAIL |
| event-sync / bytes | large.xml | N=1,D=1 | AT1 | 2705.098 | 2945.517 | 1.088876 | [1.080577, 1.095730] | FAIL |
| converter / string | converter-catalog | N=1,D=1,fragment | W0 | 185.274 | 184.170 | 0.994042 | [0.958326, 1.020708] | INCONCLUSIVE |
| converter / string | converter-catalog | N=1,D=1,fragment | A1 | 185.274 | 183.183 | 0.988716 | [0.948185, 1.020014] | INCONCLUSIVE |
| converter / string | converter-catalog | N=1,D=1,fragment | AT1 | 185.274 | 186.900 | 1.008773 | [0.961135, 1.051915] | INCONCLUSIVE |
| event-sync / bytes | complex.xml / constructor | N=1,D=1 | W0 | 0.095 | 0.115 | 1.211201 | [1.180424, 1.248535] | FAIL |
| event-sync / bytes | complex.xml / constructor | N=1,D=1 | A1 | 0.095 | 0.113 | 1.196846 | [1.148547, 1.240717] | FAIL |
| event-sync / bytes | complex.xml / constructor | N=1,D=1 | AT1 | 0.095 | 0.115 | 1.217094 | [1.164742, 1.275376] | FAIL |

- **Ordinary non-regression FAIL, cold FAIL.** Wiring-only W0도 small Event constructor에서 FAIL이다. 이를 무료 연결 비용으로 간주하지 않았다.
- 전체 **58 cases 중 합성 입력에 의존하는 47 cases는 NOT RUN**. 첫 실패와 이후 blocked block을 모두 남겼으며 entity-rich만 골라 수치를 만들지 않았다. Entity gain/Text extension은 NOT RUN; 10% E2E 이득을 입증하지 못했다.
- Converter는 14 blocks 후 INCONCLUSIVE. A1 CI 상한은 **1.020014**로 1.02를 넘는다. 반올림해 PASS로 만들지 않았다.
- Node/Bun retention은 16문서 × 256 KiB, 1회, 7 scenarios × 4 modes × 4 builds의 **smoke만** 수행했다. 각 child는 GC 25회/5 turns, 결과는 GC 후 `.length`만 관찰했고 길이 parity는 PASS. JSC/Firefox는 first/none과 normalized/positive의 추가 native-GC smoke다. **Full retention/slope gate, 128 MiB, 1 GiB는 NOT RUN**: primary 통과 후보가 없다. Smoke를 memory 승인으로 쓰지 않았다.
- Node retention 원본의 `options.exposeGc=false`는 당시 parent 표기 오류다. 112개 child의 `gcCycles=25`는 모두 확인했다. 최종 harness는 child 결과로 표기하도록 수정했다; 원본을 덮어쓰지 않았다.
- Bundle `index.js`: R0 54,288 B / W0 54,549 B / A1 62,332 B / AT1 66,938 B. Converter: R0 96,927 B, 후보 96,950 B. `build-sizes.json`, cold raw `importMs` 참고.
- 성능 revision은 0회. 실제 XML/cold의 반복 회귀와 baseline fixture blocker를 두고 다른 cache/scanner 가설을 추가하지 않았다.

전체 API·입력·옵션·ms·CI·상태 **246 metric rows**: `performance-table.csv`/`.json`. 7-block 원본은 `primary.json`, `guards.json`; 추가 7개 block은 `*-extension.json`; 최종 통계 입력은 `primary-final.json`, `guards-final.json`. `sample-trends.json`, `failures.json`, `gates.json`도 보존했다. `gates-measured.json`은 analyzer 원출력이며 `gates.json`은 baseline blocker의 missing-data 상태를 NOT RUN으로 명시한 최종 판정이다.

# 반영 범위

- **제품 변경 없음.** EventReaderSync/EventReader/일반 StreamReader/Converter/Writer 모두 baseline 연결이다. 최종 dist SHA-256은 R0와 byte-identical: `8474ddd7ba97c0debfb80b4439d75c6c9db9009c5914281cac40598ea784e0c9`. `tests/final-dist-fingerprint.json`.
- 후보 구현·61개 추가 테스트는 `candidates/{W0,A1,AT1}.patch`, `builds/*/src`, `tests/candidate-regressions/`에 있다. 실패 연결·generator hook·새 runtime state를 기본 제품에 남기지 않았다.
- 읽는 순서: **HANDOFF → gates.json → performance-table.csv → failures.json → raw reports/trace → candidate patches**. Raw evidence는 저장소 밖에만 있으며 commit하지 않았다.

재현 명령(현재 머신의 절대경로; 원래 실행 argv는 `logs/*-command.json`):

```sh
cd /tmp/stax-entity-single-eval
E=/tmp/stax-entity-single-eval-evidence
pnpm --filter=stax-xml build
pnpm --filter=stax-xml test
pnpm --filter=stax-xml test:w3c
pnpm --filter=stax-xml coverage
pnpm verify:release-surfaces
node packages/benchmark/entity-single-eval.mjs parity --manifest "$E/builds.json" --suite all --out "$E/tests/parity-replay.json"
node packages/benchmark/entity-single-eval.mjs diagnose --manifest "$E/instrumented-builds.json" --out "$E/occurrences-replay.json"
node packages/benchmark/entity-single-eval.mjs bench --manifest "$E/pilot-builds.json" --suite pilot --blocks 3 --warmups 3 --runs 5 --out "$E/pilot-replay.json"
node packages/benchmark/entity-single-eval.mjs bench --manifest "$E/builds.json" --suite primary --blocks 7 --warmups 6 --runs 5 --out "$E/primary-replay.json"
node packages/benchmark/entity-single-eval.mjs bench --manifest "$E/builds.json" --suite guards --blocks 7 --warmups 6 --runs 5 --out "$E/guards-replay.json"
node packages/benchmark/entity-single-eval/analyze.mjs analyze --input "$E/primary-final.json" --guards "$E/guards-final.json" --manifest "$E/builds.json" --out "$E/gates-recomputed.json"
node packages/benchmark/entity-single-eval.mjs retention --manifest "$E/builds.json" --counts 16 --repeats 1 --out "$E/retention-smoke-replay.json"
node "$E/wide-baseline-repro.mjs" "$E/builds/R0/dist/index.js"
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc "$E/jsc-AT1.mjs"
```

Firefox 재현: `node "$E/browser-server.mjs"`와 `/Applications/Firefox.app/Contents/MacOS/firefox --headless --no-remote --profile "$E/firefox-profile" --marionette --remote-allow-system-access`를 별도 process로 시작한 뒤 `python3 "$E/firefox-smoke.py"`. localhost 28478/28479와 전용 profile만 사용한다. 이번 실행의 두 process는 종료했다. 일반 제품/source 재현은 새 baseline worktree에서 `git apply "$E/candidates/AT1.patch"` 후 기존 build/test 명령을 사용한다.
