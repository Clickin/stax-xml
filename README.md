# Experiment archive

`archive/experiments` is a long-lived, append-only evidence store with archive-only history. It is not a current product checkout.

Before proposing a performance hypothesis, a coding or research agent must fetch `origin/archive/experiments`, search [INDEX.md](INDEX.md), and read the closest experiment's decision record. State what is genuinely different before proposing new work.

## Eligible results

Archive **NO-GO**, **INCONCLUSIVE after the prescribed evidence budget**, or **ABANDONED because a premise was disproven**. Do not describe successful product work as a failed experiment.

Each entry must provide:

- Baseline SHA, hypothesis, closest prior experiment, and what is genuinely different.
- Original candidate patch and benchmark/reproduction harness.
- Raw statistical inputs, correctness result, performance result, and rejection reason.
- A narrow evidence-based reconsideration trigger and a SHA-256 manifest.
- Explicit unavailable artifacts, deliberate omissions, and the difference between failed and unexecuted gates.

## Preservation rules

Use `experiments/YYYY-MM-DD-topic/`. Preserve original evidence byte-for-byte, with source-to-archive paths and hashes. Prefer raw statistical inputs and patches over reproducible binaries or duplicated source trees. Keep unavailable artifacts explicit; do not reconstruct patches from memory or rerun a rejected experiment to fill gaps.

Existing experiment entries are immutable. Add a separately identified correction/supplement referring to the original entry if necessary; retain the original evidence. Append discoveries and links to INDEX.md. Follow-up hypotheses receive new IDs and cite their predecessor.

Use a dedicated archive worktree. Commit and push only the archive branch, by ordinary fast-forward pushes. Never merge this branch into master, open a PR from it to master, put these archive files into a product branch, or merge master here to keep the archive current. Do not mix product fixes into archive commits. Source patches are evidence, not adopted code.

Each experiment's SHA256SUMS covers every file beneath its directory except SHA256SUMS itself. The Git commit identifies the checksum file and top-level policy/index. Verify checksums before publishing and verify the remote ref after pushing.

The archive's `.gitattributes` disables text conversion so Git preserves original line endings. Compare staged/committed blobs with source hashes, not only working files. Transport-corruption repairs must restore the original bytes and add an indexed correction record retaining the prior commit; they must not reinterpret experimental results.
