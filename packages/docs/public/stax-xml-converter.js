//#region src/converter/errors.ts
/**
* XML parse error with detailed issue information
*
* @public
*/
var XmlParseError = class extends Error {
	/**
	* List of validation issues
	*/
	issues;
	constructor(issues) {
		super(`XML Parse Error: ${issues.map((i) => i.message).join(", ")}`);
		this.name = "XmlParseError";
		this.issues = issues;
	}
};

//#endregion
//#region src/converter/base.ts
/**
* Base abstract class for all XML schema types
*
* @remarks
* This class provides the foundation for zod-style declarative XML parsing.
* Each schema type extends this class and implements the parsing logic.
*
* @public
*/
var XmlSchemaBase = class XmlSchemaBase {
	_output;
	_input;
	/**
	* Writer configuration for this schema
	* @internal
	*/
	writeConfig;
	/**
	* Parse XML asynchronously (public API)
	* @param input - XML string, stream, or async iterator
	* @param options - Parse options
	* @returns Parsed output
	* @throws {XmlParseError} If parsing fails
	*/
	async parse(input, options) {
		return this._parseAsync(input, options);
	}
	/**
	* Parse XML synchronously (public API)
	* @param input - XML string or sync iterator
	* @param options - Parse options
	* @returns Parsed output
	* @throws {XmlParseError} If parsing fails
	*/
	parseSync(input, options) {
		return this._parse(input, options);
	}
	/**
	* Parse XML asynchronously with error handling
	* @param input - XML string, stream, or async iterator
	* @param options - Parse options
	* @returns Parse result with success flag
	*/
	async safeParse(input, options) {
		try {
			return {
				success: true,
				data: await this._parseAsync(input, options)
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof XmlParseError ? error : new XmlParseError([{
					path: [],
					message: error instanceof Error ? error.message : String(error),
					code: "parse_error"
				}])
			};
		}
	}
	/**
	* Parse XML synchronously with error handling
	* @param input - XML string or sync iterator
	* @param options - Parse options
	* @returns Parse result with success flag
	*/
	safeParseSync(input, options) {
		try {
			return {
				success: true,
				data: this._parse(input, options)
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof XmlParseError ? error : new XmlParseError([{
					path: [],
					message: error instanceof Error ? error.message : String(error),
					code: "parse_error"
				}])
			};
		}
	}
	/**
	* Transform the parsed output
	* @param fn - Transform function
	* @returns New schema with transform applied
	*/
	transform(fn) {
		return XmlSchemaBase._createTransform(this, fn);
	}
	/**
	* Make this schema optional
	* @returns New optional schema
	*/
	optional() {
		return XmlSchemaBase._createOptional(this);
	}
	/**
	* Convert this schema to an array schema
	* @param xpath - XPath expression for array elements
	* @returns New array schema
	*/
	array(xpath) {
		return XmlSchemaBase._createArray(this, xpath);
	}
	/**
	* Write data to XML string asynchronously (public API)
	* @param data - Data to write
	* @param options - Write options
	* @returns XML string
	*/
	async write(data, options) {
		const chunks = [];
		const stream = new WritableStream({ write(chunk) {
			chunks.push(chunk);
		} });
		await this._write(data, stream, options);
		const encoder = new TextDecoder(options?.encoding || "utf-8");
		return chunks.map((chunk) => encoder.decode(chunk, { stream: true })).join("") + encoder.decode();
	}
	/**
	* Write data to WritableStream asynchronously (public API)
	* @param data - Data to write
	* @param stream - Writable stream to write to
	* @param options - Write options
	*/
	async writeToStream(data, stream, options) {
		return this._write(data, stream, options);
	}
	/**
	* Write data to XML string synchronously (public API)
	* @param data - Data to write
	* @param options - Write options
	* @returns XML string
	*/
	writeSync(data, options) {
		return this._writeSync(data, options);
	}
	/**
	* Configure writer settings for this schema
	* @param config - Writer configuration
	* @returns This schema with writer config
	*/
	writer(config) {
		this.writeConfig = config;
		return this;
	}
	static _createTransform;
	static _createOptional;
	static _createArray;
};

//#endregion
//#region src/converter/types.ts
/**
* Schema type constants for XML schema classification
*
* @public
*/
const SchemaType = {
	STRING: "STRING",
	NUMBER: "NUMBER",
	ARRAY: "ARRAY",
	OBJECT: "OBJECT",
	TRANSFORM: "TRANSFORM",
	OPTIONAL: "OPTIONAL"
};
/**
* Type guard for string schema
*
* @public
*/
function isStringSchema(schema) {
	return schema.schemaType === SchemaType.STRING;
}
/**
* Type guard for number schema
*
* @public
*/
function isNumberSchema(schema) {
	return schema.schemaType === SchemaType.NUMBER;
}
/**
* Type guard for array schema
*
* @public
*/
function isArraySchema(schema) {
	return schema.schemaType === SchemaType.ARRAY;
}
/**
* Type guard for object schema
*
* @public
*/
function isObjectSchema(schema) {
	return schema.schemaType === SchemaType.OBJECT;
}
/**
* Type guard for transform schema
*
* @public
*/
function isTransformSchema(schema) {
	return schema.schemaType === SchemaType.TRANSFORM;
}
/**
* Type guard for optional schema
*
* @public
*/
function isOptionalSchema(schema) {
	return schema.schemaType === SchemaType.OPTIONAL;
}

//#endregion
//#region src/converter/XmlTransformSchema.ts
/**
* Schema for transforming parsed values
*
* @public
*/
var XmlTransformSchema = class extends XmlSchemaBase {
	schemaType = SchemaType.TRANSFORM;
	/** @internal */
	schema;
	/** @internal */
	transformFn;
	constructor(schema, transformFn) {
		super();
		this.schema = schema;
		this.transformFn = transformFn;
	}
	_parse(input, options) {
		const result = this.schema._parse(input, options);
		return this.transformFn(result);
	}
	async _parseAsync(input, options) {
		const result = await this.schema._parseAsync(input, options);
		return this.transformFn(result);
	}
	/**
	* Parse from current iterator position and apply transform
	* @internal
	*/
	_parseFromPosition(iterator, startEvent, startDepth, options) {
		if (this.schema._parseFromPosition) {
			const result = this.schema._parseFromPosition(iterator, startEvent, startDepth, options);
			if (result && typeof result.then === "function") return result.then((r) => this.transformFn(r));
			return this.transformFn(result);
		}
		throw new Error("Transform schema requires base schema with _parseFromPosition");
	}
	_parseText(text) {
		if (this.schema._parseText) {
			const result = this.schema._parseText(text);
			return this.transformFn(result);
		}
		throw new Error("Transform schema requires base schema with _parseText");
	}
	/**
	* Write transformed data to XML synchronously
	* Note: Transform is not reversible, so writing is not supported
	* @internal
	*/
	_writeSync(data, options) {
		throw new Error("Transform schema does not support writing. Use the base schema for writing.");
	}
	/**
	* Write transformed data to WritableStream asynchronously
	* Note: Transform is not reversible, so writing is not supported
	* @internal
	*/
	async _write(data, stream, options) {
		throw new Error("Transform schema does not support writing. Use the base schema for writing.");
	}
};

//#endregion
//#region src/converter/XmlOptionalSchema.ts
/**
* Schema for optional values
*
* @public
*/
var XmlOptionalSchema = class extends XmlSchemaBase {
	schemaType = SchemaType.OPTIONAL;
	constructor(schema) {
		super();
		this.schema = schema;
	}
	_parse(input, options) {
		try {
			const result = this.schema._parse(input, options);
			if (result === "") return;
			return result;
		} catch {
			return;
		}
	}
	async _parseAsync(input, options) {
		try {
			const result = await this.schema._parseAsync(input, options);
			if (result === "") return;
			return result;
		} catch {
			return;
		}
	}
	_parseText(text) {
		if (this.schema._parseText) try {
			const result = this.schema._parseText(text);
			if (result === "") return;
			return result;
		} catch {
			return;
		}
	}
	/**
	* Write optional data to XML synchronously
	* @internal
	*/
	_writeSync(data, options) {
		if (data === void 0 || data === null) return "";
		return this.schema._writeSync(data, options);
	}
	/**
	* Write optional data to WritableStream asynchronously
	* @internal
	*/
	async _write(data, stream, options) {
		if (data === void 0 || data === null) return;
		return this.schema._write(data, stream, options);
	}
};

//#endregion
//#region src/types.ts
/**
* Enumeration of XML stream event types used by the StAX parser
*
* @public
*/
const XmlEventType = {
	START_DOCUMENT: "START_DOCUMENT",
	END_DOCUMENT: "END_DOCUMENT",
	START_ELEMENT: "START_ELEMENT",
	END_ELEMENT: "END_ELEMENT",
	CHARACTERS: "CHARACTERS",
	CDATA: "CDATA",
	ERROR: "ERROR"
};
/**
* Type guard function - Check if the event is a START_ELEMENT event
* @param event XML event to check
* @returns true if the event is a START_ELEMENT event, false otherwise
*/
function isStartElement(event) {
	return event.type === XmlEventType.START_ELEMENT;
}
/**
* Type guard function - Check if the event is an END_ELEMENT event
* @param event XML event to check
* @returns true if the event is an END_ELEMENT event, false otherwise
*/
function isEndElement(event) {
	return event.type === XmlEventType.END_ELEMENT;
}
/**
* Type guard function - Check if the event is a CHARACTERS event
* @param event XML event to check
* @returns true if the event is a CHARACTERS event, false otherwise
*/
function isCharacters(event) {
	return event.type === XmlEventType.CHARACTERS;
}
/**
* Type guard function - Check if the event is a CDATA event
* @param event XML event to check
* @returns true if the event is a CDATA event, false otherwise
*/
function isCdata(event) {
	return event.type === XmlEventType.CDATA;
}

