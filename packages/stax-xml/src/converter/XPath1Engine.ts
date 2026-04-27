import {
  isEndDocument,
  isEndElement,
  isError,
  isStartDocument,
  isStartElement,
  type AnyXmlEvent,
  type AttributeInfo
} from '../types.js';
import type { ParseOptions } from './types.js';

type AxisName =
  | 'ancestor'
  | 'ancestor-or-self'
  | 'attribute'
  | 'child'
  | 'descendant'
  | 'descendant-or-self'
  | 'following'
  | 'following-sibling'
  | 'namespace'
  | 'parent'
  | 'preceding'
  | 'preceding-sibling'
  | 'self';

type NodeKind = 'document' | 'element' | 'attribute' | 'namespace' | 'text' | 'comment' | 'processing-instruction';

interface XPathBaseNode {
  kind: NodeKind;
  order: number;
  parent?: XPathContainerNode;
  document: XPathDocument;
}

interface XPathDocumentNode extends XPathBaseNode {
  kind: 'document';
  children: XPathChildNode[];
}

interface XPathElementNode extends XPathBaseNode {
  kind: 'element';
  name: string;
  localName: string;
  prefix?: string;
  uri?: string;
  attributes: XPathAttributeNode[];
  namespaceNodes: XPathNamespaceNode[];
  namespaceMap: Map<string, string>;
  children: XPathChildNode[];
}

interface XPathAttributeNode extends XPathBaseNode {
  kind: 'attribute';
  name: string;
  localName: string;
  prefix?: string;
  uri?: string;
  value: string;
  ownerElement: XPathElementNode;
}

interface XPathNamespaceNode extends XPathBaseNode {
  kind: 'namespace';
  prefix: string;
  uri: string;
  ownerElement: XPathElementNode;
}

interface XPathTextNode extends XPathBaseNode {
  kind: 'text';
  value: string;
}

interface XPathCommentNode extends XPathBaseNode {
  kind: 'comment';
  value: string;
}

interface XPathProcessingInstructionNode extends XPathBaseNode {
  kind: 'processing-instruction';
  target: string;
  data: string;
}

type XPathContainerNode = XPathDocumentNode | XPathElementNode;
export type XPathNode =
  | XPathDocumentNode
  | XPathElementNode
  | XPathAttributeNode
  | XPathNamespaceNode
  | XPathTextNode
  | XPathCommentNode
  | XPathProcessingInstructionNode;
type XPathChildNode = XPathElementNode | XPathTextNode | XPathCommentNode | XPathProcessingInstructionNode;

export interface XPathDocument {
  document: XPathDocumentNode;
  documentElement?: XPathElementNode;
  nodes: XPathNode[];
  childNodes: XPathNode[];
}

export type XPathValue = XPathNode[] | string | number | boolean;

type TokenType =
  | 'number'
  | 'string'
  | 'name'
  | '/'
  | '//'
  | '.'
  | '..'
  | '@'
  | '::'
  | '('
  | ')'
  | '['
  | ']'
  | ','
  | '|'
  | '+'
  | '-'
  | '*'
  | '='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | '$'
  | 'eof';

interface Token {
  type: TokenType;
  value: string;
  offset: number;
}

type Expr =
  | { type: 'binary'; op: string; left: Expr; right: Expr }
  | { type: 'unary'; op: '-'; expr: Expr }
  | { type: 'literal'; value: string }
  | { type: 'number'; value: number }
  | { type: 'variable'; name: string }
  | { type: 'function'; name: string; args: Expr[] }
  | { type: 'path'; absolute: boolean; base?: Expr; steps: Step[] }
  | { type: 'filter'; base: Expr; predicates: Expr[] };

interface Step {
  axis: AxisName;
  nodeTest: NodeTest;
  predicates: Expr[];
  reverse: boolean;
}

type NodeTest =
  | { type: 'node' }
  | { type: 'text' }
  | { type: 'comment' }
  | { type: 'processing-instruction'; target?: string }
  | { type: 'name'; name: string }
  | { type: 'wildcard'; prefix?: string };

interface EvalContext {
  node: XPathNode;
  position: number;
  size: number;
  document: XPathDocument;
  namespaces: Record<string, string>;
}

const XML_NAMESPACE_URI = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NAMESPACE_URI = 'http://www.w3.org/2000/xmlns/';
const DEFAULT_ENTITY_REGEX = /&(lt|gt|quot|apos|amp);/g;
const DEFAULT_ENTITY_MAP: Record<string, string> = {
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  amp: '&'
};
const REVERSE_AXES = new Set<AxisName>([
  'ancestor',
  'ancestor-or-self',
  'preceding',
  'preceding-sibling'
]);

export function buildXPathDocumentFromString(xml: string, options: ParseOptions = {}): XPathDocument {
  return new XmlStringTreeBuilder(xml, options).parse();
}

export function buildXPathDocumentFromEvents(events: Iterable<AnyXmlEvent>): XPathDocument {
  const builder = new XmlEventTreeBuilder();
  for (const event of events) {
    builder.process(event);
  }
  return builder.finish();
}

export async function buildXPathDocumentFromAsyncEvents(events: AsyncIterable<AnyXmlEvent>): Promise<XPathDocument> {
  const builder = new XmlEventTreeBuilder();
  for await (const event of events) {
    builder.process(event);
  }
  return builder.finish();
}

export function evaluateXPath(
  xpath: string,
  contextNode: XPathNode,
  document: XPathDocument,
  options: ParseOptions = {}
): XPathValue {
  const ast = new XPathParser(xpath).parse();
  const context: EvalContext = {
    node: contextNode,
    position: 1,
    size: 1,
    document,
    namespaces: options.xpathNamespaces ?? {}
  };
  return evaluate(ast, context);
}

export function xpathValueToNodes(value: XPathValue): XPathNode[] {
  return isNodeSet(value) ? sortDocumentOrder(value) : [];
}

export function xpathValueToString(value: XPathValue): string {
  return toStringValue(value);
}

export function xpathStringValue(node: XPathNode): string {
  return stringValue(node);
}

class XmlStringTreeBuilder {
  private index = 0;
  private order = 0;
  private readonly document: XPathDocument;
  private readonly stack: XPathElementNode[] = [];
  private readonly decodeEntities: boolean;
  private readonly maxDepth: number;
  private readonly maxEvents: number;

  constructor(private readonly xml: string, options: ParseOptions) {
    const document = {} as XPathDocument;
    const root: XPathDocumentNode = {
      kind: 'document',
      order: this.nextOrder(),
      document,
      children: []
    };
    document.document = root;
    document.nodes = [root];
    document.childNodes = [root];
    this.document = document;
    this.decodeEntities = options.decodeEntities !== false;
    this.maxDepth = options.maxDepth ?? 1000;
    this.maxEvents = options.maxEvents ?? 1000000;
  }

