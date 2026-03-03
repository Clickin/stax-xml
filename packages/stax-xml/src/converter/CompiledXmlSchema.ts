import { XmlSchemaBase } from './base.js';
import type { ParseInput } from './XmlSchema.js';
import type { ParseOptions, XmlWriteOptions } from './types.js';
import {
  isArraySchema,
  isNumberSchema,
  isObjectSchema,
  isOptionalSchema,
  isStringSchema,
  isTransformSchema
} from './types.js';
import type { XmlObjectSchema, XmlObjectShape } from './XmlObjectSchema.js';
import type { ParserEventFilter } from '../types.js';
import type { CompiledSchemaPlan, ObjectFieldTemplate, RootFieldPlan } from './compiled-plan.js';
import { XmlParserInternal } from './XmlParserInternal.js';
import { XPathCompiler, type CompiledXPath } from './XPathEngine.js';


export class CompiledXmlSchema<Output, Input = Output> extends XmlSchemaBase<Output, Input> {
  private readonly plan: CompiledSchemaPlan;
  private readonly schema: XmlSchemaBase<Output, Input>;

  constructor(schema: XmlSchemaBase<Output, Input>) {
    super();
    if (schema instanceof CompiledXmlSchema) {
      this.schema = schema.schema;
      this.plan = schema.plan;
      return;
    }
    const unwrapped = unwrapSchema(schema);
    if (!isObjectSchema(unwrapped)) {
      throw new Error('compile() supports only XmlObjectSchema root');
    }
    assertNoCompiledSchema(unwrapped);
    this.schema = schema;
    this.plan = buildCompiledPlan(unwrapped);
  }

  get schemaType(): XmlSchemaBase<Output, Input>['schemaType'] {
    return this.schema.schemaType;
  }

  _parse(input: ParseInput, options?: ParseOptions): Output {
    const parser = new XmlParserInternal(options, this.plan);
    return parser.parseWithSchema(input, this.schema);
  }

  async _parseAsync(input: ParseInput, options?: ParseOptions): Promise<Output> {
    const parser = new XmlParserInternal(options, this.plan);
    return parser.parseWithSchemaAsync(input, this.schema);
  }

  _parseText(text: string): Output {
    if (this.schema._parseText) {
      return this.schema._parseText(text);
    }
    return text as Output;
  }

  _writeSync(data: Output, options?: XmlWriteOptions): string {
    return this.schema._writeSync(data, options);
  }

  async _write(data: Output, stream: WritableStream<Uint8Array>, options?: XmlWriteOptions): Promise<void> {
    return this.schema._write(data, stream, options);
  }

  writer(config: Parameters<XmlSchemaBase<Output, Input>['writer']>[0]): this {
    this.schema.writer(config);
    return this;
  }

  get compiledPlan(): CompiledSchemaPlan {
    return this.plan;
  }
}

const defaultEventFilter: ParserEventFilter = {
  includeAttributes: true,
  includeCharacters: true,
  includeCdata: true
};