//#endregion
//#region src/StaxXmlParser.ts
/**
* High-performance asynchronous XML parser implementing the StAX (Streaming API for XML) pattern.
*
* This parser provides memory-efficient processing of large XML files through streaming
* with support for pull-based parsing, custom entity handling, and namespace processing.
*
* @remarks
* The parser uses UTF-8 safe processing with Boyer-Moore-Horspool pattern search optimization
* and supports both single-event and batch processing modes for improved performance.
*
* @example
* Basic usage:
* ```typescript
* const xmlContent = '<root><item>Hello</item></root>';
* const stream = new ReadableStream({
*   start(controller) {
*     controller.enqueue(new TextEncoder().encode(xmlContent));
*     controller.close();
*   }
* });
*
* const parser = new StaxXmlParser(stream);
* for await (const event of parser) {
*   console.log(event.type, event);
* }
* ```
*
* @example
* With custom options:
* ```typescript
* const options = {
*   autoDecodeEntities: true,
*   maxBufferSize: 128 * 1024,
*   addEntities: [{ entity: 'custom', value: 'replacement' }]
* };
* const parser = new StaxXmlParser(stream, options);
* ```
*
* @public
*/
var StaxXmlParser = class StaxXmlParser {
	reader = null;
	decoder;
	buffer;
	bufferLength = 0;
	position = 0;
	eventQueue = [];
	resolveNext = null;
	error = null;
	isStreamEnded = false;
	parserFinished = false;
	currentTextBuffer = "";
	elementStack = [];
	namespaceStack = [];
	options;
	static ASCII_TABLE = (() => {
		const table = new Uint8Array(128);
		table[9] = 1;
		table[10] = 1;
		table[13] = 1;
		table[32] = 1;
		table[60] = 2;
		table[62] = 3;
		table[47] = 4;
		table[61] = 5;
		table[33] = 6;
		table[63] = 7;
		table[34] = 8;
		table[39] = 9;
		table[38] = 10;
		table[91] = 11;
		table[93] = 12;
		return table;
	})();
	static ENTITY_REGEX_CACHE = /* @__PURE__ */ new Map();
	static DEFAULT_ENTITY_REGEX = /&(lt|gt|quot|apos|amp);/g;
	static DEFAULT_ENTITY_MAP = {
		"lt": "<",
		"gt": ">",
		"quot": "\"",
		"apos": "'",
		"amp": "&"
	};
	entityDecoder;
	bmhCache = /* @__PURE__ */ new Map();
	batchMetrics = {
		avgEventSize: 100,
		lastBatchTime: 0,
		eventCount: 0
	};
	/**
	* Creates a new StaxXmlParser instance.
	*
	* @param xmlStream - The ReadableStream containing XML data as Uint8Array chunks
	* @param options - Configuration options for the parser
	* @throws {Error} When xmlStream is not a valid ReadableStream
	*
	* @example
	* ```typescript
	* const xmlData = '<root><item>content</item></root>';
	* const stream = new ReadableStream({
	*   start(controller) {
	*     controller.enqueue(new TextEncoder().encode(xmlData));
	*     controller.close();
	*   }
	* });
	*
	* const parser = new StaxXmlParser(stream, {
	*   autoDecodeEntities: true,
	*   maxBufferSize: 64 * 1024
	* });
	* ```
	*/
	constructor(xmlStream, options = {}) {
		if (!(xmlStream instanceof ReadableStream)) throw new Error("xmlStream must be a web standard ReadableStream.");
		this.options = {
			encoding: "utf-8",
			autoDecodeEntities: true,
			maxBufferSize: 64 * 1024,
			enableBufferCompaction: true,
			batchSize: 10,
			batchTimeout: 10,
			...options
		};
		this.decoder = new TextDecoder(this.options.encoding, {
			fatal: false,
			ignoreBOM: true
		});
		this.buffer = new Uint8Array(this.options.maxBufferSize || 64 * 1024);
		this.entityDecoder = this._compileEntityDecoder();
		this.reader = xmlStream.getReader();
		this._startReading();
		this._addEvent({
			type: XmlEventType.START_DOCUMENT,
			name: void 0,
			localName: void 0,
			prefix: void 0,
			uri: void 0,
			attributes: void 0,
			attributesWithPrefix: void 0,
			value: void 0,
			error: void 0
		});
	}
	/**
	* Fast XML special character check
	*/
	getXmlCharType(byte) {
		return byte < 128 ? StaxXmlParser.ASCII_TABLE[byte] : 0;
	}
	/**
	* Check if UTF-8 byte is the start of a character
	* @param byte The byte to check
	* @returns true if it's the start of a character
	*/
	isUtf8CharStart(byte) {
		return (byte & 128) === 0 || (byte & 192) === 192;
	}
	/**
	* Calculate UTF-8 sequence length
	* @param byte The first byte
	* @returns Sequence length (1-4)
	*/
	getUtf8SequenceLength(byte) {
		if ((byte & 128) === 0) return 1;
		if ((byte & 224) === 192) return 2;
		if ((byte & 240) === 224) return 3;
		if ((byte & 248) === 240) return 4;
		return 1;
	}
	/**
	* Safely adjust position at UTF-8 character boundaries
	* @param pos The position to adjust
	* @param searchBackward Whether to search backwards
	* @returns Safe UTF-8 boundary position
	*/
	findSafeUtf8Boundary(pos, searchBackward = true) {
		if (pos <= 0 || pos >= this.bufferLength) return pos;
		if (searchBackward) {
			let safePos = pos;
			let backtrack = 0;
			while (safePos > 0 && backtrack < 4) {
				if (this.isUtf8CharStart(this.buffer[safePos])) {
					const seqLen = this.getUtf8SequenceLength(this.buffer[safePos]);
					if (safePos + seqLen > pos) return safePos;
					else return pos;
				}
				safePos--;
				backtrack++;
			}
			return pos;
		} else {
			while (pos < this.bufferLength && !this.isUtf8CharStart(this.buffer[pos])) pos++;
			return pos;
		}
	}
	/**
	* Safely extract UTF-8 string from buffer
	* @param start Starting position
	* @param end Ending position
	* @returns Decoded string
	*/
	safeDecodeRange(start, end) {
		const safeStart = this.findSafeUtf8Boundary(start, false);
		const safeEnd = this.findSafeUtf8Boundary(end, true);
		if (safeStart >= safeEnd) return "";
		return this.decoder.decode(this.buffer.subarray(safeStart, safeEnd), { stream: false });
	}
	/**
	* Build Boyer-Moore-Horspool bad character table
	*/
	_buildBMHTable(pattern) {
		const table = new Uint8Array(256);
		const patternLength = pattern.length;
		table.fill(patternLength);
		for (let i = 0; i < patternLength - 1; i++) table[pattern[i]] = patternLength - 1 - i;
		return table;
	}
	/**
	* Pattern search using Boyer-Moore-Horspool algorithm
	* XML delimiters are all ASCII, so no UTF-8 boundary issues
	*/
	_findPatternBMH(pattern, startPos) {
		const patternBytes = new TextEncoder().encode(pattern);
		const patternLength = patternBytes.length;
		if (patternLength === 0) return -1;
		if (patternLength === 1) return this._findSingleByte(patternBytes[0], startPos);
		let skipTable = this.bmhCache.get(pattern);
		if (!skipTable) {
			skipTable = this._buildBMHTable(patternBytes);
			if (this.bmhCache.size > 20) this.bmhCache.clear();
			this.bmhCache.set(pattern, skipTable);
		}
		const start = startPos || this.position;
		const bufferEnd = this.bufferLength - patternLength;
		let pos = start;
		while (pos <= bufferEnd) {
			let i = patternLength - 1;
			while (i >= 0 && this.buffer[pos + i] === patternBytes[i]) i--;
			if (i < 0) return pos;
			pos += skipTable[this.buffer[pos + patternLength - 1]];
		}
		return -1;
	}
	/**
	* Single byte search (optimized)
	*/
	_findSingleByte(byte, startPos) {
		const start = startPos || this.position;
		const buffer = this.buffer;
		const end = this.bufferLength;
		const end4 = end - 3;
		let i = start;
		for (; i < end4; i += 4) {
			if (buffer[i] === byte) return i;
			if (buffer[i + 1] === byte) return i + 1;
			if (buffer[i + 2] === byte) return i + 2;
			if (buffer[i + 3] === byte) return i + 3;
		}
		for (; i < end; i++) if (buffer[i] === byte) return i;
		return -1;
	}
	_compileEntityDecoder() {
		if (!this.options.autoDecodeEntities) return (text) => text;
		if (this.options.addEntities && this.options.addEntities.length > 0) {
			const entityMap = { ...StaxXmlParser.DEFAULT_ENTITY_MAP };
			const patterns = [
				"lt",
				"gt",
				"quot",
				"apos"
			];
			for (const { entity, value } of this.options.addEntities) if (entity && value) {
				const key = entity.startsWith("&") && entity.endsWith(";") ? entity.slice(1, -1) : entity;
				entityMap[key] = value;
				patterns.push(key);
			}
			patterns.push("amp");
			const cacheKey = patterns.join(",");
			let regex = StaxXmlParser.ENTITY_REGEX_CACHE.get(cacheKey);
			if (!regex) {
				const pattern = patterns.sort((a, b) => b.length - a.length).map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
				regex = new RegExp(`&(${pattern});`, "g");
				StaxXmlParser.ENTITY_REGEX_CACHE.set(cacheKey, regex);
			}
			return (text) => {
				if (!text || text.indexOf("&") === -1) return text;
				regex.lastIndex = 0;
				return text.replace(regex, (_, entity) => entityMap[entity] || _);
			};
		}
		return (text) => {
			if (!text || text.indexOf("&") === -1) return text;
			StaxXmlParser.DEFAULT_ENTITY_REGEX.lastIndex = 0;
			return text.replace(StaxXmlParser.DEFAULT_ENTITY_REGEX, (_, entity) => StaxXmlParser.DEFAULT_ENTITY_MAP[entity] || _);
		};
	}
	_calculateOptimalBatchSize() {
		const MIN_BATCH = 1;
		const MAX_BATCH = this.options.batchSize || 10;
		if (this.bufferLength < 1024) return MIN_BATCH;
		if (this.bufferLength > 10240) return MAX_BATCH;
		if (this.eventQueue.length > 0) {
			if (this.eventQueue[this.eventQueue.length - 1]?.type === XmlEventType.CHARACTERS) return MIN_BATCH;
		}
		if (this.batchMetrics.eventCount > 100) {
			const avgSize = this.batchMetrics.avgEventSize;
			if (avgSize > 1e3) return MIN_BATCH;
			if (avgSize < 100) return MAX_BATCH;
		}
		return Math.min(MAX_BATCH, Math.max(MIN_BATCH, Math.floor(this.bufferLength / 1024)));
	}
	async nextBatch(size) {
		const batch = [];
		const targetSize = size || this._calculateOptimalBatchSize();
		const startTime = Date.now();
		const timeout = this.options.batchTimeout || 10;
		for (let i = 0; i < targetSize; i++) {
			if (Date.now() - startTime > timeout) break;
			const result = await this.next();
			if (result.done) break;
			batch.push(result.value);
		}
		return batch;
	}
	async *batchedIterator(batchSize) {
		while (!this.parserFinished || this.eventQueue.length > 0) {
			const targetSize = batchSize || this._calculateOptimalBatchSize();
			const batch = await this.nextBatch(targetSize);
			if (batch.length === 0) break;
			yield batch;
		}
	}
	_compactBufferIfNeeded() {
		if (!this.options.enableBufferCompaction) return;
		const maxSize = this.options.maxBufferSize || 64 * 1024;
		if (this.position > 8192 && this.bufferLength > 16384 || this.position > maxSize / 2 || this.bufferLength > maxSize && this.position > maxSize / 4) this._compactBuffer();
	}
	_compactBuffer() {
		if (this.position > 0 && this.position < this.bufferLength) {
			const safePos = this.findSafeUtf8Boundary(this.position, true);
			const remainingLength = this.bufferLength - safePos;
			if (remainingLength < safePos) {
				const newBuffer = new Uint8Array(this.buffer.length);
				newBuffer.set(this.buffer.subarray(safePos, this.bufferLength));
				this.buffer = newBuffer;
			} else this.buffer.copyWithin(0, safePos, this.bufferLength);
			this.bufferLength = remainingLength;
			this.position = this.position - safePos;
			if (this.bmhCache.size > 20) this.bmhCache.clear();
		}
	}
	async _startReading() {
		try {
			while (true) {
				const { done, value } = await this.reader.read();
				if (done) {
					this.isStreamEnded = true;
					this._parseBuffer();
					if (!this.parserFinished && this.elementStack.length > 0) this._addError(/* @__PURE__ */ new Error("Unexpected end of document. Not all elements were closed."));
					if (!this.parserFinished) {
						this._flushCharacters();
						this._addEvent({
							type: XmlEventType.END_DOCUMENT,
							name: void 0,
							localName: void 0,
							prefix: void 0,
							uri: void 0,
							attributes: void 0,
							attributesWithPrefix: void 0,
							value: void 0,
							error: void 0
						});
						this.parserFinished = true;
					}
					if (this.resolveNext && this.eventQueue.length === 0) {
						this.resolveNext({
							value: void 0,
							done: true
						});
						this.resolveNext = null;
					}
					break;
				}
				this._appendToBuffer(value);
				this._parseBuffer();
				this._compactBufferIfNeeded();
				this._updateBatchMetrics(value.length);
			}
		} catch (err) {
			this._addError(err);
			if (this.resolveNext) {
				this.resolveNext({
					value: void 0,
					done: true
				});
				this.resolveNext = null;
			}
		}
	}
	_updateBatchMetrics(bytesProcessed) {
		const eventsDelta = this.eventQueue.length;
		if (eventsDelta > 0) {
			this.batchMetrics.eventCount += eventsDelta;
			this.batchMetrics.avgEventSize = this.batchMetrics.avgEventSize * .9 + bytesProcessed / eventsDelta * .1;
		}
		this.batchMetrics.lastBatchTime = Date.now();
	}
	_parseBuffer() {
		while (this.position < this.bufferLength && !this.parserFinished) {
			const ltPos = this._findSingleByte(60, this.position);
			if (ltPos === -1) {
				if (this.isStreamEnded) {
					const remainingText = this._readBuffer();
					this.currentTextBuffer += remainingText;
					this._flushCharacters();
				}
				break;
			}
			if (ltPos > this.position) try {
				const textLength = ltPos - this.position;
				const text = this._readBuffer(textLength);
				this.currentTextBuffer += text;
			} catch (error) {
				if (!this.isStreamEnded) break;
				throw error;
			}
			this.position = ltPos;
			const nextByte = this.buffer[this.position + 1];
			const charType = this.getXmlCharType(nextByte);
			if (charType === 4) {
				this._flushCharacters();
				if (!this._parseEndTag()) break;
			} else if (charType === 6) if (this._matchesPattern("<!--")) {
				if (!this._parseComment()) break;
			} else if (this._matchesPattern("<![CDATA[")) {
				if (!this._parseCData()) break;
			} else {
				if (this.isStreamEnded) {
					this._addError(/* @__PURE__ */ new Error(`Malformed XML near position ${this.position}`));
					return;
				}
				break;
			}
			else if (charType === 7) {
				if (this._matchesPattern("<?xml")) {
					if (!this._parseXmlDeclaration()) break;
				} else if (this._matchesPattern("<?")) {
					if (!this._parseProcessingInstruction()) break;
				}
			} else {
				this._flushCharacters();
				if (!this._parseStartTag()) break;
			}
			this._compactBufferIfNeeded();
		}
	}
	_flushCharacters() {
		if (this.currentTextBuffer.length > 0) {
			const decodedText = this.entityDecoder(this.currentTextBuffer);
			if (decodedText.trim().length > 0) this._addEvent({
				type: XmlEventType.CHARACTERS,
				name: void 0,
				localName: void 0,
				prefix: void 0,
				uri: void 0,
				attributes: void 0,
				attributesWithPrefix: void 0,
				value: decodedText,
				error: void 0
			});
			this.currentTextBuffer = "";
		}
	}
	_clearBuffers() {
		this.bufferLength = 0;
		this.position = 0;
		this.currentTextBuffer = "";
		this.bmhCache.clear();
	}
	_addEvent(event) {
		this.eventQueue.push(event);
		if (this.resolveNext) {
			this.resolveNext(this._popNextEvent());
			this.resolveNext = null;
		}
	}
	_addError(err) {
		if (this.error === null) {
			this.error = err;
			this._addEvent({
				type: XmlEventType.ERROR,
				name: void 0,
				localName: void 0,
				prefix: void 0,
				uri: void 0,
				attributes: void 0,
				attributesWithPrefix: void 0,
				value: void 0,
				error: err
			});
			this.parserFinished = true;
			this._clearBuffers();
			if (this.reader) {
				this.reader.releaseLock();
				this.reader = null;
			}
		}
	}
	_popNextEvent() {
		if (this.eventQueue.length > 0) return {
			value: this.eventQueue.shift(),
			done: false
		};
		if (this.parserFinished) return {
			value: void 0,
			done: true
		};
		return null;
	}
	async next() {
		if (this.error) throw this.error;
		const nextEvent = this._popNextEvent();
		if (nextEvent) return nextEvent;
		if (this.parserFinished) return {
			value: void 0,
			done: true
		};
		return new Promise((resolve) => {
			this.resolveNext = resolve;
		});
	}
	[Symbol.asyncIterator]() {
		return this;
	}
	_appendToBuffer(newData) {
		const requiredSize = this.bufferLength + newData.length;
		if (requiredSize > this.buffer.length) {
			const newSize = Math.max(this.buffer.length * 2, requiredSize);
			const newBuffer = new Uint8Array(newSize);
			newBuffer.set(this.buffer.subarray(0, this.bufferLength));
			this.buffer = newBuffer;
		}
		this.buffer.set(newData, this.bufferLength);
		this.bufferLength += newData.length;
	}
	/**
	* UTF-8 safe buffer reading
	*/
	_readBuffer(length) {
		const originalPos = this.position;
		let endPos = length ? Math.min(this.position + length, this.bufferLength) : this.bufferLength;
		if (length && endPos < this.bufferLength) endPos = this.findSafeUtf8Boundary(endPos, true);
		const slice = this.buffer.subarray(this.position, endPos);
		try {
			const result = this.decoder.decode(slice, { stream: !this.isStreamEnded });
			this.position = endPos;
			return result;
		} catch (error) {
			if (!this.isStreamEnded && endPos === this.bufferLength) for (let i = 1; i <= 4 && endPos - i > this.position; i++) {
				const testEnd = this.findSafeUtf8Boundary(endPos - i, true);
				if (testEnd > this.position) try {
					const safeSlice = this.buffer.subarray(this.position, testEnd);
					const result = this.decoder.decode(safeSlice, { stream: true });
					this.position = testEnd;
					return result;
				} catch {
					continue;
				}
			}
			this.position = originalPos;
			throw error;
		}
	}
	_matchesPattern(pattern) {
		const patternBytes = new TextEncoder().encode(pattern);
		if (this.position + patternBytes.length > this.bufferLength) return false;
		for (let i = 0; i < patternBytes.length; i++) if (this.buffer[this.position + i] !== patternBytes[i]) return false;
		return true;
	}
	_parseXmlDeclaration() {
		const endPos = this._findPatternBMH("?>");
		if (endPos === -1) return false;
		this.position = endPos + 2;
		return true;
	}
	_parseComment() {
		const endPos = this._findPatternBMH("-->");
		if (endPos === -1) return false;
		this.position = endPos + 3;
		return true;
	}
	/**
	* UTF-8 safe CDATA parsing
	*/
	_parseCData() {
		const startPos = this.position + 9;
		const endPos = this._findPatternBMH("]]>");
		if (endPos === -1) return false;
		try {
			const safeStart = this.findSafeUtf8Boundary(startPos, false);
			const safeEnd = this.findSafeUtf8Boundary(endPos, true);
			const cdataContent = this.decoder.decode(this.buffer.subarray(safeStart, safeEnd), { stream: false });
			this._addEvent({
				type: XmlEventType.CDATA,
				name: void 0,
				localName: void 0,
				prefix: void 0,
				uri: void 0,
				attributes: void 0,
				attributesWithPrefix: void 0,
				value: cdataContent,
				error: void 0
			});
			this.position = endPos + 3;
			return true;
		} catch (error) {
			if (!this.isStreamEnded) return false;
			throw error;
		}
	}
	_parseProcessingInstruction() {
		const endPos = this._findPatternBMH("?>");
		if (endPos === -1) return false;
		this.position = endPos + 2;
		return true;
	}
	/**
	* UTF-8 safe end tag parsing
	*/
	_parseEndTag() {
		const gtPos = this._findSingleByte(62, this.position);
		if (gtPos === -1) return false;
		try {
			const closeTagMatch = this.safeDecodeRange(this.position, gtPos + 1).match(/^<\/([a-zA-Z0-9_:.\-\u0080-\uFFFF]+)\s*>$/);
			if (!closeTagMatch) {
				this._addError(/* @__PURE__ */ new Error("Malformed closing tag"));
				return true;
			}
			const tagName = closeTagMatch[1];
			if (this.elementStack.length === 0 || this.elementStack[this.elementStack.length - 1] !== tagName) {
				this._addError(/* @__PURE__ */ new Error(`Mismatched closing tag: </${tagName}>. Expected </${this.elementStack[this.elementStack.length - 1] || "nothing"}>`));
				return true;
			}
			const currentNamespaces = this.namespaceStack.length > 0 ? this.namespaceStack[this.namespaceStack.length - 1] : /* @__PURE__ */ new Map();
			const { localName, prefix, uri } = this._parseQualifiedName(tagName, currentNamespaces);
			this.elementStack.pop();
			this.namespaceStack.pop();
			this._addEvent({
				type: XmlEventType.END_ELEMENT,
				name: tagName,
				localName,
				prefix,
				uri,
				attributes: void 0,
				attributesWithPrefix: void 0,
				value: void 0,
				error: void 0
			});
			this.position = gtPos + 1;
			return true;
		} catch (error) {
			if (!this.isStreamEnded) return false;
			throw error;
		}
	}
	/**
	* UTF-8 safe start tag parsing (using ASCII table)
	*/
	_parseStartTag() {
		const gtPos = this._findSingleByte(62, this.position);
		if (gtPos === -1) return false;
		try {
			const tagMatch = this.safeDecodeRange(this.position, gtPos + 1).match(/^<([a-zA-Z0-9_:.\-\u0080-\uFFFF]+)(\s+[^>]*?)?\s*(\/?)>$/);
			if (!tagMatch) {
				this._addError(/* @__PURE__ */ new Error("Malformed start tag"));
				return true;
			}
			const tagName = tagMatch[1];
			const attributesString = tagMatch[2] || "";
			const isSelfClosing = tagMatch[3] === "/";
			const currentNamespaces = /* @__PURE__ */ new Map();
			if (this.namespaceStack.length > 0) {
				const parentNamespaces = this.namespaceStack[this.namespaceStack.length - 1];
				for (const [prefix$1, uri$1] of parentNamespaces) currentNamespaces.set(prefix$1, uri$1);
			}
			const attributes = {};
			const attributesWithPrefix = {};
			const attrRegex = /([a-zA-Z0-9_:.\-\u0080-\uFFFF]+)(?:\s*=\s*"([^"]*)"|\s*=\s*'([^']*)')?/g;
			let attrMatch;
			while ((attrMatch = attrRegex.exec(attributesString)) !== null) {
				const attrName = attrMatch[1];
				const attrValue = this.entityDecoder(attrMatch[2] || attrMatch[3] || "true");
				attributes[attrName] = attrValue;
				const attrNamespaceInfo = this._parseQualifiedName(attrName, currentNamespaces, true);
				attributesWithPrefix[attrNamespaceInfo.localName] = {
					value: attrValue,
					prefix: attrNamespaceInfo.prefix,
					uri: attrNamespaceInfo.uri
				};
				if (attrName === "xmlns") currentNamespaces.set("", attrValue);
				else if (attrName.startsWith("xmlns:")) {
					const prefix$1 = attrName.substring(6);
					currentNamespaces.set(prefix$1, attrValue);
				}
			}
			const { localName, prefix, uri } = this._parseQualifiedName(tagName, currentNamespaces);
			this._addEvent({
				type: XmlEventType.START_ELEMENT,
				name: tagName,
				localName,
				prefix,
				uri,
				attributes,
				attributesWithPrefix,
				value: void 0,
				error: void 0
			});
			this.position = gtPos + 1;
			if (!isSelfClosing) {
				this.elementStack.push(tagName);
				this.namespaceStack.push(currentNamespaces);
			} else this._addEvent({
				type: XmlEventType.END_ELEMENT,
				name: tagName,
				localName,
				prefix,
				uri,
				attributes: void 0,
				attributesWithPrefix: void 0,
				value: void 0,
				error: void 0
			});
			return true;
		} catch (error) {
			if (!this.isStreamEnded) return false;
			throw error;
		}
	}
	_parseQualifiedName(qname, namespaces, isAttribute = false) {
		const colonIndex = qname.indexOf(":");
		if (colonIndex === -1) if (isAttribute) return {
			localName: qname,
			prefix: void 0,
			uri: void 0
		};
		else {
			const defaultUri = namespaces.get("");
			return {
				localName: qname,
				prefix: void 0,
				uri: defaultUri
			};
		}
		else {
			const prefix = qname.substring(0, colonIndex);
			const localName = qname.substring(colonIndex + 1);
			const uri = namespaces.get(prefix);
			return {
				localName,
				prefix,
				uri
			};
		}
	}
	get XmlEventType() {
		return XmlEventType;
	}
};