  parse(): XPathDocument {
    while (this.index < this.xml.length) {
      const lt = this.xml.indexOf('<', this.index);
      if (lt === -1) {
        this.addText(this.xml.slice(this.index));
        this.index = this.xml.length;
        break;
      }

      if (lt > this.index) {
        this.addText(this.xml.slice(this.index, lt));
      }

      if (this.xml.startsWith('<!--', lt)) {
        this.parseComment(lt);
      } else if (this.xml.startsWith('<![CDATA[', lt)) {
        this.parseCdata(lt);
      } else if (this.xml.startsWith('<?', lt)) {
        this.parseProcessingInstruction(lt);
      } else if (this.xml.startsWith('</', lt)) {
        this.parseEndTag(lt);
      } else if (this.xml.startsWith('<!DOCTYPE', lt) || this.xml.startsWith('<!doctype', lt)) {
        this.index = this.findDeclarationEnd(lt + 2) + 1;
      } else if (this.xml.startsWith('<!', lt)) {
        this.index = this.findMarkupEnd(lt + 2) + 1;
      } else {
        this.parseStartTag(lt);
      }
    }

    if (this.stack.length > 0) {
      throw new Error(`Unclosed tag in XPath document: ${this.stack[this.stack.length - 1]!.name}`);
    }

    return this.document;
  }

  private parseComment(start: number): void {
    const end = this.xml.indexOf('-->', start + 4);
    if (end === -1) {
      throw new Error('Unclosed comment');
    }
    this.appendChild({
      kind: 'comment',
      order: this.nextOrder(),
      document: this.document,
      value: this.xml.slice(start + 4, end)
    });
    this.index = end + 3;
  }

  private parseCdata(start: number): void {
    const end = this.xml.indexOf(']]>', start + 9);
    if (end === -1) {
      throw new Error('Unclosed CDATA section');
    }
    this.addText(this.xml.slice(start + 9, end), false);
    this.index = end + 3;
  }

  private parseProcessingInstruction(start: number): void {
    const end = this.xml.indexOf('?>', start + 2);
    if (end === -1) {
      throw new Error('Unclosed processing instruction');
    }
    const body = this.xml.slice(start + 2, end).trim();
    const split = body.search(/\s/);
    const target = split === -1 ? body : body.slice(0, split);
    const data = split === -1 ? '' : body.slice(split).trim();
    if (target.toLowerCase() !== 'xml') {
      this.appendChild({
        kind: 'processing-instruction',
        order: this.nextOrder(),
        document: this.document,
        target,
        data
      });
    }
    this.index = end + 2;
  }

  private parseEndTag(start: number): void {
    const end = this.findMarkupEnd(start + 2);
    const name = this.xml.slice(start + 2, end).trim();
    const current = this.stack.pop();
    if (!current || current.name !== name) {
      throw new Error(`Mismatched end tag in XPath document: ${name}`);
    }
    this.index = end + 1;
  }

  private parseStartTag(start: number): void {
    const end = this.findMarkupEnd(start + 1);
    let content = this.xml.slice(start + 1, end);
    let selfClosing = false;
    const lastNonSpace = content.search(/\s*$/);
    const slashIndex = lastNonSpace - 1;
    if (slashIndex >= 0 && content.charCodeAt(slashIndex) === 47) {
      selfClosing = true;
      content = content.slice(0, slashIndex);
    }

    const { name, attributes } = parseTagContent(content, this.decodeEntities);
    if (this.stack.length + 1 > this.maxDepth) {
      throw new Error(`XML depth limit exceeded: ${this.maxDepth}`);
    }
    const parentNamespaces = this.stack[this.stack.length - 1]?.namespaceMap ?? baseNamespaceMap();
    const namespaceMap = new Map(parentNamespaces);
    for (const attr of attributes) {
      if (attr.name === 'xmlns') {
        namespaceMap.set('', attr.value);
      } else if (attr.name.startsWith('xmlns:')) {
        namespaceMap.set(attr.name.slice(6), attr.value);
      }
    }

    const qname = splitQName(name, namespaceMap, true);
    const element: XPathElementNode = {
      kind: 'element',
      order: this.nextOrder(),
      document: this.document,
      parent: this.currentContainer(),
      name,
      localName: qname.localName,
      prefix: qname.prefix,
      uri: qname.uri,
      attributes: [],
      namespaceNodes: [],
      namespaceMap,
      children: []
    };
    this.appendChild(element);
    if (!this.document.documentElement) {
      this.document.documentElement = element;
    }

    for (const attr of attributes) {
      const attrQName = attributeQName(attr.name, namespaceMap);
      element.attributes.push({
        kind: 'attribute',
        order: this.nextOrder(),
        document: this.document,
        parent: element,
        ownerElement: element,
        name: attr.name,
        localName: attrQName.localName,
        prefix: attrQName.prefix,
        uri: attrQName.uri,
        value: attr.value
      });
    }

    for (const [prefix, uri] of namespaceMap) {
      element.namespaceNodes.push({
        kind: 'namespace',
        order: this.nextOrder(),
        document: this.document,
        parent: element,
        ownerElement: element,
        prefix,
        uri
      });
    }

    if (!selfClosing) {
      this.stack.push(element);
    }
    this.index = end + 1;
  }

  private addText(value: string, decode = this.decodeEntities): void {
    if (!value) {
      return;
    }
    this.appendChild({
      kind: 'text',
      order: this.nextOrder(),
      document: this.document,
      value: decode ? decodeXmlEntities(value) : value
    });
  }

  private appendChild(node: XPathChildNode): void {
    const parent = this.currentContainer();
    node.parent = parent;
    parent.children.push(node);
    this.document.nodes.push(node);
    this.document.childNodes.push(node);
  }

  private currentContainer(): XPathContainerNode {
    return this.stack[this.stack.length - 1] ?? this.document.document;
  }

