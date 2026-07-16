---
title: Release Readiness
description: Checklist for validating the pure JavaScript StAX-XML release.
---

Use this checklist before creating a release tag or merging the release branch
to `master`.

Set `RELEASE_TAG` to the next unused release tag before running the commands
below. For the final 1.0 release use `v1.0.0`; for another prerelease use the
next rc tag, for example `v1.0.0-rc4`. The package versions in `package.json`
and `packages/stax-xml/package.json` must already match the tag without the
leading `v`.

## 1. Package Contract

Run the pure-JS package validator:

```bash
node scripts/validate-prerelease.mjs "$RELEASE_TAG"
pnpm build
node scripts/validate-prerelease.mjs "$RELEASE_TAG" --pack
```

The validator checks:

- root and public package versions match the tag;
- `packages/stax-xml/package.json` publishes only `dist`;
- runtime dependencies do not include native addon packages;
- `optionalDependencies` stays empty;
- `packages/native-*` directories are absent from the workspace;
- package exports point to `dist` JavaScript and declaration files;
- `npm pack --dry-run` contains only `package.json`, `README.md`, `LICENSE`
  when present, and `dist/**`;
- packed runtime files do not reference `.node`, `.wasm`, `node-gyp`,
  `node-addon-api`, `@napi-rs/*`, or `@stax-xml/native-*`.

## 2. Correctness and Stability

Run the package test and build gates:

```bash
pnpm test
pnpm build
pnpm --filter=stax-xml test:w3c
```

Use focused tests for any changed parser, converter, or writer path before
re-running the full package gate. Do not count generated benchmark output as a
correctness gate.

## 3. Large-File and Memory Evidence

Regenerate the maintained release benchmark set:

```bash
pnpm --filter benchmark run release:expanded
```

The release set must include:

- parser fixture series for 2 KiB, 4 KiB, 13 MiB, and 98 MiB inputs;
- maintained npm XML parser comparison rows;
- historical `CursorReaderSync` candidate size series from 1 MiB through 4 GiB;
- runtime matrix across installed Node, Bun, and Deno versions;
- historical 4 GiB `CursorReaderSync` index-first evidence retained for comparison;
- converter compiled batch-plan comparison;
- writer small/big/async rows;
- 1 GiB writer evidence for `WriterSyncSink` and async writer rows.

The 4 GiB stream reader result is the primary evidence that large byte input can
be parsed without materializing the whole XML document as one JavaScript string.
Keep raw generated reports on an evidence branch such as
`evidence/release-reports-YYYY-MM-DD`, with a small index or README that records
their paths and reading order. Do not commit those raw reports to `master` or a
release branch. The docs benchmark snapshot may retain a curated summary that
cites the evidence branch and commit.

## 4. Documentation

Build the docs and validate the release snapshot:

```bash
pnpm docs:build
pnpm docs:snapshot:release "$RELEASE_TAG" --dry-run
```

Release-facing docs must cover:

- [Runtime Model](/stax-xml/resources/runtime-model/) for the pure JavaScript
  packaging decision;
- [Migrating from v0.x](/stax-xml/guide/migration-v0/) for import, reader, and
  large-file changes;
- [Web Server Integration](/stax-xml/guide/server-integration/) for request
  stream handling in common server frameworks;
- [Benchmarks](/stax-xml/resources/benchmarks/) for reproducible performance
  commands and generated release results.

## 5. Migration Readiness

Before release, test at least one application-shaped sample for each public
surface that users are expected to keep:

```bash
pnpm verify:release-surfaces
```

- `EventReaderSync` for in-memory XML strings;
- `EventReader` for `ReadableStream<Uint8Array>` input;
- `StreamReaderSync` for synchronous current-token string/byte consumption;
- `StreamReader` for asynchronous current-token byte consumption;
- `stax-xml/converter` for schema-known projection;
- `Writer`, `WriterSync`, and `WriterSyncSink` for output.

For v0.x users, the migration path should be mechanical: remove native
experiments if present, use ESM imports, choose the reader that matches the
input shape, and rerun production-sized XML comparisons.

## 6. Web Server Readiness

For server integrations, verify the examples keep the body streaming:

- Express and Fastify examples convert Node streams with `Readable.toWeb()`;
- Fetch-based frameworks use `request.body` directly;
- docs warn against `request.text()` and eager body parsers for large XML;
- parser work stays one reader per request.

## 7. Merge Gate

Before merging to `master`:

- fetch the current remote state;
- ensure the release branch is based on the intended `origin/master`;
- run the verification commands above after the final docs and benchmark
  snapshot changes;
- inspect `git diff --stat` and confirm only release-prep artifacts changed;
- commit with the repository Lore Commit Protocol;
- merge to `master` only after the completion audit has no uncovered
  requirement.
