import StaxXmlParser from '../../src/StaxXmlParser';
import { StaxXmlParserSync } from '../../src/StaxXmlParserSync';
import type { AnyXmlEvent, AttributeInfo } from '../../src/types';

export interface NormalizedAttributeRecord {
  name: string;
  localName: string;
  prefix?: string;
  uri?: string;
  value: string;
}

export interface NormalizedTraceRecord {
  type: string;
  name?: string;
  localName?: string;
  prefix?: string;
  uri?: string;
  text?: string;
  attributes?: Record<string, string>;
  attributesWithPrefix?: NormalizedAttributeRecord[];
}

export function stringToReadableStream(str: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);

  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
}

export function createChunkedStream(str: string, chunkSize: number): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let offset = 0;

  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }

      const nextOffset = Math.min(offset + chunkSize, bytes.length);
      controller.enqueue(bytes.slice(offset, nextOffset));
      offset = nextOffset;
    }
  });
}

export function collectSyncTrace(xml: string): NormalizedTraceRecord[] {
  return Array.from(new StaxXmlParserSync(xml)).map(normalizeEvent);
}

export async function collectAsyncTrace(xml: string, chunkSize?: number): Promise<NormalizedTraceRecord[]> {
  const stream = chunkSize
    ? createChunkedStream(xml, chunkSize)
    : stringToReadableStream(xml);
  const parser = new StaxXmlParser(stream);
  const trace: NormalizedTraceRecord[] = [];

  for await (const event of parser) {
    trace.push(normalizeEvent(event));
  }

  return trace;
}

export function normalizeEvent(event: AnyXmlEvent): NormalizedTraceRecord {
  const base: NormalizedTraceRecord = {
    type: event.type,
    name: 'name' in event ? event.name : undefined,
    localName: 'localName' in event ? event.localName : undefined,
    prefix: 'prefix' in event ? event.prefix : undefined,
    uri: 'uri' in event ? event.uri : undefined,
    text: 'value' in event ? event.value : undefined,
    attributes: 'attributes' in event ? sortRecord(event.attributes) : undefined,
    attributesWithPrefix: 'attributesWithPrefix' in event
      ? normalizeAttributesWithPrefix(event.attributesWithPrefix)
      : undefined,
  };

  return stripUndefined(base);
}

function normalizeAttributesWithPrefix(
  value: Record<string, AttributeInfo> | undefined
): NormalizedAttributeRecord[] | undefined {
  if (!value) {
    return undefined;
  }

  return Object.entries(value)
    .map(([key, info]) => normalizeAttributeEntry(key, info))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeAttributeEntry(key: string, info: AttributeInfo): NormalizedAttributeRecord {
  const localName = info.localName ?? key;
  const name = info.prefix
    ? `${info.prefix}:${localName}`
    : localName;

  return stripUndefined({
    name,
    localName,
    prefix: info.prefix,
    uri: info.uri,
    value: info.value,
  });
}

function sortRecord(
  value: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!value) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  );
}

function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, entry]) => entry !== undefined)
  ) as T;
}
