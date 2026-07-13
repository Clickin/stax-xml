import { NEED_INPUT, TokenCursor, XmlEventType } from '@stax-xml/core';
import type {
  DispatchArrayProjectionPlan,
  DispatchFieldPlan,
  DispatchRecordArrayPlan,
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

type Factory = () => Record<string, unknown>;
type Processor = (runtime: Runtime, cursor: TokenCursor) => void;
type Child = { plan: DispatchRecordArrayPlan; create: Factory; fields: number[] };
type Program = {
  plan: DispatchArrayProjectionPlan;
  createParent: Factory;
  children: Child[];
  fields: DispatchFieldPlan[];
  scalars: DispatchScalarPlan[];
  selectors: DispatchSelector[];
  fieldChildren: number[];
  arrayBySlot: Map<number, number>;
  fieldBySlot: Map<number, number>;
};
type Runtime = {
  depth: number; events: number; maxDepth: number; maxEvents: number; trim: boolean; stack: string[];
  positions: number[];
  result: unknown[]; parent?: Record<string, unknown>; parentDepth: number;
  childRecords: Array<Record<string, unknown> | undefined>; childDepths: number[]; childItems: unknown[][];
  done: boolean[]; captureDepths: number[]; buffers: string[];
};

const cache = new WeakMap<DispatchArrayProjectionPlan, { program: Program; processor: Processor }>();

export class CompiledArrayProjection {
  private constructor(private readonly plan: DispatchArrayProjectionPlan, private readonly options?: ParseOptions) {}

  static create(plan: DispatchArrayProjectionPlan, options?: ParseOptions): CompiledArrayProjection | undefined {
    if (!this.precompile(plan)) return undefined;
    return new CompiledArrayProjection(plan, options);
  }

  static precompile(plan: DispatchArrayProjectionPlan): boolean {
    if (cache.has(plan)) return true;
    const program = compileProgram(plan);
    const processor = compileProcessor(program);
    if (!processor) return false;
    cache.set(plan, { program, processor });
    return true;
  }

  private static compiled(plan: DispatchArrayProjectionPlan): { program: Program; processor: Processor } {
    const compiled = cache.get(plan);
    if (!compiled) throw new Error('Array projection was not precompiled');
    return compiled;
  }

  parseSync<T>(input: string | Uint8Array): T {
    const { program, processor } = CompiledArrayProjection.compiled(this.plan);
    const runtime: Runtime = {
      depth: 0, events: 0, maxDepth: this.options?.maxDepth ?? Infinity,
      maxEvents: this.options?.maxEvents ?? Infinity, trim: this.options?.trimText !== false, stack: [], positions: [],
      result: [], parentDepth: 0,
      childRecords: program.children.map(() => undefined), childDepths: program.children.map(() => 0),
      childItems: program.children.map(() => []), done: program.fields.map(() => false),
      captureDepths: program.fields.map(() => 0), buffers: program.fields.map(() => '')
    };
    if (typeof input === 'string') {
      processor(runtime, new TokenCursor(input, true, { documentMode: this.options?.documentMode ?? 'fragment' }));
    } else {
      const cursor = new TokenCursor('', false, { documentMode: this.options?.documentMode ?? 'fragment' });
      const decoder = new TextDecoder('utf-8', { fatal: true });
      for (let offset = 0; offset < input.byteLength; offset += 64 * 1024) {
        const text = decoder.decode(input.subarray(offset, Math.min(offset + 64 * 1024, input.byteLength)), { stream: true });
        if (text) { cursor.push(text, false); processor(runtime, cursor); }
      }
      cursor.push(decoder.decode(), true); processor(runtime, cursor);
    }
    return (this.plan.root.transforms.length === 0
      ? runtime.result
      : applyTransforms(this.plan.root, runtime.result)) as T;
  }
}

function compileProgram(plan: DispatchArrayProjectionPlan): Program {
  const fields: DispatchFieldPlan[] = [];
  const scalars: DispatchScalarPlan[] = [];
  const selectors: DispatchSelector[] = [];
  const fieldChildren: number[] = [];
  const fieldBySlot = new Map<number, number>();
  const arrayBySlot = new Map<number, number>();
  const children: Child[] = plan.arrays.map((child, index) => {
    arrayBySlot.set(child.array.id, index);
    return { plan: child, create: compileObjectFactory(child.item), fields: [] };
  });
  const addField = (field: DispatchFieldPlan, child: number): void => {
    const scalar = field.value as DispatchScalarPlan;
    const selector = scalar.selector!;
    const index = fields.length;
    fields.push(field); scalars.push(scalar); selectors.push(selector); fieldChildren.push(child);
    fieldBySlot.set(field.value.id, index);
    if (child >= 0) children[child]!.fields.push(index);
  };
  for (const field of plan.item.fields) if (field.value.kind !== 'array') {
    addField(field, -1);
  }
  plan.arrays.forEach((child, index) => {
    for (const field of child.item.fields) addField(field, index);
  });
  return {
    plan, createParent: compileObjectFactory(plan.item), children, fields, scalars, selectors,
    fieldChildren, arrayBySlot, fieldBySlot
  };
}

function compileProcessor(program: Program): Processor | undefined {
  try {
    const usesPositions = program.plan.ir.paths.some(path => path.selector.positionFilters?.some(Boolean));
    const start = new Map<string, string[]>();
    const end = new Map<string, string[]>();
    const add = (table: Map<string, string[]>, name: string, source: string): void => {
      const actions = table.get(name) ?? []; actions.push(source); table.set(name, actions);
    };
    const reset = (child: number): string => program.fields
      .map((_, index) => program.fieldChildren[index] === child
        ? `runtime.done[${index}]=false;runtime.captureDepths[${index}]=0;runtime.buffers[${index}]='';`
        : '')
      .join('');
    const emitParsed = (index: number, raw: string): string => {
      const scalar = program.scalars[index]!;
      return scalar.kind === 'string' && !scalar.optional && scalar.transforms.length === 0
        ? raw
        : `parseValue(program.scalars[${index}],${raw})`;
    };
    const startField = (index: number): string => {
      const child = program.fieldChildren[index]!;
      const values = child < 0 ? 'runtime.parent' : `runtime.childRecords[${child}]`;
      const selector = program.selectors[index]!;
      const field = JSON.stringify(program.fields[index]!.fieldName);
      if (selector.terminal === 'attribute') {
        return `if(!runtime.done[${index}]){const values=${values};if(values){const raw=cursor.attribute(${JSON.stringify(selector.attributeName!)});` +
          `if(raw!==undefined)values[${field}]=${emitParsed(index, 'raw.value')};runtime.done[${index}]=true;}}`;
      }
      return `if(!runtime.done[${index}]){const values=${values};if(values){runtime.captureDepths[${index}]=runtime.depth;runtime.buffers[${index}]='';}}`;
    };
    const contextual = (child: number): string => program.fields
      .map((_, index) => program.fieldChildren[index] === child && !program.selectors[index]!.lastElementName
        ? startField(index)
        : '')
      .join('');
    const openParent = (): string => `if(!runtime.parent){runtime.parent=program.createParent();runtime.parentDepth=runtime.depth;${reset(-1)}` +
      `${program.children.map((_, index) => `runtime.childItems[${index}].length=0;`).join('')}${contextual(-1)}}`;
    const openChild = (index: number): string => `if(runtime.parent){runtime.childRecords[${index}]=program.children[${index}].create();` +
      `runtime.childDepths[${index}]=runtime.depth;${reset(index)}${contextual(index)}}`;
    const finishField = (index: number): string => {
      const child = program.fieldChildren[index]!;
      const values = child < 0 ? 'runtime.parent' : `runtime.childRecords[${child}]`;
      const field = JSON.stringify(program.fields[index]!.fieldName);
      return `if(runtime.captureDepths[${index}]===runtime.depth){const values=${values};` +
        `if(values){const raw=runtime.trim?runtime.buffers[${index}].trim():runtime.buffers[${index}];` +
        `values[${field}]=${emitParsed(index, 'raw')};}runtime.done[${index}]=true;runtime.captureDepths[${index}]=0;}`;
    };
    const closeChild = (index: number): string => {
      const child = `program.children[${index}]`;
      const value = `${child}.plan.item.transforms.length?applyTransforms(${child}.plan.item,child${index}):child${index}`;
      return `{const child${index}=runtime.childRecords[${index}];if(child${index}&&runtime.childDepths[${index}]===runtime.depth){` +
        `runtime.childItems[${index}].push(${value});runtime.childRecords[${index}]=undefined;runtime.childDepths[${index}]=0;}}`;
    };
    const closeParent = (): string => `{const parent=runtime.parent;if(parent&&runtime.parentDepth===runtime.depth){` +
      program.children.map((_, index) => {
        const child = `program.children[${index}]`;
        const transform = program.children[index]!.plan.array.transforms.length === 0
          ? ''
          : `if(value${index}!==undefined||${child}.plan.array.transforms.length)value${index}=applyTransforms(${child}.plan.array,value${index});`;
        return `let value${index}=${child}.plan.array.optional&&runtime.childItems[${index}].length===0?undefined:runtime.childItems[${index}];` +
          transform +
          `parent[${child}.plan.field.fieldName]=value${index};`;
      }).join('') + `${program.plan.item.transforms.length === 0 ? 'runtime.result.push(parent);' : 'runtime.result.push(applyTransforms(program.plan.item,parent));'}` +
      `runtime.parent=undefined;runtime.parentDepth=0;}}`;
    for (const [name, bucket] of Object.entries(program.plan.ir.byElement)) {
      for (const action of bucket.actions) {
        if (action.op !== 'start-root') {
          const index = startIndex(program, action);
          if (index === undefined) continue;
          if (action.op === 'start-array-item') {
            add(start, name, index === -1
              ? `if(${matchSource(program.plan.root.itemSelector, '0')})${openParent()}`
              : `if(${matchSource(program.children[index]!.plan.array.itemSelector, 'runtime.parentDepth')})${openChild(index)}`);
          } else {
            const child = program.fieldChildren[index]!;
            const context = child < 0 ? 'runtime.parentDepth' : `runtime.childDepths[${child}]`;
            add(start, name, `if(${matchSource(program.selectors[index]!, context)})${startField(index)}`);
          }
        }
      }
    }
    for (const [name, bucket] of Object.entries(program.plan.ir.byEndElement)) {
      for (const action of bucket.actions) {
        const index = endIndex(program, action);
        if (index === undefined) continue;
        if (action.op === 'finish-array-item') {
          if (index === -1) add(end, name, closeParent());
          else add(end, name, closeChild(index));
        } else add(end, name, finishField(index));
      }
    }
    const text = program.plan.ir.captures.map(capture => {
      const index = program.fieldBySlot.get(capture.slot); if (index === undefined) return '';
      return `d=runtime.captureDepths[${index}];if(d!==0&&${capture.textMode === 'direct' ? 'runtime.depth===d' : 'true'})runtime.buffers[${index}]+=value;`;
    }).join('');
    const cases = (table: Map<string, string[]>) => [...table]
      .map(([name, actions]) => `case ${JSON.stringify(name)}:${actions.join('')}break;`).join('');
    const updatePosition = usesPositions
      ? 'if(runtime.positions.length<runtime.depth)runtime.positions.push(1);else runtime.positions[runtime.depth-1]++;'
      : '';
    const popPosition = usesPositions
      ? 'if(runtime.positions.length>runtime.depth)runtime.positions.pop();'
      : '';
    const create = Function(
      'NEED_INPUT', 'XmlEventType', 'parseValue', 'applyTransforms', 'program',
      `return function(runtime,cursor){while(true){const type=cursor.next();if(type===NEED_INPUT||type===null)return;` +
      `if((type===XmlEventType.CHARACTERS&&!${program.plan.includeCharacters})||(type===XmlEventType.CDATA&&!${program.plan.includeCdata}))continue;` +
      `if(runtime.events>=runtime.maxEvents)throw new Error('XML event limit exceeded: '+runtime.maxEvents);runtime.events++;` +
      `if(type===XmlEventType.START_ELEMENT){runtime.depth++;const name=cursor.name();runtime.stack.push(name);${updatePosition}if(runtime.depth>runtime.maxDepth)throw new Error('XML depth limit exceeded: '+runtime.maxDepth);switch(name){${cases(start)}}}` +
      `else if(type===XmlEventType.CHARACTERS||type===XmlEventType.CDATA){const value=cursor.text();let d;${text}}` +
      `else if(type===XmlEventType.END_ELEMENT){${popPosition}const name=runtime.stack[runtime.depth-1];switch(name){${cases(end)}}runtime.stack.pop();runtime.depth--;}}}`
    ) as (...args: unknown[]) => Processor;
    return create(NEED_INPUT, XmlEventType, parse, applyTransforms, program);
  } catch {
    warnCodeGenerationFallback();
    return undefined;
  }
}

function startIndex(program: Program, action: DispatchStartAction): number | undefined {
  if (action.op === 'start-array-item') return action.slot === program.plan.root.id ? -1 : program.arrayBySlot.get(action.slot);
  if (action.op === 'start-field') return program.fieldBySlot.get(action.slot);
  return undefined;
}
function endIndex(program: Program, action: DispatchEndElementAction): number | undefined {
  if (action.op === 'finish-array-item') return action.slot === program.plan.root.id ? -1 : program.arrayBySlot.get(action.slot);
  return program.fieldBySlot.get(action.slot);
}

function matchSource(selector: DispatchSelector, context: string): string {
  const segments = selector.segments;
  const offset = selector.mode === 'absolute' ? '0' : selector.mode === 'descendant' ? `runtime.depth-${segments.length}` : context;
  const checks = [selector.mode === 'absolute' ? `runtime.depth===${segments.length}` : selector.mode === 'descendant' ? `runtime.depth>=${segments.length}` : `runtime.depth===${context}+${segments.length}`];
  const length = segments.length - (selector.lastElementName ? 1 : 0);
  for (let index = 0; index < length; index++) checks.push(`runtime.stack[${offset}+${index}]===${JSON.stringify(segments[index])}`);
  for (let index = 0; index < (selector.positionFilters?.length ?? 0); index++) {
    const expected = selector.positionFilters![index];
    if (expected !== undefined) checks.push(`runtime.positions[${offset}+${index}]===${expected}`);
  }
  return checks.join('&&');
}
function parse(plan: DispatchScalarPlan, raw: string): unknown {
  return plan.kind === 'string' && !plan.optional && !plan.transforms.length ? raw : parseScalar(plan, raw, false);
}
