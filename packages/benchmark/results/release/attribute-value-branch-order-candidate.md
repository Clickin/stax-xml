# Attribute Value Branch Order Candidate

Generated: 2026-05-25T03:08:41.147Z

This records a rejected implementation probe: moving the numeric
`attributeValueAt(eventIndex, attrIndexOrName)` overload branch ahead of the
string-name overload in `StreamBatchView`.

The candidate was measured over the same 1 GiB file-backed public consumer
sweep and then reverted because it did not produce headroom.

## Candidate

- File: `packages/stax-xml/src/stream-reader-core.ts`
- Method: `StreamBatchView.attributeValueAt(eventIndex, attrIndexOrName)`
- Change: number-first branch instead of string-first branch
- Retained in source: no

## Source Contract

- Fixture: `packages/benchmark/test-data/node-string-return-1024mib.xml`
- Source shape: file-backed sync `Iterable<Uint8Array[]>`
- Chunk KiB: 64
- Batch size: 1
- Full-string parity: yes
- Bounded RSS gate: 512 MiB

## Rows

| Row | Before candidate | With candidate | Max RSS with candidate | Events | Checksum |
| --- | ---: | ---: | ---: | ---: | ---: |
| `public-baseline` | 130.37 MiB/s | 125.95 MiB/s | 70.94 MiB | 61236571 | -716099804 |
| `public-no-optional-text` | 133.67 MiB/s | 114.80 MiB/s | 70.90 MiB | 61236571 | -716099804 |
| `public-switch-dispatch` | n/a | 112.72 MiB/s | 70.70 MiB | 61236571 | -716099804 |
| `public-event-object` | n/a | 94.76 MiB/s | 138.17 MiB | 61236571 | -716099804 |

## Findings

- branch-order-not-headroom (NEGATIVE_RESULT): Putting the numeric
  `attributeValueAt` branch first did not expose file-backed full-string public
  consumer headroom in this probe.
  - `public-baseline`: 130.37 MiB/s before candidate, 125.95 MiB/s with candidate
  - `public-no-optional-text`: 133.67 MiB/s before candidate, 114.80 MiB/s with candidate
  - Candidate retained in source: no
- not-runtime-ceiling-proof (SCOPE_GUARD): This negative result rejects one
  small branch-order candidate only; it is not evidence that public
  `StreamBatch` access cannot be improved.

## Limits

- This artifact records a rejected implementation probe, not a new accepted
  runtime row.
- The retained release benchmark remains `file-backed-public-consumer-shape-sweep`.
- A missing counterexample here is not a JavaScript runtime ceiling proof.