  private findMarkupEnd(position: number): number {
    let quote = '';
    for (let index = position; index < this.xml.length; index++) {
      const char = this.xml[index]!;
      if (quote) {
        if (char === quote) {
          quote = '';
        }
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (char === '>') {
        return index;
      }
    }
    throw new Error('Unclosed markup in XPath document');
  }

  private findDeclarationEnd(position: number): number {
    let quote = '';
    let bracketDepth = 0;
    for (let index = position; index < this.xml.length; index++) {
      const char = this.xml[index]!;
      if (quote) {
        if (char === quote) {
          quote = '';
        }
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (char === '[') {
        bracketDepth++;
        continue;
      }
      if (char === ']') {
        bracketDepth = Math.max(0, bracketDepth - 1);
        continue;
      }
      if (char === '>' && bracketDepth === 0) {
        return index;
      }
    }
    throw new Error('Unclosed DOCTYPE declaration');
  }

  private nextOrder(): number {
    if (this.order > this.maxEvents) {
      throw new Error(`XML event limit exceeded: ${this.maxEvents}`);
    }
    return this.order++;
  }
}

class XmlEventTreeBuilder {
  private order = 0;
  private readonly document: XPathDocument;
  private readonly stack: XPathElementNode[] = [];

  constructor() {
    const document = {} as XPathDocument;
    const root: XPathDocumentNode = {
      kind: 'document',
      order: this.nextOrder(),
      document,
      children: []
    };
    document.document = root;
    document.nodes = [root];
    document.childNodes = [root];
    this.document = document;
  }

  process(event: AnyXmlEvent): void {
    if (isError(event)) {
      throw event.error;
    }
    if (isStartDocument(event) || isEndDocument(event)) {
      return;
    }
    if (isStartElement(event)) {
      const parentNamespaces = this.stack[this.stack.length - 1]?.namespaceMap ?? baseNamespaceMap();
      const namespaceMap = new Map(parentNamespaces);
      for (const [name, value] of Object.entries(event.attributes ?? {})) {
        if (name === 'xmlns') {
          namespaceMap.set('', value);
        } else if (name.startsWith('xmlns:')) {
          namespaceMap.set(name.slice(6), value);
        }
      }
      const qname = {
        localName: event.localName ?? splitQName(event.name, namespaceMap, true).localName,
        prefix: event.prefix,
        uri: event.uri
      };
      const element: XPathElementNode = {
        kind: 'element',
        order: this.nextOrder(),
        document: this.document,
        parent: this.currentContainer(),
        name: event.name,
        localName: qname.localName,
        prefix: qname.prefix,
        uri: qname.uri,
        attributes: [],
        namespaceNodes: [],
        namespaceMap,
        children: []
      };
      this.appendChild(element);
      if (!this.document.documentElement) {
        this.document.documentElement = element;
      }

      for (const [name, value] of Object.entries(event.attributes ?? {})) {
        const info = event.attributesWithPrefix?.[name];
        const attrQName = infoToQName(name, info, namespaceMap);
        element.attributes.push({
          kind: 'attribute',
          order: this.nextOrder(),
          document: this.document,
          parent: element,
          ownerElement: element,
          name,
          localName: attrQName.localName,
          prefix: attrQName.prefix,
          uri: attrQName.uri,
          value
        });
      }
      for (const [prefix, uri] of namespaceMap) {
        element.namespaceNodes.push({
          kind: 'namespace',
          order: this.nextOrder(),
          document: this.document,
          parent: element,
          ownerElement: element,
          prefix,
          uri
        });
      }
      this.stack.push(element);
      return;
    }
    if (isEndElement(event)) {
      const current = this.stack.pop();
      if (!current || current.name !== event.name) {
        throw new Error(`Mismatched end tag in XPath document: ${event.name}`);
      }
      return;
    }
    this.appendChild({
      kind: 'text',
      order: this.nextOrder(),
      document: this.document,
      value: event.value
    });
  }

  finish(): XPathDocument {
    if (this.stack.length > 0) {
      throw new Error(`Unclosed tag in XPath document: ${this.stack[this.stack.length - 1]!.name}`);
    }
    return this.document;
  }

  private appendChild(node: XPathChildNode): void {
    const parent = this.currentContainer();
    node.parent = parent;
    parent.children.push(node);
    this.document.nodes.push(node);
    this.document.childNodes.push(node);
  }

  private currentContainer(): XPathContainerNode {
    return this.stack[this.stack.length - 1] ?? this.document.document;
  }

  private nextOrder(): number {
    return this.order++;
  }
}

class XPathParser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(private readonly source: string) {
    this.tokens = tokenize(source);
  }

  parse(): Expr {
    const expr = this.parseOrExpr();
    this.expect('eof');
    return expr;
  }

  private parseOrExpr(): Expr {
    let expr = this.parseAndExpr();
    while (this.matchName('or')) {
      expr = { type: 'binary', op: 'or', left: expr, right: this.parseAndExpr() };
    }
    return expr;
  }

  private parseAndExpr(): Expr {
    let expr = this.parseEqualityExpr();
    while (this.matchName('and')) {
      expr = { type: 'binary', op: 'and', left: expr, right: this.parseEqualityExpr() };
    }
    return expr;
  }

  private parseEqualityExpr(): Expr {
    let expr = this.parseRelationalExpr();
    while (this.peek().type === '=' || this.peek().type === '!=') {
      const op = this.advance().type;
      expr = { type: 'binary', op, left: expr, right: this.parseRelationalExpr() };
    }
    return expr;
  }

  private parseRelationalExpr(): Expr {
    let expr = this.parseAdditiveExpr();
    while (this.isRelationalOperator(this.peek().type)) {
      const op = this.advance().type;
      expr = { type: 'binary', op, left: expr, right: this.parseAdditiveExpr() };
    }
    return expr;
  }

  private parseAdditiveExpr(): Expr {
    let expr = this.parseMultiplicativeExpr();
    while (this.peek().type === '+' || this.peek().type === '-') {
      const op = this.advance().type;
      expr = { type: 'binary', op, left: expr, right: this.parseMultiplicativeExpr() };
    }
    return expr;
  }

  private parseMultiplicativeExpr(): Expr {
    let expr = this.parseUnaryExpr();
    while (
      this.peek().type === '*'
      || this.peekNameIs('div')
      || this.peekNameIs('mod')
    ) {
      const op = this.advance().value;
      expr = { type: 'binary', op, left: expr, right: this.parseUnaryExpr() };
    }
    return expr;
  }

  private parseUnaryExpr(): Expr {
    if (this.peek().type === '-') {
      this.advance();
      return { type: 'unary', op: '-', expr: this.parseUnaryExpr() };
    }
    return this.parseUnionExpr();
  }

  private parseUnionExpr(): Expr {
    let expr = this.parsePathExpr();
    while (this.peek().type === '|') {
      this.advance();
      expr = { type: 'binary', op: '|', left: expr, right: this.parsePathExpr() };
    }
    return expr;
  }

  private parsePathExpr(): Expr {
    if (this.peek().type === '/' || this.peek().type === '//') {
      const absolute = true;
      const steps: Step[] = [];
      if (this.peek().type === '//') {
        this.advance();
        steps.push(descendantOrSelfStep());
      } else {
        this.advance();
      }
      if (!this.isStepStart(this.peek())) {
        return { type: 'path', absolute, steps };
      }
      steps.push(...this.parseRelativeLocationPathSteps());
      return { type: 'path', absolute, steps };
    }

    if (this.isLocationPathStart()) {
      return { type: 'path', absolute: false, steps: this.parseRelativeLocationPathSteps() };
    }

    let expr = this.parseFilterExpr();
    if (this.peek().type === '/' || this.peek().type === '//') {
      const steps: Step[] = [];
      while (this.peek().type === '/' || this.peek().type === '//') {
        if (this.peek().type === '//') {
          this.advance();
          steps.push(descendantOrSelfStep());
        } else {
          this.advance();
        }
        steps.push(this.parseStep());
      }
      expr = { type: 'path', absolute: false, base: expr, steps };
    }
    return expr;
  }

  private parseFilterExpr(): Expr {
    let expr = this.parsePrimaryExpr();
    const predicates: Expr[] = [];
    while (this.peek().type === '[') {
      this.advance();
      predicates.push(this.parseOrExpr());
      this.expect(']');
    }
    if (predicates.length === 0) {
      return expr;
    }
    return { type: 'filter', base: expr, predicates };
  }

  private parsePrimaryExpr(): Expr {
    const token = this.peek();
    if (token.type === 'number') {
      this.advance();
      return { type: 'number', value: Number(token.value) };
    }
    if (token.type === 'string') {
      this.advance();
      return { type: 'literal', value: token.value };
    }
    if (token.type === '$') {
      this.advance();
      const name = this.expect('name').value;
      return { type: 'variable', name };
    }
    if (token.type === '(') {
      this.advance();
      const expr = this.parseOrExpr();
      this.expect(')');
      return expr;
    }
    if (token.type === 'name' && this.tokens[this.index + 1]?.type === '(') {
      return this.parseFunctionCall();
    }
    throw this.error(`Expected XPath expression, got ${token.value || token.type}`);
  }

  private parseFunctionCall(): Expr {
    const name = this.expect('name').value;
    this.expect('(');
    const args: Expr[] = [];
    if (this.peek().type !== ')') {
      do {
        args.push(this.parseOrExpr());
      } while (this.match(','));
    }
    this.expect(')');
    return { type: 'function', name, args };
  }

  private parseRelativeLocationPathSteps(): Step[] {
    const steps = [this.parseStep()];
    while (this.peek().type === '/' || this.peek().type === '//') {
      if (this.peek().type === '//') {
        this.advance();
        steps.push(descendantOrSelfStep());
      } else {
        this.advance();
      }
      steps.push(this.parseStep());
    }
    return steps;
  }

  private parseStep(): Step {
    if (this.peek().type === '.') {
      this.advance();
      return { axis: 'self', nodeTest: { type: 'node' }, predicates: [], reverse: false };
    }
    if (this.peek().type === '..') {
      this.advance();
      return { axis: 'parent', nodeTest: { type: 'node' }, predicates: [], reverse: true };
    }

    let axis: AxisName = 'child';
    if (this.peek().type === '@') {
      this.advance();
      axis = 'attribute';
    } else if (this.peek().type === 'name' && this.tokens[this.index + 1]?.type === '::') {
      const axisName = this.advance().value;
      this.expect('::');
      axis = parseAxisName(axisName, this.source);
    }

    const nodeTest = this.parseNodeTest();
    const predicates: Expr[] = [];
    while (this.peek().type === '[') {
      this.advance();
      predicates.push(this.parseOrExpr());
      this.expect(']');
    }
    return {
      axis,
      nodeTest,
      predicates,
      reverse: REVERSE_AXES.has(axis)
    };
  }

  private parseNodeTest(): NodeTest {
    const token = this.peek();
    if (token.type === '*') {
      this.advance();
      return { type: 'wildcard' };
    }
    if (token.type !== 'name') {
      throw this.error(`Expected XPath node test, got ${token.value || token.type}`);
    }

    const name = this.advance().value;
    if (this.peek().type === '(' && isNodeTypeName(name)) {
      this.advance();
      if (name === 'processing-instruction') {
        let target: string | undefined;
        if (this.peek().type === 'string') {
          target = this.advance().value;
        }
        this.expect(')');
        return { type: 'processing-instruction', target };
      }
      this.expect(')');
      return { type: name as 'node' | 'text' | 'comment' };
    }
    if (name.endsWith(':*')) {
      return { type: 'wildcard', prefix: name.slice(0, -2) };
    }
    return { type: 'name', name };
  }

  private isLocationPathStart(): boolean {
    const token = this.peek();
    if (token.type === '.' || token.type === '..' || token.type === '@' || token.type === '*') {
      return true;
    }
    if (token.type !== 'name') {
      return false;
    }
    if (this.tokens[this.index + 1]?.type === '::') {
      return true;
    }
    if (this.tokens[this.index + 1]?.type === '(') {
      return isNodeTypeName(token.value);
    }
    return !this.isOperatorName(token.value);
  }

  private isStepStart(token: Token): boolean {
    return token.type === '.'
      || token.type === '..'
      || token.type === '@'
      || token.type === '*'
      || token.type === 'name';
  }

  private isRelationalOperator(type: TokenType): boolean {
    return type === '<' || type === '<=' || type === '>' || type === '>=';
  }

  private isOperatorName(name: string): boolean {
    return name === 'and' || name === 'or' || name === 'div' || name === 'mod';
  }

  private match(type: TokenType): boolean {
    if (this.peek().type !== type) {
      return false;
    }
    this.advance();
    return true;
  }

  private matchName(name: string): boolean {
    if (!this.peekNameIs(name)) {
      return false;
    }
    this.advance();
    return true;
  }

  private peekNameIs(name: string): boolean {
    const token = this.peek();
    return token.type === 'name' && token.value === name;
  }

  private expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw this.error(`Expected ${type}, got ${token.value || token.type}`);
    }
    return this.advance();
  }

  private advance(): Token {
    return this.tokens[this.index++]!;
  }

  private peek(): Token {
    return this.tokens[this.index]!;
  }

  private error(message: string): Error {
    const token = this.peek();
    return new Error(`${message} at XPath offset ${token.offset}`);
  }
}

