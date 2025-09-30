import { StaxXmlParser } from '../StaxXmlParser.js';
import { StaxXmlParserSync } from '../StaxXmlParserSync.js';
import {
  isStartElement,
  isEndElement,
  isCharacters,
  isCdata,
  type AnyXmlEvent,
  type StartElementEvent
} from '../types.js';
import { XPathMatcher } from './XPathEngine.js';
import type { ParseInput } from './XmlSchema.js';
import type { ParseOptions } from './types.js';

/**
 * Internal parse context for tracking state
 *
 * @internal
 */
interface ParseContext {
  matcher?: XPathMatcher;
  currentDepth: number;
  maxDepth: number;
  eventCount: number;
  maxEvents: number;
}

/**
 * Internal parser implementation
 * Handles both sync and async parsing with XPath support
 *
 * @internal
 */
export class XmlParserInternal {
  private options?: ParseOptions;
  private static readonly DEFAULT_MAX_DEPTH = 100;
  private static readonly DEFAULT_MAX_EVENTS = 1000000;

  constructor(options?: ParseOptions) {
    this.options = options;
  }

  /**
   * Parse string value asynchronously
   */
  async parseStringAsync(
    input: ParseInput,
    schemaOptions: { xpath?: string }
  ): Promise<string> {
    const parser = this.createParser(input);
    const xpath = schemaOptions.xpath;

    if (xpath === undefined || xpath === null) {
      // No XPath - just get first text content
      for await (const event of parser) {
        if (isCharacters(event) || isCdata(event)) {
          return this.decodeText(event.value);
        }
      }
      return '';
    }

    // XPath matching
    const matcher = new XPathMatcher(xpath);
    const context = this.createContext(matcher);
    let matchDepth = -1;
    let textBuffer = '';

    for await (const event of parser) {
      this.checkLimits(context);

      if (isStartElement(event)) {
        matcher.onStartElement(event);
        context.currentDepth++;

        if (matchDepth === -1 && matcher.matches(event)) {
          matchDepth = context.currentDepth;
        }
      } else if (isEndElement(event)) {
        if (matchDepth !== -1 && context.currentDepth === matchDepth) {
          matcher.reset();
          return this.decodeText(textBuffer.trim());
        }
        matcher.onEndElement();
        context.currentDepth--;
      } else if ((isCharacters(event) || isCdata(event)) && matchDepth !== -1) {
        textBuffer += event.value;
      }

      context.eventCount++;
    }

    return this.decodeText(textBuffer.trim());
  }

  /**
   * Parse string value synchronously
   */
  parseString(input: string, schemaOptions: { xpath?: string }): string {
    const parser = new StaxXmlParserSync(input, {
      autoDecodeEntities: this.options?.decodeEntities
    });

    const xpath = schemaOptions.xpath;

    if (xpath === undefined || xpath === null) {
      for (const event of parser) {
        if (isCharacters(event) || isCdata(event)) {
          return this.decodeText(event.value);
        }
      }
      return '';
    }

    const matcher = new XPathMatcher(xpath);
    const context = this.createContext(matcher);
    let matchDepth = -1;
    let textBuffer = '';

    for (const event of parser) {
      this.checkLimits(context);

      if (isStartElement(event)) {
        matcher.onStartElement(event);
        context.currentDepth++;

        if (matchDepth === -1 && matcher.matches(event)) {
          matchDepth = context.currentDepth;
        }
      } else if (isEndElement(event)) {
        if (matchDepth !== -1 && context.currentDepth === matchDepth) {
          return this.decodeText(textBuffer.trim());
        }
        matcher.onEndElement();
        context.currentDepth--;
      } else if ((isCharacters(event) || isCdata(event)) && matchDepth !== -1) {
        textBuffer += event.value;
      }

      context.eventCount++;
    }

    return this.decodeText(textBuffer.trim());
  }

