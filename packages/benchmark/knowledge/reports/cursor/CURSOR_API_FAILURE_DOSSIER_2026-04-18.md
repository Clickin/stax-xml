# Cursor API Failure Dossier

## 목적

이 문서는 다른 LLM, 특히 Gemini Web이 `stax-xml`의 cursor 기반 접근이 왜 **마지막 릴리즈(`v0.5.2`)의 parser API보다 느린 결과**를 내는지 빠르게 이해하고, 이미 실패한 방향을 반복하지 않도록 돕기 위한 근거 문서다.

이 문서는 mainline에 남겨도 되는 요약/근거 문서다. 실제 published regression runner와 재현 가능한 benchmark harness는 `feat/cursor-optimizations` 브랜치에 남기고, mainline에서는 문서와 대표 snapshot만 유지한다.

핵심 질문은 하나다.

> 왜 "cursor = allocation 절감 = 더 빠름"이라는 가설이 이 저장소에서는 최종적으로 성립하지 않았는가?

---

## TL;DR

1. **문제의 중심은 wrapper allocation이 아니었다.**
   현재 브랜치의 flame profile은 병목이 `parseStartTag`와 `parseAttributesFast` 같은 **parser hot path**에 있음을 보여준다. cursor live view 재사용은 보조 개선일 뿐이었다.

2. **cursor laziness가 parser eagerness를 제거하지 못했다.**
   cursor 쪽에서 `AttrStore`, `CursorAttrStore`, live view를 늦게 만들거나 재사용해도, parser/core가 여전히 속성/namespace/text를 상당 부분 준비하거나 다시 materialize하면 총비용은 크게 줄지 않는다.

3. **일부 실험은 branch 내부 비교에서는 의미가 있었지만, 목표 comparator가 달랐다.**
   현재 branch 안에서는 cursor가 current parser보다 나은 slice가 있었다. 하지만 사용자가 체감하는 비교 대상은 **마지막 릴리즈 parser API (`v0.5.2`)** 이고, 그 기준에서는 특히 `attribute-heavy`와 async/streaming 쪽이 크게 졌다.

4. **Buffer/Uint8 cursor surface는 string parser보다 본질적으로 더 비싼 일을 한다.**
   `v0.5.2`의 sync parser는 string 기반 `slice` 중심인데, 현재 buffer cursor path는 byte span을 JS string으로 decode해야 하고, 여기에 attribute object / map / snapshot 비용이 추가된다.

5. **V8 관점에서도 “짧게 살다 죽는 모노모픽 plain object”는 생각보다 싸다.**
   반대로 stateful live view, lazy caches, `Map`, attribute promotion, repeated `slice`/decode는 parser 이벤트 plain object보다 자동으로 유리하지 않다.

결론:

> 이 저장소에서 cursor 기반 접근은 “맞는 방향의 일부”였지만, 실제 병목보다 바깥쪽 레이어를 먼저 최적화했고, exported surface에서는 byte decode + attribute materialization + snapshot 비용까지 얹으면서 release parser 기준 목표를 달성하지 못했다.

---

## 비교 범위

### 기준 1. 마지막 릴리즈

- Git tag: `v0.5.2`
- npm alias evidence: `packages/benchmark/results/published-matrix/npm-0.5.2/package`
- published regression runner 고정값:
  - `DEFAULT_PUBLISHED_ALIAS = "stax-xml-published"`
  - `DEFAULT_PUBLISHED_VERSION = "0.5.2"`
  - 파일: `packages/benchmark/published-cursor-vs-parser-regression.mjs`
- mainline retained snapshot:
  - `packages/benchmark/results/published-regression/published-cursor-vs-parser-regression-1776489558318.md`

### 기준 2. “feat/cursor-api”에 해당하는 역사적 계보

이 repo snapshot에는 **`feat/cursor-api`라는 이름의 브랜치가 남아 있지 않다**. 대신 가장 가까운 실제 계보를 다음으로 재구성했다.

