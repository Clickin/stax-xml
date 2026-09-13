import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { setImmediate as waitImmediate } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { importPublicBuild } from './consume.mjs';

export const RETENTION_COUNTS = [16, 64, 128, 256];
export const RETENTION_REPEATS = 5;
export const RETENTION_SCENARIOS = ['first', 'last', 'dense', 'customempty', 'none', 'rare-attr', 'rare-text'];
export const RETENTION_MODES = ['normalized-result', 'raw', 'positive-control', 'plus-diagnostic'];
const CUSTOM_ENTITIES = [
  { entity: 'company', value: 'Clickin & Co.' },
  { entity: 'empty', value: '' },
  { entity: 'literalAmp', value: 'A&B' },
];

function usage() {
  const value = process.memoryUsage?.();
  return { rssBytes: value?.rss ?? null, heapUsedBytes: value?.heapUsed ?? null, externalBytes: value?.external ?? null };
}

function gcMany() {
  if (typeof globalThis.gc !== 'function') return 0;
  for (let index = 0; index < 5; index++) globalThis.gc();
  return 5;
}

export async function settleHeap() {
  let turns = 0;
  for (let index = 0; index < 5; index++) {
    await waitImmediate();
    turns++;
    gcMany();
  }
  return turns;
}

function scenarioEntity(scenario, index, count) {
  if (scenario === 'none') return null;
  if (scenario === 'dense') return 'named';
  if (scenario === 'customempty') return 'custom-empty';
  if (scenario === 'first' || scenario === 'last') return 'named';
  if (scenario === 'rare-attr') return index === 0 ? 'named' : null;
  if (scenario === 'rare-text') return index === 0 ? 'named' : null;
  return null;
}

function escapedValues(scenario, index, count) {
  const entity = scenarioEntity(scenario, index, count);
  const unique = `retained-value-${index}-`.padEnd(32, 'x');
  if (entity === 'custom-empty') return { attribute: '&empty;', text: '&empty;' };
  if (scenario === 'first') return { attribute: `&amp;${unique}`, text: `&lt;${unique}` };
  if (scenario === 'last') return { attribute: `${unique}&amp;`, text: `${unique}&lt;` };
  if (scenario === 'dense') return { attribute: `${'&amp;'.repeat(24)}${index}`, text: `${'&lt;'.repeat(24)}${index}` };
  if (scenario === 'rare-attr') return entity ? { attribute: 'before &amp; after', text: `text-${index}` } : { attribute: `plain-${index}`, text: `text-${index}` };
  if (scenario === 'rare-text') return entity ? { attribute: `plain-${index}`, text: 'text &lt; value' } : { attribute: `plain-${index}`, text: `text-${index}` };
  if (entity) return { attribute: 'before &amp; after', text: 'text &lt; value' };
  return { attribute: `plain-${index}`, text: `text-${index}` };
}

function byteLength(value) {
  return typeof value === 'string' ? Buffer.byteLength(value) : value?.byteLength ?? 0;
}

function sourceForDocument(scenario = 'none', index = 0, count = 16, valueBytes = 256 * 1024) {
  const values = escapedValues(scenario, index, count);
  const paddingBytes = Math.max(32, Math.floor(valueBytes / 2));
  const token = `${index.toString(36)}-`;
  const repeated = token.repeat(Math.ceil(paddingBytes / token.length)).slice(0, paddingBytes);
  return `<root><r id="ret-${index}"><discard>${repeated}</discard><v a="${values.attribute}">${values.text}</v><discard>${repeated}</discard></r></root>`;
}

function retentionOptions(mode) {
  return {
    documentMode: 'document',
    namespaceAware: true,
    autoDecodeEntities: mode !== 'raw',
    addEntities: CUSTOM_ENTITIES,
  };
}

function isTargetStart(event) {
  return event?.type === 'START_ELEMENT' && (event.name === 'v' || event.localName === 'v');
}

function isTargetEnd(event) {
  return event?.type === 'END_ELEMENT' && (event.name === 'v' || event.localName === 'v');
}

