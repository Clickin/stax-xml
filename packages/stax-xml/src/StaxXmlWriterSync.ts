// StaxXmlWriter.ts
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
 * This is a simplified implementation that does not support namespace and complex PI/comment management.
 */
export class StaxXmlWriterSync {
    private xmlString: string = ''; // Buffer to store XML string
    private state: WriterState = WriterState.INITIAL;
    private elementStack: ElementInfo[] = []; // Stack of open element information
    private hasTextContentStack: boolean[] = []; // Stack tracking whether each element has text content
    private namespaceStack: Map<string, string>[] = []; // Namespace mapping stack
    // Changed to options object
    private readonly options: Required<StaxXmlWriterSyncOptions>;
    private currentIndentLevel: number = 0; // Current indentation level
    private needsIndent: boolean = false; // Whether indentation is needed for the next output
    private entityMap: Record<string, string> = {};

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
        //this.options = { ...defaultOptions, ...options };

        // Initialize namespace stack (root namespace context)
        this.namespaceStack = [new Map<string, string>()];

        // Add custom entities to entityMap if they exist
        if (this.options.addEntities && Array.isArray(this.options.addEntities)) {
            for (const entity of this.options.addEntities) {
                if (entity.entity && entity.value) {
                    this.entityMap[entity.entity] = entity.value;
                }
            }
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

        // Add attributes (if attributes are provided)
        if (attributes) {
            for (const [key, value] of Object.entries(attributes)) {
                if (typeof value === 'string') {
                    // Simple string attribute
                    this._write(` ${key}="${this._escapeXml(value)}"`);
                } else {
                    // AttributeInfo object - attribute with prefix
                    const attrPrefix = value.prefix;
                    const attrValue = value.value;

                    if (attrPrefix) {
                        // Check if prefix is defined in namespace
                        if (!currentNamespaces.has(attrPrefix)) {
                            throw new Error(`Namespace prefix '${attrPrefix}' is not defined for attribute '${key}'`);
                        }
                        this._write(` ${attrPrefix}:${key}="${this._escapeXml(attrValue)}"`);
                    } else {
                        this._write(` ${key}="${this._escapeXml(attrValue)}"`);
                    }
                }
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
        let entityMap: Record<string, string> = {
            '&': '&amp;', // During write process, & does not conflict with other entities
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            '\'': '&apos;',
            ...this.options.addEntities?.reduce((map, entity) => {
                if (entity.entity && entity.value) {
                    map[entity.entity] = entity.value;
                }
                return map;
            }, {} as Record<string, string>)
        };
        // Convert entityMap keys to regex for escaping
        const regex = new RegExp(Object.keys(entityMap).join('|'), 'g');
        // Escape processing
        return text.replace(regex, (match) => {
            // If character is defined in entityMap, return mapped value
            if (entityMap[match]) {
                return entityMap[match];
            }
            else {
                // Return undefined characters as-is
                return match;
            }
        });
    }
}

export default StaxXmlWriterSync;