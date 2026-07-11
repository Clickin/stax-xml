---
title: 릴리스 준비
description: pure JavaScript StAX-XML 릴리스를 검증하기 위한 체크리스트.
---

Release tag를 만들거나 release branch를 `master`에 병합하기 전에 이 체크리스트를
사용하세요.

아래 command를 실행하기 전에 `RELEASE_TAG`를 아직 사용하지 않은 다음 release tag로
설정하세요. 최종 1.0 release라면 `v1.0.0`, prerelease를 한 번 더 낸다면
`v1.0.0-rc4` 같은 다음 rc tag를 사용합니다. `package.json`과
`packages/stax-xml/package.json`의 version은 앞의 `v`를 뺀 tag와 이미 일치해야
합니다.

## 1. Package contract

Pure-JS package validator를 실행합니다.

```bash
node scripts/validate-prerelease.mjs "$RELEASE_TAG"
pnpm build
node scripts/validate-prerelease.mjs "$RELEASE_TAG" --pack
```

Validator는 다음 항목을 확인합니다.

- root package와 public package version이 tag와 일치합니다.
- `packages/stax-xml/package.json`은 `dist`만 publish합니다.
- Runtime dependency에 native addon package가 없습니다.
- `optionalDependencies`가 비어 있습니다.
- Workspace 안에 `packages/native-*` directory가 없습니다.
- Package export는 `dist`의 JavaScript와 declaration file을 가리킵니다.
- `npm pack --dry-run` 결과에는 `package.json`, `README.md`, 존재하는 경우
  `LICENSE`, 그리고 `dist/**`만 들어갑니다.
- Packed runtime file은 `.node`, `.wasm`, `node-gyp`, `node-addon-api`,
  `@napi-rs/*`, `@stax-xml/native-*`를 참조하지 않습니다.

## 2. Correctness와 안정화

Package test와 build gate를 실행합니다.

```bash
pnpm test
pnpm build
pnpm --filter=stax-xml test:w3c
```

Parser, converter, writer 경로를 변경했다면 전체 package gate 전에 변경 지점의
focused test를 먼저 실행하세요. 생성된 benchmark output은 correctness gate가
아닙니다.

## 3. 큰 파일과 메모리 evidence

유지되는 release benchmark set을 다시 생성합니다.

```bash
pnpm --filter benchmark run release:expanded
```

Release set에는 다음 결과가 포함되어야 합니다.

- 2 KiB, 4 KiB, 13 MiB, 98 MiB input에 대한 parser fixture series.
- 유지되는 npm XML parser 비교 행.
- 1 MiB부터 4 GiB까지의 historical `CursorReaderSync` candidate size series.
- 설치된 Node, Bun, Deno version에 대한 runtime matrix.
- 비교를 위해 유지하는 historical 4 GiB `CursorReaderSync` index-first evidence.
- Converter compiled batch-plan 비교.
- Writer small/big/async 행.
- `WriterSyncSink`와 async writer row를 포함한 1 GiB writer evidence.

4 GiB stream reader 결과는 큰 byte input을 하나의 JavaScript string으로 만들지 않고
파싱할 수 있다는 핵심 evidence입니다. `packages/benchmark/results/release/**` 아래의
생성 파일과 docs benchmark snapshot을 맞춰 두세요.

## 4. 문서

Docs build와 release snapshot을 검증합니다.

```bash
pnpm docs:build
pnpm docs:snapshot:release "$RELEASE_TAG" --dry-run
```

Release-facing docs는 다음 항목을 포함해야 합니다.

- Pure JavaScript packaging 결정을 설명하는 [실행 모델](/stax-xml/ko/resources/runtime-model/).
- Import, reader, 큰 파일 변경을 설명하는 [v0.x 마이그레이션](/stax-xml/ko/guide/migration-v0/).
- 주요 server framework의 request stream 처리법을 설명하는 [Web Server 연동](/stax-xml/ko/guide/server-integration/).
- 재현 가능한 성능 command와 생성된 release 결과를 담은 [벤치마크](/stax-xml/ko/resources/benchmarks/).

## 5. Migration readiness

릴리스 전에 사용자가 유지할 public surface마다 application 형태의 sample을 하나 이상
검증하세요.

```bash
pnpm verify:release-surfaces
```

- 인메모리 XML string용 `EventReaderSync`.
- `ReadableStream<Uint8Array>` 입력용 `EventReader`.
- 동기 current-token string/byte 소비용 `StreamReaderSync`.
- 비동기 current-token byte 소비용 `StreamReader`.
- Schema-known projection용 `stax-xml/converter`.
- Output용 `Writer`, `WriterSync`, `WriterSyncSink`.

v0.x 사용자에게 migration은 기계적으로 가능해야 합니다. 사용 중인 native experiment가
있다면 제거하고, ESM import를 사용하고, 입력 형태에 맞는 reader를 선택한 뒤,
production 크기의 XML 비교를 다시 실행하면 됩니다.

## 6. Web server readiness

Server integration 예제가 body streaming을 유지하는지 확인합니다.

- Express와 Fastify 예제는 Node stream을 `Readable.toWeb()`으로 변환합니다.
- Fetch 기반 framework는 `request.body`를 직접 사용합니다.
- 문서는 큰 XML에서 `request.text()`와 eager body parser를 피하라고 안내합니다.
- Parser는 request마다 reader를 하나씩 새로 만듭니다.

## 7. Merge gate

`master`에 병합하기 전에 다음을 확인하세요.

- 현재 remote state를 fetch합니다.
- Release branch가 의도한 `origin/master` 위에 있는지 확인합니다.
- 마지막 docs와 benchmark snapshot 변경 후 위 verification command를 실행합니다.
- `git diff --stat`을 확인하고 release-prep artifact만 바뀌었는지 검토합니다.
- Repository Lore Commit Protocol로 commit합니다.
- Completion audit에서 uncovered requirement가 없을 때만 `master`에 병합합니다.
