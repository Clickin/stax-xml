#!/usr/bin/env node
/**
 * End-to-end experimental backend benchmark.
 *
 * This deliberately measures public reader/converter work, including byte
 * ingress and requested string materialization. Direct cursor numbers are
 * included for context only; Reader/converter results are the decision gate.
 */

import { cpus, platform, release, arch } from "node:os";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  EventReaderSync as JsEventReaderSync,
  StreamReader as JsStreamReader,
  StreamReaderSync as JsStreamReaderSync,
  XmlEventType,
} from "stax-xml";
import { jsTokenBackendFactory } from "stax-xml/experimental/backend";
import { createStaxParserSurfaceRunners } from "./common/parser-scenarios.mjs";
import {
  createCatalogFixture,
  sameSummary,
  summarize,
  catalogSchema,
} from "./harness/cases/converter-catalog.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIB = 1024 * 1024;
const encoder = new TextEncoder();

const args = parseArgs();
const invocation = [process.argv[0], ...process.argv.slice(1)].join(" ");
const options = {
  documentMode: "document",
  namespaceAware: true,
  autoDecodeEntities: true,
  encoding: "utf-8",
};

const wasm = await loadWasm();
const artifacts = loadArtifacts();
const variants = ["js", "scalar", "simd"];
const workloads = loadWorkloads(args);
const expected = new Map();
const coldInput = encoder.encode('<cold><item a="1">value</item></cold>');
const coldJsStart = performance.now();
const coldJsSession = jsTokenBackendFactory.createByteSession(options);
coldJsSession.pushBytes(coldInput, true);
while (coldJsSession.cursor.next() !== null) {}
const coldJsFirstParseMs = performance.now() - coldJsStart;
coldJsSession.dispose();
const cold = {
  js: {
    wasmBytes: null,
    compileMs: null,
    initMs: null,
    instanceMs: null,
    firstParseMs: coldJsFirstParseMs,
  },
};
for (const variant of ["scalar", "simd"]) {
  cold[variant] = await measureCold(variant, artifacts[variant]);
}

for (const workload of workloads) {
  const jsFull = await consumeStreamSync("js", workload.bytes, "full");
  const jsTypes = await consumeStreamSync("js", workload.bytes, "types");
  expected.set(workload.id, {
    full: jsFull,
    types: jsTypes,
    event: workload.attributeHeavy
      ? await consumeEventSync("js", workload.bytes)
      : null,
  });
}

// Full accessor parity is a gate before any timed work. This catches a parser
// that returns the right event count while silently dropping state or fields.
for (const workload of workloads) {
  const reference = expected.get(workload.id).full;
  for (const variant of variants) {
    await activateVariant(variant);
    const actual = await consumeStreamSync(variant, workload.bytes, "full");
    assertEqualChecksum(`${variant}/${workload.id}/full`, reference, actual);
    if (expected.get(workload.id).event) {
      const eventActual = await consumeEventSync(variant, workload.bytes);
      assertEqualChecksum(
        `${variant}/${workload.id}/event`,
        expected.get(workload.id).event,
        eventActual,
      );
    }
  }
}

