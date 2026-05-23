# V8 String Limit Audit

Generated: 2026-05-23T12:50:00.476Z

## Scope

This audit pins the complete JS string input boundary for the current Node/V8 benchmark runtime. It is not a byte-batch runtime ceiling and not a 200 MiB/s impossibility proof.

## Runtime Limit

- Node: v24.15.0
- V8: 13.6.233.17-node.48
- MAX_STRING_LENGTH: 536,870,888 UTF-16 code units
- V8 64-bit formula: (1 << 29) - 24 = 536,870,888
- Formula match: yes
- Over-limit probe: RangeError: Invalid string length

## Fixture Projections

| Size | Actual UTF-8 | String code units | Estimated UTF-16 | Over MAX_STRING_LENGTH? |
| --- | ---: | ---: | ---: | --- |
| 512 MiB | 512.0 MiB | 536,122,798 | 1022.6 MiB | no |
| 1024 MiB | 1024.0 MiB | 1,072,245,626 | 2045.1 MiB | yes, +535,374,738 code units |

## EventReaderSync Release Row

- Artifact: G:\programming\stax-xml\packages\benchmark\results\release\event-reader-string-large.json
- Contract: event-reader-sync-string-input-full-object-materialization
- Largest successful row: 512 MiB at 74.19 MiB/s
- Largest successful string code units: 536,122,798
- Code-unit headroom below MAX_STRING_LENGTH: 748,090
- Peak RSS on largest successful row: 1.07 GiB
- Failed release row: 1024 MiB with RangeError: Invalid string length

## Source Facts

| ID | Source | Fact |
| --- | --- | --- |
| `node-buffer-docs-max-string-length` | https://nodejs.org/docs/latest-v24.x/api/buffer.html#bufferconstantsmax_string_length | Node documents buffer.constants.MAX_STRING_LENGTH as the largest single string length in UTF-16 code units and engine-dependent. |
| `node-v24-buffer-js-constant` | https://github.com/nodejs/node/blob/v24.15.0/lib/buffer.js#L166-L168 | Node v24.15.0 exposes MAX_STRING_LENGTH from internal binding kStringMaxLength. |
| `node-v24-buffer-cc-binding` | https://github.com/nodejs/node/blob/v24.15.0/src/node_buffer.cc#L1665-L1666 | Node v24.15.0 sets kStringMaxLength to v8::String::kMaxLength. |
| `node-v24-v8-string-kmaxlength` | https://github.com/nodejs/node/blob/v24.15.0/deps/v8/include/v8-primitive.h#L126-L127 | Vendored V8 defines v8::String::kMaxLength as (1 << 28) - 16 on 32-bit API pointers and (1 << 29) - 24 otherwise. |
| `node-v24-v8-string-creation-guard` | https://github.com/nodejs/node/blob/v24.15.0/deps/v8/include/v8-primitive.h#L534-L546 | V8 public string allocation APIs document empty results when length exceeds kMaxLength. |
| `node-v24-v8-external-string-lifetime` | https://github.com/nodejs/node/blob/v24.15.0/deps/v8/include/v8-primitive.h#L435-L439 | V8 external one-byte strings require immutable Latin-1 external data, not arbitrary UTF-8 parser spans. |

## Findings

### node-v8-single-string-limit

Current Node/V8 exposes a single JS string maximum matching v8::String::kMaxLength.

- MAX_STRING_LENGTH=536870888
- formula64Bit=(1 << 29) - 24
- over-limit probe=RangeError: Invalid string length

### event-reader-complete-string-boundary

The EventReaderSync complete-string input path reaches this string boundary before parsing 1 GiB input.

- largest successful release row=512 MiB
- 1024 MiB projection exceeds MAX_STRING_LENGTH by 535,374,738 code units
- 1024 MiB release row=Invalid string length

### scope-boundary

This is a complete-string EventReaderSync input invariant, not a byte-batch runtime ceiling.

- It does not apply to StreamReaderSync byte batches that never build one full XML string.
- It is not a 200 MiB/s impossibility proof.

## Interpretation

The complete-string `EventReaderSync` path has a pinned Node/V8 failure mechanism for 1 GiB generated input: it must first construct one JS string, and the projected string length exceeds the current runtime `MAX_STRING_LENGTH` before parsing starts.

This does not cover Bun/JSC or browser engines, and it does not prove that pure JavaScript byte-batch readers cannot find more throughput headroom. A 200 MiB/s+ bounded-memory `StreamReaderSync` row would still be a counterexample to the broader runtime-limit hypothesis.
