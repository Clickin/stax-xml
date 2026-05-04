import { closeSync, openSync, readSync, statSync } from 'node:fs';
import { CursorEventType, CursorReader, CursorReaderAsync } from '../stax-xml/src/cursor/index.ts';

type ScenarioId = 'cursor-public-sync' | 'cursor-public-sync-lean' | 'cursor-public-async-lean';

const DEFAULT_CHUNK_SIZE = 1024 * 1024;

const scenarioIds: ScenarioId[] = [
  'cursor-public-sync',
  'cursor-public-sync-lean',
  'cursor-public-async-lean',
];

const options = parseArgs();

function parseArgs(argv = runtimeArgs()) {
  const result = {
    file: '',
    runs: 1,
    warmups: 0,
    chunkSize: DEFAULT_CHUNK_SIZE,
    scenarios: scenarioIds,
    runtimeId: detectRuntimeId(),
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;
    if (arg === '--') continue;
    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error(`${arg} requires a value.`);
      }
      index++;
      return value;
    };

    switch (name) {
      case '--file':
        result.file = readValue();
        break;
      case '--runs':
        result.runs = parsePositiveInteger(readValue(), '--runs');
        break;
      case '--warmups':
        result.warmups = parseNonNegativeInteger(readValue(), '--warmups');
        break;
      case '--chunk-size':
        result.chunkSize = parsePositiveInteger(readValue(), '--chunk-size');
        break;
      case '--scenarios':
        result.scenarios = parseScenarios(readValue());
        break;
      case '--runtime-id':
        result.runtimeId = readValue();
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!result.file) {
    throw new Error('--file is required.');
  }
  return result;
}

function runtimeArgs(): string[] {
  const deno = (globalThis as { Deno?: { args: string[] } }).Deno;
  return deno?.args ?? (globalThis as { process?: { argv?: string[] } }).process?.argv?.slice(2) ?? [];
}

function detectRuntimeId(): string {
  if ((globalThis as { Deno?: unknown }).Deno) return 'deno';
  if ((globalThis as { Bun?: unknown }).Bun) return 'bun';
  return 'node';
}

function runtimeVersion(): string {
  const deno = (globalThis as { Deno?: { version?: { deno: string; v8: string } } }).Deno;
  if (deno?.version) {
    return `${deno.version.deno} (v8 ${deno.version.v8})`;
  }
  const bun = (globalThis as { Bun?: { version?: string } }).Bun;
  if (bun?.version) {
    return bun.version;
  }
  return (globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node ?? 'unknown';
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function parseNonNegativeInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }
  return parsed;
}

function parseScenarios(value: string): ScenarioId[] {
  const selected = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  for (const id of selected) {
    if (!(scenarioIds as string[]).includes(id)) {
      throw new Error(`Unknown scenario: ${id}`);
    }
  }
  return selected as ScenarioId[];
}

function* byteBatchesFromFile(filePath: string, chunkSize: number): Iterable<readonly Uint8Array[]> {
  const fd = openSync(filePath, 'r');
  const buffer = new Uint8Array(chunkSize);
  try {
    while (true) {
      const bytesRead = readSync(fd, buffer, 0, buffer.byteLength, null);
      if (bytesRead <= 0) {
        return;
      }
      yield [buffer.slice(0, bytesRead)];
    }
  } finally {
    closeSync(fd);
  }
}

function byteStreamFromFile(filePath: string, chunkSize: number): ReadableStream<Uint8Array> {
  let fd: number | undefined;
  const buffer = new Uint8Array(chunkSize);

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      fd ??= openSync(filePath, 'r');
      const bytesRead = readSync(fd, buffer, 0, buffer.byteLength, null);
      if (bytesRead <= 0) {
        closeOpenFd();
        controller.close();
        return;
      }
      controller.enqueue(buffer.slice(0, bytesRead));
    },
    cancel() {
      closeOpenFd();
    },
  });

  function closeOpenFd() {
    if (fd !== undefined) {
      closeSync(fd);
      fd = undefined;
    }
  }
}

