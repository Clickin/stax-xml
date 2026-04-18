import type { XmlSchemaBase } from './base.js';
import type { ParserEventFilter } from '../types.js';
import type { XmlObjectSchema, XmlObjectShape } from './XmlObjectSchema.js';
import type { XPathMatcherTemplate } from './XPathEngine.js';

export type CollectorKind = 'string' | 'number' | 'array' | 'object';

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

export interface CompiledSchemaPlan {
  rootPlan: RootFieldPlan[];
  objectFieldTemplates: WeakMap<XmlObjectSchema<XmlObjectShape>, ObjectFieldTemplate[]>;
  eventFilter: ParserEventFilter;
  rootFieldName?: string;
}