  /**
   * Parse object asynchronously
   */
  async parseObjectAsync<T>(
    input: ParseInput,
    shape: Record<string, any>,
    schemaOptions: { xpath?: string }
  ): Promise<T> {
    const result: any = {};

    // Check for array fields that need full document parsing
    for (const [key, schema] of Object.entries(shape)) {
      const typeName = schema?.constructor?.name || '';
      if (typeName === 'XmlArraySchema') {
        // Array schema needs full document parsing
        result[key] = await schema._parseAsync(input, this.options);
      }
    }

    const parser = this.createParser(input);

    // Build matchers for non-array fields
    const fieldMatchers = new Map<string, { schema: any; matcher?: XPathMatcher }>();
    for (const [key, schema] of Object.entries(shape)) {
      const typeName = schema?.constructor?.name || '';
      if (typeName === 'XmlArraySchema') {
        // Skip - already parsed above
        continue;
      }

      const xpath = this.extractXPath(schema);
      fieldMatchers.set(key, {
        schema,
        matcher: xpath ? new XPathMatcher(xpath) : undefined
      });
    }

    const context = this.createContext();
    const matchedFields = new Map<string, { depth: number; buffer: string }>();

    for await (const event of parser) {
      this.checkLimits(context);

      if (isStartElement(event)) {
        context.currentDepth++;

        // Check all field matchers
        for (const [fieldName, { matcher, schema }] of fieldMatchers) {
          if (matcher) {
            matcher.onStartElement(event);
            if (matcher.matches(event) && !matchedFields.has(fieldName)) {
              // Check if this is an attribute selector
              if (matcher.isAttributeSelector()) {
                const attrName = matcher.getAttributeName();
                if (attrName && event.attributes) {
                  const attrValue = event.attributes[attrName];
                  if (attrValue !== undefined) {
                    result[fieldName] = this.parseFieldValue(attrValue, schema);
                  }
                }
              } else {
                matchedFields.set(fieldName, {
                  depth: context.currentDepth,
                  buffer: ''
                });
              }
            }
          }
        }
      } else if (isEndElement(event)) {
        // Check if any matched field is closing
        for (const [fieldName, match] of matchedFields) {
          if (match.depth === context.currentDepth) {
            const { schema } = fieldMatchers.get(fieldName)!;
            result[fieldName] = this.parseFieldValue(match.buffer.trim(), schema);
            matchedFields.delete(fieldName);
          }
        }

        for (const [, { matcher }] of fieldMatchers) {
          matcher?.onEndElement();
        }
        context.currentDepth--;
      } else if (isCharacters(event) || isCdata(event)) {
        // Add to all active matches
        for (const match of matchedFields.values()) {
          match.buffer += event.value;
        }
      }

      context.eventCount++;
    }

    return result as T;
  }

  /**
   * Parse object synchronously
   */
  parseObject<T>(
    input: string,
    shape: Record<string, any>,
    schemaOptions: { xpath?: string }
  ): T {
    const result: any = {};

    // Check for array fields that need full document parsing
    for (const [key, schema] of Object.entries(shape)) {
      const typeName = schema?.constructor?.name || '';
      if (typeName === 'XmlArraySchema') {
        // Array schema needs full document parsing
        result[key] = schema._parse(input, this.options);
      }
    }

    const parser = new StaxXmlParserSync(input, {
      autoDecodeEntities: this.options?.decodeEntities
    });

    const fieldMatchers = new Map<string, { schema: any; matcher?: XPathMatcher }>();

    for (const [key, schema] of Object.entries(shape)) {
      const typeName = schema?.constructor?.name || '';
      if (typeName === 'XmlArraySchema') {
        // Skip - already parsed above
        continue;
      }

      const xpath = this.extractXPath(schema);
      fieldMatchers.set(key, {
        schema,
        matcher: xpath ? new XPathMatcher(xpath) : undefined
      });
    }

    const context = this.createContext();
    const matchedFields = new Map<string, { depth: number; buffer: string }>();

    for (const event of parser) {
      this.checkLimits(context);

      if (isStartElement(event)) {
        context.currentDepth++;

        for (const [fieldName, { matcher, schema }] of fieldMatchers) {
          if (matcher) {
            matcher.onStartElement(event);
            if (matcher.matches(event) && !matchedFields.has(fieldName)) {
              // Check if this is an attribute selector
              if (matcher.isAttributeSelector()) {
                const attrName = matcher.getAttributeName();
                if (attrName && event.attributes) {
                  const attrValue = event.attributes[attrName];
                  if (attrValue !== undefined) {
                    result[fieldName] = this.parseFieldValue(attrValue, schema);
                  }
                }
              } else {
                matchedFields.set(fieldName, {
                  depth: context.currentDepth,
                  buffer: ''
                });
              }
            }
          }
        }
      } else if (isEndElement(event)) {
        for (const [fieldName, match] of matchedFields) {
          if (match.depth === context.currentDepth) {
            const { schema } = fieldMatchers.get(fieldName)!;
            result[fieldName] = this.parseFieldValue(match.buffer.trim(), schema);
            matchedFields.delete(fieldName);
          }
        }

        for (const [, { matcher }] of fieldMatchers) {
          matcher?.onEndElement();
        }
        context.currentDepth--;
      } else if (isCharacters(event) || isCdata(event)) {
        for (const match of matchedFields.values()) {
          match.buffer += event.value;
        }
      }

      context.eventCount++;
    }

    return result as T;
  }