//#endregion
//#region src/StaxXmlParserSync.ts
var StaxXmlParserSync = class StaxXmlParserSync {
	xml;
	xmlLength;
	pos = 0;
	elementStack = [];
	namespaceStack = [];
	options;
	internalIterator;
	static ASCII_TABLE = (() => {
		const table = new Uint8Array(128);
		table[9] = 1;
		table[10] = 1;
		table[13] = 1;
		table[32] = 1;
		table[60] = 2;
		table[62] = 3;
		table[47] = 4;
		table[61] = 5;
		table[33] = 6;
		table[63] = 7;
		table[34] = 8;
		table[39] = 9;
		return table;
	})();
	static UNICODE_WHITESPACE = new Set([
		160,
		5760,
		8192,
		8193,
		8194,
		8195,
		8196,
		8197,
		8198,
		8199,
		8200,
		8201,
		8202,
		8232,
		8233,
		8239,
		8287,
		12288,
		65279
	]);
	static ENTITY_REGEX_CACHE = /* @__PURE__ */ new Map();
	static DEFAULT_ENTITY_REGEX = /&(lt|gt|quot|apos|amp);/g;
	static DEFAULT_ENTITY_MAP = {
		"lt": "<",
		"gt": ">",
		"quot": "\"",
		"apos": "'",
		"amp": "&"
	};
	entityDecoder;
	constructor(xml, options = {}) {
		this.xml = xml;
		this.xmlLength = xml.length;
		this.options = {
			autoDecodeEntities: true,
			...options
		};
		this.namespaceStack.push(/* @__PURE__ */ new Map());
		this.entityDecoder = this.compileEntityDecoder();
	}
	static isWhitespace(code) {
		if (code < 128) return StaxXmlParserSync.ASCII_TABLE[code] === 1;
		return code <= 32 || StaxXmlParserSync.UNICODE_WHITESPACE.has(code);
	}
	static isHighSurrogate(code) {
		return code >= 55296 && code <= 56319;
	}
	static isLowSurrogate(code) {
		return code >= 56320 && code <= 57343;
	}
	findChar(targetCode, start = this.pos) {
		const xml = this.xml;
		const len = this.xmlLength;
		const len16 = len - 15;
		let i = start;
		for (; i < len16; i += 16) {
			if (xml.charCodeAt(i) === targetCode) return i;
			if (xml.charCodeAt(i + 1) === targetCode) return i + 1;
			if (xml.charCodeAt(i + 2) === targetCode) return i + 2;
			if (xml.charCodeAt(i + 3) === targetCode) return i + 3;
			if (xml.charCodeAt(i + 4) === targetCode) return i + 4;
			if (xml.charCodeAt(i + 5) === targetCode) return i + 5;
			if (xml.charCodeAt(i + 6) === targetCode) return i + 6;
			if (xml.charCodeAt(i + 7) === targetCode) return i + 7;
			if (xml.charCodeAt(i + 8) === targetCode) return i + 8;
			if (xml.charCodeAt(i + 9) === targetCode) return i + 9;
			if (xml.charCodeAt(i + 10) === targetCode) return i + 10;
			if (xml.charCodeAt(i + 11) === targetCode) return i + 11;
			if (xml.charCodeAt(i + 12) === targetCode) return i + 12;
			if (xml.charCodeAt(i + 13) === targetCode) return i + 13;
			if (xml.charCodeAt(i + 14) === targetCode) return i + 14;
			if (xml.charCodeAt(i + 15) === targetCode) return i + 15;
		}
		for (; i < len; i++) if (xml.charCodeAt(i) === targetCode) return i;
		return -1;
	}
	matchesAt(str, pos) {
		const len = str.length;
		if (pos + len > this.xmlLength) return false;
		for (let i = 0; i < len; i++) if (this.xml.charCodeAt(pos + i) !== str.charCodeAt(i)) return false;
		return true;
	}
	trimmedSlice(start, end) {
		const xml = this.xml;
		while (start < end && StaxXmlParserSync.isWhitespace(xml.charCodeAt(start))) if (StaxXmlParserSync.isHighSurrogate(xml.charCodeAt(start))) start += 2;
		else start++;
		while (end > start && StaxXmlParserSync.isWhitespace(xml.charCodeAt(end - 1))) if (end > start + 1 && StaxXmlParserSync.isLowSurrogate(xml.charCodeAt(end - 1)) && StaxXmlParserSync.isHighSurrogate(xml.charCodeAt(end - 2))) end -= 2;
		else end--;
		return start < end ? xml.slice(start, end) : "";
	}
	compileEntityDecoder() {
		if (!this.options.autoDecodeEntities) return (text) => text;
		if (this.options.addEntities && this.options.addEntities.length > 0) {
			const entityMap = { ...StaxXmlParserSync.DEFAULT_ENTITY_MAP };
			const patterns = [
				"lt",
				"gt",
				"quot",
				"apos"
			];
			for (const { entity, value } of this.options.addEntities) if (entity && value) {
				const key = entity.startsWith("&") && entity.endsWith(";") ? entity.slice(1, -1) : entity;
				entityMap[key] = value;
				patterns.push(key);
			}
			patterns.push("amp");
			const cacheKey = patterns.join(",");
			let regex = StaxXmlParserSync.ENTITY_REGEX_CACHE.get(cacheKey);
			if (!regex) {
				const pattern = patterns.sort((a, b) => b.length - a.length).map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
				regex = new RegExp(`&(${pattern});`, "g");
				StaxXmlParserSync.ENTITY_REGEX_CACHE.set(cacheKey, regex);
			}
			return (text) => {
				if (!text || text.indexOf("&") === -1) return text;
				regex.lastIndex = 0;
				return text.replace(regex, (_, entity) => entityMap[entity] || _);
			};
		}
		return (text) => {
			if (!text || text.indexOf("&") === -1) return text;
			StaxXmlParserSync.DEFAULT_ENTITY_REGEX.lastIndex = 0;
			return text.replace(StaxXmlParserSync.DEFAULT_ENTITY_REGEX, (_, entity) => StaxXmlParserSync.DEFAULT_ENTITY_MAP[entity] || _);
		};
	}
	/**
	* Symbol.iterator implementation - returns this instance as iterator
	* This ensures for...of and explicit next() calls use the same iterator state
	*/
	[Symbol.iterator]() {
		return this;
	}
	/**
	* Internal generator that actually yields AnyXmlEvent
	* Important: Return type is same as before - Iterator<AnyXmlEvent>
	* Factory internally creates UnifiedXmlEvent, but
	* types are returned as StartElementEvent, EndElementEvent etc. so
	* perfectly compatible with AnyXmlEvent union type
	*/
	*internalGenerator() {
		yield {
			type: XmlEventType.START_DOCUMENT,
			name: void 0,
			localName: void 0,
			prefix: void 0,
			uri: void 0,
			attributes: void 0,
			attributesWithPrefix: void 0,
			value: void 0,
			error: void 0
		};
		while (this.pos < this.xmlLength) {
			const ltPos = this.findChar(60, this.pos);
			if (ltPos === -1) {
				if (this.pos < this.xmlLength) {
					const text = this.trimmedSlice(this.pos, this.xmlLength);
					if (text) yield {
						type: XmlEventType.CHARACTERS,
						name: void 0,
						localName: void 0,
						prefix: void 0,
						uri: void 0,
						attributes: void 0,
						attributesWithPrefix: void 0,
						value: this.entityDecoder(text),
						error: void 0
					};
				}
				break;
			}
			if (ltPos > this.pos) {
				const text = this.trimmedSlice(this.pos, ltPos);
				if (text) yield {
					type: XmlEventType.CHARACTERS,
					name: void 0,
					localName: void 0,
					prefix: void 0,
					uri: void 0,
					attributes: void 0,
					attributesWithPrefix: void 0,
					value: this.entityDecoder(text),
					error: void 0
				};
			}
			this.pos = ltPos;
			switch (this.xml.charCodeAt(this.pos + 1)) {
				case 47:
					yield* this.parseEndTag();
					break;
				case 33:
					yield* this.parseCdataCommentDoctype();
					break;
				case 63:
					yield* this.parseProcessingInstruction();
					break;
				default:
					yield* this.parseStartTag();
					break;
			}
		}
		yield {
			type: XmlEventType.END_DOCUMENT,
			name: void 0,
			localName: void 0,
			prefix: void 0,
			uri: void 0,
			attributes: void 0,
			attributesWithPrefix: void 0,
			value: void 0,
			error: void 0
		};
	}
	next() {
		if (!this.internalIterator) this.internalIterator = this.internalGenerator();
		return this.internalIterator.next();
	}
	*parseEndTag() {
		const tagClose = this.findChar(62, this.pos);
		if (tagClose === -1) throw new Error("Unclosed end tag");
		const fullTagName = this.trimmedSlice(this.pos + 2, tagClose);
		if (this.elementStack.length === 0) throw new Error(`Mismatched closing tag: </${fullTagName}>. No open elements.`);
		const expectedTagName = this.elementStack[this.elementStack.length - 1];
		if (fullTagName !== expectedTagName) throw new Error(`Mismatched closing tag: </${fullTagName}>. Expected </${expectedTagName}>.`);
		this.elementStack.pop();
		const currentNamespaces = this.namespaceStack.pop();
		const colonIndex = fullTagName.indexOf(":");
		let localName, prefix, uri;
		if (colonIndex === -1) {
			localName = fullTagName;
			prefix = void 0;
			uri = currentNamespaces ? currentNamespaces.get("") : void 0;
		} else {
			prefix = fullTagName.slice(0, colonIndex);
			localName = fullTagName.slice(colonIndex + 1);
			uri = currentNamespaces ? currentNamespaces.get(prefix) : void 0;
		}
		yield {
			type: XmlEventType.END_ELEMENT,
			name: fullTagName,
			localName,
			prefix,
			uri,
			attributes: void 0,
			attributesWithPrefix: void 0,
			value: void 0,
			error: void 0
		};
		this.pos = tagClose + 1;
	}
	*parseCdataCommentDoctype() {
		if (this.matchesAt("<![CDATA[", this.pos)) {
			const cdataEnd = this.findSequence("]]>", this.pos + 9);
			if (cdataEnd === -1) throw new Error("Unclosed CDATA section");
			const cdataContent = this.xml.slice(this.pos + 9, cdataEnd);
			yield {
				type: XmlEventType.CDATA,
				name: void 0,
				localName: void 0,
				prefix: void 0,
				uri: void 0,
				attributes: void 0,
				attributesWithPrefix: void 0,
				value: cdataContent,
				error: void 0
			};
			this.pos = cdataEnd + 3;
		} else if (this.matchesAt("<!--", this.pos)) {
			const commentEnd = this.findSequence("-->", this.pos + 4);
			if (commentEnd === -1) throw new Error("Unclosed comment");
			this.pos = commentEnd + 3;
		} else if (this.matchesAt("<!DOCTYPE", this.pos)) {
			const doctypeEnd = this.findChar(62, this.pos);
			if (doctypeEnd === -1) throw new Error("Unclosed DOCTYPE declaration");
			this.pos = doctypeEnd + 1;
		}
	}
	*parseProcessingInstruction() {
		const piEnd = this.findSequence("?>", this.pos);
		if (piEnd === -1) throw new Error("Unclosed processing instruction");
		this.pos = piEnd + 2;
	}
	*parseStartTag() {
		const tagStart = this.pos + 1;
		const tagEnd = this.findTagEnd(tagStart);
		if (tagEnd === -1) throw new Error("Unclosed start tag");
		let isSelfClosing = false;
		let actualEnd = tagEnd;
		if (this.xml.charCodeAt(tagEnd - 1) === 47) {
			isSelfClosing = true;
			actualEnd = tagEnd - 1;
		}
		let nameEnd = tagStart;
		const xml = this.xml;
		while (nameEnd < actualEnd) {
			const code = xml.charCodeAt(nameEnd);
			if (code <= 32) {
				if (StaxXmlParserSync.isWhitespace(code)) break;
			} else if (code === 62 || code === 47) break;
			nameEnd++;
		}
		const tagName = xml.slice(tagStart, nameEnd);
		const currentNamespaces = /* @__PURE__ */ new Map();
		if (this.namespaceStack.length > 0) {
			const parentNamespaces = this.namespaceStack[this.namespaceStack.length - 1];
			for (const [prefix$1, uri$1] of parentNamespaces) currentNamespaces.set(prefix$1, uri$1);
		}
		const { attributes, attributesWithPrefix } = this.parseAttributesFast(nameEnd, actualEnd, currentNamespaces);
		const colonIndex = tagName.indexOf(":");
		let localName, prefix, uri;
		if (colonIndex === -1) {
			localName = tagName;
			prefix = void 0;
			uri = currentNamespaces.get("");
		} else {
			prefix = tagName.slice(0, colonIndex);
			localName = tagName.slice(colonIndex + 1);
			uri = currentNamespaces.get(prefix);
		}
		yield {
			type: XmlEventType.START_ELEMENT,
			name: tagName,
			localName,
			prefix,
			uri,
			attributes,
			attributesWithPrefix,
			value: void 0,
			error: void 0
		};
		this.elementStack.push(tagName);
		if (!isSelfClosing) this.namespaceStack.push(currentNamespaces);
		else {
			yield {
				type: XmlEventType.END_ELEMENT,
				name: tagName,
				localName,
				prefix,
				uri,
				attributes: void 0,
				attributesWithPrefix: void 0,
				value: void 0,
				error: void 0
			};
			this.elementStack.pop();
		}
		this.pos = tagEnd + 1;
	}
	parseAttributesFast(start, end, namespaces) {
		if (start >= end) return {
			attributes: {},
			attributesWithPrefix: {}
		};
		const attributes = {};
		const attributesWithPrefix = {};
		let i = start;
		const xml = this.xml;
		while (i < end) {
			while (i < end && StaxXmlParserSync.isWhitespace(xml.charCodeAt(i))) i++;
			if (i >= end) break;
			const nameStart = i;
			while (i < end) {
				const code = xml.charCodeAt(i);
				if (code === 61 || StaxXmlParserSync.isWhitespace(code)) break;
				i++;
			}
			if (i === nameStart) break;
			const attrName = xml.slice(nameStart, i);
			while (i < end && StaxXmlParserSync.isWhitespace(xml.charCodeAt(i))) i++;
			if (i >= end || xml.charCodeAt(i) !== 61) {
				attributes[attrName] = "true";
				const colonIndex$1 = attrName.indexOf(":");
				let localName$1, prefix$1, uri$1;
				if (colonIndex$1 === -1) {
					localName$1 = attrName;
					prefix$1 = void 0;
					uri$1 = void 0;
				} else {
					prefix$1 = attrName.slice(0, colonIndex$1);
					localName$1 = attrName.slice(colonIndex$1 + 1);
					uri$1 = namespaces.get(prefix$1);
				}
				attributesWithPrefix[attrName] = {
					value: "true",
					localName: localName$1,
					prefix: prefix$1,
					uri: uri$1
				};
				continue;
			}
			i++;
			while (i < end && StaxXmlParserSync.isWhitespace(xml.charCodeAt(i))) i++;
			if (i >= end) break;
			const quote = xml.charCodeAt(i);
			if (quote !== 34 && quote !== 39) break;
			i++;
			const valueStart = i;
			while (i < end && xml.charCodeAt(i) !== quote) i++;
			const rawValue = xml.slice(valueStart, i);
			const attrValue = this.entityDecoder(rawValue);
			attributes[attrName] = attrValue;
			if (attrName === "xmlns") namespaces.set("", attrValue);
			else if (attrName.startsWith("xmlns:")) namespaces.set(attrName.slice(6), attrValue);
			const colonIndex = attrName.indexOf(":");
			let localName, prefix, uri;
			if (colonIndex === -1) {
				localName = attrName;
				prefix = void 0;
				uri = void 0;
			} else {
				prefix = attrName.slice(0, colonIndex);
				localName = attrName.slice(colonIndex + 1);
				uri = namespaces.get(prefix);
			}
			if (attrName.startsWith("xmlns")) if (attrName === "xmlns") {
				localName = "xmlns";
				prefix = void 0;
			} else {
				localName = attrName.slice(6);
				prefix = "xmlns";
			}
			attributesWithPrefix[attrName] = {
				value: attrValue,
				localName,
				prefix,
				uri
			};
			i++;
		}
		return {
			attributes,
			attributesWithPrefix
		};
	}
	findTagEnd(start) {
		let i = start;
		let inQuote = false;
		let quoteChar = 0;
		while (i < this.xmlLength) {
			const code = this.xml.charCodeAt(i);
			if (code === 34 || code === 39) {
				if (!inQuote) {
					inQuote = true;
					quoteChar = code;
				} else if (code === quoteChar) {
					inQuote = false;
					quoteChar = 0;
				}
			} else if (code === 62 && !inQuote) return i;
			i++;
		}
		return -1;
	}
	findSequence(sequence, start) {
		const seqLen = sequence.length;
		const maxPos = this.xmlLength - seqLen;
		for (let i = start; i <= maxPos; i++) {
			let match = true;
			for (let j = 0; j < seqLen; j++) if (this.xml.charCodeAt(i + j) !== sequence.charCodeAt(j)) {
				match = false;
				break;
			}
			if (match) return i;
		}
		return -1;
	}
};

//#endregion
//#region src/converter/XPathEngine.ts
/**
* XPath compiler with caching
*
* @internal
*/
var XPathCompiler = class {
	static cache = /* @__PURE__ */ new Map();
	static MAX_CACHE_SIZE = 1e3;
	static compile(xpath) {
		const cached = this.cache.get(xpath);
		if (cached) return cached;
		this.validateXPath(xpath);
		const compiled = this.compileInternal(xpath);
		if (this.cache.size >= this.MAX_CACHE_SIZE) {
			const firstKey = this.cache.keys().next().value;
			if (firstKey !== void 0) this.cache.delete(firstKey);
		}
		this.cache.set(xpath, compiled);
		return compiled;
	}
	static validateXPath(xpath) {
		if (!xpath || xpath.length === 0) throw new Error("XPath cannot be empty");
		if (xpath.length > 1e3) throw new Error("XPath too long (max 1000 characters)");
		if (/[;<>{}\\]/.test(xpath)) throw new Error("Invalid characters in XPath");
	}
	static compileInternal(xpath) {
		const trimmed = xpath.trim();
		const isRelative = trimmed.startsWith("./") || trimmed === ".";
		const isAbsolute = !isRelative && trimmed.startsWith("/");
		const isDescendant = !isRelative && trimmed.startsWith("//");
		let path = trimmed;
		if (isRelative && trimmed.startsWith("./")) path = path.slice(2);
		else if (isRelative && trimmed === ".") path = "";
		else if (isDescendant) path = path.slice(2);
		else if (isAbsolute) path = path.slice(1);
		if (isDescendant && path.includes("//")) throw new Error("Nested descendant-or-self (//) is not supported. Use // only at the beginning of XPath expression, e.g., \"//element/path\"");
		const segments = [];
		const parts = path.split("/").filter((p) => p.length > 0);
		for (const part of parts) segments.push(this.compileSegment(part));
		return {
			segments,
			isAbsolute,
			isDescendant
		};
	}
	static compileSegment(segment) {
		if (segment.startsWith("@")) return {
			name: segment.slice(1).trim(),
			predicates: [],
			isWildcard: false,
			isAttribute: true,
			isTextNode: false
		};
		if (segment === "text()") return {
			name: "text()",
			predicates: [],
			isWildcard: false,
			isAttribute: false,
			isTextNode: true
		};
		const predicateMatch = segment.match(/^([^[]+)(\[.+\])?$/);
		if (!predicateMatch) throw new Error(`Invalid XPath segment: ${segment}`);
		const name = predicateMatch[1].trim();
		const isWildcard = name === "*";
		const predicates = [];
		if (predicateMatch[2]) {
			const predicateStr = predicateMatch[2];
			const attrMatchSingle = predicateStr.match(/\[@([^=]+)='([^']+)'\]/);
			const attrMatchDouble = predicateStr.match(/\[@([^=]+)="([^"]+)"\]/);
			const posMatch = predicateStr.match(/\[(\d+)\]/);
			const lastMatch = predicateStr.match(/\[last\(\)\]/);
			const firstMatch = predicateStr.match(/\[first\(\)\]/);
			const positionMatch = predicateStr.match(/\[position\(\)\s*=\s*(\d+)\]/);
			if (attrMatchSingle) predicates.push({
				type: "attribute",
				attribute: attrMatchSingle[1].trim(),
				value: attrMatchSingle[2]
			});
			else if (attrMatchDouble) predicates.push({
				type: "attribute",
				attribute: attrMatchDouble[1].trim(),
				value: attrMatchDouble[2]
			});
			else if (posMatch) predicates.push({
				type: "position",
				position: parseInt(posMatch[1], 10)
			});
			else if (lastMatch) predicates.push({
				type: "position",
				position: -1
			});
			else if (firstMatch) predicates.push({
				type: "position",
				position: 1
			});
			else if (positionMatch) predicates.push({
				type: "position",
				position: parseInt(positionMatch[1], 10)
			});
			else throw new Error(`Unsupported predicate: ${predicateStr}`);
		}
		return {
			name,
			predicates,
			isWildcard,
			isAttribute: false,
			isTextNode: false
		};
	}
	static clearCache() {
		this.cache.clear();
	}
};
/**
* XPath matcher using streaming evaluation
*
* @internal
*/
var XPathMatcher = class {
	currentPath = [];
	positionStack = [];
	compiled;
	elementStack = [];
	contextDepth;
	constructor(xpath, contextDepth) {
		this.compiled = XPathCompiler.compile(xpath);
		this.contextDepth = contextDepth;
	}
	onStartElement(event) {
		this.currentPath.push(event.name);
		this.elementStack.push(event);
		const depth = this.currentPath.length;
		if (this.positionStack.length < depth) this.positionStack.push(1);
		else this.positionStack[depth - 1]++;
	}
	onEndElement() {
		const depth = this.currentPath.length;
		this.currentPath.pop();
		this.elementStack.pop();
		if (this.positionStack.length > depth) this.positionStack.pop();
	}
	matches(event) {
		const { segments, isAbsolute, isDescendant } = this.compiled;
		const effectiveSegments = this.isAttributeSelector() || this.isTextNodeSelector() ? segments.slice(0, -1) : segments;
		if (effectiveSegments.length === 0) return !isAbsolute && !isDescendant;
		if (isDescendant) return this.matchesDescendant(event, effectiveSegments);
		else if (isAbsolute) return this.matchesAbsolute(event, effectiveSegments);
		else return this.matchesRelative(event, effectiveSegments);
	}
	/**
	* Check if XPath selects an attribute
	*/
	isAttributeSelector() {
		const { segments } = this.compiled;
		return segments.length > 0 && segments[segments.length - 1].isAttribute;
	}
	/**
	* Get attribute name if this is an attribute selector
	*/
	getAttributeName() {
		const { segments } = this.compiled;
		if (this.isAttributeSelector()) return segments[segments.length - 1].name;
	}
	/**
	* Check if XPath selects a text node
	*/
	isTextNodeSelector() {
		const { segments } = this.compiled;
		return segments.length > 0 && segments[segments.length - 1].isTextNode;
	}
	matchesDescendant(event, segments) {
		if (segments.length === 0) return false;
		const currentDepth = this.currentPath.length;
		for (let startDepth = 0; startDepth < currentDepth; startDepth++) if (this.matchesFromDepth(event, segments, startDepth)) return true;
		return false;
	}
	matchesAbsolute(event, segments) {
		return this.matchesFromDepth(event, segments, 0);
	}
	matchesRelative(event, segments) {
		const currentDepth = this.currentPath.length;
		if (this.contextDepth !== void 0) return this.matchesFromDepth(event, segments, this.contextDepth);
		for (let startDepth = 0; startDepth < currentDepth; startDepth++) if (this.matchesFromDepth(event, segments, startDepth)) return true;
		return false;
	}
	matchesFromDepth(event, segments, startDepth) {
		if (this.currentPath.length - startDepth !== segments.length) return false;
		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i];
			const pathElement = this.currentPath[startDepth + i];
			if (!segment.isWildcard && segment.name !== pathElement) return false;
			for (const predicate of segment.predicates) {
				const elementIndex = startDepth + i;
				const elementForPredicate = this.elementStack[elementIndex] || event;
				if (!this.matchesPredicate(predicate, elementForPredicate, elementIndex)) return false;
			}
		}
		return true;
	}
	matchesPredicate(predicate, event, depth) {
		if (predicate.type === "attribute") return event.attributes[predicate.attribute] === predicate.value;
		else if (predicate.type === "position") {
			const position = this.positionStack[depth] || 1;
			if (predicate.position === -1) return false;
			return position === predicate.position;
		}
		return false;
	}
	reset() {
		this.currentPath = [];
		this.positionStack = [];
		this.elementStack = [];
	}
};

