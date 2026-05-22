# Substring retention harness

This harness reproduces the chunk-level `TextDecoder` retention test used to
validate the `suffix-detach` retained-string strategy.

It decodes large `Uint8Array` chunks with `TextDecoder.decode(bytes)`, retains a
small token from the decoded chunk, then compares batch-by-batch memory slope for
these materialization methods:

- `direct`: `chunk.slice(start, end)`
- `suffix-detach`: `(chunk.slice(start, end) + "\0").slice(0, len)`
- `json-copy`: `JSON.parse(JSON.stringify(slice))`

The expected failure control is Chromium/V8 `direct`: when the parent chunk is
retained, RSS grows by roughly `chunkMiB * chunksPerBatch` per batch. The
expected production candidate is `suffix-detach`: it should stay close to the
`json-copy` hard-copy baseline without using JSON in production code.

## Commands

```bash
node packages/benchmark/substring-retention/run-retention.mjs --help
node packages/benchmark/substring-retention/run-retention.mjs --quick
node packages/benchmark/substring-retention/run-retention.mjs --stress
```

The harness imports `playwright` dynamically, so `--help` and `--dry-run` work
without the dependency. Browser runs require Playwright and installed browsers in
the benchmark environment.

Useful explicit stress run:

```bash
node packages/benchmark/substring-retention/run-retention.mjs \
  --browsers=chromium,firefox,webkit \
  --methods=direct,suffix-detach,json-copy \
  --batches=8 \
  --chunks-per-batch=20 \
  --chunk-mib=2 \
  --token-len=108 \
  --min-detach-len=0 \
  --pressure-mib=128 \
  --settle-ms=150 \
  --hold-ms=500 \
  --out=packages/benchmark/results/tmp/substring-retention.json
```

For installed Chrome instead of bundled Chromium:

```bash
node packages/benchmark/substring-retention/run-retention.mjs \
  --browsers=chromium \
  --chromium-channel=chrome \
  --methods=direct,suffix-detach,json-copy \
  --batches=8 \
  --chunks-per-batch=20 \
  --chunk-mib=2 \
  --token-len=108 \
  --out=packages/benchmark/results/tmp/chrome-substring-retention.json
```

## Result fields

Each browser/method/repeat entry includes:

- `expectedParentMiBPerBatch`: large parent chunk memory that would be retained
  per batch if every retained token pins its decoded chunk.
- `rssSlopeMiBPerBatch`: process-tree RSS slope across retained batches.
- `pageSlopeMiBPerBatch`: page memory slope when the browser exposes page memory
  APIs.
- `slopeRatioToExpectedParent`: RSS slope divided by expected parent memory.
- `finalMinusBaselineRssMiB`: final process-tree RSS minus the post-prepare
  baseline.

Interpretation:

- `direct` high, `suffix-detach` low, `json-copy` low: suffix detach works.
- `direct` low, `suffix-detach` low: this engine/config already detaches direct,
  and suffix remains safe.
- `direct` high, `suffix-detach` high, `json-copy` low: suffix detach failed for
  this engine/config.
- all high: likely RSS high-water, insufficient GC pressure, or too few batches.
