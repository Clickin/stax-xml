import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync, statSync, writeSync } from 'node:fs';
import { open as openFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance, PerformanceObserver, constants as perfConstants } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { EventReader } from '../stax-xml/src/EventReader.ts';
import { createJavaScriptIterableReader } from '../stax-xml/src/IterableReader.ts';
import { StreamReaderSync, StreamEventType, type StreamReaderSyncRawBatch } from '../stax-xml/src/StreamReaderSync.ts';
import { CursorReader, CursorReaderAsync } from '../stax-xml/src/cursor/index.ts';
import { NodeCurrentCursor } from '../stax-xml/src/iterable/NodeCurrentCursor.ts';
import { nodeFileByteBatchesSync } from '../stax-xml/src/iterable/node.ts';
import { initStaxXml, resetStaxXmlRuntimeForTests } from '../stax-xml/src/runtime/index.ts';
import { XmlEventType } from '../stax-xml/src/types.ts';
import { CursorEventView } from '../stax-xml/src/cursor/CursorEventView.ts';
import { CursorEventType } from '../stax-xml/src/cursor/types.ts';

const defaultFixture = {
  id: '4gib',
  label: '4GiB',
  targetBytes: 4 * 1024 ** 3,
};
const utf8Decoder = new TextDecoder();
const chunkSize = 1024 * 1024;
const batchSize = 1;
const progressEveryBatches = 256;
const sampleEveryEvents = 50_000;

const caseIds = [
  'stream-native-public',
  'stream-native-raw',
  'iterable-js-fallback',
  'cursor-js-current',
  'cursor-js-direct',
  'cursor-byte-core',
  'cursor-public-sync',
  'cursor-public-async',
  'cursor-public-sync-lean',
  'cursor-public-async-lean',
  'event-native',
  'event-js-fallback',
] as const;

type CaseId = typeof caseIds[number];

const args = parseArgs(process.argv.slice(2));

function runChildCase(caseId: CaseId, filePath: string) {
  const child = spawnSync(
    process.execPath,
    ['--import', 'tsx', fileURLToPath(import.meta.url), '--child-case', caseId, '--size-mib', String(args.sizeMiB)],
    {
      cwd: fileURLToPath(new URL('../..', import.meta.url)),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      maxBuffer: 1024 * 1024,
    },
  );
  if (child.status !== 0) {
    throw new Error(`Child case failed: ${caseId}`);
  }
  return JSON.parse(child.stdout);
}

async function measureCase(caseId: CaseId, filePath: string, fileBytes: number) {
  const peak = { heapPeakBytes: 0, rssPeakBytes: 0 };
  const gc = createGcTracker();
  const updatePeak = () => {
    const current = process.memoryUsage();
    peak.heapPeakBytes = Math.max(peak.heapPeakBytes, current.heapUsed);
    peak.rssPeakBytes = Math.max(peak.rssPeakBytes, current.rss);
  };

  if (globalThis.gc) {
    globalThis.gc();
  }
  await tick();
  updatePeak();
  gc.start();
  const startedAt = performance.now();
  const result = await consumeCase(caseId, filePath, updatePeak);
  const elapsedMs = performance.now() - startedAt;
  await tick();
  gc.stop();
  gc.disconnect();
  updatePeak();

  return {
    caseId,
    elapsedMs,
    throughputMiBs: fileBytes / 1024 / 1024 / (elapsedMs / 1000),
    events: result.events,
    batches: result.batches,
    checksum: result.checksum >>> 0,
    heapPeakBytes: peak.heapPeakBytes,
    rssPeakBytes: peak.rssPeakBytes,
    gc: {
      totalMs: gc.totalMs,
      majorMs: gc.majorMs,
      minorMs: gc.minorMs,
      incrementalMs: gc.incrementalMs,
      weakCbMs: gc.weakCbMs,
      count: gc.count,
      sharePct: elapsedMs === 0 ? 0 : (gc.totalMs / elapsedMs) * 100,
    },
  };
}

async function consumeCase(caseId: CaseId, filePath: string, updatePeak: () => void) {
  switch (caseId) {
    case 'stream-native-public':
      await initStaxXml({ backend: 'native', fallbackOnLoadError: false });
      return consumeStreamReaderPublic(filePath, updatePeak);
    case 'stream-native-raw':
      await initStaxXml({ backend: 'native', fallbackOnLoadError: false });
      return consumeStreamReaderRaw(filePath, updatePeak);
    case 'iterable-js-fallback':
      resetStaxXmlRuntimeForTests();
      return consumeIterableJavaScript(filePath, updatePeak);
    case 'cursor-js-current':
      resetStaxXmlRuntimeForTests();
      return consumeCurrentCursorJavaScript(filePath, updatePeak);
    case 'cursor-js-direct':
      resetStaxXmlRuntimeForTests();
      return consumeDirectCursorJavaScript(filePath, updatePeak);
    case 'cursor-byte-core':
      resetStaxXmlRuntimeForTests();
      return consumeByteCoreCursor(filePath, updatePeak);
    case 'cursor-public-sync':
      resetStaxXmlRuntimeForTests();
      return consumePublicCursorSync(filePath, updatePeak);
    case 'cursor-public-async':
      resetStaxXmlRuntimeForTests();
      return consumePublicCursorAsync(filePath, updatePeak);
    case 'cursor-public-sync-lean':
      resetStaxXmlRuntimeForTests();
      return consumePublicCursorSyncLean(filePath, updatePeak);
    case 'cursor-public-async-lean':
      resetStaxXmlRuntimeForTests();
      return consumePublicCursorAsyncLean(filePath, updatePeak);
    case 'event-native':
      await initStaxXml({ backend: 'native', fallbackOnLoadError: false });
      return consumeEventReader(filePath, false, updatePeak);
    case 'event-js-fallback':
      resetStaxXmlRuntimeForTests();
      return consumeEventReader(filePath, true, updatePeak);
  }
}

