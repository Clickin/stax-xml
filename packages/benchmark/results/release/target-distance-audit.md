# Target Distance Audit

Generated: 2026-06-02T14:31:35.804Z

Audits the distance from current same-contract JavaScript rows to Woodstox and quick-xml targets. This is not a benchmark run, not object-shape equivalence, and not a JavaScript runtime ceiling proof.

## Summary

- Status: classified
- Source artifact: G:\programming\stax-xml\packages\benchmark\results\release\same-contract-runtime-comparison.json
- Same-fixture JS row: `stax-raw-frame-name-id-batch-8` 152.11 MiB/s
- Woodstox and quick-xml target rows share JS baseline: true
- Same-fixture JS source/memory contract: Node/V8 `stax-raw-frame-name-id-batch-8` 152.11 MiB/s, sourceMode=file-backed-sync-iterable-byte-batches, directReadableStream=false, fullArrayBufferParserInput=false, boundedMemory=true, process-rss max 61.77 MiB
- Woodstox target: 351.56 MiB/s; 0.9x target 316.40 MiB/s; JS ratio 0.43x; remaining 164.29 MiB/s; targetMet=false
- quick-xml target: 274.63 MiB/s; 0.9x target 247.17 MiB/s; JS ratio 0.55x; remaining 95.06 MiB/s; targetMet=false

## External 1024 MiB Baseline

- stax-stream: 124.62 MiB/s (0.37x Woodstox)
- rawFrameNameId: 132.54 MiB/s (0.39x Woodstox)
- Woodstox: 337.97 MiB/s
- quick-xml: 270.26 MiB/s (0.80x Woodstox)
- 0.9x Woodstox target: 304.17 MiB/s

## quick-xml Target Rows

| Group | JS row | JS MiB/s | quick-xml artifact | quick-xml MiB/s | 0.9x MiB/s | Remaining | Target met | Caveat |
| --- | --- | ---: | --- | ---: | ---: | ---: | --- | --- |
| `file-backed-batch-size-sweep` | `stax-raw-frame-name-id-batch-8` | 152.11 | `file-backed-short-attr-value-cache-candidate.json` | 274.63 | 247.17 | 95.06 | no | same books 1024 MiB fixture family, but quick-xml reference comes from a separate candidate artifact |
| `file-backed-source-sweep` | `stax-raw-frame-name-id-chunk-32kib` | 151.70 | `file-backed-short-attr-value-cache-candidate.json` | 274.63 | 247.17 | 95.47 | no | same books 1024 MiB fixture family, but quick-xml reference comes from a separate candidate artifact |
| `file-backed-short-attr-value-cache-candidate` | `stax-raw-frame-name-id` | 147.05 | `file-backed-short-attr-value-cache-candidate.json` | 274.63 | 247.17 | 100.12 | no | same artifact quick-xml reference |
| `file-backed-trim-boundary-check-candidate` | `stax-raw-frame-name-id` | 143.35 | `file-backed-trim-boundary-check-candidate.json` | 273.74 | 246.37 | 103.02 | no | same artifact quick-xml reference |
| `file-backed-long-ascii-text-candidate` | `stax-raw-frame-name-id` | 141.29 | `file-backed-long-ascii-text-candidate.json` | 272.33 | 245.10 | 103.81 | no | same artifact quick-xml reference |
| `external-baseline-1024mib-file-sync-batches` | `stax-raw-frame-name-id` | 132.54 | `external-baseline-1024mib-file-sync-batches.json` | 270.26 | 243.23 | 110.69 | no | same artifact quick-xml reference |

## Same-Fixture Process RSS Snapshot

- Caveat: Process RSS values are same-fixture endpoint evidence, not allocation-model equivalence across Java, Rust, and JavaScript runtimes.
- JavaScript: Node/V8 `stax-raw-frame-name-id-batch-8` 152.11 MiB/s, process RSS 61.77 MiB from `file-backed-batch-size-sweep.json`
- Woodstox: Java/Woodstox `woodstox` 351.56 MiB/s, process RSS 312.71 MiB from `file-backed-trim-boundary-check-candidate.json`
- quick-xml: Rust/quick-xml `quick-xml` 274.63 MiB/s, process RSS 4.78 MiB from `file-backed-short-attr-value-cache-candidate.json`

## Findings

| ID | Classification | Summary |
| --- | --- | --- |
| `woodstox-0-9x-target-not-met` | SOURCE_FACT | Current fastest same-fixture JavaScript row is 164.29 MiB/s below the Woodstox 0.9x target. |
| `quickxml-0-9x-target-not-met` | SOURCE_FACT | Current fastest same-fixture JavaScript row is 95.06 MiB/s below the quick-xml 0.9x target. |
| `external-baseline-separate-from-candidate-target` | SOURCE_FACT | The 1024 MiB external baseline keeps stax-stream, rawFrameNameId, Woodstox, and quick-xml rows visible separately from later same-fixture candidate targets. |
| `same-fixture-targets-share-js-row` | SOURCE_FACT | Woodstox and quick-xml 0.9x target distances use the same fastest JavaScript baseline row. |
| `same-fixture-fastest-js-contract-classified` | SOURCE_FACT | The same-fixture fastest JavaScript target row is file-backed synchronous Iterable<Uint8Array[]> input, not direct ReadableStream, not full ArrayBuffer parser input, and bounded under process RSS. |
| `target-distance-not-runtime-ceiling` | SOURCE_FACT | A target-distance deficit is not proof that JavaScript runtimes have no further headroom. |