function evaluate(expr: Expr, context: EvalContext): XPathValue {
  switch (expr.type) {
    case 'literal':
      return expr.value;
    case 'number':
      return expr.value;
    case 'variable':
      throw new Error(`XPath variable references are not available in converter context: $${expr.name}`);
    case 'unary':
      return -toNumberValue(evaluate(expr.expr, context));
    case 'binary':
      return evaluateBinary(expr.op, expr.left, expr.right, context);
    case 'function':
      return evaluateFunction(expr.name, expr.args, context);
    case 'filter':
      return applyPredicates(toNodeSet(evaluate(expr.base, context)), expr.predicates, context, false);
    case 'path':
      return evaluatePath(expr, context);
  }
}

function evaluateBinary(op: string, left: Expr, right: Expr, context: EvalContext): XPathValue {
  if (op === 'or') {
    return toBooleanValue(evaluate(left, context)) || toBooleanValue(evaluate(right, context));
  }
  if (op === 'and') {
    return toBooleanValue(evaluate(left, context)) && toBooleanValue(evaluate(right, context));
  }
  if (op === '|') {
    return unionNodeSets(toNodeSet(evaluate(left, context)), toNodeSet(evaluate(right, context)));
  }

  const leftValue = evaluate(left, context);
  const rightValue = evaluate(right, context);
  if (op === '=' || op === '!=') {
    const result = compareEquality(leftValue, rightValue);
    return op === '=' ? result : !result;
  }
  if (op === '<' || op === '<=' || op === '>' || op === '>=') {
    return compareRelational(leftValue, rightValue, op);
  }

  const leftNumber = toNumberValue(leftValue);
  const rightNumber = toNumberValue(rightValue);
  switch (op) {
    case '+':
      return leftNumber + rightNumber;
    case '-':
      return leftNumber - rightNumber;
    case '*':
      return leftNumber * rightNumber;
    case 'div':
      return leftNumber / rightNumber;
    case 'mod':
      return leftNumber % rightNumber;
  }
  throw new Error(`Unsupported XPath binary operator: ${op}`);
}

