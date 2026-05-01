# StreamReader Overhead Profile

Generated: 2026-04-30T12:55:05.415Z
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
| stream-native-count | count-only | 51.56 ms | 1013762 | 1363006435 | stream-native-count.cpuprofile |
| stream-native-full | full-string | 109.06 ms | 1013762 | -713280541 | stream-native-full.cpuprofile |
| event-native-count | count-only | 88.56 ms | 1013762 | 1363006435 | event-native-count.cpuprofile |
| event-native-full | full-string | 107.04 ms | 1013762 | -713280541 | event-native-full.cpuprofile |
| event-native-full-namespace | full-string | 177.41 ms | 1013762 | -713280541 | event-native-full-namespace.cpuprofile |
| neutral-full | full-string | 179.39 ms | 1013762 | -713280541 | neutral-full.cpuprofile |

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
- Avg time: 51.56 ms
- Samples: 726

Top focus groups:
- consumer checksum and accessor loop: 115 samples (15.8%)
- stream accessor copy and decode: 0 samples (0.0%)
- event materialization: 0 samples (0.0%)
- namespace and qname materialization: 0 samples (0.0%)

Top project-local frames:
- consumeStreamReader @ profile-stream-reader-overhead.mjs:371: 112 samples (15.4%)
- drainPendingChunks @ index.js:1: 4 samples (0.6%)
- next @ index.js:1: 3 samples (0.4%)
- enqueueNativeBatch @ index.js:1: 2 samples (0.3%)
- runCaseOnce @ profile-stream-reader-overhead.mjs:417: 1 samples (0.1%)

## stream-native-full

- Reader kind: stream
- Backend: native
- Tier: full-string
- Batch size: 1
- Avg time: 109.06 ms
- Samples: 1573

Top focus groups:
- consumer checksum and accessor loop: 401 samples (25.5%)
- stream accessor copy and decode: 342 samples (21.7%)
- event materialization: 0 samples (0.0%)
- namespace and qname materialization: 0 samples (0.0%)

Top project-local frames:
- consumeStreamReader @ profile-stream-reader-overhead.mjs:371: 271 samples (17.2%)
- copyName @ index.js:1: 142 samples (9.0%)
- copyNameSpan @ index.js:1: 132 samples (8.4%)
- foldString @ profile-stream-reader-overhead.mjs:225: 77 samples (4.9%)
- text @ index.js:1: 28 samples (1.8%)
- copySpan @ index.js:1: 17 samples (1.1%)
- getAttributeName @ index.js:1: 15 samples (1.0%)
- getAttributeValue @ index.js:1: 9 samples (0.6%)

## event-native-count

- Reader kind: event
- Backend: native
- Tier: count-only
- namespaceAware: false
- Avg time: 88.56 ms
- Samples: 1259

Top focus groups:
- stream accessor copy and decode: 130 samples (10.3%)
- consumer checksum and accessor loop: 17 samples (1.4%)
- event materialization: 8 samples (0.6%)
- namespace and qname materialization: 0 samples (0.0%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:328: 261 samples (20.7%)
- readEvent @ index.js:1: 212 samples (16.8%)
- copyNameSpan @ index.js:1: 130 samples (10.3%)
- tryCreateStructuralIndexParser @ index.js:1: 74 samples (5.9%)
- next @ index.js:1: 17 samples (1.4%)
- readAttributes @ index.js:1: 13 samples (1.0%)
- materializeText @ index.js:1: 8 samples (0.6%)
- nextDirect @ index.js:1: 3 samples (0.2%)

## event-native-full

- Reader kind: event
- Backend: native
- Tier: full-string
- namespaceAware: false
- Avg time: 107.04 ms
- Samples: 1526

Top focus groups:
- stream accessor copy and decode: 106 samples (6.9%)
- consumer checksum and accessor loop: 26 samples (1.7%)
- event materialization: 9 samples (0.6%)
- namespace and qname materialization: 0 samples (0.0%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:328: 492 samples (32.2%)
- readEvent @ index.js:1: 249 samples (16.3%)
- copyNameSpan @ index.js:1: 106 samples (6.9%)
- tryCreateStructuralIndexParser @ index.js:1: 73 samples (4.8%)
- readAttributes @ index.js:1: 33 samples (2.2%)
- next @ index.js:1: 24 samples (1.6%)
- Xe @ index.js:1: 11 samples (0.7%)
- materializeText @ index.js:1: 9 samples (0.6%)

## event-native-full-namespace

- Reader kind: event
- Backend: native
- Tier: full-string
- namespaceAware: true
- Avg time: 177.41 ms
- Samples: 2539

Top focus groups:
- stream accessor copy and decode: 244 samples (9.6%)
- namespace and qname materialization: 243 samples (9.6%)
- event materialization: 127 samples (5.0%)
- consumer checksum and accessor loop: 21 samples (0.8%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:328: 759 samples (29.9%)
- Pe @ index.js:1: 260 samples (10.2%)
- materializeStartElement @ index.js:1: 198 samples (7.8%)
- runCaseOnce @ profile-stream-reader-overhead.mjs:417: 138 samples (5.4%)
- materializeEvent @ index.js:1: 112 samples (4.4%)
- copyNameSpan @ index.js:1: 107 samples (4.2%)
- copyName @ index.js:1: 106 samples (4.2%)
- tryCreateStructuralIndexParser @ index.js:1: 78 samples (3.1%)

## neutral-full

- Reader kind: event
- Backend: js
- Tier: full-string
- namespaceAware: false
- Avg time: 179.39 ms
- Samples: 2567

Top focus groups:
- event materialization: 175 samples (6.8%)
- consumer checksum and accessor loop: 84 samples (3.3%)
- stream accessor copy and decode: 81 samples (3.2%)
- table navigation: 11 samples (0.4%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:328: 690 samples (26.9%)
- parseBuffer @ index.js:1: 243 samples (9.5%)
- parseStartTag @ index.js:1: 230 samples (9.0%)
- runCaseOnce @ profile-stream-reader-overhead.mjs:417: 149 samples (5.8%)
- C @ index.js:1: 106 samples (4.1%)
- parseEndTag @ index.js:1: 101 samples (3.9%)
- materializeEvent @ index.js:1: 99 samples (3.9%)
- next @ index.js:1: 79 samples (3.1%)

