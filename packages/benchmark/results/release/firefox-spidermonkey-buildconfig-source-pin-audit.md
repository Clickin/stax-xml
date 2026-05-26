# Firefox/SpiderMonkey Buildconfig Source Pin Audit

Generated: 2026-05-26T22:05:30.426Z

Pins installed Firefox build metadata and about:buildconfig diagnostic flags for the SpiderMonkey JitSpew/codegen evidence gap. This is build/source-boundary evidence, not emitted JIT IR or optimized-code proof.

## Summary

- Firefox executable: C:\Program Files\Mozilla Firefox\firefox.exe
- Version: 143.0.1
- Build ID: 20250918214338
- Source repository: https://hg.mozilla.org/releases/mozilla-release
- Source stamp: 644b498d517849c3fb95679e2017e965fe62b77a
- about:buildconfig read: yes
- Mentions --enable-js-shell: yes
- Mentions MOZ_PACKAGE_JSSHELL=1: yes
- Mentions --enable-jitspew: no
- Mentions JS_JITSPEW: no
- Mentions JS_STRUCTURED_SPEW: no

## Findings

- installed-firefox-source-stamp-pinned (SOURCE_FACT): The installed Firefox build identity is pinned from installation metadata.
  - version=143.0.1
  - buildId=20250918214338
  - sourceRepository=https://hg.mozilla.org/releases/mozilla-release
  - sourceStamp=644b498d517849c3fb95679e2017e965fe62b77a
- installed-firefox-buildconfig-does-not-mention-jitspew (NEGATIVE_RESULT): The installed Firefox about:buildconfig text does not mention --enable-jitspew, JS_JITSPEW, or JS_STRUCTURED_SPEW.
  - aboutBuildconfigTitle=Build Configuration
  - configureMentionsEnableJsShell=true
  - configureMentionsMozPackageJsShell=true
  - configureMentionsEnableJitSpew=false
  - configureMentionsJsJitSpew=false
  - configureMentionsStructuredSpew=false
- buildconfig-audit-scope (SCOPE_GUARD): Buildconfig metadata narrows the diagnostic surface only; it is not emitted SpiderMonkey JIT IR, optimized-code, allocation, or throughput evidence.
  - A diagnostic-capable Firefox build or SpiderMonkey shell can still close the codegen proof obligation.

## about:buildconfig Excerpt

```text
Build Configuration

Please be aware that this page doesn't reflect all the options used to build Firefox.

Source

Built from https://hg.mozilla.org/releases/mozilla-release/rev/644b498d517849c3fb95679e2017e965fe62b77a

Build platform
target
x86_64-pc-mingw32
Build tools
Compiler	Version	Compiler flags
/builds/worker/fetches/clang/bin/clang-cl -fms-compatibility-version=19.39 -Xclang -ivfsoverlay -Xclang /builds/worker/fetches/vs/overlay.yaml	19.1.7	-Gy -Zc:inline -Gw -D_HAS_EXCEPTIONS=0 -fcrash-diagnostics-dir=/builds/worker/artifacts
/builds/worker/fetches/clang/bin/clang-cl -fms-compatibility-version=19.39 -std:c++17 -Xclang -ivfsoverlay -Xclang /builds/worker/fetches/vs/overlay.yaml	19.1.7	-Zc:sizedDealloc- -Gy -Zc:inline -Gw -D_SILENCE_TR1_NAMESPACE_DEPRECATION_WARNING -TP -GR- -D_HAS_EXCEPTIONS=0 -fcrash-diagnostics-dir=/builds/worker/artifacts -Z7 -O2 -Oy
/builds/worker/fetches/rustc/bin/rustc	1.86.0	
Configure options

MOZ_AUTOMATION=1 --target=x86_64-pc-windows-msvc MOZILLA_OFFICIAL=1 --enable-update-channel=release MOZBUILD_STATE_PATH=/builds/worker/.mozbuild MOZ_FETCHES_DIR=/builds/worker/fetches 'CFLAGS= -fcrash-diagnostics-dir=/builds/worker/artifacts' 'CXXFLAGS= -fcrash-diagnostics-dir=/builds/worker/artifacts' ENABLE_CLANG_PLUGIN=1 --enable-profile-use=cross --with-pgo-profile-path=/builds/worker/fetches/merged.profdata --with-pgo-jarlog=/builds/worker/fetches/en-US.log MOZ_LTO=cross MOZ_SOURCE_REPO=https://hg.mozilla.org/releases/mozilla-release MOZ_SOURCE_CHANGESET=644b498d517849c3fb95679e2017e965fe62b77a --enable-js-shell --enable-rust-simd --with-mozilla-api-keyfile=/builds/mozilla-desktop-geoloc-api.key --with-google-location-service-api-keyfile=/builds/gls-gapi.data --with-google-safebrowsing-api-keyfile=/builds/sb-gapi.data MAR_CHANNEL_ID=firefox-mozilla-release ACCEPTED_MAR_CHANNEL_IDS=firefox-mozilla-release --enable-official-branding MOZ_SIMPLE_PACKAGE_NAME=target MOZ_PACKAGE_JSSHELL=1 UPX=/builds/worker/fetches/upx-3.95-win64/upx.exe
```

## Limits

- This artifact does not contain emitted JIT IR or optimized-code.
- A missing JitSpew flag in this installed release build is not a SpiderMonkey runtime ceiling proof.
- Use a diagnostic-capable Firefox build or SpiderMonkey shell for the actual codegen proof obligation.

