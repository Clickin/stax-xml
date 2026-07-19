import type { AnyXmlEvent, ParserEventFilter } from "@stax-xml/core";
import type { ParseInput } from "./base.js";
import { XmlSchemaBase } from "./base.js";
import { CompiledRootProcessor } from "./CompiledRootProcessor.js";
import type {
  DispatchArrayPlan,
  DispatchCompiledPlan,
  DispatchObjectPlan,
  DispatchScalarPlan,
  DispatchSelector,
  DispatchStartBucket,
  DispatchIrProgram,
  DispatchTransform,
  DispatchValuePlan,
} from "./compiled-plan.js";
import type { ParseOptions } from "./types.js";
import type { XmlArraySchema } from "./XmlArraySchema.js";
import type { XmlObjectSchema, XmlObjectShape } from "./XmlObjectSchema.js";
import {
  isArraySchema,
  isNumberSchema,
  isObjectSchema,
  isOptionalSchema,
  isStringSchema,
  isTransformSchema,
} from "./types.js";
import { XPathCompiler, type CompiledXPath } from "./XPathEngine.js";

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
    this.name = "UnsupportedDispatchPlan";
  }
}

const autoDispatchPlanCache = new WeakMap<
  XmlSchemaBase<unknown, unknown>,
  DispatchCompiledPlan
>();

export function tryParseWithCompiledPlan<Output, Input>(
  schema: XmlSchemaBase<Output, Input>,
  input:
    | string
    | Uint8Array
    | Iterable<Uint8Array>
    | Iterable<readonly Uint8Array[]>
    | Iterable<AnyXmlEvent>,
  options?: ParseOptions,
): Output {
  const plan = tryBuildDispatchPlan(schema);
  if (!isCompiledSyncInput(input)) {
    throw new Error(
      "Input cannot be evaluated by the synchronous streaming converter",
    );
  }

  return new CompiledRootProcessor(plan, options).parseSync<Output>(input);
}

export function precompileWithCompiledPlan<Output, Input>(
  schema: XmlSchemaBase<Output, Input>,
): void {
  const plan = tryBuildDispatchPlan(schema);
  new CompiledRootProcessor(plan);
}

function isCompiledSyncInput(input: unknown): input is ParseInput {
  if (typeof input === "string" || input instanceof Uint8Array) {
    return true;
  }
  if (!input || typeof input !== "object") {
    return false;
  }
  if (input instanceof ReadableStream) {
    return false;
  }
  return (
    Symbol.iterator in input &&
    typeof (input as Iterable<unknown>)[Symbol.iterator] === "function"
  );
}

export async function tryParseAsyncWithCompiledPlan<Output, Input>(
  schema: XmlSchemaBase<Output, Input>,
  input: ParseInput,
  options?: ParseOptions,
): Promise<Output> {
  const plan = tryBuildDispatchPlan(schema);
  return new CompiledRootProcessor(plan, options).parse<Output>(input);
}

function tryBuildDispatchPlan(
  schema: XmlSchemaBase<unknown, unknown>,
): DispatchCompiledPlan {
  const cached = autoDispatchPlanCache.get(schema);
  if (cached !== undefined) {
    return cached;
  }

  const root = unwrapSchema(schema);
  let plan: DispatchCompiledPlan;
  try {
    plan = buildCompiledPlan(schema, root);
  } catch (error) {
    if (error instanceof UnsupportedDispatchPlan) {
      throw new Error(`Unsupported streaming XPath: ${error.message}`);
    }
    throw error;
  }
  autoDispatchPlanCache.set(schema, plan);
  return plan;
}