function consumeStreamReaderPublic(filePath: string, updatePeak: () => void) {
  const parser = new StreamReaderSync(nodeFileByteBatchesSync(filePath, { chunkSize, batchSize }), {
    documentMode: 'document',
  });
  const state = { events: 0, batches: 0, checksum: 2166136261 >>> 0 };
  for (const batch of parser) {
    for (const event of batch) {
      state.events++;
      state.checksum = mixChecksum(state.checksum, event.type);
      if (event.type === StreamEventType.START_ELEMENT || event.type === StreamEventType.END_ELEMENT) {
        state.checksum = foldString(state.checksum, event.name());
      }
      if (event.type === StreamEventType.CHARACTERS || event.type === StreamEventType.CDATA) {
        state.checksum = foldString(state.checksum, event.text()?.trim());
      }
      const attrCount = event.type === StreamEventType.START_ELEMENT ? event.getAttributeCount() : 0;
      state.checksum = mixChecksum(state.checksum, attrCount);
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        state.checksum = foldString(state.checksum, event.getAttributeName(attrIndex));
        state.checksum = foldString(state.checksum, event.getAttributeValue(attrIndex));
      }
      if (state.events % sampleEveryEvents === 0) updatePeak();
    }
    state.batches++;
    if (state.batches % progressEveryBatches === 0) {
      console.error(`[progress] ${caseLabel('stream-native-public')} batches=${state.batches} events=${state.events}`);
    }
    updatePeak();
  }
  return state;
}

function consumeStreamReaderRaw(filePath: string, updatePeak: () => void) {
  const parser = new StreamReaderSync(nodeFileByteBatchesSync(filePath, { chunkSize, batchSize }), {
    documentMode: 'document',
  });
  const state = { events: 0, batches: 0, checksum: 2166136261 >>> 0 };
  for (;;) {
    const batch = parser.nextRawBatch();
    if (batch === null) break;
    const decodeSpan = createBatchSpanDecoder(batch.buffer);
    for (let eventIndex = 0; eventIndex < batch.eventCount; eventIndex++) {
      const type = rawEventType(batch, eventIndex);
      state.events++;
      state.checksum = mixChecksum(state.checksum, type);
      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        state.checksum = foldString(state.checksum, rawName(batch, eventIndex, decodeSpan));
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        state.checksum = foldString(state.checksum, rawText(batch, eventIndex, decodeSpan)?.trim());
      }
      const attrCount = type === StreamEventType.START_ELEMENT ? rawAttrCount(batch, eventIndex) : 0;
      state.checksum = mixChecksum(state.checksum, attrCount);
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        state.checksum = foldString(state.checksum, rawAttrName(batch, eventIndex, attrIndex, decodeSpan));
        state.checksum = foldString(state.checksum, rawAttrValue(batch, eventIndex, attrIndex, decodeSpan));
      }
      if (state.events % sampleEveryEvents === 0) updatePeak();
    }
    state.batches++;
    if (state.batches % progressEveryBatches === 0) {
      console.error(`[progress] ${caseLabel('stream-native-raw')} batches=${state.batches} events=${state.events}`);
    }
    updatePeak();
  }
  return state;
}

function consumeIterableJavaScript(filePath: string, updatePeak: () => void) {
  const parser = createJavaScriptIterableReader(
    nodeFileByteBatchesSync(filePath, { chunkSize, batchSize }),
    { documentMode: 'document' },
  );
  const state = { events: 0, batches: 0, checksum: 2166136261 >>> 0 };
  while (parser.nextBatch()) {
    for (let eventIndex = 0; eventIndex < parser.eventCount(); eventIndex++) {
      const type = parser.eventType(eventIndex);
      state.events++;
      state.checksum = mixChecksum(state.checksum, type);
      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        state.checksum = foldString(state.checksum, parser.copyName(eventIndex));
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        state.checksum = foldString(state.checksum, parser.copyText(eventIndex)?.trim());
      }
      const attrCount = type === StreamEventType.START_ELEMENT ? parser.attrCount(eventIndex) : 0;
      state.checksum = mixChecksum(state.checksum, attrCount);
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        state.checksum = foldString(state.checksum, parser.copyAttrName(eventIndex, attrIndex));
        state.checksum = foldString(state.checksum, parser.copyAttrValue(eventIndex, attrIndex));
      }
      if (state.events % sampleEveryEvents === 0) updatePeak();
    }
    state.batches++;
    if (state.batches % progressEveryBatches === 0) {
      console.error(`[progress] ${caseLabel('iterable-js-fallback')} batches=${state.batches} events=${state.events}`);
    }
    updatePeak();
  }
  return state;
}

