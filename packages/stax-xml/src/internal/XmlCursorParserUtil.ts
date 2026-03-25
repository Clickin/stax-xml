import { AttributeCollector } from './AttributeCollector';

export interface QualifiedNameInfo {
  name: string;
  localName: string;
  prefix?: string;
  uri?: string;
}

export interface AttributeNameInfo {
  rawName: string;
  localName: string;
  prefix?: string;
  uri?: string;
  isNamespaceDeclaration: boolean;
}

export function cloneNamespaces(parent: Map<string, string> | undefined): Map<string, string> {
  const namespaces = new Map<string, string>();
  if (!parent) {
    return namespaces;
  }

  for (const [prefix, uri] of parent) {
    namespaces.set(prefix, uri);
  }

  return namespaces;
}

export function hasNamespaceDeclarationInSource(
  source: string,
  start: number,
  end: number,
  isWhitespace: (code: number) => boolean
): boolean {
  let index = start;

  while (index < end) {
    while (index < end && isWhitespace(source.charCodeAt(index))) {
      index++;
    }
    if (index >= end) {
      return false;
    }

    const nameStart = index;
    while (index < end) {
      const code = source.charCodeAt(index);
      if (code === 61 || isWhitespace(code)) {
        break;
      }
      index++;
    }

    if (index === nameStart) {
      return false;
    }

    const rawName = source.slice(nameStart, index);
    if (rawName === 'xmlns' || rawName.startsWith('xmlns:')) {
      return true;
    }

    while (index < end && isWhitespace(source.charCodeAt(index))) {
      index++;
    }
    if (index >= end || source.charCodeAt(index) !== 61) {
      continue;
    }

    index++;
    while (index < end && isWhitespace(source.charCodeAt(index))) {
      index++;
    }
    if (index >= end) {
      return false;
    }

    const quote = source.charCodeAt(index);
    if (quote !== 34 && quote !== 39) {
      return false;
    }

    index++;
    while (index < end && source.charCodeAt(index) !== quote) {
      index++;
    }
    if (index < end) {
      index++;
    }
  }

  return false;
}

export function resolveElementName(
  qname: string,
  namespaces: Map<string, string>
): QualifiedNameInfo {
  const colonIndex = qname.indexOf(':');
  if (colonIndex === -1) {
    return {
      name: qname,
      localName: qname,
      uri: namespaces.get(''),
    };
  }

  const prefix = qname.slice(0, colonIndex);
  const localName = qname.slice(colonIndex + 1);
  return {
    name: qname,
    localName,
    prefix,
    uri: namespaces.get(prefix),
  };
}

export function resolveAttributeName(
  rawName: string,
  namespaces: Map<string, string>
): AttributeNameInfo {
  if (rawName === 'xmlns') {
    return {
      rawName,
      localName: 'xmlns',
      isNamespaceDeclaration: true,
    };
  }

  if (rawName.startsWith('xmlns:')) {
    return {
      rawName,
      localName: rawName.slice(6),
      prefix: 'xmlns',
      isNamespaceDeclaration: true,
    };
  }

  const colonIndex = rawName.indexOf(':');
  if (colonIndex === -1) {
    return {
      rawName,
      localName: rawName,
      isNamespaceDeclaration: false,
    };
  }

  const prefix = rawName.slice(0, colonIndex);
  const localName = rawName.slice(colonIndex + 1);
  return {
    rawName,
    localName,
    prefix,
    uri: namespaces.get(prefix),
    isNamespaceDeclaration: false,
  };
}

export function applyNamespaceDeclaration(
  attribute: AttributeNameInfo,
  value: string,
  namespaces: Map<string, string>
): void {
  if (!attribute.isNamespaceDeclaration) {
    return;
  }

  if (attribute.prefix === 'xmlns') {
    namespaces.set(attribute.localName, value);
    return;
  }

  namespaces.set('', value);
}

