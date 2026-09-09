# Wasm 책임 분리 실험 결과

Outcome 3: 기존 Wasm보다 개선했지만 대표 byte Reader/converter에서 JS보다 느리다. 기본 backend는 JS 그대로다.

## 구현과 의미론
기준: next/wasm 6e7b89fdf161574b98555557a4b6e1bb5af7298c. 기존 SPI/session은 이미 계획에 부합해 유지했다. stable index/converter JS 및 선언 파일 SHA-256은 전후 동일하다.
utf8.ts는 UTF-8/문자 검증, scan.ts는 pointer scanner, tokenizer.ts는 XML/resume/arena/namespace/entity 상태, TokenCursorWasm.ts는 lazy JS materialization을 담당한다. raw getter들을 13-word tokenView ABI로 교체했다. minimal runtime, cursor별 instance, variant별 compiled module 캐시는 유지했다.
선언/BOM/document/fragment/속성/namespace/엔티티/CDATA/comment/PI/DOCTYPE/오류/분할/dispose 계약을 검증했다. 오류 문구·위치의 완전 동일성이나 전체 XML 규격 적합성을 주장하지 않는다.

## 검증
JS 662, Wasm JS 33, AS scalar/SIMD 18 tests 통과. 세 backend W3C 각각 805 passed / 203 skipped / 0 failed. Wasm별 UTF-8 800, non-UTF-8 JS fallback 5. 제외: named entity78, unsupported declaration2, not-wf DTD117, namespace-incompatible4, strict document2.
128 MiB streaming: input capacity 1 MiB, memory19 pages(1.1875 MiB), 8 MiB 이후 증가 없음. SIMD process heap16,046,944 bytes / RSS176,488,448 bytes는 endpoint이며 peak가 아니다. dispose 후 facade 보유 pages0.
Node24.21.0/Apple M4, warmup2/runs5. init 없는 UTF-8 실패, Wasm 없는 JS, string/non-UTF-8 fallback, sync/async converter/reader smoke 통과. byte ingress+type-only의 JS decode 호출0. pack에 두 wasm asset 포함. 이번 실행은 Node ESM 검증이며 browser/LTS/bundler matrix는 미검증이다.

## 격리 프로세스 결과 (median ms)
|MiB|경로|이전 SIMD|최종 JS|최종 scalar|최종 SIMD|
|---|---|---:|---:|---:|---:|
|13|stream-reader-sync-bytes|213.20|98.95|172.73|169.73|
|13|converter-bytes|213.07|97.63|173.16|173.78|
|98|stream-reader-sync-bytes|1678.76|668.77|1295.27|1261.07|
|98|converter-bytes|1632.07|629.87|1282.70|1254.16|