function gcNow(): void {
  const maybeGc = (globalThis as { gc?: () => void }).gc;
  if (maybeGc) {
    maybeGc();
  }
  const bunGc = (globalThis as { Bun?: { gc?: (force?: boolean) => void } }).Bun?.gc;
  if (bunGc) {
    bunGc(true);
  }
}

function mixChecksum(seed: number, value: number): number {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function foldString(seed: number, value: string | undefined): number {
  if (!value) {
    return seed;
  }
  let next = seed;
  for (let index = 0; index < value.length; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
}

function consumeSync(namespaceAware: boolean): { events: number; checksum: number } {
  const cursor = new CursorReader(byteBatchesFromFile(options.file, options.chunkSize), { namespaceAware });
  let events = 0;
  let checksum = 0;
  while (cursor.next()) {
    events++;
    checksum = consumeCurrentEvent(cursor, checksum);
  }
  return { events, checksum };
}

async function consumeAsyncLean(): Promise<{ events: number; checksum: number }> {
  const cursor = new CursorReaderAsync(byteStreamFromFile(options.file, options.chunkSize), { namespaceAware: false });
  let events = 0;
  let checksum = 0;
  while (await cursor.next()) {
    events++;
    checksum = consumeCurrentEvent(cursor, checksum);
  }
  return { events, checksum };
}

function consumeCurrentEvent(
  cursor: CursorReader | CursorReaderAsync,
  currentChecksum: number,
): number {
  const type = cursor.eventType();
  let checksum = mixChecksum(currentChecksum, type);
  if (type === CursorEventType.START_ELEMENT || type === CursorEventType.END_ELEMENT) {
    checksum = foldString(checksum, cursor.name());
  }
  if (type === CursorEventType.CHARACTERS || type === CursorEventType.CDATA) {
    checksum = foldString(checksum, cursor.text()?.trim());
  }
  if (type === CursorEventType.START_ELEMENT) {
    const attrCount = cursor.getAttributeCount();
    checksum = mixChecksum(checksum, attrCount);
    for (let index = 0; index < attrCount; index++) {
      checksum = foldString(checksum, cursor.getAttributeName(index));
      checksum = foldString(checksum, cursor.getAttributeValue(index));
    }
  }
  return checksum;
}

async function measureScenario(id: ScenarioId, fileSizeMiB: number) {
  const run = id === 'cursor-public-sync'
    ? () => Promise.resolve(consumeSync(true))
    : id === 'cursor-public-sync-lean'
      ? () => Promise.resolve(consumeSync(false))
      : () => consumeAsyncLean();

  for (let index = 0; index < options.warmups; index++) {
    await run();
  }

  const samplesMs: number[] = [];
  let events = 0;
  let checksum = 0;
  for (let index = 0; index < options.runs; index++) {
    gcNow();
    const startedAt = performance.now();
    const result = await run();
    const elapsedMs = performance.now() - startedAt;
    if (index > 0 && (result.events !== events || result.checksum !== checksum)) {
      throw new Error(`${id} produced unstable event count or checksum.`);
    }
    events = result.events;
    checksum = result.checksum;
    samplesMs.push(elapsedMs);
  }

  const avgMs = samplesMs.reduce((sum, value) => sum + value, 0) / samplesMs.length;
  return {
    id,
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    mibPerSec: fileSizeMiB / (avgMs / 1000),
    events,
    checksum,
    samplesMs,
  };
}

async function main() {
  const stats = statSync(options.file);
  const fileSizeMiB = stats.size / 1024 / 1024;
  const scenarios = [];
  for (const id of options.scenarios) {
    scenarios.push(await measureScenario(id, fileSizeMiB));
  }

  const baseline = scenarios[0];
  for (const scenario of scenarios) {
    if (scenario.events !== baseline?.events || scenario.checksum !== baseline?.checksum) {
      throw new Error(`Parity mismatch in ${scenario.id}.`);
    }
  }

  console.log(JSON.stringify({
    runtime: {
      id: options.runtimeId,
      version: runtimeVersion(),
    },
    file: {
      path: options.file,
      sizeBytes: stats.size,
      sizeMiB: fileSizeMiB,
    },
    options: {
      runs: options.runs,
      warmups: options.warmups,
      chunkSize: options.chunkSize,
    },
    scenarios,
  }));
}

await main();
