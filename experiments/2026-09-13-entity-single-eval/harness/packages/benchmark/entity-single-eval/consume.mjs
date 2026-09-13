import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const RING_SIZE = 256;
const OMITTED = '<undefined>';
const EVENT_FIELDS = {
  START_DOCUMENT: ['version', 'encoding', 'standalone'],
  END_DOCUMENT: [],
  START_ELEMENT: ['name', 'localName', 'prefix', 'namespaceURI', 'selfClosing'],
  END_ELEMENT: ['name', 'localName', 'prefix', 'namespaceURI'],
  CHARACTERS: ['value'], CDATA: ['value'], COMMENT: ['value'], DTD: ['value'],
  PROCESSING_INSTRUCTION: ['target', 'data'],
};
const ATTRIBUTE_FIELDS = ['name', 'localName', 'prefix', 'namespaceURI', 'value'];

export function mixChecksum(seed, value) {
  return Math.imul((seed ^ (value | 0)) | 0, 16777619) | 0;
}

export function foldString(seed, value) {
  if (value === undefined || value === null) return mixChecksum(seed, 0x811c9dc5);
  const text = String(value);
  let next = seed | 0;
  for (let index = 0; index < text.length; index++) {
    next = ((next << 5) - next + text.charCodeAt(index)) | 0;
  }
  return next;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function fieldDigest(seed, key, value) {
  let next = foldString(seed, key);
  if (value === undefined) return foldString(next, OMITTED);
  return foldString(next, value);
}

function stableEventFields(event) {
  return EVENT_FIELDS[event.type];
}

export function canonicalEvent(event) {
  if (!event || typeof event !== 'object') return JSON.stringify(event);
  const fields = stableEventFields(event).map((key) => [key, hasOwn(event, key), event[key]]);
  const result = { type: event.type, ownKeys: Object.keys(event), fields };
  if (event.type === 'START_ELEMENT') {
    if (!hasOwn(event, 'attributes') || event.attributes === undefined) {
      result.attributes = { present: false };
    } else {
      result.attributes = {
        present: true,
        entries: [...event.attributes].map(([key, attribute]) => [
          key,
          Object.fromEntries(['name', 'localName', 'prefix', 'namespaceURI', 'value'].map((field) => [field, [hasOwn(attribute, field), attribute[field]]])),
        ]),
      };
    }
  }
  return result;
}

export function canonicalTranscript(events) {
  return events.map(canonicalEvent);
}

export function digestTranscript(events) {
  let checksum = 0;
  for (const event of events) checksum = foldString(checksum, JSON.stringify(canonicalEvent(event)));
  return checksum;
}

export function consumeMaterializedEvent(event, state) {
  state.eventCount++;
  state.checksum = fieldDigest(state.checksum, 'type', event?.type);
  for (const key of stableEventFields(event)) {
    state.checksum = mixChecksum(state.checksum, hasOwn(event, key) ? 1 : 0);
    state.checksum = fieldDigest(state.checksum, key, event?.[key]);
    if (event?.[key] !== undefined) state.outputCodeUnits += String(event[key]).length;
  }
  if (event?.type === 'START_ELEMENT') {
    const attributes = event.attributes;
    state.checksum = mixChecksum(state.checksum, attributes === undefined ? -1 : attributes.size);
    if (attributes !== undefined) {
      for (const [key, attribute] of attributes) {
        state.checksum = fieldDigest(state.checksum, 'attribute-key', key);
        for (const field of ATTRIBUTE_FIELDS) {
          state.checksum = mixChecksum(state.checksum, hasOwn(attribute, field) ? 1 : 0);
          state.checksum = fieldDigest(state.checksum, field, attribute?.[field]);
          if (attribute?.[field] !== undefined) state.outputCodeUnits += String(attribute[field]).length;
        }
      }
    }
  }
  state.ring[state.eventCount & (RING_SIZE - 1)] = event;
}

export function createConsumerState() {
  return { eventCount: 0, checksum: 0, outputCodeUnits: 0, ring: new Array(RING_SIZE) };
}

export function makeSyncChunks(bytes, chunkSize = 64 * 1024) {
  if (!(bytes instanceof Uint8Array)) bytes = new TextEncoder().encode(String(bytes));
  return {
    *[Symbol.iterator]() {
      for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) yield bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength));
    },
  };
}