function buildPlusDiagnostic(source, value) {
  // Deliberately reproduce the rejected builder: source slices longer than a
  // short-string threshold can keep the large document alive.
  const prefixLength = 14;
  const suffixLength = 14;
  const prefix = source.slice(0, prefixLength);
  const suffix = source.slice(Math.max(prefixLength, source.length - suffixLength));
  return prefix + value + suffix;
}

function parseDocument(api, source, mode) {
  const returned = [];
  const diagnostics = [];
  let inTarget = false;
  let reader;
  try {
    reader = new api.EventReaderSync(source, retentionOptions(mode));
    for (const event of reader) {
      if (isTargetStart(event)) {
        inTarget = true;
        if (event.attributes) {
          for (const attribute of event.attributes.values()) {
            if (attribute?.name !== 'a' && attribute?.localName !== 'a') continue;
            returned.push(String(attribute.value ?? ''));
          }
        }
      } else if (event.type === 'CHARACTERS' && inTarget) {
        returned.push(String(event.value ?? ''));
      } else if (isTargetEnd(event)) {
        inTarget = false;
      }
    }
  } finally {
    try { reader?.close(); } finally { reader = null; }
  }
  if (mode === 'plus-diagnostic') {
    for (const value of returned) diagnostics.push(buildPlusDiagnostic(source, value));
  }
  return { returned, diagnostics };
}

export async function runRetentionWorker(payload) {
  const api = await importPublicBuild(payload.entry);
  const mode = payload.mode ?? 'normalized-result';
  const scenario = payload.scenario ?? 'none';
  const count = payload.count ?? 16;
  const valueBytes = payload.valueBytes ?? 256 * 1024;
  await settleHeap();
  const before = usage();
  const returned = [];
  const diagnostics = [];
  const retainedSources = [];
  let sourceBytes = 0;
  let source;
  const started = performance.now();
  for (let index = 0; index < count; index++) {
    source = payload.source && index === 0 ? payload.source : sourceForDocument(scenario, index, count, valueBytes);
    sourceBytes += byteLength(source);
    const parsed = parseDocument(api, source, mode);
    returned.push(...parsed.returned);
    diagnostics.push(...parsed.diagnostics);
    if (mode === 'positive-control') retainedSources.push(source);
    source = null;
  }
  // The arrays are intentionally read after all GC turns, so the retained
  // values cannot be optimized away before the endpoint measurement.
  await settleHeap();
  let keptChars = 0;
  for (const value of returned) keptChars += value.length;
  let plusDiagnosticChars = 0;
  for (const value of diagnostics) plusDiagnosticChars += value.length;
  void returned.length;
  void diagnostics.length;
  const after = usage();
  const result = {
    variant: payload.variant,
    mode,
    scenario,
    count,
    repeat: payload.repeat ?? 0,
    sourceBytes,
    documents: count,
    keptChars,
    keptStrings: returned.length,
    returnedChars: keptChars,
    retainedStrings: returned.length,
    retainedHeapBytes: after.heapUsedBytes,
    heapDeltaBytes: after.heapUsedBytes - before.heapUsedBytes,
    rssBytes: after.rssBytes,
    sourceHeldBytes: retainedSources.reduce((sum, value) => sum + byteLength(value), 0),
    gcCycles: typeof globalThis.gc === 'function' ? 25 : 0,
    eventLoopTurns: 5,
    elapsedMs: performance.now() - started,
    plusDiagnosticChars,
    diagnostic: mode === 'plus-diagnostic' ? 'plus-equals-source-slices' : null,
    counters: globalThis.__entitySingleEval && typeof globalThis.__entitySingleEval === 'object' ? { ...globalThis.__entitySingleEval } : {},
  };
  result.keptUnits = keptChars;
  return result;
}

function parsePayload() {
  const raw = process.env.ENTITY_SINGLE_EVAL_RETENTION;
  if (!raw) throw new Error('ENTITY_SINGLE_EVAL_RETENTION payload is required.');
  return JSON.parse(raw);
}

