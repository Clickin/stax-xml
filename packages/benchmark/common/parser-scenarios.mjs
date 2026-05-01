import { EventReaderSync, initStaxXml, StreamEventType, StreamReaderSync, XmlEventType } from 'stax-xml';
import { parseXmlNodesSync } from 'stax-xml/projection';

export const STAX_PARSER_SURFACE_SCENARIOS = [
  {
    label: 'stax-xml EventReaderSync (JS reference)',
    display: 'stax-xml EventReaderSync (JS reference)',
    notes: 'Internal JavaScript reference reader; not a public Node performance fallback',
  },
  {
    label: 'stax-xml EventReaderSync (JS reference decode+parse)',
    display: 'stax-xml EventReaderSync (JS reference decode+parse)',
    notes: 'Reference byte-source path: Buffer.toString plus lean string event reader',
  },
  {
    label: 'stax-xml StreamReaderSync (native)',
    display: '**stax-xml StreamReaderSync (native)**',
    notes: 'Public lean byte-stream reader backed by the initialized native streaming runtime',
  },
  {
    label: 'stax-xml EventReaderSync (native reference)',
    display: 'stax-xml EventReaderSync (native reference)',
    notes: 'Ergonomic string event iterator retained as a reference row, not the native-wrapper gate',
  },
];

export async function ensureNativeReaderRuntime() {
  const runtime = await initStaxXml({ backend: 'native', fallbackOnLoadError: false });
  if (
    runtime.backend.kind !== 'native'
    || !runtime.capabilities.streamingEventBatches
    || !runtime.capabilities.documentNodesProjection
  ) {
    throw new Error(
      'The native stax-xml runtime must expose streamingEventBatches and documentNodesProjection before public reader benchmarks can run.',
    );
  }
  return runtime;
}

export function createStaxParserSurfaceRunners({ xmlString, inputBuffer }) {
  return [
    {
      label: 'stax-xml EventReaderSync (JS)',
      run: () => consumeStaxXmlEventReader(xmlString, 'js'),
    },
    {
      label: 'stax-xml EventReaderSync (JS decode+parse)',
      run: () => consumeStaxXmlEventReader(inputBuffer.toString('utf8'), 'js'),
    },
    {
      label: 'stax-xml StreamReaderSync (native)',
      run: () => consumeStaxXmlStreamReader(inputBuffer),
    },
    {
      label: 'stax-xml EventReaderSync (native reference)',
      run: () => consumeStaxXmlEventReader(xmlString, 'native'),
    },
  ];
}

export function parseXmlToObjectBaseline(xmlString, backend = 'js') {
  return parseXmlNodesSync(xmlString, { backend });
}

function consumeStaxXmlEventReader(xmlString, runtimeBackendPreference) {
  let eventCount = 0;
  let checksum = 0;
  let attrCountTotal = 0;

  for (const event of new EventReaderSync(
    xmlString,
    { autoDecodeEntities: false },
    runtimeBackendPreference,
  )) {
    const type = eventTypeId(event.type);
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

function consumeStaxXmlStreamReader(inputBuffer) {
  let eventCount = 0;
  let checksum = 0;
  let attrCountTotal = 0;
  const parser = new StreamReaderSync(inputBuffer, { backend: 'native' });

  for (;;) {
    const type = parser.next();
    if (type === null) {
      break;
    }
    const attrCount = type === StreamEventType.START_ELEMENT ? parser.getAttributeCount() : 0;
    eventCount++;
    checksum = mixChecksum(checksum, streamEventTypeId(type));
    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      checksum = foldString(checksum, parser.name());
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      checksum = foldString(checksum, parser.text()?.trim());
    }
    checksum = mixChecksum(checksum, attrCount);
    attrCountTotal += attrCount;
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      checksum = foldString(checksum, parser.getAttributeName(attrIndex));
      checksum = foldString(checksum, parser.getAttributeValue(attrIndex));
    }
  }

  return { eventCount, checksum, attrCountTotal };
}

function eventTypeId(type) {
  switch (type) {
    case XmlEventType.START_DOCUMENT:
      return 1;
    case XmlEventType.END_DOCUMENT:
      return 2;
    case XmlEventType.START_ELEMENT:
      return 3;
    case XmlEventType.END_ELEMENT:
      return 4;
    case XmlEventType.CHARACTERS:
      return 5;
    case XmlEventType.CDATA:
      return 6;
    default:
      throw new Error(`Unsupported parser event type: ${type}`);
  }
}

function streamEventTypeId(type) {
  switch (type) {
    case StreamEventType.START_DOCUMENT:
      return 1;
    case StreamEventType.END_DOCUMENT:
      return 2;
    case StreamEventType.START_ELEMENT:
      return 3;
    case StreamEventType.END_ELEMENT:
      return 4;
    case StreamEventType.CHARACTERS:
      return 5;
    case StreamEventType.CDATA:
      return 6;
    default:
      throw new Error(`Unsupported stream event type: ${type}`);
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
