# StreamReader Overhead Profile

Generated: 2026-04-30T12:53:01.563Z
Node: v24.15.0
V8: 13.6.233.17-node.48
File: G:\programming\stax-xml\packages\benchmark\assets\midsize.xml
Warmups: 4
Iterations: 8
Sampling interval (requested): 250 us

## Case Summary

| Case | Tier | Avg time | Event count | Checksum | CPU profile |
| --- | --- | ---: | ---: | ---: | --- |
| stream-native-count | count-only | 54.62 ms | 1013762 | 1363006435 | stream-native-count.cpuprofile |
| stream-native-full | full-string | 118.40 ms | 1013762 | -713280541 | stream-native-full.cpuprofile |
| event-native-count | count-only | 109.80 ms | 1013762 | 1363006435 | event-native-count.cpuprofile |
| event-native-full | full-string | 199.27 ms | 1013762 | -713280541 | event-native-full.cpuprofile |
| event-native-full-namespace | full-string | 232.68 ms | 1013762 | -713280541 | event-native-full-namespace.cpuprofile |
| neutral-full | full-string | 225.63 ms | 1013762 | -713280541 | neutral-full.cpuprofile |

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
- Avg time: 54.62 ms
- Samples: 799

Top focus groups:
- consumer checksum and accessor loop: 111 samples (13.9%)
- stream accessor copy and decode: 0 samples (0.0%)
- event materialization: 0 samples (0.0%)
- namespace and qname materialization: 0 samples (0.0%)

Top project-local frames:
- consumeStreamReader @ profile-stream-reader-overhead.mjs:327: 108 samples (13.5%)
- enqueueNativeBatch @ index.js:1: 4 samples (0.5%)
- drainPendingChunks @ index.js:1: 3 samples (0.4%)
- pushStreamingByteBatch @ index.js:1: 2 samples (0.3%)
- runCaseOnce @ profile-stream-reader-overhead.mjs:373: 1 samples (0.1%)
- next @ index.js:1: 1 samples (0.1%)
- g @ index.js:1: 1 samples (0.1%)
- getAttributeCount @ index.js:1: 1 samples (0.1%)

## stream-native-full

- Reader kind: stream
- Backend: native
- Tier: full-string
- Batch size: 1
- Avg time: 118.40 ms
- Samples: 1733

Top focus groups:
- consumer checksum and accessor loop: 414 samples (23.9%)
- stream accessor copy and decode: 393 samples (22.7%)
- table navigation: 3 samples (0.2%)
- event materialization: 0 samples (0.0%)

Top project-local frames:
- consumeStreamReader @ profile-stream-reader-overhead.mjs:327: 332 samples (19.2%)
- copyNameSpan @ index.js:1: 133 samples (7.7%)
- copyName @ index.js:1: 130 samples (7.5%)
- copyText @ index.js:1: 59 samples (3.4%)
- foldString @ profile-stream-reader-overhead.mjs:214: 30 samples (1.7%)
- getAttributeName @ index.js:1: 23 samples (1.3%)
- copySpan @ index.js:1: 22 samples (1.3%)
- getAttributeCount @ index.js:1: 14 samples (0.8%)

## event-native-count

- Reader kind: event
- Backend: native
- Tier: count-only
- namespaceAware: false
- Avg time: 109.80 ms
- Samples: 1565

Top focus groups:
- stream accessor copy and decode: 130 samples (8.3%)
- consumer checksum and accessor loop: 16 samples (1.0%)
- event materialization: 14 samples (0.9%)
- namespace and qname materialization: 0 samples (0.0%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:284: 277 samples (17.7%)
- readEvent @ index.js:1: 271 samples (17.3%)
- copyNameSpan @ index.js:1: 128 samples (8.2%)
- tryCreateStructuralIndexParser @ index.js:1: 68 samples (4.3%)
- readAttributes @ index.js:1: 24 samples (1.5%)
- next @ index.js:1: 16 samples (1.0%)
- materializeText @ index.js:1: 14 samples (0.9%)
- Xe @ index.js:1: 2 samples (0.1%)

## event-native-full

- Reader kind: event
- Backend: native
- Tier: full-string
- namespaceAware: false
- Avg time: 199.27 ms
- Samples: 2680

Top focus groups:
- stream accessor copy and decode: 124 samples (4.6%)
- event materialization: 24 samples (0.9%)
- consumer checksum and accessor loop: 22 samples (0.8%)
- namespace and qname materialization: 0 samples (0.0%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:284: 842 samples (31.4%)
- readEvent @ index.js:1: 388 samples (14.5%)
- copyNameSpan @ index.js:1: 123 samples (4.6%)
- tryCreateStructuralIndexParser @ index.js:1: 116 samples (4.3%)
- readAttributes @ index.js:1: 56 samples (2.1%)
- materializeText @ index.js:1: 24 samples (0.9%)
- next @ index.js:1: 22 samples (0.8%)
- Xe @ index.js:1: 14 samples (0.5%)

## event-native-full-namespace

- Reader kind: event
- Backend: native
- Tier: full-string
- namespaceAware: true
- Avg time: 232.68 ms
- Samples: 3254

Top focus groups:
- namespace and qname materialization: 301 samples (9.3%)
- stream accessor copy and decode: 274 samples (8.4%)
- event materialization: 175 samples (5.4%)
- consumer checksum and accessor loop: 25 samples (0.8%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:284: 885 samples (27.2%)
- Pe @ index.js:1: 300 samples (9.2%)
- materializeStartElement @ index.js:1: 221 samples (6.8%)
- runCaseOnce @ profile-stream-reader-overhead.mjs:373: 190 samples (5.8%)
- materializeEvent @ index.js:1: 157 samples (4.8%)
- copyNameSpan @ index.js:1: 149 samples (4.6%)
- copyName @ index.js:1: 103 samples (3.2%)
- tryCreateStructuralIndexParser @ index.js:1: 83 samples (2.6%)

## neutral-full

- Reader kind: event
- Backend: js
- Tier: full-string
- namespaceAware: false
- Avg time: 225.63 ms
- Samples: 3205

Top focus groups:
- event materialization: 185 samples (5.8%)
- consumer checksum and accessor loop: 109 samples (3.4%)
- stream accessor copy and decode: 84 samples (2.6%)
- native boundary and batch handoff: 5 samples (0.2%)

Top project-local frames:
- consumeEventReader @ profile-stream-reader-overhead.mjs:284: 752 samples (23.5%)
- parseBuffer @ index.js:1: 344 samples (10.7%)
- parseStartTag @ index.js:1: 240 samples (7.5%)
- runCaseOnce @ profile-stream-reader-overhead.mjs:373: 168 samples (5.2%)
- parseEndTag @ index.js:1: 132 samples (4.1%)
- C @ index.js:1: 122 samples (3.8%)
- next @ index.js:1: 108 samples (3.4%)
- materializeEvent @ index.js:1: 98 samples (3.1%)