//#endregion
//#region src/converter/XmlParsingStateMachine.ts
/**
* Internal state machine for event-based XML parsing
* Processes events and fills collectors without type awareness
*
* @internal
*/
var XmlParsingStateMachine = class {
	activeSchemas = [];
	currentDepth = 0;
	eventCount = 0;
	maxDepth;
	maxEvents;
	constructor(options = {}) {
		this.options = options;
		this.maxDepth = options.maxDepth ?? 1e3;
		this.maxEvents = options.maxEvents ?? 1e6;
	}
	/**
	* Register a schema for event-based activation
	*/
	registerSchema(schema, xpath, collector, context, fieldName) {
		const activation = {
			schema,
			xpath,
			matcher: new XPathMatcher(xpath),
			depth: -1,
			collector,
			context,
			fieldName
		};
		this.activeSchemas.push(activation);
		return activation;
	}
	/**
	* Process events synchronously
	*/
	processEventSync(event) {
		this.checkLimits();
		if (isStartElement(event)) {
			this.currentDepth++;
			for (const activation of this.activeSchemas) {
				activation.matcher.onStartElement(event);
				if (!(!activation.context || this.currentDepth > activation.context.contextDepth)) continue;
				const unwrappedSchema = this.unwrapSchema(activation.schema);
				const isArray = isArraySchema(unwrappedSchema);
				const matches = this.matchesInContext(event, activation);
				if (isArray ? activation.depth === -1 && matches : activation.depth === -1 && matches) {
					activation.depth = this.currentDepth;
					this.onSchemaActivatedSync(activation, event);
				} else if (isArray && activation.depth !== -1 && matches) this.createArrayItemSync(activation, event);
			}
		} else if (isEndElement(event)) {
			for (const activation of [...this.activeSchemas]) {
				if (activation.depth === this.currentDepth) {
					this.onSchemaDeactivatedSync(activation);
					if (activation.depth !== -2) activation.depth = -1;
				}
				activation.matcher.onEndElement();
			}
			this.currentDepth--;
		} else if (isCharacters(event) || isCdata(event)) {
			for (const activation of this.activeSchemas) if (activation.depth !== -1 && activation.depth <= this.currentDepth) this.onSchemaCollectText(activation, event.value);
		}
		this.eventCount++;
	}
	/**
	* Process events asynchronously
	*/
	async processEvent(event) {
		this.checkLimits();
		if (isStartElement(event)) {
			this.currentDepth++;
			for (const activation of this.activeSchemas) {
				activation.matcher.onStartElement(event);
				if (!(!activation.context || this.currentDepth > activation.context.contextDepth)) continue;
				const unwrappedSchema = this.unwrapSchema(activation.schema);
				const isArray = isArraySchema(unwrappedSchema);
				const matches = this.matchesInContext(event, activation);
				if (isArray ? activation.depth === -1 && matches : activation.depth === -1 && matches) {
					activation.depth = this.currentDepth;
					await this.onSchemaActivated(activation, event);
				} else if (isArray && activation.depth !== -1 && matches) await this.createArrayItemAsync(activation, event);
			}
		} else if (isEndElement(event)) {
			for (const activation of [...this.activeSchemas]) {
				if (activation.depth === this.currentDepth) {
					await this.onSchemaDeactivated(activation);
					if (activation.depth !== -2) activation.depth = -1;
				}
				activation.matcher.onEndElement();
			}
			this.currentDepth--;
		} else if (isCharacters(event) || isCdata(event)) {
			for (const activation of this.activeSchemas) if (activation.depth !== -1 && activation.depth <= this.currentDepth) this.onSchemaCollectText(activation, event.value);
		}
		this.eventCount++;
	}
	/**
	* Alias for processEvent (async)
	*/
	async processEventAsync(event) {
		return this.processEvent(event);
	}
	/**
	* Unwrap Transform and Optional wrappers to get core schema
	*/
	unwrapSchema(schema) {
		let unwrapped = schema;
		while (isTransformSchema(unwrapped) || isOptionalSchema(unwrapped)) unwrapped = unwrapped.schema;
		return unwrapped;
	}
	/**
	* Check if event matches activation's XPath within its context
	*/
	matchesInContext(event, activation) {
		const xpath = activation.xpath;
		const context = activation.context;
		if (!context) return activation.matcher.matches(event);
		if (xpath.startsWith("./")) {
			const relativePath = xpath.slice(2);
			if (relativePath.startsWith("@")) return this.currentDepth === context.contextDepth && activation.matcher.matches(event);
			const pathSegments = relativePath.split("/").filter((s) => s.length > 0);
			if (pathSegments.length >= 2 && pathSegments[pathSegments.length - 1].startsWith("@")) {
				const expectedDepth$1 = context.contextDepth + (pathSegments.length - 1);
				if (this.currentDepth !== expectedDepth$1) return false;
				const elementName$1 = pathSegments[pathSegments.length - 2].split("[")[0];
				return event.name === elementName$1 && activation.matcher.matches(event);
			}
			if (pathSegments.length >= 2 && pathSegments[pathSegments.length - 1] === "text()") {
				const expectedDepth$1 = context.contextDepth + (pathSegments.length - 1);
				if (this.currentDepth !== expectedDepth$1) return false;
				const elementName$1 = pathSegments[pathSegments.length - 2].split("[")[0];
				return event.name === elementName$1 && activation.matcher.matches(event);
			}
			const expectedDepth = context.contextDepth + pathSegments.length;
			if (this.currentDepth !== expectedDepth) return false;
			const elementName = pathSegments[pathSegments.length - 1].split("[")[0];
			return event.name === elementName && activation.matcher.matches(event);
		}
		if (xpath.startsWith("//")) return this.currentDepth > context.contextDepth && activation.matcher.matches(event);
		return activation.matcher.matches(event);
	}
	/**
	* Create a new array item for an already-active array schema (sync)
	* @internal
	*/
	createArrayItemSync(activation, event) {
		if (activation.collector.type !== "array") return;
		const arrayCollector = activation.collector;
		const unwrappedArraySchema = this.unwrapSchema(activation.schema);
		if (!isArraySchema(unwrappedArraySchema)) return;
		const elementSchema = unwrappedArraySchema.element;
		const unwrappedElement = this.unwrapSchema(elementSchema);
		if (isObjectSchema(unwrappedElement)) {
			const itemCollector = {
				type: "object",
				fields: /* @__PURE__ */ new Map()
			};
			const itemContext = {
				contextElement: event,
				contextDepth: this.currentDepth,
				parentContext: activation.context,
				contextXPath: activation.xpath
			};
			const shape = unwrappedElement.shape;
			for (const [fieldName, fieldSchema] of Object.entries(shape)) {
				const xpath = this.extractXPath(fieldSchema);
				if (!xpath) continue;
				const childCollector = this.createCollectorForSchema(fieldSchema);
				const activation$1 = this.registerSchema(fieldSchema, xpath, childCollector, itemContext, fieldName);
				activation$1.isTemporary = true;
				activation$1.parentCollector = itemCollector;
				itemCollector.fields.set(fieldName, childCollector);
				if (xpath.startsWith("./@") || xpath.startsWith("@")) {
					const relativePath = xpath.startsWith("./@") ? xpath.slice(3) : xpath.slice(1);
					if (event.attributes && relativePath in event.attributes) {
						const attrValue = event.attributes[relativePath];
						if (childCollector.type === "string") childCollector.value = attrValue;
						else if (childCollector.type === "number") childCollector.value = parseFloat(attrValue);
					}
				} else if (xpath === "./text()" || xpath === "text()") {
					activation$1.depth = this.currentDepth;
					if (childCollector.type === "string" || childCollector.type === "number") childCollector.buffer = "";
				}
			}
			arrayCollector.currentItem = itemCollector;
		} else if (isArraySchema(unwrappedElement)) {
			const itemCollector = {
				type: "array",
				items: []
			};
			const nestedContext = {
				contextElement: event,
				contextDepth: this.currentDepth,
				parentContext: activation.context,
				contextXPath: activation.xpath
			};
			const nestedXPath = unwrappedElement.xpath;
			if (nestedXPath) {
				const nestedActivation = this.registerSchema(elementSchema, nestedXPath, itemCollector, nestedContext, void 0);
				nestedActivation.isTemporary = true;
				nestedActivation.parentCollector = itemCollector;
			}
			arrayCollector.currentItem = itemCollector;
		} else arrayCollector.currentItem = {
			depth: this.currentDepth,
			buffer: ""
		};
	}
	/**
	* Create a new array item for an already-active array schema (async)
	* @internal
	*/
	async createArrayItemAsync(activation, event) {
		this.createArrayItemSync(activation, event);
	}
	/**
	* Schema activated (sync)
	*/
	onSchemaActivatedSync(activation, event) {
		if (activation.matcher.isAttributeSelector()) {
			const attrName = activation.matcher.getAttributeName();
			if (attrName && event.attributes && attrName in event.attributes) {
				const value = event.attributes[attrName];
				if (activation.collector.type === "array") {
					const unwrappedSchema$1 = this.unwrapSchema(activation.schema);
					if (isArraySchema(unwrappedSchema$1)) {
						const unwrappedElement = this.unwrapSchema(unwrappedSchema$1.element);
						if (isNumberSchema(unwrappedElement) && unwrappedElement._parseText) activation.collector.items.push(unwrappedElement._parseText(value));
						else activation.collector.items.push(value);
					} else activation.collector.items.push(value);
				} else if (activation.collector.type === "string") activation.collector.value = value;
				else if (activation.collector.type === "number" && activation.schema._parseText) activation.collector.value = activation.schema._parseText(value);
				activation.depth = -1;
				return;
			}
		}
		const unwrappedSchema = this.unwrapSchema(activation.schema);
		if (isArraySchema(unwrappedSchema)) {
			this.createArrayItemSync(activation, event);
			return;
		}
		if (activation.matcher.isTextNodeSelector()) {
			if (activation.collector.type === "string" || activation.collector.type === "number") activation.collector.buffer = "";
			return;
		}
		if (isStringSchema(unwrappedSchema) || isNumberSchema(unwrappedSchema)) {
			if (activation.collector.type === "string" || activation.collector.type === "number") activation.collector.buffer = "";
		} else if (isObjectSchema(unwrappedSchema)) {
			if (activation.collector.type !== "object") return;
			const objectCollector = activation.collector;
			const shape = unwrappedSchema.shape;
			const objectContext = {
				contextElement: event,
				contextDepth: this.currentDepth,
				parentContext: activation.context,
				contextXPath: activation.xpath
			};
			for (const [fieldName, fieldSchema] of Object.entries(shape)) {
				const xpath = this.extractXPath(fieldSchema);
				if (!xpath) continue;
				const childCollector = this.createCollectorForSchema(fieldSchema);
				this.registerSchema(fieldSchema, xpath, childCollector, objectContext, fieldName);
				objectCollector.fields.set(fieldName, childCollector);
				if (xpath.startsWith("./@") || xpath.startsWith("@")) {
					const relativePath = xpath.startsWith("./@") ? xpath.slice(3) : xpath.slice(1);
					if (event.attributes && relativePath in event.attributes) {
						const attrValue = event.attributes[relativePath];
						if (childCollector.type === "string") childCollector.value = attrValue;
						else if (childCollector.type === "number" && fieldSchema._parseText) childCollector.value = fieldSchema._parseText(attrValue);
					}
				}
			}
		}
	}
	/**
	* Schema activated (async)
	*/
	async onSchemaActivated(activation, event) {
		this.onSchemaActivatedSync(activation, event);
	}
	/**
	* Schema deactivated (sync)
	*/
	onSchemaDeactivatedSync(activation) {
		const unwrappedSchema = this.unwrapSchema(activation.schema);
		if (activation.matcher.isTextNodeSelector()) {
			if (isStringSchema(unwrappedSchema)) {
				if (activation.collector.type !== "string") return;
				const stringCollector = activation.collector;
				stringCollector.value = stringCollector.buffer.trim();
				activation.depth = -2;
				return;
			} else if (isNumberSchema(unwrappedSchema)) {
				if (activation.collector.type !== "number") return;
				const numberCollector = activation.collector;
				const text = numberCollector.buffer.trim();
				if (unwrappedSchema._parseText) numberCollector.value = unwrappedSchema._parseText(text);
				activation.depth = -2;
				return;
			}
		}
		if (isStringSchema(unwrappedSchema)) {
			if (activation.collector.type !== "string") return;
			const stringCollector = activation.collector;
			stringCollector.value = stringCollector.buffer.trim();
			activation.depth = -2;
			return;
		} else if (isNumberSchema(unwrappedSchema)) {
			if (activation.collector.type !== "number") return;
			const numberCollector = activation.collector;
			const text = numberCollector.buffer.trim();
			if (unwrappedSchema._parseText) numberCollector.value = unwrappedSchema._parseText(text);
			activation.depth = -2;
			return;
		} else if (isArraySchema(unwrappedSchema)) {
			if (activation.collector.type !== "array") return;
			const arrayCollector = activation.collector;
			if (arrayCollector.currentItem) {
				const elementSchema = unwrappedSchema.element;
				const unwrappedElement = this.unwrapSchema(elementSchema);
				if (isObjectSchema(unwrappedElement) && typeof arrayCollector.currentItem === "object" && "fields" in arrayCollector.currentItem) {
					const itemObject = this.extractObjectFromCollector(arrayCollector.currentItem, elementSchema);
					arrayCollector.items.push(itemObject);
				} else if (isArraySchema(unwrappedElement) && typeof arrayCollector.currentItem === "object" && "items" in arrayCollector.currentItem) arrayCollector.items.push(arrayCollector.currentItem.items);
				else if ("buffer" in arrayCollector.currentItem) {
					const text = arrayCollector.currentItem.buffer.trim();
					let value = text;
					if (isNumberSchema(unwrappedElement) && unwrappedElement._parseText) value = unwrappedElement._parseText(text);
					const transforms = this.getAllTransforms(elementSchema);
					for (const transformFn of transforms) value = transformFn(value);
					arrayCollector.items.push(value);
				}
				this.activeSchemas = this.activeSchemas.filter((a) => !(a.isTemporary && a.parentCollector === arrayCollector.currentItem));
				arrayCollector.currentItem = void 0;
			}
		} else if (isObjectSchema(unwrappedSchema)) {
			activation.depth = -2;
			return;
		}
	}
	/**
	* Schema deactivated (async)
	*/
	async onSchemaDeactivated(activation) {
		this.onSchemaDeactivatedSync(activation);
	}
	/**
	* Collect text content for active schema
	*/
	onSchemaCollectText(activation, text) {
		const collector = activation.collector;
		if (activation.matcher.isTextNodeSelector()) {
			if (this.currentDepth === activation.depth) {
				if (collector.type === "string" || collector.type === "number") collector.buffer += text;
				else if (collector.type === "array") {
					if (collector.currentItem && "buffer" in collector.currentItem) collector.currentItem.buffer += text;
				}
			}
			return;
		}
		if (collector.type === "string" || collector.type === "number") collector.buffer += text;
		else if (collector.type === "array") {
			if (collector.currentItem && "buffer" in collector.currentItem) collector.currentItem.buffer += text;
		}
	}
	/**
	* Check depth and event limits
	*/
	checkLimits() {
		if (this.currentDepth > this.maxDepth) throw new Error(`XML depth limit exceeded: ${this.maxDepth}`);
		if (this.eventCount > this.maxEvents) throw new Error(`XML event limit exceeded: ${this.maxEvents}`);
	}
	/**
	* Reset state for reuse
	*/
	reset() {
		this.activeSchemas = [];
		this.currentDepth = 0;
		this.eventCount = 0;
	}
	/**
	* Extract XPath from a schema (handles wrappers and different schema types)
	* @internal
	*/
	extractXPath(schema) {
		const unwrapped = this.unwrapSchema(schema);
		if (isArraySchema(unwrapped)) return unwrapped.xpath;
		if (isStringSchema(unwrapped) || isNumberSchema(unwrapped)) return unwrapped.options.xpath;
		if (isObjectSchema(unwrapped)) return unwrapped.options.xpath;
	}
	/**
	* Create appropriate collector for a schema type
	* @internal
	*/
	createCollectorForSchema(schema) {
		const unwrapped = this.unwrapSchema(schema);
		if (isStringSchema(unwrapped)) return {
			type: "string",
			buffer: ""
		};
		else if (isNumberSchema(unwrapped)) return {
			type: "number",
			buffer: ""
		};
		else if (isArraySchema(unwrapped)) return {
			type: "array",
			items: []
		};
		else if (isObjectSchema(unwrapped)) return {
			type: "object",
			fields: /* @__PURE__ */ new Map()
		};
		return {
			type: "string",
			buffer: ""
		};
	}
	/**
	* Extract object from ObjectCollector
	* @internal
	*/
	extractObjectFromCollector(collector, schema) {
		let result = {};
		const unwrappedSchema = this.unwrapSchema(schema);
		if (!isObjectSchema(unwrappedSchema)) return result;
		const shape = unwrappedSchema.shape;
		for (const [fieldName, fieldCollector] of collector.fields) {
			const fieldSchema = shape[fieldName];
			if (fieldSchema) result[fieldName] = this.extractValueWithTransforms(fieldCollector, fieldSchema);
		}
		const transforms = this.getAllTransforms(schema);
		for (const transformFn of transforms) result = transformFn(result);
		return result;
	}
	/**
	* Get all transform functions from schema chain
	* @internal
	*/
	getAllTransforms(schema) {
		const transforms = [];
		let current = schema;
		while (isTransformSchema(current) || isOptionalSchema(current)) if (isTransformSchema(current)) {
			if (current.transformFn) transforms.unshift(current.transformFn);
			current = current.schema;
		} else if (isOptionalSchema(current)) current = current.schema;
		return transforms;
	}
	/**
	* Extract value with field-level transforms
	* @internal
	*/
	extractValueWithTransforms(collector, schema) {
		const schemaIsOptional = this.hasOptionalWrapper(schema);
		let value = this.extractSimpleValue(collector, schemaIsOptional);
		const transforms = this.getAllTransforms(schema);
		for (const transformFn of transforms) value = transformFn(value);
		return value;
	}
	/**
	* Extract simple value from collector (without transforms)
	* @internal
	*/
	extractSimpleValue(collector, isOptional = false) {
		if (collector.type === "string") {
			let stringValue = collector.value ?? "";
			if (stringValue === "" && collector.buffer && collector.buffer.trim() !== "") stringValue = collector.buffer.trim();
			if (isOptional && stringValue === "") return;
			return stringValue;
		} else if (collector.type === "number") {
			if ((collector.value === void 0 || isNaN(collector.value)) && collector.buffer && collector.buffer.trim() !== "") return parseFloat(collector.buffer.trim());
			return collector.value ?? NaN;
		} else if (collector.type === "array") return collector.items;
		else if (collector.type === "object") {
			const result = {};
			for (const [key, childCollector] of collector.fields) result[key] = this.extractSimpleValue(childCollector, false);
			return result;
		}
	}
	/**
	* Check if schema chain contains XmlOptionalSchema
	* @internal
	*/
	hasOptionalWrapper(schema) {
		let current = schema;
		while (isOptionalSchema(current) || isTransformSchema(current)) {
			if (isOptionalSchema(current)) return true;
			if (isTransformSchema(current)) current = current.schema;
		}
		return false;
	}
};

