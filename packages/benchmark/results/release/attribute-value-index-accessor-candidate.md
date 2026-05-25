# Attribute Value Index Accessor Candidate

Generated: 2026-05-25T03:20:39.152Z

This records a rejected public API probe: adding
`StreamBatch.attributeValueAtIndex(eventIndex, attrIndex)` as a numeric-only
accessor while keeping `attributeValueAt(eventIndex, number|string)`.

The candidate preserved behavior but did not improve the 1 GiB file-backed
full-string public consumer path, so the API addition was reverted.

## Candidate

- API: `StreamBatch.attributeValueAtIndex(eventIndex, attrIndex)`
- Purpose: avoid the `number|string` overload branch in numeric attribute-value hot paths
- Retained in source: no

## Source Contract

- Fixture: `packages/benchmark/test-data/node-string-return-1024mib.xml`
- Source shape: file-backed sync `Iterable<Uint8Array[]>`
- Chunk KiB: 64
- Batch size: 1
- Full-string parity: yes
- Bounded RSS gate: 512 MiB

## Rows

| Row | Throughput | Max RSS | Events | Checksum |
| --- | ---: | ---: | ---: | ---: |
| `public-baseline` | 132.56 MiB/s | 70.79 MiB | 61236571 | -716099804 |
| `public-attribute-value-index` | 131.83 MiB/s | 70.07 MiB | 61236571 | -716099804 |
| `public-no-optional-text` | 134.87 MiB/s | 70.75 MiB | 61236571 | -716099804 |
| `public-switch-dispatch` | 113.19 MiB/s | 71.29 MiB | 61236571 | -716099804 |
| `public-event-object` | 94.74 MiB/s | 137.62 MiB | 61236571 | -716099804 |

## Findings

- numeric-only-accessor-not-headroom (NEGATIVE_RESULT): The numeric-only
  `attributeValueAtIndex` accessor did not improve the file-backed full-string
  public consumer hot path in this probe.
  - `public-baseline`: 132.56 MiB/s
  - `public-attribute-value-index`: 131.83 MiB/s
  - `public-no-optional-text`: 134.87 MiB/s
  - Candidate retained in source: no
- not-runtime-ceiling-proof (SCOPE_GUARD): This rejects one API/accessor shape
  only; it does not prove public `StreamBatch` access has no remaining
  optimization headroom.

## Limits

- This artifact records a rejected implementation probe, not a retained API.
- The retained release benchmark remains `file-backed-public-consumer-shape-sweep`.
- A missing counterexample here is not a JavaScript runtime ceiling proof.