interface PendingAttribute {
  rawName: string;
  localName: string;
  prefix?: string;
  isNamespaceDeclaration: boolean;
  sourceStart?: number;
  sourceEnd?: number;
  decodedValue?: string;
}

export function collectAttributesFromSource(
  source: string,
  start: number,
  end: number,
  namespaces: Map<string, string>,
  collector: AttributeCollector,
  decodeValue: (text: string) => string,
  isWhitespace: (code: number) => boolean
): void {
  collector.reset(source);
  if (start >= end) {
    return;
  }

  if (!hasNamespaceDeclarationInSource(source, start, end, isWhitespace)) {
    collector.defer(source, start, end, namespaces, isWhitespace);
    return;
  }

  const pendingAttributes: PendingAttribute[] = [];
  let i = start;

  while (i < end) {
    while (i < end && isWhitespace(source.charCodeAt(i))) {
      i++;
    }
    if (i >= end) {
      break;
    }

    const nameStart = i;
    while (i < end) {
      const code = source.charCodeAt(i);
      if (code === 61 || isWhitespace(code)) {
        break;
      }
      i++;
    }

    if (i === nameStart) {
      break;
    }

    const rawName = source.slice(nameStart, i);
    const nameInfo = resolveAttributeName(rawName, namespaces);
    while (i < end && isWhitespace(source.charCodeAt(i))) {
      i++;
    }

    if (i >= end || source.charCodeAt(i) !== 61) {
      pendingAttributes.push({
        rawName: nameInfo.rawName,
        localName: nameInfo.localName,
        prefix: nameInfo.prefix,
        isNamespaceDeclaration: nameInfo.isNamespaceDeclaration,
        decodedValue: 'true',
      });
      continue;
    }

    i++;
    while (i < end && isWhitespace(source.charCodeAt(i))) {
      i++;
    }
    if (i >= end) {
      throw new Error(`Unterminated attribute value for ${rawName}`);
    }

    const quote = source.charCodeAt(i);
    if (quote !== 34 && quote !== 39) {
      throw new Error(`Unterminated attribute value for ${rawName}`);
    }

    i++;
    const valueStart = i;
    while (i < end && source.charCodeAt(i) !== quote) {
      i++;
    }
    if (i >= end) {
      throw new Error(`Unterminated attribute value for ${rawName}`);
    }

    pendingAttributes.push({
      rawName: nameInfo.rawName,
      localName: nameInfo.localName,
      prefix: nameInfo.prefix,
      isNamespaceDeclaration: nameInfo.isNamespaceDeclaration,
      sourceStart: valueStart,
      sourceEnd: i,
    });
    i++;
  }

  for (const pending of pendingAttributes) {
    if (!pending.isNamespaceDeclaration) {
      continue;
    }
    const value = pending.decodedValue ?? decodeValue(source.slice(pending.sourceStart, pending.sourceEnd));

    applyNamespaceDeclaration(
      {
        rawName: pending.rawName,
        localName: pending.localName,
        prefix: pending.prefix,
        uri: pending.prefix ? namespaces.get(pending.prefix) : undefined,
        isNamespaceDeclaration: true,
      },
      value,
      namespaces
    );
    collector.addDecoded(
      pending.rawName,
      pending.localName,
      pending.prefix,
      pending.prefix ? namespaces.get(pending.prefix) : undefined,
      value
    );
  }

  for (const pending of pendingAttributes) {
    if (pending.isNamespaceDeclaration) {
      continue;
    }
    const uri = pending.prefix ? namespaces.get(pending.prefix) : undefined;

    if (pending.decodedValue !== undefined) {
      collector.addDecoded(
        pending.rawName,
        pending.localName,
        pending.prefix,
        uri,
        pending.decodedValue
      );
      continue;
    }

    collector.addLazy(
      pending.rawName,
      pending.localName,
      pending.prefix,
      uri,
      pending.sourceStart!,
      pending.sourceEnd!
    );
  }
}
