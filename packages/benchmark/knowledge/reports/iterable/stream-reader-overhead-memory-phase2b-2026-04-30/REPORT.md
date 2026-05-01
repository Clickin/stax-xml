# StreamReader Overhead Profile

Generated: 2026-04-30T14:36:10.385Z
Node: v24.15.0
V8: 13.6.233.17-node.48
File: G:\programming\stax-xml\packages\benchmark\assets\midsize.xml
Warmups: 4
Iterations: 8
Sampling interval (requested): 250 us
Input mode: memory

## Case Summary

| Case | Tier | Avg time | Event count | Checksum | CPU profile |
| --- | --- | ---: | ---: | ---: | --- |
| stream-native-count | count-only | 49.04 ms | 1013762 | 1363006435 | stream-native-count.cpuprofile |
| stream-native-full | full-string | 109.85 ms | 1013762 | -713280541 | stream-native-full.cpuprofile |
| event-native-count | count-only | 86.47 ms | 1013762 | 1363006435 | event-native-count.cpuprofile |
| event-native-full | full-string | 111.07 ms | 1013762 | -713280541 | event-native-full.cpuprofile |
| event-native-full-namespace | full-string | 174.65 ms | 1013762 | -713280541 | event-native-full-namespace.cpuprofile |
| neutral-full | full-string | 179.55 ms | 1013762 | -713280541 | neutral-full.cpuprofile |

## Findings

- The current `EventReaderSync` benchmark path (`namespaceAware: false`) does not spend measurable CPU in `localName`/`prefix`/namespace expansion. That cost only appears when `namespaceAware: true` is enabled.
- `StreamReaderSync` spends more sampled CPU in accessor-driven string/span materialization than in native batch handoff, which matches the weak gain from `pushBatch()`.
- `StreamReaderSync` full-string is also GC-heavy in the profiled loop, which points to transient string churn from repeated accessor materialization rather than a remaining native boundary bottleneck.
- `EventReaderSync` still pays explicit JS event materialization cost even with `namespaceAware: false`, especially start-element object construction and plain attribute object creation.
- The current native `EventReaderSync` row is primarily spending time in the direct structural-index iterator (`readEvent`/`readAttributes`), not in the older `IterableEventMaterializer` path.

## stream-native-count

- Reader kind: stream
- Backend: native
- Tier: count-only
- Batch size: 1
- Avg time: 49.04 ms
- Samples: 689

Top focus groups:
- consumer checksum and accessor loop: 123 samples (17.9%)
- table navigation: 1 samples (0.1%)
- native boundary and batch handoff: 1 samples (0.1%)
- stream accessor copy and decode: 0 samples (0.0%)

Top project-local frames:
- consumeStreamReader @ profile-stream-reader-overhead.mjs:371: 118 samples (17.1%)
- next @ index.js:1: 4 samples (0.6%)
- drainPendingChunks @ index.js:1: 2 samples (0.3%)
- enqueueNativeBatch @ index.js:1: 2 samples (0.3%)
- runCaseOnce @ profile-stream-reader-overhead.mjs:417: 1 samples (0.1%)
- nextBatch @ index.js:1: 1 samples (0.1%)
- C @ index.js:1: 1 samples (0.1%)
- x @ index.js:1: 1 samples (0.1%)

## stream-native-full

- Reader kind: stream
- Backend: native
- Tier: full-string
- Batch size: 1
- Avg time: 109.85 ms
- Samples: 1570

Top focus groups:
- consumer checksum and accessor loop: 496 samples (31.6%)
- stream accessor copy and decode: 277 samples (17.6%)
- table navigation: 4 samples (0.3%)
- native boundary and batch handoff: 1 samples (0.1%)

Top project-local frames:
- consumeStreamReader @ profile-stream-reader-overhead.mjs:371: 247 samples (15.7%)
- rememberBytes @ index.js:1: 190 samples (12.1%)
- text @ index.js:1: 127 samples (8.1%)
- copyName @ index.js:1: 120 samples (7.6%)
- copyNameSpan @ index.js:1: 119 samples (7.6%)
- foldString @ profile-stream-reader-overhead.mjs:225: 81 samples (5.2%)
- copySpan @ index.js:1: 31 samples (2.0%)
- getAttributeCount @ index.js:1: 16 samples (1.0%)