export function makeAsyncChunks(bytes, chunkSize = 64 * 1024, trace) {
  if (!(bytes instanceof Uint8Array)) bytes = new TextEncoder().encode(String(bytes));
  return {
    [Symbol.asyncIterator]() {
      let offset = 0;
      let finished = false;
      return {
        async next() {
          trace?.push(['input.next', 'request']);
          if (offset >= bytes.byteLength) {
            trace?.push(['input.next', 'return', { done: true }]);
            finished = true;
            return { value: undefined, done: true };
          }
          const value = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength));
          offset += value.byteLength;
          trace?.push(['input.next', 'return', { done: false, bytes: value.byteLength }]);
          return { value, done: false };
        },
        async return(value) {
          trace?.push(['input.return', 'request']);
          finished = true;
          trace?.push(['input.return', 'return']);
          return { value, done: true };
        },
        async throw(error) {
          trace?.push(['input.throw', 'request', error?.constructor?.name, error?.message]);
          finished = true;
          throw error;
        },
      };
    },
  };
}

function tracedSyncIterable(input, trace) {
  const iterable = typeof input === 'string' ? [input] : input instanceof Uint8Array ? [input] : input;
  return {
    [Symbol.iterator]() {
      const iterator = iterable[Symbol.iterator]();
      return {
        next() {
          trace?.push(['input.next', 'request']);
          try {
            const result = iterator.next();
            trace?.push(['input.next', 'return', { done: result.done, bytes: result.value?.byteLength }]);
            return result;
          } catch (error) {
            trace?.push(['input.next', 'throw', error?.constructor?.name, error?.message]);
            throw error;
          }
        },
        return(value) {
          trace?.push(['input.return', 'request']);
          try {
            const result = iterator.return ? iterator.return(value) : { value, done: true };
            trace?.push(['input.return', 'return']);
            return result;
          } catch (error) {
            trace?.push(['input.return', 'throw', error?.constructor?.name, error?.message]);
            throw error;
          }
        },
      };
    },
  };
}

export function normalizeInput(input, { async = false, chunkSize = 64 * 1024, trace } = {}) {
  if (async) {
    if (typeof input === 'string') input = new TextEncoder().encode(input);
    return makeAsyncChunks(input, chunkSize, trace);
  }
  if (!trace && (typeof input === 'string' || input instanceof Uint8Array)) return input;
  return tracedSyncIterable(input, trace);
}

export async function importPublicBuild(entry) {
  if (!entry || typeof entry !== 'string') throw new Error('Build manifest entry is required.');
  const url = entry.startsWith('file:') ? entry : pathToFileURL(entry).href;
  return import(url);
}

function recordEventNext(trace, action, detail) {
  trace?.push(['reader.next', action, detail]);
}

function errorRecord(error) {
  return { name: error?.constructor?.name ?? 'Error', message: error?.message ?? String(error) };
}

export function readCounters() {
  const value = globalThis.__entitySingleEval;
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).filter(([, count]) => Number.isFinite(count)));
}

export function createReaderOptions(options = {}) {
  const result = {
    documentMode: options.documentMode ?? 'document',
    namespaceAware: options.namespaceAware ?? true,
    autoDecodeEntities: options.autoDecodeEntities ?? true,
  };
  if (options.encoding) result.encoding = options.encoding;
  if (options.addEntities) result.addEntities = options.addEntities;
  if (options.maxEvents) result.maxEvents = options.maxEvents;
  return result;
}

export function consumeSync(api, input, options = {}) {
  const trace = options.trace;
  const kind = options.kind ?? 'event-sync';
  const readerOptions = createReaderOptions(options);
  const Reader = kind === 'event-sync' ? api.EventReaderSync : api.StreamReaderSync;
  if (!Reader) throw new Error(`Build does not export ${kind === 'event-sync' ? 'EventReaderSync' : 'StreamReaderSync'}.`);
  const source = kind === 'event-sync' ? normalizeInput(input, { trace }) : normalizeInput(input, { trace });
  const reader = new Reader(source, readerOptions);
  const state = createConsumerState();
  const canonicalHash = options.canonical === 'digest' ? createHash('sha256') : undefined;
  const events = [];
  let error;
  try {
    while (true) {
      recordEventNext(trace, 'request');
      let result;
      try {
        result = reader.next();
        recordEventNext(trace, 'return', result?.done ? { done: true } : { done: false, type: result?.value?.type ?? result });
      } catch (caught) {
        recordEventNext(trace, 'throw', errorRecord(caught));
        throw caught;
      }
      if (result === null || result?.done) break;
      if (kind === 'event-sync') {
        if (options.canonical === true) events.push(result.value);
        canonicalHash?.update(JSON.stringify(canonicalEvent(result.value)));
        consumeMaterializedEvent(result.value, state);
      } else {
        consumeStreamToken(reader, state, options.access ?? 'full');
      }
    }
  } catch (caught) {
    error = errorRecord(caught);
  } finally {
    trace?.push(['close', 'start']);
    try {
      reader.close();
      trace?.push(['close', 'complete']);
    } catch (caught) {
      trace?.push(['close', 'throw', errorRecord(caught)]);
      if (!error) error = errorRecord(caught);
    }
  }
  return { ...state, events: canonicalTranscript(events), transcriptDigest: canonicalHash?.digest('hex') ?? digestTranscript(events), error, counters: readCounters() };
}