  /**
   * Parse object from current iterator position (sync)
   * Used for recursive parsing without restarting the stream
   */
  parseObjectFromPositionSync<T>(
    iterator: Iterator<AnyXmlEvent>,
    startEvent: StartElementEvent,
    startDepth: number,
    shape: Record<string, any>,
    schemaOptions: { xpath?: string }
  ): T {
    const result: any = {};
    const fieldMatchers = new Map<string, { schema: any; matcher?: XPathMatcher; matched: boolean }>();

    // Initialize matchers for all fields
    for (const [key, schema] of Object.entries(shape)) {
      const xpath = this.extractXPath(schema);
      fieldMatchers.set(key, {
        schema,
        matcher: xpath ? new XPathMatcher(xpath) : undefined,
        matched: false
      });
    }

    const matchedFields = new Map<string, { depth: number; buffer: string }>();
    let currentDepth = startDepth;

    // Process startEvent
    for (const [, { matcher }] of fieldMatchers) {
      matcher?.onStartElement(startEvent);
    }

    let iterResult = iterator.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      if (isStartElement(event)) {
        currentDepth++;

        for (const [fieldName, { matcher }] of fieldMatchers) {
          if (matcher) {
            matcher.onStartElement(event);
            if (matcher.matches(event) && !matchedFields.has(fieldName)) {
              matchedFields.set(fieldName, {
                depth: currentDepth,
                buffer: ''
              });
            }
          }
        }
      } else if (isEndElement(event)) {
        for (const [fieldName, match] of matchedFields) {
          if (match.depth === currentDepth) {
            const { schema } = fieldMatchers.get(fieldName)!;
            result[fieldName] = this.parseFieldValue(match.buffer.trim(), schema);
            matchedFields.delete(fieldName);
          }
        }

        for (const [, { matcher }] of fieldMatchers) {
          matcher?.onEndElement();
        }

        currentDepth--;

        // Exit when we close the start element
        if (currentDepth < startDepth) {
          break;
        }
      } else if (isCharacters(event) || isCdata(event)) {
        for (const match of matchedFields.values()) {
          match.buffer += event.value;
        }
      }

      if (currentDepth >= startDepth) {
        iterResult = iterator.next();
      }
    }

