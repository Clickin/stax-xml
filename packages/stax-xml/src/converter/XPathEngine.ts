import type { StartElementEvent } from '../types.js';

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
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
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
        isAttribute: true
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

    return { name, predicates, isWildcard, isAttribute: false };
  }

  static clearCache(): void {
    this.cache.clear();
  }
}

/**
 * XPath matcher using streaming evaluation
 *
 * @internal
 */
export class XPathMatcher {
  private currentPath: string[] = [];
  private positionStack: number[] = [];
  private compiled: CompiledXPath;
  private elementStack: StartElementEvent[] = [];
  private contextDepth?: number; // Depth for relative path context

  constructor(xpath: string, contextDepth?: number) {
    this.compiled = XPathCompiler.compile(xpath);
    this.contextDepth = contextDepth;
  }

  onStartElement(event: StartElementEvent): void {
    this.currentPath.push(event.name);
    this.elementStack.push(event);

    // Track position for positional predicates
    const depth = this.currentPath.length;
    if (this.positionStack.length < depth) {
      this.positionStack.push(1);
    } else {
      this.positionStack[depth - 1]++;
    }
  }

  onEndElement(): void {
    const depth = this.currentPath.length;
    this.currentPath.pop();
    this.elementStack.pop();

    // Reset position counter when going up
    if (this.positionStack.length > depth) {
      this.positionStack.pop();
    }
  }

  matches(event: StartElementEvent): boolean {
    const { segments, isAbsolute, isDescendant } = this.compiled;

    // If last segment is attribute, match the element before it
    const effectiveSegments = this.isAttributeSelector()
      ? segments.slice(0, -1)
      : segments;

    // Special case: XPath '.' (current context) - should match the context element
    // This happens when segments is empty and it's a relative path
    if (effectiveSegments.length === 0) {
      // For '.' or './@attr', match if we have a context (relative path)
      return !isAbsolute && !isDescendant;
    }

    if (isDescendant) {
      return this.matchesDescendant(event, effectiveSegments);
    } else if (isAbsolute) {
      return this.matchesAbsolute(event, effectiveSegments);
    } else {
      return this.matchesRelative(event, effectiveSegments);
    }
  }

  /**
   * Check if XPath selects an attribute
   */
  isAttributeSelector(): boolean {
    const { segments } = this.compiled;
    return segments.length > 0 && segments[segments.length - 1].isAttribute;
  }

  /**
   * Get attribute name if this is an attribute selector
   */
  getAttributeName(): string | undefined {
    const { segments } = this.compiled;
    if (this.isAttributeSelector()) {
      return segments[segments.length - 1].name;
    }
    return undefined;
  }

  private matchesDescendant(event: StartElementEvent, segments: XPathSegment[]): boolean {
    if (segments.length === 0) return false;

    // For //element, match if any ancestor path matches
    const currentDepth = this.currentPath.length;

    for (let startDepth = 0; startDepth < currentDepth; startDepth++) {
      if (this.matchesFromDepth(event, segments, startDepth)) {
        return true;
      }
    }
    return false;
  }

  private matchesAbsolute(event: StartElementEvent, segments: XPathSegment[]): boolean {
    // Must match from root
    return this.matchesFromDepth(event, segments, 0);
  }

  private matchesRelative(event: StartElementEvent, segments: XPathSegment[]): boolean {
    // Match from context depth if specified, otherwise from any depth
    const currentDepth = this.currentPath.length;

    if (this.contextDepth !== undefined) {
      // Relative path with context: match only from context depth
      return this.matchesFromDepth(event, segments, this.contextDepth);
    }

    // No context: match from any depth (legacy behavior)
    for (let startDepth = 0; startDepth < currentDepth; startDepth++) {
      if (this.matchesFromDepth(event, segments, startDepth)) {
        return true;
      }
    }
    return false;
  }

  private matchesFromDepth(
    event: StartElementEvent,
    segments: XPathSegment[],
    startDepth: number
  ): boolean {
    const pathLength = this.currentPath.length - startDepth;
    if (pathLength !== segments.length) return false;

    // Match each segment
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const pathElement = this.currentPath[startDepth + i];

      // Check name match
      if (!segment.isWildcard && segment.name !== pathElement) {
        return false;
      }

      // Check predicates for this segment using the corresponding element from the stack
      for (const predicate of segment.predicates) {
        const elementIndex = startDepth + i;
        const elementForPredicate = this.elementStack[elementIndex] || event;
        if (!this.matchesPredicate(predicate, elementForPredicate, elementIndex)) {
          return false;
        }
      }
    }

    return true;
  }

  private matchesPredicate(
    predicate: XPathPredicate,
    event: StartElementEvent,
    depth: number
  ): boolean {
    if (predicate.type === 'attribute') {
      const attrValue = event.attributes[predicate.attribute!];
      return attrValue === predicate.value;
    } else if (predicate.type === 'position') {
      const position = this.positionStack[depth] || 1;

      // Handle special position values
      if (predicate.position === -1) {
        // For "last()", we cannot determine this in a streaming parser easily
        // For now, defer to a more complex implementation or return false
        // TODO: Implement proper last() support with lookahead or post-processing
        return false;
      }

      return position === predicate.position;
    }
    return false;
  }

  reset(): void {
    this.currentPath = [];
    this.positionStack = [];
    this.elementStack = [];
  }
}