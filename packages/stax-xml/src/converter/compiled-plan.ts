import type { XmlSchemaBase } from './base.js';
import type { ParserEventFilter } from '../types.js';
import type { XPathMatcherTemplate } from './XPathEngine.js';

export type CollectorKind = 'string' | 'number' | 'array' | 'object';
export type DispatchValueKind = 'string' | 'number' | 'object' | 'array';
export type DispatchTransform = (value: unknown) => unknown;

export type ActivationMatchProfile =
  | { mode: 'default' }
  | { mode: 'descendant' }
  | { mode: 'relative-attribute' }
  | { mode: 'relative-element'; expectedDepthOffset: number; expectedElementName: string };

export type ObjectFieldTemplate = {
  fieldName: string;
  schema: XmlSchemaBase<unknown, unknown>;
  unwrappedSchema: XmlSchemaBase<unknown, unknown>;
  xpath: string;
  matcherTemplate: XPathMatcherTemplate;
  collectorKind: CollectorKind;
  isArraySchema: boolean;
  isAttributeSelector: boolean;
  attributeName?: string;
  isTextNodeSelector: boolean;
  matchProfile: ActivationMatchProfile;
};

export type RootFieldPlan =
  | { kind: 'direct'; fieldName: string; schema: XmlSchemaBase<unknown, unknown>; xpath: string }
  | { kind: 'object'; fieldName: string; schema: XmlSchemaBase<unknown, unknown>; childTemplates: ObjectFieldTemplate[] }
  | { kind: 'array'; fieldName: string; schema: XmlSchemaBase<unknown, unknown>; elementXPath: string };

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
  rootFieldName?: string;
}

export interface RuntimeCompiledPlan {
  kind: 'runtime';
  reason: string;
  eventFilter: ParserEventFilter;
  rootFieldName?: string;
}

export type CompiledSchemaPlan = DispatchCompiledPlan | RuntimeCompiledPlan;
