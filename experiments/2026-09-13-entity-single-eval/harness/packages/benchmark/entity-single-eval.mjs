import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { cpus, release } from 'node:os';
import {
  ACTUAL_FIXTURE_IDS,
  FIXTURE_IDS,
  FIXTURE_SEED,
  PROCESS_ORDER_SEED,
  createFixtureManifest,
  fixtureById,
  fixtureOptions,
  loadActualFixture,
  sha256Bytes,
} from './entity-single-eval/fixtures.mjs';
import {
  consumeAsync,
  consumePublic,
  consumeSync,
  foldString,
  importPublicBuild,
  readCounters,
} from './entity-single-eval/consume.mjs';
import { runRetention } from './entity-single-eval/retention.mjs';

export const VARIANT_IDS = ['R0', 'W0', 'A1', 'AT1'];
export const MANIFEST_SCHEMA_VERSION = 1;
const HERE = dirname(fileURLToPath(import.meta.url));
const MIB = 1024 * 1024;
const DEFAULT_SIZE_MIB = 16;
const HEX64 = /^[0-9a-f]{64}$/iu;
const HEX40 = /^[0-9a-f]{40}$/iu;
const PLACEHOLDER = /actual-|placeholder|path\/to|example\.com/iu;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function fingerprintDist(distPath) {
  const root = resolve(distPath);
  const files = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  visit(root);
  files.sort((left, right) => relative(root, left).localeCompare(relative(root, right)));
  const hash = createHash('sha256');
  const entries = [];
  for (const file of files) {
    const rel = relative(root, file).split('\\').join('/');
    const bytes = readFileSync(file);
    hash.update(rel);
    hash.update('\0');
    hash.update(bytes);
    entries.push({ path: rel, bytes: bytes.byteLength, sha256: sha256(bytes) });
  }
  return { sha256: hash.digest('hex'), files, entries };
}

export function distRootForEntry(entry) {
  return dirname(resolve(entry));
}

export function validateBuildManifest(value, { checkFiles = true, checkFingerprints = true } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Build manifest must be an object.');
  const topKeys = ['schemaVersion', 'baselineSha', 'variants', 'fixtureSeed', 'processOrderSeed'];
  if (Object.keys(value).some((key) => !topKeys.includes(key))) throw new Error('Build manifest has unknown fields.');
  if (value.schemaVersion !== MANIFEST_SCHEMA_VERSION) throw new Error(`Build manifest schemaVersion must be ${MANIFEST_SCHEMA_VERSION}.`);
  if (!HEX40.test(value.baselineSha) || PLACEHOLDER.test(value.baselineSha)) throw new Error('Build manifest baselineSha must be an actual full SHA-1.');
  if (!Array.isArray(value.variants) || !value.variants.length) throw new Error('Build manifest must contain R0 and available staged variants.');
  const ids = new Set();
  for (const variant of value.variants) {
    const keys = ['id', 'entry', 'converterEntry', 'sourceSha', 'patchSha256', 'distSha256', 'normalization', 'instrumented'];
    if (!variant || Object.keys(variant).some((key) => !keys.includes(key))) throw new Error('Build manifest variant has unknown fields.');
    if (!VARIANT_IDS.includes(variant.id) || ids.has(variant.id)) throw new Error(`Invalid or duplicate build variant id: ${variant.id}`);
    ids.add(variant.id);
    for (const key of ['entry', 'converterEntry']) {
      if (typeof variant[key] !== 'string' || !isAbsolute(variant[key]) || PLACEHOLDER.test(variant[key])) throw new Error(`${variant.id}.${key} must be an absolute real path.`);
      if (checkFiles && !statSync(variant[key], { throwIfNoEntry: false })?.isFile()) throw new Error(`${variant.id}.${key} does not exist: ${variant[key]}`);
    }
    if (!HEX40.test(variant.sourceSha) || PLACEHOLDER.test(variant.sourceSha)) throw new Error(`${variant.id}.sourceSha must be an actual full SHA-1.`);
    if (variant.patchSha256 !== null && (!HEX64.test(variant.patchSha256) || PLACEHOLDER.test(variant.patchSha256))) throw new Error(`${variant.id}.patchSha256 must be SHA-256 or null.`);
    if (!HEX64.test(variant.distSha256) || PLACEHOLDER.test(variant.distSha256)) throw new Error(`${variant.id}.distSha256 must be an actual SHA-256.`);
    if (!['reference', 'wiring', 'attributes', 'attributes-text'].includes(variant.normalization)) throw new Error(`${variant.id}.normalization is invalid.`);
    if (typeof variant.instrumented !== 'boolean') throw new Error(`${variant.id}.instrumented must be boolean.`);
    if (checkFingerprints) {
      const actual = fingerprintDist(distRootForEntry(variant.entry)).sha256;
      if (actual !== variant.distSha256) throw new Error(`${variant.id} dist fingerprint mismatch: manifest=${variant.distSha256}, actual=${actual}`);
    }
  }
  if (!ids.has('R0')) throw new Error('Build manifest is missing R0.');
  if (value.variants.some(v => v.instrumented !== value.variants[0].instrumented)) throw new Error('Timing and instrumented builds must be separate.');
  if (value.fixtureSeed !== FIXTURE_SEED || value.processOrderSeed !== PROCESS_ORDER_SEED) throw new Error('Build manifest fixture/process seed does not match the experiment contract.');
  return value;
}

