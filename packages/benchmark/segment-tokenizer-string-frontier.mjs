import { closeSync, existsSync, mkdirSync, openSync, readSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StreamEventType, StreamReaderSync } from '../stax-xml/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultFile = join(__dirname, 'test-data', 'node-string-return-1024mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'segment-tokenizer-string-frontier.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'segment-tokenizer-string-frontier.md');
const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

const cases = [
  {
    id: 'tokenOnly',
    decodeElementNames: false,
    decodeAttributeNames: false,
    decodeAttributeValues: false,
    decodeText: false,
  },
  {
    id: 'elementNameStrings',
    decodeElementNames: true,
    decodeAttributeNames: false,
    decodeAttributeValues: false,
    decodeText: false,
    cacheNames: false,
  },
  {
    id: 'elementNameCachedStrings',
    decodeElementNames: true,
    decodeAttributeNames: false,
    decodeAttributeValues: false,
    decodeText: false,
    cacheNames: true,
  },
  {
    id: 'elementAndAttributeNameStrings',
    decodeElementNames: true,
    decodeAttributeNames: true,
    decodeAttributeValues: false,
    decodeText: false,
    cacheNames: false,
  },
  {
    id: 'elementAndAttributeNameCachedStrings',
    decodeElementNames: true,
    decodeAttributeNames: true,
    decodeAttributeValues: false,
    decodeText: false,
    cacheNames: true,
  },
  {
    id: 'elementAndAttributeStrings',
    decodeElementNames: true,
    decodeAttributeNames: true,
    decodeAttributeValues: true,
    decodeText: false,
    cacheNames: false,
  },
  {
    id: 'elementAndAttributeStringsBoundedCache',
    decodeElementNames: true,
    decodeAttributeNames: true,
    decodeAttributeValues: true,
    decodeText: false,
    cacheNames: true,
    cacheAllStrings: true,
    maxCachedStrings: 4096,
  },
  {
    id: 'allTokenStringsNoObjects',
    decodeElementNames: true,
    decodeAttributeNames: true,
    decodeAttributeValues: true,
    decodeText: true,
    cacheNames: false,
  },
  {
    id: 'allTokenStringsNameCachedNoObjects',
    decodeElementNames: true,
    decodeAttributeNames: true,
    decodeAttributeValues: true,
    decodeText: true,
    cacheNames: true,
  },
  {
    id: 'allTokenStringsBoundedCacheNoObjects',
    decodeElementNames: true,
    decodeAttributeNames: true,
    decodeAttributeValues: true,
    decodeText: true,
    cacheNames: true,
    cacheAllStrings: true,
    maxCachedStrings: 4096,
  },
  {
    id: 'allTokenStringsDocumentEventsNoObjects',
    decodeElementNames: true,
    decodeAttributeNames: true,
    decodeAttributeValues: true,
    decodeText: true,
    cacheNames: false,
    emitDocumentEvents: true,
    trimText: true,
    fullReaderChecksum: true,
    finalMixEventCount: false,
    compareFullReaderReference: true,
  },
  {
    id: 'allTokenStringsNameCachedDocumentEventsNoObjects',
    decodeElementNames: true,
    decodeAttributeNames: true,
    decodeAttributeValues: true,
    decodeText: true,
    cacheNames: true,
    emitDocumentEvents: true,
    trimText: true,
    fullReaderChecksum: true,
    finalMixEventCount: false,
    compareFullReaderReference: true,
  },
  {
    id: 'allTokenStringsBoundedCacheDocumentEventsNoObjects',
    decodeElementNames: true,
    decodeAttributeNames: true,
    decodeAttributeValues: true,
    decodeText: true,
    cacheNames: true,
    cacheAllStrings: true,
    maxCachedStrings: 4096,
    emitDocumentEvents: true,
    trimText: true,
    fullReaderChecksum: true,
    finalMixEventCount: false,
    compareFullReaderReference: true,
  },
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    chunkKiB: 32,
    batchSize: 8,
    runs: 3,
    warmups: 0,
    boundedRssMiB: 512,
    cases: null,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${arg} requires a value.`);
      index++;
      return value;
    };

    switch (name) {
      case '--file':
        options.file = resolve(process.cwd(), readValue());
        break;
      case '--chunk-kib':
        options.chunkKiB = parsePositiveInteger(readValue(), name);
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), name);
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), name);
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--bounded-rss-mib':
        options.boundedRssMiB = parsePositiveNumber(readValue(), name);
        break;
      case '--cases':
        options.cases = parseCases(readValue());
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!existsSync(options.file)) {
    throw new Error(`Benchmark fixture does not exist: ${options.file}`);
  }
  return options;
}

function parseCases(value) {
  const selected = value.split(',').map(item => item.trim()).filter(Boolean);
  if (selected.length === 0) throw new Error('--cases must include at least one case id.');
  const known = new Set(cases.map(testCase => testCase.id));
  for (const id of selected) {
    if (!known.has(id)) throw new Error(`Unknown --cases entry: ${id}`);
  }
  return selected;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

function parseNonNegativeInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${flag} must be a non-negative integer.`);
  return parsed;
}

function parsePositiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive number.`);
  return parsed;
}

function main() {
  const options = parseArgs();
  const report = runProbe(options);
  mkdirSync(dirname(options.jsonOut), { recursive: true });
  writeFileSync(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(options.mdOut, renderMarkdown(report), 'utf8');
  console.log(`segment-tokenizer-string-frontier: rows=${report.rows.length} fastest=${report.summary.fastest.id} ${formatNumber(report.summary.fastest.mibPerSec)} MiB/s`);
}

function runProbe(options) {
  const fileStats = statSync(options.file);
  const reference = consumeFullReaderReference(options);
  const selectedCases = options.cases === null
    ? cases
    : cases.filter(testCase => options.cases.includes(testCase.id));
  const rows = selectedCases.map(testCase => measureCase(testCase, options, fileStats.size / MIB, reference));
  assertStableCounters(rows);
  const fastest = maxBy(rows, row => row.mibPerSec);
  const tokenOnly = rows.find(row => row.id === 'tokenOnly');
  const allStrings = rows.find(row => row.id === 'allTokenStringsNoObjects');
  const fullChecksumCandidate = rows.find(row => row.id === 'allTokenStringsDocumentEventsNoObjects');
  const fullChecksumRows = rows.filter(row => row.contractScope === 'full-string-checksum-no-public-objects');
  const fastestFullChecksumCandidate = fullChecksumRows.length > 0
    ? maxBy(fullChecksumRows, row => row.mibPerSec)
    : null;
  return {
    generatedAt: new Date().toISOString(),
    objective: 'segment-tokenizer-string-frontier',
    contract: 'file-backed-segment-tokenizer-string-frontier',
    note: 'Benchmark-only probe that keeps the same demand-driven synchronous Iterable<Uint8Array[]> grouped segment source and incrementally adds browser-compatible TextDecoder string materialization to the token-boundary scanner. Most rows are partial headroom evidence; full-checksum rows validate the StreamReaderSync checksum but still do not expose public event objects.',
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
      v8: process.versions.v8,
    },
    fixture: {
      path: options.file,
      sizeBytes: fileStats.size,
      sizeMiB: fileStats.size / MIB,
      sizeGiB: fileStats.size / GIB,
    },
    options: {
      chunkKiB: options.chunkKiB,
      batchSize: options.batchSize,
      runs: options.runs,
      warmups: options.warmups,
      boundedRssMiB: options.boundedRssMiB,
      cases: selectedCases.map(testCase => testCase.id),
    },
    rows,
    reference,
    summary: {
      rowCount: rows.length,
      fastest: summarizeRow(fastest),
      tokenOnlyMiBPerSec: tokenOnly?.mibPerSec ?? null,
      allStringsMiBPerSec: allStrings?.mibPerSec ?? null,
      allStringsVsTokenOnlyRatio: tokenOnly && allStrings ? allStrings.mibPerSec / tokenOnly.mibPerSec : null,
      fullChecksumCandidateMiBPerSec: fullChecksumCandidate?.mibPerSec ?? null,
      fullChecksumCandidateMatchesReference: fullChecksumCandidate?.fullStringParity === true,
      fastestFullChecksumCandidate: fastestFullChecksumCandidate ? summarizeRow(fastestFullChecksumCandidate) : null,
      counterexamples200MiB: rows.filter(row => row.fullStringParity && row.boundedMemory && row.mibPerSec >= 200).length,
    },
    findings: createFindings(rows, tokenOnly, allStrings, fullChecksumCandidate, fullChecksumRows, fastestFullChecksumCandidate, reference),
  };
}

function measureCase(testCase, options, fileSizeMiB, reference) {
  const chunkBytes = options.chunkKiB * 1024;
  for (let index = 0; index < options.warmups; index++) {
    consumeCase(testCase, options.file, chunkBytes, options.batchSize);
  }

  const samplesMs = [];
  const memorySamples = [];
  let first;
  for (let index = 0; index < options.runs; index++) {
    gcNow();
    const before = takeMemorySnapshot();
    const startedAt = performance.now();
    const result = consumeCase(testCase, options.file, chunkBytes, options.batchSize);
    const elapsedMs = performance.now() - startedAt;
    const after = takeMemorySnapshot();
    if (first && !sameCounters(first, result)) {
      throw new Error(`${testCase.id} produced unstable counters.`);
    }
    first ??= result;
    samplesMs.push(elapsedMs);
    memorySamples.push({ before, after });
  }

  const avgMs = average(samplesMs);
  const maxRssBytes = Math.max(...memorySamples.map(sample => sample.after.rssBytes));
  return {
    id: testCase.id,
    tool: testCase.id,
    implementation: describeCase(testCase),
    family: testCase.compareFullReaderReference === true
      ? 'segment-tokenizer-full-checksum-candidate'
      : 'partial-segment-tokenizer-string-frontier',
    contractScope: testCase.compareFullReaderReference === true
      ? 'full-string-checksum-no-public-objects'
      : 'xml-token-boundary-string-materialization-frontier',
    fullStringParity: testCase.compareFullReaderReference === true
      && first.eventCount === reference.eventCount
      && first.checksum === reference.checksum,
    referenceEventCount: testCase.compareFullReaderReference === true ? reference.eventCount : null,
    referenceChecksum: testCase.compareFullReaderReference === true ? reference.checksum : null,
    sourceMode: 'file-backed-sync-iterable-byte-batches',
    parserInput: 'synchronous Iterable<Uint8Array[]>',
    demandDrivenSource: true,
    directReadableStream: false,
    fullArrayBufferParserInput: false,
    usesTextDecoder: first.decodeCalls > 0,
    usesNodeBuffer: false,
    chunkKiB: options.chunkKiB,
    batchSize: options.batchSize,
    concatBeforeTokenize: false,
    segmentAwareTokenize: true,
    decodeElementNames: testCase.decodeElementNames,
    decodeAttributeNames: testCase.decodeAttributeNames,
    decodeAttributeValues: testCase.decodeAttributeValues,
    decodeText: testCase.decodeText,
    emitDocumentEvents: testCase.emitDocumentEvents === true,
    trimText: testCase.trimText === true,
    fullReaderChecksum: testCase.fullReaderChecksum === true,
    finalMixEventCount: testCase.finalMixEventCount !== false,
    cacheNames: testCase.cacheNames,
    mibPerSec: fileSizeMiB / (avgMs / 1000),
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    sampleCount: samplesMs.length,
    sampleSpreadRatio: samplesMs.length > 1 ? (Math.max(...samplesMs) - Math.min(...samplesMs)) / avgMs : 0,
    samplesMs,
    eventCount: first.eventCount,
    startElementCount: first.startElementCount,
    endElementCount: first.endElementCount,
    textEventCount: first.textEventCount,
    attributeCount: first.attributeCount,
    materializedStringCount: first.materializedStringCount,
    cachedStringHitCount: first.cachedStringHitCount,
    cachedStringMissCount: first.cachedStringMissCount,
    cachedStringBypassCount: first.cachedStringBypassCount,
    cachedNameCount: first.cachedNameCount,
    decodedByteCount: first.decodedByteCount,
    decodeCalls: first.decodeCalls,
    checksum: first.checksum,
    boundedMemory: maxRssBytes <= options.boundedRssMiB * MIB,
    memory: {
      maxRssBytes,
      maxHeapUsedBytes: Math.max(...memorySamples.map(sample => sample.after.heapUsedBytes)),
      samples: memorySamples,
    },
  };
}

function consumeFullReaderReference(options) {
  let eventCount = 0;
  let checksum = 0;
  const chunkBytes = options.chunkKiB * 1024;
  for (const batch of new StreamReaderSync(createFileByteBatches(options.file, chunkBytes, options.batchSize))) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const type = batch.typeAt(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);
      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        checksum = foldReaderString(checksum, batch.nameAt(index));
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        checksum = foldReaderString(checksum, batch.textAt(index)?.trim());
      }
      if (type === StreamEventType.START_ELEMENT) {
        const attrCount = batch.attributeCountAt(index);
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          checksum = foldReaderString(checksum, batch.attributeNameAt(index, attrIndex));
          checksum = foldReaderString(checksum, batch.attributeValueAt(index, attrIndex));
        }
      }
    }
  }
  return {
    eventCount,
    checksum,
    sourceMode: 'StreamReaderSync-reference',
  };
}

function consumeCase(testCase, filePath, chunkBytes, batchSize) {
  const tokenizer = new FrontierTokenizer(testCase);
  for (const batch of createFileByteBatches(filePath, chunkBytes, batchSize)) {
    for (const chunk of batch) {
      tokenizer.scan(chunk);
    }
  }
  return tokenizer.finish();
}

function* createFileByteBatches(filePath, chunkBytes, batchSize) {
  const fd = openSync(filePath, 'r');
  try {
    while (true) {
      const batch = [];
      for (let index = 0; index < batchSize; index++) {
        const buffer = new Uint8Array(chunkBytes);
        const bytesRead = readSync(fd, buffer, 0, chunkBytes, null);
        if (bytesRead === 0) break;
        batch.push(bytesRead === chunkBytes ? buffer : buffer.subarray(0, bytesRead));
      }
      if (batch.length === 0) return;
      yield batch;
    }
  } finally {
    closeSync(fd);
  }
}

class FrontierTokenizer {
  constructor(testCase) {
    this.testCase = testCase;
    this.decoder = new TextDecoder('utf-8', { ignoreBOM: true });
    this.nameCache = new Map();
    this.inTag = false;
    this.tagParts = null;
    this.textParts = null;
    this.textHasNonWhitespace = false;
    this.textLength = 0;
    this.eventCount = 0;
    this.startElementCount = 0;
    this.endElementCount = 0;
    this.textEventCount = 0;
    this.attributeCount = 0;
    this.materializedStringCount = 0;
    this.cachedStringHitCount = 0;
    this.cachedStringMissCount = 0;
    this.cachedStringBypassCount = 0;
    this.decodedByteCount = 0;
    this.decodeCalls = 0;
    this.checksum = 0;
    if (this.testCase.emitDocumentEvents) {
      this.eventCount++;
      this.checksum = mixChecksum(this.checksum, 0);
    }
  }

  scan(buffer) {
    let offset = 0;
    while (offset < buffer.length) {
      if (this.inTag) {
        const gt = buffer.indexOf(62, offset);
        if (gt === -1) {
          this.appendTagPart(buffer.subarray(offset));
          return;
        }
        const current = buffer.subarray(offset, gt);
        this.processTagWithCurrent(current);
        this.inTag = false;
        offset = gt + 1;
        continue;
      }

      const lt = buffer.indexOf(60, offset);
      const end = lt === -1 ? buffer.length : lt;
      this.scanText(buffer, offset, end);
      if (lt === -1) return;
      this.flushText();
      this.inTag = true;
      this.tagParts = null;
      offset = lt + 1;
    }
  }

  finish() {
    if (this.inTag) throw new Error('Unexpected end of file while scanning an XML tag.');
    this.flushText();
    if (this.testCase.emitDocumentEvents) {
      this.eventCount++;
      this.checksum = mixChecksum(this.checksum, 1);
    }
    return {
      eventCount: this.eventCount,
      startElementCount: this.startElementCount,
      endElementCount: this.endElementCount,
      textEventCount: this.textEventCount,
      attributeCount: this.attributeCount,
      materializedStringCount: this.materializedStringCount,
      cachedStringHitCount: this.cachedStringHitCount,
      cachedStringMissCount: this.cachedStringMissCount,
      cachedStringBypassCount: this.cachedStringBypassCount,
      cachedNameCount: this.nameCache.size,
      decodedByteCount: this.decodedByteCount,
      decodeCalls: this.decodeCalls,
      checksum: this.testCase.finalMixEventCount === false ? this.checksum : mixChecksum(this.checksum, this.eventCount),
    };
  }

  scanText(buffer, start, end) {
    if (start >= end) return;
    this.textLength += end - start;
    if (this.testCase.decodeText) {
      this.textParts ??= [];
      this.textParts.push(buffer.subarray(start, end));
    }
    if (this.textHasNonWhitespace) return;
    for (let index = start; index < end; index++) {
      if (!isXmlWhitespace(buffer[index])) {
        this.textHasNonWhitespace = true;
        return;
      }
    }
  }

  flushText() {
    if (!this.textHasNonWhitespace) {
      this.textLength = 0;
      this.textParts = null;
      return;
    }
    this.eventCount++;
    this.textEventCount++;
    this.checksum = mixChecksum(this.checksum, 4);
    if (!this.testCase.fullReaderChecksum) {
      this.checksum = mixChecksum(this.checksum, this.textLength);
    }
    if (this.testCase.decodeText) {
      const textBytes = materializeParts(this.textParts);
      this.foldDecodedString(textBytes, { trim: this.testCase.trimText === true });
    }
    this.textLength = 0;
    this.textHasNonWhitespace = false;
    this.textParts = null;
  }

  appendTagPart(part) {
    if (part.length === 0) return;
    this.tagParts ??= [];
    this.tagParts.push(part);
  }

  processTagWithCurrent(current) {
    if (this.tagParts === null) {
      processTag(current, this);
      return;
    }
    this.appendTagPart(current);
    processTag(concatUint8Arrays(this.tagParts), this);
    this.tagParts = null;
  }

  foldDecodedString(bytes, options = {}) {
    if (bytes.length === 0) return;
    if (this.testCase.cacheAllStrings) {
      const cached = this.lookupString(bytes);
      this.checksum = this.testCase.fullReaderChecksum
        ? foldReaderString(this.checksum, options.trim ? cached.trim() : cached)
        : mixString(this.checksum, options.trim ? cached.trim() : cached);
      return;
    }
    const decoded = this.decoder.decode(bytes);
    const value = options.trim ? decoded.trim() : decoded;
    this.materializedStringCount++;
    this.decodedByteCount += bytes.length;
    this.decodeCalls++;
    this.checksum = this.testCase.fullReaderChecksum
      ? foldReaderString(this.checksum, value)
      : mixString(this.checksum, value);
  }

  foldDecodedName(bytes) {
    if (!this.testCase.cacheNames) {
      this.foldDecodedString(bytes);
      return;
    }
    const cached = this.lookupString(bytes);
    this.checksum = this.testCase.fullReaderChecksum
      ? foldReaderString(this.checksum, cached)
      : mixString(this.checksum, cached);
  }

  lookupString(bytes) {
    const key = hashBytes(bytes, 0, bytes.length);
    const entries = this.nameCache.get(key);
    if (entries) {
      for (const entry of entries) {
        if (bytesEqual(entry.bytes, bytes)) {
          this.cachedStringHitCount++;
          this.materializedStringCount++;
          return entry.value;
        }
      }
    }
    const value = this.decoder.decode(bytes);
    if (
      this.testCase.cacheAllStrings
      && typeof this.testCase.maxCachedStrings === 'number'
      && this.nameCache.size >= this.testCase.maxCachedStrings
    ) {
      this.cachedStringBypassCount++;
      this.materializedStringCount++;
      this.decodedByteCount += bytes.length;
      this.decodeCalls++;
      return value;
    }
    const retained = new Uint8Array(bytes.length);
    retained.set(bytes);
    const nextEntries = entries ?? [];
    nextEntries.push({ bytes: retained, value });
    if (!entries) this.nameCache.set(key, nextEntries);
    this.cachedStringMissCount++;
    this.materializedStringCount++;
    this.decodedByteCount += bytes.length;
    this.decodeCalls++;
    return value;
  }
}

function processTag(bytes, state) {
  let start = skipWhitespace(bytes, 0, bytes.length);
  let end = trimTrailingWhitespace(bytes, start, bytes.length);
  if (start >= end) return;

  const first = bytes[start];
  if (first === 63) return;
  if (first === 33) return;
  if (first === 47) {
    const nameStart = skipWhitespace(bytes, start + 1, end);
    const nameEnd = scanNameEnd(bytes, nameStart, end);
    emitElement(state, 3, bytes, nameStart, nameEnd, 0);
    state.endElementCount++;
    return;
  }

  const nameStart = start;
  const nameEnd = scanNameEnd(bytes, nameStart, end);
  const selfClosing = trimTrailingSlash(bytes, nameEnd, end);
  const tagEnd = selfClosing ? end - 1 : end;
  const attrSpans = scanAttributes(bytes, nameEnd, tagEnd);
  emitElement(state, 2, bytes, nameStart, nameEnd, attrSpans.length);
  state.startElementCount++;
  state.attributeCount += attrSpans.length;
  for (const attr of attrSpans) {
    if (state.testCase.decodeAttributeNames) state.foldDecodedName(bytes.subarray(attr.nameStart, attr.nameEnd));
    if (state.testCase.decodeAttributeValues) state.foldDecodedString(bytes.subarray(attr.valueStart, attr.valueEnd));
  }
  if (selfClosing) {
    emitElement(state, 3, bytes, nameStart, nameEnd, 0);
    state.endElementCount++;
  }
}

function emitElement(state, type, bytes, nameStart, nameEnd, attrCount) {
  state.eventCount++;
  state.checksum = mixChecksum(state.checksum, type);
  if (state.testCase.fullReaderChecksum) {
    if (state.testCase.decodeElementNames) state.foldDecodedName(bytes.subarray(nameStart, nameEnd));
    if (type === 2) state.checksum = mixChecksum(state.checksum, attrCount);
    return;
  }
  state.checksum = mixChecksum(state.checksum, hashBytes(bytes, nameStart, nameEnd));
  state.checksum = mixChecksum(state.checksum, attrCount);
  if (state.testCase.decodeElementNames) state.foldDecodedName(bytes.subarray(nameStart, nameEnd));
}

function scanAttributes(bytes, start, end) {
  const spans = [];
  let index = start;
  while (index < end) {
    index = skipWhitespace(bytes, index, end);
    if (index >= end) break;
    const nameStart = index;
    while (index < end && !isXmlWhitespace(bytes[index]) && bytes[index] !== 61) index++;
    const nameEnd = index;
    index = skipWhitespace(bytes, index, end);
    if (index >= end || bytes[index] !== 61) break;
    index++;
    index = skipWhitespace(bytes, index, end);
    if (index >= end || (bytes[index] !== 34 && bytes[index] !== 39)) break;
    const quote = bytes[index++];
    const valueStart = index;
    while (index < end && bytes[index] !== quote) index++;
    const valueEnd = index;
    if (index < end) index++;
    spans.push({ nameStart, nameEnd, valueStart, valueEnd });
  }
  return spans;
}

function materializeParts(parts) {
  if (!parts || parts.length === 0) return new Uint8Array(0);
  return parts.length === 1 ? parts[0] : concatUint8Arrays(parts);
}

function concatUint8Arrays(chunks) {
  let total = 0;
  for (const chunk of chunks) total += chunk.byteLength;
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}

function skipWhitespace(bytes, index, end) {
  while (index < end && isXmlWhitespace(bytes[index])) index++;
  return index;
}

function trimTrailingWhitespace(bytes, start, end) {
  while (end > start && isXmlWhitespace(bytes[end - 1])) end--;
  return end;
}

function trimTrailingSlash(bytes, start, end) {
  let index = trimTrailingWhitespace(bytes, start, end);
  return index > start && bytes[index - 1] === 47;
}

function scanNameEnd(bytes, index, end) {
  while (index < end) {
    const byte = bytes[index];
    if (isXmlWhitespace(byte) || byte === 47) return index;
    index++;
  }
  return index;
}

function hashBytes(bytes, start, end) {
  let hash = 2166136261 | 0;
  for (let index = start; index < end; index++) {
    hash = mixChecksum(hash, bytes[index]);
  }
  return hash;
}

function isXmlWhitespace(byte) {
  return byte === 32 || byte === 10 || byte === 13 || byte === 9;
}

function mixChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function mixString(seed, value) {
  let checksum = mixChecksum(seed, value.length);
  for (let index = 0; index < value.length; index++) {
    checksum = mixChecksum(checksum, value.charCodeAt(index));
  }
  return checksum;
}

function foldReaderString(seed, value) {
  if (!value) return seed;
  let checksum = seed;
  for (let index = 0; index < value.length; index++) {
    checksum = ((checksum << 5) - checksum + value.charCodeAt(index)) | 0;
  }
  return checksum;
}

function sameCounters(left, right) {
  return left.eventCount === right.eventCount
    && left.startElementCount === right.startElementCount
    && left.endElementCount === right.endElementCount
    && left.textEventCount === right.textEventCount
    && left.attributeCount === right.attributeCount
    && left.materializedStringCount === right.materializedStringCount
    && left.cachedStringHitCount === right.cachedStringHitCount
    && left.cachedStringMissCount === right.cachedStringMissCount
    && left.cachedStringBypassCount === right.cachedStringBypassCount
    && left.cachedNameCount === right.cachedNameCount
    && left.decodedByteCount === right.decodedByteCount
    && left.decodeCalls === right.decodeCalls
    && left.checksum === right.checksum;
}

function assertStableCounters(rows) {
  const first = rows[0];
  const baseEventCount = Math.min(...rows.map(row => row.eventCount - (row.emitDocumentEvents ? 2 : 0)));
  for (const row of rows) {
    if (
      row.eventCount !== baseEventCount + (row.emitDocumentEvents ? 2 : 0)
      || row.startElementCount !== first.startElementCount
      || row.endElementCount !== first.endElementCount
      || row.textEventCount !== first.textEventCount
      || row.attributeCount !== first.attributeCount
    ) {
      throw new Error(`${row.id} does not match token counters from ${first.id}.`);
    }
  }
}

function createFindings(rows, tokenOnly, allStrings, fullChecksumCandidate, fullChecksumRows, fastestFullChecksumCandidate, reference) {
  return [
    {
      id: 'same-token-boundary-contract',
      classification: 'CONTRACT_FACT',
      summary: 'All rows consume the same grouped file-backed sync Iterable<Uint8Array[]> source and preserve token boundary counters.',
      evidence: unique(rows.map(row => `${row.eventCount}:${row.startElementCount}:${row.endElementCount}:${row.textEventCount}:${row.attributeCount}`)),
    },
    {
      id: 'string-materialization-frontier',
      classification: 'BENCH_FACT',
      summary: tokenOnly && allStrings
        ? `Adding element, attribute, and text string materialization reached ${formatNumber(allStrings.mibPerSec)} MiB/s versus token-only ${formatNumber(tokenOnly.mibPerSec)} MiB/s (${formatNumber(allStrings.mibPerSec / tokenOnly.mibPerSec)}x).`
        : 'Token-only and all-string rows were not both measured.',
      evidence: rows.map(row => `${row.id}: ${formatNumber(row.mibPerSec)} MiB/s, strings=${row.materializedStringCount}, decodeCalls=${row.decodeCalls}, cacheHits=${row.cachedStringHitCount}, cacheBypass=${row.cachedStringBypassCount}, decodedBytes=${row.decodedByteCount}`),
    },
    {
      id: 'partial-not-stax-counterexample',
      classification: 'SCOPE_GUARD',
      summary: 'These rows use browser-compatible TextDecoder and deliberately avoid Node Buffer and native addons. Full-checksum rows still do not expose public event objects, and partial rows do not claim full StAX checksum parity.',
      evidence: rows.map(row => `${row.id}: fullStringParity=${row.fullStringParity}, usesTextDecoder=${row.usesTextDecoder}, usesNodeBuffer=${row.usesNodeBuffer}`),
    },
    {
      id: 'full-checksum-segmented-candidate',
      classification: fullChecksumCandidate?.fullStringParity ? 'BENCH_FACT' : 'NEGATIVE_RESULT',
      summary: fullChecksumCandidate
        ? `The document-event segmented row ${fullChecksumCandidate.fullStringParity ? 'matched' : 'did not match'} the StreamReaderSync reference at ${formatNumber(fullChecksumCandidate.mibPerSec)} MiB/s.`
        : 'No document-event segmented full-checksum row was measured.',
      evidence: fullChecksumCandidate
        ? [
          `candidate=${fullChecksumCandidate.eventCount}:${fullChecksumCandidate.checksum}`,
          `reference=${reference.eventCount}:${reference.checksum}`,
          `fullStringParity=${fullChecksumCandidate.fullStringParity}`,
          `counterexampleEligible=${fullChecksumCandidate.fullStringParity && fullChecksumCandidate.boundedMemory}`,
        ]
        : [],
    },
    {
      id: 'full-checksum-cache-candidates',
      classification: fullChecksumRows.length > 1 ? 'BENCH_FACT' : 'SCOPE_GUARD',
      summary: fastestFullChecksumCandidate
        ? `The fastest measured full-checksum segmented row was ${fastestFullChecksumCandidate.id} at ${formatNumber(fastestFullChecksumCandidate.mibPerSec)} MiB/s.`
        : 'No full-checksum segmented cache row was measured.',
      evidence: fullChecksumRows.map(row => `${row.id}: ${formatNumber(row.mibPerSec)} MiB/s, fullStringParity=${row.fullStringParity}, strings=${row.materializedStringCount}, decodeCalls=${row.decodeCalls}, cacheHits=${row.cachedStringHitCount}, cacheBypass=${row.cachedStringBypassCount}, checksum=${row.checksum}`),
    },
  ];
}

function describeCase(testCase) {
  const decoded = [
    testCase.decodeElementNames ? 'element names' : null,
    testCase.decodeAttributeNames ? 'attribute names' : null,
    testCase.decodeAttributeValues ? 'attribute values' : null,
    testCase.decodeText ? 'text' : null,
  ].filter(Boolean);
  const cacheSuffix = testCase.cacheNames ? ' using a byte-verified name string cache' : '';
  const allCacheSuffix = testCase.cacheAllStrings
    ? ` and byte-verified bounded cache for all decoded string spans (max ${testCase.maxCachedStrings ?? 'unbounded'})`
    : '';
  return decoded.length === 0
    ? 'Segment-aware token-boundary folding without string materialization'
    : `Segment-aware token-boundary folding with TextDecoder materialization for ${decoded.join(', ')}${cacheSuffix}${allCacheSuffix}`;
}

function renderMarkdown(report) {
  const lines = [
    '# Segment Tokenizer String Frontier',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Fixture: ${report.fixture.path}`,
    `- Fixture size: ${formatNumber(report.fixture.sizeMiB)} MiB`,
    `- Chunk KiB: ${report.options.chunkKiB}`,
    `- Grouped batch size: ${report.options.batchSize}`,
    `- Fastest row: ${report.summary.fastest.id} ${formatNumber(report.summary.fastest.mibPerSec)} MiB/s`,
    `- All strings / token-only ratio: ${formatNullableNumber(report.summary.allStringsVsTokenOnlyRatio)}x`,
    `- Full-checksum segmented candidate: ${formatNullableNumber(report.summary.fullChecksumCandidateMiBPerSec)} MiB/s`,
    `- Full-checksum candidate matches StreamReaderSync reference: ${report.summary.fullChecksumCandidateMatchesReference ? 'yes' : 'no'}`,
    `- Fastest full-checksum segmented candidate: ${report.summary.fastestFullChecksumCandidate ? `${report.summary.fastestFullChecksumCandidate.id} ${formatNumber(report.summary.fastestFullChecksumCandidate.mibPerSec)} MiB/s` : 'n/a'}`,
    `- 200 MiB/s bounded full-string counterexamples: ${report.summary.counterexamples200MiB}`,
    `- StreamReaderSync reference: ${report.reference.eventCount} events, checksum ${report.reference.checksum}`,
    '',
    '## Rows',
    '',
    '| Row | MiB/s | Samples | Spread | Bounded | Max RSS | Events | Strings | Decode calls | Cache hits | Cache misses | Cache bypass | Cached entries | Decoded bytes | Checksum |',
    '| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const row of report.rows) {
    lines.push(`| \`${row.id}\` | ${formatNumber(row.mibPerSec)} | ${row.sampleCount} | ${formatPercent(row.sampleSpreadRatio)} | ${row.boundedMemory ? 'yes' : 'no'} | ${formatBytes(row.memory.maxRssBytes)} | ${row.eventCount} | ${row.materializedStringCount} | ${row.decodeCalls} | ${row.cachedStringHitCount} | ${row.cachedStringMissCount} | ${row.cachedStringBypassCount} | ${row.cachedNameCount} | ${row.decodedByteCount} | ${row.checksum} |`);
  }
  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) lines.push(`  - ${evidence}`);
  }
  lines.push(
    '',
    '## Limits',
    '',
    '- This is a string-materialization frontier over a simplified token-boundary scanner, not the public StAX reader.',
    '- Full-checksum rows are no-public-object checksum candidates; they still do not expose public StAX event objects.',
    '- Partial frontier rows are not full-string parity rows and cannot be counted as runtime-limit counterexamples.',
    '- The benchmark intentionally uses TextDecoder, not Node Buffer, native addons, or lazy getters.',
    '',
  );
  return `${lines.join('\n')}\n`;
}

function summarizeRow(row) {
  return {
    id: row.id,
    mibPerSec: row.mibPerSec,
    boundedMemory: row.boundedMemory,
    memoryKind: 'process-rss',
  };
}

function takeMemorySnapshot() {
  const usage = process.memoryUsage();
  return {
    rssBytes: usage.rss,
    heapUsedBytes: usage.heapUsed,
    externalBytes: usage.external,
    arrayBuffersBytes: usage.arrayBuffers,
  };
}

function gcNow() {
  if (globalThis.gc) globalThis.gc();
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxBy(values, selector) {
  return values.reduce((best, value) => best === undefined || selector(value) > selector(best) ? value : best, undefined);
}

function unique(values) {
  return [...new Set(values)];
}

function bytesEqual(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function formatNullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function formatPercent(value) {
  return `${formatNumber(value * 100)}%`;
}

function formatBytes(bytes) {
  return typeof bytes === 'number' ? `${formatNumber(bytes / MIB)} MiB` : 'n/a';
}

main();
