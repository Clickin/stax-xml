# StreamReader Overhead Profile

Generated: 2026-04-30T14:35:06.324Z
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
| stream-native-count | count-only | 52.81 ms | 1013762 | 1363006435 | stream-native-count.cpuprofile |
| stream-native-full | full-string | 130.76 ms | 1013762 | -713280541 | stream-native-full.cpuprofile |
| event-native-count | count-only | 123.70 ms | 1013762 | 1363006435 | event-native-count.cpuprofile |
| event-native-full | full-string | 142.32 ms | 1013762 | -713280541 | event-native-full.cpuprofile |
| event-native-full-namespace | full-string | 209.81 ms | 1013762 | -713280541 | event-native-full-namespace.cpuprofile |
| neutral-full | full-string | 176.86 ms | 1013762 | -713280541 | neutral-full.cpuprofile |

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
- Avg time: 52.81 ms
- Samples: 747

Top focus groups:
- consumer checksum and accessor loop: 126 samples (16.9%)
- stream accessor copy and decode: 0 samples (0.0%)
- event materialization: 0 samples (0.0%)
- namespace and qname materialization: 0 samples (0.0%)

Top project-local frames:
- consumeStreamReader @ profile-stream-reader-overhead.mjs:371: 126 samples (16.9%)
- enqueueNativeBatch @ index.js:1: 5 samples (0.7%)
- drainPendingChunks @ index.js:1: 4 samples (0.5%)
- createParser @ profile-stream-reader-overhead.mjs:304: 1 samples (0.1%)

## stream-native-full

- Reader kind: stream
- Backend: native
- Tier: full-string
- Batch size: 1
- Avg time: 130.76 ms
- Samples: 1869

Top focus groups:
- consumer checksum and accessor loop: 701 samples (37.5%)
- stream accessor copy and decode: 257 samples (13.8%)
- table navigation: 7 samples (0.4%)
- native boundary and batch handoff: 2 samples (0.1%)

Top project-local frames:
- foldString @ profile-stream-reader-overhead.mjs:225: 390 samples (20.9%)
- copyNameSpan @ index.js:1: 224 samples (12.0%)
- rememberBytes @ index.js:1: 191 samples (10.2%)
- consumeStreamReader @ profile-stream-reader-overhead.mjs:371: 177 samples (9.5%)
- text @ index.js:1: 105 samples (5.6%)
- copySpan @ index.js:1: 24 samples (1.3%)
- getAttributeName @ index.js:1: 13 samples (0.7%)
- getAttributeCount @ index.js:1: 9 samples (0.5%)

## event-native-count

- Reader kind: event
- Backend: native
- Tier: count-only
- namespaceAware: false
- Avg time: 123.70 ms
- Samples: 1751

Top focus groups:
- stream accessor copy and decode: 366 samples (20.9%)
- event materialization: 20 samples (1.1%)
- table navigation: 5 samples (0.3%)
- consumer checksum and accessor loop: 5 samples (0.3%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:328: 252 samples (14.4%)
- rememberString @ index.js:1: 241 samples (13.8%)
- readEvent @ index.js:1: 238 samples (13.6%)
- copySpan @ index.js:1: 176 samples (10.1%)
- copyNameSpan @ index.js:1: 127 samples (7.3%)
- tryCreateStructuralIndexParser @ index.js:1: 64 samples (3.7%)
- copyAttrValue @ index.js:1: 43 samples (2.5%)
- materializeText @ index.js:1: 20 samples (1.1%)

## event-native-full

- Reader kind: event
- Backend: native
- Tier: full-string
- namespaceAware: false
- Avg time: 142.32 ms
- Samples: 2001

Top focus groups:
- stream accessor copy and decode: 377 samples (18.8%)
- event materialization: 16 samples (0.8%)
- consumer checksum and accessor loop: 8 samples (0.4%)
- table navigation: 1 samples (0.0%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:328: 467 samples (23.3%)
- rememberString @ index.js:1: 235 samples (11.7%)
- readEvent @ index.js:1: 218 samples (10.9%)
- copyText @ index.js:1: 196 samples (9.8%)
- copyNameSpan @ index.js:1: 124 samples (6.2%)
- nextDirect @ index.js:1: 89 samples (4.4%)
- tryCreateStructuralIndexParser @ index.js:1: 62 samples (3.1%)
- copyAttrValue @ index.js:1: 43 samples (2.1%)

## event-native-full-namespace

- Reader kind: event
- Backend: native
- Tier: full-string
- namespaceAware: true
- Avg time: 209.81 ms
- Samples: 2982

Top focus groups:
- stream accessor copy and decode: 415 samples (13.9%)
- namespace and qname materialization: 333 samples (11.2%)
- event materialization: 111 samples (3.7%)
- consumer checksum and accessor loop: 3 samples (0.1%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:328: 727 samples (24.4%)
- Ve @ index.js:1: 284 samples (9.5%)
- rememberString @ index.js:1: 273 samples (9.2%)
- copyText @ index.js:1: 204 samples (6.8%)
- materializeStartElement @ index.js:1: 157 samples (5.3%)
- runCaseOnce @ profile-stream-reader-overhead.mjs:417: 123 samples (4.1%)
- copyNameSpan @ index.js:1: 121 samples (4.1%)
- materializeEndElement @ index.js:1: 118 samples (4.0%)

## neutral-full

- Reader kind: event
- Backend: js
- Tier: full-string
- namespaceAware: false
- Avg time: 176.86 ms
- Samples: 2532

Top focus groups:
- event materialization: 189 samples (7.5%)
- consumer checksum and accessor loop: 87 samples (3.4%)
- stream accessor copy and decode: 58 samples (2.3%)
- table navigation: 5 samples (0.2%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:328: 667 samples (26.3%)
- parseBuffer @ index.js:1: 279 samples (11.0%)
- parseStartTag @ index.js:1: 225 samples (8.9%)
- runCaseOnce @ profile-stream-reader-overhead.mjs:417: 147 samples (5.8%)
- k @ index.js:1: 106 samples (4.2%)
- parseEndTag @ index.js:1: 105 samples (4.1%)
- materializeEvent @ index.js:1: 104 samples (4.1%)
- next @ index.js:1: 82 samples (3.2%)