function consumeCurrentCursorJavaScript(filePath: string, updatePeak: () => void) {
  const parser = createJavaScriptIterableReader(
    nodeFileByteBatchesSync(filePath, { chunkSize, batchSize }),
    { documentMode: 'document' },
  );
  const view = new CursorEventView();
  const viewOptions = {
    autoDecodeEntities: false,
    implicitAttributeValue: 'true' as const,
  };
  const state = { events: 0, batches: 0, checksum: 2166136261 >>> 0 };

  while (parser.nextBatch()) {
    const count = parser.eventCount();
    for (let eventIndex = 0; eventIndex < count; eventIndex++) {
      if (!view.moveToTable(parser, eventIndex, viewOptions)) {
        continue;
      }
      const type = cursorToStreamEventType(view.eventType());
      state.events++;
      state.checksum = mixChecksum(state.checksum, type);
      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        state.checksum = foldString(state.checksum, view.name());
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        state.checksum = foldString(state.checksum, view.text()?.trim());
      }
      const attrCount = type === StreamEventType.START_ELEMENT ? view.getAttributeCount() : 0;
      state.checksum = mixChecksum(state.checksum, attrCount);
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        state.checksum = foldString(state.checksum, view.getAttributeName(attrIndex));
        state.checksum = foldString(state.checksum, view.getAttributeValue(attrIndex));
      }
      if (state.events % sampleEveryEvents === 0) updatePeak();
    }
    state.batches++;
    if (state.batches % progressEveryBatches === 0) {
      console.error(`[progress] ${caseLabel('cursor-js-current')} batches=${state.batches} events=${state.events}`);
    }
    updatePeak();
  }
  return state;
}

function consumeDirectCursorJavaScript(filePath: string, updatePeak: () => void) {
  const parser = createJavaScriptIterableReader(
    nodeFileByteBatchesSync(filePath, { chunkSize, batchSize }),
    { documentMode: 'document' },
  );
  const cursor = new DirectFrameCursor();
  const state = { events: 0, batches: 0, checksum: 2166136261 >>> 0 };

  for (;;) {
    const frame = parser.nextBatchFrame();
    if (!frame) break;
    for (let eventIndex = 0; eventIndex < frame.eventCount; eventIndex++) {
      if (!cursor.moveTo(frame, eventIndex)) {
        continue;
      }
      const type = cursor.eventType();
      state.events++;
      state.checksum = mixChecksum(state.checksum, type);
      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        state.checksum = foldString(state.checksum, cursor.name());
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        state.checksum = foldString(state.checksum, cursor.text()?.trim());
      }
      const attrCount = type === StreamEventType.START_ELEMENT ? cursor.getAttributeCount() : 0;
      state.checksum = mixChecksum(state.checksum, attrCount);
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        state.checksum = foldString(state.checksum, cursor.getAttributeName(attrIndex));
        state.checksum = foldString(state.checksum, cursor.getAttributeValue(attrIndex));
      }
      if (state.events % sampleEveryEvents === 0) updatePeak();
    }
    state.batches++;
    if (state.batches % progressEveryBatches === 0) {
      console.error(`[progress] ${caseLabel('cursor-js-direct')} batches=${state.batches} events=${state.events}`);
    }
    updatePeak();
  }

  return state;
}

function consumeByteCoreCursor(filePath: string, updatePeak: () => void) {
  const cursor = new NodeCurrentCursor(
    nodeFileByteBatchesSync(filePath, { chunkSize, batchSize }),
    { materialization: 'none' },
  );
  const state = { events: 0, batches: 0, checksum: 2166136261 >>> 0 };
  let pendingEvents = 0;

  while (cursor.next()) {
    const type = cursor.eventType();
    state.events++;
    pendingEvents++;
    state.checksum = mixChecksum(state.checksum, type);
    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      state.checksum = foldString(state.checksum, cursor.name());
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      state.checksum = foldString(state.checksum, cursor.text()?.trim());
    }
    const attrCount = type === StreamEventType.START_ELEMENT ? cursor.getAttributeCount() : 0;
    state.checksum = mixChecksum(state.checksum, attrCount);
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      state.checksum = foldString(state.checksum, cursor.getAttributeName(attrIndex));
      state.checksum = foldString(state.checksum, cursor.getAttributeValue(attrIndex));
    }
    if (state.events % sampleEveryEvents === 0) updatePeak();
    if (pendingEvents >= 65536) {
      state.batches++;
      pendingEvents = 0;
    }
  }
  if (pendingEvents > 0) {
    state.batches++;
  }
  return state;
}

