import {
  compileEntityDecoder,
  materializableAttrCount,
  materializableImplicitAttributeValue,
  type EntityDefinition,
  type MaterializableEventSource,
} from '../IterableEventBackend.js';
import { IterableEventType } from '../StaxXmlIterableParser.js';
import {
  XmlEventType,
  type AnyXmlEvent,
  type AttributeInfo,
  type StartElementEvent
} from '../types.js';
import { CursorEventType, type CursorEventType as CursorEventTypeValue } from './types.js';

type ElementContext = {
  name: string;
  localName: string;
  prefix: string | undefined;
  uri: string | undefined;
  namespaces: Map<string, string>;
};

const EMPTY_NAMESPACES = new Map<string, string>();

export class CursorEventView {
  private currentType: CursorEventTypeValue = CursorEventType.START_DOCUMENT;
  private currentDepth = 0;
  private currentName: string | undefined;
  private currentLocalName: string | undefined;
  private currentPrefix: string | undefined;
  private currentUri: string | undefined;
  private currentText: string | undefined;
  private currentAttributes: Record<string, string> | undefined;
  private attributeNames: string[] = [];
  private attributeInfo: Record<string, AttributeInfo> | undefined;
  private namespaceStack: Map<string, string>[] = [EMPTY_NAMESPACES];
  private elementStack: ElementContext[] = [];

  moveTo(event: AnyXmlEvent): void {
    if (event.type === XmlEventType.START_ELEMENT) {
      this.currentDepth++;
    } else if (event.type === XmlEventType.END_ELEMENT) {
      this.currentDepth = Math.max(0, this.currentDepth - 1);
    } else if (event.type === XmlEventType.END_DOCUMENT) {
      this.currentDepth = 0;
    }

    this.currentType = toCursorEventType(event);
    this.currentName = isElement(event) ? event.name : undefined;
    this.currentLocalName = isElement(event) ? event.localName : undefined;
    this.currentPrefix = isElement(event) ? event.prefix : undefined;
    this.currentUri = isElement(event) ? event.uri : undefined;
    this.currentText = event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA
      ? event.value
      : undefined;
    if (event.type === XmlEventType.START_ELEMENT) {
      this.currentAttributes = event.attributes;
      this.attributeNames = Object.keys(event.attributes);
      this.attributeInfo = event.attributesWithPrefix;
    } else {
      this.currentAttributes = undefined;
      this.attributeNames = [];
      this.attributeInfo = undefined;
    }
  }

  moveToTable(
    parser: MaterializableEventSource,
    index: number,
    options: {
      autoDecodeEntities?: boolean;
      addEntities?: EntityDefinition[];
      implicitAttributeValue?: 'true' | 'name';
    } = {},
  ): boolean {
    this.currentName = undefined;
    this.currentLocalName = undefined;
    this.currentPrefix = undefined;
    this.currentUri = undefined;
    this.currentText = undefined;
    this.currentAttributes = undefined;
    this.attributeNames = [];
    this.attributeInfo = undefined;

    const type = parser.eventType(index);
    if (type === IterableEventType.START_DOCUMENT) {
      this.currentType = CursorEventType.START_DOCUMENT;
      return true;
    }
    if (type === IterableEventType.END_DOCUMENT) {
      this.currentType = CursorEventType.END_DOCUMENT;
      this.currentDepth = 0;
      return true;
    }

    const entityDecoder = compileEntityDecoder({
      autoDecodeEntities: options.autoDecodeEntities,
      addEntities: options.addEntities,
    });
    if (type === IterableEventType.START_ELEMENT) {
      this.currentDepth++;
      const name = parser.copyName(index)!;
      const parentNamespaces = this.namespaceStack[this.namespaceStack.length - 1]!;
      const parsedAttributes = this.copyTableAttributes(parser, index, parentNamespaces, entityDecoder, options.implicitAttributeValue);
      const namespaces = parsedAttributes.namespaces;
      const qname = splitQName(name, namespaces);
      this.namespaceStack.push(namespaces);
      this.elementStack.push({
        name,
        localName: qname.localName,
        prefix: qname.prefix,
        uri: qname.uri,
        namespaces,
      });
      this.currentType = CursorEventType.START_ELEMENT;
      this.currentName = name;
      this.currentLocalName = qname.localName;
      this.currentPrefix = qname.prefix;
      this.currentUri = qname.uri;
      this.currentAttributes = parsedAttributes.attributes;
      this.attributeInfo = parsedAttributes.attributesWithPrefix;
      this.attributeNames = Object.keys(parsedAttributes.attributes);
      return true;
    }

    if (type === IterableEventType.END_ELEMENT) {
      this.currentDepth = Math.max(0, this.currentDepth - 1);
      const name = parser.copyName(index)!;
      const context = this.elementStack.pop();
      this.namespaceStack.pop();
      const namespaces = context?.namespaces ?? this.namespaceStack[this.namespaceStack.length - 1];
      const qname = context && context.name === name
        ? context
        : splitQName(name, namespaces);
      this.currentType = CursorEventType.END_ELEMENT;
      this.currentName = name;
      this.currentLocalName = qname.localName;
      this.currentPrefix = qname.prefix;
      this.currentUri = qname.uri;
      return true;
    }

    if (type === IterableEventType.CHARACTERS) {
      const value = entityDecoder(parser.copyText(index)!).trim();
      if (!value) {
        return false;
      }
      this.currentType = CursorEventType.CHARACTERS;
      this.currentText = value;
      return true;
    }

    this.currentType = CursorEventType.CDATA;
    this.currentText = entityDecoder(parser.copyText(index)!);
    return true;
  }