- branch: `cursor-stream-reader-sync`
- 대표 커밋:
  - `ae08bb4` `feat(stax-xml): add sync cursor reader skeleton`
  - `21a858e` `feat(stax-xml): implement sync cursor reader tokenizer`
  - `57ca16f` `feat(stax-xml): add lazy attribute + namespace cursor access`
  - `b7100d6` `perf(stax-xml): make cursor attribute parsing lazy`
  - `1544c15` `perf(stax-xml): optimize StaxXmlStreamReaderSync with tokenId-based cache invalidation`

즉, 이 문서에서 “cursor-api 단계”는 위 계보를 가리킨다.

### 기준 3. `feat/cursor-optimizations`

- 현재 HEAD branch: `feat/cursor-optimizations`
- remote base: `origin/feat/cursor-optimizations`
- 주요 구조:
  - `SyncParserCore`
  - `CursorLiveView`
  - `cursor-frame.ts`
  - `CursorAttrStore`
  - buffer/browser/async cursor surfaces

### 기준 4. 현재 workspace

`feat/cursor-optimizations` 위에 다음이 추가되어 있다.

- published regression runner / tests / 결과물
- buffer/async path에서 `startElement` frame, `attributeMap`, `parserSnapshot`을 미리 붙여 fallback materialization을 줄이려는 시도
- 관련 diff 핵심 파일:
  - `packages/stax-xml/src/BufferSyncParserCore.ts`
  - `packages/stax-xml/src/BufferCursorLiveView.ts`
  - `packages/stax-xml/src/AsyncParserCore.ts`
  - `packages/stax-xml/src/EventCursorLiveView.ts`
  - `packages/stax-xml/src/buffer-cursor-frame.ts`
  - `packages/benchmark/published-cursor-vs-parser-regression.mjs`

---

## 시도 연표

## 1. 초기 cursor API 단계: `cursor-stream-reader-sync`

초기 구현은 `StaxXmlStreamReaderSync` 하나에 많은 상태를 넣는 방식이었다.

관찰 포인트:

- giant stateful class
- `tokenId` 기반 cache invalidation
- name/localName/prefix/uri/text cache 다수 보유
- attribute scan range를 따로 저장
- namespace declaration을 stack에서 지연 스캔
- `getAttributeValueByName`는 선형 검색
- 내부적으로는 “진짜 parser core”보다 “cursor-aware tokenizer + cache manager”에 가까웠음

대표 근거:

- `cursor-stream-reader-sync:packages/stax-xml/src/StaxXmlStreamReaderSync.ts`
- 커밋 로그 `v0.5.2..cursor-stream-reader-sync`

이 단계의 핵심 가설:

> 이벤트 object를 매번 만들지 말고, reader가 현재 토큰을 가리키는 stateful API를 제공하면 더 빠를 수 있다.

문제:

- parser와 cursor가 분리되지 않아 hot path와 access path가 얽힘
- lazy attribute/namespace access가 결국 access 시점의 스캔/`slice`/decode 비용을 숨겼을 뿐 제거하지 못함
- token cache invalidation은 allocation을 줄여도 전체 time-to-next-token을 근본적으로 바꾸지 못함

## 2. 중기 cursor optimization 단계: `feat/cursor-optimizations`

이 브랜치에서 architecture가 크게 바뀌었다.

주요 흐름:

- `100f47e` sync cursor reader API 도입
- `aa79a0a` Phase F: direct cursor live view, per-read wrapper allocation 제거
- `6750b32` sync attribute parsing 정리
- `24f65c0` `SyncParserCore` 분리
- `3398d0b` `AsyncParserCore` 분리
- `f7b63c5` cursor hot path 분리 및 profiling 준비
- `e620be7` buffer/cursor surfaces를 first-class export로 승격
- `2e6d185` browser cursor surface 완성
- `cda6724` parser hot path recovery + JS-only benchmark baseline

의미:

- 초기 giant reader 방식에서
- `parser core -> mutable frame -> live view / snapshot`
  방향으로 진화했다.

이건 아키텍처적으로는 진전이 맞다. 하지만 성능 목표는 별개였다.

## 3. benchmark-driven cycle 단계

`packages/benchmark/CURSOR_OPTIMIZATION_REPORT.md` 기준으로 세 번의 대표 cycle이 있었다.

### Cycle 1

가설:

> `StaxXmlCursorReaderSync`의 adapter overhead를 줄이고 single mutable live view를 재사용하면 `cursor-consume`가 좋아질 것이다.

