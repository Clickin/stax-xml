# Rust Native Chunk-Aggregate arm64 Lanes

Generated: 2026-04-24

## Scope

This records the representative gate rerun for
`spike/rust-native-chunk-aggregate` on separate macOS and Linux arm64 lanes.
The Linux lane used a fresh clone on the VM-local ext4 filesystem, not a shared
macOS mount.

Commit:

`04bbff9cdf62718fc542298f54d05e420f82b71a`

Command:

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

## macOS arm64 Host

- Checkout: `/Users/senghyunjo/github/stax-xml`
- Kernel: `Darwin Seunghyun-MacBook-Pro.local 25.3.0 ... RELEASE_ARM64_T8132 arm64`
- Node: `v24.15.0`
- pnpm: `10.18.0`
- Rust: `rustc 1.95.0 (59807616e 2026-04-14)`, host `aarch64-apple-darwin`
- Cargo: `cargo 1.95.0 (f2d3ce0bd 2026-03-21)`
- C compiler: `Apple clang version 16.0.0 (clang-1600.0.26.6)`
- Gate: `pass`
- 128 MiB `full-string-direct`: 4/4 fixture wins at >=20%
- 128 MiB `event-object-full`: 4/4 fixture wins at >=10%
- Raw JSON: `RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T15-08-11-110Z.json`
- Markdown: `RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T15-08-11-110Z.md`

## Linux arm64 VM

- VM: Lima `default`, 4 CPUs, 4 GiB memory
- Checkout: `/home/senghyunjo.linux/stax-xml-native-linux-vm`
- Filesystem: `/dev/vda1` ext4, 96 GiB total, 85 GiB free after run
- Kernel: `Linux lima-default 6.5.0-42-generic #42-Ubuntu SMP PREEMPT_DYNAMIC Mon Jun 10 11:33:25 UTC 2024 aarch64`
- CPU: 4 x `Cortex-A72`
- Node: `v24.15.0` installed via `nvm`
- pnpm: `10.18.0`
- Rust: `rustc 1.95.0 (59807616e 2026-04-14)`, host `aarch64-unknown-linux-gnu`, installed via `rustup`
- Cargo: `cargo 1.95.0 (f2d3ce0bd 2026-03-21)`
- C compiler: `cc (Ubuntu 13.2.0-4ubuntu3) 13.2.0`
- Gate: `pass`
- 128 MiB `full-string-direct`: 4/4 fixture wins at >=20%
- 128 MiB `event-object-full`: 4/4 fixture wins at >=10%
- Raw JSON: `RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T15-16-45-159Z.json`
- Markdown: `RUST_NATIVE_CHUNK_AGGREGATE_2026-04-24T15-16-45-159Z.md`

## Read

Both arm64 lanes preserve event count, attr count, and checksum parity for every
fixture, tier, and scenario. `native-buffer` remains the product-direction
signal because it isolates parser/materialization work after Node already has
the bytes. `native-file` is retained only as ingestion context.