function consumeStreamToken(reader, state, access) {
  state.eventCount++;
  const type = reader.eventType();
  state.checksum = fieldDigest(state.checksum, 'type', type);
  if (access === 'type-only') return;
  if (type === 'START_ELEMENT' || type === 'END_ELEMENT') {
    for (const field of ['name', 'localName', 'prefix', 'namespaceURI']) {
      const value = reader[field]();
      state.checksum = fieldDigest(state.checksum, field, value);
      state.outputCodeUnits += String(value ?? '').length;
    }
  }
  if (type === 'CHARACTERS' || type === 'CDATA' || type === 'COMMENT' || type === 'DTD') {
    const value = reader.text();
    state.checksum = fieldDigest(state.checksum, 'value', value);
    state.outputCodeUnits += String(value ?? '').length;
  }
  if (type === 'START_ELEMENT') {
    const count = reader.attributeCount();
    state.checksum = mixChecksum(state.checksum, count);
    for (let index = 0; index < count; index++) {
      for (const field of ['attributeName', 'attributeLocalName', 'attributePrefix', 'attributeNamespaceURI']) {
        const value = reader[field](index);
        state.checksum = fieldDigest(state.checksum, field, value);
        state.outputCodeUnits += String(value ?? '').length;
      }
      const value = reader.attributeValue(index);
      state.checksum = fieldDigest(state.checksum, 'attributeValue', value);
      state.outputCodeUnits += String(value ?? '').length;
    }
  }
}

export async function consumeAsync(api, input, options = {}) {
  const trace = options.trace;
  const kind = options.kind ?? 'event-async';
  const readerOptions = createReaderOptions(options);
  const Reader = kind === 'event-async' ? api.EventReader : api.StreamReader;
  if (!Reader) throw new Error(`Build does not export ${kind === 'event-async' ? 'EventReader' : 'StreamReader'}.`);
  const source = normalizeInput(input, { async: true, chunkSize: options.chunkSize ?? 64 * 1024, trace });
  const reader = new Reader(source, readerOptions);
  const state = createConsumerState();
  const canonicalHash = options.canonical === 'digest' ? createHash('sha256') : undefined;
  const events = [];
  let error;
  try {
    while (true) {
      recordEventNext(trace, 'request');
      let result;
      try {
        result = await reader.next();
        recordEventNext(trace, 'return', result?.done ? { done: true } : { done: false, type: result?.value?.type ?? result });
      } catch (caught) {
        recordEventNext(trace, 'throw', errorRecord(caught));
        throw caught;
      }
      if (result === null || result?.done) break;
      if (kind === 'event-async') {
        if (options.canonical === true) events.push(result.value);
        canonicalHash?.update(JSON.stringify(canonicalEvent(result.value)));
        consumeMaterializedEvent(result.value, state);
      } else {
        consumeStreamToken(reader, state, options.access ?? 'full');
      }
    }
  } catch (caught) {
    error = errorRecord(caught);
  } finally {
    trace?.push(['close', 'start']);
    try {
      await reader.close();
      trace?.push(['close', 'complete']);
    } catch (caught) {
      trace?.push(['close', 'throw', errorRecord(caught)]);
      if (!error) error = errorRecord(caught);
    }
  }
  return { ...state, events: canonicalTranscript(events), transcriptDigest: canonicalHash?.digest('hex') ?? digestTranscript(events), error, counters: readCounters() };
}

export async function consumePublic(api, input, options = {}) {
  return options.kind?.endsWith('async') ? consumeAsync(api, input, options) : consumeSync(api, input, options);
}

export function readInputFile(path, encoding = 'bytes') {
  const bytes = readFileSync(path);
  return encoding === 'string' ? bytes.toString('utf8') : bytes;
}