function consumePublicCursorSync(filePath: string, updatePeak: () => void) {
  const cursor = new CursorReader(nodeFileByteBatchesSync(filePath, { chunkSize, batchSize }));
  const state = { events: 0, batches: 0, checksum: 2166136261 >>> 0 };
  let pendingEvents = 0;

  while (cursor.next()) {
    const type = cursor.eventType();
    state.events++;
    pendingEvents++;
    state.checksum = mixChecksum(state.checksum, type);
    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      state.checksum = foldString(state.checksum, cursor.name());
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      state.checksum = foldString(state.checksum, cursor.text()?.trim());
    }
    const attrCount = type === StreamEventType.START_ELEMENT ? cursor.getAttributeCount() : 0;
    state.checksum = mixChecksum(state.checksum, attrCount);
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      state.checksum = foldString(state.checksum, cursor.getAttributeName(attrIndex));
      state.checksum = foldString(state.checksum, cursor.getAttributeValue(attrIndex));
    }
    if (state.events % sampleEveryEvents === 0) updatePeak();
    if (pendingEvents >= 65536) {
      state.batches++;
      pendingEvents = 0;
    }
  }
  if (pendingEvents > 0) {
    state.batches++;
  }
  return state;
}

async function consumePublicCursorAsync(filePath: string, updatePeak: () => void) {
  const cursor = new CursorReaderAsync(fileReadableStream(filePath));
  const state = { events: 0, batches: 0, checksum: 2166136261 >>> 0 };
  let pendingEvents = 0;

  while (await cursor.next()) {
    const type = cursor.eventType();
    state.events++;
    pendingEvents++;
    state.checksum = mixChecksum(state.checksum, type);
    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      state.checksum = foldString(state.checksum, cursor.name());
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      state.checksum = foldString(state.checksum, cursor.text()?.trim());
    }
    const attrCount = type === StreamEventType.START_ELEMENT ? cursor.getAttributeCount() : 0;
    state.checksum = mixChecksum(state.checksum, attrCount);
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      state.checksum = foldString(state.checksum, cursor.getAttributeName(attrIndex));
      state.checksum = foldString(state.checksum, cursor.getAttributeValue(attrIndex));
    }
    if (state.events % sampleEveryEvents === 0) updatePeak();
    if (pendingEvents >= 65536) {
      state.batches++;
      pendingEvents = 0;
    }
  }
  if (pendingEvents > 0) {
    state.batches++;
  }
  return state;
}

function consumePublicCursorSyncLean(filePath: string, updatePeak: () => void) {
  const cursor = new CursorReader(nodeFileByteBatchesSync(filePath, { chunkSize, batchSize }), {
    namespaceAware: false,
  });
  const state = { events: 0, batches: 0, checksum: 2166136261 >>> 0 };
  let pendingEvents = 0;

  while (cursor.next()) {
    const type = cursor.eventType();
    state.events++;
    pendingEvents++;
    state.checksum = mixChecksum(state.checksum, type);
    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      state.checksum = foldString(state.checksum, cursor.name());
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      state.checksum = foldString(state.checksum, cursor.text()?.trim());
    }
    const attrCount = type === StreamEventType.START_ELEMENT ? cursor.getAttributeCount() : 0;
    state.checksum = mixChecksum(state.checksum, attrCount);
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      state.checksum = foldString(state.checksum, cursor.getAttributeName(attrIndex));
      state.checksum = foldString(state.checksum, cursor.getAttributeValue(attrIndex));
    }
    if (state.events % sampleEveryEvents === 0) updatePeak();
    if (pendingEvents >= 65536) {
      state.batches++;
      pendingEvents = 0;
    }
  }
  if (pendingEvents > 0) {
    state.batches++;
  }
  return state;
}

async function consumePublicCursorAsyncLean(filePath: string, updatePeak: () => void) {
  const cursor = new CursorReaderAsync(fileReadableStream(filePath), {
    namespaceAware: false,
  });
  const state = { events: 0, batches: 0, checksum: 2166136261 >>> 0 };
  let pendingEvents = 0;

  while (await cursor.next()) {
    const type = cursor.eventType();
    state.events++;
    pendingEvents++;
    state.checksum = mixChecksum(state.checksum, type);
    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      state.checksum = foldString(state.checksum, cursor.name());
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      state.checksum = foldString(state.checksum, cursor.text()?.trim());
    }
    const attrCount = type === StreamEventType.START_ELEMENT ? cursor.getAttributeCount() : 0;
    state.checksum = mixChecksum(state.checksum, attrCount);
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      state.checksum = foldString(state.checksum, cursor.getAttributeName(attrIndex));
      state.checksum = foldString(state.checksum, cursor.getAttributeValue(attrIndex));
    }
    if (state.events % sampleEveryEvents === 0) updatePeak();
    if (pendingEvents >= 65536) {
      state.batches++;
      pendingEvents = 0;
    }
  }
  if (pendingEvents > 0) {
    state.batches++;
  }
  return state;
}

