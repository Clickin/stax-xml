/**
 * Parse options for XML converter
 *
 * @public
 */
export interface ParseOptions {
  /**
   * Whether to trim whitespace from text content
   * @defaultValue false
   */
  trimText?: boolean;

  /**
   * Whether to decode XML entities
   * @defaultValue true
   */
  decodeEntities?: boolean;

  /**
   * Strict mode for parsing
   * @defaultValue false
   */
  strict?: boolean;

  /**
   * Maximum XML depth
   * @defaultValue 100
   */
  maxDepth?: number;

  /**
   * Maximum number of events to process
   * @defaultValue 1000000
   */
  maxEvents?: number;
}

/**
 * Options for string schema
 *
 * @public
 */
export interface XmlStringOptions {
  /**
   * XPath expression to locate the element
   */
  xpath?: string;

  /**
   * Minimum string length
   */
  min?: number;

  /**
   * Maximum string length
   */
  max?: number;

  /**
   * Regular expression pattern to validate against
   */
  pattern?: RegExp;
}

/**
 * Options for number schema
 *
 * @public
 */
export interface XmlNumberOptions {
  /**
   * XPath expression to locate the element
   */
  xpath?: string;

  /**
   * Minimum value
   */
  min?: number;

  /**
   * Maximum value
   */
  max?: number;

  /**
   * Whether the number must be an integer
   * @defaultValue false
   */
  int?: boolean;
}

/**
 * Options for object schema
 *
 * @public
 */
export interface XmlObjectOptions {
  /**
   * XPath expression to locate the element
   */
  xpath?: string;

  /**
   * Strict mode - reject unknown properties
   * @defaultValue false
   */
  strict?: boolean;
}