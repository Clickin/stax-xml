---
title: Pure JavaScript Parser 결정 기록
description: stax-xml이 native와 Wasm parser 실험을 패키지 밖으로 분리하고 pure JavaScript parser로 정리한 이유.
---

`stax-xml`은 의도적으로 pure JavaScript XML parser로 유지됩니다. 이 문서는 native
addon과 Wasm 실험을 이 패키지 밖으로 옮긴 이유와, 앞으로 acceleration 작업을
판단할 때 지켜야 할 기준을 기록합니다.

## 제품 목표

핵심 목표는 다음과 같습니다.

- 큰 XML 문서에서도 메모리 사용량을 낮게 유지합니다.
- JavaScript의 실질적인 단일 문자열 한계를 넘는 XML을 처리합니다.
- 애플리케이션 코드가 깊은 SAX state machine을 직접 유지하지 않도록 pull-style
  API를 제공합니다.
- binary parser package 없이 Node, Bun, Deno, browser, edge runtime을 지원합니다.
- async 작업은 stream 또는 file ingress boundary에만 두고, 각 byte batch 내부의
  tokenization과 cursor drain은 동기적으로 실행합니다.

이 목표는 raw tokenizer throughput보다 넓습니다. public contract는 JavaScript
caller가 name, text, attribute, event, object를 JavaScript 값으로 읽는 pull
parser입니다.

## Native Tokenization은 동작했다

native addon 실험은 native code가 XML byte를 매우 빠르게 tokenize할 수 있음을
보여주었습니다. Rust code는 byte buffer를 scan하고, compact span table을 유지하고,
JavaScript에서는 어색한 CPU-oriented 구현 기법을 사용할 수 있습니다.

따라서 좁은 tokenizer 문제에서는 native code가 매력적이었습니다. 하지만 그것만으로
public parser 문제가 해결되지는 않았습니다.

## JavaScript 경계가 지배적이었다

입력 쪽은 효율적으로 만들 수 있습니다. native addon은 JavaScript
`Buffer`/`ArrayBuffer`를 전체 XML 문서 copy 없이 view로 읽을 수 있습니다.

출력 쪽은 다릅니다. 파싱된 XML은 name, text, attribute value, object가
JavaScript로 넘어온 뒤에야 JavaScript caller에게 유용합니다. 이 값들은 재사용 가능한
native view가 아닙니다.

- JavaScript string은 mutable `char[]` object가 아니라 immutable primitive입니다.
- native span이나 pointer를 decode/materialization 없이 JavaScript string으로 반환할
  수 없습니다.
- attribute map과 event object는 JavaScript allocation 및 shape 관리가 필요합니다.
- wrapper layer를 통과하면 dispatch와 ownership 비용이 추가됩니다.

native code는 자체 table을 매우 빠르게 채울 수 있었지만, public facade는 여전히
JavaScript string과 object를 materialize해야 했습니다. 더 현실적인 consumer를
측정할수록 native tokenizer의 이점은 pure JavaScript cursor path에 가까워졌습니다.

## Wasm도 결정을 바꾸지 못했다

Wasm도 같은 public boundary 문제를 가지며, 추가로 memory boundary가 있습니다.
parser state와 result span은 Wasm linear memory에 있고, JavaScript caller는
JavaScript 값을 필요로 합니다.

즉 name, text, attribute, detail object는 결국 JavaScript로 decode 또는 copy되어야
합니다. 또한 lazy pointer-backed detail object는 producer가 memory lifetime을
보장하지 않는 한 취약합니다.

외부 비교 대상으로 `sax-wasm`도 확인했습니다. `sax-wasm`은
`ReadableStream.getReader()` 위에 generator-like API를 제공합니다. 로컬 테스트에서
generator path는 Wasm memory에 backed된 lazy detail object를 yield했고, write 이후
detail에 접근하면 Wasm memory 변경으로 detached `ArrayBuffer`에 닿을 수 있었습니다.
즉시 event-handler path는 측정 가능했지만, 이것은 다른 callback-style 소비 모델입니다.

이 관찰은 boundary 문제를 다시 확인해 주었습니다. Wasm은 내부 scanning을 가속할 수
있지만 JavaScript materialization이나 memory lifetime 비용을 없애지는 못합니다.

## 메모리도 결정의 일부였다

이 패키지에서 peak RSS는 핵심 요구사항입니다. JavaScript string limit은 피했지만 큰
native heap, Wasm linear memory, bridge buffer, retained wrapper state로 대체한다면
대용량 XML parser로서의 의미가 줄어듭니다.

native와 Wasm 구현은 일반 JavaScript parser state 밖에 추가 memory region을 만듭니다.

- native heap allocation;
- Wasm linear memory;
- JS와 native/Wasm 사이의 bridge buffer;
- native/Wasm state를 reachable하게 유지하는 wrapper object.

native scanning이 내부적으로 더 빠르더라도 이 memory profile은 pure JavaScript
byte-batch cursor core보다 패키지 목표에 덜 맞았습니다.

## 현재 설계

현재 `stax-xml`은 parser 구현을 JavaScript에 둡니다.

- `Uint8Array` batch 위의 byte-oriented scanning;
- 각 batch 내부의 synchronous tokenizer와 cursor drain;
- public accessor를 통한 lazy string materialization;
- XML event마다 `await`하지 않고 chunk 또는 batch ingress에서만 `await`하는
  `ReadableStream` 지원;
- backend mode, native addon selection, Wasm parser fallback 없음.

이 결과는 runtime 간 동작을 설명하기 쉽고 benchmark도 더 정직해집니다. Node, Bun,
Deno는 하나의 facade 뒤에서 서로 다른 parser engine을 비교하는 것이 아니라 같은
JavaScript 구현을 비교합니다.

## Native 작업은 다른 경계에 속한다

native 작업은 여전히 가치가 있습니다. 다만 다른 product boundary에 더 적합합니다.
native StAX-style API를 가진 Rust crate는 JavaScript로 반복해서 넘어오지 않고 span,
borrowed data, Rust-owned structure를 노출할 수 있습니다. quick-xml-style parser
acceleration은 그쪽이 더 알맞은 위치입니다.

`stax-xml`의 public boundary는 JavaScript입니다. 새로운 evidence가 full public
workload를 개선하고 memory 목표를 해치지 않는다는 것을 보여주기 전까지, 최적화는 pure
JavaScript cursor, stream, converter, writer path를 개선해야 합니다.

## 재검토 기준

tokenizer microbenchmark가 빠르다는 이유만으로 native 또는 Wasm backend mode를 다시
도입하지 않습니다. 재검토하려면 다음 조건을 모두 만족하는 evidence가 필요합니다.

- string과 attribute materialization을 포함한 full public parser workload가 개선됩니다.
- 큰 XML 문서에서 peak RSS가 나빠지지 않습니다.
- 사용자가 runtime backend를 선택해야 하는 API가 되지 않습니다.
- Node, Bun, Deno, browser 동작을 설명할 수 있습니다.
- memory lifetime, fallback, packaging failure mode가 현재 pure JavaScript path보다
  단순합니다.

그 전까지 native parser 작업은 별도의 Rust-focused project에 두고, `stax-xml`은 pure
JavaScript pull parser로 유지합니다.