결과:

- Verdict: `REJECTED`
- consume 개선이 유의미하지 않았고
- `cursor-attr-read`는 일부 중요 workload에서 악화

### Cycle 2

가설:

> parser가 이미 만든 attribute 정보를 cursor 쪽이 다시 만들지 않게 하면 좋아질 것이다.

결과:

- Verdict: `PARTIALLY_CONFIRMED`
- namespace-heavy에서는 의미 있는 개선 신호
- 하지만 broad win이 아니었고
- `attribute-heavy-generated`는 회귀
- 최종적으로 revert

### Cycle 3

가설:

> namespace frame clone 비용이 핵심이므로 parent-linked namespace frame으로 바꾸면 좋아질 것이다.

결과:

- Verdict: `REJECTED`
- 목표였던 `namespace-heavy/cursor-consume >= 8%`에 한참 못 미침
- 실제 관측은 약 `1.55%`

---

## 무엇이 실제로 빨랐고, 무엇이 실패했는가

## 1. 성공한 쪽: parser 자체의 구조 개선

`packages/benchmark/PARSER_OPTIMIZATION_FINAL_REPORT.md`의 결론:

- 성공:
  - sync parser state machine화: `+20.67%`
  - async parser circular queue: `~15%`
- 실패:
  - lazy attribute parsing: `-47.59%`
  - fast path simple tags: `-4.53%`
  - string interning: `-8~-10%`
  - function inlining: `-6.15%`
  - object pooling: `0%`

즉, 실제로 먹힌 건:

- generator 제거
- queue algorithm 변경
- core parser flow 정리

반대로 안 먹힌 건:

- “allocation을 줄일 것 같은” micro-optimization
- getter/proxy/pooling 계열

이 패턴은 cursor 실험 실패와 매우 일관적이다.

## 2. branch 내부 비교에서는 cursor가 일부 이겼다

`packages/benchmark/results/published-matrix/published-matrix-1776429873846.md`

`attribute-probe` workload:

- current `main-sync-parser-string`: `21.09ms`
- current `main-sync-cursor-string`: `18.49ms`
- published `v0.5.2` parser string: `18.60ms`

해석:

- current branch 내부에서는 sync cursor string path가 current parser string보다 낫다.
- 하지만 이것은 “cursor approach가 overall 승리했다”는 뜻이 아니다.
- 왜냐하면 최종 comparator는 **current parser가 아니라 published parser (`v0.5.2`)** 이기 때문이다.

## 3. 사용자가 체감하는 비교에서는 크게 졌다

`packages/benchmark/results/published-regression/published-cursor-vs-parser-regression-1776477257207.md`

### buffered-small

- `complex.xml`: `0.59ms vs 0.64ms` (`-7.6%`)
- `namespace-heavy.xml`: `0.59ms vs 0.68ms` (`-12.2%`)
- `attribute-heavy.xml`: `648.44ms vs 18.78ms` (`+3353.7%`) `REGRESSION`

### streaming-large

- `midsize.xml`: `661.55ms vs 437.89ms` (`+51.1%`) `REGRESSION`

이 결과가 가장 중요하다.

> 좁은 small/simple case 일부는 괜찮아도, 실제 blocking regression은 `attribute-heavy`와 streaming large에서 발생한다.

## 4. 오늘 workspace에서도 같은 문제가 확인된다

최신 재현 결과물:

- `packages/benchmark/results/published-regression/published-cursor-vs-parser-regression-1776489558318.md`

이 문서를 작성하는 동안 `attribute-heavy.xml` 한 건을 다시 quick-run 했고, 여전히:

- current: `675.37ms`
- published: `19.64ms`
- delta: `+3339.0%`

즉, current workspace의 최신 시도도 이 핵심 회귀를 아직 해결하지 못했다.

---

## 왜 실패했는가: root cause

## 1. 잘못된 1순위 병목을 최적화했다

`packages/benchmark/CPU_HOTSPOT_REPORT.md`

compiled profile 요약:

### namespace-heavy / cursor-consume

top self time:

- `parseStartTag`: `27.84%`
- `parseAttributesFast`: `12.77%`
- `parseEndTag`: `11.18%`
- `findChar`: `10.85%`
- `fromEvent`: `9.22%`

### attribute-heavy / cursor-attr-read

top self time:

- `parseAttributesFast`: `44.79%`
- `parseStartTag`: `21.29%`
- `fromEvent`: `18.78%`

정리:

- cursor wrapper/materialization 비용은 존재한다.
- 하지만 namespace-heavy에서는 parser path가 더 지배적이다.
- attribute-heavy에서는 `fromEvent`도 크지만 **1등은 여전히 `parseAttributesFast`** 다.

즉:

> wrapper allocation 제거는 병목 제거가 아니라 병목 주변 다이어트에 가까웠다.

## 2. “half-lazy design” 함정에 빠졌다

`docs/superpowers/plans/2026-04-16-cursor-core-enhancement-plan.md`는 이미 정확히 이 위험을 적어두고 있다.

핵심 문장:

- “Lazy materialization must remove cost, not move it.”
- “If parser still eagerly builds the same objects, cursor-side laziness alone is not enough.”
- “The parser is allowed to stop at event recognized and frame populated rather than event fully realized as public data.”

실제 코드 기준으로 보면:

- 초기 branch에서는 `StaxXmlStreamReaderSync`가 직접 cache/lazy scan을 관리했다.
- 중기 branch에서는 `SyncParserCore`가 `MutableCursorFrame`을 만들지만
- parser snapshot, `AttrStore`, `CursorAttrStore`, `snapshotFrame`, `toEvent()` 등 여러 경로에서 다시 materialization이 일어났다.

대표 코드:

- `packages/stax-xml/src/SyncParserCore.ts`
- `packages/stax-xml/src/cursor-frame.ts`
- `packages/stax-xml/src/CursorLiveView.ts`
- `packages/stax-xml/src/AttrStore.ts`
- `packages/stax-xml/src/EventCursorLiveView.ts`

요약하면:

> cursor laziness는 있었지만, parser eager work를 충분히 제거하지 못해서 “이중 비용”이 남았다.

## 3. namespace clone은 직관보다 덜 중요했다

Cycle 3가 이를 보여준다.

- parent-linked namespace frame
- no-new-frame reuse
- end-element URI frame reference 사용

이런 구조 변경에도 `namespace-heavy/cursor-consume` 개선은 `1.55%`뿐이었다.

즉:

> 눈에 띄는 object churn이 있다고 해서 그게 전체 wall-clock 병목이라는 뜻은 아니었다.

## 4. exported buffer/async cursor surface는 string parser보다 더 무거운 일을 한다

current workspace diff를 보면 buffer/async path는 다음을 한다.

- byte span에서 string decode
- `CursorAttribute[]` 생성
- `attributeMap: Map<string, CursorAttribute>` 구축
- parser-compatible snapshot 구축
- live view와 parser event 양쪽을 만족시키는 데이터 구조 유지

관련 파일:

- `packages/stax-xml/src/BufferSyncParserCore.ts`
- `packages/stax-xml/src/buffer-cursor-frame.ts`
- `packages/stax-xml/src/AsyncParserCore.ts`
- `packages/stax-xml/src/BufferCursorLiveView.ts`

반면 `v0.5.2` sync parser는 string 기반이다.

- `xml.slice(start, end)` 중심
- plain object event 생성
- plain object attribute map 생성

즉 published regression은 완전한 apples-to-apples가 아니라,

- **release parser**: string parser
- **current cursor**: buffer/async-first cursor surface

비교다.

하지만 사용자 문제는 바로 이 exported surface 비교이므로, 제품 관점에서는 충분히 유효한 failure다.

## 5. 최신 workspace 시도도 “주요 병목 이전” 단계에 머무를 위험이 있다

current workspace diff의 핵심은:

- `startElement`를 frame에 붙이고
- `attributeMap`과 `parserSnapshot`을 재사용해
- `AttrStore.fromEvent` fallback을 줄이려는 것

이건 합리적인 방향이다. 하지만 여전히 다음 한계가 남는다.

1. `parseAttributesFast` 자체를 압도적으로 줄이지 못한다.
2. buffer/async decode tax를 제거하지 못한다.
3. parser API와 cursor API를 동시에 만족시키기 위한 snapshot 비용이 남는다.