export function loadBuildManifest(path, options) {
  const absolute = resolve(path);
  let value;
  try { value = JSON.parse(readFileSync(absolute, 'utf8')); } catch (error) { throw new Error(`Unable to read build manifest ${absolute}: ${error.message}`); }
  return validateBuildManifest(value, options);
}

function parseArgs(args) {
  const command = args.shift();
  if (!command || command === '--help' || command === '-h') return { command: command ?? 'help', options: {} };
  const options = {};
  const allowed = {
    parity: new Set(['manifest', 'suite', 'out', 'cases', 'size-mib']),
    bench: new Set(['manifest', 'suite', 'blocks', 'start-block', 'warmups', 'runs', 'out', 'cases', 'size-mib', 'lanes']),
    retention: new Set(['manifest', 'out', 'counts', 'repeats', 'value-kib']),
    diagnose: new Set(['manifest', 'out', 'cases', 'size-mib']),
  }[command];
  if (!allowed) throw new Error(`Unknown command: ${command}`);
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
    const [rawName, inline] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const name = rawName.slice(2);
    if (!allowed.has(name)) throw new Error(`Unknown argument: ${rawName}`);
    const value = inline ?? args[++index];
    if (value === undefined) throw new Error(`${rawName} requires a value.`);
    options[name] = value;
  }
  if (!options.manifest) throw new Error('--manifest is required.');
  if (command !== 'parity' && !options.out) throw new Error('--out is required.');
  return { command, options };
}

function positive(value, flag, fallback) {
  const result = Number(value ?? fallback);
  if (!Number.isInteger(result) || result <= 0) throw new Error(`${flag} must be a positive integer.`);
  return result;
}

function nonNegative(value, flag, fallback) {
  const result = Number(value ?? fallback);
  if (!Number.isInteger(result) || result < 0) throw new Error(`${flag} must be a non-negative integer.`);
  return result;
}

function chosen(values, allowed, flag) {
  const result = values ? values.split(',').filter(Boolean) : allowed;
  for (const item of result) if (!allowed.includes(item)) throw new Error(`${flag} contains unknown case ${item}.`);
  return result;
}