//#endregion
//#region src/converter/XmlParserInternal.ts
/**
* Internal parser implementation
* Handles both sync and async parsing with XPath support
*
* @internal
*/
var XmlParserInternal = class {
	options;
	constructor(options) {
		this.options = options;
	}
	/**
	* Parse string value asynchronously
	*/
	async parseStringAsync(input, schemaOptions) {
		const xpath = schemaOptions.xpath;
		if (!xpath) {
			const parser$1 = this.createParser(input);
			for await (const event of parser$1) if (isCharacters(event) || isCdata(event)) return this.decodeText(event.value);
			return "";
		}
		const parser = this.createParser(input);
		const stateMachine = new XmlParsingStateMachine(this.options);
		const collector = {
			type: "string",
			buffer: ""
		};
		stateMachine.registerSchema({
			schemaType: "STRING",
			constructor: { name: "XmlStringSchema" }
		}, xpath, collector);
		for await (const event of parser) await stateMachine.processEvent(event);
		return this.decodeText(collector.value ?? "");
	}
	/**
	* Parse string value synchronously
	*/
	parseString(input, schemaOptions) {
		const xpath = schemaOptions.xpath;
		const parser = new StaxXmlParserSync(input, { autoDecodeEntities: this.options?.decodeEntities });
		if (!xpath) {
			for (const event of parser) if (isCharacters(event) || isCdata(event)) return this.decodeText(event.value);
			return "";
		}
		const stateMachine = new XmlParsingStateMachine(this.options);
		const collector = {
			type: "string",
			buffer: ""
		};
		stateMachine.registerSchema({
			schemaType: "STRING",
			constructor: { name: "XmlStringSchema" }
		}, xpath, collector);
		for (const event of parser) stateMachine.processEventSync(event);
		return this.decodeText(collector.value ?? "");
	}
	/**
	* Parse object asynchronously
	*/
	async parseObjectAsync(input, shape, schemaOptions) {
		const parser = this.createParser(input);
		const stateMachine = new XmlParsingStateMachine(this.options);
		const collectors = /* @__PURE__ */ new Map();
		const fieldSchemas = /* @__PURE__ */ new Map();
		for (const [fieldName, fieldSchema] of Object.entries(shape)) {
			const xpath = this.extractXPath(fieldSchema);
			const unwrapped = this.unwrapSchema(fieldSchema);
			const schemaType = unwrapped?.constructor?.name;
			if (!xpath && schemaType === "XmlObjectSchema") {
				const objectCollector = {
					type: "object",
					fields: /* @__PURE__ */ new Map()
				};
				const objectShape = unwrapped.shape;
				for (const [childFieldName, childFieldSchema] of Object.entries(objectShape)) {
					const childXPath = this.extractXPath(childFieldSchema);
					if (!childXPath) continue;
					const childCollector = this.createCollectorForSchema(childFieldSchema);
					stateMachine.registerSchema(childFieldSchema, childXPath, childCollector, void 0, childFieldName);
					objectCollector.fields.set(childFieldName, childCollector);
				}
				collectors.set(fieldName, objectCollector);
				fieldSchemas.set(fieldName, fieldSchema);
				continue;
			}
			if (!xpath && schemaType === "XmlArraySchema") {
				const elementSchema = unwrapped.element;
				if (elementSchema) {
					const elementXPath = this.extractXPath(elementSchema);
					if (elementXPath) {
						const collector$1 = {
							type: "array",
							items: []
						};
						stateMachine.registerSchema(fieldSchema, elementXPath, collector$1, void 0, fieldName);
						collectors.set(fieldName, collector$1);
						fieldSchemas.set(fieldName, fieldSchema);
						continue;
					}
				}
			}
			if (!xpath) continue;
			let collector;
			if (schemaType === "XmlArraySchema") collector = {
				type: "array",
				items: []
			};
			else if (schemaType === "XmlStringSchema") collector = {
				type: "string",
				buffer: ""
			};
			else if (schemaType === "XmlNumberSchema") collector = {
				type: "number",
				buffer: ""
			};
			else if (schemaType === "XmlObjectSchema") collector = {
				type: "object",
				fields: /* @__PURE__ */ new Map()
			};
			else collector = {
				type: "string",
				buffer: ""
			};
			stateMachine.registerSchema(fieldSchema, xpath, collector, void 0, fieldName);
			collectors.set(fieldName, collector);
			fieldSchemas.set(fieldName, fieldSchema);
		}
		for await (const event of parser) await stateMachine.processEvent(event);
		const result = {};
		for (const [fieldName, collector] of collectors) {
			const fieldSchema = fieldSchemas.get(fieldName);
			result[fieldName] = this.extractValueFromCollector(collector, fieldSchema);
		}
		return result;
	}
	/**
	* Parse object synchronously
	*/
	parseObject(input, shape, schemaOptions) {
		const parser = new StaxXmlParserSync(input, { autoDecodeEntities: this.options?.decodeEntities });
		const stateMachine = new XmlParsingStateMachine(this.options);
		const collectors = /* @__PURE__ */ new Map();
		const fieldSchemas = /* @__PURE__ */ new Map();
		for (const [fieldName, fieldSchema] of Object.entries(shape)) {
			const xpath = this.extractXPath(fieldSchema);
			const unwrapped = this.unwrapSchema(fieldSchema);
			const schemaType = unwrapped?.constructor?.name;
			if (!xpath && schemaType === "XmlObjectSchema") {
				const objectCollector = {
					type: "object",
					fields: /* @__PURE__ */ new Map()
				};
				const objectShape = unwrapped.shape;
				for (const [childFieldName, childFieldSchema] of Object.entries(objectShape)) {
					const childXPath = this.extractXPath(childFieldSchema);
					if (!childXPath) continue;
					const childCollector = this.createCollectorForSchema(childFieldSchema);
					stateMachine.registerSchema(childFieldSchema, childXPath, childCollector, void 0, childFieldName);
					objectCollector.fields.set(childFieldName, childCollector);
				}
				collectors.set(fieldName, objectCollector);
				fieldSchemas.set(fieldName, fieldSchema);
				continue;
			}
			if (!xpath && schemaType === "XmlArraySchema") {
				const elementSchema = unwrapped.element;
				if (elementSchema) {
					const elementXPath = this.extractXPath(elementSchema);
					if (elementXPath) {
						const collector$1 = {
							type: "array",
							items: []
						};
						stateMachine.registerSchema(fieldSchema, elementXPath, collector$1, void 0, fieldName);
						collectors.set(fieldName, collector$1);
						fieldSchemas.set(fieldName, fieldSchema);
						continue;
					}
				}
			}
			if (!xpath) continue;
			let collector;
			if (schemaType === "XmlArraySchema") collector = {
				type: "array",
				items: []
			};
			else if (schemaType === "XmlStringSchema") collector = {
				type: "string",
				buffer: ""
			};
			else if (schemaType === "XmlNumberSchema") collector = {
				type: "number",
				buffer: ""
			};
			else if (schemaType === "XmlObjectSchema") collector = {
				type: "object",
				fields: /* @__PURE__ */ new Map()
			};
			else collector = {
				type: "string",
				buffer: ""
			};
			stateMachine.registerSchema(fieldSchema, xpath, collector, void 0, fieldName);
			collectors.set(fieldName, collector);
			fieldSchemas.set(fieldName, fieldSchema);
		}
		for (const event of parser) stateMachine.processEventSync(event);
		const result = {};
		for (const [fieldName, collector] of collectors) {
			const fieldSchema = fieldSchemas.get(fieldName);
			result[fieldName] = this.extractValueFromCollector(collector, fieldSchema);
		}
		return result;
	}
	/**
	* Parse object from current iterator position (sync)
	* Used for recursive parsing without restarting the stream
	*/
	parseObjectFromPositionSync(iterator, startEvent, startDepth, shape, schemaOptions, stateMachine, parentContext) {
		const sm = stateMachine || new XmlParsingStateMachine(this.options);
		const rootCollector = parentContext?.collector && parentContext.collector.type === "object" ? parentContext.collector : {
			type: "object",
			fields: /* @__PURE__ */ new Map()
		};
		if (rootCollector.fields.size === 0) for (const [fieldName, fieldSchema] of Object.entries(shape)) {
			const xpath = this.extractXPath(fieldSchema);
			if (!xpath) continue;
			const childCollector = this.createCollectorForSchema(fieldSchema);
			sm.registerSchema(fieldSchema, xpath, childCollector, parentContext?.context, fieldName);
			rootCollector.fields.set(fieldName, childCollector);
		}
		sm.processEventSync(startEvent);
		let currentDepth = startDepth;
		let iterResult = iterator.next();
		while (!iterResult.done && currentDepth >= startDepth) {
			const event = iterResult.value;
			sm.processEventSync(event);
			if (isStartElement(event)) currentDepth++;
			else if (isEndElement(event)) {
				currentDepth--;
				if (currentDepth < startDepth) break;
			}
			iterResult = iterator.next();
		}
		return this.buildResultFromCollector(rootCollector, shape);
	}
	/**
	* Parse object from current iterator position (async)
	*/
	async parseObjectFromPosition(iterator, startEvent, startDepth, shape, schemaOptions, stateMachine, parentContext) {
		const sm = stateMachine || new XmlParsingStateMachine(this.options);
		const rootCollector = parentContext?.collector && parentContext.collector.type === "object" ? parentContext.collector : {
			type: "object",
			fields: /* @__PURE__ */ new Map()
		};
		if (rootCollector.fields.size === 0) for (const [fieldName, fieldSchema] of Object.entries(shape)) {
			const xpath = this.extractXPath(fieldSchema);
			if (!xpath) continue;
			const childCollector = this.createCollectorForSchema(fieldSchema);
			sm.registerSchema(fieldSchema, xpath, childCollector, parentContext?.context, fieldName);
			rootCollector.fields.set(fieldName, childCollector);
		}
		await sm.processEventAsync(startEvent);
		let currentDepth = startDepth;
		let iterResult = await iterator.next();
		while (!iterResult.done && currentDepth >= startDepth) {
			const event = iterResult.value;
			await sm.processEventAsync(event);
			if (isStartElement(event)) currentDepth++;
			else if (isEndElement(event)) {
				currentDepth--;
				if (currentDepth < startDepth) break;
			}
			iterResult = await iterator.next();
		}
		return this.buildResultFromCollector(rootCollector, shape);
	}
	/**
	* Parse array asynchronously
	*/
	async parseArrayAsync(input, elementSchema, xpath) {
		if (!xpath) throw new Error("Array schema requires xpath");
		const parser = this.createParser(input);
		const stateMachine = new XmlParsingStateMachine(this.options);
		const arrayCollector = {
			type: "array",
			items: []
		};
		const dummyArraySchema = {
			schemaType: "ARRAY",
			constructor: { name: "XmlArraySchema" },
			element: elementSchema
		};
		stateMachine.registerSchema(dummyArraySchema, xpath, arrayCollector, void 0, void 0);
		for await (const event of parser) await stateMachine.processEventAsync(event);
		return this.extractValueFromCollector(arrayCollector, {
			schemaType: "ARRAY",
			constructor: { name: "XmlArraySchema" },
			element: elementSchema
		});
	}
	/**
	* Collect text content until the closing tag at the given depth
	*/
	async collectTextUntilClose(parser, startDepth) {
		let currentDepth = startDepth;
		let buffer = "";
		let iterResult = await parser.next();
		while (!iterResult.done && currentDepth >= startDepth) {
			const event = iterResult.value;
			if (isStartElement(event)) currentDepth++;
			else if (isEndElement(event)) {
				currentDepth--;
				if (currentDepth < startDepth) break;
			} else if ((isCharacters(event) || isCdata(event)) && currentDepth === startDepth) buffer += event.value;
			if (currentDepth >= startDepth) iterResult = await parser.next();
		}
		return buffer;
	}
	/**
	* Parse array from current iterator position (sync)
	* Used for nested array parsing within a specific element scope
	*/
	parseArrayFromPositionSync(iterator, startEvent, startDepth, elementSchema, xpath, stateMachine) {
		if (!xpath) throw new Error("Array schema requires xpath");
		const isRelativePath = xpath.startsWith("./") || xpath === ".";
		const matcher = new XPathMatcher(xpath, isRelativePath ? startDepth : void 0);
		const results = [];
		const needsRecursive = this.isComplexSchema(elementSchema);
		let currentDepth = startDepth;
		matcher.onStartElement(startEvent);
		let iterResult = iterator.next();
		while (!iterResult.done && currentDepth >= startDepth) {
			const event = iterResult.value;
			if (isStartElement(event)) {
				currentDepth++;
				matcher.onStartElement(event);
				if (matcher.matches(event)) {
					const elementXPath = this.extractXPath(elementSchema);
					const elementMatcher = elementXPath ? new XPathMatcher(elementXPath) : null;
					if (elementMatcher && elementMatcher.isAttributeSelector()) {
						const attrName = elementMatcher.getAttributeName();
						if (attrName && event.attributes) {
							const attrValue = event.attributes[attrName];
							if (attrValue !== void 0) {
								const value = this.parseFieldValue(attrValue, elementSchema);
								results.push(value);
							}
						}
					} else if (needsRecursive && elementSchema._parseFromPosition) {
						const value = elementSchema._parseFromPosition(iterator, event, currentDepth, this.options);
						results.push(value);
					} else if (elementXPath) {
						elementMatcher.onStartElement(event);
						const value = this.extractValueWithElementMatcher(iterator, event, currentDepth, elementMatcher, elementSchema);
						results.push(value);
						matcher.onEndElement();
						currentDepth--;
					} else {
						const textBuffer = this.collectTextUntilCloseSync(iterator, currentDepth);
						const value = this.parseFieldValue(textBuffer.trim(), elementSchema);
						results.push(value);
						matcher.onEndElement();
						currentDepth--;
					}
				}
			} else if (isEndElement(event)) {
				currentDepth--;
				matcher.onEndElement();
				if (currentDepth < startDepth) break;
			}
			if (currentDepth >= startDepth) iterResult = iterator.next();
		}
		return results;
	}
	/**
	* Parse array from current iterator position (async)
	* Used for nested array parsing within a specific element scope
	*/
	async parseArrayFromPosition(iterator, startEvent, startDepth, elementSchema, xpath, stateMachine) {
		if (!xpath) throw new Error("Array schema requires xpath");
		const isRelativePath = xpath.startsWith("./") || xpath === ".";
		const matcher = new XPathMatcher(xpath, isRelativePath ? startDepth : void 0);
		const results = [];
		const needsRecursive = this.isComplexSchema(elementSchema);
		let currentDepth = startDepth;
		matcher.onStartElement(startEvent);
		let iterResult = await iterator.next();
		while (!iterResult.done && currentDepth >= startDepth) {
			const event = iterResult.value;
			if (isStartElement(event)) {
				currentDepth++;
				matcher.onStartElement(event);
				if (matcher.matches(event)) {
					const elementXPath = this.extractXPath(elementSchema);
					const elementMatcher = elementXPath ? new XPathMatcher(elementXPath) : null;
					if (elementMatcher && elementMatcher.isAttributeSelector()) {
						const attrName = elementMatcher.getAttributeName();
						if (attrName && event.attributes) {
							const attrValue = event.attributes[attrName];
							if (attrValue !== void 0) {
								const value = this.parseFieldValue(attrValue, elementSchema);
								results.push(value);
							}
						}
					} else if (needsRecursive && elementSchema._parseFromPosition) {
						const value = await elementSchema._parseFromPosition(iterator, event, currentDepth, this.options);
						results.push(value);
					} else if (elementXPath) {
						elementMatcher.onStartElement(event);
						const value = await this.extractValueWithElementMatcherAsync(iterator, event, currentDepth, elementMatcher, elementSchema);
						results.push(value);
						matcher.onEndElement();
						currentDepth--;
					} else {
						const textBuffer = await this.collectTextUntilClose(iterator, currentDepth);
						const value = this.parseFieldValue(textBuffer.trim(), elementSchema);
						results.push(value);
						matcher.onEndElement();
						currentDepth--;
					}
				}
			} else if (isEndElement(event)) {
				currentDepth--;
				matcher.onEndElement();
				if (currentDepth < startDepth) break;
			}
			if (currentDepth >= startDepth) iterResult = await iterator.next();
		}
		return results;
	}
	/**
	* Parse array synchronously
	*/
	parseArray(input, elementSchema, xpath) {
		if (!xpath) throw new Error("Array schema requires xpath");
		const parser = new StaxXmlParserSync(input, { autoDecodeEntities: this.options?.decodeEntities });
		const stateMachine = new XmlParsingStateMachine(this.options);
		const arrayCollector = {
			type: "array",
			items: []
		};
		const dummyArraySchema = {
			schemaType: "ARRAY",
			constructor: { name: "XmlArraySchema" },
			element: elementSchema
		};
		stateMachine.registerSchema(dummyArraySchema, xpath, arrayCollector, void 0, void 0);
		for (const event of parser) stateMachine.processEventSync(event);
		return this.extractValueFromCollector(arrayCollector, {
			schemaType: "ARRAY",
			constructor: { name: "XmlArraySchema" },
			element: elementSchema
		});
	}
	/**
	* Collect text content until the closing tag at the given depth (sync)
	*/
	collectTextUntilCloseSync(parser, startDepth) {
		let currentDepth = startDepth;
		let buffer = "";
		let iterResult = parser.next();
		while (!iterResult.done && currentDepth >= startDepth) {
			const event = iterResult.value;
			if (isStartElement(event)) currentDepth++;
			else if (isEndElement(event)) {
				currentDepth--;
				if (currentDepth < startDepth) break;
			} else if ((isCharacters(event) || isCdata(event)) && currentDepth === startDepth) buffer += event.value;
			if (currentDepth >= startDepth) iterResult = parser.next();
		}
		return buffer;
	}
	createParser(input) {
		if (typeof input === "string") {
			const stream = new ReadableStream({ start(controller) {
				controller.enqueue(new TextEncoder().encode(input));
				controller.close();
			} });
			return new StaxXmlParser(stream, { autoDecodeEntities: this.options?.decodeEntities });
		}
		if (input instanceof ReadableStream) return new StaxXmlParser(input, { autoDecodeEntities: this.options?.decodeEntities });
		return input;
	}
	extractXPath(schema) {
		if (!schema || typeof schema !== "object") return;
		const unwrapped = this.unwrapSchema(schema);
		if (!unwrapped || typeof unwrapped !== "object") return;
		if ("xpath" in unwrapped) {
			const xpathProp = unwrapped.xpath;
			if (typeof xpathProp === "string") return xpathProp;
		}
		if ("options" in unwrapped) {
			const opts = unwrapped.options;
			if (opts && typeof opts === "object" && "xpath" in opts) {
				const xpath = opts.xpath;
				if (typeof xpath === "string") return xpath;
			}
		}
	}
	/**
	* Check if a schema is wrapped in XmlOptionalSchema
	*/
	isOptionalSchemaWrapper(schema) {
		if (!schema || typeof schema !== "object") return false;
		let current = schema;
		while (current && typeof current === "object" && "schemaType" in current) {
			if (isOptionalSchema(current)) return true;
			if (isTransformSchema(current) && "schema" in current) current = current.schema;
			else break;
		}
		return false;
	}
	/* v8 ignore start */
	/**
	* Unwrap wrapper schemas (Optional, Transform) to get the inner schema
	*/
	unwrapSchema(schema) {
		if (!schema || typeof schema !== "object" || !("schemaType" in schema)) return schema;
		const baseSchema = schema;
		if ((isOptionalSchema(baseSchema) || isTransformSchema(baseSchema)) && "schema" in baseSchema) return this.unwrapSchema(baseSchema.schema);
		return schema;
	}
	/**
	* Extract all Transform functions from a schema chain
	*/
	getAllTransforms(schema) {
		const transforms = [];
		let current = schema;
		while (current && typeof current === "object" && "schemaType" in current) {
			const baseSchema = current;
			if (isTransformSchema(baseSchema)) {
				if ("transformFn" in baseSchema && typeof baseSchema.transformFn === "function") transforms.unshift(baseSchema.transformFn);
				if ("schema" in baseSchema) current = baseSchema.schema;
				else break;
			} else if (isOptionalSchema(baseSchema)) if ("schema" in baseSchema) current = baseSchema.schema;
			else break;
			else break;
		}
		return transforms;
	}
	parseFieldValue(text, schema) {
		if (schema && typeof schema === "object" && "_parseText" in schema && typeof schema._parseText === "function") return schema._parseText(text);
		return text;
	}
	isComplexSchema(schema) {
		const unwrapped = this.unwrapSchema(schema);
		if (!unwrapped || typeof unwrapped !== "object" || !("schemaType" in unwrapped)) return false;
		return isObjectSchema(unwrapped);
	}
	decodeText(text) {
		if (this.options?.trimText) return text.trim();
		return text;
	}
	/**
	* Extract value using XPath matching within a single element scope (sync)
	*/
	extractValueWithElementMatcher(parser, startEvent, startDepth, elementMatcher, elementSchema) {
		let currentDepth = startDepth;
		let textBuffer = "";
		let matchedDepth = -1;
		let iterResult = parser.next();
		while (!iterResult.done && currentDepth >= startDepth) {
			const event = iterResult.value;
			if (isStartElement(event)) {
				currentDepth++;
				elementMatcher.onStartElement(event);
				if (elementMatcher.matches(event) && matchedDepth === -1) {
					matchedDepth = currentDepth;
					textBuffer = "";
				}
			} else if (isEndElement(event)) {
				if (matchedDepth !== -1 && currentDepth === matchedDepth) return this.parseFieldValue(textBuffer.trim(), elementSchema);
				elementMatcher.onEndElement();
				currentDepth--;
				if (currentDepth < startDepth) break;
			} else if ((isCharacters(event) || isCdata(event)) && matchedDepth !== -1 && currentDepth === matchedDepth) textBuffer += event.value;
			if (currentDepth >= startDepth) iterResult = parser.next();
		}
		return this.parseFieldValue("", elementSchema);
	}
	/**
	* Extract value using XPath matching within a single element scope (async)
	*/
	async extractValueWithElementMatcherAsync(parser, startEvent, startDepth, elementMatcher, elementSchema) {
		let currentDepth = startDepth;
		let textBuffer = "";
		let matchedDepth = -1;
		let iterResult = await parser.next();
		while (!iterResult.done && currentDepth >= startDepth) {
			const event = iterResult.value;
			if (isStartElement(event)) {
				currentDepth++;
				elementMatcher.onStartElement(event);
				if (elementMatcher.matches(event) && matchedDepth === -1) {
					matchedDepth = currentDepth;
					textBuffer = "";
				}
			} else if (isEndElement(event)) {
				if (matchedDepth !== -1 && currentDepth === matchedDepth) return this.parseFieldValue(textBuffer.trim(), elementSchema);
				elementMatcher.onEndElement();
				currentDepth--;
				if (currentDepth < startDepth) break;
			} else if ((isCharacters(event) || isCdata(event)) && matchedDepth !== -1 && currentDepth === matchedDepth) textBuffer += event.value;
			if (currentDepth >= startDepth) iterResult = await parser.next();
		}
		return this.parseFieldValue("", elementSchema);
	}
	/**
	* Extract final value from collector based on schema type
	*/
	extractValueFromCollector(collector, schema) {
		const isOptional = this.isOptionalSchemaWrapper(schema);
		const isEmpty = collector.type === "string" && !collector.value && !collector.buffer || collector.type === "number" && collector.value === void 0 || collector.type === "array" && collector.items.length === 0 || collector.type === "object" && collector.fields.size === 0;
		if (isOptional && isEmpty) return;
		if (collector.type === "string") {
			const stringValue = collector.value ?? "";
			if (isOptional && stringValue === "") return;
			return stringValue;
		} else if (collector.type === "number") return collector.value ?? NaN;
		else if (collector.type === "array") {
			let items = collector.items;
			const transforms = this.getAllTransforms(schema);
			for (const transformFn of transforms) items = transformFn(items);
			return items;
		} else if (collector.type === "object") {
			let result = {};
			const unwrapped = this.unwrapSchema(schema);
			if (!unwrapped || typeof unwrapped !== "object" || !("shape" in unwrapped)) return result;
			const shape = unwrapped.shape;
			for (const [fieldName, fieldCollector] of collector.fields) {
				const fieldSchema = shape[fieldName];
				if (fieldSchema) result[fieldName] = this.extractValueFromCollector(fieldCollector, fieldSchema);
			}
			const transforms = this.getAllTransforms(schema);
			for (const transformFn of transforms) result = transformFn(result);
			return result;
		}
	}
	/**
	* Create collector for a schema based on its type
	* @internal
	*/
	createCollectorForSchema(schema) {
		const unwrapped = this.unwrapSchema(schema);
		if (!unwrapped || typeof unwrapped !== "object" || !("schemaType" in unwrapped)) return {
			type: "string",
			buffer: ""
		};
		const baseSchema = unwrapped;
		if (isArraySchema(baseSchema)) return {
			type: "array",
			items: []
		};
		else if (isStringSchema(baseSchema)) return {
			type: "string",
			buffer: ""
		};
		else if (isNumberSchema(baseSchema)) return {
			type: "number",
			buffer: ""
		};
		else if (isObjectSchema(baseSchema)) return {
			type: "object",
			fields: /* @__PURE__ */ new Map()
		};
		return {
			type: "string",
			buffer: ""
		};
	}
	/**
	* Build result object from collector
	* @internal
	*/
	buildResultFromCollector(collector, shape) {
		const result = {};
		for (const [fieldName, fieldCollector] of collector.fields) {
			const schema = shape[fieldName];
			result[fieldName] = this.extractValueFromCollector(fieldCollector, schema);
		}
		return result;
	}
};

