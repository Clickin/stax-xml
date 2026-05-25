# Attribute Value Public Fast Path Candidate

Generated: 2026-05-25T04:10:31.876Z

Records a rejected internal hot-path probe: keeping the public `StreamBatch`
API unchanged while adding a source-level
`copyAttrValueForPublic(eventIndex, attrIndex)` method to combine
implicit-attribute handling and value materialization. The candidate preserved
the 1 GiB file-backed full-string checksum but regressed both public
`StreamBatch` and raw-frame rows, so the source change was reverted.

## Source Contract

- Fixture: `packages/benchmark/test-data/node-string-return-1024mib.xml`
- Source mode: file-backed sync `Iterable<Uint8Array[]>`
- Chunk KiB: 16
- Batch size: 1
- Event count: 61236571
- Checksum: -716099804
- Bounded RSS gate: 512 MiB
- Public API change: none
- Candidate retained in source: no

## Rows

| Row | Throughput | Baseline | Delta | Bounded | Events | Checksum |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| `stax-stream` | 118.15 MiB/s | 135.78 MiB/s | -17.63 MiB/s | yes | 61236571 | -716099804 |
| `stax-raw-frame-name-id` | 126.96 MiB/s | 136.71 MiB/s | -9.75 MiB/s | yes | 61236571 | -716099804 |

## Findings

- combined-attribute-value-path-regresses (NEGATIVE_RESULT): Combining
  implicit-attribute handling and value materialization behind a new internal
  source method made the file-backed public full-string path slower.
  - baseline stax-stream=135.78 MiB/s
  - candidate stax-stream=118.15 MiB/s
  - baseline rawFrameNameId=136.71 MiB/s
  - candidate rawFrameNameId=126.96 MiB/s
- not-public-api-headroom (SCOPE_GUARD): This rejects one internal dispatch
  shape only; it does not prove that `StreamBatch` attribute access has no
  remaining optimization headroom.

## Limits

- This is a single-run 1 GiB file-backed probe.
- It does not change or remove the existing `attributeValueAt(number|string)`
  public API.
- It is not a JavaScript runtime ceiling proof.
