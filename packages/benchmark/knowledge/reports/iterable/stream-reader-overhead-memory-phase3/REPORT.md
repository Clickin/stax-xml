# StreamReader Overhead Profile

Generated: 2026-04-30T15:03:11.596Z
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
| stream-native-count | count-only | 49.34 ms | 1013762 | 1363006435 | stream-native-count.cpuprofile |
| stream-native-full | full-string | 127.86 ms | 1013762 | -713280541 | stream-native-full.cpuprofile |
| event-native-count | count-only | 87.34 ms | 1013762 | 1363006435 | event-native-count.cpuprofile |
| event-native-full | full-string | 109.08 ms | 1013762 | -713280541 | event-native-full.cpuprofile |
| event-native-full-namespace | full-string | 191.40 ms | 1013762 | -713280541 | event-native-full-namespace.cpuprofile |
| neutral-full | full-string | 183.61 ms | 1013762 | -713280541 | neutral-full.cpuprofile |

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
- Avg time: 49.34 ms
- Samples: 701

Top focus groups:
- consumer checksum and accessor loop: 124 samples (17.7%)
- table navigation: 1 samples (0.1%)
- stream accessor copy and decode: 0 samples (0.0%)
- event materialization: 0 samples (0.0%)

Top project-local frames:
- consumeStreamReader @ profile-stream-reader-overhead.mjs:371: 122 samples (17.4%)
- drainPendingChunks @ index.js:1: 5 samples (0.7%)
- runCaseOnce @ profile-stream-reader-overhead.mjs:417: 2 samples (0.3%)
- next @ index.js:1: 1 samples (0.1%)
- enqueueNativeBatch @ index.js:1: 1 samples (0.1%)
- activatePendingTable @ index.js:1: 1 samples (0.1%)
- eventType @ index.js:1: 1 samples (0.1%)
- getAttributeCount @ index.js:1: 1 samples (0.1%)

## stream-native-full

- Reader kind: stream
- Backend: native
- Tier: full-string
- Batch size: 1
- Avg time: 127.86 ms
- Samples: 1798

Top focus groups:
- consumer checksum and accessor loop: 725 samples (40.3%)
- stream accessor copy and decode: 253 samples (14.1%)
- table navigation: 7 samples (0.4%)
- native boundary and batch handoff: 1 samples (0.1%)

Top project-local frames:
- foldString @ profile-stream-reader-overhead.mjs:225: 401 samples (22.3%)
- copyNameSpan @ index.js:1: 244 samples (13.6%)
- rememberBytes @ index.js:1: 189 samples (10.5%)
- consumeStreamReader @ profile-stream-reader-overhead.mjs:371: 164 samples (9.1%)
- text @ index.js:1: 123 samples (6.8%)
- copyValueSpan @ index.js:1: 20 samples (1.1%)
- getAttributeName @ index.js:1: 20 samples (1.1%)
- getAttributeValue @ index.js:1: 8 samples (0.4%)

## event-native-count

- Reader kind: event
- Backend: native
- Tier: count-only
- namespaceAware: false
- Avg time: 87.34 ms
- Samples: 1236

Top focus groups:
- stream accessor copy and decode: 148 samples (12.0%)
- event materialization: 10 samples (0.8%)
- consumer checksum and accessor loop: 7 samples (0.6%)
- table navigation: 3 samples (0.2%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:328: 259 samples (21.0%)
- readEvent @ index.js:1: 233 samples (18.9%)
- copyNameSpan @ index.js:1: 107 samples (8.7%)
- tryCreateStructuralIndexParser @ index.js:1: 64 samples (5.2%)
- readAttributes @ index.js:1: 23 samples (1.9%)
- copyAttrName @ index.js:1: 19 samples (1.5%)
- copyText @ index.js:1: 15 samples (1.2%)
- materializeText @ index.js:1: 10 samples (0.8%)

## event-native-full

- Reader kind: event
- Backend: native
- Tier: full-string
- namespaceAware: false
- Avg time: 109.08 ms
- Samples: 1518

Top focus groups:
- stream accessor copy and decode: 132 samples (8.7%)
- event materialization: 35 samples (2.3%)
- consumer checksum and accessor loop: 5 samples (0.3%)
- table navigation: 1 samples (0.1%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:328: 512 samples (33.7%)
- readEvent @ index.js:1: 253 samples (16.7%)
- copyNameSpan @ index.js:1: 99 samples (6.5%)
- tryCreateStructuralIndexParser @ index.js:1: 61 samples (4.0%)
- materializeText @ index.js:1: 35 samples (2.3%)
- readAttributes @ index.js:1: 18 samples (1.2%)
- copyAttrName @ index.js:1: 17 samples (1.1%)
- copyText @ index.js:1: 15 samples (1.0%)

## event-native-full-namespace

- Reader kind: event
- Backend: native
- Tier: full-string
- namespaceAware: true
- Avg time: 191.40 ms
- Samples: 2692

Top focus groups:
- stream accessor copy and decode: 377 samples (14.0%)
- event materialization: 260 samples (9.7%)
- namespace and qname materialization: 84 samples (3.1%)
- consumer checksum and accessor loop: 6 samples (0.2%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:328: 828 samples (30.8%)
- He @ index.js:1: 274 samples (10.2%)
- materializeEvent @ index.js:1: 251 samples (9.3%)
- copyName @ index.js:1: 185 samples (6.9%)
- runCaseOnce @ profile-stream-reader-overhead.mjs:417: 143 samples (5.3%)
- copyNameSpan @ index.js:1: 140 samples (5.2%)
- tryCreateStructuralIndexParser @ index.js:1: 66 samples (2.5%)
- copyAttributes @ index.js:1: 63 samples (2.3%)

## neutral-full

- Reader kind: event
- Backend: js
- Tier: full-string
- namespaceAware: false
- Avg time: 183.61 ms
- Samples: 2631

Top focus groups:
- event materialization: 162 samples (6.2%)
- consumer checksum and accessor loop: 102 samples (3.9%)
- stream accessor copy and decode: 90 samples (3.4%)
- table navigation: 13 samples (0.5%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:328: 681 samples (25.9%)
- parseBuffer @ index.js:1: 281 samples (10.7%)
- parseStartTag @ index.js:1: 218 samples (8.3%)
- runCaseOnce @ profile-stream-reader-overhead.mjs:417: 155 samples (5.9%)
- parseEndTag @ index.js:1: 116 samples (4.4%)
- A @ index.js:1: 112 samples (4.3%)
- next @ index.js:1: 94 samples (3.6%)
- materializeEvent @ index.js:1: 75 samples (2.9%)

