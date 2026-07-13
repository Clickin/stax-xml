/**
 * Compiled XPath expression for efficient evaluation
 * Supports: /path/to/element, //element, /path[@attr='value']
 * Does NOT support: complex predicates, functions, axes
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
    if (!xpath || xpath.length === 0) {
      throw new Error('XPath cannot be empty');
    }
    if (xpath.length > 1000) {
      throw new Error('XPath too long (max 1000 characters)');
    }
    // Prevent injection patterns
    if (/[;<>{}\\]/.test(xpath)) {
      throw new Error('Invalid characters in XPath');
    }
  }

  private static compileInternal(xpath: string): CompiledXPath {
    const trimmed = xpath.trim();

    // Check for relative path (./ or .)
    const isRelative = trimmed.startsWith('./') || trimmed === '.';
    const isAbsolute = !isRelative && trimmed.startsWith('/');
    const isDescendant = !isRelative && trimmed.startsWith('//');

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

    // Check for nested descendant-or-self (//) in the remaining path
    // After removing the leading //, check if there's another //
    if (isDescendant && path.includes('//')) {
      throw new Error(
        'Nested descendant-or-self (//) is not supported. ' +
        'Use // only at the beginning of XPath expression, e.g., "//element/path"'
      );
    }

    const segments: XPathSegment[] = [];
    const parts = path.split('/').filter(p => p.length > 0);

    for (const part of parts) {
      segments.push(this.compileSegment(part));
    }

    return { segments, isAbsolute, isDescendant };
  }

  private static compileSegment(segment: string): XPathSegment {
    // Check if this is an attribute selector (@attribute)
    if (segment.startsWith('@')) {
      const attrName = segment.slice(1).trim();
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

    const predicateMatch = segment.match(/^([^[]+)(\[.+\])?$/);
    if (!predicateMatch) {
      throw new Error(`Invalid XPath segment: ${segment}`);
    }

    const name = predicateMatch[1].trim();
    const isWildcard = name === '*';
    const predicates: XPathPredicate[] = [];

    if (predicateMatch[2]) {
      const predicateStr = predicateMatch[2];

      // Support both single and double quotes for attribute predicates
      const attrMatchSingle = predicateStr.match(/\[@([^=]+)='([^']+)'\]/);
      const attrMatchDouble = predicateStr.match(/\[@([^=]+)="([^"]+)"\]/);
      const posMatch = predicateStr.match(/\[(\d+)\]/);

      // Position functions
      const lastMatch = predicateStr.match(/\[last\(\)\]/);
      const firstMatch = predicateStr.match(/\[first\(\)\]/);
      const positionMatch = predicateStr.match(/\[position\(\)\s*=\s*(\d+)\]/);

      if (attrMatchSingle) {
        predicates.push({
          type: 'attribute',
          attribute: attrMatchSingle[1].trim(),
          value: attrMatchSingle[2]
        });
      } else if (attrMatchDouble) {
        predicates.push({
          type: 'attribute',
          attribute: attrMatchDouble[1].trim(),
          value: attrMatchDouble[2]
        });
      } else if (posMatch) {
        predicates.push({
          type: 'position',
          position: parseInt(posMatch[1], 10)
        });
      } else if (lastMatch) {
        predicates.push({
          type: 'position',
          position: -1 // Special value for "last"
        });
      } else if (firstMatch) {
        predicates.push({
          type: 'position',
          position: 1
        });
      } else if (positionMatch) {
        predicates.push({
          type: 'position',
          position: parseInt(positionMatch[1], 10)
        });
      } else {
        throw new Error(`Unsupported predicate: ${predicateStr}`);
      }
    }

    return { name, predicates, isWildcard, isAttribute: false, isTextNode: false };
  }
}