function evaluatePath(expr: Extract<Expr, { type: 'path' }>, context: EvalContext): XPathNode[] {
  let nodes: XPathNode[];
  if (expr.absolute) {
    nodes = [context.document.document];
  } else if (expr.base) {
    nodes = toNodeSet(evaluate(expr.base, context));
  } else {
    nodes = [context.node];
  }

  for (const step of expr.steps) {
    const next: XPathNode[] = [];
    for (const node of nodes) {
      const axisNodes = applyAxis(node, step.axis, context.document);
      const matched = axisNodes.filter(candidate => matchesNodeTest(candidate, step.nodeTest, step.axis, context.namespaces));
      next.push(...applyPredicates(matched, step.predicates, context, step.reverse));
    }
    nodes = sortDocumentOrder(uniqueNodes(next));
  }
  return nodes;
}

function applyPredicates(
  nodes: XPathNode[],
  predicates: Expr[],
  context: EvalContext,
  reverse: boolean
): XPathNode[] {
  let current = reverse ? [...nodes].sort((left, right) => right.order - left.order) : nodes;
  for (const predicate of predicates) {
    const size = current.length;
    current = current.filter((node, index) => {
      const value = evaluate(predicate, {
        ...context,
        node,
        position: index + 1,
        size
      });
      if (typeof value === 'number') {
        return value === index + 1;
      }
      return toBooleanValue(value);
    });
  }
  return current;
}

function applyAxis(node: XPathNode, axis: AxisName, document: XPathDocument): XPathNode[] {
  switch (axis) {
    case 'self':
      return [node];
    case 'parent': {
      const parent = parentNode(node);
      return parent ? [parent] : [];
    }
    case 'ancestor':
      return ancestorNodes(node, false);
    case 'ancestor-or-self':
      return ancestorNodes(node, true);
    case 'child':
      return isContainerNode(node) ? node.children : [];
    case 'descendant':
      return descendantNodes(node, false);
    case 'descendant-or-self':
      return descendantNodes(node, true);
    case 'attribute':
      return node.kind === 'element' ? node.attributes : [];
    case 'namespace':
      return node.kind === 'element' ? node.namespaceNodes : [];
    case 'following-sibling':
      return siblingNodes(node, false);
    case 'preceding-sibling':
      return siblingNodes(node, true);
    case 'following':
      return followingNodes(node, document);
    case 'preceding':
      return precedingNodes(node, document);
  }
}

