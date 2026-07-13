import { NEED_INPUT, TokenCursor, XmlEventType } from '@stax-xml/core';
import type {
  DispatchFieldPlan,
  DispatchRecordArrayPlan,
  DispatchRecordProjectionPlan,
  DispatchScalarPlan,
  DispatchSelector,
  DispatchStartAction,
  DispatchEndElementAction
} from './compiled-plan.js';
import type { ParseOptions } from './types.js';
import {
  applyTransforms,
  compileObjectFactory,
  parseScalar,
  warnCodeGenerationFallback
} from './CompiledRootProcessor.js';

const parserCache = new WeakMap<DispatchRecordProjectionPlan, CompiledParser>();

type ObjectFactory = () => Record<string, unknown>;
type CompiledParser = <T>(input: string | Uint8Array, options?: ParseOptions) => T;
type RecordProcessor = (runtime: Runtime, cursor: TokenCursor, program: RecordProgram) => void;

type ArrayProgram = {
  plan: DispatchRecordArrayPlan;
  createRecord: ObjectFactory;
  fieldIndices: number[];
};

type RecordProgram = {
  plan: DispatchRecordProjectionPlan;
  createRoot: ObjectFactory;
  arrays: ArrayProgram[];
  fields: DispatchFieldPlan[];
  scalarPlans: DispatchScalarPlan[];
  selectors: DispatchSelector[];
  fieldArrayIndices: number[];
  arrayIndexBySlot: Map<number, number>;
  fieldIndexBySlot: Map<number, number>;
};

type Runtime = {
  depth: number;
  eventCount: number;
  maxDepth: number;
  maxEvents: number;
  trimText: boolean;
  stack: string[];
  root: Record<string, unknown>;
  items: unknown[][];
  records: Array<Record<string, unknown> | undefined>;
  recordDepths: number[];
  done: boolean[];
  captureDepths: number[];
  buffers: string[];
};

export class CompiledRecordProjection {
  private constructor(
    private readonly parser: CompiledParser,
    private readonly options?: ParseOptions
  ) {}

  static create(
    plan: DispatchRecordProjectionPlan,
    options?: ParseOptions
  ): CompiledRecordProjection | undefined {
    let parser = parserCache.get(plan);
    if (!parser) {
      const program = compileProgram(plan);
      const processor = compileProcessor(program);
      if (!processor) return undefined;
      parser = <T>(input: string | Uint8Array, parseOptions?: ParseOptions): T =>
        parse<T>(program, processor, input, parseOptions);
      parserCache.set(plan, parser);
    }
    return new CompiledRecordProjection(parser, options);
  }

  parseSync<T>(input: string | Uint8Array): T {
    return this.parser<T>(input, this.options);
  }
}

function compileProgram(plan: DispatchRecordProjectionPlan): RecordProgram {
  const fields: DispatchFieldPlan[] = [];
  const scalarPlans: DispatchScalarPlan[] = [];
  const selectors: DispatchSelector[] = [];
  const fieldArrayIndices: number[] = [];
  const arrayIndexBySlot = new Map<number, number>();
  const fieldIndexBySlot = new Map<number, number>();
  const arrays: ArrayProgram[] = plan.arrays.map((array, arrayIndex) => {
    arrayIndexBySlot.set(array.array.id, arrayIndex);
    return { plan: array, createRecord: compileObjectFactory(array.item), fieldIndices: [] };
  });

  const addField = (field: DispatchFieldPlan, arrayIndex: number): void => {
    const index = fields.length;
    const scalarPlan = field.value as DispatchScalarPlan;
    const selector = scalarPlan.selector!;
    fields.push(field);
    fieldIndexBySlot.set(field.value.id, index);
    scalarPlans.push(scalarPlan);
    selectors.push(selector);
    fieldArrayIndices.push(arrayIndex);
    if (arrayIndex >= 0) arrays[arrayIndex]!.fieldIndices.push(index);
  };

  for (const field of plan.root.fields) {
    if (field.value.kind !== 'array') addField(field, -1);
  }
  plan.arrays.forEach((array, arrayIndex) => {
    for (const field of array.item.fields) {
      addField(field, arrayIndex);
    }
  });

  return {
    plan,
    createRoot: compileObjectFactory(plan.root),
    arrays,
    fields,
    scalarPlans,
    selectors,
    fieldArrayIndices,
    arrayIndexBySlot,
    fieldIndexBySlot
  };
}

