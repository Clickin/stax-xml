import type { WriteElementOptions } from './types.js';

export const XML_NAMESPACE_URI = 'http://www.w3.org/XML/1998/namespace';
export const XMLNS_NAMESPACE_URI = 'http://www.w3.org/2000/xmlns/';

export function assertXmlName(value: string, label: string): void {
  let index = 0;
  while (index < value.length) {
    const code = value.codePointAt(index)!;
    const start = index === 0;
    if (!isNameStart(code) && !( !start && isNamePart(code))) {
      throw new Error(`Invalid XML ${label}: ${value}`);
    }
    index += code > 0xffff ? 2 : 1;
  }
  if (index === 0) throw new Error(`Invalid XML ${label}: ${value}`);
}

export function assertXmlNCName(value: string, label: string): void {
  assertXmlName(value, label);
  if (value.includes(':')) throw new Error(`Invalid XML ${label}: ${value}`);
}

export function assertXmlQName(value: string, label: string): void {
  const parts = value.split(':');
  if (parts.length > 2) throw new Error(`Invalid XML ${label}: ${value}`);
  for (const part of parts) assertXmlNCName(part, label);
}

export function assertXmlVersion(version: string): void {
  if (version !== '1.0') {
    throw new Error(`Writer only supports XML 1.0, received: ${version}`);
  }
}

export function assertXmlEncodingName(encoding: string): void {
  if (typeof encoding !== 'string' || !/^[A-Za-z][A-Za-z0-9._-]*$/.test(encoding)) {
    throw new Error(`Invalid XML encoding name: ${encoding}`);
  }
}

export function assertXmlChars(value: string, label: string): void {
  for (let index = 0; index < value.length; index++) {
    const code = value.codePointAt(index)!;
    if ((code < 0x20 && code !== 9 && code !== 10 && code !== 13)
      || (code >= 0xd800 && code <= 0xdfff) || (code > 0xfffd && code < 0x10000)) {
      throw new Error(`Invalid XML character in ${label}.`);
    }
    if (code > 0xffff) index++;
  }
}

export function assertNamespaceBinding(prefix: string, uri: string): void {
  if (prefix) assertXmlNCName(prefix, 'namespace prefix');
  assertXmlChars(uri, 'namespace URI');
  if (prefix === 'xmlns') throw new Error("The namespace prefix 'xmlns' is reserved.");
  if (prefix && uri === '') throw new Error(`Namespace prefix '${prefix}' cannot be undeclared.`);
  if (uri === XMLNS_NAMESPACE_URI) throw new Error('The xmlns namespace URI is reserved.');
  if (prefix === 'xml' && uri !== XML_NAMESPACE_URI) {
    throw new Error(`The namespace prefix 'xml' must be bound to ${XML_NAMESPACE_URI}.`);
  }
  if (prefix !== 'xml' && uri === XML_NAMESPACE_URI) {
    throw new Error(`The XML namespace URI may only be bound to the prefix 'xml'.`);
  }
}

export interface PlannedStartElement {
  prefix: string;
  qualifiedName: string;
  startTag: string;
  namespaceBindings: Array<{ prefix: string; uri: string }>;
  attributeNames: Set<string>;
}