function evaluateFunction(name: string, args: Expr[], context: EvalContext): XPathValue {
  switch (name) {
    case 'last':
      expectArity(name, args, 0);
      return context.size;
    case 'position':
      expectArity(name, args, 0);
      return context.position;
    case 'count':
      expectArity(name, args, 1);
      return toNodeSet(evaluate(args[0]!, context)).length;
    case 'id':
      expectArity(name, args, 1);
      return idFunction(evaluate(args[0]!, context), context.document);
    case 'local-name':
      expectArityRange(name, args, 0, 1);
      return localName(nameFunctionNode(args, context));
    case 'namespace-uri':
      expectArityRange(name, args, 0, 1);
      return namespaceUri(nameFunctionNode(args, context));
    case 'name':
      expectArityRange(name, args, 0, 1);
      return expandedName(nameFunctionNode(args, context));
    case 'string':
      expectArityRange(name, args, 0, 1);
      return args.length === 0 ? stringValue(context.node) : toStringValue(evaluate(args[0]!, context));
    case 'concat':
      if (args.length < 2) throw new Error('XPath function concat expects at least 2 arguments');
      return args.map(arg => toStringValue(evaluate(arg, context))).join('');
    case 'starts-with':
      expectArity(name, args, 2);
      return toStringValue(evaluate(args[0]!, context)).startsWith(toStringValue(evaluate(args[1]!, context)));
    case 'contains':
      expectArity(name, args, 2);
      return toStringValue(evaluate(args[0]!, context)).includes(toStringValue(evaluate(args[1]!, context)));
    case 'substring-before': {
      expectArity(name, args, 2);
      const source = toStringValue(evaluate(args[0]!, context));
      const needle = toStringValue(evaluate(args[1]!, context));
      const index = source.indexOf(needle);
      return index === -1 ? '' : source.slice(0, index);
    }
    case 'substring-after': {
      expectArity(name, args, 2);
      const source = toStringValue(evaluate(args[0]!, context));
      const needle = toStringValue(evaluate(args[1]!, context));
      const index = source.indexOf(needle);
      return index === -1 ? '' : source.slice(index + needle.length);
    }
    case 'substring':
      return substringFunction(args, context);
    case 'string-length':
      expectArityRange(name, args, 0, 1);
      return (args.length === 0 ? stringValue(context.node) : toStringValue(evaluate(args[0]!, context))).length;
    case 'normalize-space':
      expectArityRange(name, args, 0, 1);
      return (args.length === 0 ? stringValue(context.node) : toStringValue(evaluate(args[0]!, context))).trim().replace(/\s+/g, ' ');
    case 'translate':
      return translateFunction(args, context);
    case 'boolean':
      expectArity(name, args, 1);
      return toBooleanValue(evaluate(args[0]!, context));
    case 'not':
      expectArity(name, args, 1);
      return !toBooleanValue(evaluate(args[0]!, context));
    case 'true':
      expectArity(name, args, 0);
      return true;
    case 'false':
      expectArity(name, args, 0);
      return false;
    case 'lang':
      expectArity(name, args, 1);
      return langFunction(context.node, toStringValue(evaluate(args[0]!, context)));
    case 'number':
      expectArityRange(name, args, 0, 1);
      return args.length === 0 ? toNumberValue(stringValue(context.node)) : toNumberValue(evaluate(args[0]!, context));
    case 'sum':
      expectArity(name, args, 1);
      return toNodeSet(evaluate(args[0]!, context)).reduce((sum, node) => sum + toNumberValue(stringValue(node)), 0);
    case 'floor':
      expectArity(name, args, 1);
      return Math.floor(toNumberValue(evaluate(args[0]!, context)));
    case 'ceiling':
      expectArity(name, args, 1);
      return Math.ceil(toNumberValue(evaluate(args[0]!, context)));
    case 'round':
      expectArity(name, args, 1);
      return Math.round(toNumberValue(evaluate(args[0]!, context)));
    default:
      throw new Error(`Unsupported XPath function: ${name}`);
  }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index]!;
    if (/\s/.test(char)) {
      index++;
      continue;
    }

    const start = index;
    const two = source.slice(index, index + 2);
    if (two === '//' || two === '..' || two === '::' || two === '!=' || two === '<=' || two === '>=') {
      tokens.push({ type: two as TokenType, value: two, offset: start });
      index += 2;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      index++;
      let value = '';
      while (index < source.length && source[index] !== quote) {
        value += source[index]!;
        index++;
      }
      if (index >= source.length) {
        throw new Error(`Unclosed XPath string literal at offset ${start}`);
      }
      index++;
      tokens.push({ type: 'string', value, offset: start });
      continue;
    }

    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(source[index + 1] ?? ''))) {
      let value = '';
      if (char === '.') {
        value += '.';
        index++;
      }
      while (/[0-9]/.test(source[index] ?? '')) {
        value += source[index++]!;
      }
      if (source[index] === '.') {
        value += source[index++]!;
        while (/[0-9]/.test(source[index] ?? '')) {
          value += source[index++]!;
        }
      }
      tokens.push({ type: 'number', value, offset: start });
      continue;
    }

    if (isNameStart(char)) {
      let value = source[index++]!;
      while (
        index < source.length
        && isNameChar(source[index]!)
        && !(source[index] === ':' && (source[index + 1] === ':' || source[index + 1] === '*'))
      ) {
        value += source[index++]!;
      }
      if (source[index] === ':' && source[index + 1] === '*') {
        value += ':*';
        index += 2;
      }
      tokens.push({ type: 'name', value, offset: start });
      continue;
    }

    if ('/[](),|+-*=<>@.$'.includes(char)) {
      tokens.push({ type: char as TokenType, value: char, offset: start });
      index++;
      continue;
    }

    if (/[;{}\\]/.test(char)) {
      throw new Error('Invalid characters in XPath');
    }
    throw new Error(`Invalid XPath character ${char} at offset ${start}`);
  }
  tokens.push({ type: 'eof', value: '', offset: source.length });
  return tokens;
}

function parseTagContent(content: string, decodeEntities: boolean): { name: string; attributes: Array<{ name: string; value: string }> } {
  let index = 0;
  while (index < content.length && /\s/.test(content[index]!)) index++;
  const nameStart = index;
  while (index < content.length && !/\s/.test(content[index]!)) index++;
  const name = content.slice(nameStart, index);
  const attributes: Array<{ name: string; value: string }> = [];
  while (index < content.length) {
    while (index < content.length && /\s/.test(content[index]!)) index++;
    if (index >= content.length) break;
    const attrStart = index;
    while (index < content.length && !/[\s=]/.test(content[index]!)) index++;
    const attrName = content.slice(attrStart, index);
    while (index < content.length && /\s/.test(content[index]!)) index++;
    if (content[index] !== '=') {
      throw new Error(`Malformed attribute in XPath document: ${attrName}`);
    }
    index++;
    while (index < content.length && /\s/.test(content[index]!)) index++;
    const quote = content[index];
    if (quote !== '"' && quote !== "'") {
      throw new Error(`Malformed quoted attribute in XPath document: ${attrName}`);
    }
    index++;
    const valueStart = index;
    while (index < content.length && content[index] !== quote) index++;
    const value = content.slice(valueStart, index);
    index++;
    attributes.push({ name: attrName, value: decodeEntities ? decodeXmlEntities(value) : value });
  }
  return { name, attributes };
}

function decodeXmlEntities(value: string): string {
  if (!value || value.indexOf('&') === -1) {
    return value;
  }
  DEFAULT_ENTITY_REGEX.lastIndex = 0;
  return value.replace(DEFAULT_ENTITY_REGEX, (_, entity: string) => DEFAULT_ENTITY_MAP[entity]!);
}

function baseNamespaceMap(): Map<string, string> {
  return new Map([['xml', XML_NAMESPACE_URI]]);
}

function splitQName(name: string, namespaces: Map<string, string>, useDefaultNamespace: boolean): { localName: string; prefix?: string; uri?: string } {
  const colon = name.indexOf(':');
  if (colon === -1) {
    return {
      localName: name,
      prefix: undefined,
      uri: useDefaultNamespace ? namespaces.get('') : undefined
    };
  }
  const prefix = name.slice(0, colon);
  return {
    localName: name.slice(colon + 1),
    prefix,
    uri: namespaces.get(prefix)
  };
}

function attributeQName(name: string, namespaces: Map<string, string>): { localName: string; prefix?: string; uri?: string } {
  if (name === 'xmlns') {
    return { localName: 'xmlns', prefix: undefined, uri: XMLNS_NAMESPACE_URI };
  }
  if (name.startsWith('xmlns:')) {
    return { localName: name.slice(6), prefix: 'xmlns', uri: XMLNS_NAMESPACE_URI };
  }
  return splitQName(name, namespaces, false);
}

function infoToQName(name: string, info: AttributeInfo | undefined, namespaces: Map<string, string>): { localName: string; prefix?: string; uri?: string } {
  if (info) {
    return { localName: info.localName, prefix: info.prefix, uri: info.uri };
  }
  return attributeQName(name, namespaces);
}