function buildCompiledPlan(
  schema: XmlSchemaBase<unknown, unknown>,
  unwrappedRoot: XmlSchemaBase<unknown, unknown>,
): DispatchCompiledPlan {
  const rootXPath = extractXPath(schema);
  if (
    !isObjectSchema(unwrappedRoot) &&
    !isStringSchema(unwrappedRoot) &&
    !isNumberSchema(unwrappedRoot) &&
    !rootXPath &&
    !(isArraySchema(unwrappedRoot) && extractArrayItemXPath(unwrappedRoot))
  ) {
    throw new Error(
      "Schema requires xpath: arrays and non-object roots need an explicit selector",
    );
  }

  const context: LoweringContext = {
    nextId: 0,
    eventFilter: {
      includeAttributes: false,
      includeCharacters: false,
      includeCdata: false,
    },
  };

  const root =
    isObjectSchema(unwrappedRoot) && !rootXPath
      ? buildObjectPlan(schema, undefined, false, context, true)
      : buildValuePlan(
          schema,
          rootXPath ? compileSelector(rootXPath, context) : undefined,
          false,
          context,
          Boolean(rootXPath),
        );

  const ir = compileIrProgram(root);
  return {
    root,
    eventFilter: normalizeEventFilter(context.eventFilter),
    ir,
  };
}

function compileIrProgram(root: DispatchValuePlan): DispatchIrProgram {
  const byElement: Record<string, DispatchStartBucket> = Object.create(null);
  const slotsById: DispatchIrProgram["slotsById"] = [];
  const paths: DispatchIrProgram["paths"] = [];
  const onOpen: DispatchIrProgram["onOpen"] = [];
  const seenSlots = new Set<number>();
  const pathsBySelector = new Map<DispatchSelector, number>();
  const bucket = (name: string): DispatchStartBucket =>
    (byElement[name] ??= { actions: [] });

  const addSlot = (
    value: DispatchValuePlan,
    parentSlot?: number,
    fieldName?: string,
  ): void => {
    if (seenSlots.has(value.id)) return;
    seenSlots.add(value.id);
    const entry = {
      slot: value.id,
      value,
      globalActive: false,
      depthActive: false,
      fieldName,
      children: [],
      stateChildren: [],
    };
    slotsById[value.id] = entry;
    if (parentSlot !== undefined) {
      const parent = slotsById[parentSlot];
      /* v8 ignore next -- parent slots are inserted by this same depth-first visit before their children */
      if (!parent)
        throw new Error(`Missing parent converter IR slot: ${parentSlot}`);
      parent.children.push(value.id);
      if (
        value.kind === "array" ||
        (value.kind === "object" && !value.selector)
      ) {
        parent.stateChildren.push(value.id);
      }
    }
  };
  const addPath = (
    selector: DispatchSelector | undefined,
  ): number | undefined => {
    if (!selector) return undefined;
    const existing = pathsBySelector.get(selector);
    if (existing !== undefined) return existing;
    const path = paths.length;
    paths.push({ selector });
    pathsBySelector.set(selector, path);
    return path;
  };
  const markActiveLookup = (slot: number, selector: DispatchSelector): void => {
    const entry = slotsById[slot];
    /* v8 ignore next -- markActiveLookup receives the value slot just added by visit/buildArrayPlan */
    if (!entry) throw new Error(`Missing converter IR active slot: ${slot}`);
    if (selector.mode === "relative") entry.depthActive = true;
    else entry.globalActive = true;
  };

  const visit = (
    value: DispatchValuePlan,
    parentSlot?: number,
    fieldName?: string,
  ): void => {
    addSlot(value, parentSlot, fieldName);
    addPath(value.selector);
    if (value.kind === "array") {
      const path = addPath(value.itemSelector)!;
      const name = value.itemSelector.lastElementName;
      if (name) {
        markActiveLookup(value.id, value.itemSelector);
        bucket(name).actions.push({
          op: "start-array-item",
          slot: value.id,
          path,
        });
      }
      visit(value.element, value.id);
      return;
    }
    if (value.kind !== "object") return;

    for (const field of value.fields) {
      const child = field.value;
      addSlot(child, value.id, field.fieldName);
      addPath(child.selector);
      if (child.kind === "array") {
        visit(child, value.id, field.fieldName);
        continue;
      }
      if (child.kind === "object" && !child.selector) {
        visit(child, value.id, field.fieldName);
        continue;
      }

      const name = child.selector?.lastElementName;
      if (name) {
        const path = addPath(child.selector)!;
        markActiveLookup(value.id, child.selector!);
        bucket(name).actions.push({
          op: "start-field",
          objectSlot: value.id,
          slot: child.id,
          fieldName: field.fieldName,
          path,
        });
      } else {
        (onOpen[value.id] ??= []).push({ objectPlanId: value.id, field });
      }
      if (child.kind === "object") visit(child);
    }
  };

  if (root.kind === "array") {
    visit(root);
  } else {
    addSlot(root);
    const path = addPath(root.selector);
    const name = root.selector?.lastElementName;
    if (name)
      bucket(name).actions.push({
        op: "start-root",
        slot: root.id,
        path: path!,
      });
    if (root.kind === "object") visit(root);
  }
  return {
    slotsById,
    paths,
    byElement,
    onOpen,
    onText: [{ op: "append-captures" }],
    onEnd: [{ op: "finish-captures" }, { op: "finalize-values" }],
  };
}

