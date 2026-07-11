import type { XmlSchemaBase } from './base.js';
import type { ParserEventFilter } from 'stax-xml-core';
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

export interface DispatchCompiledPlan {
  kind: 'dispatch';
  root: DispatchValuePlan;
  eventFilter: ParserEventFilter;
}
