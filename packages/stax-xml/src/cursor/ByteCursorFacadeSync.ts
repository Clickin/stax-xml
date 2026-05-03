import { Buffer } from 'node:buffer';
import { compileEntityDecoder, type EntityDefinition } from '../IterableEventBackend.js';
import { NodeCurrentCursor } from '../iterable/NodeCurrentCursor.js';
import { CursorEventType, type CursorEventType as CursorEventTypeValue, type CursorReaderOptions } from './types.js';

type ElementContext = {
  name: string;
  localName: string;
  prefix: string | undefined;
  uri: string | undefined;
  namespaces: Map<string, string>;
};

const EMPTY_NAMESPACES = new Map<string, string>();
const CHUNK_SIZE = 8;

export class ByteCursorFacadeSync {
  private readonly cursor: NodeCurrentCursor;
  private readonly entityDecoder: (value: string) => string;
  private readonly namespaceAware: boolean;

  private currentType: CursorEventTypeValue = CursorEventType.START_DOCUMENT;
  private currentDepth = 0;
  private currentName: string | undefined;
  private currentLocalName: string | undefined;
  private currentPrefix: string | undefined;
  private currentUri: string | undefined;
  private currentText: string | undefined;
  private currentAttrCount = 0;

  private readonly attributeLocalNames: Array<string | undefined> = [];
  private readonly attributePrefixes: Array<string | undefined> = [];
  private readonly attributeUris: Array<string | undefined> = [];
  private readonly attributeMetaReady: boolean[] = [];

  private namespaceStack: Map<string, string>[] = [EMPTY_NAMESPACES];
  private elementStack: ElementContext[] = [];

  constructor(input: string | Iterable<readonly Uint8Array[]>, options: CursorReaderOptions = {}) {
    this.cursor = new NodeCurrentCursor(
      typeof input === 'string' ? byteBatchesFromString(input, CHUNK_SIZE) : input,
      {
        materialization: 'none',
        implicitAttributeValue: 'name',
      },
    );
    this.namespaceAware = options.namespaceAware ?? true;
    this.entityDecoder = compileEntityDecoder({
      autoDecodeEntities: options.autoDecodeEntities,
      addEntities: options.addEntities as EntityDefinition[] | undefined,
      implicitAttributeValue: 'name',
    });
  }

  next(): boolean {
    while (this.cursor.next()) {
      if (this.moveToCurrentEvent()) {
        return true;
      }
    }
    this.resetToEndDocument();
    return false;
  }

  eventType(): CursorEventTypeValue {
    return this.currentType;
  }

  name(): string | undefined {
    return this.currentName;
  }

  localName(): string | undefined {
    return this.currentLocalName;
  }

  prefix(): string | undefined {
    return this.currentPrefix;
  }

  uri(): string | undefined {
    return this.currentUri;
  }

  text(): string | undefined {
    return this.currentText;
  }

  getAttributeCount(): number {
    return this.currentType === CursorEventType.START_ELEMENT ? this.currentAttrCount : 0;
  }

  getAttributeName(index: number): string | undefined {
    if (this.currentType !== CursorEventType.START_ELEMENT) {
      return undefined;
    }
    return this.cursor.getAttributeName(index);
  }

  getAttributeLocalName(index: number): string | undefined {
    if (index < 0 || index >= this.currentAttrCount) {
      return undefined;
    }
    this.ensureAttributeMeta(index);
    return this.attributeLocalNames[index];
  }

  getAttributePrefix(index: number): string | undefined {
    if (index < 0 || index >= this.currentAttrCount) {
      return undefined;
    }
    this.ensureAttributeMeta(index);
    return this.attributePrefixes[index];
  }

