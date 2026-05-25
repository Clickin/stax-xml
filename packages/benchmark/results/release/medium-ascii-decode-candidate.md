# Medium ASCII Decode Candidate

Generated: 2026-05-25T04:00:18.623Z

Records a rejected parser materialization probe: extending the existing short
ASCII string fast path beyond 12 bytes for `StreamReaderSync.decodeSpan()`. The
candidates preserved the same 1 GiB file-backed full-string checksum, but they
regressed the public `StreamBatch` `stax-stream` row, so the implementation was
reverted.

## Source Contract

- Fixture: `packages/benchmark/test-data/node-string-return-1024mib.xml`
- Source mode: file-backed sync `Iterable<Uint8Array[]>`
- Chunk KiB: 16
- Batch size: 1
- Event count: 61236571
- Checksum: -716099804
- Bounded RSS gate: 512 MiB

## Rows

| Row | Implementation | Throughput | Bounded | Events | Checksum |
| --- | --- | ---: | --- | ---: | ---: |
| `baseline-stax-stream` | current TextDecoder-backed path | 135.78 MiB/s | yes | 61236571 | -716099804 |
| `medium-ascii-concat-stax-stream` | ASCII spans up to 64 bytes via repeated `String.fromCharCode` concatenation | 129.65 MiB/s | yes | 61236571 | -716099804 |
| `medium-ascii-spread-stax-stream` | ASCII-check then `String.fromCharCode(...buffer.subarray(start, end))` | 105.40 MiB/s | yes | 61236571 | -716099804 |
| `baseline-raw-frame-name-id` | current raw-frame name-id path | 136.71 MiB/s | yes | 61236571 | -716099804 |
| `medium-ascii-concat-raw-frame-name-id` | ASCII spans up to 64 bytes via repeated `String.fromCharCode` concatenation | 140.59 MiB/s | yes | 61236571 | -716099804 |
| `medium-ascii-spread-raw-frame-name-id` | ASCII-check then `String.fromCharCode(...buffer.subarray(start, end))` | 136.51 MiB/s | yes | 61236571 | -716099804 |

## Findings

- medium-ascii-decode-regresses-public-stream (NEGATIVE_RESULT): Extending the
  ASCII fast path beyond short names did not improve the public `StreamBatch`
  full-string row; the best public candidate was slower than the current
  TextDecoder-backed path.
  - baseline stax-stream=135.78 MiB/s
  - medium-ascii-concat stax-stream=129.65 MiB/s
  - medium-ascii-spread stax-stream=105.40 MiB/s
- raw-frame-noise-not-api-headroom (SCOPE_GUARD): The concat probe's raw-frame
  row was faster in a single run, but that path does not exercise
  `StreamBatch.textAt()`/`attributeValueAt()` materialization in the same way
  and did not justify keeping a public-path regression.
- not-runtime-ceiling-proof (SCOPE_GUARD): This rejects one JavaScript string
  materialization tactic only; it is not evidence that `TextDecoder` or JS
  runtimes have no remaining optimization headroom.

## Limits

- This is a single-run candidate probe, not a multi-run variance study.
- It intentionally does not introduce Node `Buffer`.
- It is not a JavaScript runtime ceiling proof.
