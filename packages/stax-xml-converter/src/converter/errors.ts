/**
 * XML parse error with detailed issue information
 *
 * @public
 */
export class XmlParseError extends Error {
  /**
   * List of validation issues
   */
  issues: Array<{
    path: string[];
    message: string;
    code: string;
  }>;

  constructor(issues: Array<{ path: string[]; message: string; code: string }>) {
    super(`XML Parse Error: ${issues.map(i => i.message).join(', ')}`);
    this.name = 'XmlParseError';
    this.issues = issues;
  }
}

/**
 * Parse result type for safe parsing operations
 *
 * @public
 */
export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: XmlParseError };