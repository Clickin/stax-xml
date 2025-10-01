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
  private static readonly DEFAULT_MAX_DEPTH = 1000;
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
      if (this.needsFullDocumentParsing(schema)) {
        // Array schema (or wrapped array) needs full document parsing
        result[key] = await schema._parseAsync(input, this.options);
      }
    }

    const parser = this.createParser(input);

    // Build matchers for non-array fields
    const fieldMatchers = new Map<string, { schema: any; matcher?: XPathMatcher }>();
    for (const [key, schema] of Object.entries(shape)) {
      if (this.needsFullDocumentParsing(schema)) {
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
      if (this.needsFullDocumentParsing(schema)) {
        // Array schema (or wrapped array) needs full document parsing
        result[key] = schema._parse(input, this.options);
      }
    }

    const parser = new StaxXmlParserSync(input, {
      autoDecodeEntities: this.options?.decodeEntities
    });

    const fieldMatchers = new Map<string, { schema: any; matcher?: XPathMatcher }>();

    for (const [key, schema] of Object.entries(shape)) {
      if (this.needsFullDocumentParsing(schema)) {
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
    const fieldMatchers = new Map<string, { schema: any; matcher?: XPathMatcher; matched: boolean; isArray: boolean }>();

    // Initialize matchers for all fields
    for (const [key, schema] of Object.entries(shape)) {
      const xpath = this.extractXPath(schema);
      const typeName = schema?.constructor?.name || '';
      const isArrayField = typeName === 'XmlArraySchema' ||
                          (typeName === 'XmlTransformSchema' && schema.schema?.constructor?.name === 'XmlArraySchema') ||
                          (typeName === 'XmlOptionalSchema' && schema.schema?.constructor?.name === 'XmlArraySchema');

      fieldMatchers.set(key, {
        schema,
        matcher: xpath ? new XPathMatcher(xpath) : undefined,
        matched: false,
        isArray: isArrayField
      });
    }

    const matchedFields = new Map<string, { depth: number; buffer: string }>();
    let currentDepth = startDepth;

    // Collect XML content for array fields that need it
    let xmlBuffer = '';
    let bufferStartDepth = -1;
    const arrayFieldsToProcess: Array<{ key: string; schema: any }> = [];

    // Identify array fields
    for (const [key, { schema, isArray }] of fieldMatchers) {
      if (isArray) {
        arrayFieldsToProcess.push({ key, schema });
      }
    }

    // If we have array fields, we need to buffer the XML content
    const needsBuffering = arrayFieldsToProcess.length > 0;
    if (needsBuffering) {
      // Reconstruct opening tag
      xmlBuffer = '<' + startEvent.name;
      if (startEvent.attributes) {
        for (const [attrName, attrValue] of Object.entries(startEvent.attributes)) {
          xmlBuffer += ` ${attrName}="${attrValue}"`;
        }
      }
      xmlBuffer += '>';
      bufferStartDepth = startDepth;
    }

    // Process startEvent - check for attribute matches on the start element itself
    for (const [fieldName, { matcher, schema, isArray }] of fieldMatchers) {
      if (matcher) {
        const xpath = this.extractXPath(schema);
        matcher.onStartElement(startEvent);

        // Special handling for relative attribute selectors (like "./@id")
        // These should extract from the current element (startEvent) directly
        if (matcher.isAttributeSelector() && xpath && xpath.startsWith('./@')) {
          const attrName = matcher.getAttributeName();
          if (attrName && startEvent.attributes) {
            const attrValue = startEvent.attributes[attrName];
            if (attrValue !== undefined) {
              result[fieldName] = this.parseFieldValue(attrValue, schema);
            }
          }
        }
      }
    }

    let iterResult = iterator.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      // Buffer XML for array field parsing
      if (needsBuffering && bufferStartDepth !== -1) {
        if (isStartElement(event)) {
          xmlBuffer += '<' + event.name;
          if (event.attributes) {
            for (const [attrName, attrValue] of Object.entries(event.attributes)) {
              xmlBuffer += ` ${attrName}="${this.escapeXml(attrValue)}"`;
            }
          }
          xmlBuffer += '>';
        } else if (isEndElement(event)) {
          xmlBuffer += '</' + event.name + '>';
        } else if (isCharacters(event)) {
          xmlBuffer += this.escapeXml(event.value);
        } else if (isCdata(event)) {
          xmlBuffer += '<![CDATA[' + event.value + ']]>';
        }
      }

      if (isStartElement(event)) {
        currentDepth++;

        for (const [fieldName, { matcher, schema, isArray }] of fieldMatchers) {
          if (isArray) {
            // Skip array fields - will process after collecting XML
            continue;
          }

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
                  depth: currentDepth,
                  buffer: ''
                });
              }
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

    // Process array fields using buffered XML
    if (needsBuffering && bufferStartDepth !== -1) {
      for (const { key, schema } of arrayFieldsToProcess) {
        try {
          result[key] = schema._parse(xmlBuffer, this.options);
        } catch (e) {
          // If parsing fails, leave field as undefined
          result[key] = undefined;
        }
      }
    }

    return result as T;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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
    const fieldMatchers = new Map<string, { schema: any; matcher?: XPathMatcher; isArray: boolean }>();

    // Initialize matchers for all fields
    for (const [key, schema] of Object.entries(shape)) {
      const xpath = this.extractXPath(schema);
      const typeName = schema?.constructor?.name || '';
      const isArrayField = typeName === 'XmlArraySchema' ||
                          (typeName === 'XmlTransformSchema' && schema.schema?.constructor?.name === 'XmlArraySchema') ||
                          (typeName === 'XmlOptionalSchema' && schema.schema?.constructor?.name === 'XmlArraySchema');

      fieldMatchers.set(key, {
        schema,
        matcher: xpath ? new XPathMatcher(xpath) : undefined,
        isArray: isArrayField
      });
    }

    const matchedFields = new Map<string, { depth: number; buffer: string }>();
    let currentDepth = startDepth;

    // Collect XML content for array fields that need it
    let xmlBuffer = '';
    let bufferStartDepth = -1;
    const arrayFieldsToProcess: Array<{ key: string; schema: any }> = [];

    // Identify array fields
    for (const [key, { schema, isArray }] of fieldMatchers) {
      if (isArray) {
        arrayFieldsToProcess.push({ key, schema });
      }
    }

    // If we have array fields, we need to buffer the XML content
    const needsBuffering = arrayFieldsToProcess.length > 0;
    if (needsBuffering) {
      // Reconstruct opening tag
      xmlBuffer = '<' + startEvent.name;
      if (startEvent.attributes) {
        for (const [attrName, attrValue] of Object.entries(startEvent.attributes)) {
          xmlBuffer += ` ${attrName}="${attrValue}"`;
        }
      }
      xmlBuffer += '>';
      bufferStartDepth = startDepth;
    }

    // Process startEvent - check for attribute matches on the start element itself
    for (const [fieldName, { matcher, schema, isArray }] of fieldMatchers) {
      if (matcher) {
        const xpath = this.extractXPath(schema);
        matcher.onStartElement(startEvent);

        // Special handling for relative attribute selectors (like "./@id")
        // These should extract from the current element (startEvent) directly
        if (matcher.isAttributeSelector() && xpath && xpath.startsWith('./@')) {
          const attrName = matcher.getAttributeName();
          if (attrName && startEvent.attributes) {
            const attrValue = startEvent.attributes[attrName];
            if (attrValue !== undefined) {
              result[fieldName] = this.parseFieldValue(attrValue, schema);
            }
          }
        }
      }
    }

    let iterResult = await iterator.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      // Buffer XML for array field parsing
      if (needsBuffering && bufferStartDepth !== -1) {
        if (isStartElement(event)) {
          xmlBuffer += '<' + event.name;
          if (event.attributes) {
            for (const [attrName, attrValue] of Object.entries(event.attributes)) {
              xmlBuffer += ` ${attrName}="${this.escapeXml(attrValue)}"`;
            }
          }
          xmlBuffer += '>';
        } else if (isEndElement(event)) {
          xmlBuffer += '</' + event.name + '>';
        } else if (isCharacters(event)) {
          xmlBuffer += this.escapeXml(event.value);
        } else if (isCdata(event)) {
          xmlBuffer += '<![CDATA[' + event.value + ']]>';
        }
      }

      if (isStartElement(event)) {
        currentDepth++;

        for (const [fieldName, { matcher, schema, isArray }] of fieldMatchers) {
          if (isArray) {
            // Skip array fields - will process after collecting XML
            continue;
          }

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
                  depth: currentDepth,
                  buffer: ''
                });
              }
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

    // Process array fields using buffered XML
    if (needsBuffering && bufferStartDepth !== -1) {
      for (const { key, schema } of arrayFieldsToProcess) {
        try {
          result[key] = await schema._parseAsync(xmlBuffer, this.options);
        } catch (e) {
          // If parsing fails, leave field as undefined
          result[key] = undefined;
        }
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

          // Check if the element schema has an attribute selector
          const elementXPath = this.extractXPath(elementSchema);
          const elementMatcher = elementXPath ? new XPathMatcher(elementXPath) : null;

          if (elementMatcher && elementMatcher.isAttributeSelector()) {
            const attrName = elementMatcher.getAttributeName();
            if (attrName && event.attributes) {
              const attrValue = event.attributes[attrName];
              if (attrValue !== undefined) {
                const value = this.parseFieldValue(attrValue, elementSchema);
                results.push(value);
              }
            }
          } else if (needsRecursive && elementSchema._parseFromPosition) {
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
          } else if (elementXPath) {
            // Element has XPath - use object parsing logic for relative path resolution
            elementMatcher!.onStartElement(event);
            const value = await this.extractValueWithElementMatcherAsync(
              parser,
              event,
              context.currentDepth,
              elementMatcher!,
              elementSchema
            );
            results.push(value);
            // extractValueWithElementMatcherAsync handles depth management
            context.currentDepth--;
          } else {
            // Simple schema without XPath - collect text only
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
   * Parse array from current iterator position (sync)
   * Used for nested array parsing within a specific element scope
   */
  parseArrayFromPositionSync<T>(
    iterator: Iterator<AnyXmlEvent>,
    startEvent: StartElementEvent,
    startDepth: number,
    elementSchema: any,
    xpath?: string
  ): T[] {
    if (!xpath) {
      throw new Error('Array schema requires xpath');
    }

    const matcher = new XPathMatcher(xpath);
    const results: T[] = [];
    const needsRecursive = this.isComplexSchema(elementSchema);
    let currentDepth = startDepth;

    // Process the start event for the parent element
    matcher.onStartElement(startEvent);

    let iterResult = iterator.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      if (isStartElement(event)) {
        currentDepth++;
        matcher.onStartElement(event);

        if (matcher.matches(event)) {
          // Found matching element
          const elementXPath = this.extractXPath(elementSchema);
          const elementMatcher = elementXPath ? new XPathMatcher(elementXPath) : null;

          if (elementMatcher && elementMatcher.isAttributeSelector()) {
            const attrName = elementMatcher.getAttributeName();
            if (attrName && event.attributes) {
              const attrValue = event.attributes[attrName];
              if (attrValue !== undefined) {
                const value = this.parseFieldValue(attrValue, elementSchema);
                results.push(value);
              }
            }
          } else if (needsRecursive && elementSchema._parseFromPosition) {
            // Use recursive position-based parsing
            const value = elementSchema._parseFromPosition(
              iterator,
              event,
              currentDepth,
              this.options
            );
            results.push(value);
            // _parseFromPosition consumed up to and including the closing tag
          } else if (elementXPath) {
            // Element has XPath - use matching logic
            elementMatcher!.onStartElement(event);
            const value = this.extractValueWithElementMatcher(
              iterator,
              event,
              currentDepth,
              elementMatcher!,
              elementSchema
            );
            results.push(value);
            matcher.onEndElement();
            currentDepth--;
          } else {
            // Simple schema - collect text
            const textBuffer = this.collectTextUntilCloseSync(
              iterator,
              currentDepth
            );
            const value = this.parseFieldValue(textBuffer.trim(), elementSchema);
            results.push(value);
            matcher.onEndElement();
            currentDepth--;
          }
        }
      } else if (isEndElement(event)) {
        currentDepth--;
        matcher.onEndElement();

        // Exit when we close the parent element
        if (currentDepth < startDepth) {
          break;
        }
      }

      if (currentDepth >= startDepth) {
        iterResult = iterator.next();
      }
    }

    return results;
  }

  /**
   * Parse array from current iterator position (async)
   * Used for nested array parsing within a specific element scope
   */
  async parseArrayFromPosition<T>(
    iterator: AsyncIterator<AnyXmlEvent>,
    startEvent: StartElementEvent,
    startDepth: number,
    elementSchema: any,
    xpath?: string
  ): Promise<T[]> {
    if (!xpath) {
      throw new Error('Array schema requires xpath');
    }

    const matcher = new XPathMatcher(xpath);
    const results: T[] = [];
    const needsRecursive = this.isComplexSchema(elementSchema);
    let currentDepth = startDepth;

    // Process the start event for the parent element
    matcher.onStartElement(startEvent);

    let iterResult = await iterator.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      if (isStartElement(event)) {
        currentDepth++;
        matcher.onStartElement(event);

        if (matcher.matches(event)) {
          // Found matching element
          const elementXPath = this.extractXPath(elementSchema);
          const elementMatcher = elementXPath ? new XPathMatcher(elementXPath) : null;

          if (elementMatcher && elementMatcher.isAttributeSelector()) {
            const attrName = elementMatcher.getAttributeName();
            if (attrName && event.attributes) {
              const attrValue = event.attributes[attrName];
              if (attrValue !== undefined) {
                const value = this.parseFieldValue(attrValue, elementSchema);
                results.push(value);
              }
            }
          } else if (needsRecursive && elementSchema._parseFromPosition) {
            // Use recursive position-based parsing
            const value = await elementSchema._parseFromPosition(
              iterator,
              event,
              currentDepth,
              this.options
            );
            results.push(value);
            // _parseFromPosition consumed up to and including the closing tag
          } else if (elementXPath) {
            // Element has XPath - use matching logic
            elementMatcher!.onStartElement(event);
            const value = await this.extractValueWithElementMatcherAsync(
              iterator,
              event,
              currentDepth,
              elementMatcher!,
              elementSchema
            );
            results.push(value);
            matcher.onEndElement();
            currentDepth--;
          } else {
            // Simple schema - collect text
            const textBuffer = await this.collectTextUntilClose(
              iterator,
              currentDepth
            );
            const value = this.parseFieldValue(textBuffer.trim(), elementSchema);
            results.push(value);
            matcher.onEndElement();
            currentDepth--;
          }
        }
      } else if (isEndElement(event)) {
        currentDepth--;
        matcher.onEndElement();

        // Exit when we close the parent element
        if (currentDepth < startDepth) {
          break;
        }
      }

      if (currentDepth >= startDepth) {
        iterResult = await iterator.next();
      }
    }

    return results;
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

          // Check if the element schema has an attribute selector
          const elementXPath = this.extractXPath(elementSchema);
          const elementMatcher = elementXPath ? new XPathMatcher(elementXPath) : null;

          if (elementMatcher && elementMatcher.isAttributeSelector()) {
            const attrName = elementMatcher.getAttributeName();
            if (attrName && event.attributes) {
              const attrValue = event.attributes[attrName];
              if (attrValue !== undefined) {
                const value = this.parseFieldValue(attrValue, elementSchema);
                results.push(value);
              }
            }
          } else if (needsRecursive && elementSchema._parseFromPosition) {
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
            // Don't manually decrement - the END_ELEMENT will be processed by the main loop
          } else if (elementXPath) {
            // Element has XPath - use object parsing logic for relative path resolution
            elementMatcher!.onStartElement(event);
            const value = this.extractValueWithElementMatcher(
              parser,
              event,
              context.currentDepth,
              elementMatcher!,
              elementSchema
            );
            results.push(value);
            // extractValueWithElementMatcher handles depth management
            matcher.onEndElement();
            context.currentDepth--;
          } else {
            // Simple schema without XPath - collect text only
            const textBuffer = this.collectTextUntilCloseSync(
              parser,
              context.currentDepth
            );
            const value = this.parseFieldValue(textBuffer.trim(), elementSchema);
            results.push(value);
            // collectTextUntilCloseSync consumed up to and including the closing tag
            // We need to manually call onEndElement since the main loop won't see it
            matcher.onEndElement();
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

  private createParser(input: ParseInput): AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent> {
    if (typeof input === 'string') {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(input));
          controller.close();
        }
      });
      return new StaxXmlParser(stream, {
        autoDecodeEntities: this.options?.decodeEntities
      }) as AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent>;
    }
    if (input instanceof ReadableStream) {
      return new StaxXmlParser(input, {
        autoDecodeEntities: this.options?.decodeEntities
      }) as AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent>;
    }
    return input as AsyncIterable<AnyXmlEvent> & AsyncIterator<AnyXmlEvent>;
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
    // Only XmlObjectSchema needs recursive position-based parsing
    // Arrays, Transforms, and Optionals can be handled differently
    return typeName === 'XmlObjectSchema';
  }

  private needsFullDocumentParsing(schema: any): boolean {
    const typeName = schema?.constructor?.name || '';

    // Direct array schema
    if (typeName === 'XmlArraySchema') {
      // Check if it uses relative XPath (starts with ./)
      const xpath = this.extractArrayXPath(schema);
      if (xpath && xpath.startsWith('./')) {
        // Relative XPath - should be parsed within current context, not full document
        return false;
      }
      return true; // Absolute XPath - needs full document parsing
    }

    // Transform schema wrapping an array
    if (typeName === 'XmlTransformSchema' && schema.schema) {
      return this.needsFullDocumentParsing(schema.schema);
    }

    // Optional schema wrapping an array
    if (typeName === 'XmlOptionalSchema' && schema.schema) {
      return this.needsFullDocumentParsing(schema.schema);
    }

    return false;
  }

  private extractArrayXPath(schema: any): string | undefined {
    // For XmlArraySchema, xpath is a private field but can be accessed via options or directly
    if (schema && typeof schema === 'object' && 'xpath' in schema) {
      return schema.xpath;
    }
    return undefined;
  }

  private decodeText(text: string): string {
    if (this.options?.trimText) {
      return text.trim();
    }
    return text;
  }

  /**
   * Extract value using XPath matching within a single element scope (sync)
   */
  private extractValueWithElementMatcher(
    parser: Iterator<AnyXmlEvent>,
    startEvent: StartElementEvent,
    startDepth: number,
    elementMatcher: XPathMatcher,
    elementSchema: any
  ): any {
    let currentDepth = startDepth;
    let textBuffer = '';
    let matchedDepth = -1;
    let iterResult = parser.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      if (isStartElement(event)) {
        currentDepth++;
        elementMatcher.onStartElement(event);

        if (elementMatcher.matches(event) && matchedDepth === -1) {
          matchedDepth = currentDepth;
          textBuffer = ''; // Reset buffer for this match
        }
      } else if (isEndElement(event)) {
        if (matchedDepth !== -1 && currentDepth === matchedDepth) {
          // We're closing the matched element - return the collected text
          const value = this.parseFieldValue(textBuffer.trim(), elementSchema);
          return value;
        }
        elementMatcher.onEndElement();
        currentDepth--;

        if (currentDepth < startDepth) {
          break;
        }
      } else if ((isCharacters(event) || isCdata(event)) && matchedDepth !== -1 && currentDepth === matchedDepth) {
        textBuffer += event.value;
      }

      if (currentDepth >= startDepth) {
        iterResult = parser.next();
      }
    }

    // If we didn't find a match, try to extract using parseFieldValue with empty text
    return this.parseFieldValue('', elementSchema);
  }

  /**
   * Extract value using XPath matching within a single element scope (async)
   */
  private async extractValueWithElementMatcherAsync(
    parser: AsyncIterator<AnyXmlEvent>,
    startEvent: StartElementEvent,
    startDepth: number,
    elementMatcher: XPathMatcher,
    elementSchema: any
  ): Promise<any> {
    let currentDepth = startDepth;
    let textBuffer = '';
    let matchedDepth = -1;
    let iterResult = await parser.next();

    while (!iterResult.done && currentDepth >= startDepth) {
      const event = iterResult.value;

      if (isStartElement(event)) {
        currentDepth++;
        elementMatcher.onStartElement(event);

        if (elementMatcher.matches(event) && matchedDepth === -1) {
          matchedDepth = currentDepth;
          textBuffer = ''; // Reset buffer for this match
        }
      } else if (isEndElement(event)) {
        if (matchedDepth !== -1 && currentDepth === matchedDepth) {
          // We're closing the matched element - return the collected text
          const value = this.parseFieldValue(textBuffer.trim(), elementSchema);
          return value;
        }
        elementMatcher.onEndElement();
        currentDepth--;

        if (currentDepth < startDepth) {
          break;
        }
      } else if ((isCharacters(event) || isCdata(event)) && matchedDepth !== -1 && currentDepth === matchedDepth) {
        textBuffer += event.value;
      }

      if (currentDepth >= startDepth) {
        iterResult = await parser.next();
      }
    }

    // If we didn't find a match, try to extract using parseFieldValue with empty text
    return this.parseFieldValue('', elementSchema);
  }
}