  getAttributeValue(indexOrName: number | string): string | undefined {
    if (this.currentType !== CursorEventType.START_ELEMENT) {
      return undefined;
    }
    if (typeof indexOrName === 'number') {
      const value = this.cursor.getAttributeValue(indexOrName);
      return value === undefined ? undefined : this.entityDecoder(value);
    }
    for (let index = 0; index < this.currentAttrCount; index++) {
      if (this.cursor.getAttributeName(index) === indexOrName) {
        const value = this.cursor.getAttributeValue(index);
        return value === undefined ? undefined : this.entityDecoder(value);
      }
    }
    return undefined;
  }

  getAttributeUri(index: number): string | undefined {
    if (index < 0 || index >= this.currentAttrCount) {
      return undefined;
    }
    this.ensureAttributeMeta(index);
    return this.attributeUris[index];
  }

  depth(): number {
    return this.currentDepth;
  }

  private moveToCurrentEvent(): boolean {
    this.currentType = this.cursor.eventType() as CursorEventTypeValue;
    this.currentDepth = this.cursor.depth();
    this.currentName = undefined;
    this.currentLocalName = undefined;
    this.currentPrefix = undefined;
    this.currentUri = undefined;
    this.currentText = undefined;
    this.currentAttrCount = 0;
    this.attributeLocalNames.length = 0;
    this.attributePrefixes.length = 0;
    this.attributeUris.length = 0;
    this.attributeMetaReady.length = 0;

    if (this.currentType === CursorEventType.START_DOCUMENT) {
      if (this.namespaceAware) {
        this.namespaceStack = [EMPTY_NAMESPACES];
        this.elementStack = [];
      }
      this.currentDepth = 0;
      return true;
    }
    if (this.currentType === CursorEventType.END_DOCUMENT) {
      this.resetToEndDocument();
      return true;
    }

    if (this.currentType === CursorEventType.CHARACTERS) {
      const value = this.entityDecoder(this.cursor.text() ?? '').trim();
      if (!value) {
        return false;
      }
      this.currentText = value;
      return true;
    }
    if (this.currentType === CursorEventType.CDATA) {
      this.currentText = this.entityDecoder(this.cursor.text() ?? '');
      return true;
    }

    if (this.currentType === CursorEventType.START_ELEMENT) {
      this.moveToStartElement();
      return true;
    }

    this.moveToEndElement();
    return true;
  }

  private moveToStartElement(): void {
    const name = this.cursor.name()!;
    const attrCount = this.cursor.getAttributeCount();
    this.currentAttrCount = attrCount;

    this.currentName = name;
    if (!this.namespaceAware) {
      this.currentLocalName = undefined;
      this.currentPrefix = undefined;
      this.currentUri = undefined;
      return;
    }

    const parentNamespaces = this.namespaceStack[this.namespaceStack.length - 1] ?? EMPTY_NAMESPACES;
    let namespaces = parentNamespaces;
    let namespaceCopied = false;
    for (let index = 0; index < attrCount; index++) {
      const attrName = this.cursor.getAttributeName(index)!;
      const attrValue = this.entityDecoder(this.cursor.getAttributeValue(index)!);
      this.attributeLocalNames.push(undefined);
      this.attributePrefixes.push(undefined);
      this.attributeUris.push(undefined);
      this.attributeMetaReady.push(false);

      if (attrName === 'xmlns' || (attrName.length >= 6 && attrName.charCodeAt(5) === 58 && attrName.slice(0, 5) === 'xmlns')) {
        if (!namespaceCopied) {
          namespaces = new Map(parentNamespaces);
          namespaceCopied = true;
        }
        namespaces.set(attrName === 'xmlns' ? '' : attrName.slice(6), attrValue);
      }
    }

    const qname = splitQName(name, namespaces);
    this.currentLocalName = qname.localName;
    this.currentPrefix = qname.prefix;
    this.currentUri = qname.uri;

    this.namespaceStack.push(namespaces);
    this.elementStack.push({
      name,
      localName: qname.localName,
      prefix: qname.prefix,
      uri: qname.uri,
      namespaces,
    });
  }