## 생성 fixture 전체 matrix
아래 JSON은 tokenizer, sync/async/chunked/full accessor, event materialization, compiled converter, cold/memory 원본 표본을 포함한다. 혼합 process matrix와 격리 결과는 구분한다.
```json
{
  "workloads": {
    "simple-ascii": {
      "tokenizer-type-only": {
        "js": 29.748,
        "scalar": 36.16,
        "simd": 35.15
      },
      "stream-sync-type-only": {
        "js": 40.528,
        "scalar": 33.895,
        "simd": 32.769
      },
      "stream-sync-accessors": {
        "js": 56.497,
        "scalar": 165.315,
        "simd": 164.777
      },
      "stream-sync-chunked": {
        "js": 58.377,
        "scalar": 165.965,
        "simd": 167.971
      },
      "stream-async": {
        "js": 71.926,
        "scalar": 188.92,
        "simd": 187.536
      }
    },
    "attribute-heavy": {
      "tokenizer-type-only": {
        "js": 27.5,
        "scalar": 34.913,
        "simd": 33.153
      },
      "stream-sync-type-only": {
        "js": 30.245,
        "scalar": 34.415,
        "simd": 32.364
      },
      "stream-sync-accessors": {
        "js": 67.54,
        "scalar": 139.757,
        "simd": 136.811
      },
      "stream-sync-chunked": {
        "js": 63.393,
        "scalar": 138.429,
        "simd": 137.004
      },
      "stream-async": {
        "js": 67.198,
        "scalar": 144.532,
        "simd": 142.505
      },
      "event-sync-materialized": {
        "js": 68.063,
        "scalar": 142.051,
        "simd": 139.402
      }
    },
    "namespace-heavy": {
      "tokenizer-type-only": {
        "js": 33.449,
        "scalar": 45.691,
        "simd": 45.895
      },
      "stream-sync-type-only": {
        "js": 46.285,
        "scalar": 44.268,
        "simd": 43.657
      },
      "stream-sync-accessors": {
        "js": 67.065,
        "scalar": 199.792,
        "simd": 199.112
      },
      "stream-sync-chunked": {
        "js": 66.307,
        "scalar": 199.626,
        "simd": 198.801
      },
      "stream-async": {
        "js": 75.23,
        "scalar": 210.392,
        "simd": 210.315
      }
    },
    "unicode-heavy": {
      "tokenizer-type-only": {
        "js": 19.346,
        "scalar": 23.669,
        "simd": 25.39
      },
      "stream-sync-type-only": {
        "js": 30.852,
        "scalar": 22.133,
        "simd": 24.144
      },
      "stream-sync-accessors": {
        "js": 43.695,
        "scalar": 85.971,
        "simd": 89.718
      },
      "stream-sync-chunked": {
        "js": 48.679,
        "scalar": 93.772,
        "simd": 90.195
      },
      "stream-async": {
        "js": 54.917,
        "scalar": 96.389,
        "simd": 96.515
      }
    }
  },
  "cold": {
    "js": {
      "wasmBytes": null,
      "compileMs": null,
      "initMs": null,
      "instanceMs": null,
      "firstParseMs": 0.5867089999999848
    },
    "scalar": {
      "wasmBytes": 21353,
      "compileMs": 1.3177919999999972,
      "initMs": 0.03412500000001728,
      "instanceMs": 0.03145799999998644,
      "instanceSamplesMs": [
        0.31312500000001364,
        0.03929100000001995,
        0.03145799999998644,
        0.03099999999997749,
        0.030624999999986358
      ],
      "firstParseMs": 0.36991699999998673,
      "memory": {
        "pages": 1,
        "inputCapacity": 0
      }
    },
    "simd": {
      "wasmBytes": 21855,
      "compileMs": 0.11795800000001577,
      "initMs": 0.0034169999999846823,
      "instanceMs": 0.035750000000007276,
      "instanceSamplesMs": [
        0.2019160000000113,
        0.04137500000001637,
        0.029541999999992186,
        0.035750000000007276,
        0.026249999999976126
      ],
      "firstParseMs": 0.5804170000000113,
      "memory": {
        "pages": 1,
        "inputCapacity": 0
      }
    }
  },
  "artifacts": {
    "js": null,
    "scalar": {
      "path": "/Users/senghyunjo/github/stax-xml/packages/wasm/dist/tokenizer.scalar.wasm",
      "bytes": 21353,
      "sha256": "b204925e7f7ce3489571058f5107a3561712d474d418f11a4b6895a252074891"
    },
    "simd": {
      "path": "/Users/senghyunjo/github/stax-xml/packages/wasm/dist/tokenizer.simd.wasm",
      "bytes": 21855,
      "sha256": "286567bead618f7d648eba5244399e20160b03893298159ce46755e3fac789c1"
    }
  },
  "converter": {
    "bytes": 4194339,
    "records": 35168,
    "checksum": 1796842149,
    "variants": {
      "js": {
        "samplesMs": [
          64.22091699999874,
          60.19604199999594,
          60.969374999993306,
          59.44987499999843,
          61.00100000000384
        ],
        "medianMs": 60.969374999993306,
        "throughputMiBPerSec": 65.60725575096536,
        "memory": {
          "heapUsedBeforeMedian": 9725544,
          "heapUsedAfterMedian": 42749608,
          "rssBeforeMedian": 281575424,
          "rssAfterMedian": 282525696,
          "wasmAfter": null
        }
      },
      "scalar": {
        "samplesMs": [
          109.92395800000668,
          111.28020799999649,
          106.09479100000317,
          105.4543330000015,
          106.59112499999901
        ],
        "medianMs": 106.59112499999901,
        "throughputMiBPerSec": 37.526889584860946,
        "memory": {
          "heapUsedBeforeMedian": 9700424,
          "heapUsedAfterMedian": 60112960,
          "rssBeforeMedian": 282099712,
          "rssAfterMedian": 283181056,
          "wasmAfter": null
        }
      },
      "simd": {
        "samplesMs": [
          105.39833400000498,
          104.11274999999296,
          106.72979199999827,
          103.46429199999693,
          103.47466600000189
        ],
        "medianMs": 104.11274999999296,
        "throughputMiBPerSec": 38.42020673357821,
        "memory": {
          "heapUsedBeforeMedian": 9710808,
          "heapUsedAfterMedian": 60112208,
          "rssBeforeMedian": 282148864,
          "rssAfterMedian": 283230208,
          "wasmAfter": null
        }
      }
    }
  }
}
```

## 원인과 다음 단계
16-byte feed, 64KiB token 사례 SIMD188.92→2.58ms: quadratic prefix 재스캔 제거. 실측 getter ABI 호출940,034→405,505. 13MiB projection의 decode442,369회/2,691,076bytes는 그대로다.
중간 구현의 refreshMemory/get buffer self samples가14.43%/10.72%였다. 매 header word/getter마다 view를 확인하던 회귀를 제거하고, 메모리가 커질 수 있는 Wasm 호출 뒤에만 갱신했다.
Text Encoding Builtins는 작은 문자열 변환 비용을 줄일 후보지만 tokenizer/state 비용도 남아 있어 기다리기만 하면 JS를 이긴다는 근거는 없다. 다음은 작은 값 materialization과 parser state 비용을 분리하는 실험이다. 기본 승격에 필요한 지속적 end-to-end 우위, runtime/packaging matrix, 격리 peak RSS gate는 미충족이다.

## 실행 명령
```sh
pnpm install
pnpm build
pnpm test
pnpm test:w3c
pnpm verify:release-surfaces
pnpm build:wasm
pnpm test:wasm
pnpm --dir packages/benchmark bench:parser:13mb
pnpm --dir packages/benchmark bench:parser:98mb
pnpm --dir packages/benchmark bench:converter:compiled-batch
pnpm benchmark:wasm --out=/tmp/stax/wasm-before.json --commit=6e7b89fdf161574b98555557a4b6e1bb5af7298c
pnpm benchmark:wasm --out=/tmp/stax/wasm-after.json
node --expose-gc packages/benchmark/wasm-isolated.mjs --wasm-entry=/tmp/stax/wasm-before-dist/index.js --out=/tmp/stax/isolated-before.json
node --expose-gc packages/benchmark/wasm-isolated.mjs --out=/tmp/stax/isolated-after.json
pnpm --dir packages/wasm test:js test/memory.test.ts --reporter=verbose --silent=false
pnpm --dir packages/wasm pack --pack-destination /tmp/stax/pack-v2
```

Raw evidence: `evidence/wasm-session-reports-2026-09-09` @ `cd3202d7`, `packages/benchmark/knowledge/reports/wasm-session/`. Implementation changes are not committed.
