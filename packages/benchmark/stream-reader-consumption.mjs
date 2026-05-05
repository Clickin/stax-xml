import { performance } from 'node:perf_hooks';
import { StreamEventType, StreamReaderSync } from 'stax-xml';
import { ASSET_PATHS, loadXmlBuffer } from './common/utils.mjs';
import { parserFixtureContractForAssetPath } from './common/parser-scenarios.mjs';

const inputBuffer = loadXmlBuffer(ASSET_PATHS.midsize);
const contract = parserFixtureContractForAssetPath(ASSET_PATHS.midsize);
const warmups = Number.parseInt(process.argv.find((arg) => arg.startsWith('--warmups='))?.slice(10) ?? '2', 10);
const runs = Number.parseInt(process.argv.find((arg) => arg.startsWith('--runs='))?.slice(7) ?? '7', 10);

const scenarios = [
  ['event-wrapper-for-of', parseWithEventWrapperForOf],
  ['index-for-of-batch', parseWithIndexForOfBatch],
  ['index-while-next-batch', parseWithIndexWhileNextBatch],
];

const reference = JSON.stringify(parseWithEventWrapperForOf());
for (const [label, run] of scenarios.slice(1)) {
  const candidate = JSON.stringify(run());
  if (candidate !== reference) {
    throw new Error(`${label} produced a different object shape.`);
  }
}

console.log(`StreamReaderSync consumption styles (${formatBytes(inputBuffer.byteLength)}, midsize.xml)`);
console.log(`warmups=${warmups}, runs=${runs}`);
for (const [label, run] of scenarios) {
  const result = measure(run);
  console.log(`${label.padEnd(24)} avg=${result.avgMs.toFixed(2)} ms median=${result.medianMs.toFixed(2)} ms p75=${result.p75Ms.toFixed(2)} ms min=${result.minMs.toFixed(2)} ms max=${result.maxMs.toFixed(2)} ms rows=${result.rows}`);
}

function measure(run) {
  for (let index = 0; index < warmups; index++) {
    run();
  }

  const times = [];
  let rows = 0;
  for (let index = 0; index < runs; index++) {
    globalThis.gc?.();
    const start = performance.now();
    const result = run();
    times.push(performance.now() - start);
    rows = result.length;
  }

  return {
    rows,
    medianMs: percentile(times, 0.5),
    p75Ms: percentile(times, 0.75),
    avgMs: times.reduce((sum, value) => sum + value, 0) / times.length,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
  };
}

function parseWithEventWrapperForOf() {
  const parser = new StreamReaderSync(inputBuffer);
  const rows = [];
  const elementStack = [];
  let currentRow = null;

  for (const batch of parser) {
    for (const event of batch) {
      switch (event.type) {
        case StreamEventType.START_ELEMENT: {
          const name = event.name();
          elementStack.push(name);
          if (name === contract.itemName) {
            currentRow = createEmptyRow();
            const attrCount = event.getAttributeCount();
            for (let index = 0; index < attrCount; index++) {
              const attrName = event.getAttributeName(index);
              const field = contract.attributeFields.find((candidate) => candidate.sourceName === attrName);
              if (field) {
                currentRow[field.outputName] = event.getAttributeValue(index) ?? '';
              }
            }
          }
          break;
        }
        case StreamEventType.CHARACTERS:
        case StreamEventType.CDATA:
          consumeTextEvent(event.text()?.trim(), elementStack, currentRow);
          break;
        case StreamEventType.END_ELEMENT: {
          const name = elementStack.pop();
          if (name === contract.itemName && currentRow) {
            rows.push(currentRow);
            currentRow = null;
          }
          break;
        }
        default:
          break;
      }
    }
  }

  return rows;
}

function parseWithIndexForOfBatch() {
  const parser = new StreamReaderSync(inputBuffer);
  const rows = [];
  const elementStack = [];
  let currentRow = null;

  for (const batch of parser) {
    const eventCount = batch.eventCount;
    for (let index = 0; index < eventCount; index++) {
      const type = batch.typeAt(index);
      switch (type) {
        case StreamEventType.START_ELEMENT: {
          const name = batch.nameAt(index);
          elementStack.push(name);
          if (name === contract.itemName) {
            currentRow = createEmptyRow();
            const attrCount = batch.attributeCountAt(index);
            for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
              const attrName = batch.attributeNameAt(index, attrIndex);
              const field = contract.attributeFields.find((candidate) => candidate.sourceName === attrName);
              if (field) {
                currentRow[field.outputName] = batch.attributeValueAt(index, attrIndex) ?? '';
              }
            }
          }
          break;
        }
        case StreamEventType.CHARACTERS:
        case StreamEventType.CDATA:
          consumeTextEvent(batch.textAt(index)?.trim(), elementStack, currentRow);
          break;
        case StreamEventType.END_ELEMENT: {
          const name = elementStack.pop();
          if (name === contract.itemName && currentRow) {
            rows.push(currentRow);
            currentRow = null;
          }
          break;
        }
        default:
          break;
      }
    }
  }

  return rows;
}

function parseWithIndexWhileNextBatch() {
  const parser = new StreamReaderSync(inputBuffer);
  const rows = [];
  const elementStack = [];
  let currentRow = null;
  let batch;

  while ((batch = parser.nextBatch()) !== null) {
    let index = 0;
    const eventCount = batch.eventCount;
    while (index < eventCount) {
      const type = batch.typeAt(index);
      switch (type) {
        case StreamEventType.START_ELEMENT: {
          const name = batch.nameAt(index);
          elementStack.push(name);
          if (name === contract.itemName) {
            currentRow = createEmptyRow();
            const attrCount = batch.attributeCountAt(index);
            let attrIndex = 0;
            while (attrIndex < attrCount) {
              const attrName = batch.attributeNameAt(index, attrIndex);
              const field = contract.attributeFields.find((candidate) => candidate.sourceName === attrName);
              if (field) {
                currentRow[field.outputName] = batch.attributeValueAt(index, attrIndex) ?? '';
              }
              attrIndex++;
            }
          }
          break;
        }
        case StreamEventType.CHARACTERS:
        case StreamEventType.CDATA:
          consumeTextEvent(batch.textAt(index)?.trim(), elementStack, currentRow);
          break;
        case StreamEventType.END_ELEMENT: {
          const name = elementStack.pop();
          if (name === contract.itemName && currentRow) {
            rows.push(currentRow);
            currentRow = null;
          }
          break;
        }
        default:
          break;
      }
      index++;
    }
  }

  return rows;
}

function consumeTextEvent(text, elementStack, currentRow) {
  if (!currentRow || !text) return;
  const currentElement = elementStack[elementStack.length - 1];
  const parentElement = elementStack[elementStack.length - 2];
  if (parentElement !== contract.itemName) return;
  const field = contract.elementFieldByName.get(currentElement);
  if (!field) return;
  currentRow[field.outputName] = currentRow[field.outputName]
    ? `${currentRow[field.outputName]}${text}`
    : text;
}

function createEmptyRow() {
  return Object.fromEntries(contract.fields.map((field) => [field.outputName, '']));
}

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index];
}