따라서 이것만으로는 `+3300%` 급 attribute-heavy regression을 뒤집기 어렵다.

---

## V8 내부 관점 설명

이 섹션은 repo 증거와 V8 공식 문서를 연결한 해석이다.

### 1. stable plain object는 생각보다 강하다

현재/과거 parser 이벤트는 `UnifiedXmlEvent` 계열의 **안정된 shape**를 유지하려고 설계되어 있다.

근거:

- `packages/stax-xml/src/types.ts`
- `packages/stax-xml/src/StaxXmlParserSync.ts`

V8 공식 참고:

- Fast properties in V8: <https://v8.dev/blog/fast-properties>
- Maps (Hidden Classes) in V8: <https://v8.dev/docs/hidden-classes>

의미:

- 같은 field 순서, 같은 hidden class, 같은 access pattern을 유지하는 plain object는 V8의 hidden class / inline cache 최적화와 잘 맞는다.
- parser 이벤트가 매번 새로 만들어져도 shape가 안정적이면 property access는 매우 싸게 유지될 수 있다.

실제로 parser 최적화 실패 보고서도 같은 결론을 보여준다.

- object pooling: `0%`
- lazy attribute parsing: 오히려 악화

즉:

> “object를 새로 만드는 것” 자체가 항상 악이 아니다.  
> V8는 모노모픽 short-lived object에 꽤 강하다.

### 2. young-generation GC는 short-lived allocation에 유리하다

V8 공식 참고:

- Orinoco young generation GC: <https://v8.dev/blog/orinoco-parallel-scavenger>
- Trash talk / generational GC: <https://v8.dev/blog/trash-talk>

핵심:

- 대부분의 객체는 young generation에 할당된다.
- 빨리 죽는 객체는 scavenger가 상대적으로 싸게 처리한다.

이 repo의 parser 최적화 실패 사례도 같은 교훈을 남겼다.

- “Young gen 객체는 거의 비용 없음”
- “Pool 관리 비용 > GC 비용”

따라서:

> parser가 stable plain event object를 빠르게 만들고 곧바로 소비하는 모델은, 직관보다 덜 불리하다.

### 3. cursor는 allocation을 줄이는 대신 access complexity를 올렸다

cursor 쪽에서 추가된 것들:

- live view invalidation
- lazy attr store
- name lookup promotion
- `Map` 기반 namespace/attribute lookup
- parser snapshot과 cursor view의 이중 계약

이것들은 “allocation 감소”라는 장점이 있지만, 동시에:

- 더 많은 분기
- 더 많은 accessor call
- 더 많은 `slice`/decode 시점 결정
- 더 복잡한 aliasing / lifetime 규칙

을 도입한다.

V8 hidden class / IC 관점에서 중요한 것은 “객체 재사용” 자체가 아니라 “예측 가능한 shape와 access path”다.

여기서는 live view 자체보다도, 그 주변의 lazy promotion과 fallback 경로가 총비용을 키웠다.

### 4. string representation 관점에서도 cursor가 자동 우위가 아니다

V8 공식 참고:

- `JSON.stringify` fast path note on simple/sequential strings and `ConsString`: <https://v8.dev/blog/json-stringify>

이 글은 `ConsString` 같은 내부 문자열 표현이 flatten/allocation을 유발할 수 있고, simple sequential string이 더 빠른 경향이 있음을 설명한다.

이 repo에 대한 해석:

- string parser (`v0.5.2`)는 이미 JS string 위에서 움직인다.
- buffer cursor path는 byte span에서 JS string으로 decode해야 한다.
- repeated `slice`, decode, parser snapshot 구성은 결국 “간단한 sequential string 하나”보다 더 비싼 경로가 되기 쉽다.

중요:

- 이 부분은 repo 코드 + V8 docs를 연결한 **추론**이다.
- 하지만 `attribute-heavy`에서 buffer cursor가 release parser 대비 `+3300%`까지 튀는 현상과 잘 맞는다.

### 5. 최종 V8 해석 한 줄 요약