export function spawnRetentionWorker(payload, options = {}) {
  const runner = options.runner ?? process.argv[1];
  const nodeArgs = [...(options.nodeArgs ?? [])];
  if (process.release?.name === 'node' && !nodeArgs.includes('--expose-gc')) nodeArgs.unshift('--expose-gc');
  const args = [...nodeArgs, runner, '--retention-worker'];
  const result = spawnSync(process.execPath, args, {
    cwd: options.cwd,
    env: { ...process.env, ENTITY_SINGLE_EVAL_RETENTION: JSON.stringify(payload) },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`Retention worker failed (${result.status}): ${result.stderr || result.stdout}`);
  const output = result.stdout.trim().split('\n').at(-1);
  return JSON.parse(output);
}

function validatePlan(counts, repeats) {
  if (!Array.isArray(counts) || !counts.length || counts.some((count) => !Number.isInteger(count) || count <= 0)) throw new Error('Retention counts must be positive integers.');
  if (!Number.isInteger(repeats) || repeats <= 0) throw new Error('Retention repeats must be a positive integer.');
  if (counts.some((count) => count >= 64) && repeats < 5) throw new Error('Retention counts >=64 require at least 5 repeats.');
}

export function runRetention(manifest, options = {}) {
  const counts = options.counts ?? RETENTION_COUNTS;
  const repeats = options.repeats ?? RETENTION_REPEATS;
  const valueBytes = options.valueBytes ?? 256 * 1024;
  validatePlan(counts, repeats);
  if (!Number.isInteger(valueBytes) || valueBytes <= 0) throw new Error('Retention valueBytes must be a positive integer.');
  const rows = [];
  const variants = (manifest?.variants ?? []).filter((variant) => !variant.instrumented);
  if (!variants.length) throw new Error('Retention manifest has no runnable variants.');
  for (const variant of variants) {
    for (const mode of RETENTION_MODES) {
      for (const scenario of RETENTION_SCENARIOS) {
        for (const count of counts) {
          for (let repeat = 0; repeat < repeats; repeat++) {
            // The worker flag belongs to this module, not the parent driver.
            rows.push(spawnRetentionWorker({ variant: variant.id, entry: variant.entry, mode, scenario, count, repeat, valueBytes }, { ...options, runner: fileURLToPath(import.meta.url) }));
          }
        }
      }
    }
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    options: { counts, repeats, valueBytes, scenarios: RETENTION_SCENARIOS, modes: RETENTION_MODES, exposeGc: rows.every(row => row.gcCycles === 25) },
    rows,
  };
}

export function parseRetentionArgs(args = process.argv.slice(2)) {
  const options = {};
  const allowed = new Set(['--manifest', '--out', '--counts', '--repeats', '--value-kib']);
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const [name, inline] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    if (!allowed.has(name)) throw new Error(`Unknown argument: ${name}`);
    const value = inline ?? args[++index];
    if (value === undefined) throw new Error(`${name} requires a value.`);
    if (name === '--counts') options.counts = value.split(',').map(Number);
    else if (name === '--repeats') options.repeats = Number(value);
    else if (name === '--value-kib') options.valueBytes = Number(value) * 1024;
    else options[name.slice(2)] = value;
  }
  if (!options.manifest || !options.out) throw new Error('--manifest and --out are required.');
  validatePlan(options.counts ?? RETENTION_COUNTS, options.repeats ?? RETENTION_REPEATS);
  if (options.valueBytes !== undefined && (!Number.isInteger(options.valueBytes) || options.valueBytes <= 0)) throw new Error('--value-kib must be a positive integer.');
  return options;
}

export async function main(args = process.argv.slice(2)) {
  if (args[0] === '--retention-worker') {
    process.stdout.write(`${JSON.stringify(await runRetentionWorker(parsePayload()))}\n`);
    return;
  }
  const options = parseRetentionArgs(args);
  const manifest = JSON.parse(readFileSync(options.manifest, 'utf8'));
  const output = runRetention(manifest, options);
  writeFileSync(options.out, `${JSON.stringify(output, null, 2)}\n`);
  return output;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