const benchmarkWorkloads = [];
for (const workload of workloads) {
  const reference = expected.get(workload.id);
  const isDocsFixture = workload.id.startsWith("docs-");
  const modes = isDocsFixture ? [] : [
    ["tokenizer-type-only", (variant) => consumeTokenizer(variant, workload.bytes), reference.types],
    ["stream-sync-type-only", (variant) => consumeStreamSync(variant, workload.bytes, "types"), reference.types],
    ["stream-sync-accessors", (variant) => consumeStreamSync(variant, workload.bytes, "full"), reference.full],
    ["stream-sync-chunked", (variant) => consumeStreamSync(variant, chunks(workload.bytes), "full"), reference.full],
    ["stream-async", (variant) => consumeAsync(variant, workload.bytes), reference.full],
  ];
  if (workload.attributeHeavy && !isDocsFixture) {
    modes.push([
      "event-sync-materialized",
      (variant) => consumeEventSync(variant, workload.bytes),
      reference.event,
    ]);
  }
  if (isDocsFixture) {
    const fixture = {
      assetPath: workload.source,
      xmlString: new TextDecoder().decode(workload.bytes),
      inputBuffer: workload.bytes,
    };
    const jsRunners = createStaxParserSurfaceRunners(fixture);
    const wasmRunners = createStaxParserSurfaceRunners({
      ...fixture,
      backend: wasm.wasmTokenBackendFactory,
    });
    const expectedRows = jsRunners[0].run();
    [
      "docs-event-string-js-object",
      "docs-stream-bytes-js-object",
      "docs-converter-bytes-js-object",
    ].forEach((name, index) => {
      modes.push([
        name,
        (variant) => (variant === "js" ? jsRunners : wasmRunners)[index].run(),
        expectedRows,
      ]);
    });
  }

  for (const [name, fn, expectedResult] of modes) {
    for (const variant of variants) {
      await activateVariant(variant);
      const result = await fn(variant);
      assertEqualChecksum(`${variant}/${workload.id}/${name}/parity`, expectedResult, result);
    }
  }

  const rows = {};
  for (const [name, fn, expectedResult] of modes) {
    rows[name] = {};
    for (const variant of variants) {
      await activateVariant(variant);
      const samples = [];
      const memorySamples = [];
      for (let warmup = 0; warmup < args.warmups; warmup++) {
        const result = await fn(variant);
        assertEqualChecksum(`${variant}/${workload.id}/${name}/warmup`, expectedResult, result);
      }
      for (let run = 0; run < args.runs; run++) {
        globalThis.gc?.();
        const before = memoryEndpoint(variant);
        const start = performance.now();
        const result = await fn(variant);
        const ms = performance.now() - start;
        const after = memoryEndpoint(variant);
        assertEqualChecksum(`${variant}/${workload.id}/${name}/run`, expectedResult, result);
        samples.push(ms);
        memorySamples.push({ before, after });
      }
      const medianMs = median(samples);
      rows[name][variant] = {
        samplesMs: samples,
        medianMs,
        throughputMiBPerSec: workload.bytes.byteLength / MIB / (medianMs / 1000),
        memory: summarizeMemory(memorySamples),
      };
    }
  }
  const memoryProbe = { js: null };
  for (const variant of ["scalar", "simd"]) {
    memoryProbe[variant] = await measureMemoryProbe(variant, workload.bytes);
  }
  benchmarkWorkloads.push({
    id: workload.id,
    source: workload.source,
    bytes: workload.bytes.byteLength,
    bytesMiB: workload.bytes.byteLength / MIB,
    checksum: reference.full.checksum,
    eventCount: reference.full.eventCount,
    typeChecksum: reference.types.checksum,
    modes: rows,
    memoryProbe,
  });
}

const converter = await benchmarkConverter();
const retention = await measureRetention();
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  invocation,
  command: "node --expose-gc packages/benchmark/wasm-backend.mjs",
  options: {
    sizeMib: args.sizeMib,
    warmups: args.warmups,
    runs: args.runs,
    gcBeforeSample: typeof globalThis.gc === "function",
    fixtures: args.fixtures,
    out: args.out,
  },
  metadata: collectMetadata(args),
  backendPolicy: {
    byteEncoding: "utf-8",
    js: "jsTokenBackendFactory",
    scalar: "wasmTokenBackendFactory after initWasm({variant:'scalar'})",
    simd: "wasmTokenBackendFactory after initWasm({variant:'simd'})",
    directStrings: "not routed through Wasm; factory delegates to JS",
    nonUtf8: "not routed through Wasm; factory delegates to JS",
    uninitializedUtf8: "fails clearly rather than falling back",
  },
  artifacts: Object.fromEntries(
    Object.entries(artifacts).map(([variant, artifact]) => [
      variant,
      artifact === null
        ? null
        : {
            path: artifact.path,
            bytes: artifact.bytes.byteLength,
            sha256: artifact.sha256,
          },
    ]),
  ),
  cold,
  workloads: benchmarkWorkloads,
  converter,
  retention,
  comparisons: summarizeComparisons(benchmarkWorkloads),
};

mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wasm backend benchmark: ${args.out}`);
console.log(`Invocation: ${invocation}`);
console.log(`Workloads: ${workloads.map((workload) => `${workload.id}=${formatBytes(workload.bytes.byteLength)}`).join(", ")}`);
for (const workload of benchmarkWorkloads) {
  const row = workload.modes["docs-stream-bytes-js-object"] ??
    workload.modes["stream-sync-accessors"];
  console.log(
    `${workload.id} reader median: js=${row.js.medianMs.toFixed(2)}ms ` +
      `scalar=${row.scalar.medianMs.toFixed(2)}ms simd=${row.simd.medianMs.toFixed(2)}ms`,
  );
}

async function loadWasm() {
  try {
    return await import(new URL("../wasm/dist/index.js", import.meta.url));
  } catch (error) {
    throw new Error(
      "Built @stax-xml/wasm is required. Run the explicit wasm build before this benchmark.",
      { cause: error },
    );
  }
}

function loadArtifacts() {
  const result = { js: null };
  for (const variant of ["scalar", "simd"]) {
    const path = resolve(HERE, `../wasm/dist/tokenizer.${variant}.wasm`);
    let bytes;
    try {
      bytes = new Uint8Array(readFileSync(path));
    } catch (error) {
      throw new Error(`Missing built Wasm artifact: ${path}`, { cause: error });
    }
    result[variant] = {
      path,
      bytes,
      sha256: hashBytes(bytes),
    };
  }
  return result;
}

async function measureCold(variant, artifact) {
  const compileStart = performance.now();
  const module = await WebAssembly.compile(artifact.bytes);
  artifact.module = module;
  const compileMs = performance.now() - compileStart;

  const initStart = performance.now();
  await wasm.initWasm({ variant, module });
  const initMs = performance.now() - initStart;

  const instanceSamples = [];
  for (let index = 0; index < Math.max(3, args.runs); index++) {
    const start = performance.now();
    const cursor = new wasm.TokenCursorWasm(options, module);
    instanceSamples.push(performance.now() - start);
    cursor.dispose();
  }

  const start = performance.now();
  const cursor = new wasm.TokenCursorWasm(options, module);
  cursor.pushBytes(coldInput, true);
  let event;
  do {
    event = cursor.next();
  } while (event !== null);
  const firstParseMs = performance.now() - start;
  const memory = wasmMemoryStats(cursor);
  cursor.dispose();
  return {
    wasmBytes: artifact.bytes.byteLength,
    compileMs,
    initMs,
    instanceMs: median(instanceSamples),
    instanceSamplesMs: instanceSamples,
    firstParseMs,
    memory,
  };
}

async function activateVariant(variant) {
  if (variant === "js") return;
  await wasm.initWasm({ variant, module: artifacts[variant].module });
}

function loadWorkloads(config) {
  const generatedSize = config.sizeMib * MIB;
  const generated = [
    ["simple-ascii", simpleXml(generatedSize), false],
    ["attribute-heavy", attributeXml(generatedSize), true],
    ["namespace-heavy", namespaceXml(generatedSize), false],
    ["unicode-heavy", unicodeXml(generatedSize), false],
  ].map(([id, bytes, attributeHeavy]) => ({
    id,
    source: `generated-${config.sizeMib}MiB`,
    bytes,
    attributeHeavy,
  }));

  if (!config.fixtures) return generated;
  const fixtureNames = config.fixtures === true ? ["13", "98"] : config.fixtures;
  for (const name of fixtureNames) {
    const path = resolve(
      HERE,
      `assets/${name === "13" ? "midsize.xml" : "large.xml"}`,
    );
    const bytes = new Uint8Array(readFileSync(path));
    generated.push({
      id: `docs-${name}mib`,
      source: path,
      bytes,
      attributeHeavy: true,
    });
  }
  return generated;
}

function simpleXml(target) {
  return generatedXml(target, (index) => `<item id="${index}">value-${index}</item>`, "<root>");
}

function attributeXml(target) {
  return generatedXml(
    target,
    (index) =>
      `<item id="${index}" a0="zero" a1="one" a2="two" a3="three" a4="four" ` +
      `a5="five" a6="six" a7="seven" a8="eight" a9="nine" a10="ten" ` +
      `a11="eleven" a12="twelve" a13="thirteen">attribute-value-${index}</item>`,
    "<root>",
  );
}

function namespaceXml(target) {
  return generatedXml(
    target,
    (index) =>
      `<p:item xmlns:p="urn:items" xmlns:q="urn:other" q:code="${index}" ` +
      `p:kind="entry"><q:text>namespace-${index}</q:text></p:item>`,
    '<root xmlns="urn:root" xmlns:p="urn:items" xmlns:q="urn:other">',
  );
}

function unicodeXml(target) {
  return generatedXml(
    target,
    (index) =>
      `<item id="${index}" lang="ko">안녕하세요 — café — Привет — 你好 — ` +
      `😀 ${index}</item>`,
    "<root>",
  );
}

function generatedXml(target, row, root) {
  const rows = [];
  let bytes = encoder.encode(`${root}</root>`).byteLength;
  let index = 0;
  while (bytes < target) {
    const value = row(index++);
    rows.push(value);
    bytes += encoder.encode(value).byteLength;
  }
  return encoder.encode(`${root}${rows.join("")}</root>`);
}

function chunks(bytes, chunkSize = 64 * 1024) {
  return (function* () {
    for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
      yield bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength));
    }
  })();
}

async function* asyncChunks(bytes, chunkSize = 64 * 1024) {
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    yield bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength));
  }
}

function readerOptions() {
  // The experimental reader subclasses inject wasmTokenBackendFactory;
  // cloning keeps each constructor's options independent.
  return { ...options };
}

function converterOptionsFor(variant, base) {
  const value = { ...base };
  return variant === "js" ? value : wasm.withWasmBackend(value);
}

function consumeTokenizer(variant, bytes) {
  const backend =
    variant === "js" ? jsTokenBackendFactory : wasm.wasmTokenBackendFactory;
  const session = backend.createByteSession({
    ...options,
    encoding: "utf-8",
  });
  const cursor = session.cursor;
  const input = chunks(bytes);
  let checksum = 0;
  let eventCount = 0;
  while (true) {
    const result = cursor.next();
    if (result === Symbol.for("stax-xml.need-input")) {
      const part = input.next();
      if (part.done) session.pushBytes(new Uint8Array(0), true);
      else session.pushBytes(part.value, false);
      continue;
    }
    if (result === null) break;
    eventCount++;
    checksum = fold(checksum, String(result));
  }
  session.dispose();
  return { checksum, eventCount };
}

function consumeStreamSync(variant, input, mode) {
  const Reader = variant === "js" ? JsStreamReaderSync : wasm.StreamReaderSync;
  const reader = new Reader(input, readerOptions());
  const result = consumeCursor(reader, mode);
  reader.close();
  return result;
}

async function consumeAsync(variant, bytes) {
  const Reader = variant === "js" ? JsStreamReader : wasm.StreamReader;
  const reader = new Reader(
    asyncChunks(bytes),
    readerOptions(),
  );
  let checksum = 0;
  let eventCount = 0;
  while (true) {
    const type = await reader.next();
    if (type === null) break;
    eventCount++;
    checksum = fold(checksum, String(type));
    checksum = fold(checksum, reader.name() ?? "");
    checksum = fold(checksum, reader.text() ?? "");
    checksum = fold(checksum, reader.localName() ?? "");
    checksum = fold(checksum, reader.prefix() ?? "");
    checksum = fold(checksum, reader.namespaceURI() ?? "");
    if (type === XmlEventType.START_ELEMENT) {
      checksum = fold(checksum, String(reader.attributeCount()));
      for (let index = 0; index < reader.attributeCount(); index++) {
        checksum = fold(checksum, reader.attributeName(index) ?? "");
        checksum = fold(checksum, reader.attributeLocalName(index) ?? "");
        checksum = fold(checksum, reader.attributePrefix(index) ?? "");
        checksum = fold(checksum, reader.attributeNamespaceURI(index) ?? "");
        checksum = fold(checksum, reader.attributeValue(index) ?? "");
      }
    }
  }
  await reader.close();
  return { checksum, eventCount };
}

function consumeEventSync(variant, bytes) {
  const Reader = variant === "js" ? JsEventReaderSync : wasm.EventReaderSync;
  const reader = new Reader(
    bytes,
    readerOptions(),
  );
  let checksum = 0;
  let eventCount = 0;
  for (const event of reader) {
    eventCount++;
    checksum = hashEvent(checksum, event);
  }
  reader.close();
  return { checksum, eventCount };
}

function measureMemoryProbe(variant, bytes) {
  const session = new wasm.WasmTokenInputSession(
    { ...options, encoding: "utf-8" },
    artifacts[variant].module,
  );
  const cursor = session.cursor;
  const input = chunks(bytes);
  let eventCount = 0;
  let pushes = 0;
  let maximum = cursor.memoryStats();
  while (true) {
    const result = cursor.next();
    if (result === wasm.NEED_INPUT) {
      const part = input.next();
      if (part.done) {
        session.pushBytes(new Uint8Array(0), true);
      } else {
        session.pushBytes(part.value, false);
        pushes++;
      }
      maximum = maxMemoryStats(maximum, cursor.memoryStats());
      continue;
    }
    if (result === null) break;
    eventCount++;
    maximum = maxMemoryStats(maximum, cursor.memoryStats());
  }
  const beforeDispose = cursor.memoryStats();
  maximum = maxMemoryStats(maximum, beforeDispose);
  session.dispose();
  return {
    pushes,
    eventCount,
    beforeDispose,
    maximum,
    afterDispose: cursor.memoryStats(),
  };
}

function maxMemoryStats(left, right) {
  if (!left) return right;
  if (!right) return left;
  return {
    pages: Math.max(left.pages, right.pages),
    inputCapacity: Math.max(left.inputCapacity, right.inputCapacity),
  };
}

function consumeCursor(reader, mode) {
  let checksum = 0;
  let eventCount = 0;
  while (true) {
    const type = reader.next();
    if (type === null) break;
    eventCount++;
    checksum = fold(checksum, String(type));
    if (mode === "types") continue;
    checksum = fold(checksum, reader.name() ?? "");
    checksum = fold(checksum, reader.text() ?? "");
    checksum = fold(checksum, reader.localName() ?? "");
    checksum = fold(checksum, reader.prefix() ?? "");
    checksum = fold(checksum, reader.namespaceURI() ?? "");
    if (type === XmlEventType.START_ELEMENT) {
      const count = reader.attributeCount();
      checksum = fold(checksum, String(count));
      for (let index = 0; index < count; index++) {
        checksum = fold(checksum, reader.attributeName(index) ?? "");
        checksum = fold(checksum, reader.attributeLocalName(index) ?? "");
        checksum = fold(checksum, reader.attributePrefix(index) ?? "");
        checksum = fold(checksum, reader.attributeNamespaceURI(index) ?? "");
        checksum = fold(checksum, reader.attributeValue(index) ?? "");
      }
    }
  }
  return { checksum, eventCount };
}

function hashEvent(hash, event) {
  hash = fold(hash, event.type);
  if (event.type === XmlEventType.START_DOCUMENT) {
    return fold(
      fold(fold(hash, event.version ?? ""), event.encoding ?? ""),
      String(event.standalone ?? ""),
    );
  }
  if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
    hash = fold(hash, event.name);
    hash = fold(hash, event.localName);
    hash = fold(hash, event.prefix);
    hash = fold(hash, event.namespaceURI);
    if (event.type === XmlEventType.START_ELEMENT) {
      hash = fold(hash, String(event.selfClosing));
      hash = fold(hash, String(event.attributes?.size ?? 0));
      for (const attribute of event.attributes?.values() ?? []) {
        hash = fold(hash, attribute.name);
        hash = fold(hash, attribute.localName);
        hash = fold(hash, attribute.prefix);
        hash = fold(hash, attribute.namespaceURI);
        hash = fold(hash, attribute.value);
      }
    }
    return hash;
  }
  if (event.type === XmlEventType.PROCESSING_INSTRUCTION) {
    return fold(fold(hash, event.target), event.data);
  }
  return fold(hash, event.value ?? "");
}

async function benchmarkConverter() {
  const fixture = createCatalogFixture(args.sizeMib * MIB);
  const parseOptions = { documentMode: "fragment", maxEvents: 20_000_000 };
  const reference = summarize(catalogSchema.parseSync(fixture.bytes, parseOptions));
  const result = {
    bytes: fixture.bytes.byteLength,
    records: fixture.bookCount,
    checksum: reference.checksum,
    variants: {},
  };
  for (const variant of variants) {
    await activateVariant(variant);
    const converterOptions = converterOptionsFor(variant, parseOptions);
    const actual = summarize(catalogSchema.parseSync(fixture.bytes, converterOptions));
    if (!sameSummary(reference, actual)) {
      throw new Error(`converter parity failed for ${variant}`);
    }
    const samples = [];
    const memorySamples = [];
    const run = () => summarize(catalogSchema.parseSync(fixture.bytes, converterOptions));
    for (let warmup = 0; warmup < args.warmups; warmup++) {
      if (!sameSummary(reference, run())) throw new Error(`converter warmup parity failed for ${variant}`);
    }
    for (let index = 0; index < args.runs; index++) {
      globalThis.gc?.();
      const before = memoryEndpoint(variant);
      const start = performance.now();
      const value = run();
      const ms = performance.now() - start;
      const after = memoryEndpoint(variant);
      if (!sameSummary(reference, value)) throw new Error(`converter run parity failed for ${variant}`);
      samples.push(ms);
      memorySamples.push({ before, after });
    }
    const medianMs = median(samples);
    result.variants[variant] = {
      samplesMs: samples,
      medianMs,
      throughputMiBPerSec: fixture.bytes.byteLength / MIB / (medianMs / 1000),
      memory: summarizeMemory(memorySamples),
    };
  }
  return result;
}

async function measureRetention() {
  const workload = workloads[0];
  const result = {};
  for (const variant of variants) {
    await activateVariant(variant);
    const before = memoryEndpoint(variant);
    for (let index = 0; index < Math.max(3, args.runs); index++) {
      const reader = new (variant === "js" ? JsStreamReaderSync : wasm.StreamReaderSync)(
        workload.bytes,
        readerOptions(),
      );
      consumeCursor(reader, "full");
      reader.close();
    }
    if (globalThis.gc) globalThis.gc();
    const after = memoryEndpoint(variant);
    const direct =
      variant === "js"
        ? null
        : Array.from({ length: Math.max(3, args.runs) }, () =>
            measureMemoryProbe(variant, workload.bytes),
          );
    result[variant] = {
      repeats: Math.max(3, args.runs),
      before,
      after,
      wasmProbes: direct,
    };
  }
  return result;
}

function memoryEndpoint(variant) {
  const memory = process.memoryUsage();
  return {
    heapUsed: memory.heapUsed,
    rss: memory.rss,
    wasm: null,
  };
}

function wasmMemoryStats(cursor) {
  try {
    if (cursor && typeof cursor.memoryStats === "function") return cursor.memoryStats();
  } catch {
    // Keep benchmark output explicit when the runtime/package lacks this
    // optional diagnostic, rather than manufacturing a memory number.
  }
  return null;
}

function summarizeMemory(samples) {
  const heapBefore = samples.map((sample) => sample.before.heapUsed);
  const heapAfter = samples.map((sample) => sample.after.heapUsed);
  const rssBefore = samples.map((sample) => sample.before.rss);
  const rssAfter = samples.map((sample) => sample.after.rss);
  return {
    heapUsedBeforeMedian: median(heapBefore),
    heapUsedAfterMedian: median(heapAfter),
    rssBeforeMedian: median(rssBefore),
    rssAfterMedian: median(rssAfter),
    wasmAfter: samples.at(-1)?.after.wasm ?? null,
  };
}

function summarizeComparisons(workloadsToSummarize) {
  return Object.fromEntries(
    workloadsToSummarize.map((workload) => {
      const accessor = workload.modes["docs-stream-bytes-js-object"] ??
        workload.modes["stream-sync-accessors"];
      return [
        workload.id,
        {
          scalarVsJsMedian: accessor.scalar.medianMs / accessor.js.medianMs,
          simdVsJsMedian: accessor.simd.medianMs / accessor.js.medianMs,
          simdVsScalarMedian: accessor.simd.medianMs / accessor.scalar.medianMs,
        },
      ];
    }),
  );
}

function assertEqualChecksum(label, expectedValue, actualValue) {
  if (Array.isArray(expectedValue)) {
    if (!isDeepStrictEqual(expectedValue, actualValue))
      throw new Error(`${label} projected object mismatch`);
    return;
  }
  if (
    expectedValue.checksum !== actualValue.checksum ||
    expectedValue.eventCount !== actualValue.eventCount
  ) {
    throw new Error(
      `${label} checksum mismatch: expected ${expectedValue.checksum}/${expectedValue.eventCount}, ` +
        `got ${actualValue.checksum}/${actualValue.eventCount}`,
    );
  }
}

function fold(seed, value) {
  let hash = seed | 0;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash | 0;
}

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatBytes(bytes) {
  return `${(bytes / MIB).toFixed(2)} MiB`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const result = {
    sizeMib: 4,
    runs: 5,
    warmups: 2,
    out: resolve(HERE, "results/wasm-experiment.json"),
    fixtures: false,
    commit: undefined,
    baselineCommit: undefined,
  };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (!argument.startsWith("--")) continue;
    const equal = argument.indexOf("=");
    const key = equal === -1 ? argument.slice(2) : argument.slice(2, equal);
    let value = equal === -1 ? argv[index + 1] : argument.slice(equal + 1);
    if (equal === -1 && (value === undefined || value.startsWith("--"))) value = true;
    else if (equal === -1) index++;
    if (key === "size-mib") result.sizeMib = Number(value);
    else if (key === "runs") result.runs = Number(value);
    else if (key === "warmups") result.warmups = Number(value);
    else if (key === "out") result.out = resolve(process.cwd(), String(value));
    else if (key === "commit") result.commit = String(value);
    else if (key === "baseline-commit") result.baselineCommit = String(value);
    else if (key === "fixtures") {
      result.fixtures =
        value === true
          ? true
          : String(value)
              .split(",")
              .map((part) => part.replace(/(?:mib|mb)$/i, ""))
              .filter((part) => part === "13" || part === "98");
    }
  }
  if (!(result.sizeMib > 0) || !(result.runs > 0) || result.warmups < 0) {
    throw new Error("--size-mib, --runs must be positive and --warmups must be non-negative");
  }
  return result;
}

function collectMetadata(config) {
  let commit;
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    commit = null;
  }
  return {
    node: process.version,
    v8: process.versions.v8,
    platform: `${platform()} ${release()}`,
    arch: arch(),
    cpu: cpus()[0]?.model ?? null,
    commit: config.commit ?? commit,
    baselineCommit: config.baselineCommit ?? null,
  };
}