//#endregion
//#region src/StaxXmlWriterSync.ts
/**
* States that occur during XML document writing
*/
const WriterState$1 = {
	INITIAL: 0,
	START_ELEMENT_OPEN: 1,
	IN_ELEMENT: 2,
	AFTER_ELEMENT: 3,
	CLOSED: 4,
	ERROR: 5
};
/**
* A class for writing XML similar to StAX XMLStreamWriter.
* This is a simplified implementation that does not support namespace and complex PI/comment management.
*/
var StaxXmlWriterSync = class {
	xmlString = "";
	state = WriterState$1.INITIAL;
	elementStack = [];
	hasTextContentStack = [];
	namespaceStack = [];
	options;
	currentIndentLevel = 0;
	needsIndent = false;
	entityMap = {};
	constructor(options = {}) {
		this.options = {
			encoding: "utf-8",
			prettyPrint: false,
			indentString: "  ",
			addEntities: [],
			autoEncodeEntities: true,
			namespaces: [],
			...options
		};
		this.namespaceStack = [/* @__PURE__ */ new Map()];
		if (this.options.addEntities && Array.isArray(this.options.addEntities)) {
			for (const entity of this.options.addEntities) if (entity.entity && entity.value) this.entityMap[entity.entity] = entity.value;
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
	writeStartDocument(version = "1.0", encoding) {
		if (this.state !== WriterState$1.INITIAL) throw new Error("writeStartDocument can only be called once at the beginning of the document.");
		this.state = WriterState$1.AFTER_ELEMENT;
		let declaration = `<?xml version="${version}"`;
		if (encoding) {
			declaration += ` encoding="${encoding.toUpperCase()}"`;
			this.options.encoding = encoding;
		} else {
			const actualEncoding = this.options.encoding || "UTF-8";
			declaration += ` encoding="${actualEncoding.toUpperCase()}"`;
		}
		declaration += "?>";
		this._write(declaration);
		if (this.options.prettyPrint) this.needsIndent = true;
		return this;
	}
	/**
	* Indicates the end of the document and automatically closes all open elements.
	* @returns Promise<void> Promise that resolves when stream is flushed
	*/
	writeEndDocument() {
		if (this.state === WriterState$1.CLOSED || this.state === WriterState$1.ERROR) return;
		while (this.elementStack.length > 0) this.writeEndElement();
		this.state = WriterState$1.CLOSED;
	}
	/**
	* Returns the written XML string.
	* Should be called after writeEndDocument() to get the complete XML.
	* @returns The written XML string
	*/
	getXmlString() {
		return this.xmlString;
	}
	/**
	* Writes a start element (e.g., <element> or <prefix:element>).
	* @param localName Local name of the element
	* @param options Element writing options (prefix, uri, attributes, selfClosing)
	* @returns this (chainable)
	* @throws Error when called in incorrect state
	*/
	writeStartElement(localName, options) {
		if (this.state === WriterState$1.CLOSED || this.state === WriterState$1.ERROR) throw new Error("Cannot writeStartElement: Writer is closed or in error state.");
		this._closeStartElementTag();
		const prefix = options?.prefix;
		const uri = options?.uri;
		const attributes = options?.attributes;
		const selfClosing = options?.selfClosing ?? false;
		const comment = options?.comment;
		if (comment) {
			this._writeIndent();
			this._write(`<!-- ${comment} -->`);
			this._writeNewline();
		}
		this._writeIndent();
		const tagName = prefix ? `${prefix}:${localName}` : localName;
		this._write(`<${tagName}`);
		const currentNamespaces = new Map(this.namespaceStack[this.namespaceStack.length - 1]);
		if (prefix && uri) {
			this._write(` xmlns:${prefix}="${this._escapeXml(uri)}"`);
			currentNamespaces.set(prefix, uri);
		}
		if (attributes) for (const [key, value] of Object.entries(attributes)) if (typeof value === "string") this._write(` ${key}="${this._escapeXml(value)}"`);
		else {
			const attrPrefix = value.prefix;
			const attrValue = value.value;
			if (attrPrefix) {
				if (!currentNamespaces.has(attrPrefix)) throw new Error(`Namespace prefix '${attrPrefix}' is not defined for attribute '${key}'`);
				this._write(` ${attrPrefix}:${key}="${this._escapeXml(attrValue)}"`);
			} else this._write(` ${key}="${this._escapeXml(attrValue)}"`);
		}
		if (selfClosing) {
			this._write("/>");
			this.state = WriterState$1.AFTER_ELEMENT;
			this._writeNewline();
			return this;
		}
		this.elementStack.push({
			localName,
			prefix
		});
		this.hasTextContentStack.push(false);
		this.namespaceStack.push(currentNamespaces);
		this.state = WriterState$1.START_ELEMENT_OPEN;
		this.currentIndentLevel++;
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
	writeAttribute(localName, value, prefix) {
		if (this.state !== WriterState$1.START_ELEMENT_OPEN) throw new Error("writeAttribute can only be called after writeStartElement.");
		let attr = ` ${prefix ? `${prefix}:${localName}` : localName}="${this._escapeXml(value)}"`;
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
	writeNamespace(prefix, uri) {
		if (this.state !== WriterState$1.START_ELEMENT_OPEN) throw new Error("writeNamespace can only be called after writeStartElement.");
		const currentNamespaces = this.namespaceStack[this.namespaceStack.length - 1];
		if (prefix) {
			this._write(` xmlns:${prefix}="${this._escapeXml(uri)}"`);
			currentNamespaces.set(prefix, uri);
		} else {
			this._write(` xmlns="${this._escapeXml(uri)}"`);
			currentNamespaces.set("", uri);
		}
		return this;
	}
	/**
	* Writes text content.
	* @param text Text to write
	* @returns this (chainable)
	* @throws Error when called in incorrect state
	*/
	writeCharacters(text) {
		if (this.state === WriterState$1.CLOSED || this.state === WriterState$1.ERROR) throw new Error("Cannot writeCharacters: Writer is closed or in error state.");
		this._closeStartElementTag();
		this._write(this._escapeXml(text));
		this.state = WriterState$1.IN_ELEMENT;
		if (this.hasTextContentStack.length > 0) this.hasTextContentStack[this.hasTextContentStack.length - 1] = true;
		this.needsIndent = false;
		return this;
	}
	/**
	* Writes a CDATA section.
	* @param cdata CDATA content
	* @returns this (chainable)
	* @throws Error when called in incorrect state (especially when containing ']]>' sequence)
	*/
	writeCData(cdata) {
		if (this.state === WriterState$1.CLOSED || this.state === WriterState$1.ERROR) throw new Error("Cannot writeCData: Writer is closed or in error state.");
		this._closeStartElementTag();
		if (cdata.includes("]]>")) throw new Error("CDATA section cannot contain \"]]>\" sequence.");
		this._write(`<![CDATA[${cdata}]]>`);
		this.state = WriterState$1.IN_ELEMENT;
		if (this.hasTextContentStack.length > 0) this.hasTextContentStack[this.hasTextContentStack.length - 1] = true;
		this.needsIndent = false;
		return this;
	}
	/**
	* Writes a comment.
	* @param comment Comment content
	* @returns this (chainable)
	* @throws Error when called in incorrect state (especially when containing '--' sequence)
	*/
	writeComment(comment) {
		if (this.state === WriterState$1.CLOSED || this.state === WriterState$1.ERROR) throw new Error("Cannot writeComment: Writer is closed or in error state.");
		this._closeStartElementTag();
		if (comment.includes("--")) throw new Error("XML comment cannot contain \"--\" sequence.");
		this._writeIndent();
		this._write(`<!-- ${comment} -->`);
		this.state = WriterState$1.AFTER_ELEMENT;
		this._writeNewline();
		return this;
	}
	/**
	* Writes a processing instruction (Processing Instruction).
	* @param target PI target
	* @param data PI data (optional)
	* @returns this (chainable)
	* @throws Error when called in incorrect state (especially when containing '?>' sequence)
	*/
	writeProcessingInstruction(target, data) {
		if (this.state === WriterState$1.CLOSED || this.state === WriterState$1.ERROR) throw new Error("Cannot writeProcessingInstruction: Writer is closed or in error state.");
		this._closeStartElementTag();
		let pi = `<?${target}`;
		if (data) {
			if (data.includes("?>")) throw new Error("Processing instruction data cannot contain \"?>\" sequence.");
			pi += ` ${data}`;
		}
		pi += "?>";
		this._writeIndent();
		this._write(pi);
		this.state = WriterState$1.AFTER_ELEMENT;
		this._writeNewline();
		return this;
	}
	/**
	* Writes raw XML content without escaping
	* @param xml Raw XML string to write
	* @returns this (chainable)
	*/
	writeRaw(xml) {
		this._closeStartElementTag();
		this._write(xml);
		return this;
	}
	/**
	* Closes the currently open element (e.g., </element> or </prefix:element>).
	* @returns this (chainable)
	* @throws Error when called with no open elements
	*/
	writeEndElement() {
		if (this.elementStack.length === 0) throw new Error("No open element to close.");
		if (this.state === WriterState$1.CLOSED || this.state === WriterState$1.ERROR) throw new Error("Cannot writeEndElement: Writer is closed or in error state.");
		this.currentIndentLevel--;
		if (!(this.hasTextContentStack.pop() || false) && this.state !== WriterState$1.START_ELEMENT_OPEN) this._writeIndent();
		this._closeStartElementTag();
		const elementInfo = this.elementStack.pop();
		this.namespaceStack.pop();
		const closingTagName = elementInfo.prefix ? `${elementInfo.prefix}:${elementInfo.localName}` : elementInfo.localName;
		this._write(`</${closingTagName}>`);
		this.state = WriterState$1.AFTER_ELEMENT;
		if (this.options.prettyPrint) this.needsIndent = true;
		return this;
	}
	/**
	* Enables/disables pretty print functionality.
	* @param enabled Whether to enable pretty print
	* @returns this (chainable)
	*/
	setPrettyPrint(enabled) {
		this.options.prettyPrint = enabled;
		return this;
	}
	/**
	* Sets the indentation string.
	* @param indentString String to use for indentation (e.g., '  ', '\t', '    ')
	* @returns this (chainable)
	*/
	setIndentString(indentString) {
		this.options.indentString = indentString;
		return this;
	}
	/**
	* Returns the current pretty print setting.
	* @returns Whether pretty print is enabled
	*/
	isPrettyPrintEnabled() {
		return this.options.prettyPrint;
	}
	/**
	* Returns the current indentation string.
	* @returns Currently set indentation string
	*/
	getIndentString() {
		return this.options.indentString;
	}
	/**
	* Closes the currently open start element tag (adds '>').
	* For example, turns <element into <element>.
	* @private
	*/
	_closeStartElementTag() {
		if (this.state === WriterState$1.START_ELEMENT_OPEN) {
			this._write(">");
			this.state = WriterState$1.IN_ELEMENT;
			if (this.options.prettyPrint) this.needsIndent = true;
		}
	}
	/**
	* Applies indentation for pretty print.
	* @private
	*/
	_writeIndent() {
		if (this.options.prettyPrint && this.needsIndent) {
			this.xmlString += "\n";
			this.xmlString += this.options.indentString.repeat(this.currentIndentLevel);
			this.needsIndent = false;
		}
	}
	/**
	* Adds newline for pretty print.
	* @private
	*/
	_writeNewline() {
		if (this.options.prettyPrint) {
			this.xmlString += "\n";
			this.needsIndent = true;
		}
	}
	/**
	* Writes string to output stream.
	* @param chunk String to write
	* @private
	*/
	_write(chunk) {
		if (this.state === WriterState$1.CLOSED || this.state === WriterState$1.ERROR) return;
		this.xmlString += chunk;
	}
	/**
	* Escapes XML text.
	* @param text Text to escape
	* @returns Escaped text
	* @private
	*/
	_escapeXml(text) {
		if (!text) return "";
		if (!this.options.autoEncodeEntities) return text;
		let entityMap = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			"\"": "&quot;",
			"'": "&apos;",
			...this.options.addEntities?.reduce((map, entity) => {
				if (entity.entity && entity.value) map[entity.entity] = entity.value;
				return map;
			}, {})
		};
		const regex = new RegExp(Object.keys(entityMap).join("|"), "g");
		return text.replace(regex, (match) => {
			if (entityMap[match]) return entityMap[match];
			else return match;
		});
	}
};

//#endregion
//#region src/StaxXmlWriter.ts
const WriterState = {
	INITIAL: 0,
	START_ELEMENT_OPEN: 1,
	IN_ELEMENT: 2,
	AFTER_ELEMENT: 3,
	CLOSED: 4,
	ERROR: 5
};
/**
* High-performance asynchronous XML writer implementing the StAX (Streaming API for XML) pattern.
*
* This writer provides efficient streaming XML generation using WritableStream for handling
* large XML documents with automatic buffering, backpressure management, and namespace support.
*
* @remarks
* The writer supports streaming output with configurable buffering, automatic entity encoding,
* pretty printing with customizable indentation, and comprehensive namespace handling.
*
* @example
* Basic usage:
* ```typescript
* const writableStream = new WritableStream({
*   write(chunk) {
*     console.log(new TextDecoder().decode(chunk));
*   }
* });
*
* const writer = new StaxXmlWriter(writableStream);
* await writer.writeStartElement('root');
* await writer.writeElement('item', { id: '1' }, 'Hello World');
* await writer.writeEndElement();
* await writer.close();
* ```
*
* @example
* With pretty printing:
* ```typescript
* const options = {
*   prettyPrint: true,
*   indentString: '    ',
*   autoEncodeEntities: true
* };
* const writer = new StaxXmlWriter(writableStream, options);
* ```
*
* @public
*/
var StaxXmlWriter = class {
	writer;
	encoder;
	buffer;
	bufferPosition = 0;
	state = WriterState.INITIAL;
	elementStack = [];
	hasTextContentStack = [];
	namespaceStack = [];
	options;
	currentIndentLevel = 0;
	needsIndent = false;
	entityMap = {};
	metrics = {
		totalBytesWritten: 0,
		flushCount: 0,
		lastFlushTime: 0
	};
	constructor(stream, options = {}) {
		this.options = {
			encoding: "utf-8",
			prettyPrint: false,
			indentString: "  ",
			addEntities: [],
			autoEncodeEntities: true,
			namespaces: [],
			bufferSize: 16 * 1024,
			highWaterMark: 64 * 1024,
			flushThreshold: .8,
			enableAutoFlush: true,
			...options,
			encoding: options.encoding || "utf-8",
			indentString: options.indentString || "  ",
			addEntities: options.addEntities || []
		};
		if (this.options.flushThreshold <= 1) this.options.flushThreshold = Math.floor(this.options.bufferSize * this.options.flushThreshold);
		this.writer = stream.getWriter();
		this.encoder = new TextEncoder();
		this.buffer = new Uint8Array(this.options.bufferSize);
		this.namespaceStack = [/* @__PURE__ */ new Map()];
		this._initializeEntityMap();
	}
	_initializeEntityMap() {
		if (this.options.addEntities) {
			for (const entity of this.options.addEntities) if (entity.entity && entity.value) this.entityMap[entity.entity] = entity.value;
		}
	}
	/**
	* Write data to buffer (with automatic flush)
	*/
	async _writeToBuffer(text) {
		const bytes = this.encoder.encode(text);
		if (bytes.length > this.options.bufferSize) {
			await this._flushBuffer();
			await this.writer.write(bytes);
			this.metrics.totalBytesWritten += bytes.length;
			return;
		}
		if (this.bufferPosition + bytes.length > this.options.bufferSize) await this._flushBuffer();
		this.buffer.set(bytes, this.bufferPosition);
		this.bufferPosition += bytes.length;
		if (this.options.enableAutoFlush && this.bufferPosition >= this.options.flushThreshold) await this._flushBuffer();
	}
	/**
	* Buffer flush
	*/
	async _flushBuffer() {
		if (this.bufferPosition === 0) return;
		const chunk = this.buffer.slice(0, this.bufferPosition);
		await this.writer.write(chunk);
		this.metrics.totalBytesWritten += this.bufferPosition;
		this.metrics.flushCount++;
		this.metrics.lastFlushTime = Date.now();
		this.bufferPosition = 0;
	}
	/**
	* Write XML declaration
	*/
	async writeStartDocument(version = "1.0", encoding) {
		if (this.state !== WriterState.INITIAL) throw new Error("writeStartDocument can only be called once at the beginning");
		this.state = WriterState.AFTER_ELEMENT;
		const actualEncoding = encoding || this.options.encoding || "UTF-8";
		const declaration = `<?xml version="${version}" encoding="${actualEncoding.toUpperCase()}"?>`;
		await this._writeToBuffer(declaration);
		if (this.options.prettyPrint) this.needsIndent = true;
		return this;
	}
	/**
	* End document (automatically close all elements)
	*/
	async writeEndDocument() {
		if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) return;
		while (this.elementStack.length > 0) await this.writeEndElement();
		await this._flushBuffer();
		await this.writer.close();
		this.state = WriterState.CLOSED;
	}
	/**
	* Write start element
	*/
	async writeStartElement(localName, options) {
		if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) throw new Error("Cannot writeStartElement: Writer is closed or in error state");
		await this._closeStartElementTag();
		const prefix = options?.prefix;
		const uri = options?.uri;
		const attributes = options?.attributes;
		const selfClosing = options?.selfClosing ?? false;
		if (this.options.prettyPrint && this.needsIndent) await this._writeIndent();
		const tagName = prefix ? `${prefix}:${localName}` : localName;
		await this._writeToBuffer(`<${tagName}`);
		const currentNamespaces = new Map(this.namespaceStack[this.namespaceStack.length - 1]);
		if (prefix && uri) {
			await this._writeToBuffer(` xmlns:${prefix}="${this._escapeXml(uri)}"`);
			currentNamespaces.set(prefix, uri);
		}
		if (attributes) for (const [key, value] of Object.entries(attributes)) if (typeof value === "string") await this._writeToBuffer(` ${key}="${this._escapeXml(value)}"`);
		else {
			const attrPrefix = value.prefix;
			const attrValue = value.value;
			if (attrPrefix) {
				if (!currentNamespaces.has(attrPrefix)) throw new Error(`Namespace prefix '${attrPrefix}' is not defined`);
				await this._writeToBuffer(` ${attrPrefix}:${key}="${this._escapeXml(attrValue)}"`);
			} else await this._writeToBuffer(` ${key}="${this._escapeXml(attrValue)}"`);
		}
		if (selfClosing) {
			await this._writeToBuffer("/>");
			this.state = WriterState.AFTER_ELEMENT;
			if (this.options.prettyPrint) await this._writeNewline();
			return this;
		}
		this.elementStack.push({
			localName,
			prefix
		});
		this.hasTextContentStack.push(false);
		this.namespaceStack.push(currentNamespaces);
		this.state = WriterState.START_ELEMENT_OPEN;
		this.currentIndentLevel++;
		return this;
	}
	/**
	* Write end element
	*/
	async writeEndElement() {
		if (this.elementStack.length === 0) throw new Error("No open element to close");
		this.currentIndentLevel--;
		if (!(this.hasTextContentStack.pop() || false) && this.state !== WriterState.START_ELEMENT_OPEN) await this._writeIndent();
		await this._closeStartElementTag();
		const elementInfo = this.elementStack.pop();
		this.namespaceStack.pop();
		const closingTagName = elementInfo.prefix ? `${elementInfo.prefix}:${elementInfo.localName}` : elementInfo.localName;
		await this._writeToBuffer(`</${closingTagName}>`);
		this.state = WriterState.AFTER_ELEMENT;
		if (this.options.prettyPrint) this.needsIndent = true;
		return this;
	}
	/**
	* Write text
	*/
	async writeCharacters(text) {
		if (this.state === WriterState.CLOSED || this.state === WriterState.ERROR) throw new Error("Cannot writeCharacters: Writer is closed or in error state");
		await this._closeStartElementTag();
		await this._writeToBuffer(this._escapeXml(text));
		this.state = WriterState.IN_ELEMENT;
		if (this.hasTextContentStack.length > 0) this.hasTextContentStack[this.hasTextContentStack.length - 1] = true;
		this.needsIndent = false;
		return this;
	}
	/**
	* Write CDATA section
	*/
	async writeCData(cdata) {
		if (cdata.includes("]]>")) throw new Error("CDATA section cannot contain \"]]>\" sequence");
		await this._closeStartElementTag();
		await this._writeToBuffer(`<![CDATA[${cdata}]]>`);
		this.state = WriterState.IN_ELEMENT;
		if (this.hasTextContentStack.length > 0) this.hasTextContentStack[this.hasTextContentStack.length - 1] = true;
		return this;
	}
	/**
	* Write comment
	*/
	async writeComment(comment) {
		if (comment.includes("--")) throw new Error("XML comment cannot contain \"--\" sequence");
		await this._closeStartElementTag();
		await this._writeIndent();
		await this._writeToBuffer(`<!-- ${comment} -->`);
		this.state = WriterState.AFTER_ELEMENT;
		if (this.options.prettyPrint) await this._writeNewline();
		return this;
	}
	/**
	* Write raw XML content without escaping
	* @param xml Raw XML string to write
	* @returns this (chainable)
	*/
	async writeRaw(xml) {
		await this._closeStartElementTag();
		await this._writeToBuffer(xml);
		return this;
	}
	/**
	* Manual flush
	*/
	async flush() {
		await this._flushBuffer();
	}
	/**
	* Return metrics
	*/
	getMetrics() {
		return {
			...this.metrics,
			bufferUtilization: this.bufferPosition / this.options.bufferSize,
			averageFlushSize: this.metrics.flushCount > 0 ? this.metrics.totalBytesWritten / this.metrics.flushCount : 0
		};
	}
	async _closeStartElementTag() {
		if (this.state === WriterState.START_ELEMENT_OPEN) {
			await this._writeToBuffer(">");
			this.state = WriterState.IN_ELEMENT;
			if (this.options.prettyPrint) this.needsIndent = true;
		}
	}
	async _writeIndent() {
		if (this.options.prettyPrint && this.needsIndent) {
			const indent = "\n" + this.options.indentString.repeat(this.currentIndentLevel);
			await this._writeToBuffer(indent);
			this.needsIndent = false;
		}
	}
	async _writeNewline() {
		if (this.options.prettyPrint) {
			await this._writeToBuffer("\n");
			this.needsIndent = true;
		}
	}
	_escapeXml(text) {
		if (!text) return "";
		if (!this.options.autoEncodeEntities) return text;
		let entityMap = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			"\"": "&quot;",
			"'": "&apos;",
			...this.options.addEntities?.reduce((map, entity) => {
				if (entity.entity && entity.value) map[entity.entity] = entity.value;
				return map;
			}, {})
		};
		const regex = new RegExp(Object.keys(entityMap).join("|"), "g");
		return text.replace(regex, (match) => {
			if (entityMap[match]) return entityMap[match];
			else return match;
		});
	}
};

