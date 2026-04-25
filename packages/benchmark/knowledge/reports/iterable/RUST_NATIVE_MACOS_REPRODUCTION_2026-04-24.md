# Rust Native Aggregate macOS Reproduction

Generated: 2026-04-24

## Scope

This document is for reproducing the benchmark-only Rust/N-API aggregate spike
on Apple Silicon. It intentionally keeps two separate lanes:

1. macOS arm64 host.
2. Linux arm64 running inside an Apple Virtualization Framework VM.

Do not mix the two environments in one checkout. Clone the branch separately in
each environment, build the native addon locally, and keep the generated reports
from each lane separate.

Branch:

`spike/rust-native-chunk-aggregate`

Primary gate:

`full-string-direct` and `event-object-full` over
`quoted-gt,attr-heavy,high-cardinality,mixed-utf8`.

`count-only` remains diagnostic only.

## Shared Requirements

- Apple Silicon machine.
- Native arm64 terminal. Do not run under Rosetta.
- Node.js 24.x, or record the exact Node version if different.
- pnpm through Corepack.
- Rust stable toolchain for the local target.
- Enough free disk for generated 128 MiB and optional 512 MiB fixtures.

Record environment metadata before each run:

```bash
date -u
uname -a
node --version
corepack pnpm --version
rustc -Vv
cargo --version
git rev-parse HEAD
git status --short
```

## macOS arm64 Host Lane

Use a normal APFS checkout on the macOS host. Avoid network filesystems and
shared VM folders.

```bash
git clone https://github.com/Clickin/stax-xml.git stax-xml-native-macos
cd stax-xml-native-macos
git checkout spike/rust-native-chunk-aggregate

corepack enable
corepack pnpm install
corepack pnpm --filter stax-xml build
corepack pnpm --filter benchmark run build:native-aggregate
corepack pnpm --filter benchmark run smoke:native-aggregate
```

Run the representative gate:

```bash
node --expose-gc packages/benchmark/rust-native-chunk-aggregate.mjs \
  --sizes-mib 16,128 \
  --fixtures quoted-gt,attr-heavy,high-cardinality,mixed-utf8 \
  --tiers full-string-direct,event-object-full \
  --scenarios js-node,native-buffer,native-file \
  --runs 3 \
  --warmups 1 \
  --no-progress
```

Run the optional 512 MiB confirmation only if 128 MiB passes:

```bash
node --expose-gc packages/benchmark/rust-native-chunk-aggregate.mjs \
  --sizes-mib 512 \
  --fixtures quoted-gt,attr-heavy,high-cardinality,mixed-utf8 \
  --tiers full-string-direct \
  --scenarios js-node,native-buffer,native-file \
  --runs 2 \
  --warmups 1 \
  --no-progress
```

Expected native artifact:

`packages/benchmark/native/rust-aggregate/stax_xml_native_aggregate.node`

The build script copies it from:

`packages/benchmark/native/rust-aggregate/target/release/libstax_xml_native_aggregate.dylib`

## Linux arm64 Apple Virtualization VM Lane

Use a Linux arm64 VM backed by Apple's Virtualization Framework. Examples are
tools that expose Apple's `vz` virtualization backend. The exact VM manager is
less important than these constraints:

- Linux guest architecture is arm64/aarch64.
- The repo is cloned onto the guest's native filesystem.
- Benchmarks are not run from a shared macOS folder.
- CPU and memory allocation are recorded.
- Node, pnpm, and Rust versions are recorded separately from the host lane.

Inside the Linux guest:

```bash
git clone https://github.com/Clickin/stax-xml.git stax-xml-native-linux-vm
cd stax-xml-native-linux-vm
git checkout spike/rust-native-chunk-aggregate

corepack enable
corepack pnpm install
corepack pnpm --filter stax-xml build
corepack pnpm --filter benchmark run build:native-aggregate
corepack pnpm --filter benchmark run smoke:native-aggregate
```

Record Linux-specific metadata:

```bash
uname -a
lscpu
free -h
df -h .
node --version
corepack pnpm --version
rustc -Vv
cargo --version
```

Run the same representative gate:

```bash
node --expose-gc packages/benchmark/rust-native-chunk-aggregate.mjs \
  --sizes-mib 16,128 \
  --fixtures quoted-gt,attr-heavy,high-cardinality,mixed-utf8 \
  --tiers full-string-direct,event-object-full \
  --scenarios js-node,native-buffer,native-file \
  --runs 3 \
  --warmups 1 \
  --no-progress
```

Expected native artifact:

`packages/benchmark/native/rust-aggregate/stax_xml_native_aggregate.node`

The build script copies it from:

`packages/benchmark/native/rust-aggregate/target/release/libstax_xml_native_aggregate.so`

## Interpreting Results

- Use `native-buffer` as the primary product-direction signal because it
  isolates parser/materialization work after Node has the bytes.
- Use `native-file` only as ingestion context. VM storage and host storage can
  differ too much for it to be the main gate.
- Keep macOS and Linux VM reports separate. Do not average them.
- A valid run must preserve event count and checksum parity for every fixture,
  tier, and scenario.
- If `native-buffer` wins only in one environment, inspect generated assembly
  and CPU feature selection before treating the result as portable.

Reports are emitted under:

`packages/benchmark/knowledge/reports/iterable/`

Attach the JSON and Markdown report pairs for both lanes when comparing.
