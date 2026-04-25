import { StaxXmlParserSync, XmlEventType } from 'stax-xml';
import {
  IterableEventType,
  StaxXmlIterableParser,
  toByteBatches,
} from 'stax-xml/iterable';

export const STAX_PARSER_SURFACE_SCENARIOS = [
  {
    label: 'stax-xml JS fallback event parser',
    display: 'stax-xml JS event parser',
    notes: 'Public StaxXmlParserSync event API',
  },
  {
    label: 'stax-xml JS fallback raw iterable',
    display: 'stax-xml JS raw iterable',
    notes: 'Iterable byte frames with string materialization checksum',
  },
  {
    label: 'stax-xml native addon event aggregate',
    display: '**stax-xml native event aggregate**',
    notes: 'N-API aggregate probe; event-like objects stay inside Rust',
  },
  {
    label: 'stax-xml native addon raw aggregate',
    display: '**stax-xml native raw aggregate**',
    notes: 'N-API aggregate probe; coarse Buffer call',
  },
];

export async function loadNativeAggregateProbe() {
  try {
    return await import('@stax-xml/native-aggregate-probe');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to load @stax-xml/native-aggregate-probe. Run ` +
        '`pnpm --filter @stax-xml/native-aggregate-probe build:native` before parser benchmarks. ' +
        `Original error: ${reason}`,
    );
  }
}

export function createStaxParserSurfaceRunners({ xmlString, inputBuffer, native }) {
  return [
    {
      label: 'stax-xml JS fallback event parser',
      run: () => consumeStaxXmlEventParser(xmlString),
    },
    {
      label: 'stax-xml JS fallback raw iterable',
      run: () => consumeStaxXmlRawIterable(inputBuffer),
    },
    {
      label: 'stax-xml native addon event aggregate',
      run: () => normalizeNativeAggregateResult(native.parse_aggregate_buffer(inputBuffer, 'event-object-full')),
    },
    {
      label: 'stax-xml native addon raw aggregate',
      run: () => normalizeNativeAggregateResult(native.parse_aggregate_buffer(inputBuffer, 'full-string-direct')),
    },
  ];
}

export function parseXmlToObjectBaseline(xmlString) {
  const parser = new StaxXmlParserSync(xmlString);
  const elementStack = [];
  let root = null;

  for (const event of parser) {
    elementStack.push(event);
    if (elementStack.length > 100) {
      elementStack.splice(0, elementStack.length);
    }
  }

  return root;
}

function consumeStaxXmlEventParser(xmlString) {
  let eventCount = 0;
  let checksum = 0;
  let attrCountTotal = 0;

  for (const event of new StaxXmlParserSync(xmlString)) {
    const type = syncEventTypeId(event.type);
    const attrs = event.type === XmlEventType.START_ELEMENT ? Object.entries(event.attributes ?? {}) : [];
    eventCount++;
    checksum = mixChecksum(checksum, type);

    if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
      checksum = foldString(checksum, event.name);
    }
    if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
      checksum = foldString(checksum, event.value?.trim());
    }
    checksum = mixChecksum(checksum, attrs.length);
    attrCountTotal += attrs.length;
    for (const [name, value] of attrs) {
      checksum = foldString(checksum, name);
      checksum = foldString(checksum, value);
    }
  }

  return { eventCount, checksum, attrCountTotal };
}

function consumeStaxXmlRawIterable(inputBuffer) {
  const parser = new StaxXmlIterableParser(toByteBatches([inputBuffer], { batchSize: 1 }));
  let eventCount = 0;
  let checksum = 0;
  let attrCountTotal = 0;

  while (parser.nextBatch()) {
    for (let index = 0; index < parser.eventCount(); index++) {
      const type = parser.eventType(index);
      const attrCount = parser.attrCount(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);

      if (type === IterableEventType.START_ELEMENT || type === IterableEventType.END_ELEMENT) {
        checksum = foldString(checksum, parser.copyName(index));
      }
      if (type === IterableEventType.CHARACTERS || type === IterableEventType.CDATA) {
        checksum = foldString(checksum, parser.copyText(index)?.trim());
      }
      checksum = mixChecksum(checksum, attrCount);
      attrCountTotal += attrCount;
      for (let attr = 0; attr < attrCount; attr++) {
        checksum = foldString(checksum, parser.copyAttrName(index, attr));
        checksum = foldString(checksum, parser.copyAttrValue(index, attr));
      }
    }
  }

  return { eventCount, checksum, attrCountTotal };
}

function normalizeNativeAggregateResult(result) {
  return {
    eventCount: result.eventCount ?? result.event_count,
    checksum: result.checksum,
    attrCountTotal: result.attrCountTotal ?? result.attr_count_total,
    objectCount: result.objectCount ?? result.object_count ?? 0,
  };
}

function syncEventTypeId(type) {
  switch (type) {
    case XmlEventType.START_DOCUMENT:
      return IterableEventType.START_DOCUMENT;
    case XmlEventType.END_DOCUMENT:
      return IterableEventType.END_DOCUMENT;
    case XmlEventType.START_ELEMENT:
      return IterableEventType.START_ELEMENT;
    case XmlEventType.END_ELEMENT:
      return IterableEventType.END_ELEMENT;
    case XmlEventType.CHARACTERS:
      return IterableEventType.CHARACTERS;
    case XmlEventType.CDATA:
      return IterableEventType.CDATA;
    default:
      throw new Error(`Unsupported parser event type: ${type}`);
  }
}

function mixChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function foldString(seed, value) {
  if (!value) return seed;
  let next = seed;
  for (let index = 0; index < value.length; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
}