//#endregion
//#region src/converter/XmlArraySchema.ts
/**
* Schema for parsing XML array values
*
* @public
*/
var XmlArraySchema = class extends XmlSchemaBase {
	schemaType = SchemaType.ARRAY;
	constructor(element, xpath) {
		super();
		this.element = element;
		this.xpath = xpath;
	}
	_parse(input, parseOptions) {
		return new XmlParserInternal(parseOptions).parseArray(input, this.element, this.xpath);
	}
	async _parseAsync(input, parseOptions) {
		return new XmlParserInternal(parseOptions).parseArrayAsync(input, this.element, this.xpath);
	}
	/**
	* Parse array from current iterator position (for nested array parsing)
	* @internal
	*/
	_parseFromPosition(iterator, startEvent, startDepth, options, stateMachine, parentContext) {
		const parser = new XmlParserInternal(options);
		const iteratorConstructorName = iterator?.constructor?.name || "";
		if (iteratorConstructorName === "StaxXmlParser" || iteratorConstructorName.includes("Async")) return parser.parseArrayFromPosition(iterator, startEvent, startDepth, this.element, this.xpath, stateMachine);
		return parser.parseArrayFromPositionSync(iterator, startEvent, startDepth, this.element, this.xpath, stateMachine);
	}
	_parseText(text) {
		return [];
	}
	/**
	* Write array data to XML synchronously
	* @internal
	*/
	_writeSync(data, options) {
		let writer;
		let isInjected = false;
		if (options?.writer) if (options.writer instanceof StaxXmlWriterSync) {
			writer = options.writer;
			isInjected = true;
		} else throw new Error("writeSync requires StaxXmlWriterSync instance");
		else writer = new StaxXmlWriterSync({
			prettyPrint: options?.prettyPrint,
			indentString: options?.indentString,
			encoding: options?.encoding
		});
		if (!isInjected && options?.rootElement && options?.includeDeclaration !== false) writer.writeStartDocument(options?.xmlVersion, options?.encoding);
		if (options?.rootElement) writer.writeStartElement(options.rootElement, { comment: this.writeConfig?.comment });
		const elementConfig = this.element.writeConfig;
		const nestedOptions = {
			...options,
			writer,
			rootElement: elementConfig?.element,
			includeDeclaration: false
		};
		for (const item of data) {
			const itemXml = this.element._writeSync(item, nestedOptions);
			writer.writeRaw(itemXml);
		}
		if (options?.rootElement) writer.writeEndElement();
		if (!isInjected) writer.writeEndDocument();
		return writer.getXmlString();
	}
	/**
	* Write array data to WritableStream asynchronously
	* @internal
	*/
	async _write(data, stream, options) {
		let writer;
		let isInjected = false;
		if (options?.writer) if (options.writer instanceof StaxXmlWriter) {
			writer = options.writer;
			isInjected = true;
		} else throw new Error("write requires StaxXmlWriter instance");
		else writer = new StaxXmlWriter(stream, {
			prettyPrint: options?.prettyPrint,
			indentString: options?.indentString,
			encoding: options?.encoding
		});
		if (!isInjected && options?.rootElement && options?.includeDeclaration !== false) await writer.writeStartDocument(options?.xmlVersion, options?.encoding);
		if (options?.rootElement) await writer.writeStartElement(options.rootElement, { comment: this.writeConfig?.comment });
		const elementConfig = this.element.writeConfig;
		const nestedOptions = {
			...options,
			writer,
			rootElement: elementConfig?.element,
			includeDeclaration: false
		};
		for (const item of data) await this.element._write(item, stream, nestedOptions);
		if (options?.rootElement) await writer.writeEndElement();
		if (!isInjected) await writer.writeEndDocument();
	}
};

//#endregion
//#region src/converter/XmlSchema.ts
/**
* Main XML schema class (extends XmlSchemaBase with all methods)
*
* @public
*/
var XmlSchema = class extends XmlSchemaBase {};

