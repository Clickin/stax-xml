---
title: Benchmarks
description: Performance comparisons and benchmark results for StAX-XML
head:
  - tag: meta
    attrs:
      property: og:image
      content: https://clickin.github.io/stax-xml/og/ko/resources/benchmarks.png
  - tag: meta
    attrs:
      property: og:image:width
      content: "1200"
  - tag: meta
    attrs:
      property: og:image:height
      content: "630"
  - tag: meta
    attrs:
      name: twitter:image
      content: https://clickin.github.io/stax-xml/og/ko/resources/benchmarks.png
---

StAX-XML은 다양한 XML 처리 시나리오에서 고성능을 위해 설계되었습니다. 이 페이지는 StAX-XML과 다른 인기 있는 XML 파싱 라이브러리들을 비교한 벤치마크 결과를 제시합니다.

## 벤치마크 환경

이 페이지의 parser comparison 표는 다음 환경에서 다시 측정했습니다:
- **CPU**: 13th Gen Intel(R) Core(TM) i5-13600K (~4.70-4.80 GHz)
- **런타임**: Node.js 24.12.0 (x64-win32) with garbage collection exposed (`--expose-gc`)
- **도구**: 정확한 성능 측정을 위한 [Mitata](https://github.com/evanw/mitata)
- **비교 라이브러리**: fast-xml-parser, xml2js, txml, StAX-XML

아래의 async 크기 비교 및 writer 섹션은 이번 release에서 다시 측정하지 않은 기존 reference 수치입니다.

## 파서 성능

### 소형 문서 (2KB)

일반적인 웹 서비스 응답 및 설정 파일 (complex.xml):

| 라이브러리 | 평균 시간 | 초당 작업 수 | 메모리 사용량 | 비고 |
|---------|--------------|----------------|--------------|-------|
| **txml** | 121.03 µs | ~8,262 ops/sec | 26.41 kb | 가장 빠름, 경량 |
| **stax-xml to object** | 260.88 µs | ~3,833 ops/sec | 28.51 kb | 객체 변환 |
| **stax-xml consume** | 269.33 µs | ~3,713 ops/sec | 24.28 kb | 스트림 처리 |
| fast-xml-parser | 555.92 µs | ~1,799 ops/sec | 129.73 kb | DOM 기반 |
| xml2js | 1.00 ms | ~1,000 ops/sec | 203.56 kb | 콜백 기반, 메모리 집약적 |

### 중형 문서 (4KB)

일반적인 API 응답 및 데이터 파일 (books.xml):

| 라이브러리 | 평균 시간 | 초당 작업 수 | 메모리 사용량 | 비고 |
|---------|--------------|----------------|--------------|-------|
| **txml** | 126.53 µs | ~7,903 ops/sec | 46.32 kb | 가장 빠름, 경량 |
| **stax-xml consume** | 295.36 µs | ~3,386 ops/sec | 45.30 kb | 스트림 처리 |
| **stax-xml to object** | 342.66 µs | ~2,918 ops/sec | 52.95 kb | 객체 변환 |
| fast-xml-parser | 727.33 µs | ~1,375 ops/sec | 560.08 kb | 좋은 균형 |
| xml2js | 1.28 ms | ~781 ops/sec | 544.96 kb | 메모리 집약적 |

### 대용량 문서 (1MB ~ 1GB)

대용량 XML 파일 처리 (RSS 피드, 데이터 내보내기 등):

| 파일 크기 | 파서 유형 | 처리 시간 | 메모리 사용량 | 성능 비율 |
|-----------|-------------|-----------------|--------------|-------------------|
| 1MB | **sync parser** | 14.36 ms | 3.09 mb | 기준선 |
| 1MB | async parser | 27.86 ms | 1.98 mb | 1.94배 느림 |
| 10MB | **sync parser** | 66.68 ms | 24.03 mb | 기준선 |
| 10MB | async parser | 155.85 ms | 10.30 mb | 2.34배 느림 |
| 100MB | **sync parser** | 737.16 ms | 209.26 mb | 기준선 |
| 100MB | async parser | 1.43 s | 9.82 mb | 1.94배 느림 |
| 1GB | async parser | 14.20 s | 4.81 mb | 메모리 효율적 |

**주요 인사이트:**
- 동기 파서가 작은 파일에는 더 빠르지만 더 많은 메모리를 사용함
- 비동기 파서는 매우 큰 파일에도 낮은 메모리 사용량을 유지함
- 100MB 이상의 파일에서는 메모리 관리를 위해 비동기 파서가 필수적임

### 동기 파서 라이브러리 비교

다양한 파일 크기에 대한 동기 파서의 상세 비교:

#### 중대형 문서 (13MB)

midsize.xml (13MB) 성능 결과:

| 라이브러리 | 평균 시간 | 초당 작업 수 | 메모리 사용량 | 성능 비고 |
|---------|--------------|----------------|--------------|------------------|
| **xml2js** | 663.47 µs | ~1,507 ops/sec | 323.69 kb | 예외적 성능* |
| **stax-xml consume** | 89.07 ms | ~11.2 ops/sec | 4.93 mb | 스트림 처리 |
| **stax-xml to object** | 95.21 ms | ~10.5 ops/sec | 35.41 mb | 객체 변환 |
| **txml** | 128.58 ms | ~7.8 ops/sec | 126.90 mb | 경량 DOM |
| fast-xml-parser | 642.49 ms | ~1.6 ops/sec | 128.11 mb | 메모리 집약적 |

*xml2js가 이 13MB 파일에서 예외적인 성능(평소보다 1000배 빠름)을 보이는 것은 XML 구조가 DOM 파싱 환경에 최적화되어 있고 요소 재사용과 얕은 중첩이 빈번하기 때문으로 추정됩니다.

#### 대형 문서 (98MB)

large.xml (98MB) 성능 결과:

| 라이브러리 | 평균 시간 | 초당 작업 수 | 메모리 사용량 | 성능 비고 |
|---------|--------------|----------------|--------------|------------------|
| **stax-xml consume** | 660.41 ms | ~1.51 ops/sec | 35.12 mb | 최고 전체 성능 |
| **stax-xml to object** | 676.93 ms | ~1.48 ops/sec | 7.38 mb | 메모리 효율적 |
| **txml** | 1.93 s | ~0.52 ops/sec | 890.28 mb | 높은 메모리 |
| fast-xml-parser | 7.85 s | ~0.13 ops/sec | 1.08 gb | 느림, 메모리 집약적 |
| xml2js | 9.30 s | ~0.11 ops/sec | 656.68 mb | 가장 느린 성능 |

**성능 교차점 분석:**
- **소형 파일 (2-4KB)**: txml이 여전히 순수 파싱 처리량에서 앞섬
- **중형 파일 (13MB)**: xml2js는 이 fixture에서만 보이는 이상치에 가깝고, `stax-xml consume`와 `stax-xml to object`는 비슷한 처리량 대역에 머뭅니다
- **대형 파일 (98MB)**: StAX-XML이 속도와 메모리 효율성의 최고 균형 제공
- **초대형 파일 (1GB+)**: 비동기 파서만 실행 가능

## 라이터 성능

### 소형 문서 생성

작은 JSON 데이터에서 XML 문서 생성 (test_ordered.json):

| 라이브러리 | 평균 시간 | 초당 작업 수 | 메모리 사용량 | 성능 비율 |
|---------|--------------|----------------|--------------|-------------------|
| **fast-xml-parser builder** | 130.68 µs | ~7,652 ops/sec | 48.31 kb | 가장 빠름 |
| **stax-xml writer sync** | 170.92 µs | ~5,851 ops/sec | 87.92 kb | 1.31배 느림 |
| xml2js builder | 305.88 µs | ~3,269 ops/sec | 133.29 kb | 2.34배 느림 |
| stax-xml writer | 450.07 µs | ~2,222 ops/sec | 521.40 kb | 3.44배 느림 |

### 대용량 문서 생성 (1MB)

큰 JSON 데이터에서 대용량 XML 문서 생성:

| 라이브러리 | 평균 시간 | 초당 작업 수 | 메모리 사용량 | 성능 비율 |
|---------|--------------|----------------|--------------|-------------------|
| **fast-xml-parser builder** | 13.77 ms | ~72.6 ops/sec | 2.82 mb | 가장 빠름 |
| **stax-xml writer sync** | 58.56 ms | ~17.1 ops/sec | 17.30 mb | 4.25배 느림 |
| stax-xml writer | 122.45 ms | ~8.2 ops/sec | 1.44 mb | 8.89배 느림 |

### 비동기 vs 동기 라이터 비교

다양한 요소 수에 대한 비동기 및 동기 라이터 비교:

| 요소 수 | 비동기 라이터 | 동기 라이터 | 성능 비율 |
|---------------|--------------|-------------|-------------------|
| 1K 요소 | 42.25 ms | 14.27 ms | 2.96배 빠름 (동기) |
| 5K 요소 | 179.80 ms | 62.12 ms | 2.89배 빠름 (동기) |
| 10K 요소 | 350.53 ms | 122.74 ms | 2.86배 빠름 (동기) |

**주요 인사이트:**
- 동기 라이터가 비동기 라이터보다 지속적으로 ~3배 빠름
- Fast-xml-parser가 소형 및 대형 문서 모두에서 최고의 빌더 성능을 보임
- 동기 라이터는 더 많은 메모리를 사용하지만 더 나은 처리량을 제공
- 비동기 라이터는 메모리 제약 환경에 더 적합

## 메모리 효율성

### 메모리 사용 패턴

**StAX-XML의 장점:**
- 스트리밍 작업을 위한 **일정한 메모리 사용량**
- 파싱 중 **최소한의 객체 할당**
- 단기 객체로 **가비지 컬렉션 친화적**
- DOM 기반 파서에 비해 **낮은 메모리 오버헤드**

**실제 벤치마크 결과:**
```
파일 크기: 10MB XML 문서

stax-xml async parser:     ~10.30 MB 최대 메모리
stax-xml sync parser:      ~24.03 MB 최대 메모리
fast-xml-parser:           ~513.58 kb (4KB 파일)
xml2js:                    ~773.91 kb (4KB 파일)
txml:                      ~3.17 kb (4KB 파일)
```

**대용량 파일 메모리 사용량:**
```
파일 크기: 100MB XML 문서

stax-xml async parser:     ~9.82 MB 최대 메모리
stax-xml sync parser:      ~209.26 MB 최대 메모리

파일 크기: 1GB XML 문서

stax-xml async parser:     ~4.81 MB 최대 메모리
```

## 벤치마크 스크립트

포함된 벤치마크 스위트를 사용하여 직접 이러한 벤치마크를 실행할 수 있습니다:

```bash
# 모든 벤치마크 실행
npm run dev:bench:all

# 특정 벤치마크 카테고리 실행
npm run dev:bench:sync       # 동기 파서 및 라이터 벤치마크
npm run dev:bench:async      # 비동기 파서 및 라이터 벤치마크

# 개별 벤치마크
npm run dev:parser:2kb       # 소형 문서 파싱 (2KB)
npm run dev:parser:4kb       # 중형 문서 파싱 (4KB)
npm run dev:parser:13mb      # 중대형 문서 파싱 (13MB)
npm run dev:parser:98mb      # 대형 문서 파싱 (98MB)
npm run dev:builder:small    # 소형 문서 생성
npm run dev:builder:big      # 대형 문서 생성 (1MB)
npm run dev:async:parser     # 다양한 파일 크기의 비동기 파서
npm run dev:async:writer     # 비동기 vs 동기 라이터 비교
```

### 사용자 정의 벤치마크

자신만의 성능 테스트 생성:

```typescript
import { bench, run } from 'mitata';
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

const testXml = '<root><item>test</item></root>';

bench('StAX-XML 파싱', () => {
  const parser = new StaxXmlParserSync(testXml);
  let count = 0;

  for (const event of parser) {
    if (event.type === XmlEventType.START_ELEMENT) {
      count++;
    }
  }

  return count;
});

await run();
```

## 성능 팁

### 최적화 전략

1. **올바른 파서 선택**
   - 10MB 미만 문서에는 `StaxXmlParserSync` 사용
   - 대용량 파일이나 스트리밍 시나리오에는 `StaxXmlParser` 사용

2. **메모리 할당 최소화**
   - 이벤트를 저장하지 말고 도착 즉시 처리
   - 자주 생성되는 객체에 객체 풀링 사용
   - 핫 패스에서 문자열 연결 피하기

3. **효율적인 이벤트 처리**
   - if-else 체인 대신 switch 문 사용
   - 파싱 루프 밖에서 정규 표현식 미리 컴파일
   - 배열 대신 Set을 사용하여 요소 이름 조회

4. **스트리밍 모범 사례**
   - 적절한 청크 크기 구성 (기본값 64KB)
   - 라이터에 백프레셔 처리 구현
   - 논블로킹 처리를 위해 비동기 반복 사용

### 성능 모니터링

```typescript
import { StaxXmlParserSync, XmlEventType } from 'stax-xml';

function benchmarkParsing(xml: string, iterations: number = 1000) {
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const parser = new StaxXmlParserSync(xml);
    let eventCount = 0;

    for (const event of parser) {
      eventCount++;
    }
  }

  const end = performance.now();
  const totalTime = end - start;
  const avgTime = totalTime / iterations;
  const opsPerSec = 1000 / avgTime;

  console.log(`파싱당 평균 시간: ${avgTime.toFixed(2)}ms`);
  console.log(`초당 작업 수: ${opsPerSec.toFixed(0)}`);
}
```

## 지속적인 벤치마킹

StAX-XML이 속도 우위를 유지할 수 있도록 성능을 지속적으로 모니터링합니다:

- 모든 릴리스에서 **자동화된 벤치마크** 실행
- 성능 저하를 방지하는 **회귀 테스트**
- 효율적인 리소스 사용을 보장하는 **메모리 프로파일링**
- Node.js, Bun, Deno에서 **크로스 플랫폼 테스트**

## 벤치마크 기여

벤치마크 개선에 도움을 주세요:

1. 특정 사용 사례에 대한 **새로운 테스트 케이스 추가**
2. 재현 가능한 예제로 **성능 문제 보고**
3. 벤치마크 증거와 함께 **최적화 제출**
4. **다양한 플랫폼에서 테스트**하고 결과 공유

기여 가이드라인은 [GitHub 저장소](https://github.com/Clickin/stax-xml)를 참조하세요.