async function consumeEventReader(filePath: string, forceJsFallback: boolean, updatePeak: () => void) {
  if (forceJsFallback) {
    resetStaxXmlRuntimeForTests();
  }
  const reader = new EventReader(fileReadableStream(filePath), {
    autoDecodeEntities: false,
    documentMode: 'document',
  });
  const state = { events: 0, batches: 0, checksum: 2166136261 >>> 0 };
  for await (const batch of reader.batchedIterator()) {
    for (const event of batch) {
      state.events++;
      state.checksum = mixChecksum(state.checksum, eventTypeId(event.type));
      if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
        state.checksum = foldString(state.checksum, event.name);
      }
      if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
        state.checksum = foldString(state.checksum, event.value?.trim());
      }
      const attrs = event.type === XmlEventType.START_ELEMENT ? Object.entries(event.attributes ?? {}) : [];
      state.checksum = mixChecksum(state.checksum, attrs.length);
      for (const [name, value] of attrs) {
        state.checksum = foldString(state.checksum, name);
        state.checksum = foldString(state.checksum, value);
      }
      if (state.events % sampleEveryEvents === 0) updatePeak();
    }
    state.batches++;
    if (state.batches % progressEveryBatches === 0) {
      console.error(`[progress] ${caseLabel(forceJsFallback ? 'event-js-fallback' : 'event-native')} batches=${state.batches} events=${state.events}`);
    }
    updatePeak();
  }
  return state;
}

function createGcTracker() {
  const stats = {
    totalMs: 0,
    majorMs: 0,
    minorMs: 0,
    incrementalMs: 0,
    weakCbMs: 0,
    count: 0,
  };
  let enabled = false;
  const observer = new PerformanceObserver((list) => {
    if (!enabled) return;
    for (const entry of list.getEntries()) {
      const gcEntry = entry as PerformanceEntry & { kind?: number; detail?: { kind?: number } };
      const kind = gcEntry.detail?.kind ?? gcEntry.kind ?? 0;
      stats.totalMs += entry.duration;
      stats.count += 1;
      if (kind === perfConstants.NODE_PERFORMANCE_GC_MAJOR) stats.majorMs += entry.duration;
      if (kind === perfConstants.NODE_PERFORMANCE_GC_MINOR) stats.minorMs += entry.duration;
      if (kind === perfConstants.NODE_PERFORMANCE_GC_INCREMENTAL) stats.incrementalMs += entry.duration;
      if (kind === perfConstants.NODE_PERFORMANCE_GC_WEAKCB) stats.weakCbMs += entry.duration;
    }
  });
  observer.observe({ entryTypes: ['gc'] });
  return Object.assign(stats, {
    start() {
      enabled = true;
    },
    stop() {
      enabled = false;
    },
    disconnect() {
      observer.disconnect();
    },
  });
}

async function* readFileChunks(filePath: string) {
  const handle = await openFile(filePath, 'r');
  try {
    while (true) {
      const chunk = Buffer.allocUnsafe(chunkSize);
      const { bytesRead } = await handle.read(chunk, 0, chunkSize, null);
      if (bytesRead === 0) break;
      yield bytesRead === chunkSize ? chunk : chunk.subarray(0, bytesRead);
    }
  } finally {
    await handle.close();
  }
}

