// StaxXmlWriter.ts - Optimized version with real performance improvements
import { NamespaceDeclaration, WriteElementOptions } from './types';

/**
 * States that occur during XML document writing
 */
const WriterState = {
    INITIAL: 0,            // Initial state
    START_ELEMENT_OPEN: 1, // <element (attributes, namespaces can be written)
    IN_ELEMENT: 2,         // <element>...</element> (text, child elements, PI, etc. can be written)
    AFTER_ELEMENT: 3,      // After </element> (next element, comments, etc. can be written)
    CLOSED: 4,             // Stream is closed
    ERROR: 5               // Error occurred
} as const;

type WriterState = typeof WriterState[keyof typeof WriterState];

/**
 * Element information stored in the element stack
 */
interface ElementInfo {
    localName: string;
    prefix?: string;
}


export interface StaxXmlWriterSyncOptions {
    encoding?: string; // Output encoding (default: 'utf-8')
    prettyPrint?: boolean; // Enable pretty print (default: false)
    indentString?: string; // Pretty print indentation string (default: '  ')
    addEntities?: { entity: string, value: string }[]; // Custom entities
    autoEncodeEntities?: boolean; // Enable automatic entity encoding (default: true)
    namespaces?: NamespaceDeclaration[]; // Default namespace declarations for the document
}


/**
 * A class for writing XML similar to StAX XMLStreamWriter.
 * This is an optimized implementation with:
 * - Optimization 1: Regex caching for entity escaping
 * - Optimization 2: Attribute string batching
 * - Optimization 3: Early entity check before regex execution
 */