## event-native-count

- Reader kind: event
- Backend: native
- Tier: count-only
- namespaceAware: false
- Avg time: 86.47 ms
- Samples: 1222

Top focus groups:
- stream accessor copy and decode: 145 samples (11.9%)
- event materialization: 11 samples (0.9%)
- table navigation: 6 samples (0.5%)
- consumer checksum and accessor loop: 6 samples (0.5%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:328: 269 samples (22.0%)
- readEvent @ index.js:1: 227 samples (18.6%)
- copyNameSpan @ index.js:1: 124 samples (10.1%)
- tryCreateStructuralIndexParser @ index.js:1: 61 samples (5.0%)
- readAttributes @ index.js:1: 17 samples (1.4%)
- materializeText @ index.js:1: 11 samples (0.9%)
- copyText @ index.js:1: 7 samples (0.6%)
- next @ index.js:1: 6 samples (0.5%)

## event-native-full

- Reader kind: event
- Backend: native
- Tier: full-string
- namespaceAware: false
- Avg time: 111.07 ms
- Samples: 1558

Top focus groups:
- stream accessor copy and decode: 160 samples (10.3%)
- event materialization: 28 samples (1.8%)
- consumer checksum and accessor loop: 7 samples (0.4%)
- table navigation: 1 samples (0.1%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:328: 446 samples (28.6%)
- readEvent @ index.js:1: 248 samples (15.9%)
- copyNameSpan @ index.js:1: 128 samples (8.2%)
- nextDirect @ index.js:1: 85 samples (5.5%)
- tryCreateStructuralIndexParser @ index.js:1: 63 samples (4.0%)
- materializeText @ index.js:1: 28 samples (1.8%)
- readAttributes @ index.js:1: 24 samples (1.5%)
- copyAttrName @ index.js:1: 13 samples (0.8%)

## event-native-full-namespace

- Reader kind: event
- Backend: native
- Tier: full-string
- namespaceAware: true
- Avg time: 174.65 ms
- Samples: 2452

Top focus groups:
- namespace and qname materialization: 237 samples (9.7%)
- stream accessor copy and decode: 228 samples (9.3%)
- event materialization: 128 samples (5.2%)
- consumer checksum and accessor loop: 20 samples (0.8%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:328: 773 samples (31.5%)
- Ve @ index.js:1: 265 samples (10.8%)
- materializeStartElement @ index.js:1: 182 samples (7.4%)
- runCaseOnce @ profile-stream-reader-overhead.mjs:417: 138 samples (5.6%)
- materializeEvent @ index.js:1: 116 samples (4.7%)
- copyNameSpan @ index.js:1: 108 samples (4.4%)
- copyName @ index.js:1: 94 samples (3.8%)
- tryCreateStructuralIndexParser @ index.js:1: 63 samples (2.6%)

## neutral-full

- Reader kind: event
- Backend: js
- Tier: full-string
- namespaceAware: false
- Avg time: 179.55 ms
- Samples: 2541

Top focus groups:
- event materialization: 165 samples (6.5%)
- stream accessor copy and decode: 89 samples (3.5%)
- consumer checksum and accessor loop: 85 samples (3.3%)
- table navigation: 2 samples (0.1%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:328: 686 samples (27.0%)
- parseBuffer @ index.js:1: 251 samples (9.9%)
- parseStartTag @ index.js:1: 222 samples (8.7%)
- runCaseOnce @ profile-stream-reader-overhead.mjs:417: 160 samples (6.3%)
- parseEndTag @ index.js:1: 117 samples (4.6%)
- k @ index.js:1: 100 samples (3.9%)
- materializeEvent @ index.js:1: 96 samples (3.8%)
- next @ index.js:1: 80 samples (3.1%)

