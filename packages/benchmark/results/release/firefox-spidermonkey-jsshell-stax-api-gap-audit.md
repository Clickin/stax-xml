# Firefox/SpiderMonkey JS Shell StAX API Gap Audit

Generated: 2026-06-03T04:55:55.191Z

Synthesizes the official release/nightly SpiderMonkey js-shell API probes against the unchanged current full-string stax benchmark surface. This is not benchmark evidence, emitted JIT IR, optimized-code evidence, or a runtime-limit conclusion.

## Summary

- Status: blocked-by-host-api-surface
- Shells checked: 2
- Available shells: 2
- JIT-status shells: 2
- Binary-readable shells: 2
- Unchanged current StAX full-string runnable shells: 0
- Common missing globals: TextEncoder, ReadableStream, fetch
- Primary sync byte-batch missing globals: none
- Non-primary harness missing globals: TextEncoder, ReadableStream, fetch
- Blocked current StAX surfaces: 3/5
- Direct unchanged harness attempts blocked before StAX load: 6/10
- Closes emitted IR obligation: no
- Runtime-limit conclusion allowed: no

## Shells

| Shell | Version | JIT status | Binary input | Missing required globals | Current benchmark unchanged |
| --- | --- | --- | --- | --- | --- |
| release | JavaScript-C143.0.1 | yes | ok | TextEncoder, ReadableStream, fetch | no |
| nightly | JavaScript-C153.0a1 | yes | ok | TextEncoder, ReadableStream, fetch | no |

## Required Globals

| Global | Expected | Reason |
| --- | --- | --- |
| TextEncoder | function | Generated-fixture and string-input convenience harness paths encode XML strings into Uint8Array fixtures; corpus byte-batch reader rows do not require it. |
| ReadableStream | function | Browser-compatible source paths and unchanged harness checks expect Web Streams. |
| fetch | function | Browser-compatible live source rows and unchanged harness checks expect fetch. |
| Uint8Array | function | Neutral byte-batch parser input is Uint8Array-based. |

## Blocked StAX Surfaces

| Surface | Contract | Required globals | Blocked shells | Missing globals |
| --- | --- | --- | ---: | --- |
| StreamReaderSync generated-fixture Iterable<Uint8Array[]> full-string rows | Generated-fixture same-contract StAX rows over synchronous byte batches. | Uint8Array, TextEncoder | 2/2 | TextEncoder |
| StreamReaderSync corpus-file Iterable<Uint8Array[]> full-string rows | Corpus-file same-contract StAX rows over synchronous byte batches. | Uint8Array | 0/2 | none |
| createEventReaderFromAsyncByteBatches full-string rows | Async byte-batch public event rows without direct ReadableStream consumption. | Uint8Array | 0/2 | none |
| EventReader ReadableStream<Uint8Array> full-string rows | Direct Web ReadableStream source-overhead rows. | Uint8Array, ReadableStream | 2/2 | ReadableStream |
| browser fetch live-source rows | Live fetch Response.body rows such as fetchReadableStreamFull and fetchAsyncByteBatchFull. | Uint8Array, ReadableStream, fetch | 2/2 | ReadableStream, fetch |

## Direct Unchanged Harness Attempts

| Shell | Surface | Status | First blocking global | Missing globals |
| --- | --- | --- | --- | --- |
| release | sync-byte-batch-full-string | blocked-before-stax-load | TextEncoder | TextEncoder |
| release | sync-corpus-byte-batch-full-string | runnable-prerequisites-present | none | none |
| release | async-byte-batch-full-string | runnable-prerequisites-present | none | none |
| release | readable-stream-full-string | blocked-before-stax-load | ReadableStream | ReadableStream |
| release | browser-fetch-live-source | blocked-before-stax-load | ReadableStream | ReadableStream, fetch |
| nightly | sync-byte-batch-full-string | blocked-before-stax-load | TextEncoder | TextEncoder |
| nightly | sync-corpus-byte-batch-full-string | runnable-prerequisites-present | none | none |
| nightly | async-byte-batch-full-string | runnable-prerequisites-present | none | none |
| nightly | readable-stream-full-string | blocked-before-stax-load | ReadableStream | ReadableStream |
| nightly | browser-fetch-live-source | blocked-before-stax-load | ReadableStream | ReadableStream, fetch |

## Findings

- spidermonkey-jsshell-api-gap (NEGATIVE_RESULT): The official release and nightly SpiderMonkey js-shells are executable and can read binary XML. Current UTF-8 primary byte-batch StAX materialization requires only Uint8Array host support; generated fixture, string-input convenience, Web stream, and live-source harness surfaces still lack their own Web-compatible globals.
  - commonMissingGlobals=TextEncoder, ReadableStream, fetch
  - primarySyncByteBatchMissingGlobals=none
  - nonPrimaryHarnessMissingGlobals=TextEncoder, ReadableStream, fetch
  - blockedSurfaces=3/5
  - directUnchangedHarnessAttemptsBlocked=6/10
  - unchangedRunnableShells=0/2
- spidermonkey-jsshell-api-gap-scope (SCOPE_GUARD): This gap is a host API surface fact, not a SpiderMonkey throughput limit or emitted-code proof.
  - Adding a polyfill or alternate decoder would create a different harness surface and must not be counted as the unchanged current StAX full-string benchmark.
  - Corpus-file UTF-8 byte-batch rows do not require TextEncoder when binary input is read directly by the shell, and current public full-string materialization no longer requires host TextDecoder.
  - A diagnostic-capable shell or Firefox build can still close the emitted IR/codegen obligation.

