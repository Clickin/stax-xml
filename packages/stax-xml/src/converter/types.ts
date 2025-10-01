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
   * @defaultValue 1000
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

/**
 * Writer configuration for XML element
 *
 * @public
 */
export interface XmlElementWriteConfig {
  /**
   * Element name (required)
   */
  element: string;

  /**
   * Write as attribute instead of element
   * Value is the attribute name
   */
  asAttribute?: string;

  /**
   * Namespace configuration
   */
  namespace?: {
    /**
     * Namespace prefix (e.g., 'dc', 'xsi')
     */
    prefix?: string;

    /**
     * Namespace URI (e.g., 'http://purl.org/dc/elements/1.1/')
     */
    uri?: string;
  };

  /**
   * Wrap content in CDATA section
   * @defaultValue false
   */
  cdata?: boolean;

  /**
   * Use self-closing tag for empty elements
   * @defaultValue false
   */
  selfClosing?: boolean;

  /**
   * Add XML comment before element
   */
  comment?: string;
}

/**
 * Options for XML writer
 *
 * @public
 */
export interface XmlWriteOptions {
  /**
   * Format output with indentation
   * @defaultValue false
   */
  prettyPrint?: boolean;

  /**
   * Indentation string
   * @defaultValue '  '
   */
  indentString?: string;

  /**
   * Text encoding for output
   * @defaultValue 'utf-8'
   */
  encoding?: string;

  /**
   * Root element name
   * If not provided, no root element wrapper is added
   */
  rootElement?: string;

  /**
   * Global namespace declarations
   */
  namespaces?: Array<{
    prefix: string;
    uri: string;
  }>;

  /**
   * Include XML declaration
   * @defaultValue true
   */
  includeDeclaration?: boolean;

  /**
   * XML version for declaration
   * @defaultValue '1.0'
   */
  xmlVersion?: string;
}