> 이 코드베이스에서는 “short-lived monomorphic parser object + cheap young-gen GC” 조합이 생각보다 강했고,  
> cursor 방식은 그 장점을 뒤집을 만큼 parser hot path를 줄이지 못한 채 accessor/lazy/decode/snapshot 복잡도만 늘린 경우가 많았다.

---

## 현재 workspace가 추가로 시도하는 방향

working tree diff를 보면 최신 시도는 다음을 노린다.

1. `startElement`를 frame에 직접 저장
2. `attributeMap`을 직접 들고 있게 함
3. parser snapshot을 재생성하지 않고 재사용
4. `EventCursorLiveView` / `BufferCursorLiveView`가 fallback `AttrStore.fromEvent` 없이 바로 `startElement`를 이용

좋은 점:

- `fromEvent` secondary hotspot을 줄일 수 있다.
- buffer/async cursor path의 duplicated materialization을 덜 수 있다.

나쁜 점:

- parser primary hotspot (`parseAttributesFast`)을 직접 해결하지 않는다.
- eager `CursorAttribute[]` / `Map` / snapshot 구축이 더 빨라졌다는 증거는 아직 없다.
- 최신 published regression은 여전히 `attribute-heavy`에서 catastrophic regression을 보인다.

따라서 이 시도는:

> “잘못된 방향”은 아니지만, 지금까지의 근거로는 **근본 해결책**이라기보다 **secondary hotspot reduction**에 가깝다.

---

## Gemini가 다음으로 풀어야 할 질문

아래 질문들은 “이미 실패한 try를 반복하지 않기 위한” 탐색 가이드다.

1. **release parser와 truly comparable한 surface를 먼저 정하라.**
   - string vs string
   - async stream vs async stream
   - buffer cursor vs string parser 같은 cross-surface 비교는 제품 관점에서는 중요하지만, 원인 분석에는 혼선을 만든다.

2. **parser hot path를 먼저 깎아라.**
   - `parseAttributesFast`
   - `parseStartTag`
   - buffer/async 쪽이면 decode boundary

3. **cursor는 core product가 아니라 projection일 수 있는가?**
   - 더 빠른 parser core 하나를 만들고
   - cursor는 그 위의 ephemeral projection으로 최소 비용 제공
   - parser는 durable snapshot으로 제공

4. **buffer/Uint8 path를 string parser와 경쟁시키려면 decode strategy를 바꿔야 하는가?**
   - eager per-attr decode를 피할 수 있는가?
   - tag 전체 decode + regex 대신 byte-level lexical state machine이 필요한가?

5. **attribute-heavy 전용 데이터 표현이 필요한가?**
   - 현재 report는 `parallel-slot` representation을 generic replacement로 정당화하지 못했다.
   - 그러나 attribute-heavy blocking regression은 여전히 존재한다.
   - “일반 default”가 아니라 “attribute-dense only specialized path”가 필요한지 검토할 가치가 있다.

6. **snapshot boundary를 더 뒤로 미룰 수 있는가?**
   - parser API 안전성은 유지해야 한다.
   - 하지만 지금은 cursor와 parser 둘 다 만족시키려다 start-element data를 여러 형태로 쥐는 경우가 많다.

7. **async path는 regex/decode 중심에서 byte-state-machine으로 가야 하는가?**
   - `packages/benchmark/knowledge/reports/parser/STAX_STYLE_PARSER_COMPARISON_FEAT_CURSOR_OPTIMIZATIONS.md`도 async path를 약점으로 지목한다.

---

## 추천 대안 가설

Gemini가 탐색할 가치가 높은 가설만 남기면 아래와 같다.

### A. “cursor 최적화”가 아니라 “parser-core 최적화 + cursor projection 최소화”

핵심:

- release parser가 이미 잘하는 부분은 인정
- current branch의 `SyncParserCore` / `AsyncParserCore` baseline은 유지
- parser core hot path를 먼저 v0.5.2 수준 이상으로 회복
- cursor는 그 위에서 최소 projection만 수행

### B. buffer cursor를 1급 성능 surface로 삼으려면 decode cost를 구조적으로 바꿔야 함

핵심:

- `Buffer.toString('utf8', start, end)` 남발을 줄여야 함
- attribute-heavy에서 per-attribute decode/object creation 폭발을 막아야 함

