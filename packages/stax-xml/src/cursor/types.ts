/**
 * Cursor event type constants as numeric SMI values.
 *
 * Using small integers (0-6) ensures V8 treats these as Smi (Small Integer),
 * which avoids write barrier overhead when updating mutable cursor state.
 *
 * @public
 */
export const CursorEventType = {
  /** Cursor positioned before the document starts */
  START_DOCUMENT: 0,
  /** Cursor positioned after the document ends */
  END_DOCUMENT: 1,
  /** Cursor positioned at the start of an element */
  START_ELEMENT: 2,
  /** Cursor positioned at the end of an element */
  END_ELEMENT: 3,
  /** Cursor positioned at character content */
  CHARACTERS: 4,
  /** Cursor positioned at a CDATA section */
  CDATA: 5,
  /** Cursor encountered a parse error */
  ERROR: 6,
} as const;

export type CursorEventType = typeof CursorEventType[keyof typeof CursorEventType];

/**
 * Options for the sync cursor reader.
 * @public
 */
export interface CursorReaderOptions {
  /** Whether to automatically decode XML entities. Default: true */
  autoDecodeEntities?: boolean;
  /** Additional custom entities to decode */
  addEntities?: { entity: string; value: string }[];
  /** Whether backend parse errors fall back to JavaScript. */
  fallbackOnParseError?: boolean;
}

/**
 * Options for the async cursor reader.
 * @public
 */
export interface CursorReaderAsyncOptions extends CursorReaderOptions {
  /** Text encoding for the input stream. Default: 'utf-8' */
  encoding?: string;
}