function isNameStart(char: string): boolean {
  return /[A-Za-z_]/.test(char);
}

function isNameChar(char: string): boolean {
  return /[A-Za-z0-9_.:-]/.test(char);
}

function isNodeTypeName(name: string): boolean {
  return name === 'node'
    || name === 'text'
    || name === 'comment'
    || name === 'processing-instruction';
}

function parseAxisName(value: string, source: string): AxisName {
  switch (value) {
    case 'ancestor':
    case 'ancestor-or-self':
    case 'attribute':
    case 'child':
    case 'descendant':
    case 'descendant-or-self':
    case 'following':
    case 'following-sibling':
    case 'namespace':
    case 'parent':
    case 'preceding':
    case 'preceding-sibling':
    case 'self':
      return value;
    default:
      throw new Error(`Unknown XPath axis ${value} in ${source}`);
  }
}

function descendantOrSelfStep(): Step {
  return { axis: 'descendant-or-self', nodeTest: { type: 'node' }, predicates: [], reverse: false };
}

function isNodeSet(value: XPathValue): value is XPathNode[] {
  return Array.isArray(value);
}

function toNodeSet(value: XPathValue): XPathNode[] {
  if (!isNodeSet(value)) {
    throw new Error('XPath expression must evaluate to a node-set');
  }
  return value;
}

function toBooleanValue(value: XPathValue): boolean {
  if (isNodeSet(value)) return value.length > 0;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  return value.length > 0;
}

function toNumberValue(value: XPathValue): number {
  if (typeof value === 'number') return value;
  return Number(toStringValue(value).trim());
}

function toStringValue(value: XPathValue): string {
  if (isNodeSet(value)) {
    const first = sortDocumentOrder(value)[0];
    return first ? stringValue(first) : '';
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN';
    if (Object.is(value, -0)) return '0';
    return String(value);
  }
  return value;
}

function stringValue(node: XPathNode): string {
  switch (node.kind) {
    case 'document':
    case 'element':
      return descendantText(node).join('');
    case 'attribute':
      return node.value;
    case 'namespace':
      return node.uri;
    case 'text':
    case 'comment':
      return node.value;
    case 'processing-instruction':
      return node.data;
  }
}

function descendantText(node: XPathDocumentNode | XPathElementNode): string[] {
  const result: string[] = [];
  for (const child of node.children) {
    if (child.kind === 'text') {
      result.push(child.value);
    } else if (child.kind === 'element') {
      result.push(...descendantText(child));
    }
  }
  return result;
}

function expandedName(node: XPathNode | undefined): string {
  if (!node) {
    return '';
  }
  switch (node.kind) {
    case 'element':
    case 'attribute':
      return node.name;
    case 'namespace':
      return node.prefix;
    case 'processing-instruction':
      return node.target;
    default:
      return '';
  }
}

function localName(node: XPathNode | undefined): string {
  if (!node) {
    return '';
  }
  switch (node.kind) {
    case 'element':
    case 'attribute':
      return node.localName;
    case 'namespace':
      return node.prefix;
    case 'processing-instruction':
      return node.target;
    default:
      return '';
  }
}

function namespaceUri(node: XPathNode | undefined): string {
  if (!node) {
    return '';
  }
  switch (node.kind) {
    case 'element':
    case 'attribute':
      return node.uri ?? '';
    case 'namespace':
      return node.uri;
    default:
      return '';
  }
}

function matchesNodeTest(node: XPathNode, test: NodeTest, axis: AxisName, namespaces: Record<string, string>): boolean {
  switch (test.type) {
    case 'node':
      return true;
    case 'text':
      return node.kind === 'text';
    case 'comment':
      return node.kind === 'comment';
    case 'processing-instruction':
      return node.kind === 'processing-instruction' && (test.target === undefined || node.target === test.target);
    case 'wildcard':
      return matchesPrincipalWildcard(node, axis, test.prefix, namespaces);
    case 'name':
      return matchesNameTest(node, axis, test.name, namespaces);
  }
}

function matchesPrincipalWildcard(node: XPathNode, axis: AxisName, prefix: string | undefined, namespaces: Record<string, string>): boolean {
  if (!isPrincipalNodeType(node, axis)) {
    return false;
  }
  if (prefix === undefined) {
    return true;
  }
  const resolved = namespaces[prefix];
  if (resolved !== undefined) {
    return namespaceUri(node) === resolved;
  }
  return node.kind !== 'text' && node.kind !== 'comment' && node.kind !== 'document' && expandedName(node).startsWith(`${prefix}:`);
}

function matchesNameTest(node: XPathNode, axis: AxisName, name: string, namespaces: Record<string, string>): boolean {
  if (!isPrincipalNodeType(node, axis)) {
    return false;
  }
  if (axis === 'namespace') {
    return node.kind === 'namespace' && node.prefix === name;
  }
  const colon = name.indexOf(':');
  if (colon !== -1) {
    const prefix = name.slice(0, colon);
    const resolved = namespaces[prefix];
    if (resolved !== undefined) {
      return localName(node) === name.slice(colon + 1) && namespaceUri(node) === resolved;
    }
  }
  return expandedName(node) === name;
}

function isPrincipalNodeType(node: XPathNode, axis: AxisName): boolean {
  if (axis === 'attribute') return node.kind === 'attribute';
  if (axis === 'namespace') return node.kind === 'namespace';
  return node.kind === 'element';
}

function isContainerNode(node: XPathNode): node is XPathContainerNode {
  return node.kind === 'document' || node.kind === 'element';
}

function parentNode(node: XPathNode): XPathContainerNode | undefined {
  if (node.kind === 'attribute' || node.kind === 'namespace') {
    return node.ownerElement;
  }
  return node.parent;
}

function ancestorNodes(node: XPathNode, includeSelf: boolean): XPathNode[] {
  const result: XPathNode[] = [];
  if (includeSelf) {
    result.push(node);
  }
  let current = parentNode(node);
  while (current) {
    result.push(current);
    current = parentNode(current);
  }
  return result;
}

function descendantNodes(node: XPathNode, includeSelf: boolean): XPathNode[] {
  const result: XPathNode[] = [];
  if (includeSelf) {
    result.push(node);
  }
  if (!isContainerNode(node)) {
    return result;
  }
  for (const child of node.children) {
    result.push(child);
    result.push(...descendantNodes(child, false));
  }
  return result;
}