function fileReadableStream(filePath: string) {
  const iterator = readFileChunks(filePath)[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await iterator.next();
      if (next.done) {
        controller.close();
        return;
      }
      controller.enqueue(next.value);
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}

function createLargeXmlBookElement(id: number) {
  return `  <book id="book-${id}" lang="en" code="${id % 97}">` +
    `<title>EventReader Stream Benchmark ${id}</title>` +
    `<author>Author ${id % 4096}</author>` +
    '<description>Stable text payload for EventReader stream parsing.</description>' +
    `<chapter number="1">Intro ${id}</chapter>` +
    `<chapter number="2">Body ${id}</chapter>` +
    '</book>\n';
}

function createLargeXmlElementBlock(targetBytes = 1024 * 1024) {
  const parts: string[] = [];
  let total = 0;
  let id = 0;
  while (total < targetBytes) {
    const element = createLargeXmlBookElement(id++);
    total += Buffer.byteLength(element);
    parts.push(element);
  }
  return Buffer.from(parts.join(''), 'utf8');
}

function iterableFixturePath(fixtureId: string) {
  return join(tmpdir(), `stax-xml-benchmark-${fixtureId}.xml`);
}

function ensureIterableXmlFile(fixtureCase: { id: string; label: string; targetBytes: number }, verbose = true) {
  const filePath = iterableFixturePath(fixtureCase.id);
  const reusableSlack = Math.min(1024 * 1024, Math.max(4096, Math.floor(fixtureCase.targetBytes / 64)));
  const minimumReusableBytes = fixtureCase.targetBytes - reusableSlack;
  if (existsSync(filePath)) {
    const existing = statSync(filePath);
    if (existing.size >= minimumReusableBytes) {
      if (verbose) {
        console.log(`Reusing ${fixtureCase.label} XML fixture: ${filePath} (${formatBytes(existing.size)})`);
      }
      return { filePath, bytes: existing.size };
    }
  }

  if (verbose) {
    console.log(`Creating ${fixtureCase.label} XML fixture: ${filePath}`);
  }

  const fd = openSync(filePath, 'w');
  const header = Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<root>\n');
  const footer = Buffer.from('</root>\n');
  const block = createLargeXmlElementBlock();
  let written = 0;
  let tailId = 0;
  const progressBytes = Math.max(512 * 1024 * 1024, Math.floor(fixtureCase.targetBytes / 8));

  try {
    writeSync(fd, header);
    written += header.byteLength;

    while (written + block.byteLength + footer.byteLength <= fixtureCase.targetBytes) {
      writeSync(fd, block);
      written += block.byteLength;
      if (verbose && written % progressBytes < block.byteLength) {
        console.log(`  wrote ${formatBytes(written)}`);
      }
    }

    while (true) {
      const element = Buffer.from(createLargeXmlBookElement(tailId++), 'utf8');
      if (written + element.byteLength + footer.byteLength > fixtureCase.targetBytes) {
        break;
      }
      writeSync(fd, element);
      written += element.byteLength;
    }

    writeSync(fd, footer);
    written += footer.byteLength;
  } finally {
    closeSync(fd);
  }

  if (verbose) {
    console.log(`Created ${formatBytes(written)} XML fixture.`);
  }
  return { filePath, bytes: written };
}

function eventTypeId(type: XmlEventType) {
  switch (type) {
    case XmlEventType.START_DOCUMENT:
      return StreamEventType.START_DOCUMENT;
    case XmlEventType.END_DOCUMENT:
      return StreamEventType.END_DOCUMENT;
    case XmlEventType.START_ELEMENT:
      return StreamEventType.START_ELEMENT;
    case XmlEventType.END_ELEMENT:
      return StreamEventType.END_ELEMENT;
    case XmlEventType.CHARACTERS:
      return StreamEventType.CHARACTERS;
    case XmlEventType.CDATA:
      return StreamEventType.CDATA;
    default:
      return 31;
  }
}

function mixChecksum(checksum: number, value: number) {
  return Math.imul(checksum ^ (value >>> 0), 16777619) >>> 0;
}

function foldString(seed: number, value: string | undefined) {
  if (!value) return seed;
  let next = seed >>> 0;
  for (let index = 0; index < value.length; index++) {
    next = Math.imul(next ^ value.charCodeAt(index), 16777619) >>> 0;
  }
  return next;
}

function createBatchSpanDecoder(buffer: Uint8Array) {
  if (Buffer.isBuffer(buffer) && typeof buffer.toString === 'function') {
    return (start: number, end: number) => buffer.toString('utf8', start, end);
  }
  return (start: number, end: number) => utf8Decoder.decode(buffer.subarray(start, end));
}

function decodeUtf8Span(buffer: Uint8Array, start: number, end: number) {
  if (Buffer.isBuffer(buffer) && typeof buffer.toString === 'function') {
    return buffer.toString('utf8', start, end);
  }
  return utf8Decoder.decode(buffer.subarray(start, end));
}

function decodeRawSpan(decodeSpan: (start: number, end: number) => string, start: number, end: number) {
  return start < 0 || end < 0 ? undefined : decodeSpan(start, end);
}

function decodeRawArenaSpan(batch: Extract<StreamReaderSyncRawBatch, { kind: 'soa-string-arena' }>, start: number, end: number) {
  return start < 0 || end < 0 ? undefined : batch.stringArena.slice(start, end);
}

function rawEventBase(batch: Extract<StreamReaderSyncRawBatch, { kind: 'word-table' }>, eventIndex: number) {
  return batch.eventWordOffset + eventIndex * batch.eventStrideWords;
}

function rawAttrBase(batch: StreamReaderSyncRawBatch, eventIndex: number, attrIndex: number) {
  if (batch.kind === 'word-table') {
    const eventBase = rawEventBase(batch, eventIndex);
    const attrTableIndex = batch.eventWords[eventBase + 5] + attrIndex;
    return batch.attrWordOffset + attrTableIndex * batch.attrStrideWords;
  }
  return batch.attrStarts[eventIndex] + attrIndex;
}

function rawEventType(batch: StreamReaderSyncRawBatch, eventIndex: number) {
  if (batch.kind === 'word-table') {
    return batch.eventWords[rawEventBase(batch, eventIndex)];
  }
  return batch.eventTypes[eventIndex];
}

function rawAttrCount(batch: StreamReaderSyncRawBatch, eventIndex: number) {
  if (batch.kind === 'word-table') {
    return batch.eventWords[rawEventBase(batch, eventIndex) + 6];
  }
  return batch.attrCounts[eventIndex];
}

function rawName(batch: StreamReaderSyncRawBatch, eventIndex: number, decodeSpan: (start: number, end: number) => string) {
  if (batch.kind === 'word-table') {
    const base = rawEventBase(batch, eventIndex);
    return decodeRawSpan(decodeSpan, batch.spanWords[base + 1], batch.spanWords[base + 2]);
  }
  if (batch.kind === 'soa-string-arena') {
    return decodeRawArenaSpan(batch, batch.eventNameArenaStarts[eventIndex], batch.eventNameArenaEnds[eventIndex])
      ?? decodeRawSpan(decodeSpan, batch.nameStarts[eventIndex], batch.nameEnds[eventIndex]);
  }
  return decodeRawSpan(decodeSpan, batch.nameStarts[eventIndex], batch.nameEnds[eventIndex]);
}

function rawText(batch: StreamReaderSyncRawBatch, eventIndex: number, decodeSpan: (start: number, end: number) => string) {
  if (batch.kind === 'word-table') {
    const base = rawEventBase(batch, eventIndex);
    return decodeRawSpan(decodeSpan, batch.spanWords[base + 3], batch.spanWords[base + 4]);
  }
  if (batch.kind === 'soa-string-arena') {
    return decodeRawArenaSpan(batch, batch.eventTextArenaStarts[eventIndex], batch.eventTextArenaEnds[eventIndex])
      ?? decodeRawSpan(decodeSpan, batch.textStarts[eventIndex], batch.textEnds[eventIndex]);
  }
  return decodeRawSpan(decodeSpan, batch.textStarts[eventIndex], batch.textEnds[eventIndex]);
}

function rawAttrName(batch: StreamReaderSyncRawBatch, eventIndex: number, attrIndex: number, decodeSpan: (start: number, end: number) => string) {
  const base = rawAttrBase(batch, eventIndex, attrIndex);
  if (batch.kind === 'word-table') {
    return decodeRawSpan(decodeSpan, batch.spanWords[base], batch.spanWords[base + 1]);
  }
  if (batch.kind === 'soa-string-arena') {
    return decodeRawArenaSpan(batch, batch.attrNameArenaStarts[base], batch.attrNameArenaEnds[base])
      ?? decodeRawSpan(decodeSpan, batch.attrNameStarts[base], batch.attrNameEnds[base]);
  }
  return decodeRawSpan(decodeSpan, batch.attrNameStarts[base], batch.attrNameEnds[base]);
}

function rawAttrValue(batch: StreamReaderSyncRawBatch, eventIndex: number, attrIndex: number, decodeSpan: (start: number, end: number) => string) {
  const base = rawAttrBase(batch, eventIndex, attrIndex);
  if (batch.kind === 'word-table') {
    return decodeRawSpan(decodeSpan, batch.spanWords[base + 2], batch.spanWords[base + 3]);
  }
  if (batch.kind === 'soa-string-arena') {
    return decodeRawArenaSpan(batch, batch.attrValueArenaStarts[base], batch.attrValueArenaEnds[base])
      ?? decodeRawSpan(decodeSpan, batch.attrValueStarts[base], batch.attrValueEnds[base]);
  }
  return decodeRawSpan(decodeSpan, batch.attrValueStarts[base], batch.attrValueEnds[base]);
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KiB`;
  return `${bytes} B`;
}

function formatDurationMs(ms: number) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms.toFixed(2)} ms`;
}

function caseLabel(caseId: CaseId) {
  switch (caseId) {
    case 'stream-native-public':
      return 'StreamReaderSync native public';
    case 'stream-native-raw':
      return 'StreamReaderSync native raw';
    case 'iterable-js-fallback':
      return 'IterableReader JS fallback';
    case 'cursor-js-current':
      return 'Cursor-like JS current view';
    case 'cursor-js-direct':
      return 'Direct frame cursor JS';
    case 'cursor-byte-core':
      return 'Byte core cursor';
    case 'cursor-public-sync':
      return 'CursorReader public sync';
    case 'cursor-public-async':
      return 'CursorReader public async';
    case 'cursor-public-sync-lean':
      return 'CursorReader public sync lean';
    case 'cursor-public-async-lean':
      return 'CursorReader public async lean';
    case 'event-native':
      return 'EventReader native';
    case 'event-js-fallback':
      return 'EventReader JS fallback';
  }
}

function cursorToStreamEventType(type: number) {
  switch (type) {
    case CursorEventType.START_DOCUMENT:
      return StreamEventType.START_DOCUMENT;
    case CursorEventType.END_DOCUMENT:
      return StreamEventType.END_DOCUMENT;
    case CursorEventType.START_ELEMENT:
      return StreamEventType.START_ELEMENT;
    case CursorEventType.END_ELEMENT:
      return StreamEventType.END_ELEMENT;
    case CursorEventType.CHARACTERS:
      return StreamEventType.CHARACTERS;
    case CursorEventType.CDATA:
      return StreamEventType.CDATA;
    default:
      return 31;
  }
}

class DirectFrameCursor {
  private frame:
    | {
        buffer: Uint8Array;
        eventTypes: Uint8Array;
        nameStarts: Int32Array;
        nameEnds: Int32Array;
        textStarts: Int32Array;
        textEnds: Int32Array;
        attrStarts: Int32Array;
        attrCounts: Int32Array;
        attrNameStarts: Int32Array;
        attrNameEnds: Int32Array;
        attrValueStarts: Int32Array;
        attrValueEnds: Int32Array;
      }
    | undefined;
  private eventIndex = -1;
  private currentType = 0;
  private currentAttrStart = 0;
  private currentAttrCount = 0;

  moveTo(
    frame: {
      buffer: Uint8Array;
      eventTypes: Uint8Array;
      nameStarts: Int32Array;
      nameEnds: Int32Array;
      textStarts: Int32Array;
      textEnds: Int32Array;
      attrStarts: Int32Array;
      attrCounts: Int32Array;
      attrNameStarts: Int32Array;
      attrNameEnds: Int32Array;
      attrValueStarts: Int32Array;
      attrValueEnds: Int32Array;
    },
    eventIndex: number,
  ) {
    this.frame = frame;
    this.eventIndex = eventIndex;
    this.currentType = frame.eventTypes[eventIndex]!;
    this.currentAttrStart = frame.attrStarts[eventIndex]!;
    this.currentAttrCount = frame.attrCounts[eventIndex]!;
    return true;
  }

  eventType() {
    return this.currentType;
  }

  name() {
    return this.decode(this.frame!.nameStarts[this.eventIndex]!, this.frame!.nameEnds[this.eventIndex]!);
  }

  text() {
    return this.decode(this.frame!.textStarts[this.eventIndex]!, this.frame!.textEnds[this.eventIndex]!);
  }

  getAttributeCount() {
    return this.currentAttrCount;
  }

  getAttributeName(index: number) {
    if (index < 0 || index >= this.currentAttrCount) return undefined;
    const attrIndex = this.currentAttrStart + index;
    return this.decode(this.frame!.attrNameStarts[attrIndex]!, this.frame!.attrNameEnds[attrIndex]!);
  }

  getAttributeValue(index: number) {
    if (index < 0 || index >= this.currentAttrCount) return undefined;
    const attrIndex = this.currentAttrStart + index;
    return this.decode(this.frame!.attrValueStarts[attrIndex]!, this.frame!.attrValueEnds[attrIndex]!);
  }

  private decode(start: number, end: number) {
    if (start < 0 || end < 0) return undefined;
    return decodeUtf8Span(this.frame!.buffer, start, end);
  }
}

function printRatio(results: Array<{ caseId: CaseId; elapsedMs: number }>, fasterId: CaseId, slowerId: CaseId) {
  const faster = results.find((entry) => entry.caseId === fasterId);
  const slower = results.find((entry) => entry.caseId === slowerId);
  if (!faster || !slower) return;
  console.log(`- ${caseLabel(fasterId)} vs ${caseLabel(slowerId)}: ${(slower.elapsedMs / faster.elapsedMs).toFixed(2)}x faster`);
}

async function tick() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function parseArgs(argv: string[]) {
  const result: { childCase?: CaseId; sizeMiB: number; cases?: CaseId[] } = { sizeMiB: 4096 };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--child-case' && argv[index + 1]) {
      result.childCase = argv[++index] as CaseId;
      continue;
    }
    if (arg === '--cases' && argv[index + 1]) {
      result.cases = parseCaseList(argv[++index]!);
      continue;
    }
    if (arg === '--size-mib' && argv[index + 1]) {
      result.sizeMiB = Number(argv[++index]);
    }
  }
  return result;
}