function parse<T>(
  program: RecordProgram,
  processor: RecordProcessor,
  input: string | Uint8Array,
  options?: ParseOptions
): T {
  const runtime: Runtime = {
    depth: 0,
    eventCount: 0,
    maxDepth: options?.maxDepth ?? Infinity,
    maxEvents: options?.maxEvents ?? Infinity,
    trimText: options?.trimText !== false,
    stack: [],
    root: program.createRoot(),
    items: program.arrays.map(() => []),
    records: program.arrays.map(() => undefined),
    recordDepths: program.arrays.map(() => 0),
    done: program.fields.map(() => false),
    captureDepths: program.fields.map(() => 0),
    buffers: program.fields.map(() => '')
  };

  if (typeof input === 'string') {
    processor(runtime, new TokenCursor(input, true, {
      documentMode: options?.documentMode ?? 'fragment'
    }), program);
  } else {
    const cursor = new TokenCursor('', false, {
      documentMode: options?.documentMode ?? 'fragment'
    });
    const decoder = new TextDecoder('utf-8', { fatal: true });
    for (let offset = 0; offset < input.byteLength; offset += 64 * 1024) {
      const text = decoder.decode(input.subarray(offset, Math.min(offset + 64 * 1024, input.byteLength)), { stream: true });
      if (text.length !== 0) {
        cursor.push(text, false);
        processor(runtime, cursor, program);
      }
    }
    cursor.push(decoder.decode(), true);
    processor(runtime, cursor, program);
  }

  for (let index = 0; index < program.arrays.length; index++) {
    const arrayPlan = program.arrays[index]!.plan;
    const plan = arrayPlan.array;
    let value: unknown = plan.optional && runtime.items[index]!.length === 0
      ? undefined
      : runtime.items[index]!;
    if (value !== undefined || plan.transforms.length > 0) value = applyTransforms(plan, value);
    runtime.root[arrayPlan.field.fieldName] = value;
  }
  return applyTransforms(program.plan.root, runtime.root) as T;
}

