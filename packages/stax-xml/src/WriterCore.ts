import {
  assertNamespaceBinding,
  assertXmlChars,
  assertXmlNCName,
  assertXmlName,
  assertXmlVersion,
  planStartElement,
  reserveExpandedAttribute,
  type WriteElementOptions,
  XML_NAMESPACE_URI,
  XMLNS_NAMESPACE_URI,
  XmlEventType,
  type AnyXmlEvent,
  type EndElementEvent,
  type EventAttribute,
  type StartElementEvent,
} from "@stax-xml/core";

export interface WriterCoreOptions {
  encoding: string;
  prettyPrint?: boolean;
  indentString?: string;
  addEntities?: { entity: string; value: string }[];
  autoEncodeEntities?: boolean;
}

const State = {
  INITIAL: 0,
  START_ELEMENT_OPEN: 1,
  IN_ELEMENT: 2,
  AFTER_ELEMENT: 3,
  CLOSED: 4,
  ERROR: 5,
} as const;

/** Shared XML serializer state machine. It only produces text chunks; wrappers own I/O. */
export class WriterCore {
  private static readonly entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  };
  private static readonly entityPattern = /[&<>"']/g;
  private state: (typeof State)[keyof typeof State] = State.INITIAL;
  private readonly chunks: string[] = [];
  private readonly emit: ((chunk: string) => void) | undefined;
  private readonly elements: string[] = [];
  private readonly elementPrefixes: string[] = [];
  private readonly textContent: boolean[] = [];
  private readonly namespaces = new Map<string, string>();
  private undoStarts: number[] = [];
  private undoPrefixes: string[] = [];
  private undoPrevious: Array<string | undefined> = [];
  private attributes: Array<Set<string>> = [];
  // Expanded names validate writeEvent END_ELEMENT events; elements separately
  // stores the qualified names needed to serialize closing tags for both APIs.
  private eventElements: Array<{ localName: string; namespaceURI: string }> =
    [];
  private suppressedEnd:
    | { localName: string; namespaceURI: string }
    | undefined;
  private seenDtd = false;
  private seenRoot = false;
  private indentLevel = 0;
  private needsIndent = false;
  private indentCache = [""];
  private readonly options: Required<WriterCoreOptions>;
  private readonly customEntities?: Record<string, string>;
  private readonly customPattern?: RegExp;
  private readonly customKeys?: string[];

  constructor(options: WriterCoreOptions, emit?: (chunk: string) => void) {
    this.emit = emit;
    this.options = {
      encoding: options.encoding,
      prettyPrint: options.prettyPrint ?? false,
      indentString: options.indentString ?? "  ",
      addEntities: options.addEntities ?? [],
      autoEncodeEntities: options.autoEncodeEntities ?? true,
    };
    if (this.options.addEntities.length) {
      this.customEntities = { ...WriterCore.entities };
      for (const { entity, value } of this.options.addEntities)
        if (entity && value) this.customEntities[entity] = value;
      const keys = Object.keys(this.customEntities);
      this.customPattern = new RegExp(
        keys.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
        "g",
      );
      this.customKeys = keys.filter((key) => !(key in WriterCore.entities));
    }
  }

  /** Return and clear chunks produced since the last call. */
  takeChunks(): string[] {
    return this.chunks.splice(0);
  }
  get closed(): boolean {
    return this.state === State.CLOSED;
  }
  get failed(): boolean {
    return this.state === State.ERROR;
  }
  fail(): void {
    this.state = State.ERROR;
  }
  setPrettyPrint(enabled: boolean): void {
    this.options.prettyPrint = enabled;
  }
  setIndentString(indentString: string): void {
    this.options.indentString = indentString;
    this.indentCache = [""];
  }
  isPrettyPrintEnabled(): boolean {
    return this.options.prettyPrint;
  }
  getIndentString(): string {
    return this.options.indentString;
  }

  writeStartDocument(
    version: "1.0" = "1.0",
    encoding?: string,
    standalone?: boolean,
  ): void {
    if (this.state !== State.INITIAL)
      throw new Error(
        "writeStartDocument can only be called once at the beginning of the document.",
      );
    if (
      encoding &&
      encoding.toLowerCase() !== this.options.encoding.toLowerCase()
    )
      throw new Error(
        `Writer encoding '${encoding}' does not match output encoding '${this.options.encoding}'.`,
      );
    assertXmlVersion(version);
    this.state = State.AFTER_ELEMENT;
    this.write(
      `<?xml version="${version}" encoding="${this.options.encoding}"${standalone === undefined ? "" : ` standalone="${standalone ? "yes" : "no"}"`}?>`,
    );
    if (this.options.prettyPrint) this.needsIndent = true;
  }
  writeEndDocument(): void {
    if (this.state === State.CLOSED || this.state === State.ERROR) return;
    if (this.suppressedEnd || this.eventElements.length)
      throw new Error(
        "Cannot end document before all event elements were closed.",
      );
    while (this.elements.length) this.writeEndElement();
    this.state = State.CLOSED;
  }
  writeStartElement(localName: string, options?: WriteElementOptions): void {
    this.assertWritable("writeStartElement");
    const selfClosing = options?.selfClosing ?? false;
    const plan = planStartElement(
      localName,
      options,
      (prefix) => this.namespaces.get(prefix),
      (value) => this.escape(value),
      true,
    );
    this.seenRoot = true;
    if (
      selfClosing &&
      plan.prefix &&
      plan.prefix !== "xml" &&
      plan.namespaceBindings.every(
        (binding) => binding.prefix !== plan.prefix,
      ) &&
      !this.namespaces.has(plan.prefix)
    )
      throw new Error(
        `Namespace prefix '${plan.prefix}' is not defined for element '${localName}'`,
      );
    this.closeStart();
    if (options?.comment) {
      this.writeIndent();
      this.write(`<!-- ${options.comment} -->`);
      this.newline();
    }
    this.writeIndent();
    const undoStart = this.undoPrefixes.length;
    this.write(plan.startTag);
    for (const binding of plan.namespaceBindings)
      this.bind(binding.prefix, binding.uri);
    if (selfClosing) {
      this.write("/>");
      this.restore(undoStart);
      this.state = State.AFTER_ELEMENT;
      this.newline();
      return;
    }
    this.elements.push(plan.qualifiedName);
    this.elementPrefixes.push(plan.prefix);
    this.textContent.push(false);
    this.attributes.push(plan.attributeNames);
    this.undoStarts.push(undoStart);
    this.state = State.START_ELEMENT_OPEN;
    this.indentLevel++;
  }
  writeAttribute(localName: string, value: string, prefix?: string): void {
    if (this.state !== State.START_ELEMENT_OPEN)
      throw new Error(
        "writeAttribute can only be called after writeStartElement.",
      );
    assertXmlNCName(localName, "attribute name");
    if (localName === "xmlns")
      throw new Error(
        "Attribute name 'xmlns' is reserved for namespace declarations.",
      );
    let uri = "";
    if (prefix) {
      assertXmlNCName(prefix, "attribute prefix");
      if (prefix === "xmlns")
        throw new Error("The attribute prefix 'xmlns' is reserved.");
      uri =
        prefix === "xml"
          ? XML_NAMESPACE_URI
          : (this.namespaces.get(prefix) ?? "");
      if (!uri)
        throw new Error(
          `Namespace prefix '${prefix}' is not defined for attribute '${localName}'`,
        );
    }
    assertXmlChars(value, "attribute value");
    const name = prefix ? `${prefix}:${localName}` : localName;
    reserveExpandedAttribute(this.attributes.at(-1)!, uri, localName, name);
    this.write(` ${name}="${this.escape(value)}"`);
  }
  writeNamespace(prefix: string, uri: string): void {
    if (this.state !== State.START_ELEMENT_OPEN)
      throw new Error(
        "writeNamespace can only be called after writeStartElement.",
      );
    assertNamespaceBinding(prefix, uri);
    reserveExpandedAttribute(
      this.attributes.at(-1)!,
      XMLNS_NAMESPACE_URI,
      prefix || "xmlns",
      prefix ? `xmlns:${prefix}` : "xmlns",
    );
    this.write(
      prefix
        ? ` xmlns:${prefix}="${this.escape(uri)}"`
        : ` xmlns="${this.escape(uri)}"`,
    );
    this.bind(prefix, uri);
  }
  writeCharacters(text: string): void {
    this.assertWritable("writeCharacters");
    assertXmlChars(text, "character data");
    this.closeStart();
    this.write(this.escape(text));
    this.state = State.IN_ELEMENT;
    if (this.textContent.length)
      this.textContent[this.textContent.length - 1] = true;
    this.needsIndent = false;
  }
  writeCData(cdata: string): void {
    this.assertWritable("writeCData");
    assertXmlChars(cdata, "CDATA");
    if (cdata.includes("]]>"))
      throw new Error('CDATA section cannot contain "]]>" sequence.');
    this.closeStart();
    this.write(`<![CDATA[${cdata}]]>`);
    this.state = State.IN_ELEMENT;
    if (this.textContent.length)
      this.textContent[this.textContent.length - 1] = true;
    this.needsIndent = false;
  }
  writeComment(comment: string): void {
    this.writeCommentValue(comment, true);
  }
  writeProcessingInstruction(target: string, data?: string): void {
    this.assertWritable("writeProcessingInstruction");
    assertXmlName(target, "processing instruction target");
    if (target.toLowerCase() === "xml")
      throw new Error("XML processing instruction target is reserved.");
    if (data !== undefined) assertXmlChars(data, "processing instruction data");
    if (data?.includes("?>"))
      throw new Error(
        'Processing instruction data cannot contain "?>" sequence.',
      );
    this.closeStart();
    this.writeIndent();
    this.write(`<?${target}${data ? ` ${data}` : ""}?>`);
    this.state = State.AFTER_ELEMENT;
    this.newline();
  }
  writeDTD(value: string): void {
    this.assertWritable("writeDTD");
    if (
      this.seenDtd ||
      this.seenRoot ||
      this.elements.length ||
      this.state === State.START_ELEMENT_OPEN
    )
      throw new Error(
        "DOCTYPE must occur at most once before the root element.",
      );
    if (!/^DOCTYPE\s+/.test(value))
      throw new Error("DTD event value must begin with DOCTYPE.");
    assertXmlChars(value, "DTD");
    this.writeIndent();
    this.write(`<!${value}>`);
    this.state = State.AFTER_ELEMENT;
    this.seenDtd = true;
    this.newline();
  }
  writeRaw(xml: string): void {
    this.assertWritable("writeRaw");
    this.closeStart();
    this.write(xml);
  }
  writeEndElement(): void {
    if (!this.elements.length) throw new Error("No open element to close.");
    this.assertWritable("writeEndElement");
    this.assertPrefixBound();
    this.indentLevel--;
    const hasText = this.textContent.pop() || false;
    if (!hasText && this.state !== State.START_ELEMENT_OPEN) this.writeIndent();
    this.closeStart();
    const name = this.elements.pop()!;
    this.elementPrefixes.pop();
    this.attributes.pop();
    this.restore(this.undoStarts.pop()!);
    this.write(`</${name}>`);
    this.state = State.AFTER_ELEMENT;
    if (this.options.prettyPrint) this.needsIndent = true;
  }
  writeEvent(event: AnyXmlEvent): void {
    if (
      this.suppressedEnd &&
      (event.type !== XmlEventType.END_ELEMENT ||
        !sameExpandedName(event, this.suppressedEnd))
    )
      throw new Error(
        "Self-closing START_ELEMENT must be followed by its matching END_ELEMENT.",
      );
    switch (event.type) {
      // StAX permits START_DOCUMENT to produce no output when no declaration exists.
      case XmlEventType.START_DOCUMENT:
        if (event.version !== undefined)
          this.writeStartDocument(
            event.version,
            event.encoding,
            event.standalone,
          );
        return;
      case XmlEventType.END_DOCUMENT:
        return this.writeEndDocument();
      case XmlEventType.START_ELEMENT:
        return this.eventStart(event);
      case XmlEventType.END_ELEMENT:
        if (this.suppressedEnd) {
          this.suppressedEnd = undefined;
          return;
        }
        {
          const expected = this.eventElements.pop();
          if (!expected || !sameExpandedName(event, expected))
            throw new Error(`Mismatched END_ELEMENT event: ${event.name}`);
          return this.writeEndElement();
        }
      case XmlEventType.CHARACTERS:
        return this.writeCharacters(event.value);
      case XmlEventType.CDATA:
        return this.writeCData(event.value);
      case XmlEventType.COMMENT:
        return this.writeCommentValue(event.value, false);
      case XmlEventType.PROCESSING_INSTRUCTION:
        return this.writeProcessingInstruction(event.target, event.data);
      case XmlEventType.DTD:
        return this.writeDTD(event.value);
      default:
        return assertNever(event);
    }
  }
  private eventStart(event: StartElementEvent): void {
    const declaration = namespaceDeclarationFor(
      event,
      event.prefix,
      event.namespaceURI,
    );
    this.writeStartElement(event.localName, {
      prefix: event.prefix || undefined,
      uri: declaration || event.namespaceURI ? event.namespaceURI : undefined,
    });
    for (const attr of event.attributes?.values() ?? [])
      if (
        isNamespaceAttribute(attr) &&
        !(
          namespaceAttributePrefix(attr) === event.prefix &&
          attr.value === event.namespaceURI
        )
      )
        this.writeNamespace(namespaceAttributePrefix(attr), attr.value);
    for (const attr of event.attributes?.values() ?? [])
      if (!isNamespaceAttribute(attr))
        this.writeAttribute(
          attr.localName,
          attr.value,
          attr.prefix || undefined,
        );
    const name = {
      localName: event.localName,
      namespaceURI: event.namespaceURI,
    };
    if (event.selfClosing) {
      this.assertPrefixBound();
      this.write("/>");
      this.indentLevel--;
      this.elements.pop();
      this.elementPrefixes.pop();
      this.textContent.pop();
      this.attributes.pop();
      this.restore(this.undoStarts.pop()!);
      this.state = State.AFTER_ELEMENT;
      this.newline();
      this.suppressedEnd = name;
    } else this.eventElements.push(name);
  }
  private writeCommentValue(comment: string, spaced: boolean): void {
    this.assertWritable("writeComment");
    assertXmlChars(comment, "comment");
    if (comment.includes("--"))
      throw new Error('XML comment cannot contain "--" sequence.');
    this.closeStart();
    this.writeIndent();
    this.write(spaced ? `<!-- ${comment} -->` : `<!--${comment}-->`);
    this.state = State.AFTER_ELEMENT;
    this.newline();
  }
  private write(chunk: string): void {
    if (!this.emit) {
      this.chunks.push(chunk);
      return;
    }
    try {
      this.emit(chunk);
    } catch (error) {
      this.state = State.ERROR;
      throw error;
    }
  }
  private assertWritable(action: string): void {
    if (this.state === State.CLOSED || this.state === State.ERROR)
      throw new Error(`Cannot ${action}: Writer is closed or in error state.`);
  }
  private closeStart(): void {
    if (this.state === State.START_ELEMENT_OPEN) {
      this.assertPrefixBound();
      this.write(">");
      this.state = State.IN_ELEMENT;
      if (this.options.prettyPrint) this.needsIndent = true;
    }
  }
  private assertPrefixBound(): void {
    const prefix = this.elementPrefixes.at(-1);
    if (
      this.state === State.START_ELEMENT_OPEN &&
      prefix &&
      prefix !== "xml" &&
      !this.namespaces.has(prefix)
    )
      throw new Error(
        `Namespace prefix '${prefix}' is not defined for element '${this.elements.at(-1)}'`,
      );
  }
  private writeIndent(): void {
    if (this.options.prettyPrint && this.needsIndent) {
      this.write("\n");
      this.write(this.getIndent(this.indentLevel));
      this.needsIndent = false;
    }
  }
  private newline(): void {
    if (this.options.prettyPrint) {
      this.write("\n");
      this.needsIndent = true;
    }
  }
  private getIndent(level: number): string {
    return (
      this.indentCache[level] ??
      (this.indentCache[level] = this.options.indentString.repeat(level))
    );
  }
  private bind(prefix: string, uri: string): void {
    const previous = this.namespaces.get(prefix);
    /* v8 ignore next -- namespace planners omit bindings already active at this element */ if (
      previous !== uri
    ) {
      this.undoPrefixes.push(prefix);
      this.undoPrevious.push(previous);
      this.namespaces.set(prefix, uri);
    }
  }
  private restore(start: number): void {
    while (this.undoPrefixes.length > start) {
      const prefix = this.undoPrefixes.pop()!;
      const previous = this.undoPrevious.pop();
      if (previous === undefined) this.namespaces.delete(prefix);
      else this.namespaces.set(prefix, previous);
    }
  }
  private escape(text: string): string {
    if (!text || !this.options.autoEncodeEntities) return text;
    if (!this.customPattern)
      return text.replace(
        WriterCore.entityPattern,
        (char) => WriterCore.entities[char]!,
      );
    if (
      !/[&<>"']/.test(text) &&
      !this.customKeys!.some((key) => text.includes(key))
    )
      return text;
    return text.replace(
      this.customPattern,
      (char) => this.customEntities![char]!,
    );
  }
}

function isNamespaceAttribute(attribute: EventAttribute): boolean {
  return (
    attribute.namespaceURI === XMLNS_NAMESPACE_URI ||
    attribute.name === "xmlns" ||
    attribute.prefix === "xmlns"
  );
}
function namespaceAttributePrefix(attribute: EventAttribute): string {
  return attribute.prefix === "xmlns" ? attribute.localName : "";
}
function namespaceDeclarationFor(
  event: StartElementEvent,
  prefix: string,
  uri: string,
): boolean {
  return Array.from(event.attributes?.values() ?? []).some(
    (attribute) =>
      isNamespaceAttribute(attribute) &&
      namespaceAttributePrefix(attribute) === prefix &&
      attribute.value === uri,
  );
}
function sameExpandedName(
  event: EndElementEvent,
  expected: { localName: string; namespaceURI: string },
): boolean {
  return (
    event.localName === expected.localName &&
    event.namespaceURI === expected.namespaceURI
  );
}
function assertNever(event: never): never {
  throw new Error(
    `Unsupported XML event type: ${String((event as AnyXmlEvent).type)}`,
  );
}
