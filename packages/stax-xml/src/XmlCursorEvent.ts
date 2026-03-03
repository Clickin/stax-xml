import { AttrStore } from './AttrStore';
import {
  AnyXmlEvent,
  CursorAttribute,
  CursorXmlEventType,
  StartElementEvent,
  XmlEventType,
  isStartElement
} from './types';

export class XmlCursorEvent {
  private readonly attrStore: AttrStore | null;

  constructor(private readonly raw: AnyXmlEvent) {
    this.attrStore = isStartElement(raw) ? new AttrStore(raw as StartElementEvent) : null;
  }

  get type(): CursorXmlEventType {
    return this.raw.type;
  }

  get name(): string | undefined {
    return 'name' in this.raw ? this.raw.name : undefined;
  }

  get localName(): string | undefined {
    return 'localName' in this.raw ? this.raw.localName : undefined;
  }

  get prefix(): string | undefined {
    return 'prefix' in this.raw ? this.raw.prefix : undefined;
  }

  get uri(): string | undefined {
    return 'uri' in this.raw ? this.raw.uri : undefined;
  }

  get text(): string | undefined {
    return 'value' in this.raw ? this.raw.value : undefined;
  }

  get error(): Error | undefined {
    return 'error' in this.raw ? this.raw.error : undefined;
  }

  isStartElement(): boolean {
    return this.type === XmlEventType.START_ELEMENT;
  }

  isEndElement(): boolean {
    return this.type === XmlEventType.END_ELEMENT;
  }

  isCharacters(): boolean {
    return this.type === XmlEventType.CHARACTERS;
  }

  isCdata(): boolean {
    return this.type === XmlEventType.CDATA;
  }

  isStartDocument(): boolean {
    return this.type === XmlEventType.START_DOCUMENT;
  }

  isEndDocument(): boolean {
    return this.type === XmlEventType.END_DOCUMENT;
  }

  getAttributeCount(): number {
    return this.attrStore?.count ?? 0;
  }

  getAttribute(index: number): CursorAttribute | undefined {
    return this.attrStore?.getByIndex(index);
  }

  getAttributeValue(name: string): string | undefined {
    return this.attrStore?.getByName(name)?.value;
  }

  toEvent(): AnyXmlEvent {
    return this.raw;
  }
}