function parseCaseList(value: string): CaseId[] {
  const selected = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  for (const caseId of selected) {
    if (!(caseIds as readonly string[]).includes(caseId)) {
      throw new Error(`Unknown benchmark case: ${caseId}`);
    }
  }
  return selected as CaseId[];
}

function fixtureFromArgs({ sizeMiB }: { sizeMiB: number }) {
  if (sizeMiB === 4096) {
    return defaultFixture;
  }
  return {
    id: `${sizeMiB}mib`,
    label: `${sizeMiB}MiB`,
    targetBytes: sizeMiB * 1024 ** 2,
  };
}

async function main() {
  if (args.childCase) {
    const fixtureConfig = fixtureFromArgs(args);
    const fixture = ensureIterableXmlFile(fixtureConfig, false);
    const result = await measureCase(args.childCase, fixture.filePath, fixture.bytes);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  const fixtureConfig = fixtureFromArgs(args);
  const fixture = ensureIterableXmlFile(fixtureConfig, true);
  const selectedCases = args.cases ?? [...caseIds];
  const results = selectedCases.map((caseId) => runChildCase(caseId, fixture.filePath));

  console.log('\nStreamReader 4GiB native vs JS fallback');
  console.log(`Fixture: ${fixture.filePath}`);
  console.log(`Size: ${formatBytes(fixture.bytes)}; chunk size: ${formatBytes(chunkSize)}; batch size: ${batchSize}`);
  console.log('Checksum contract: event type + trimmed text + names + attribute names/values');
  console.log('');
  console.log('| Case | Throughput | Time | Events | Batches | Heap peak | RSS peak | GC total | GC share | Checksum |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const result of results) {
    console.log(
      `| ${result.caseId} | ${result.throughputMiBs.toFixed(2)} MiB/s | ${formatDurationMs(result.elapsedMs)} | ` +
        `${result.events} | ${result.batches} | ${formatBytes(result.heapPeakBytes)} | ${formatBytes(result.rssPeakBytes)} | ` +
        `${formatDurationMs(result.gc.totalMs)} | ${result.gc.sharePct.toFixed(1)}% | ${result.checksum} |`,
    );
  }

  const checksumBaseline = results[0]?.checksum;
  for (const result of results) {
    if (result.checksum !== checksumBaseline || result.events !== results[0]?.events) {
      throw new Error(`Parity mismatch in ${result.caseId}`);
    }
  }

  console.log('\nRelative ratios (lower time is better):');
  printRatio(results, 'stream-native-public', 'iterable-js-fallback');
  printRatio(results, 'stream-native-public', 'event-native');
  printRatio(results, 'stream-native-public', 'event-js-fallback');
  printRatio(results, 'stream-native-raw', 'stream-native-public');
  printRatio(results, 'stream-native-raw', 'iterable-js-fallback');
}

await main();
