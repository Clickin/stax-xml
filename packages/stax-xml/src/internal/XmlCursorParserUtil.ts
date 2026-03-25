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
    while (i < end && isWhitespace(source.charCodeAt(i))) {
      i++;
    }

    if (i >= end || source.charCodeAt(i) !== 61) {
      pendingAttributes.push({
        rawName,
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
      rawName,
      sourceStart: valueStart,
      sourceEnd: i,
    });
    i++;
  }

  for (const pending of pendingAttributes) {
    const value = pending.decodedValue ?? decodeValue(source.slice(pending.sourceStart, pending.sourceEnd));
    const nameInfo = resolveAttributeName(pending.rawName, namespaces);

    if (!nameInfo.isNamespaceDeclaration) {
      continue;
    }

    applyNamespaceDeclaration(nameInfo, value, namespaces);
    collector.addDecoded(
      nameInfo.rawName,
      nameInfo.localName,
      nameInfo.prefix,
      nameInfo.uri,
      value
    );
  }

  for (const pending of pendingAttributes) {
    const nameInfo = resolveAttributeName(pending.rawName, namespaces);
    if (nameInfo.isNamespaceDeclaration) {
      continue;
    }

    if (pending.decodedValue !== undefined) {
      collector.addDecoded(
        nameInfo.rawName,
        nameInfo.localName,
        nameInfo.prefix,
        nameInfo.uri,
        pending.decodedValue
      );
      continue;
    }

    collector.addLazy(
      nameInfo.rawName,
      nameInfo.localName,
      nameInfo.prefix,
      nameInfo.uri,
      pending.sourceStart,
      pending.sourceEnd
    );
  }
}