  reset(): void {
    this.currentType = CursorEventType.END_DOCUMENT;
    this.currentDepth = 0;
    this.currentName = undefined;
    this.currentLocalName = undefined;
    this.currentPrefix = undefined;
    this.currentUri = undefined;
    this.currentText = undefined;
    this.currentAttributes = undefined;
    this.attributeNames = [];
    this.attributeInfo = undefined;
    this.namespaceStack = [EMPTY_NAMESPACES];
    this.elementStack = [];
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
    return this.currentType === CursorEventType.START_ELEMENT ? this.attributeNames.length : 0;
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
    if (this.currentType !== CursorEventType.START_ELEMENT || !this.currentAttributes) {
      return undefined;
    }
    if (typeof indexOrName === 'number') {
      const name = this.attributeNames[indexOrName];
      return name === undefined ? undefined : this.currentAttributes[name];
    }
    return this.currentAttributes[indexOrName];
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

  private copyTableAttributes(
    parser: MaterializableEventSource,
    eventIndex: number,
    parentNamespaces: Map<string, string>,
    entityDecoder: (value: string) => string,
    implicitAttributeValue: 'true' | 'name' = 'true',
  ): {
    attributes: Record<string, string>;
    attributesWithPrefix: Record<string, AttributeInfo>;
    namespaces: Map<string, string>;
  } {
    const count = materializableAttrCount(parser, eventIndex);
    if (count === 0) {
      return { attributes: {}, attributesWithPrefix: {}, namespaces: parentNamespaces };
    }

    const rawAttributes: Array<{ name: string; value: string }> = [];
    let namespaces = parentNamespaces;
    let namespaceCopied = false;

    for (let attrIndex = 0; attrIndex < count; attrIndex++) {
      const name = parser.copyAttrName(eventIndex, attrIndex)!;
      const value = materializableImplicitAttributeValue(parser, eventIndex, attrIndex)
        ? (implicitAttributeValue === 'name' ? name : 'true')
        : entityDecoder(parser.copyAttrValue(eventIndex, attrIndex)!);
      rawAttributes.push({ name, value });

      if (name === 'xmlns' || (name.length >= 6 && name.charCodeAt(5) === 58 && name.slice(0, 5) === 'xmlns')) {
        if (!namespaceCopied) {
          namespaces = new Map(parentNamespaces);
          namespaceCopied = true;
        }
        namespaces.set(name === 'xmlns' ? '' : name.slice(6), value);
      }
    }

    const attributes: Record<string, string> = Object.create(null) as Record<string, string>;
    const attributesWithPrefix: Record<string, AttributeInfo> = Object.create(null) as Record<string, AttributeInfo>;
    for (const attribute of rawAttributes) {
      attributes[attribute.name] = attribute.value;
      attributesWithPrefix[attribute.name] = attributeInfo(attribute.name, attribute.value, namespaces);
    }
    return { attributes, attributesWithPrefix, namespaces };
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

function splitQName(
  name: string,
  namespaces?: Map<string, string>,
  useDefaultNamespace = true
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

function attributeInfo(name: string, value: string, namespaces: Map<string, string>): AttributeInfo {
  const xmlnsInfo = xmlnsAttributeInfo(name, value);
  if (xmlnsInfo) {
    return xmlnsInfo;
  }

  const qname = splitQName(name, namespaces, false);
  return {
    value,
    localName: qname.localName,
    prefix: qname.prefix,
    uri: qname.uri,
  };
}

function xmlnsAttributeInfo(name: string, value: string): AttributeInfo | undefined {
  if (name === 'xmlns') {
    return { value, localName: 'xmlns', prefix: undefined, uri: undefined };
  }
  if (name.length >= 6 && name.charCodeAt(5) === 58 && name.slice(0, 5) === 'xmlns') {
    return { value, localName: name.slice(6), prefix: 'xmlns', uri: undefined };
  }
  return undefined;
}