function seededOrder(values, seed) {
  const result = values.slice();
  let state = seed >>> 0;
  for (let index = result.length - 1; index > 0; index--) {
    state = (Math.imul(state ^ (state >>> 16), 2246822519) + 3266489917) >>> 0;
    const other = state % (index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function fixturePayload(id, sizeMib) {
  return { id, targetBytes: Math.max(1024, Math.floor(sizeMib * MIB)) };
}

function caseRows(suite, sizeMib, filters = {}) {
  const p1 = FIXTURE_IDS.map((fixture) => ({ id: `P1/${fixture}`, lane: 'P1', fixture, kind: 'event-sync', encoding: 'bytes', options: { namespaceAware: true, autoDecodeEntities: true } }));
  const p2Fixtures = ['ascii-none', 'unicode-none', 'rare', 'named-attr', 'numeric-attr', 'named-text', 'mixed'];
  const p2 = p2Fixtures.map((fixture) => ({ id: `P2/${fixture}`, lane: 'P2', fixture, kind: 'event-async', encoding: 'chunks', chunkSize: 64 * 1024, options: { namespaceAware: true, autoDecodeEntities: true } }));
  const p3Fixtures = ['ascii-none', 'rare', 'named-attr', 'numeric-attr', 'named-text', 'mixed'];
  const p3 = p3Fixtures.map((fixture) => ({ id: `P3/${fixture}`, lane: 'P3', fixture, kind: 'event-sync', encoding: 'string', options: { namespaceAware: true, autoDecodeEntities: true } }));
  const p4 = ACTUAL_FIXTURE_IDS.map((name) => ({ id: `P4/${name.replace('.xml', '')}`, lane: 'P4', fixture: name, kind: 'event-sync', encoding: 'bytes', options: { namespaceAware: true, autoDecodeEntities: true } }));
  const g1 = ['named-attr', 'named-text', 'mixed'].flatMap((fixture) => [
    { id: `G1-sync/${fixture}`, lane: 'G1', fixture, kind: 'event-sync', encoding: 'bytes', options: { namespaceAware: true, autoDecodeEntities: false } },
    { id: `G1-async/${fixture}`, lane: 'G1', fixture, kind: 'event-async', encoding: 'chunks', chunkSize: 64 * 1024, options: { namespaceAware: true, autoDecodeEntities: false } },
  ]);
  const g2 = ['named-attr', 'xmlns'].flatMap((fixture) => [
    { id: `G2-aware/${fixture}`, lane: 'G2', fixture, kind: 'event-sync', encoding: 'bytes', options: { namespaceAware: true, autoDecodeEntities: true } },
    { id: `G2-raw/${fixture}`, lane: 'G2', fixture, kind: 'event-sync', encoding: 'bytes', options: { namespaceAware: false, autoDecodeEntities: true } },
  ]);
  const g3 = ['ascii-none', 'mixed', 'named-attr'].flatMap((fixture) => [
    { id: `G3-sync-full/${fixture}`, lane: 'G3', fixture, kind: 'stream-sync', encoding: 'bytes', access: 'full', options: { namespaceAware: true, autoDecodeEntities: true } },
    { id: `G3-sync-type/${fixture}`, lane: 'G3', fixture, kind: 'stream-sync', encoding: 'bytes', access: 'type-only', options: { namespaceAware: true, autoDecodeEntities: true } },
    { id: `G3-async-full/${fixture}`, lane: 'G3', fixture, kind: 'stream-async', encoding: 'chunks', chunkSize: 64 * 1024, access: 'full', options: { namespaceAware: true, autoDecodeEntities: true } },
    { id: `G3-async-type/${fixture}`, lane: 'G3', fixture, kind: 'stream-async', encoding: 'chunks', chunkSize: 64 * 1024, access: 'type-only', options: { namespaceAware: true, autoDecodeEntities: true } },
  ]);
  const g4 = [{ id: 'G4/converter-catalog', lane: 'G4', fixture: 'converter-catalog', kind: 'converter', encoding: 'string', options: { namespaceAware: true, autoDecodeEntities: true } }];
  const g5 = [
    { id: 'G5/event-sync', lane: 'G5', fixture: 'ascii-none', kind: 'event-sync', encoding: 'bytes', cold: true, options: { namespaceAware: true, autoDecodeEntities: true } },
    { id: 'G5/stream-sync', lane: 'G5', fixture: 'ascii-none', kind: 'stream-sync', encoding: 'bytes', cold: true, options: { namespaceAware: true, autoDecodeEntities: true } },
    { id: 'G5/event-async', lane: 'G5', fixture: 'ascii-none', kind: 'event-async', encoding: 'chunks', chunkSize: 2048, cold: true, options: { namespaceAware: true, autoDecodeEntities: true } },
    { id: 'G5/stream-async', lane: 'G5', fixture: 'ascii-none', kind: 'stream-async', encoding: 'chunks', chunkSize: 2048, cold: true, options: { namespaceAware: true, autoDecodeEntities: true } },
  ].flatMap(item => [2, 4].map(kib => ({ ...item, id: `${item.id}-${kib}KiB`, fixture: kib === 2 ? 'complex.xml' : 'books.xml', targetBytes: kib * 1024 })));
  const g6 = ['ascii-none', 'mixed'].map((fixture) => ({ id: `G6/${fixture}`, lane: 'G6', fixture, kind: 'mixed-process', encoding: 'bytes', options: { namespaceAware: true, autoDecodeEntities: true } }));
  const all = { pilot: [...p1, ...p2.slice(0, 2), ...p3.slice(0, 2), ...p4.slice(0, 1)], primary: [...p1, ...p2, ...p3, ...p4], guards: [...g1, ...g2, ...g3, ...g4, ...g5, ...g6], all: [...p1, ...p2, ...p3, ...p4, ...g1, ...g2, ...g3, ...g4, ...g5, ...g6] }[suite];
  if (!all) throw new Error(`Unknown bench suite: ${suite}.`);
  const wanted = chosen(filters.cases, all.map((item) => item.id), '--cases');
  const wantedLanes = chosen(filters.lanes, [...new Set(all.map((item) => item.lane))], '--lanes');
  return all.filter((item) => wanted.includes(item.id) && wantedLanes.includes(item.lane)).map((item) => ({ ...item, sizeMib }));
}

function buildFixtureRecord(id, sizeMib) {
  if (id === 'converter-catalog') {
    const fixture = workerFixture({ kind: 'converter', targetBytes: sizeMib * MIB });
    return { id, kind: 'catalog', bytes: fixture.bytes.length, sha256: sha256Bytes(fixture.bytes) };
  }
  if (id.endsWith('.xml')) {
    const fixture = loadActualFixture(id);
    return { id, kind: fixture.kind, path: fixture.path, bytes: fixture.bytesLength, sha256: fixture.sha256, entityStats: fixture.entityStats };
  }
  const fixture = fixtureById(id, { targetBytes: Math.max(1024, Math.floor(sizeMib * MIB)) });
  return { id, kind: fixture.kind, bytes: fixture.bytesLength, sha256: fixture.sha256, rows: fixture.rows, entityStats: fixture.entityStats, targetBytes: fixture.targetBytes };
}

function runWorker(payload, nodeArgs = []) {
  const workerPath = fileURLToPath(import.meta.url);
  const result = spawnSync(process.execPath, [...nodeArgs, workerPath, '--worker'], {
    env: { ...process.env, ENTITY_SINGLE_EVAL_WORKER: JSON.stringify(payload) },
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`entity-single-eval worker failed (${result.status}): ${result.stderr || result.stdout}`);
  const line = result.stdout.trim().split('\n').at(-1);
  try { return JSON.parse(line); } catch { throw new Error(`Worker returned invalid JSON: ${line}`); }
}

function workerFixture(payload) {
  if (payload.kind === 'converter') {
    // Same catalog contract as harness/cases/converter-catalog.mjs, without
    // importing its package-bound schema (which would load another build).
    const rows = [];
    let size = 19;
    for (let index = 0; size < payload.targetBytes; index++) {
      const row = `<book id="book-${index}"><title>Compiled Batch Plan ${index}</title><author>Author ${index % 97}</author><price>${(10 + (index % 500) / 10).toFixed(2)}</price>${index % 5 === 0 ? '<featured>true</featured>' : ''}</book>`;
      rows.push(row); size += row.length;
    }
    const source = `<catalog>${rows.join('')}</catalog>`;
    return { source, bytes: new TextEncoder().encode(source), options: { documentMode: 'fragment' } };
  }
  if (payload.fixture.endsWith('.xml')) return loadActualFixture(payload.fixture);
  return fixtureById(payload.fixture, { targetBytes: payload.targetBytes, seed: payload.fixtureSeed });
}

async function runTimed(payload, api, fixture) {
  if (payload.kind === 'converter') {
    const result = fixture.schema.parseSync(fixture.bytes, { documentMode: 'fragment', maxEvents: 20_000_000 });
    let checksum = 0, outputCodeUnits = 0;
    for (const book of result.books) for (const key of ['id', 'title', 'author', 'price', 'featured']) {
      const value = String(book[key] ?? '');
      checksum = foldString(checksum, value); outputCodeUnits += value.length;
    }
    checksum = foldString(checksum, result.firstTitle);
    return { eventCount: result.books.length, checksum, outputCodeUnits, counters: readCounters() };
  }
  const input = payload.encoding === 'string' ? fixture.source : fixture.bytes;
  return consumePublic(api, input, {
    ...fixture.options,
    ...payload.options,
    kind: payload.kind,
    access: payload.access,
    chunkSize: payload.chunkSize,
  });
}

async function consumeMixed(api, fixture, options) {
  const results = [];
  for (let index = 0; index < 4; index++) {
    results.push(index % 2 ? consumeSync(api, fixture.bytes, { ...fixture.options, ...options, kind: 'stream-sync' }) : consumeSync(api, fixture.bytes, { ...fixture.options, ...options, kind: 'event-sync' }));
    results.push(consumeSync(api, '<root a="&amp;">small</root>', { ...options, kind: index % 2 ? 'event-sync' : 'stream-sync' }));
  }
  return { eventCount: results.reduce((sum, result) => sum + result.eventCount, 0), checksum: results.reduce((sum, result) => sum + result.checksum, 0), transcriptDigest: results[0].transcriptDigest, outputCodeUnits: results.reduce((sum, result) => sum + result.outputCodeUnits, 0), error: results.find((result) => result.error)?.error ?? null, counters: readCounters() };
}

async function runWorkerPayload(payload) {
  const fixture = workerFixture(payload);
  if (payload.mode === 'cold' || payload.cold) {
    const input = payload.encoding === 'string' ? fixture.source : fixture.bytes;
    const startedImport = performance.now();
    const imported = await importPublicBuild(payload.entry);
    const importMs = performance.now() - startedImport;
    const Reader = payload.kind === 'event-sync' ? imported.EventReaderSync : payload.kind === 'stream-sync' ? imported.StreamReaderSync : payload.kind === 'event-async' ? imported.EventReader : imported.StreamReader;
    const startedConstructor = performance.now();
    const reader = new Reader(payload.kind.endsWith('async') ? (async function* () { yield input; })() : input, { ...fixture.options, ...payload.options });
    const constructorMs = performance.now() - startedConstructor;
    const startedFirst = performance.now();
    const first = await reader.next();
    const firstNextMs = performance.now() - startedFirst;
    const startedClose = performance.now();
    await reader.close();
    const closeMs = performance.now() - startedClose;
    const startedFull = performance.now();
    const full = await runTimed(payload, imported, fixture);
    const fullMs = performance.now() - startedFull;
    if (full.error) throw new Error(`${payload.variant}/${payload.fixture} cold full parse failed: ${full.error.name}: ${full.error.message}`);
    return { mode: 'cold', importMs, constructorMs, firstNextMs, closeMs, firstNextCloseMs: constructorMs + firstNextMs + closeMs, fullMs, samples: [{ ms: fullMs }], fullEventCount: full.eventCount, fullChecksum: full.checksum, firstType: first?.value?.type ?? first, counters: readCounters() };
  }
  const api = await importPublicBuild(payload.entry);
  if (payload.kind === 'converter') {
    const { x } = await importPublicBuild(payload.converterEntry);
    const book = x.object({ id: x.string().xpath('./@id'), title: x.string().xpath('./title'), author: x.string().xpath('./author'), price: x.number().xpath('./price'), featured: x.string().xpath('./featured').optional() });
    fixture.schema = x.object({ books: x.array(book, '/catalog/book'), firstTitle: x.string().xpath('/catalog/book/title').optional() });
  }
  let canonicalDigest;
  if (payload.block === 0 && payload.kind.startsWith('event-')) {
    const verification = await consumePublic(api, payload.encoding === 'string' ? fixture.source : fixture.bytes, { ...fixture.options, ...payload.options, kind: payload.kind, chunkSize: payload.chunkSize, canonical: 'digest' });
    if (verification.error) throw new Error(JSON.stringify(verification.error));
    canonicalDigest = verification.transcriptDigest;
  }
  const warmups = payload.warmups ?? 0;
  for (let index = 0; index < warmups; index++) {
    const result = payload.kind === 'mixed-process' ? await consumeMixed(api, fixture, payload.options) : await runTimed(payload, api, fixture);
    if (result.error) throw new Error(`${payload.variant}/${payload.fixture} warmup parse failed: ${result.error.name}: ${result.error.message}`);
  }
  const samples = [];
  let expected;
  for (let index = 0; index < (payload.runs ?? 1); index++) {
    const started = performance.now();
    const result = payload.kind === 'mixed-process' ? await consumeMixed(api, fixture, payload.options) : await runTimed(payload, api, fixture);
    const elapsedMs = performance.now() - started;
    if (result.error) throw new Error(`${payload.variant}/${payload.fixture} parse failed: ${result.error.name}: ${result.error.message}`);
    const signature = [result.eventCount, result.checksum, result.outputCodeUnits].join('/');
    if (expected !== undefined && expected !== signature) throw new Error('Unstable consumer output across samples.');
    expected = signature;
    samples.push({ ms: elapsedMs, eventCount: result.eventCount, checksum: result.checksum, transcriptDigest: result.transcriptDigest, outputCodeUnits: result.outputCodeUnits, counters: result.counters });
  }
  return { mode: 'warm', variant: payload.variant, lane: payload.lane, fixture: payload.fixture, kind: payload.kind, encoding: payload.encoding, block: payload.block, samples, canonicalDigest, fixtureSha256: sha256Bytes(fixture.bytes), fixtureBytes: fixture.bytes.length, options: { ...fixture.options, schema: undefined, ...payload.options }, argv: process.argv };
}

function parityInputs(sizeMib) {
  const result = FIXTURE_IDS.map((id) => ({ id, fixture: id, targetBytes: Math.max(1024, Math.floor(sizeMib * MIB)), options: fixtureOptions(id) }));
  result.push(
    { id: 'edge-prolog', source: '\ufeff<?xml version="1.0"?><root xmlns="urn:x"><a q="&amp;lt;">한😀</a><![CDATA[&amp;]]><!-- &amp; --><?p data?></root>', options: { documentMode: 'document', namespaceAware: true, autoDecodeEntities: true } },
    { id: 'edge-custom', source: '<root><a v="&company; &empty; &literalAmp;">&company;</a></root>', options: { documentMode: 'document', namespaceAware: true, autoDecodeEntities: true, addEntities: [{ entity: 'company', value: 'Clickin & Co.' }, { entity: 'empty', value: '' }, { entity: 'literalAmp', value: 'A&B' }] } },
    { id: 'error-unknown', source: '<root a="&unknown;"><x/></root>', options: { documentMode: 'document', namespaceAware: true, autoDecodeEntities: true } },
    { id: 'error-missing-semicolon', source: '<root a="&amp"><x/></root>', options: { documentMode: 'document', namespaceAware: true, autoDecodeEntities: true } },
    { id: 'error-raw-attr-less', source: '<root a="x<y"/>', options: { documentMode: 'document', namespaceAware: true, autoDecodeEntities: true } },
    { id: 'error-mismatch', source: '<root><x></root>', options: { documentMode: 'document', namespaceAware: true, autoDecodeEntities: true } },
  );
  return result;
}

function parityPayload(input, variant, trace = true) {
  const source = input.source ?? workerFixture(input);
  const bytes = typeof source === 'string' ? new TextEncoder().encode(source) : source.bytes;
  return { ...input, source: undefined, bytes: [...bytes], entry: variant.entry, variant: variant.id, trace, kind: 'event-sync', encoding: 'bytes' };
}

function runParity(manifest, options) {
  const sizeMib = Number(options['size-mib'] ?? 0.004);
  const selected = chosen(options.cases, parityInputs(sizeMib).map((item) => item.id), '--cases');
  const variants = manifest.variants;
  const cases = [];
  for (const input of parityInputs(sizeMib).filter((item) => selected.includes(item.id))) {
    const outputs = {};
    for (const variant of variants) outputs[variant.id] = runWorker({ mode: 'parity', ...parityPayload(input, variant) });
    const reference = outputs.R0;
    const rows = {};
    for (const variant of variants) {
      const output = outputs[variant.id];
      const equal = JSON.stringify(output.events) === JSON.stringify(reference.events) && JSON.stringify(output.error) === JSON.stringify(reference.error) && JSON.stringify(output.trace) === JSON.stringify(reference.trace);
      rows[variant.id] = { equal, eventCount: output.events.length, transcriptDigest: output.transcriptDigest, error: output.error };
    }
    cases.push({ id: input.id, variants: rows, parity: Object.values(rows).every((row) => row.equal), referenceTrace: reference.trace });
  }
  const output = { schemaVersion: 1, generatedAt: new Date().toISOString(), suite: options.suite ?? 'all', cases, pass: cases.every((item) => item.parity) };
  if (!output.pass) throw new Error(`Parity mismatch: ${JSON.stringify(cases.filter((item) => !item.parity))}`);
  return output;
}

function runBench(manifest, options) {
  const suite = options.suite ?? 'primary';
  const blocks = positive(options.blocks, '--blocks', suite === 'pilot' ? 3 : 7);
  const startBlock = nonNegative(options['start-block'], '--start-block', 0);
  const warmups = nonNegative(options.warmups, '--warmups', suite === 'pilot' ? 3 : 6);
  const runs = positive(options.runs, '--runs', 5);
  const sizeMib = Number(options['size-mib'] ?? (suite === 'pilot' ? 4 : DEFAULT_SIZE_MIB));
  if (!Number.isFinite(sizeMib) || sizeMib <= 0) throw new Error('--size-mib must be positive.');
  const cases = caseRows(suite, sizeMib, { cases: options.cases, lanes: options.lanes });
  const rows = [];
  const processOrder = [];
  for (const item of cases) {
    let blocked;
    for (let block = startBlock; block < startBlock + blocks; block++) {
      if (blocked) {
        rows.push({ case: item.id, lane: item.lane, fixture: item.fixture, kind: item.kind, encoding: item.encoding, block, status: 'NOT RUN', reason: blocked, variants: {} });
        continue;
      }
      const order = seededOrder(manifest.variants.map((variant) => variant.id), PROCESS_ORDER_SEED + block + item.id.length);
      processOrder.push({ case: item.id, block, order });
      const variants = {};
      for (const id of order) {
        const variant = manifest.variants.find((candidate) => candidate.id === id);
        try {
          variants[id] = runWorker({ mode: 'bench', ...item, targetBytes: item.targetBytes ?? Math.max(1024, Math.floor(sizeMib * MIB)), fixtureSeed: manifest.fixtureSeed, variant: id, entry: variant.entry, converterEntry: variant.converterEntry, warmups, runs, block });
        } catch (error) {
          variants[id] = { status: 'NOT RUN', error: error.message, samples: [] };
        }
      }
      if (Object.values(variants).some(v => v.error)) blocked = Object.fromEntries(Object.entries(variants).filter(([, v]) => v.error).map(([id, v]) => [id, v.error]));
      const signatures = Object.values(variants).map(v => JSON.stringify(v.mode === 'cold' ? [v.fullEventCount, v.fullChecksum] : v.samples?.map(s => [s.eventCount, s.checksum, s.outputCodeUnits])));
      if (!blocked && new Set(signatures).size !== 1) throw new Error(`Consumer mismatch: ${item.id}`);
      if (!blocked && new Set(Object.values(variants).map(v => v.canonicalDigest)).size !== 1) throw new Error(`Canonical digest mismatch: ${item.id}`);
      rows.push({ case: item.id, lane: item.lane, fixture: item.fixture, kind: item.kind, encoding: item.encoding, block, order, variants, status: blocked ? 'NOT RUN' : 'PASS', reason: blocked });
      writeOutput(options.out + '.partial', { rows, processOrder });
    }
  }
  const fixtureIds = [...new Set(cases.map((item) => item.fixture))];
  const fixtures = fixtureIds.map((id) => buildFixtureRecord(id, sizeMib));
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), suite, builds: manifest, options: { blocks, startBlock, warmups, runs, sizeMib }, environment: { node: process.version, versions: process.versions, platform: process.platform, osRelease: release(), cpu: cpus()[0]?.model, arch: process.arch, argv: process.argv }, fixtureSeed: manifest.fixtureSeed, processOrderSeed: manifest.processOrderSeed, fixtures, rows, processOrder };
}

function runDiagnose(manifest, options) {
  const inputs = [
    ['named-attr', '<r xmlns:p="urn:a&amp;b" a="&amp;&lt;&gt;&quot;&apos;">plain</r>'],
    ['numeric-attr', '<r a="&#65;&#x1f600;">plain</r>'],
    ['custom-attr', '<r a="&empty;&literalAmp;&company;">plain</r>'],
    ['named-text', '<r a="plain">&amp;&lt;&gt;&quot;&apos;</r>'],
    ['mixed', '<r a="한글&#65;&empty;">😀&amp;&#x41;</r>'],
  ].map(([id, source]) => ({ id, source, options: fixtureOptions(id) }));
  const selected = chosen(options.cases, inputs.map((item) => item.id), '--cases');
  const rows = [];
  for (const input of inputs.filter((item) => selected.includes(item.id))) {
    for (const variant of manifest.variants.filter((item) => item.instrumented)) {
      const output = runWorker({ mode: 'diagnose', ...parityPayload(input, variant, false), options: { ...input.options, autoDecodeEntities: true } });
      const counters = output.counters ?? {};
      const rawOccurrences = (input.source.match(/&[^;]+;/g) ?? []).length;
      const resolverCalls = Number(counters.decodeEntity ?? counters.resolve ?? 0);
      const namespaceCalls = Number(counters.namespace ?? counters.namespaceResolve ?? 0);
      const materializerCalls = Number(counters.materializer ?? counters.materializerResolve ?? 0);
      const fused = variant.id === 'AT1' || variant.id === 'A1' && input.id.endsWith('-attr');
      rows.push({ fixture: input.id, variant: variant.id, counters, eventCount: output.events.length, rawOccurrences, resolverCalls, namespaceCalls, materializerCalls, assertion: { rawOccurrenceObserved: rawOccurrences > 0, fusedConsumersZero: !fused || namespaceCalls === 0 && materializerCalls === 0, singleEvaluation: !fused || resolverCalls === rawOccurrences, correctCursor: variant.id === 'R0' ? counters.cursorReference === 1 : counters.cursorMaterializing === 1 } });
    }
  }
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), rows, pass: rows.every((row) => Object.values(row.assertion).every(Boolean)) };
}

