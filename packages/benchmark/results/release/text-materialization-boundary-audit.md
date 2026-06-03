# Text Materialization Boundary Audit

Generated: 2026-06-03T09:14:28.811Z

Audits the current text/CDATA materialization boundary from the same-contract aggregate. This is not a benchmark run and does not prove a JavaScript runtime ceiling.

## Summary

- Status: classified
- Source artifact: G:\programming\stax-xml\packages\benchmark\results\release\same-contract-runtime-comparison.json
- Frontier artifact: text-materialization-frontier.json
- Target: 200.00 MiB/s
- Fastest full-string row: `rawFrameNameId` 185.50 MiB/s from `text-trim-cost-decomposition.json` (boundedMemory=true, fullStringParity=true, textStringReads=16987392, stringFieldReads=62758976)
- Fastest without-text row: `withoutTextStrings` 252.36 MiB/s from `text-trim-cost-decomposition-4gib.json` (boundedMemory=true, fullStringParity=false, textStringReads=0, stringFieldReads=183085948)
- Fastest no-trim row: `rawFrameNameIdNoTrim` 186.97 MiB/s from `text-trim-cost-decomposition-8gib.json` (boundedMemory=true, fullStringParity=false, textStringReads=135898776, stringFieldReads=502070478)
- Fastest fold-trim row: `rawFrameNameIdFoldTrim` 148.58 MiB/s from `text-trim-cost-decomposition-2gib.json` (boundedMemory=true, fullStringParity=true, textStringReads=33974712, stringFieldReads=125517686)
- Full-string remaining to target: 14.50 MiB/s
- Required full-string speedup: 1.08x
- Without-text to full ratio: 1.36x
- No-trim to full ratio: 1.01x
- Fold-trim to full ratio: 0.80x
- Full-string rows crossing target: 0
- Without-text rows crossing target: 4
- No-trim rows crossing target: 0
- Fold-trim rows crossing target: 0
- Negative candidate count: 38

## Findings

| ID | Classification | Summary |
| --- | --- | --- |
| `full-string-target-not-crossed` | SOURCE_FACT | Current full-string rows crossing 200 MiB/s: 0. |
| `without-text-is-partial-headroom` | SOURCE_FACT | Text/CDATA omission crosses the target in 4 rows but is not full-string parity. |
| `trim-only-not-counterexample` | SOURCE_FACT | No no-trim or fold-trim row crosses the target under the current frontier. |
| `negative-candidate-set-recorded` | SOURCE_FACT | 38 text/materialization candidates are recorded as negative or partial frontier evidence. |

Interpretation: Text/CDATA omission crosses the target as headroom evidence, while trim-only, fold-trim, cache, and ASCII candidates remain negative for the current full-string contract.