function compileProcessor(program: RecordProgram): RecordProcessor | undefined {
  try {
    const startCases = new Map<string, string[]>();
    const endCases = new Map<string, string[]>();
    const statement = (table: Map<string, string[]>, name: string, source: string): void => {
      const statements = table.get(name) ?? [];
      statements.push(source);
      table.set(name, statements);
    };
    const parse = (index: number, raw: string): string => {
      const scalar = program.scalarPlans[index]!;
      return scalar.kind === 'string' && !scalar.optional && scalar.transforms.length === 0
        ? raw
        : `parseValue(program.scalarPlans[${index}],${raw})`;
    };
    const startField = (index: number): string => {
      const array = program.fieldArrayIndices[index]!;
      const values = array < 0 ? 'runtime.root' : `runtime.records[${array}]`;
      const selector = program.selectors[index]!;
      const field = JSON.stringify(program.fields[index]!.fieldName);
      if (selector.terminal === 'attribute') {
        return `if(!runtime.done[${index}]){const values=${values};if(values){const raw=cursor.attribute(${JSON.stringify(selector.attributeName!)});` +
          `if(raw!==undefined)values[${field}]=${parse(index, 'raw.value')};runtime.done[${index}]=true;}}`;
      }
      return `if(!runtime.done[${index}]){const values=${values};if(values){runtime.captureDepths[${index}]=runtime.depth;runtime.buffers[${index}]='';}}`;
    };
    const startArray = (index: number): string => {
      const array = program.arrays[index]!;
      const reset = array.fieldIndices.map(field =>
        `runtime.done[${field}]=false;runtime.captureDepths[${field}]=0;runtime.buffers[${field}]='';`
      ).join('');
      const contextual = array.fieldIndices
        .filter(field => !program.selectors[field]!.lastElementName)
        .map(startField)
        .join('');
      return `runtime.records[${index}]=program.arrays[${index}].createRecord();runtime.recordDepths[${index}]=runtime.depth;${reset}${contextual}`;
    };
    const finishField = (index: number): string => {
      const array = program.fieldArrayIndices[index]!;
      const values = array < 0 ? 'runtime.root' : `runtime.records[${array}]`;
      const field = JSON.stringify(program.fields[index]!.fieldName);
      return `if(runtime.captureDepths[${index}]===runtime.depth){const values=${values};if(values){const raw=runtime.trimText?runtime.buffers[${index}].trim():runtime.buffers[${index}];` +
        `values[${field}]=${parse(index, 'raw')};}runtime.done[${index}]=true;runtime.captureDepths[${index}]=0;}`;
    };
    const finishArray = (index: number): string => {
      const array = `program.arrays[${index}]`;
      const value = program.arrays[index]!.plan.item.transforms.length === 0
        ? `record${index}`
        : `applyTransforms(${array}.plan.item,record${index})`;
      return `{const record${index}=runtime.records[${index}];if(record${index}&&runtime.recordDepths[${index}]===runtime.depth){` +
        `runtime.items[${index}].push(${value});runtime.records[${index}]=undefined;runtime.recordDepths[${index}]=0;}}`;
    };
    for (const [name, bucket] of Object.entries(program.plan.ir.byElement)) {
      for (const action of bucket.actions) {
        const index = recordActionIndex(program, action);
        if (index === undefined) continue;
        if (action.op === 'start-array-item') {
          statement(startCases, name, `if(${matchSource(program.arrays[index]!.plan.array.itemSelector, '0')})${startArray(index)}`);
        } else if (action.op === 'start-field') {
          const arrayIndex = program.fieldArrayIndices[index]!;
          const context = arrayIndex < 0 ? '0' : `runtime.recordDepths[${arrayIndex}]`;
          statement(
            startCases,
            name,
            `if(${matchSource(program.selectors[index]!, context)})${startField(index)}`
          );
        }
      }
    }
    for (const [name, bucket] of Object.entries(program.plan.ir.byEndElement)) {
      for (const action of bucket.actions) {
        const index = recordEndActionIndex(program, action);
        if (index === undefined) continue;
        if (action.op === 'finish-field') {
          statement(endCases, name, finishField(index));
        } else {
          statement(endCases, name, finishArray(index));
        }
      }
    }
    const cases = (table: Map<string, string[]>): string => [...table]
      .map(([name, statements]) => `case ${JSON.stringify(name)}:${statements.join('')}break;`)
      .join('');
    const text = program.plan.ir.captures.map(capture => {
      const index = program.fieldIndexBySlot.get(capture.slot);
      if (index === undefined) return '';
      const direct = capture.textMode === 'direct';
      return `d=runtime.captureDepths[${index}];if(d!==0&&${direct ? 'runtime.depth===d' : 'true'})runtime.buffers[${index}]+=value;`;
    }).join('');
    const create = Function(
      'NEED_INPUT', 'XmlEventType', 'parseValue', 'applyTransforms', 'program',
      `return function(runtime,cursor,program){while(true){const type=cursor.next();` +
      `if(type===NEED_INPUT||type===null)return;` +
      `if((type===XmlEventType.CHARACTERS&&!${program.plan.includeCharacters})||` +
      `(type===XmlEventType.CDATA&&!${program.plan.includeCdata}))continue;` +
      `if(runtime.eventCount>=runtime.maxEvents)throw new Error('XML event limit exceeded: '+runtime.maxEvents);runtime.eventCount++;` +
      `if(type===XmlEventType.START_ELEMENT){runtime.depth++;const name=cursor.name();runtime.stack.push(name);` +
      `if(runtime.depth>runtime.maxDepth)throw new Error('XML depth limit exceeded: '+runtime.maxDepth);` +
      `switch(name){${cases(startCases)}}}` +
      `else if(type===XmlEventType.CHARACTERS||type===XmlEventType.CDATA){const value=cursor.text();let d;${text}}` +
      `else if(type===XmlEventType.END_ELEMENT){const name=runtime.stack[runtime.depth-1];switch(name){${cases(endCases)}}` +
      `runtime.stack.pop();runtime.depth--;}}}`
    ) as (...values: unknown[]) => RecordProcessor;
    return create(
      NEED_INPUT, XmlEventType, parseValue, applyTransforms, program
    );
  } catch {
    warnCodeGenerationFallback();
    return undefined;
  }
}

function recordActionIndex(program: RecordProgram, action: DispatchStartAction): number | undefined {
  if (action.op === 'start-array-item') return program.arrayIndexBySlot.get(action.slot);
  if (action.op === 'start-field') return program.fieldIndexBySlot.get(action.slot);
  return undefined;
}

function recordEndActionIndex(program: RecordProgram, action: DispatchEndElementAction): number | undefined {
  if (action.op === 'finish-array-item') return program.arrayIndexBySlot.get(action.slot);
  return program.fieldIndexBySlot.get(action.slot);
}

function matchSource(selector: DispatchSelector, context: string): string {
  const segments = selector.segments;
  const offset = selector.mode === 'absolute'
    ? '0'
    : selector.mode === 'descendant'
      ? `runtime.depth-${segments.length}`
      : context;
  const depth = selector.mode === 'absolute'
    ? `runtime.depth===${segments.length}`
    : selector.mode === 'descendant'
      ? `runtime.depth>=${segments.length}`
      : `runtime.depth===${context}+${segments.length}`;
  const compareLength = segments.length - (selector.lastElementName ? 1 : 0);
  const comparisons: string[] = [depth];
  for (let index = 0; index < compareLength; index++) {
    comparisons.push(`runtime.stack[${offset}+${index}]===${JSON.stringify(segments[index])}`);
  }
  return comparisons.join('&&');
}

function parseValue(plan: DispatchScalarPlan, raw: string): unknown {
  return plan.kind === 'string' && !plan.optional && plan.transforms.length === 0
    ? raw
    : parseScalar(plan, raw, false);
}
