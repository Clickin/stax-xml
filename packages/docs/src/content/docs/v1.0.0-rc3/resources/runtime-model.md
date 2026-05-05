---
title: Runtime Model
description: How StAX-XML is packaged and why the public API stays in JavaScript.
slug: v1.0.0-rc3/resources/runtime-model
---

StAX-XML is distributed as a pure JavaScript package. There is no optional
native addon, Wasm parser module, or backend selection step to install or tune.
The same package is intended to run across Node.js, Bun, Deno, browsers, and
edge runtimes.

This matters because the public API returns JavaScript values: strings,
attributes, event objects, arrays, and converter output objects. A lower-level
scanner can sometimes find XML token boundaries faster, but those parsed values
still have to become JavaScript strings and objects before user code can consume
them.

Keeping the parser in JavaScript makes the tradeoff explicit:

- install and runtime behavior stay portable;
- memory accounting stays inside the JavaScript runtime as much as possible;
- large XML workloads avoid whole-document string materialization;
- pull-style readers can expose events incrementally without DOM state.

For workloads that need lower allocation overhead, use `StreamReader` or
`StreamReaderSync` and consume each batch with `eventCount` plus index
accessors. For ergonomic application code, use `EventReader`, `EventReaderSync`,
or converter schemas.

Detailed runtime-engine notes belong outside the package docs. The public docs
describe the supported package model and the API surfaces users can rely on.
