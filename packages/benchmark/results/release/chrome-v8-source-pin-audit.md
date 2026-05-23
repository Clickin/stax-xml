# Chrome V8 Source Pin Audit

Generated: 2026-05-23T21:38:08.516Z

This report is a SOURCE_FACT for one Chromium/V8 revision and browser artifact.
It pins string-boundary source lines for the Chrome/V8 browser string-limit audit; it is not a throughput proof.

## Environment

- Browser: Chrome/148.0.7778.179
- V8: 14.8.178.22
- Repository: v8/v8
- Revision: refs/tags/14.8.178.22
- Path: include/v8-primitive.h
- Source URL: https://chromium.googlesource.com/v8/v8/+/refs/tags/14.8.178.22/include/v8-primitive.h?format=TEXT

## Derived Boundary

- String::kMaxLength x64 formula: `(1 << 29) - 24`
- String::kMaxLength x64 code units: 536,870,888
- Projected 1024 MiB browser audit code units: 1,072,245,626
- Projected excess code units: 535,374,738

## Anchors

| Anchor | Status | Line |
| --- | --- | ---: |
| kMaxLength | found | 126 |
| newFromUtf8 | found | 485 |
| externalResourceDispose | found | 300 |
| newExternalOneByte | found | 550 |

## Source Context

### kMaxLength

- 124: `class V8_EXPORT String : public Name {`
- 125: `public:`
- 126: `static constexpr int kMaxLength =`
- 127: `internal::kApiSystemPointerSize == 4 ? (1 << 28) - 16 : (1 << 29) - 24;`
- 128: ``

### newFromUtf8

- 483: `/** Allocates a new string from UTF-8 data. Only returns an empty value when`
- 484: `* length > kMaxLength. **/`
- 485: `static V8_WARN_UNUSED_RESULT MaybeLocal<String> NewFromUtf8(`
- 486: `Isolate* isolate, const char* data,`
- 487: `NewStringType type = NewStringType::kNormal, int length = -1);`

### externalResourceDispose

- 298: ``
- 299: `/**`
- 300: `* Internally V8 will call this Dispose method when the external string`
- 301: `* resource is no longer needed. The default implementation will use the`
- 302: `* delete operator. This method can be overridden in subclasses to`

### newExternalOneByte

- 548: `* destructor of the external string resource.`
- 549: `*/`
- 550: `static V8_WARN_UNUSED_RESULT MaybeLocal<String> NewExternalOneByte(`
- 551: `Isolate* isolate, ExternalOneByteStringResource* resource);`
- 552: ``

## Findings

- browser-v8-string-max-length-source-pin (SOURCE_FACT): The exact Chromium/V8 source used by the browser artifact pins String::kMaxLength to the 64-bit V8 formula used by the browser string-limit audit.
  - String::kMaxLength line 126
  - x64 formula resolves to 536,870,888 UTF-16 code units.
- new-from-utf8-allocating-api-boundary (SOURCE_FACT): The V8 public UTF-8 string creation API is pinned at this revision for source-level string-boundary discussion.
  - String::NewFromUtf8 line 485
- external-string-resource-lifetime-boundary (SOURCE_FACT): The external-string API remains a resource-lifetime contract, not a portable parser-owned byte-span-to-primitive-string escape hatch.
  - External resource Dispose line 300
  - NewExternalOneByte line 550
- source-pin-not-throughput-proof (SOURCE_FACT_LIMIT): Source-line pinning constrains string-size and ownership claims, but it does not prove that Chrome/V8 or JavaScript runtimes have no remaining performance headroom.
  - Keep runtime-limit claims below CONCLUSION until broader counterexample searches and runtime traces are complete.
