import type { XmlSchemaBase } from './base.js';
import type { ParserEventFilter } from '../types.js';
import type { XmlObjectSchema, XmlObjectShape } from './XmlObjectSchema.js';

export type ObjectFieldTemplate = {
  fieldName: string;
  schema: XmlSchemaBase<unknown, unknown>;
  xpath: string;
};

export type RootFieldPlan =
  | { kind: 'direct'; fieldName: string; schema: XmlSchemaBase<unknown, unknown>; xpath: string }
  | { kind: 'object'; fieldName: string; schema: XmlSchemaBase<unknown, unknown>; childTemplates: ObjectFieldTemplate[] }
  | { kind: 'array'; fieldName: string; schema: XmlSchemaBase<unknown, unknown>; elementXPath: string };

export interface CompiledSchemaPlan {
  rootPlan: RootFieldPlan[];
  objectFieldTemplates: WeakMap<XmlObjectSchema<XmlObjectShape>, ObjectFieldTemplate[]>;
  eventFilter: ParserEventFilter;
}