export function planStartElement(
  localName: string,
  options: WriteElementOptions | undefined,
  resolveNamespace: (prefix: string) => string | undefined,
  escapeXml: (value: string) => string,
  allowUnboundElementPrefix = false
): PlannedStartElement {
  assertXmlNCName(localName, 'element name');

  const prefix = options?.prefix || '';
  const uri = options?.uri;
  if (prefix) assertXmlNCName(prefix, 'prefix');
  if (prefix === 'xmlns') throw new Error("The namespace prefix 'xmlns' is reserved.");
  if (options?.comment !== undefined) {
    assertXmlChars(options.comment, 'comment');
    if (options.comment.includes('--')) throw new Error('XML comment cannot contain "--" sequence.');
  }

  const namespaceBindings: Array<{ prefix: string; uri: string }> = [];
  const pendingNamespaces = new Map<string, string>();
  const attributeNames = new Set<string>();
  let attributes = '';

  const resolve = (candidate: string): string | undefined => {
    if (candidate === 'xml') return XML_NAMESPACE_URI;
    return pendingNamespaces.get(candidate) ?? resolveNamespace(candidate);
  };
  const declare = (candidate: string, namespaceUri: string): void => {
    assertNamespaceBinding(candidate, namespaceUri);
    const pending = pendingNamespaces.get(candidate);
    if (pending !== undefined && pending !== namespaceUri) {
      throw new Error(`Conflicting namespace binding for prefix '${candidate}'.`);
    }
    if (pending !== undefined || resolve(candidate) === namespaceUri) return;
    pendingNamespaces.set(candidate, namespaceUri);
    namespaceBindings.push({ prefix: candidate, uri: namespaceUri });
    const declarationName = candidate ? `xmlns:${candidate}` : 'xmlns';
    reserveExpandedAttribute(attributeNames, XMLNS_NAMESPACE_URI, candidate || 'xmlns', declarationName);
    attributes += ` ${declarationName}="${escapeXml(namespaceUri)}"`;
  };

  if (uri !== undefined) {
    declare(prefix, uri);
  } else if (prefix && resolve(prefix) === undefined && !allowUnboundElementPrefix) {
    throw new Error(`Namespace prefix '${prefix}' is not defined for element '${localName}'`);
  }

  for (const [key, value] of Object.entries(options?.attributes ?? {})) {
    if (value === undefined) continue;
    assertXmlNCName(key, 'attribute name');
    if (key === 'xmlns') throw new Error("Attribute name 'xmlns' is reserved for namespace declarations.");

    if (typeof value === 'string') {
      assertXmlChars(value, 'attribute value');
      reserveExpandedAttribute(attributeNames, '', key, key);
      attributes += ` ${key}="${escapeXml(value)}"`;
      continue;
    }

    const attributePrefix = value.prefix || '';
    const attributeUri = value.uri;
    if (attributePrefix) {
      assertXmlNCName(attributePrefix, 'attribute prefix');
      if (attributePrefix === 'xmlns') throw new Error("The attribute prefix 'xmlns' is reserved.");
      if (attributeUri !== undefined) declare(attributePrefix, attributeUri);
      const resolvedUri = resolve(attributePrefix);
      if (resolvedUri === undefined) {
        throw new Error(`Namespace prefix '${attributePrefix}' is not defined for attribute '${key}'`);
      }
      assertXmlChars(value.value, 'attribute value');
      const qualifiedName = `${attributePrefix}:${key}`;
      reserveExpandedAttribute(attributeNames, resolvedUri, key, qualifiedName);
      attributes += ` ${qualifiedName}="${escapeXml(value.value)}"`;
    } else {
      if (attributeUri) throw new Error(`Attribute '${key}' has a namespace URI but no prefix.`);
      assertXmlChars(value.value, 'attribute value');
      reserveExpandedAttribute(attributeNames, '', key, key);
      attributes += ` ${key}="${escapeXml(value.value)}"`;
    }
  }

  const qualifiedName = prefix ? `${prefix}:${localName}` : localName;
  return { prefix, qualifiedName, startTag: `<${qualifiedName}${attributes}`, namespaceBindings, attributeNames };
}

export function reserveExpandedAttribute(
  names: Set<string>,
  uri: string,
  localName: string,
  displayName: string
): void {
  const key = `${uri}\0${localName}`;
  if (names.has(key)) throw new Error(`Duplicate attribute: ${displayName}`);
  names.add(key);
}

function isNameStart(code: number): boolean {
  return code === 58 || code === 95 || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
    || (code >= 0xc0 && code <= 0xd6) || (code >= 0xd8 && code <= 0xf6)
    || (code >= 0xf8 && code <= 0x2ff) || (code >= 0x370 && code <= 0x37d)
    || (code >= 0x37f && code <= 0x1fff) || (code >= 0x200c && code <= 0x200d)
    || (code >= 0x2070 && code <= 0x218f) || (code >= 0x2c00 && code <= 0x2fef)
    || (code >= 0x3001 && code <= 0xd7ff) || (code >= 0xf900 && code <= 0xfdcf)
    || (code >= 0xfdf0 && code <= 0xfffd) || (code >= 0x10000 && code <= 0xeffff);
}

function isNamePart(code: number): boolean {
  return (code >= 48 && code <= 57) || code === 45 || code === 46 || code === 0xb7
    || (code >= 0x300 && code <= 0x36f) || (code >= 0x203f && code <= 0x2040);
}