function siblingNodes(node: XPathNode, preceding: boolean): XPathNode[] {
  if (node.kind === 'attribute' || node.kind === 'namespace' || !node.parent) {
    return [];
  }
  const siblings = node.parent.children;
  const index = siblings.indexOf(node as XPathChildNode);
  const result = preceding ? siblings.slice(0, index).reverse() : siblings.slice(index + 1);
  return result;
}

function followingNodes(node: XPathNode, document: XPathDocument): XPathNode[] {
  const boundaryNode = node.kind === 'attribute' || node.kind === 'namespace' ? node.ownerElement : node;
  const boundary = maxSubtreeOrder(boundaryNode);
  return document.childNodes.filter(candidate =>
    candidate.order > boundary
    && candidate.kind !== 'attribute'
    && candidate.kind !== 'namespace'
  );
}

function precedingNodes(node: XPathNode, document: XPathDocument): XPathNode[] {
  const boundaryNode = node.kind === 'attribute' || node.kind === 'namespace' ? node.ownerElement : node;
  const ancestors = new Set(ancestorNodes(boundaryNode, false));
  return document.childNodes
    .filter(candidate =>
      candidate.order < boundaryNode.order
      && candidate.kind !== 'attribute'
      && candidate.kind !== 'namespace'
      && !ancestors.has(candidate)
    )
    .sort((left, right) => right.order - left.order);
}

function maxSubtreeOrder(node: XPathNode): number {
  if (!isContainerNode(node)) {
    return node.order;
  }
  let max = node.order;
  for (const child of node.children) {
    max = Math.max(max, maxSubtreeOrder(child));
  }
  return max;
}

function uniqueNodes(nodes: XPathNode[]): XPathNode[] {
  const seen = new Set<XPathNode>();
  const result: XPathNode[] = [];
  for (const node of nodes) {
    if (!seen.has(node)) {
      seen.add(node);
      result.push(node);
    }
  }
  return result;
}

function sortDocumentOrder(nodes: XPathNode[]): XPathNode[] {
  return uniqueNodes(nodes).sort((left, right) => left.order - right.order);
}

function unionNodeSets(left: XPathNode[], right: XPathNode[]): XPathNode[] {
  return sortDocumentOrder([...left, ...right]);
}

function compareEquality(left: XPathValue, right: XPathValue): boolean {
  if (isNodeSet(left) || isNodeSet(right)) {
    return compareNodeSet(left, right, (a, b) => a === b);
  }
  if (typeof left === 'boolean' || typeof right === 'boolean') {
    return toBooleanValue(left) === toBooleanValue(right);
  }
  if (typeof left === 'number' || typeof right === 'number') {
    return toNumberValue(left) === toNumberValue(right);
  }
  return toStringValue(left) === toStringValue(right);
}

function compareRelational(left: XPathValue, right: XPathValue, op: string): boolean {
  return compareNodeSet(left, right, (a, b) => {
    const leftNumber = Number(a);
    const rightNumber = Number(b);
    if (op === '<') return leftNumber < rightNumber;
    if (op === '<=') return leftNumber <= rightNumber;
    if (op === '>') return leftNumber > rightNumber;
    return leftNumber >= rightNumber;
  }, true);
}

function compareNodeSet(
  left: XPathValue,
  right: XPathValue,
  compare: (left: string, right: string) => boolean,
  forceNumber = false
): boolean {
  const leftValues = isNodeSet(left) ? left.map(stringValue) : [forceNumber ? String(toNumberValue(left)) : toStringValue(left)];
  const rightValues = isNodeSet(right) ? right.map(stringValue) : [forceNumber ? String(toNumberValue(right)) : toStringValue(right)];
  for (const leftValue of leftValues) {
    for (const rightValue of rightValues) {
      if (compare(leftValue, rightValue)) {
        return true;
      }
    }
  }
  return false;
}

function nameFunctionNode(args: Expr[], context: EvalContext): XPathNode | undefined {
  if (args.length === 0) {
    return context.node;
  }
  return sortDocumentOrder(toNodeSet(evaluate(args[0]!, context)))[0];
}

function idFunction(value: XPathValue, document: XPathDocument): XPathNode[] {
  const ids = new Set<string>();
  const addTokens = (text: string) => {
    for (const token of text.trim().split(/\s+/)) {
      if (token) ids.add(token);
    }
  };
  if (isNodeSet(value)) {
    for (const node of value) addTokens(stringValue(node));
  } else {
    addTokens(toStringValue(value));
  }
  if (ids.size === 0) {
    return [];
  }
  return document.childNodes.filter((node): node is XPathElementNode =>
    node.kind === 'element' && node.attributes.some(attr => attr.localName === 'id' && ids.has(attr.value))
  );
}

function substringFunction(args: Expr[], context: EvalContext): string {
  expectArityRange('substring', args, 2, 3);
  const source = toStringValue(evaluate(args[0]!, context));
  const start = Math.round(toNumberValue(evaluate(args[1]!, context)));
  if (Number.isNaN(start)) {
    return '';
  }
  const startIndex = Math.max(start - 1, 0);
  if (args.length === 2) {
    return source.slice(startIndex);
  }
  const length = Math.round(toNumberValue(evaluate(args[2]!, context)));
  if (Number.isNaN(length) || length <= 0) {
    return '';
  }
  return source.slice(startIndex, startIndex + length);
}

function translateFunction(args: Expr[], context: EvalContext): string {
  expectArity('translate', args, 3);
  const source = toStringValue(evaluate(args[0]!, context));
  const from = toStringValue(evaluate(args[1]!, context));
  const to = toStringValue(evaluate(args[2]!, context));
  let result = '';
  for (const char of source) {
    const index = from.indexOf(char);
    if (index === -1) {
      result += char;
    } else if (index < to.length) {
      result += to[index]!;
    }
  }
  return result;
}

function langFunction(node: XPathNode, lang: string): boolean {
  const expected = lang.toLowerCase();
  let current: XPathNode | undefined = node;
  while (current) {
    if (current.kind === 'element') {
      const attr = current.attributes.find(candidate =>
        candidate.name === 'xml:lang' || (candidate.localName === 'lang' && candidate.prefix === 'xml')
      );
      if (attr) {
        const actual = attr.value.toLowerCase();
        return actual === expected || actual.startsWith(`${expected}-`);
      }
    }
    current = parentNode(current);
  }
  return false;
}

function expectArity(name: string, args: Expr[], expected: number): void {
  if (args.length !== expected) {
    throw new Error(`XPath function ${name} expects ${expected} arguments`);
  }
}

function expectArityRange(name: string, args: Expr[], min: number, max: number): void {
  if (args.length < min || args.length > max) {
    throw new Error(`XPath function ${name} expects ${min}-${max} arguments`);
  }
}