  private moveToEndElement(): void {
    const name = this.cursor.name()!;
    this.currentName = name;
    if (!this.namespaceAware) {
      this.currentLocalName = undefined;
      this.currentPrefix = undefined;
      this.currentUri = undefined;
      return;
    }
    const context = this.elementStack.pop();
    if (this.namespaceStack.length > 1) {
      this.namespaceStack.pop();
    }
    if (context && context.name === name) {
      this.currentLocalName = context.localName;
      this.currentPrefix = context.prefix;
      this.currentUri = context.uri;
      return;
    }
    const namespaces = context?.namespaces ?? this.namespaceStack[this.namespaceStack.length - 1];
    const qname = splitQName(name, namespaces);
    this.currentLocalName = qname.localName;
    this.currentPrefix = qname.prefix;
    this.currentUri = qname.uri;
  }

  private ensureAttributeMeta(index: number): void {
    if (!this.namespaceAware) {
      this.attributeMetaReady[index] = true;
      this.attributeLocalNames[index] = undefined;
      this.attributePrefixes[index] = undefined;
      this.attributeUris[index] = undefined;
      return;
    }
    if (this.attributeMetaReady[index]) {
      return;
    }
    this.attributeMetaReady[index] = true;
    const name = this.cursor.getAttributeName(index)!;
    const value = this.entityDecoder(this.cursor.getAttributeValue(index)!);
    const xmlnsInfo = xmlnsAttributeInfo(name, value);
    if (xmlnsInfo) {
      this.attributeLocalNames[index] = xmlnsInfo.localName;
      this.attributePrefixes[index] = xmlnsInfo.prefix;
      this.attributeUris[index] = xmlnsInfo.uri;
      return;
    }
    const qname = splitQName(name, this.namespaceStack[this.namespaceStack.length - 1], false);
    this.attributeLocalNames[index] = qname.localName;
    this.attributePrefixes[index] = qname.prefix;
    this.attributeUris[index] = qname.uri;
  }

  private resetToEndDocument(): void {
    this.currentType = CursorEventType.END_DOCUMENT;
    this.currentDepth = 0;
    this.currentName = undefined;
    this.currentLocalName = undefined;
    this.currentPrefix = undefined;
    this.currentUri = undefined;
    this.currentText = undefined;
    this.currentAttrCount = 0;
    this.attributeLocalNames.length = 0;
    this.attributePrefixes.length = 0;
    this.attributeUris.length = 0;
    this.attributeMetaReady.length = 0;
    if (this.namespaceAware) {
      this.namespaceStack = [EMPTY_NAMESPACES];
      this.elementStack = [];
    }
  }
}

function* byteBatches(bytes: Buffer, chunkSize: number): Iterable<readonly Uint8Array[]> {
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    yield [bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength))];
  }
}

function byteBatchesFromString(xml: string, chunkSize: number): Iterable<readonly Uint8Array[]> {
  return byteBatches(Buffer.from(xml, 'utf8'), chunkSize);
}

function splitQName(
  name: string,
  namespaces?: Map<string, string>,
  useDefaultNamespace = true,
): { localName: string; prefix: string | undefined; uri: string | undefined } {
  const colon = name.indexOf(':');
  if (colon === -1) {
    return {
      localName: name,
      prefix: undefined,
      uri: useDefaultNamespace ? namespaces?.get('') : undefined,
    };
  }
  const prefix = name.slice(0, colon);
  return {
    localName: name.slice(colon + 1),
    prefix,
    uri: namespaces?.get(prefix),
  };
}

function xmlnsAttributeInfo(name: string, value: string): { localName: string; prefix: string | undefined; uri: string | undefined; value: string } | undefined {
  if (name === 'xmlns') {
    return { value, localName: 'xmlns', prefix: undefined, uri: undefined };
  }
  if (name.length >= 6 && name.charCodeAt(5) === 58 && name.slice(0, 5) === 'xmlns') {
    return { value, localName: name.slice(6), prefix: 'xmlns', uri: undefined };
  }
  return undefined;
}