async function runWorkerMode() {
  const payload = JSON.parse(process.env.ENTITY_SINGLE_EVAL_WORKER ?? '{}');
  if (payload.mode === 'parity' || payload.mode === 'diagnose') {
    const input = payload.bytes ? { ...payload, bytes: Uint8Array.from(payload.bytes) } : payload;
    const source = input.source ?? Uint8Array.from(input.bytes);
    const api = await importPublicBuild(payload.entry);
    const trace = payload.trace ? [] : undefined;
    globalThis.__entitySingleEval = {};
    const result = await consumePublic(api, source, { ...payload.options, kind: payload.kind ?? 'event-sync', canonical: true, trace, chunkSize: payload.chunkSize });
    process.stdout.write(`${JSON.stringify({ events: result.events, transcriptDigest: result.transcriptDigest, error: result.error, trace, counters: result.counters })}\n`);
    return;
  }
  const result = await runWorkerPayload(payload);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function writeOutput(path, output) {
  if (!path) return;
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(resolve(path), `${JSON.stringify(output, null, 2)}\n`);
}

export async function main(args = process.argv.slice(2)) {
  if (args[0] === '--worker') return runWorkerMode();
  const { command, options } = parseArgs(args.slice());
  if (command === 'help') {
    console.log('Usage: entity-single-eval.mjs <parity|bench|retention|diagnose> --manifest PATH [options]');
    return;
  }
  if (command === 'retention') {
    const manifest = loadBuildManifest(options.manifest);
    const counts = options.counts?.split(',').map((value) => positive(value, '--counts'));
    const output = runRetention(manifest, { counts, repeats: options.repeats ? positive(options.repeats, '--repeats') : undefined, valueBytes: options['value-kib'] ? positive(options['value-kib'], '--value-kib') * 1024 : undefined, runner: fileURLToPath(import.meta.url) });
    writeOutput(options.out, output);
    return output;
  }
  const manifest = loadBuildManifest(options.manifest, { checkFingerprints: true });
  if (command === 'bench' && manifest.variants.some(v => v.instrumented)) throw new Error('Instrumented builds cannot be timed.');
  if (command === 'diagnose' && manifest.variants.some(v => !v.instrumented)) throw new Error('Diagnose requires instrumented builds.');
  let output;
  if (command === 'parity') output = runParity(manifest, options);
  else if (command === 'bench') output = runBench(manifest, options);
  else output = runDiagnose(manifest, options);
  writeOutput(options.out, output);
  if (output.pass === false) process.exitCode = 1;
  if (!options.out) console.log(JSON.stringify(output, null, 2));
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
