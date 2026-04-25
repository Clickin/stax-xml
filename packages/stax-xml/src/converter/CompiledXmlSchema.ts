import type { ParserEventFilter } from '../types.js';
import {
  AUTO_PARSE_UNHANDLED,
  XmlSchemaBase,
  type AutoParseResult
} from './base.js';
import { CompiledRootProcessor } from './CompiledRootProcessor.js';
import type {
  CompiledSchemaPlan,
  DispatchArrayPlan,
  DispatchCompiledPlan,
  DispatchObjectPlan,
  DispatchScalarPlan,
  DispatchSelector,
  DispatchTransform,
  DispatchValuePlan,
  RuntimeCompiledPlan
} from './compiled-plan.js';
import type { ParseInput } from './XmlSchema.js';
import type { ParseOptions, XmlWriteOptions } from './types.js';
import type { XmlArraySchema } from './XmlArraySchema.js';
import type { XmlObjectSchema, XmlObjectShape } from './XmlObjectSchema.js';
import {
  isArraySchema,
  isNumberSchema,
  isObjectSchema,
  isOptionalSchema,
  isStringSchema,
  isTransformSchema
} from './types.js';
import { XPathCompiler, type CompiledXPath } from './XPathEngine.js';

const SYNTHETIC_ROOT_FIELD = '__root__';

type Effects = {
  schema: XmlSchemaBase<unknown, unknown>;
  optional: boolean;
  transforms: DispatchTransform[];
};

type LoweringContext = {
  nextId: number;
  eventFilter: ParserEventFilter;
};