export class StaxXmlWriterSync {
    // OPTIMIZATION 1: Static cached regex and entity map for basic entities
    private static readonly BASIC_ENTITY_MAP: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&apos;'
    };
    private static readonly BASIC_ENTITY_REGEX = /[&<>"']/g;

    private xmlString: string = ''; // Buffer to store XML string
    private state: WriterState = WriterState.INITIAL;
    private elementStack: ElementInfo[] = []; // Stack of open element information
    private hasTextContentStack: boolean[] = []; // Stack tracking whether each element has text content
    private namespaceStack: Map<string, string>[] = []; // Namespace mapping stack
    // Changed to options object
    private readonly options: Required<StaxXmlWriterSyncOptions>;
    private currentIndentLevel: number = 0; // Current indentation level
    private needsIndent: boolean = false; // Whether indentation is needed for the next output

    // OPTIMIZATION 1: Instance fields for custom entity handling (if any)
    private customEntityRegex?: RegExp;
    private fullEntityMap?: Record<string, string>;
    private customEntityKeys?: string[]; // For fast early checking

    constructor(options: StaxXmlWriterSyncOptions = {}) {
        // Initialize with default options
        this.options = {
            encoding: 'utf-8',
            prettyPrint: false,
            indentString: '  ',
            addEntities: [],
            autoEncodeEntities: true,
            namespaces: [],
            ...options
        }

        // Initialize namespace stack (root namespace context)
        this.namespaceStack = [new Map<string, string>()];

        // OPTIMIZATION 1: Build custom entity map and regex at construction time
        if (this.options.addEntities && this.options.addEntities.length > 0) {
            this.fullEntityMap = {
                ...StaxXmlWriterSync.BASIC_ENTITY_MAP,
                ...this.options.addEntities.reduce((map, entity) => {
                    if (entity.entity && entity.value) {
                        map[entity.entity] = entity.value;
                    }
                    return map;
                }, {} as Record<string, string>)
            };

            // Build regex with proper escaping
            const escapedKeys = Object.keys(this.fullEntityMap).map(k =>
                k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            );
            this.customEntityRegex = new RegExp(escapedKeys.join('|'), 'g');

            // Store custom entity keys (excluding basic ones) for early check
            this.customEntityKeys = Object.keys(this.fullEntityMap).filter(
                k => !(k in StaxXmlWriterSync.BASIC_ENTITY_MAP)
            );
        }
    }

    /**
     * Writes the XML declaration (e.g., <?xml version="1.0" encoding="UTF-8"?>).
     * Should be called only once at the very beginning of the document.
     * @param version XML version (default: "1.0")
     * @param encoding Encoding (default: value set in constructor)
     * @param standalone Whether document is standalone (default: undefined)
     * @returns this (chainable)
     * @throws Error when called in incorrect state
     */
    public writeStartDocument(version: string = '1.0', encoding?: string): this {
        if (this.state !== WriterState.INITIAL) {
            throw new Error('writeStartDocument can only be called once at the beginning of the document.');
        }
        this.state = WriterState.AFTER_ELEMENT; // After document declaration, elements or comments can be written

        let declaration = `<?xml version="${version}"`;
        if (encoding) {
            declaration += ` encoding="${encoding.toUpperCase()}"`; // Encoding in uppercase
            this.options.encoding = encoding; // Update encoding
        } else {
            const actualEncoding = this.options.encoding || 'UTF-8';
            declaration += ` encoding="${actualEncoding.toUpperCase()}"`;
        }
        declaration += '?>';
        this._write(declaration);
        if (this.options.prettyPrint) {
            this.needsIndent = true;
        }
        return this;
    }

    /**
     * Indicates the end of the document and automatically closes all open elements.
     * @returns Promise<void> Promise that resolves when stream is flushed
     */
    public writeEndDocument(): void {
        if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
            return; // Do nothing if already closed or in error state
        }

        // Close all open elements
        while (this.elementStack.length > 0) {
            this.writeEndElement();
        }
        this.state = WriterState.CLOSED;
    }

    /**
     * Returns the written XML string.
     * Should be called after writeEndDocument() to get the complete XML.
     * @returns The written XML string
     */
    public getXmlString(): string {
        return this.xmlString;
    }

    /**
     * Writes a start element (e.g., <element> or <prefix:element>).
     * @param localName Local name of the element
     * @param options Element writing options (prefix, uri, attributes, selfClosing)
     * @returns this (chainable)
     * @throws Error when called in incorrect state
     */
    public writeStartElement(localName: string, options?: WriteElementOptions): this {
        if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
            throw new Error('Cannot writeStartElement: Writer is closed or in error state.');
        }
        this._closeStartElementTag(); // Close any previously open tag

        // Extract values from options
        const prefix = options?.prefix;
        const uri = options?.uri;
        const attributes = options?.attributes;
        const selfClosing = options?.selfClosing ?? false;
        const comment = options?.comment;

        // Write comment if provided
        if (comment) {
            this._writeIndent();
            this._write(`<!-- ${comment} -->`);
            this._writeNewline();
        }

        this._writeIndent(); // Indentation for pretty print
        const tagName = prefix ? `${prefix}:${localName}` : localName;
        this._write(`<${tagName}`);

        // Create namespace context (new namespace mapping for current level)
        const currentNamespaces = new Map(this.namespaceStack[this.namespaceStack.length - 1]);

        // Element-level namespace declaration if prefix and uri provided
        if (prefix && uri) {
            this._write(` xmlns:${prefix}="${this._escapeXml(uri)}"`);
            currentNamespaces.set(prefix, uri);
        }

        // OPTIMIZATION 2: Attribute string batching
        // Build entire attribute string first, then single _write call
        if (attributes) {
            let attrString = '';
            for (const [key, value] of Object.entries(attributes)) {
                if (typeof value === 'string') {
                    // Simple string attribute
                    attrString += ` ${key}="${this._escapeXml(value)}"`;
                } else {
                    // AttributeInfo object - attribute with prefix
                    const attrPrefix = value.prefix;
                    const attrValue = value.value;

                    if (attrPrefix) {
                        // Check if prefix is defined in namespace
                        if (!currentNamespaces.has(attrPrefix)) {
                            throw new Error(`Namespace prefix '${attrPrefix}' is not defined for attribute '${key}'`);
                        }
                        attrString += ` ${attrPrefix}:${key}="${this._escapeXml(attrValue)}"`;
                    } else {
                        attrString += ` ${key}="${this._escapeXml(attrValue)}"`;
                    }
                }
            }
            if (attrString) {
                this._write(attrString);
            }
        }

        // If selfClosing is true, close the tag immediately and finish
        if (selfClosing) {
            this._write('/>');
            this.state = WriterState.AFTER_ELEMENT;
            this._writeNewline(); // Newline for pretty print
            return this;
        }

        this.elementStack.push({
            localName,
            prefix
        });
        this.hasTextContentStack.push(false); // New element has no text content yet
        this.namespaceStack.push(currentNamespaces); // Save namespace context
        this.state = WriterState.START_ELEMENT_OPEN; // Now attributes or namespaces can be written
        this.currentIndentLevel++; // Increase indentation level
        return this;
    }



    /**
     * Writes an attribute. Can only be called immediately after writeStartElement().
     * @param localName Local name of the attribute
     * @param value Attribute value
     * @param prefix Namespace prefix of the attribute (note: this implementation does not manage namespace mapping)
     * @param uri Namespace URI of the attribute (note: this implementation does not manage namespace mapping)
     * @returns this (chainable)
     * @throws Error when called in incorrect state
     */
    public writeAttribute(localName: string, value: string, prefix?: string): this {
        if (this.state !== WriterState.START_ELEMENT_OPEN) {
            throw new Error('writeAttribute can only be called after writeStartElement.');
        }
        let attrName = prefix ? `${prefix}:${localName}` : localName;
        let attr = ` ${attrName}="${this._escapeXml(value)}"`;
        // URI is not handled in current implementation (no namespace management logic)
        this._write(attr);
        return this;
    }

    /**
     * Writes a namespace declaration. Can only be called immediately after writeStartElement().
     * This implementation simply writes the string in the form xmlns:prefix="uri" or xmlns="uri".
     * Actual namespace validation/management logic is not included.
     * @param prefix Namespace prefix
     * @param uri Namespace URI
     * @returns this (chainable)
     * @throws Error when called in incorrect state
     */
    public writeNamespace(prefix: string, uri: string): this {
        if (this.state !== WriterState.START_ELEMENT_OPEN) {
            throw new Error('writeNamespace can only be called after writeStartElement.');
        }

        // Add to current namespace context
        const currentNamespaces = this.namespaceStack[this.namespaceStack.length - 1];

        if (prefix) {
            this._write(` xmlns:${prefix}="${this._escapeXml(uri)}"`);
            currentNamespaces.set(prefix, uri);
        } else { // Default namespace
            this._write(` xmlns="${this._escapeXml(uri)}"`);
            currentNamespaces.set('', uri);
        }
        return this;
    }

    /**
     * Writes text content.
     * @param text Text to write
     * @returns this (chainable)
     * @throws Error when called in incorrect state
     */
    public writeCharacters(text: string): this {
        if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
            throw new Error('Cannot writeCharacters: Writer is closed or in error state.');
        }
        this._closeStartElementTag();
        // No separate indentation applied to text (treated as inline text)
        this._write(this._escapeXml(text));
        this.state = WriterState.IN_ELEMENT; // After writing text, consider being inside an element
        // Mark that current element has text content
        if (this.hasTextContentStack.length > 0) {
            this.hasTextContentStack[this.hasTextContentStack.length - 1] = true;
        }
        // Set needsIndent to false after text so the next element is properly indented
        this.needsIndent = false;
        return this;
    }

    /**
     * Writes a CDATA section.
     * @param cdata CDATA content
     * @returns this (chainable)
     * @throws Error when called in incorrect state (especially when containing ']]>' sequence)
     */
    public writeCData(cdata: string): this {
        if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
            throw new Error('Cannot writeCData: Writer is closed or in error state.');
        }
        this._closeStartElementTag();
        // CDATA section content is not parsed, so no escaping is needed.
        // However, the ']]>' sequence terminates CDATA, so it cannot be included.
        if (cdata.includes(']]>')) {
            throw new Error('CDATA section cannot contain "]]>" sequence.');
        }
        // CDATA is output as-is in original form (ignoring indentation)
        this._write(`<![CDATA[${cdata}]]>`);
        this.state = WriterState.IN_ELEMENT;
        // Mark that current element has text content
        if (this.hasTextContentStack.length > 0) {
            this.hasTextContentStack[this.hasTextContentStack.length - 1] = true;
        }
        this.needsIndent = false; // Set needsIndent to false after CDATA
        return this;
    }

    /**
     * Writes a comment.
     * @param comment Comment content
     * @returns this (chainable)
     * @throws Error when called in incorrect state (especially when containing '--' sequence)
     */
    public writeComment(comment: string): this {
        if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
            throw new Error('Cannot writeComment: Writer is closed or in error state.');
        }
        this._closeStartElementTag();
        // XML comments cannot contain '--' sequence.
        if (comment.includes('--')) {
            throw new Error('XML comment cannot contain "--" sequence.');
        }
        this._writeIndent(); // Indentation for pretty print
        this._write(`<!-- ${comment} -->`);
        this.state = WriterState.AFTER_ELEMENT; // After comment, next element or comment is possible
        this._writeNewline(); // Newline for pretty print
        return this;
    }

    /**
     * Writes a processing instruction (Processing Instruction).
     * @param target PI target
     * @param data PI data (optional)
     * @returns this (chainable)
     * @throws Error when called in incorrect state (especially when containing '?>' sequence)
     */
    public writeProcessingInstruction(target: string, data?: string): this {
        if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
            throw new Error('Cannot writeProcessingInstruction: Writer is closed or in error state.');
        }
        this._closeStartElementTag();
        let pi = `<?${target}`;
        if (data) {
            // The '?>' sequence inside data terminates PI, so it should be avoided.
            if (data.includes('?>')) {
                throw new Error('Processing instruction data cannot contain "?>" sequence.');
            }
            pi += ` ${data}`;
        }
        pi += '?>';
        this._writeIndent(); // Indentation for pretty print
        this._write(pi);
        this.state = WriterState.AFTER_ELEMENT;
        this._writeNewline(); // Newline for pretty print
        return this;
    }

    /**
     * Writes raw XML content without escaping
     * @param xml Raw XML string to write
     * @returns this (chainable)
     */
    public writeRaw(xml: string): this {
        this._closeStartElementTag();
        this._write(xml);
        return this;
    }

    /**
     * Closes the currently open element (e.g., </element> or </prefix:element>).
     * @returns this (chainable)
     * @throws Error when called with no open elements
     */
    public writeEndElement(): this {
        if (this.elementStack.length === 0) {
            throw new Error('No open element to close.');
        }
        if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) {
            throw new Error('Cannot writeEndElement: Writer is closed or in error state.');
        }

        this.currentIndentLevel--; // Decrease indentation level

        // Check if current element has text content
        const hasTextContent = this.hasTextContentStack.pop() || false;

        // Apply indentation only if there's no text content and it's not an empty element
        if (!hasTextContent && this.state !== WriterState.START_ELEMENT_OPEN) {
            this._writeIndent();
        }

        this._closeStartElementTag(); // If there's an open tag, close it first before writing closing tag

        const elementInfo = this.elementStack.pop()!;
        this.namespaceStack.pop(); // Remove namespace context
        const closingTagName = elementInfo.prefix ? `${elementInfo.prefix}:${elementInfo.localName}` : elementInfo.localName;
        this._write(`</${closingTagName}>`);
        this.state = WriterState.AFTER_ELEMENT; // After closing element, next element or comment is possible

        if (this.options.prettyPrint) {
            this.needsIndent = true;
        }
        return this;
    }

    /**
     * Enables/disables pretty print functionality.
     * @param enabled Whether to enable pretty print
     * @returns this (chainable)
     */
    public setPrettyPrint(enabled: boolean): this {
        this.options.prettyPrint = enabled;
        return this;
    }

    /**
     * Sets the indentation string.
     * @param indentString String to use for indentation (e.g., '  ', '\t', '    ')
     * @returns this (chainable)
     */
    public setIndentString(indentString: string): this {
        this.options.indentString = indentString;
        return this;
    }

    /**
     * Returns the current pretty print setting.
     * @returns Whether pretty print is enabled
     */
    public isPrettyPrintEnabled(): boolean {
        return this.options.prettyPrint;
    }

    /**
     * Returns the current indentation string.
     * @returns Currently set indentation string
     */
    public getIndentString(): string {
        return this.options.indentString;
    }

    /**
     * Closes the currently open start element tag (adds '>').
     * For example, turns <element into <element>.
     * @private
     */
    private _closeStartElementTag(): void {
        if (this.state === WriterState.START_ELEMENT_OPEN) {
            this._write('>');
            this.state = WriterState.IN_ELEMENT; // Since tag is closed, now consider being inside element
            if (this.options.prettyPrint) {
                this.needsIndent = true;
            }
        }
    }

    /**
     * Applies indentation for pretty print.
     * @private
     */
    private _writeIndent(): void {
        if (this.options.prettyPrint && this.needsIndent) {
            this.xmlString += '\n';
            this.xmlString += this.options.indentString.repeat(this.currentIndentLevel);
            this.needsIndent = false;
        }
    }

    /**
     * Adds newline for pretty print.
     * @private
     */
    private _writeNewline(): void {
        if (this.options.prettyPrint) {
            this.xmlString += '\n';
            this.needsIndent = true;
        }
    }

    /**
     * Writes string to output stream.
     * @param chunk String to write
     * @private
     */
    private _write(chunk: string): void {
        if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) return;
        this.xmlString += chunk;
    }

    /**
     * Escapes XML text.
     * OPTIMIZED with:
     * - Cached regex patterns (Optimization 1)
     * - Early entity check to skip regex when not needed (Optimization 3)
     * - Fast path for no custom entities case (most common)
     * @param text Text to escape
     * @returns Escaped text
     * @private
     */
    private _escapeXml(text: string): string {
        if (!text) {
            return ''; // Return empty string as-is
        }
        if (!this.options.autoEncodeEntities) {
            return text; // Return original text if automatic entity encoding is disabled
        }

        // Fast path: No custom entities case (most common)
        if (!this.customEntityRegex) {
            // Early exit: Check if text contains basic entities
            if (!text.includes('&') && !text.includes('<') && !text.includes('>') &&
                !text.includes('"') && !text.includes("'")) {
                return text; // No escaping needed
            }

            // Use cached basic entity regex
            return text.replace(StaxXmlWriterSync.BASIC_ENTITY_REGEX,
                (match) => StaxXmlWriterSync.BASIC_ENTITY_MAP[match] || match);
        }

        // Slow path: Custom entities exist
        // OPTIMIZATION 3: Early exit check (including custom entities)
        const hasBasicEntities = text.includes('&') || text.includes('<') || text.includes('>') ||
                                 text.includes('"') || text.includes("'");

        let hasCustomEntities = false;
        if (this.customEntityKeys && this.customEntityKeys.length > 0) {
            hasCustomEntities = this.customEntityKeys.some(entity => text.includes(entity));
        }

        // If no entities present, return original text
        if (!hasBasicEntities && !hasCustomEntities) {
            return text;
        }

        // OPTIMIZATION 1: Use cached custom entity regex
        return text.replace(this.customEntityRegex, (match) => this.fullEntityMap![match] || match);
    }
}

export default StaxXmlWriterSync;
