import { compileEntityDecoder, type EntityDefinition } from '../IterableEventBackend.js';
import { Uint8ArrayCurrentCursor } from '../iterable/Uint8ArrayCurrentCursor.js';
import { CursorEventType, type CursorEventType as CursorEventTypeValue, type CursorReaderOptions } from './types.js';

const EMPTY_NAMESPACES = new Map<string, string>();
const CHUNK_SIZE = 8;
const textEncoder = new TextEncoder();

export class ByteCursorFacadeSync {
  private readonly cursor: Uint8ArrayCurrentCursor;
  private readonly entityDecoder: (value: string) => string;
  private readonly namespaceAware: boolean;

  private currentType: CursorEventTypeValue = CursorEventType.START_DOCUMENT;
  private currentDepth = 0;
  private currentName: string | undefined;
  private currentLocalName: string | undefined;
  private currentPrefix: string | undefined;
  private currentUri: string | undefined;
  private currentQNameResolved = false;
  private currentNamespaces: Map<string, string> | undefined;
  private currentText: string | undefined;
  private currentAttrCount = 0;

  private readonly attributeLocalNames: Array<string | undefined> = [];
  private readonly attributePrefixes: Array<string | undefined> = [];
  private readonly attributeUris: Array<string | undefined> = [];
  private readonly attributeMetaReady: boolean[] = [];

  private activeNamespaces: Map<string, string> | undefined;
  private readonly namespaceMaps: Map<string, string>[] = [];
  private readonly namespaceDepths: number[] = [];

  constructor(input: string | Iterable<readonly Uint8Array[]>, options: CursorReaderOptions = {}) {
    this.cursor = new Uint8ArrayCurrentCursor(
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
    this.ensureCurrentQName();
    return this.currentLocalName;
  }

  prefix(): string | undefined {
    this.ensureCurrentQName();
    return this.currentPrefix;
  }

  uri(): string | undefined {
    this.ensureCurrentQName();
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
    this.currentQNameResolved = false;
    this.currentNamespaces = undefined;
    this.currentText = undefined;
    this.currentAttrCount = 0;
    this.attributeLocalNames.length = 0;
    this.attributePrefixes.length = 0;
    this.attributeUris.length = 0;
    this.attributeMetaReady.length = 0;

    if (this.currentType === CursorEventType.START_DOCUMENT) {
      this.resetNamespaces();
      this.currentDepth = 0;
      return true;
    }
    if (this.currentType === CursorEventType.END_DOCUMENT) {
      this.resetToEndDocument();
      return true;
    }
    if (this.currentType === CursorEventType.CHARACTERS) {
      const text = this.entityDecoder(this.cursor.text() ?? '');
      const value = this.cursor.textNeedsTrim() ? text.trim() : text;
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

    let namespaces = this.activeNamespaces;
    if (!this.cursor.hasNamespaceDeclaration()) {
      this.currentNamespaces = namespaces;
      return;
    }

    let namespaceCopied = false;
    for (let index = 0; index < attrCount; index++) {
      const attrName = this.cursor.getAttributeName(index)!;
      if (attrName === 'xmlns' || (attrName.length >= 6 && attrName.charCodeAt(5) === 58 && attrName.slice(0, 5) === 'xmlns')) {
        const attrValue = this.entityDecoder(this.cursor.getAttributeValue(index)!);
        if (!namespaceCopied) {
          namespaces = new Map(namespaces ?? EMPTY_NAMESPACES);
          namespaceCopied = true;
        }
        namespaces!.set(attrName === 'xmlns' ? '' : attrName.slice(6), attrValue);
      }
    }
    this.currentNamespaces = namespaces;
    if (namespaceCopied) {
      this.namespaceMaps.push(namespaces!);
      this.namespaceDepths.push(this.currentDepth - 1);
      this.activeNamespaces = namespaces;
    }
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
    this.currentNamespaces = this.activeNamespaces;
    const top = this.namespaceDepths.length - 1;
    if (top >= 0 && this.namespaceDepths[top] === this.currentDepth) {
      this.namespaceDepths.pop();
      this.namespaceMaps.pop();
      this.activeNamespaces = this.namespaceMaps[this.namespaceMaps.length - 1];
    }
  }

  private ensureAttributeMeta(index: number): void {
    if (!this.namespaceAware) {
      return;
    }
    if (this.attributeMetaReady[index]) {
      return;
    }
    this.ensureAttributeMetaArrays();
    this.attributeMetaReady[index] = true;
    const name = this.cursor.getAttributeName(index)!;
    const xmlnsInfo = xmlnsAttributeInfo(name);
    if (xmlnsInfo) {
      this.attributeLocalNames[index] = xmlnsInfo.localName;
      this.attributePrefixes[index] = xmlnsInfo.prefix;
      this.attributeUris[index] = xmlnsInfo.uri;
      return;
    }
    const qname = splitQName(name, this.currentNamespaces ?? this.activeNamespaces, false);
    this.attributeLocalNames[index] = qname.localName;
    this.attributePrefixes[index] = qname.prefix;
    this.attributeUris[index] = qname.uri;
  }

  private ensureCurrentQName(): void {
    if (!this.namespaceAware || this.currentQNameResolved || this.currentName === undefined) {
      return;
    }
    this.currentQNameResolved = true;
    const qname = splitQName(this.currentName, this.currentNamespaces);
    this.currentLocalName = qname.localName;
    this.currentPrefix = qname.prefix;
    this.currentUri = qname.uri;
  }

  private resetToEndDocument(): void {
    this.currentType = CursorEventType.END_DOCUMENT;
    this.currentDepth = 0;
    this.currentName = undefined;
    this.currentLocalName = undefined;
    this.currentPrefix = undefined;
    this.currentUri = undefined;
    this.currentQNameResolved = false;
    this.currentNamespaces = undefined;
    this.currentText = undefined;
    this.currentAttrCount = 0;
    this.attributeLocalNames.length = 0;
    this.attributePrefixes.length = 0;
    this.attributeUris.length = 0;
    this.attributeMetaReady.length = 0;
    this.resetNamespaces();
  }

  private ensureAttributeMetaArrays(): void {
    if (this.attributeMetaReady.length === this.currentAttrCount) {
      return;
    }
    this.attributeLocalNames.length = this.currentAttrCount;
    this.attributePrefixes.length = this.currentAttrCount;
    this.attributeUris.length = this.currentAttrCount;
    this.attributeMetaReady.length = this.currentAttrCount;
    this.attributeMetaReady.fill(false);
  }

  private resetNamespaces(): void {
    this.activeNamespaces = undefined;
    this.namespaceMaps.length = 0;
    this.namespaceDepths.length = 0;
  }
}

function* byteBatches(bytes: Uint8Array, chunkSize: number): Iterable<readonly Uint8Array[]> {
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    yield [bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength))];
  }
}

function byteBatchesFromString(xml: string, chunkSize: number): Iterable<readonly Uint8Array[]> {
  return byteBatches(textEncoder.encode(xml), chunkSize);
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

function xmlnsAttributeInfo(name: string): { localName: string; prefix: string | undefined; uri: string | undefined } | undefined {
  if (name === 'xmlns') {
    return { localName: 'xmlns', prefix: undefined, uri: undefined };
  }
  if (name.length >= 6 && name.charCodeAt(5) === 58 && name.slice(0, 5) === 'xmlns') {
    return { localName: name.slice(6), prefix: 'xmlns', uri: undefined };
  }
  return undefined;
}