//#endregion
//#region src/converter/XmlStringSchema.ts
/**
* Helper to escape XML special characters
*/
function escapeXml$1(text) {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
/**
* Schema for parsing XML string values
*
* @public
*/
var XmlStringSchema = class XmlStringSchema extends XmlSchema {
	schemaType = SchemaType.STRING;
	constructor(options = {}) {
		super();
		this.options = options;
	}
	_parse(input, parseOptions) {
		return new XmlParserInternal(parseOptions).parseString(input, this.options);
	}
	async _parseAsync(input, parseOptions) {
		return new XmlParserInternal(parseOptions).parseStringAsync(input, this.options);
	}
	_parseText(text) {
		return text;
	}
	/**
	* Parse from current iterator position
	* @internal
	*/
	_parseFromPosition(iterator, startEvent, startDepth, options) {
		const iteratorConstructorName = iterator?.constructor?.name || "";
		if (iteratorConstructorName === "StaxXmlParser" || iteratorConstructorName.includes("Async")) return this.collectTextAsync(iterator, startDepth);
		return this.collectTextSync(iterator, startDepth);
	}
	collectTextSync(iterator, startDepth) {
		let currentDepth = startDepth;
		let buffer = "";
		let iterResult = iterator.next();
		while (!iterResult.done) {
			const event = iterResult.value;
			if (isStartElement(event)) currentDepth++;
			else if (isEndElement(event)) {
				currentDepth--;
				if (currentDepth < startDepth) break;
			} else if ((isCharacters(event) || isCdata(event)) && currentDepth === startDepth) buffer += event.value;
			iterResult = iterator.next();
		}
		return buffer;
	}
	async collectTextAsync(iterator, startDepth) {
		let currentDepth = startDepth;
		let buffer = "";
		let iterResult = await iterator.next();
		while (!iterResult.done) {
			const event = iterResult.value;
			if (isStartElement(event)) currentDepth++;
			else if (isEndElement(event)) {
				currentDepth--;
				if (currentDepth < startDepth) break;
			} else if ((isCharacters(event) || isCdata(event)) && currentDepth === startDepth) buffer += event.value;
			iterResult = await iterator.next();
		}
		return buffer;
	}
	/**
	* Set XPath expression for locating the element
	* @param path - XPath expression
	* @returns New schema with XPath
	*/
	xpath(path) {
		if (!path || path.length === 0) throw new Error("XPath cannot be empty");
		return new XmlStringSchema({
			...this.options,
			xpath: path
		});
	}
	/**
	* Write raw content only (used inside object schema)
	* @internal
	*/
	_writeContent(data, options) {
		return this.writeConfig?.cdata ? data : escapeXml$1(data);
	}
	/**
	* Write string data to XML synchronously
	* @internal
	*/
	_writeSync(data, options) {
		let writer;
		let isInjected = false;
		if (options?.writer) if (options.writer instanceof StaxXmlWriterSync) {
			writer = options.writer;
			isInjected = true;
		} else throw new Error("writeSync requires StaxXmlWriterSync instance");
		else writer = new StaxXmlWriterSync({
			prettyPrint: options?.prettyPrint,
			indentString: options?.indentString,
			encoding: options?.encoding
		});
		if (!isInjected && options?.rootElement && options?.includeDeclaration !== false) writer.writeStartDocument(options?.xmlVersion, options?.encoding);
		if (options?.rootElement) writer.writeStartElement(options.rootElement, { comment: this.writeConfig?.comment });
		if (!isInjected && this.writeConfig?.element) writer.writeStartElement(this.writeConfig.element, { comment: this.writeConfig?.comment });
		const content = this._writeContent(data, options);
		if (this.writeConfig?.cdata) writer.writeCData(content);
		else writer.writeRaw(content);
		if (!isInjected && this.writeConfig?.element) writer.writeEndElement();
		if (options?.rootElement) writer.writeEndElement();
		if (!isInjected) writer.writeEndDocument();
		return writer.getXmlString();
	}
	/**
	* Write string data to WritableStream asynchronously
	* @internal
	*/
	async _write(data, stream, options) {
		let writer;
		let isInjected = false;
		if (options?.writer) if (options.writer instanceof StaxXmlWriter) {
			writer = options.writer;
			isInjected = true;
		} else throw new Error("write requires StaxXmlWriter instance");
		else writer = new StaxXmlWriter(stream, {
			prettyPrint: options?.prettyPrint,
			indentString: options?.indentString,
			encoding: options?.encoding
		});
		if (!isInjected && options?.rootElement && options?.includeDeclaration !== false) await writer.writeStartDocument(options?.xmlVersion, options?.encoding);
		if (options?.rootElement) await writer.writeStartElement(options.rootElement, { comment: this.writeConfig?.comment });
		if (!isInjected && this.writeConfig?.element) await writer.writeStartElement(this.writeConfig.element, { comment: this.writeConfig?.comment });
		const content = this._writeContent(data, options);
		if (this.writeConfig?.cdata) await writer.writeCData(content);
		else await writer.writeRaw(content);
		if (!isInjected && this.writeConfig?.element) await writer.writeEndElement();
		if (options?.rootElement) await writer.writeEndElement();
		if (!isInjected) await writer.writeEndDocument();
	}
};

//#endregion
//#region src/converter/XmlNumberSchema.ts
/**
* Schema for parsing XML number values
*
* @public
*/
var XmlNumberSchema = class XmlNumberSchema extends XmlSchema {
	schemaType = SchemaType.NUMBER;
	constructor(options = {}) {
		super();
		this.options = options;
	}
	_parse(input, parseOptions) {
		const text = new XmlParserInternal(parseOptions).parseString(input, this.options);
		return this._parseText(text);
	}
	async _parseAsync(input, parseOptions) {
		const text = await new XmlParserInternal(parseOptions).parseStringAsync(input, this.options);
		return this._parseText(text);
	}
	_parseText(text) {
		const trimmedText = text.trim();
		if (trimmedText === "") throw new XmlParseError([{
			path: [],
			message: `No number content found (empty text)`,
			code: "empty_content"
		}]);
		const num = parseFloat(trimmedText);
		if (isNaN(num)) throw new XmlParseError([{
			path: [],
			message: `Invalid number: ${trimmedText}`,
			code: "invalid_number"
		}]);
		if (this.options.min !== void 0 && num < this.options.min) throw new XmlParseError([{
			path: [],
			message: `Number ${num} is less than minimum ${this.options.min}`,
			code: "too_small"
		}]);
		if (this.options.max !== void 0 && num > this.options.max) throw new XmlParseError([{
			path: [],
			message: `Number ${num} is greater than maximum ${this.options.max}`,
			code: "too_big"
		}]);
		if (this.options.int && !Number.isInteger(num)) throw new XmlParseError([{
			path: [],
			message: `Expected integer, got ${num}`,
			code: "not_integer"
		}]);
		return num;
	}
	/**
	* Parse from current iterator position
	* @internal
	*/
	_parseFromPosition(iterator, startEvent, startDepth, options) {
		const iteratorConstructorName = iterator?.constructor?.name || "";
		if (iteratorConstructorName === "StaxXmlParser" || iteratorConstructorName.includes("Async")) return this.collectAndParseAsync(iterator, startDepth);
		return this.collectAndParseSync(iterator, startDepth);
	}
	collectAndParseSync(iterator, startDepth) {
		let currentDepth = startDepth;
		let buffer = "";
		let iterResult = iterator.next();
		while (!iterResult.done) {
			const event = iterResult.value;
			if (isStartElement(event)) currentDepth++;
			else if (isEndElement(event)) {
				currentDepth--;
				if (currentDepth < startDepth) break;
			} else if ((isCharacters(event) || isCdata(event)) && currentDepth === startDepth) buffer += event.value;
			iterResult = iterator.next();
		}
		return this._parseText(buffer);
	}
	async collectAndParseAsync(iterator, startDepth) {
		let currentDepth = startDepth;
		let buffer = "";
		let iterResult = await iterator.next();
		while (!iterResult.done) {
			const event = iterResult.value;
			if (isStartElement(event)) currentDepth++;
			else if (isEndElement(event)) {
				currentDepth--;
				if (currentDepth < startDepth) break;
			} else if ((isCharacters(event) || isCdata(event)) && currentDepth === startDepth) buffer += event.value;
			iterResult = await iterator.next();
		}
		return this._parseText(buffer);
	}
	/**
	* Set XPath expression for locating the element
	* @param path - XPath expression
	* @returns New schema with XPath
	*/
	xpath(path) {
		if (!path || path.length === 0) throw new Error("XPath cannot be empty");
		return new XmlNumberSchema({
			...this.options,
			xpath: path
		});
	}
	/**
	* Set minimum value
	* @param value - Minimum value
	* @returns New schema with minimum
	*/
	min(value) {
		return new XmlNumberSchema({
			...this.options,
			min: value
		});
	}
	/**
	* Set maximum value
	* @param value - Maximum value
	* @returns New schema with maximum
	*/
	max(value) {
		return new XmlNumberSchema({
			...this.options,
			max: value
		});
	}
	/**
	* Require integer value
	* @returns New schema that only accepts integers
	*/
	int() {
		return new XmlNumberSchema({
			...this.options,
			int: true
		});
	}
	/**
	* Write raw content only (used inside object schema)
	* @internal
	*/
	_writeContent(data, options) {
		return this.options.int ? String(Math.floor(data)) : String(data);
	}
	/**
	* Write number data to XML synchronously
	* @internal
	*/
	_writeSync(data, options) {
		let writer;
		let isInjected = false;
		if (options?.writer) if (options.writer instanceof StaxXmlWriterSync) {
			writer = options.writer;
			isInjected = true;
		} else throw new Error("writeSync requires StaxXmlWriterSync instance");
		else writer = new StaxXmlWriterSync({
			prettyPrint: options?.prettyPrint,
			indentString: options?.indentString,
			encoding: options?.encoding
		});
		if (!isInjected && options?.rootElement && options?.includeDeclaration !== false) writer.writeStartDocument(options?.xmlVersion, options?.encoding);
		if (options?.rootElement) writer.writeStartElement(options.rootElement, { comment: this.writeConfig?.comment });
		if (!isInjected && this.writeConfig?.element) writer.writeStartElement(this.writeConfig.element, { comment: this.writeConfig?.comment });
		const numberStr = this._writeContent(data, options);
		writer.writeCharacters(numberStr);
		if (!isInjected && this.writeConfig?.element) writer.writeEndElement();
		if (options?.rootElement) writer.writeEndElement();
		if (!isInjected) writer.writeEndDocument();
		return writer.getXmlString();
	}
	/**
	* Write number data to WritableStream asynchronously
	* @internal
	*/
	async _write(data, stream, options) {
		let writer;
		let isInjected = false;
		if (options?.writer) if (options.writer instanceof StaxXmlWriter) {
			writer = options.writer;
			isInjected = true;
		} else throw new Error("write requires StaxXmlWriter instance");
		else writer = new StaxXmlWriter(stream, {
			prettyPrint: options?.prettyPrint,
			indentString: options?.indentString,
			encoding: options?.encoding
		});
		if (!isInjected && options?.rootElement && options?.includeDeclaration !== false) await writer.writeStartDocument(options?.xmlVersion, options?.encoding);
		if (options?.rootElement) await writer.writeStartElement(options.rootElement, { comment: this.writeConfig?.comment });
		if (!isInjected && this.writeConfig?.element) await writer.writeStartElement(this.writeConfig.element, { comment: this.writeConfig?.comment });
		const numberStr = this._writeContent(data, options);
		await writer.writeCharacters(numberStr);
		if (!isInjected && this.writeConfig?.element) await writer.writeEndElement();
		if (options?.rootElement) await writer.writeEndElement();
		if (!isInjected) await writer.writeEndDocument();
	}
};

//#endregion
//#region src/converter/XmlObjectSchema.ts
/**
* Helper to escape XML special characters
*/
function escapeXml(text) {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
/**
* Schema for parsing XML object values
*
* @public
*/
var XmlObjectSchema = class XmlObjectSchema extends XmlSchema {
	schemaType = SchemaType.OBJECT;
	constructor(shape, options = {}) {
		super();
		this.shape = shape;
		this.options = options;
	}
	_parse(input, parseOptions) {
		return new XmlParserInternal(parseOptions).parseObject(input, this.shape, this.options);
	}
	async _parseAsync(input, parseOptions) {
		return new XmlParserInternal(parseOptions).parseObjectAsync(input, this.shape, this.options);
	}
	/**
	* Parse from current iterator position (for recursive/streaming parsing)
	* @internal
	*/
	_parseFromPosition(iterator, startEvent, startDepth, options, stateMachine, parentContext) {
		const parser = new XmlParserInternal(options);
		if ("return" in iterator && typeof iterator.return === "function") {
			const returnValue = iterator.return;
			if (returnValue && typeof returnValue.then === "function") return parser.parseObjectFromPosition(iterator, startEvent, startDepth, this.shape, this.options, stateMachine, parentContext);
		}
		const iteratorConstructorName = iterator?.constructor?.name || "";
		if (iteratorConstructorName === "StaxXmlParser" || iteratorConstructorName.includes("Async")) return parser.parseObjectFromPosition(iterator, startEvent, startDepth, this.shape, this.options, stateMachine, parentContext);
		return parser.parseObjectFromPositionSync(iterator, startEvent, startDepth, this.shape, this.options, stateMachine, parentContext);
	}
	_parseText(text) {
		return {};
	}
	/**
	* Set XPath expression for locating the object
	* @param path - XPath expression
	* @returns New schema with XPath
	*/
	xpath(path) {
		if (!path || path.length === 0) throw new Error("XPath cannot be empty");
		return new XmlObjectSchema(this.shape, {
			...this.options,
			xpath: path
		});
	}
	/**
	* Write raw content only (used inside parent object/array schema)
	* @internal
	*/
	_writeContent(data, options) {
		let content = "";
		for (const [key, schema] of Object.entries(this.shape)) {
			const value = data[key];
			if (value === void 0 || value === null) continue;
			if (schema.writeConfig?.asAttribute) continue;
			const rawContent = schema._writeContent ? schema._writeContent(value, options) : escapeXml(String(value));
			content += rawContent;
		}
		return content;
	}
	/**
	* Write object data to XML synchronously
	* @internal
	*/
	_writeSync(data, options) {
		let writer;
		let isInjected = false;
		if (options?.writer) if (options.writer instanceof StaxXmlWriterSync) {
			writer = options.writer;
			isInjected = true;
		} else throw new Error("writeSync requires StaxXmlWriterSync instance");
		else writer = new StaxXmlWriterSync({
			prettyPrint: options?.prettyPrint,
			indentString: options?.indentString,
			encoding: options?.encoding
		});
		if (!isInjected && options?.rootElement && options?.includeDeclaration !== false) writer.writeStartDocument(options?.xmlVersion, options?.encoding);
		if (options?.rootElement) {
			const rootAttributes = {};
			for (const [key, schema] of Object.entries(this.shape)) {
				const fieldConfig = schema.writeConfig;
				if (fieldConfig?.asAttribute) {
					const value = data[key];
					if (value !== void 0 && value !== null) rootAttributes[fieldConfig.asAttribute] = String(value);
				}
			}
			writer.writeStartElement(options.rootElement, {
				attributes: rootAttributes,
				comment: this.writeConfig?.comment
			});
		}
		const nestedOptions = {
			...options,
			writer,
			includeDeclaration: false
		};
		for (const [key, schema] of Object.entries(this.shape)) {
			const value = data[key];
			if (value === void 0 || value === null) continue;
			const fieldConfig = schema.writeConfig;
			if (fieldConfig?.asAttribute) continue;
			const elementName = fieldConfig?.element || key;
			writer.writeStartElement(elementName, { comment: fieldConfig?.comment });
			const rawContent = schema._writeContent ? schema._writeContent(value, nestedOptions) : schema._writeSync(value, {
				...nestedOptions,
				rootElement: void 0
			});
			if (fieldConfig?.cdata) writer.writeCData(rawContent);
			else writer.writeRaw(rawContent);
			writer.writeEndElement();
		}
		if (options?.rootElement) writer.writeEndElement();
		if (!isInjected) writer.writeEndDocument();
		return writer.getXmlString();
	}
	/**
	* Write object data to WritableStream asynchronously
	* @internal
	*/
	async _write(data, stream, options) {
		let writer;
		let isInjected = false;
		if (options?.writer) if (options.writer instanceof StaxXmlWriter) {
			writer = options.writer;
			isInjected = true;
		} else throw new Error("write requires StaxXmlWriter instance");
		else writer = new StaxXmlWriter(stream, {
			prettyPrint: options?.prettyPrint,
			indentString: options?.indentString,
			encoding: options?.encoding
		});
		if (!isInjected && options?.rootElement && options?.includeDeclaration !== false) await writer.writeStartDocument(options?.xmlVersion, options?.encoding);
		if (options?.rootElement) {
			const rootAttributes = {};
			for (const [key, schema] of Object.entries(this.shape)) {
				const fieldConfig = schema.writeConfig;
				if (fieldConfig?.asAttribute) {
					const value = data[key];
					if (value !== void 0 && value !== null) rootAttributes[fieldConfig.asAttribute] = String(value);
				}
			}
			await writer.writeStartElement(options.rootElement, {
				attributes: rootAttributes,
				comment: this.writeConfig?.comment
			});
		}
		({ ...options });
		for (const [key, schema] of Object.entries(this.shape)) {
			const value = data[key];
			if (value === void 0 || value === null) continue;
			const fieldConfig = schema.writeConfig;
			if (fieldConfig?.asAttribute) continue;
			const elementName = fieldConfig?.element || key;
			await writer.writeStartElement(elementName, { comment: fieldConfig?.comment });
			const tempWriter = new StaxXmlWriterSync({
				prettyPrint: options?.prettyPrint,
				indentString: options?.indentString,
				encoding: options?.encoding
			});
			const rawContent = schema._writeSync(value, {
				...options,
				writer: tempWriter,
				rootElement: void 0,
				includeDeclaration: false
			});
			if (fieldConfig?.cdata) await writer.writeCData(rawContent);
			else await writer.writeRaw(rawContent);
			await writer.writeEndElement();
		}
		if (options?.rootElement) await writer.writeEndElement();
		if (!isInjected) await writer.writeEndDocument();
	}
};

//#endregion
//#region src/converter/XmlBuilder.ts
/**
* Builder API for creating XML schemas
*
* @public
*/
var XmlBuilder = class {
	/**
	* Create a string schema
	* @param xpath - Optional XPath expression
	* @returns String schema
	*/
	string(xpath) {
		return new XmlStringSchema(typeof xpath === "string" ? { xpath } : void 0);
	}
	/**
	* Create a number schema
	* @param xpath - Optional XPath expression
	* @returns Number schema
	*/
	number(xpath) {
		return new XmlNumberSchema(typeof xpath === "string" ? { xpath } : void 0);
	}
	/**
	* Create an object schema
	* @param shape - Object shape definition
	* @param options - Optional object options
	* @returns Object schema
	*/
	object(shape, options) {
		return new XmlObjectSchema(shape, options);
	}
	/**
	* Create an array schema
	* @param element - Element schema
	* @param xpath - XPath expression for array elements
	* @returns Array schema
	*/
	array(element, xpath) {
		return new XmlArraySchema(element, xpath);
	}
};
/**
* Singleton builder instance
*
* @public
*/
const x = new XmlBuilder();

//#endregion
//#region src/converter/index.ts
XmlSchemaBase._createTransform = (schema, fn) => new XmlTransformSchema(schema, fn);
XmlSchemaBase._createOptional = (schema) => new XmlOptionalSchema(schema);
XmlSchemaBase._createArray = (schema, xpath) => new XmlArraySchema(schema, xpath);

//#endregion
export { XmlArraySchema, XmlBuilder, XmlNumberSchema, XmlObjectSchema, XmlOptionalSchema, XmlParseError, XmlSchema, XmlStringSchema, XmlTransformSchema, x };