function normalizeEventFilter(
  eventFilter: ParserEventFilter,
): ParserEventFilter {
  if (
    !eventFilter.includeAttributes &&
    !eventFilter.includeCharacters &&
    !eventFilter.includeCdata
  ) {
    return {
      includeAttributes: true,
      includeCharacters: true,
      includeCdata: true,
    };
  }
  return {
    includeAttributes: eventFilter.includeAttributes,
    includeCharacters: eventFilter.includeCharacters,
    includeCdata: eventFilter.includeCdata,
  };
}

function buildValuePlan(
  schema: XmlSchemaBase<unknown, unknown>,
  selector: DispatchSelector | undefined,
  contextual: boolean,
  context: LoweringContext,
  ignoreOwnXPath = false,
): DispatchValuePlan {
  const effects = unwrapEffects(schema);
  const unwrapped = effects.schema;

  if (isStringSchema(unwrapped)) {
    return buildScalarPlan(
      "string",
      schema,
      effects,
      selector,
      contextual,
      context,
      ignoreOwnXPath,
    );
  }

  if (isNumberSchema(unwrapped)) {
    return buildScalarPlan(
      "number",
      schema,
      effects,
      selector,
      contextual,
      context,
      ignoreOwnXPath,
    );
  }

  if (isObjectSchema(unwrapped)) {
    return buildObjectPlan(
      schema,
      selector,
      contextual,
      context,
      ignoreOwnXPath,
    );
  }

  // Parent lowering rejects selectorless nested arrays before recursion.
  return buildArrayPlan(schema, effects, selector!, contextual, context);
}

