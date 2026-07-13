import type { XmlSchemaBase } from './base.js';
import type { ParserEventFilter } from '@stax-xml/core';
export type DispatchValueKind = 'string' | 'number' | 'object' | 'array';
export type DispatchTransform = (value: unknown) => unknown;

export type DispatchSelectorMode = 'absolute' | 'relative' | 'descendant';
export type DispatchSelectorTerminal = 'element' | 'attribute';
export type DispatchTextMode = 'subtree' | 'direct';

export interface DispatchSelector {
  mode: DispatchSelectorMode;
  segments: string[];
  positionFilters?: Array<number | undefined>;
  terminal: DispatchSelectorTerminal;
  attributeName?: string;
  textMode: DispatchTextMode;
  lastElementName?: string;
}

export interface DispatchBasePlan {
  id: number;
  kind: DispatchValueKind;
  schema: XmlSchemaBase<unknown, unknown>;
  unwrappedSchema: XmlSchemaBase<unknown, unknown>;
  optional: boolean;
  transforms: DispatchTransform[];
  selector?: DispatchSelector;
}

export interface DispatchScalarPlan extends DispatchBasePlan {
  kind: 'string' | 'number';
}

export interface DispatchFieldPlan {
  fieldName: string;
  value: DispatchValuePlan;
}

export interface DispatchFieldAction {
  objectPlanId: number;
  field: DispatchFieldPlan;
}

export interface DispatchObjectPlan extends DispatchBasePlan {
  kind: 'object';
  fields: DispatchFieldPlan[];
  inline: boolean;
}

export interface DispatchArrayPlan extends DispatchBasePlan {
  kind: 'array';
  element: DispatchValuePlan;
  itemSelector: DispatchSelector;
}

export type DispatchValuePlan =
  | DispatchScalarPlan
  | DispatchObjectPlan
  | DispatchArrayPlan;

export type DispatchStartAction =
  | { op: 'start-root'; slot: number; path: number }
  | { op: 'start-array-item'; slot: number; path: number }
  | { op: 'start-field'; objectSlot: number; slot: number; fieldName: string; path: number };

export interface DispatchStartBucket {
  actions: DispatchStartAction[];
}

export type DispatchTextAction = { op: 'append-captures' };
export type DispatchEndAction = { op: 'finish-captures' } | { op: 'finalize-values' };

export type DispatchEndElementAction =
  | { op: 'finish-field'; objectSlot: number; slot: number; fieldName: string; path: number }
  | { op: 'finish-array-item'; slot: number; path: number };

export interface DispatchEndBucket {
  actions: DispatchEndElementAction[];
}

export interface DispatchIrSlot {
  slot: number;
  value: DispatchValuePlan;
  globalActive: boolean;
  depthActive: boolean;
  parentSlot?: number;
  fieldName?: string;
  binding: 'root' | 'field' | 'array-item';
  children: number[];
}

export interface DispatchIrPath {
  path: number;
  selector: DispatchSelector;
}

export interface DispatchIrCapture {
  slot: number;
  path: number;
  textMode: DispatchTextMode;
}

export interface DispatchIrProgram {
  slots: DispatchIrSlot[];
  slotsById: Array<DispatchIrSlot | undefined>;
  paths: DispatchIrPath[];
  captures: DispatchIrCapture[];
  byElement: Record<string, DispatchStartBucket>;
  byEndElement: Record<string, DispatchEndBucket>;
  onOpen: Array<DispatchFieldAction[] | undefined>;
  onText: DispatchTextAction[];
  onEnd: DispatchEndAction[];
}

export interface DispatchCompiledPlan {
  kind: 'dispatch';
  root: DispatchValuePlan;
  eventFilter: ParserEventFilter;
  ir: DispatchIrProgram;
}