### C. release parser 수준을 유지하는 string cursor surface를 먼저 완성하고, buffer/async는 별도 계약으로 분리

핵심:

- current matrix에서 `main-sync-cursor-string`은 promising하다.
- exported buffer cursor가 제품 회귀를 만드는 것이라면, public recommendation을 surface별로 분리하는 것도 하나의 제품 전략이다.

---

## 근거 파일 목록

### 브랜치 / 히스토리

- `git log --reverse --oneline v0.5.2..cursor-stream-reader-sync -- packages/stax-xml/src packages/benchmark`
- `git log --reverse --oneline v0.5.2..feat/cursor-optimizations -- packages/stax-xml/src packages/benchmark`
- `git diff --stat v0.5.2..feat/cursor-optimizations -- packages/stax-xml/src packages/benchmark`
- `git diff --stat HEAD -- packages/stax-xml/src packages/benchmark`

### 핵심 보고서

- `packages/benchmark/CURSOR_OPTIMIZATION_REPORT.md`
- `packages/benchmark/CPU_HOTSPOT_REPORT.md`
- `packages/benchmark/PARSER_OPTIMIZATION_FINAL_REPORT.md`
- `packages/benchmark/ALGORITHM_CHECKPOINTS_2026.md`
- `packages/benchmark/knowledge/reports/parser/STAX_STYLE_PARSER_COMPARISON_FEAT_CURSOR_OPTIMIZATIONS.md`
- `docs/superpowers/plans/2026-04-16-cursor-core-enhancement-plan.md`

### 현재 workspace 회귀 근거

- `packages/benchmark/published-cursor-vs-parser-regression.mjs`
- `packages/benchmark/published-cursor-vs-parser-regression.test.mjs`
- `packages/benchmark/results/published-regression/published-cursor-vs-parser-regression-1776477257207.md`
- `packages/benchmark/results/published-regression/published-cursor-vs-parser-regression-1776489558318.md`
- `packages/benchmark/results/published-matrix/published-matrix-1776429873846.md`
- `packages/benchmark/results/published-matrix/gc-cursor-vs-parser-1776425418925.md`

### 핵심 구현 파일

- `packages/stax-xml/src/StaxXmlParserSync.ts`
- `packages/stax-xml/src/SyncParserCore.ts`
- `packages/stax-xml/src/StaxXmlCursorReaderSync.ts`
- `packages/stax-xml/src/CursorLiveView.ts`
- `packages/stax-xml/src/CursorAttrStore.ts`
- `packages/stax-xml/src/AttrStore.ts`
- `packages/stax-xml/src/EventCursorLiveView.ts`
- `packages/stax-xml/src/BufferSyncParserCore.ts`
- `packages/stax-xml/src/buffer-cursor-frame.ts`
- `packages/stax-xml/src/AsyncParserCore.ts`

### V8 공식 참고

- Fast properties in V8: <https://v8.dev/blog/fast-properties>
- Maps (Hidden Classes) in V8: <https://v8.dev/docs/hidden-classes>
- Orinoco: young generation garbage collection: <https://v8.dev/blog/orinoco-parallel-scavenger>
- Trash talk: the Orinoco garbage collector: <https://v8.dev/blog/trash-talk>
- How we made JSON.stringify more than twice as fast: <https://v8.dev/blog/json-stringify>

---

## 최종 판단

cursor approach는 완전히 헛수고는 아니었다.

- current branch 내부에서는 일부 wins가 있었고
- architecture 분리(`SyncParserCore`, `AsyncParserCore`)도 가치가 있었다.

하지만 사용자가 묻는 질문, 즉:

> “왜 cursor API가 마지막 릴리즈 parser API보다 느린가?”

에 대한 대답은 분명하다.

> 지금까지의 cursor 최적화는 주로 wrapper/materialization 바깥쪽을 건드렸고, release parser가 이미 잘하고 있던 parser hot path, string path, V8-friendly stable object model을 충분히 넘어서는 데 실패했다.  
> 특히 exported buffer/async cursor surface는 decode와 attribute-heavy 비용을 크게 얹으면서 실제 제품 비교에서 회귀를 만들었다.