function buildCompiledPlan(schema: XmlObjectSchema<XmlObjectShape>): CompiledSchemaPlan {
  const objectFieldTemplates = new WeakMap<XmlObjectSchema<XmlObjectShape>, ObjectFieldTemplate[]>();
  const rootPlan: RootFieldPlan[] = [];
  const eventFilter: ParserEventFilter = {
    includeAttributes: false,
    includeCharacters: false,
    includeCdata: false
  };
  const visited = new WeakSet<XmlSchemaBase<unknown, unknown>>();

  const recordXPath = (xpath: string, schemaForXpath: XmlSchemaBase<unknown, unknown>) => {
    const compiled = XPathCompiler.compile(xpath);
    if (xpathNeedsAttributes(compiled)) {
      eventFilter.includeAttributes = true;
    }
    if (schemaNeedsText(schemaForXpath, compiled)) {
      eventFilter.includeCharacters = true;
      eventFilter.includeCdata = true;
    }
  };

  const collectObjectTemplates = (objectSchema: XmlObjectSchema<XmlObjectShape>) => {
    const existing = objectFieldTemplates.get(objectSchema);
    if (existing) return existing;
    const templates: ObjectFieldTemplate[] = [];
    objectFieldTemplates.set(objectSchema, templates);

    for (const [fieldName, fieldSchema] of Object.entries(objectSchema.shape)) {
      const xpath = extractXPath(fieldSchema);
      if (xpath) {
        templates.push({ fieldName, schema: fieldSchema, xpath });
        recordXPath(xpath, fieldSchema);
      }
      traverseSchema(fieldSchema);
    }

    return templates;
  };

  const traverseSchema = (schemaToTraverse: XmlSchemaBase<unknown, unknown>) => {
    const unwrapped = unwrapSchema(schemaToTraverse);
    if (visited.has(unwrapped)) return;
    visited.add(unwrapped);

    if (isObjectSchema(unwrapped)) {
      collectObjectTemplates(unwrapped);
      return;
    }

    if (isArraySchema(unwrapped)) {
      traverseSchema(unwrapped.element);
      const xpath = extractXPath(unwrapped);
      if (xpath) {
        recordXPath(xpath, unwrapped);
      }
      return;
    }

    const xpath = extractXPath(unwrapped);
    if (xpath) {
      recordXPath(xpath, unwrapped);
    }
  };

  for (const [fieldName, fieldSchema] of Object.entries(schema.shape)) {
    const xpath = extractXPath(fieldSchema);
    const unwrapped = unwrapSchema(fieldSchema);

    if (!xpath && isObjectSchema(unwrapped)) {
      const childTemplates = collectObjectTemplates(unwrapped);
      rootPlan.push({ kind: 'object', fieldName, schema: fieldSchema, childTemplates });
      continue;
    }

    if (!xpath && isArraySchema(unwrapped)) {
      const elementXPath = extractXPath(unwrapped.element);
      if (elementXPath) {
        recordXPath(elementXPath, unwrapped.element);
        rootPlan.push({ kind: 'array', fieldName, schema: fieldSchema, elementXPath });
      }
      continue;
    }

    if (xpath) {
      rootPlan.push({ kind: 'direct', fieldName, schema: fieldSchema, xpath });
      recordXPath(xpath, fieldSchema);
      continue;
    }
  }

  if (!eventFilter.includeAttributes && !eventFilter.includeCharacters && !eventFilter.includeCdata) {
    return {
      rootPlan,
      objectFieldTemplates,
      eventFilter: { ...defaultEventFilter }
    };
  }

  return {
    rootPlan,
    objectFieldTemplates,
    eventFilter
  };
}

function unwrapSchema(schema: XmlSchemaBase<unknown, unknown>): XmlSchemaBase<unknown, unknown> {
  let current: XmlSchemaBase<unknown, unknown> = schema;
  while (isOptionalSchema(current) || isTransformSchema(current)) {
    current = current.schema;
  }
  return current;
}

function extractXPath(schema: XmlSchemaBase<unknown, unknown>): string | undefined {
  const unwrapped = unwrapSchema(schema);

  if ('xpath' in unwrapped) {
    const xpathProp = (unwrapped as { xpath?: unknown }).xpath;
    if (typeof xpathProp === 'string') {
      return xpathProp;
    }
  }

  if ('options' in unwrapped) {
    const opts = (unwrapped as { options?: unknown }).options;
    if (opts && typeof opts === 'object' && 'xpath' in opts) {
      const xpath = (opts as { xpath?: unknown }).xpath;
      if (typeof xpath === 'string') {
        return xpath;
      }
    }
  }

  return undefined;
}

function schemaNeedsText(schema: XmlSchemaBase<unknown, unknown>, compiled: CompiledXPath): boolean {
  const unwrapped = unwrapSchema(schema);
  const lastSegment = compiled.segments[compiled.segments.length - 1];

  if (lastSegment?.isTextNode) return true;
  if (lastSegment?.isAttribute) return false;

  if (isStringSchema(unwrapped) || isNumberSchema(unwrapped)) return true;
  if (isArraySchema(unwrapped)) {
    const elementUnwrapped = unwrapSchema(unwrapped.element);
    return isStringSchema(elementUnwrapped) || isNumberSchema(elementUnwrapped);
  }
  return false;
}

function xpathNeedsAttributes(compiled: CompiledXPath): boolean {
  for (const segment of compiled.segments) {
    if (segment.isAttribute) return true;
    if (segment.predicates.some(predicate => predicate.type === 'attribute')) return true;
  }
  return false;
}

function assertNoCompiledSchema(schema: XmlSchemaBase<unknown, unknown>): void {
  const visited = new WeakSet<XmlSchemaBase<unknown, unknown>>();
  const stack: XmlSchemaBase<unknown, unknown>[] = [schema];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (current instanceof CompiledXmlSchema) {
      throw new Error('compile() must be called only on the root schema');
    }
    const unwrapped = unwrapSchema(current);
    if (visited.has(unwrapped)) continue;
    visited.add(unwrapped);

    if (isObjectSchema(unwrapped)) {
      for (const fieldSchema of Object.values(unwrapped.shape)) {
        stack.push(fieldSchema);
      }
      continue;
    }

    if (isArraySchema(unwrapped)) {
      stack.push(unwrapped.element);
    }
  }
}