    return result as T;
  }

  /**
   * Parse object from current iterator position (async)
   */
  async parseObjectFromPosition<T>(
    iterator: AsyncIterator<AnyXmlEvent>,
    startEvent: StartElementEvent,
    startDepth: number,
    shape: Record<string, any>,
    schemaOptions: { xpath?: string }
  ): Promise<T> {
    const result: any = {};
    const fieldMatchers = new Map<string, { schema: any; matcher?: XPathMatcher }>();

    for (const [key, schema] of Object.entries(shape)) {
      const xpath = this.extractXPath(schema);
      fieldMatchers.set(key, {
        schema,
        matcher: xpath ? new XPathMatcher(xpath) : undefined
      });
    }

    const matchedFields = new Map<string, { depth: number; buffer: string }>();
    let currentDepth = startDepth;

    // Process startEvent
    for (const [, { matcher }] of fieldMatchers) {
      matcher?.onStartElement(startEvent);
    }

    let iterResult = await iterator.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      if (isStartElement(event)) {
        currentDepth++;

        for (const [fieldName, { matcher }] of fieldMatchers) {
          if (matcher) {
            matcher.onStartElement(event);
            if (matcher.matches(event) && !matchedFields.has(fieldName)) {
              matchedFields.set(fieldName, {
                depth: currentDepth,
                buffer: ''
              });
            }
          }
        }
      } else if (isEndElement(event)) {
        for (const [fieldName, match] of matchedFields) {
          if (match.depth === currentDepth) {
            const { schema } = fieldMatchers.get(fieldName)!;
            result[fieldName] = this.parseFieldValue(match.buffer.trim(), schema);
            matchedFields.delete(fieldName);
          }
        }

        for (const [, { matcher }] of fieldMatchers) {
          matcher?.onEndElement();
        }

        currentDepth--;

        if (currentDepth < startDepth) {
          break;
        }
      } else if (isCharacters(event) || isCdata(event)) {
        for (const match of matchedFields.values()) {
          match.buffer += event.value;
        }
      }

      if (currentDepth >= startDepth) {
        iterResult = await iterator.next();
      }
    }

    return result as T;
  }

  /**
   * Parse array asynchronously
   */
  async parseArrayAsync<T>(
    input: ParseInput,
    elementSchema: any,
    xpath?: string
  ): Promise<T[]> {
    if (!xpath) {
      throw new Error('Array schema requires xpath');
    }

    const parser = this.createParser(input);
    const matcher = new XPathMatcher(xpath);
    const context = this.createContext(matcher);
    const results: T[] = [];
    const needsRecursive = this.isComplexSchema(elementSchema);

    for await (const event of parser) {
      this.checkLimits(context);

      if (isStartElement(event)) {
        context.currentDepth++;
        matcher.onStartElement(event);

        if (matcher.matches(event)) {
          // Found matching element - process it now
          if (needsRecursive && elementSchema._parseFromPosition) {
            // Use recursive position-based parsing
            const value = await elementSchema._parseFromPosition(
              parser,
              event,
              context.currentDepth,
              this.options
            );
            results.push(value);
            // _parseFromPosition consumed up to and including the closing tag
            context.currentDepth--;
          } else {
            // Simple schema - collect text only
            const textBuffer = await this.collectTextUntilClose(
              parser,
              context.currentDepth
            );
            const value = this.parseFieldValue(textBuffer.trim(), elementSchema);
            results.push(value);
            // collectTextUntilClose consumed up to the closing tag
            context.currentDepth--;
          }
        }
      } else if (isEndElement(event)) {
        context.currentDepth--;
        matcher.onEndElement();
      }

      context.eventCount++;
    }

    return results;
  }

  /**
   * Collect text content until the closing tag at the given depth
   */
  private async collectTextUntilClose(
    parser: AsyncIterator<AnyXmlEvent>,
    startDepth: number
  ): Promise<string> {
    let currentDepth = startDepth;
    let buffer = '';
    let iterResult = await parser.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      if (isStartElement(event)) {
        currentDepth++;
      } else if (isEndElement(event)) {
        currentDepth--;
        if (currentDepth < startDepth) {
          break;
        }
      } else if ((isCharacters(event) || isCdata(event)) && currentDepth === startDepth) {
        buffer += event.value;
      }

      if (currentDepth >= startDepth) {
        iterResult = await parser.next();
      }
    }

    return buffer;
  }

  /**
   * Parse array synchronously
   */
  parseArray<T>(input: string, elementSchema: any, xpath?: string): T[] {
    if (!xpath) {
      throw new Error('Array schema requires xpath');
    }

    const parser = new StaxXmlParserSync(input, {
      autoDecodeEntities: this.options?.decodeEntities
    });

    const matcher = new XPathMatcher(xpath);
    const context = this.createContext(matcher);
    const results: T[] = [];
    const needsRecursive = this.isComplexSchema(elementSchema);

    for (const event of parser) {
      this.checkLimits(context);

      if (isStartElement(event)) {
        context.currentDepth++;
        matcher.onStartElement(event);

        if (matcher.matches(event)) {
          // Found matching element - process it now
          if (needsRecursive && elementSchema._parseFromPosition) {
            // Use recursive position-based parsing
            // Pass the iterator at current position, after the START_ELEMENT
            const value = elementSchema._parseFromPosition(
              parser,
              event,
              context.currentDepth,
              this.options
            );
            results.push(value);
            // _parseFromPosition consumed up to and including the closing tag
            context.currentDepth--;
          } else {
            // Simple schema - collect text only
            const textBuffer = this.collectTextUntilCloseSync(
              parser,
              context.currentDepth
            );
            const value = this.parseFieldValue(textBuffer.trim(), elementSchema);
            results.push(value);
            // collectTextUntilCloseSync consumed up to the closing tag
            context.currentDepth--;
          }
        }
      } else if (isEndElement(event)) {
        context.currentDepth--;
        matcher.onEndElement();
      }

      context.eventCount++;
    }

    return results;
  }

  /**
   * Collect text content until the closing tag at the given depth (sync)
   */
  private collectTextUntilCloseSync(
    parser: Iterator<AnyXmlEvent>,
    startDepth: number
  ): string {
    let currentDepth = startDepth;
    let buffer = '';
    let iterResult = parser.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      if (isStartElement(event)) {
        currentDepth++;
      } else if (isEndElement(event)) {
        currentDepth--;
        if (currentDepth < startDepth) {
          break;
        }
      } else if ((isCharacters(event) || isCdata(event)) && currentDepth === startDepth) {
        buffer += event.value;
      }

      if (currentDepth >= startDepth) {
        iterResult = parser.next();
      }
    }

    return buffer;
  }

  // Helper methods

  private createParser(input: ParseInput): StaxXmlParser | AsyncIterator<AnyXmlEvent> {
    if (typeof input === 'string') {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(input));
          controller.close();
        }
      });
      return new StaxXmlParser(stream, {
        autoDecodeEntities: this.options?.decodeEntities
      });
    }
    if (input instanceof ReadableStream) {
      return new StaxXmlParser(input, {
        autoDecodeEntities: this.options?.decodeEntities
      });
    }
    return input as AsyncIterator<AnyXmlEvent>;
  }

  private createContext(matcher?: XPathMatcher): ParseContext {
    return {
      matcher,
      currentDepth: 0,
      maxDepth: this.options?.maxDepth ?? XmlParserInternal.DEFAULT_MAX_DEPTH,
      eventCount: 0,
      maxEvents: this.options?.maxEvents ?? XmlParserInternal.DEFAULT_MAX_EVENTS
    };
  }

  private checkLimits(context: ParseContext): void {
    if (context.currentDepth > context.maxDepth) {
      throw new Error(`XML depth limit exceeded: ${context.maxDepth}`);
    }
    if (context.eventCount > context.maxEvents) {
      throw new Error(`XML event limit exceeded: ${context.maxEvents}`);
    }
  }

  private extractXPath(schema: any): string | undefined {
    if (schema && typeof schema === 'object' && 'options' in schema) {
      return schema.options?.xpath;
    }
    return undefined;
  }

  private parseFieldValue(text: string, schema: any): any {
    // For simple schemas with _parseText, use it directly
    if (schema?._parseText) {
      return schema._parseText(text);
    }

    // Default: return text as-is
    return text;
  }

  private isComplexSchema(schema: any): boolean {
    const typeName = schema?.constructor?.name || '';
    return typeName.includes('Transform') ||
           typeName.includes('Optional') ||
           typeName.includes('Array') ||
           typeName.includes('Object');
  }

  private decodeText(text: string): string {
    if (this.options?.trimText) {
      return text.trim();
    }
    return text;
  }
}