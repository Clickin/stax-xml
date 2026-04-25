import {
  XmlEventType,
  type AnyXmlEvent,
  type AttributeInfo,
  type StartElementEvent
} from '../types.js';
import { CursorEventType, type CursorEventType as CursorEventTypeValue } from './types.js';

export class CursorEventView {
  private currentEvent: AnyXmlEvent | undefined;
  private currentType: CursorEventTypeValue = CursorEventType.START_DOCUMENT;
  private currentDepth = 0;
  private attributeNames: string[] = [];
  private attributeInfo: Record<string, AttributeInfo> | undefined;

  moveTo(event: AnyXmlEvent): void {
    if (event.type === XmlEventType.START_ELEMENT) {
      this.currentDepth++;
    } else if (event.type === XmlEventType.END_ELEMENT) {
      this.currentDepth = Math.max(0, this.currentDepth - 1);
    } else if (event.type === XmlEventType.END_DOCUMENT) {
      this.currentDepth = 0;
    }

    this.currentEvent = event;
    this.currentType = toCursorEventType(event);
    if (event.type === XmlEventType.START_ELEMENT) {
      this.attributeNames = Object.keys(event.attributes);
      this.attributeInfo = event.attributesWithPrefix;
    } else {
      this.attributeNames = [];
      this.attributeInfo = undefined;
    }
  }

  reset(): void {
    this.currentEvent = undefined;
    this.currentType = CursorEventType.END_DOCUMENT;
    this.currentDepth = 0;
    this.attributeNames = [];
    this.attributeInfo = undefined;
  }

  eventType(): CursorEventTypeValue {
    return this.currentType;
  }

  name(): string | undefined {
    return isElement(this.currentEvent) ? this.currentEvent.name : undefined;
  }

  localName(): string | undefined {
    return isElement(this.currentEvent) ? this.currentEvent.localName : undefined;
  }

  prefix(): string | undefined {
    return isElement(this.currentEvent) ? this.currentEvent.prefix : undefined;
  }

  uri(): string | undefined {
    return isElement(this.currentEvent) ? this.currentEvent.uri : undefined;
  }

  text(): string | undefined {
    if (this.currentEvent?.type === XmlEventType.CHARACTERS || this.currentEvent?.type === XmlEventType.CDATA) {
      return this.currentEvent.value;
    }
    return undefined;
  }

  getAttributeCount(): number {
    return this.currentEvent?.type === XmlEventType.START_ELEMENT ? this.attributeNames.length : 0;
  }

  getAttributeName(index: number): string | undefined {
    return this.attributeNames[index];
  }

  getAttributeLocalName(index: number): string | undefined {
    const name = this.attributeNames[index];
    if (name === undefined) {
      return undefined;
    }
    return this.attributeInfo?.[name]?.localName ?? splitAttributeName(name).localName;
  }

  getAttributePrefix(index: number): string | undefined {
    const name = this.attributeNames[index];
    if (name === undefined) {
      return undefined;
    }
    return this.attributeInfo?.[name]?.prefix ?? splitAttributeName(name).prefix;
  }

  getAttributeValue(indexOrName: number | string): string | undefined {
    const event = this.currentEvent;
    if (event?.type !== XmlEventType.START_ELEMENT) {
      return undefined;
    }
    if (typeof indexOrName === 'number') {
      const name = this.attributeNames[indexOrName];
      return name === undefined ? undefined : event.attributes[name];
    }
    return event.attributes[indexOrName];
  }

  getAttributeUri(index: number): string | undefined {
    const name = this.attributeNames[index];
    if (name === undefined) {
      return undefined;
    }
    return this.attributeInfo?.[name]?.uri;
  }

  depth(): number {
    return this.currentDepth;
  }
}

function toCursorEventType(event: AnyXmlEvent): CursorEventTypeValue {
  switch (event.type) {
    case XmlEventType.START_DOCUMENT:
      return CursorEventType.START_DOCUMENT;
    case XmlEventType.END_DOCUMENT:
      return CursorEventType.END_DOCUMENT;
    case XmlEventType.START_ELEMENT:
      return CursorEventType.START_ELEMENT;
    case XmlEventType.END_ELEMENT:
      return CursorEventType.END_ELEMENT;
    case XmlEventType.CHARACTERS:
      return CursorEventType.CHARACTERS;
    case XmlEventType.CDATA:
      return CursorEventType.CDATA;
    case XmlEventType.ERROR:
      return CursorEventType.ERROR;
  }
}

function isElement(event: AnyXmlEvent | undefined): event is StartElementEvent | Extract<AnyXmlEvent, { type: typeof XmlEventType.END_ELEMENT }> {
  return event?.type === XmlEventType.START_ELEMENT || event?.type === XmlEventType.END_ELEMENT;
}

function splitAttributeName(name: string): { localName: string; prefix: string | undefined } {
  const colon = name.indexOf(':');
  if (colon === -1) {
    return { localName: name, prefix: undefined };
  }
  return {
    localName: name.slice(colon + 1),
    prefix: name.slice(0, colon)
  };
}
