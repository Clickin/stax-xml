# Firefox/SpiderMonkey JS Shell StAX API Gap Audit

Generated: 2026-06-01T01:40:32.803Z

Synthesizes the official release/nightly SpiderMonkey js-shell API probes against the unchanged current full-string stax benchmark surface. This is not benchmark evidence, emitted JIT IR, optimized-code evidence, or a runtime-limit conclusion.

## Summary

- Status: blocked-by-host-api-surface
- Shells checked: 2
- Available shells: 2
- JIT-status shells: 2
- Binary-readable shells: 2
- Unchanged current StAX full-string runnable shells: 0
- Common missing globals: TextDecoder, TextEncoder, ReadableStream, fetch
- Blocked current StAX surfaces: 4/4
- Closes emitted IR obligation: no
- Runtime-limit conclusion allowed: no

## Shells

| Shell | Version | JIT status | Binary input | Missing required globals | Current benchmark unchanged |
| --- | --- | --- | --- | --- | --- |
| release | JavaScript-C143.0.1 | yes | ok | TextDecoder, TextEncoder, ReadableStream, fetch | no |
| nightly | JavaScript-C143.0a1 | yes | ok | TextDecoder, TextEncoder, ReadableStream, fetch | no |

## Required Globals

| Global | Expected | Reason |
| --- | --- | --- |
| TextDecoder | function | Full-string rows materialize UTF-8 XML spans as JavaScript strings. |
| TextEncoder | function | Current generated-fixture and harness paths encode XML strings into Uint8Array fixtures. |
| ReadableStream | function | Browser-compatible source paths and unchanged harness checks expect Web Streams. |
| fetch | function | Browser-compatible live source rows and unchanged harness checks expect fetch. |
| Uint8Array | function | Neutral byte-batch parser input is Uint8Array-based. |

## Blocked StAX Surfaces

| Surface | Contract | Required globals | Blocked shells | Missing globals |
| --- | --- | --- | ---: | --- |
| StreamReaderSync Iterable<Uint8Array[]> full-string rows | Primary same-contract StAX rows over synchronous byte batches. | Uint8Array, TextDecoder, TextEncoder | 2/2 | TextDecoder, TextEncoder |
| createEventReaderFromAsyncByteBatches full-string rows | Async byte-batch public event rows without direct ReadableStream consumption. | Uint8Array, TextDecoder | 2/2 | TextDecoder |
| EventReader ReadableStream<Uint8Array> full-string rows | Direct Web ReadableStream source-overhead rows. | Uint8Array, TextDecoder, ReadableStream | 2/2 | TextDecoder, ReadableStream |
| browser fetch live-source rows | Live fetch Response.body rows such as fetchReadableStreamFull and fetchAsyncByteBatchFull. | Uint8Array, TextDecoder, ReadableStream, fetch | 2/2 | TextDecoder, ReadableStream, fetch |

## Findings

- spidermonkey-jsshell-api-gap (NEGATIVE_RESULT): The official release and nightly SpiderMonkey js-shells are executable and can read binary XML, but both lack required Web-compatible globals for the current full-string stax benchmark unchanged.
  - commonMissingGlobals=TextDecoder, TextEncoder, ReadableStream, fetch
  - blockedSurfaces=4/4
  - unchangedRunnableShells=0/2
- spidermonkey-jsshell-api-gap-scope (SCOPE_GUARD): This gap is a host API surface fact, not a SpiderMonkey throughput limit or emitted-code proof.
  - Adding a polyfill or alternate decoder would create a different harness surface and must not be counted as the unchanged current StAX full-string benchmark.
  - A diagnostic-capable shell or Firefox build can still close the emitted IR/codegen obligation.