class UnsupportedDispatchPlan extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedDispatchPlan';
  }
}

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
    assertNoCompiledSchema(unwrapped);
    this.schema = schema;
    this.plan = buildCompiledPlan(schema, unwrapped);
  }

  get schemaType(): XmlSchemaBase<Output, Input>['schemaType'] {
    return this.schema.schemaType;
  }

  _parse(input: ParseInput, options?: ParseOptions): Output {
    if (this.plan.kind === 'dispatch' && typeof input === 'string') {
      return new CompiledRootProcessor(this.plan, options).parseSync<Output>(input);
    }
    return this.schema._parse(input, options);
  }

  async _parseAsync(input: ParseInput, options?: ParseOptions): Promise<Output> {
    if (this.plan.kind === 'dispatch') {
      return new CompiledRootProcessor(this.plan, options).parse<Output>(input);
    }
    return this.schema._parseAsync(input, options);
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

const autoDispatchPlanCache = new WeakMap<XmlSchemaBase<unknown, unknown>, DispatchCompiledPlan | false>();

export function tryParseWithCompiledPlan<Output, Input>(
  schema: XmlSchemaBase<Output, Input>,
  input: string | Iterator<unknown>,
  options?: ParseOptions
): AutoParseResult<Output> {
  if (typeof input !== 'string') {
    return AUTO_PARSE_UNHANDLED;
  }

  const plan = tryBuildDispatchPlan(schema);
  if (!plan) {
    return AUTO_PARSE_UNHANDLED;
  }

  return new CompiledRootProcessor(plan, options).parseSync<Output>(input);
}

export async function tryParseAsyncWithCompiledPlan<Output, Input>(
  schema: XmlSchemaBase<Output, Input>,
  input: ParseInput,
  options?: ParseOptions
): Promise<AutoParseResult<Output>> {
  const plan = tryBuildDispatchPlan(schema);
  if (!plan) {
    return AUTO_PARSE_UNHANDLED;
  }

  return new CompiledRootProcessor(plan, options).parse<Output>(input);
}

function tryBuildDispatchPlan(schema: XmlSchemaBase<unknown, unknown>): DispatchCompiledPlan | undefined {
  if (!(schema instanceof CompiledXmlSchema)) {
    const cached = autoDispatchPlanCache.get(schema);
    if (cached !== undefined) {
      return cached === false ? undefined : cached;
    }
  }

  try {
    const plan = schema instanceof CompiledXmlSchema
      ? schema.compiledPlan
      : (isAutoDispatchEligible(schema) ? buildCompiledPlan(schema, unwrapSchema(schema)) : undefined);
    const dispatchPlan = plan?.kind === 'dispatch' ? plan : undefined;
    if (!(schema instanceof CompiledXmlSchema)) {
      autoDispatchPlanCache.set(schema, dispatchPlan ?? false);
    }
    return dispatchPlan;
  } catch {
    autoDispatchPlanCache.set(schema, false);
    return undefined;
  }
}

function isAutoDispatchEligible(schema: XmlSchemaBase<unknown, unknown>): boolean {
  const root = unwrapSchema(schema);
  return root === schema && isObjectSchema(root) && !extractXPath(root);
}

function buildCompiledPlan(
  schema: XmlSchemaBase<unknown, unknown>,
  unwrappedRoot: XmlSchemaBase<unknown, unknown>
): CompiledSchemaPlan {
  const rootXPath = extractXPath(schema);
  const rootFieldName = isObjectSchema(unwrappedRoot) && !rootXPath ? undefined : SYNTHETIC_ROOT_FIELD;

  if (!isObjectSchema(unwrappedRoot) && !rootXPath && !(isArraySchema(unwrappedRoot) && extractArrayItemXPath(unwrappedRoot))) {
    throw new Error('compile() requires an xpath for non-object roots and xpath-scoped object roots');
  }

  try {
    const context: LoweringContext = {
      nextId: 0,
      eventFilter: {
        includeAttributes: false,
        includeCharacters: false,
        includeCdata: false
      }
    };

    const root = isObjectSchema(unwrappedRoot) && !rootXPath
      ? buildObjectPlan(schema, undefined, false, context, true)
      : buildValuePlan(schema, rootXPath ? compileSelector(rootXPath, context) : undefined, false, context, Boolean(rootXPath));

    return {
      kind: 'dispatch',
      root,
      eventFilter: normalizeEventFilter(context.eventFilter),
      rootFieldName
    };
  } catch (error) {
    if (!(error instanceof UnsupportedDispatchPlan)) {
      throw error;
    }
    return runtimePlan(error.message, rootFieldName);
  }
}

function runtimePlan(reason: string, rootFieldName?: string): RuntimeCompiledPlan {
  return {
    kind: 'runtime',
    reason,
    eventFilter: {
      includeAttributes: true,
      includeCharacters: true,
      includeCdata: true
    },
    rootFieldName
  };
}

function normalizeEventFilter(eventFilter: ParserEventFilter): ParserEventFilter {
  if (!eventFilter.includeAttributes && !eventFilter.includeCharacters && !eventFilter.includeCdata) {
    return {
      includeAttributes: true,
      includeCharacters: true,
      includeCdata: true
    };
  }
  return {
    includeAttributes: eventFilter.includeAttributes,
    includeCharacters: eventFilter.includeCharacters,
    includeCdata: eventFilter.includeCdata
  };
}

function buildValuePlan(
  schema: XmlSchemaBase<unknown, unknown>,
  selector: DispatchSelector | undefined,
  contextual: boolean,
  context: LoweringContext,
  ignoreOwnXPath = false
): DispatchValuePlan {
  const effects = unwrapEffects(schema);
  const unwrapped = effects.schema;

  if (isStringSchema(unwrapped)) {
    return buildScalarPlan('string', schema, effects, selector, contextual, context, ignoreOwnXPath);
  }

  if (isNumberSchema(unwrapped)) {
    return buildScalarPlan('number', schema, effects, selector, contextual, context, ignoreOwnXPath);
  }

  if (isObjectSchema(unwrapped)) {
    return buildObjectPlan(schema, selector, contextual, context, ignoreOwnXPath);
  }

  if (isArraySchema(unwrapped)) {
    if (ignoreOwnXPath && !selector) {
      throw new UnsupportedDispatchPlan('Nested array dispatch is not supported yet');
    }
    const arraySelector = selector ?? compileArraySelector(unwrapped, context);
    return buildArrayPlan(schema, effects, arraySelector, contextual, context);
  }

  throw new UnsupportedDispatchPlan(`Unsupported schema type for compiled dispatch: ${String(unwrapped.schemaType)}`);
}

function buildScalarPlan(
  kind: 'string' | 'number',
  schema: XmlSchemaBase<unknown, unknown>,
  effects: Effects,
  selector: DispatchSelector | undefined,
  contextual: boolean,
  context: LoweringContext,
  ignoreOwnXPath: boolean
): DispatchScalarPlan {
  const scalarSelector = selector ?? (!ignoreOwnXPath ? selectorFromSchema(schema, context) : undefined);
  if (!scalarSelector) {
    if (!ignoreOwnXPath) {
      throw new UnsupportedDispatchPlan(`${kind} dispatch requires an XPath selector`);
    }
    return {
      id: nextId(context),
      kind,
      schema,
      unwrappedSchema: effects.schema,
      optional: effects.optional,
      transforms: effects.transforms
    };
  }
  assertSelectorContext(scalarSelector, contextual);

  return {
    id: nextId(context),
    kind,
    schema,
    unwrappedSchema: effects.schema,
    optional: effects.optional,
    transforms: effects.transforms,
    selector: scalarSelector
  };
}

function buildObjectPlan(
  schema: XmlSchemaBase<unknown, unknown>,
  selector: DispatchSelector | undefined,
  contextual: boolean,
  context: LoweringContext,
  ignoreOwnXPath: boolean
): DispatchObjectPlan {
  const effects = unwrapEffects(schema);
  const objectSchema = effects.schema as XmlObjectSchema<XmlObjectShape>;

  const objectSelector = selector ?? (!ignoreOwnXPath ? selectorFromSchema(schema, context) : undefined);
  if (objectSelector) {
    assertSelectorContext(objectSelector, contextual);
    if (objectSelector.terminal !== 'element') {
      throw new UnsupportedDispatchPlan('Object dispatch only supports element XPath selectors');
    }
  }

  const fieldContextual = contextual || Boolean(objectSelector);
  const fields = Object.entries(objectSchema.shape).map(([fieldName, fieldSchema]) => ({
    fieldName,
    value: buildFieldPlan(fieldSchema, fieldContextual, context)
  }));

  return {
    id: nextId(context),
    kind: 'object',
    schema,
    unwrappedSchema: objectSchema,
    optional: effects.optional,
    transforms: effects.transforms,
    selector: objectSelector,
    fields,
    inline: !objectSelector
  };
}

function buildFieldPlan(
  schema: XmlSchemaBase<unknown, unknown>,
  contextual: boolean,
  context: LoweringContext
): DispatchValuePlan {
  const effects = unwrapEffects(schema);
  const unwrapped = effects.schema;

  if (isObjectSchema(unwrapped)) {
    const selector = selectorFromSchema(schema, context);
    return buildObjectPlan(schema, selector, contextual, context, false);
  }

  if (isArraySchema(unwrapped)) {
    const selector = compileArraySelector(unwrapped, context);
    return buildArrayPlan(schema, effects, selector, contextual, context);
  }

  return buildValuePlan(schema, undefined, contextual, context);
}

function buildArrayPlan(
  schema: XmlSchemaBase<unknown, unknown>,
  effects: Effects,
  itemSelector: DispatchSelector,
  contextual: boolean,
  context: LoweringContext
): DispatchArrayPlan {
  assertSelectorContext(itemSelector, contextual);
  const arraySchema = effects.schema as XmlArraySchema<XmlSchemaBase<unknown, unknown>>;

  const elementHasOwnXPath = Boolean(extractXPath(arraySchema.element));
  const arrayHasOwnXPath = Boolean(arraySchema.xpath);
  if (arrayHasOwnXPath && elementHasOwnXPath) {
    throw new UnsupportedDispatchPlan('Array dispatch does not support element XPath inside an array XPath yet');
  }

  const element = buildValuePlan(
    arraySchema.element,
    undefined,
    true,
    context,
    true
  );

  if (itemSelector.terminal === 'attribute' && element.kind === 'object') {
    throw new UnsupportedDispatchPlan('Attribute array dispatch requires scalar element schemas');
  }

  return {
    id: nextId(context),
    kind: 'array',
    schema,
    unwrappedSchema: arraySchema,
    optional: effects.optional,
    transforms: effects.transforms,
    selector: undefined,
    element,
    itemSelector
  };
}

function compileArraySelector(
  schema: XmlArraySchema<XmlSchemaBase<unknown, unknown>>,
  context: LoweringContext
): DispatchSelector {
  const xpath = extractArrayItemXPath(schema);
  if (!xpath) {
    throw new UnsupportedDispatchPlan('Array dispatch requires an array XPath or element XPath');
  }
  return compileSelector(xpath, context);
}

function extractArrayItemXPath(schema: XmlArraySchema<XmlSchemaBase<unknown, unknown>>): string | undefined {
  return schema.xpath ?? extractXPath(schema.element);
}

function selectorFromSchema(
  schema: XmlSchemaBase<unknown, unknown>,
  context: LoweringContext
): DispatchSelector | undefined {
  const xpath = extractXPath(schema);
  return xpath ? compileSelector(xpath, context) : undefined;
}

function compileSelector(xpath: string, context: LoweringContext): DispatchSelector {
  if (!xpath.startsWith('/') && !xpath.startsWith('./') && xpath !== '.') {
    throw new UnsupportedDispatchPlan(`Unsupported ambiguous relative XPath: ${xpath}`);
  }

  const compiled = XPathCompiler.compile(xpath);
  assertSupportedCompiledXPath(xpath, compiled);

  const lastSegment = compiled.segments[compiled.segments.length - 1];
  const terminal = lastSegment?.isAttribute ? 'attribute' : 'element';
  const textMode = lastSegment?.isTextNode ? 'direct' : 'subtree';
  const segments = (lastSegment?.isAttribute || lastSegment?.isTextNode)
    ? compiled.segments.slice(0, -1).map(segment => segment.name)
    : compiled.segments.map(segment => segment.name);

  if (terminal === 'attribute') {
    context.eventFilter.includeAttributes = true;
  } else {
    context.eventFilter.includeCharacters = true;
    context.eventFilter.includeCdata = true;
  }

  if (segments.length === 0 && (compiled.isAbsolute || compiled.isDescendant)) {
    throw new UnsupportedDispatchPlan(`Unsupported XPath without an element owner: ${xpath}`);
  }

  return {
    mode: compiled.isDescendant ? 'descendant' : (compiled.isAbsolute ? 'absolute' : 'relative'),
    segments,
    terminal,
    attributeName: terminal === 'attribute' ? lastSegment?.name : undefined,
    textMode,
    lastElementName: segments[segments.length - 1]
  };
}

function assertSupportedCompiledXPath(xpath: string, compiled: CompiledXPath): void {
  for (const segment of compiled.segments) {
    if (segment.isWildcard) {
      throw new UnsupportedDispatchPlan(`Wildcard XPath is not supported by compiled dispatch: ${xpath}`);
    }
    if (segment.predicates.length > 0) {
      throw new UnsupportedDispatchPlan(`Predicate XPath is not supported by compiled dispatch: ${xpath}`);
    }
  }
}

function assertSelectorContext(selector: DispatchSelector, contextual: boolean): void {
  if (selector.mode === 'relative' && !contextual) {
    throw new UnsupportedDispatchPlan('Relative XPath requires an element context for compiled dispatch');
  }
}

function unwrapEffects(schema: XmlSchemaBase<unknown, unknown>): Effects {
  const transforms: DispatchTransform[] = [];
  let current: XmlSchemaBase<unknown, unknown> = schema;
  let optional = false;

  while (isOptionalSchema(current) || isTransformSchema(current)) {
    if (isOptionalSchema(current)) {
      optional = true;
      current = current.schema;
      continue;
    }

    transforms.unshift(current.transformFn as DispatchTransform);
    current = current.schema;
  }

  return { schema: current, optional, transforms };
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

function nextId(context: LoweringContext): number {
  const id = context.nextId;
  context.nextId++;
  return id;
}

function assertNoCompiledSchema(schema: XmlSchemaBase<unknown, unknown>): void {
  const visited = new WeakSet<XmlSchemaBase<unknown, unknown>>();
  const stack: XmlSchemaBase<unknown, unknown>[] = [schema];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current instanceof CompiledXmlSchema) {
      throw new Error('compile() must be called only on the root schema');
    }
    const unwrapped = unwrapSchema(current);
    /* v8 ignore next -- cycle guard for user-mutated schemas */
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
