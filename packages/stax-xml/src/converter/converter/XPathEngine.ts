import { assertXmlQName } from '@stax-xml/core';

/**
 * Compiled XPath expression for efficient evaluation
 * Supports absolute, leading descendant, and explicit relative paths; terminal
 * attributes/text(); and positive literal position predicates.
 *
 * @internal
 */
export interface CompiledXPath {
  segments: XPathSegment[];
  isAbsolute: boolean;
  isDescendant: boolean;
}

/**
 * XPath segment with predicates
 *
 * @internal
 */
export interface XPathSegment {
  name: string;
  predicates: XPathPredicate[];
  isWildcard: boolean;
  isAttribute: boolean;
  isTextNode: boolean;  // true for text() function
}

/**
 * XPath predicate (attribute or position)
 *
 * @internal
 */
export interface XPathPredicate {
  type: 'attribute' | 'position';
  attribute?: string;
  value?: string;
  position?: number;
}

/**
 * XPath compiler with caching
 *
 * @internal
 */
export class XPathCompiler {
  private static cache = new Map<string, CompiledXPath>();
  private static readonly MAX_CACHE_SIZE = 1000;

  static compile(xpath: string): CompiledXPath {
    // Check cache
    const cached = this.cache.get(xpath);
    if (cached) return cached;

    // Validate and compile
    this.validateXPath(xpath);
    const compiled = this.compileInternal(xpath);

    // Cache with size limit
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cache.delete(this.cache.keys().next().value!);
    }
    this.cache.set(xpath, compiled);

    return compiled;
  }

  private static validateXPath(xpath: string): void {
    if (!xpath || xpath.trim().length === 0) {
      throw new Error('XPath cannot be empty');
    }
    if (xpath.length > 1000) {
      throw new Error('XPath too long (max 1000 characters)');
    }
    const trimmed = xpath.trim();
    if (trimmed !== '.' && !trimmed.startsWith('/') && !trimmed.startsWith('./')) {
      throw new Error(`Ambiguous relative XPath is not supported: ${xpath}`);
    }
  }

  private static compileInternal(xpath: string): CompiledXPath {
    const trimmed = xpath.trim();

    // Check for relative path (./ or .)
    const isRelative = trimmed.startsWith('./') || trimmed === '.';
    const isDescendant = !isRelative && trimmed.startsWith('//');
    const isAbsolute = !isRelative && !isDescendant && trimmed.startsWith('/');

    let path = trimmed;
    if (isRelative && trimmed.startsWith('./')) {
      path = path.slice(2); // Remove ./
    } else if (isRelative && trimmed === '.') {
      path = ''; // Current context
    } else if (isDescendant) {
      path = path.slice(2);
    } else if (isAbsolute) {
      path = path.slice(1);
    }

    if (path.includes('//')) {
      throw new Error(
        'Descendant-or-self (//) is supported only at the beginning. ' +
        'Use // only at the beginning of XPath expression, e.g., "//element/path"'
      );
    }

    if (trimmed !== '.' && (!path || path.split('/').some(part => part.length === 0))) {
      throw new Error(`Invalid empty XPath segment: ${xpath}`);
    }

    const segments: XPathSegment[] = [];
    const parts = path ? path.split('/') : [];

    for (let index = 0; index < parts.length; index++) {
      const segment = this.compileSegment(parts[index]!);
      if ((segment.isAttribute || segment.isTextNode) && index !== parts.length - 1) {
        throw new Error(`XPath attributes and text() must be terminal: ${xpath}`);
      }
      segments.push(segment);
    }

    const terminal = segments[segments.length - 1];
    if ((isAbsolute || isDescendant) && segments.length === 1 && (terminal?.isAttribute || terminal?.isTextNode)) {
      throw new Error(`XPath terminal requires an element owner: ${xpath}`);
    }

    return { segments, isAbsolute, isDescendant };
  }

  private static compileSegment(segment: string): XPathSegment {
    // Check if this is an attribute selector (@attribute)
    if (segment.startsWith('@')) {
      const attrName = segment.slice(1);
      assertXmlQName(attrName, 'XPath attribute name');
      return {
        name: attrName,
        predicates: [],
        isWildcard: false,
        isAttribute: true,
        isTextNode: false
      };
    }

    // Check if this is a text() node function
    if (segment === 'text()') {
      return {
        name: 'text()',
        predicates: [],
        isWildcard: false,
        isAttribute: false,
        isTextNode: true
      };
    }

    const predicateMatch = segment.match(/^([^\[\]]+)(?:\[(\d+)\])?$/);
    if (!predicateMatch) {
      throw new Error(`Invalid XPath segment: ${segment}`);
    }

    const name = predicateMatch[1];
    const isWildcard = name === '*';
    if (isWildcard) throw new Error('Wildcard XPath is not supported');
    assertXmlQName(name, 'XPath element name');
    const predicates: XPathPredicate[] = [];

    if (predicateMatch[2]) {
      const position = Number(predicateMatch[2]);
      if (!Number.isSafeInteger(position) || position < 1) {
        throw new Error(`XPath position must be a positive safe integer: ${segment}`);
      }
      predicates.push({ type: 'position', position });
    }

    return { name, predicates, isWildcard, isAttribute: false, isTextNode: false };
  }
}