function buildScalarPlan(
  kind: "string" | "number",
  schema: XmlSchemaBase<unknown, unknown>,
  effects: Effects,
  selector: DispatchSelector | undefined,
  contextual: boolean,
  context: LoweringContext,
  ignoreOwnXPath: boolean,
): DispatchScalarPlan {
  const scalarSelector =
    selector ??
    (!ignoreOwnXPath ? selectorFromSchema(schema, context) : undefined);
  if (!scalarSelector) {
    if (!ignoreOwnXPath && contextual) {
      throw new UnsupportedDispatchPlan(
        `${kind} dispatch requires an XPath selector`,
      );
    }
    context.eventFilter.includeCharacters = true;
    context.eventFilter.includeCdata = true;
    return {
      id: nextId(context),
      kind,
      schema,
      unwrappedSchema: effects.schema,
      optional: effects.optional,
      transforms: effects.transforms,
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
    selector: scalarSelector,
  };
}

function buildObjectPlan(
  schema: XmlSchemaBase<unknown, unknown>,
  selector: DispatchSelector | undefined,
  contextual: boolean,
  context: LoweringContext,
  ignoreOwnXPath: boolean,
): DispatchObjectPlan {
  const effects = unwrapEffects(schema);
  const objectSchema = effects.schema as XmlObjectSchema<XmlObjectShape>;

  const objectSelector =
    selector ??
    (!ignoreOwnXPath ? selectorFromSchema(schema, context) : undefined);
  if (objectSelector) {
    assertSelectorContext(objectSelector, contextual);
    if (objectSelector.terminal !== "element") {
      throw new UnsupportedDispatchPlan(
        "Object dispatch only supports element XPath selectors",
      );
    }
  }

  const fieldContextual = contextual || Boolean(objectSelector);
  const fields = Object.entries(objectSchema.shape).map(
    ([fieldName, fieldSchema]) => ({
      fieldName,
      value: buildFieldPlan(fieldSchema, fieldContextual, context),
    }),
  );

  return {
    id: nextId(context),
    kind: "object",
    schema,
    unwrappedSchema: objectSchema,
    optional: effects.optional,
    transforms: effects.transforms,
    selector: objectSelector,
    fields,
  };
}

function buildFieldPlan(
  schema: XmlSchemaBase<unknown, unknown>,
  contextual: boolean,
  context: LoweringContext,
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
  context: LoweringContext,
): DispatchArrayPlan {
  assertSelectorContext(itemSelector, contextual);
  const arraySchema = effects.schema as XmlArraySchema<
    XmlSchemaBase<unknown, unknown>
  >;

  const elementHasOwnXPath = Boolean(extractXPath(arraySchema.element));
  const arrayHasOwnXPath = Boolean(arraySchema.xpath);
  if (arrayHasOwnXPath && elementHasOwnXPath) {
    throw new UnsupportedDispatchPlan(
      "Array dispatch does not support element XPath inside an array XPath yet",
    );
  }

  const element = buildValuePlan(
    arraySchema.element,
    undefined,
    true,
    context,
    true,
  );

  if (itemSelector.terminal === "attribute" && element.kind === "object") {
    throw new UnsupportedDispatchPlan(
      "Attribute array dispatch requires scalar element schemas",
    );
  }

  return {
    id: nextId(context),
    kind: "array",
    schema,
    unwrappedSchema: arraySchema,
    optional: effects.optional,
    transforms: effects.transforms,
    selector: undefined,
    element,
    itemSelector,
  };
}

function compileArraySelector(
  schema: XmlArraySchema<XmlSchemaBase<unknown, unknown>>,
  context: LoweringContext,
): DispatchSelector {
  const xpath = extractArrayItemXPath(schema);
  if (!xpath) {
    throw new UnsupportedDispatchPlan(
      "Array dispatch requires an array XPath or element XPath",
    );
  }
  return compileSelector(xpath, context);
}

function extractArrayItemXPath(
  schema: XmlArraySchema<XmlSchemaBase<unknown, unknown>>,
): string | undefined {
  return schema.xpath ?? extractXPath(schema.element);
}

function selectorFromSchema(
  schema: XmlSchemaBase<unknown, unknown>,
  context: LoweringContext,
): DispatchSelector | undefined {
  const xpath = extractXPath(schema);
  return xpath ? compileSelector(xpath, context) : undefined;
}

function compileSelector(
  xpath: string,
  context: LoweringContext,
): DispatchSelector {
  /* v8 ignore next -- every public xpath setter already enforces absolute, descendant, '.', or './' syntax */
  if (!xpath.startsWith("/") && !xpath.startsWith("./") && xpath !== ".") {
    throw new UnsupportedDispatchPlan(
      `Unsupported ambiguous relative XPath: ${xpath}`,
    );
  }

  let compiled: CompiledXPath;
  try {
    compiled = XPathCompiler.compile(xpath);
    assertSupportedCompiledXPath(xpath, compiled);
    /* v8 ignore start -- schema construction validates this XPath before compiled-plan lowering */
  } catch (error) {
    throw new UnsupportedDispatchPlan(
      `Unsupported XPath '${xpath}': ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  /* v8 ignore stop */

  const lastSegment = compiled.segments[compiled.segments.length - 1];
  const terminal = lastSegment?.isAttribute ? "attribute" : "element";
  const textMode = lastSegment?.isTextNode ? "direct" : "subtree";
  const effectiveSegments =
    lastSegment?.isAttribute || lastSegment?.isTextNode
      ? compiled.segments.slice(0, -1)
      : compiled.segments;
  const segments = effectiveSegments.map((segment) => segment.name);
  const positionFilters = effectiveSegments.map(positionFilterForSegment);
  const hasPositionFilters = positionFilters.some(
    (position) => position !== undefined,
  );
  const attributeName =
    terminal === "attribute" ? lastSegment?.name : undefined;

  if (terminal === "attribute") {
    context.eventFilter.includeAttributes = true;
  } else {
    context.eventFilter.includeCharacters = true;
    context.eventFilter.includeCdata = true;
  }

  /* v8 ignore next -- XPathCompiler rejects '/', '//', and ownerless terminals during schema construction */
  if (segments.length === 0 && (compiled.isAbsolute || compiled.isDescendant)) {
    throw new UnsupportedDispatchPlan(
      `Unsupported XPath without an element owner: ${xpath}`,
    );
  }

  return {
    mode: compiled.isDescendant
      ? "descendant"
      : compiled.isAbsolute
        ? "absolute"
        : "relative",
    segments,
    positionFilters: hasPositionFilters ? positionFilters : undefined,
    terminal,
    attributeName,
    textMode,
    lastElementName: segments[segments.length - 1],
  };
}

function assertSupportedCompiledXPath(
  xpath: string,
  compiled: CompiledXPath,
): void {
  for (const segment of compiled.segments) {
    /* v8 ignore next -- XPathCompiler rejects wildcard segments before a schema can be built */
    if (segment.isWildcard) {
      throw new UnsupportedDispatchPlan(
        `Wildcard XPath is not supported by compiled dispatch: ${xpath}`,
      );
    }
    for (const predicate of segment.predicates) {
      /* v8 ignore next -- XPathCompiler accepts only positive literal position predicates in public schemas */
      if (
        predicate.type === "position" &&
        predicate.position !== undefined &&
        predicate.position > 0
      ) {
        continue;
      }
      /* v8 ignore next -- all other predicate forms are rejected by XPathCompiler at schema construction */
      throw new UnsupportedDispatchPlan(
        `Predicate XPath is not supported by compiled dispatch: ${xpath}`,
      );
    }
  }
}

function positionFilterForSegment(
  segment: CompiledXPath["segments"][number],
): number | undefined {
  const predicate = segment.predicates[0];
  return predicate?.type === "position" &&
    predicate.position !== undefined &&
    predicate.position > 0
    ? predicate.position
    : undefined;
}

function assertSelectorContext(
  selector: DispatchSelector,
  contextual: boolean,
): void {
  if (selector.mode === "relative" && !contextual) {
    throw new UnsupportedDispatchPlan(
      "Relative XPath requires an element context for compiled dispatch",
    );
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

function unwrapSchema(
  schema: XmlSchemaBase<unknown, unknown>,
): XmlSchemaBase<unknown, unknown> {
  let current: XmlSchemaBase<unknown, unknown> = schema;
  while (isOptionalSchema(current) || isTransformSchema(current)) {
    current = current.schema;
  }
  return current;
}

function extractXPath(
  schema: XmlSchemaBase<unknown, unknown>,
): string | undefined {
  const unwrapped = unwrapSchema(schema);
  if (isArraySchema(unwrapped)) return unwrapped.xpath;
  return (unwrapped as unknown as { options: { xpath?: string } }).options
    .xpath;
}

function nextId(context: LoweringContext): number {
  const id = context.nextId;
  context.nextId++;
  return id;
}
