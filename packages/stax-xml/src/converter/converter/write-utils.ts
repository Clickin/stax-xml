import type { AttributeInfo, WriteElementOptions } from '@stax-xml/core';
import type { XmlElementWriteConfig, XmlWriteOptions } from './types.js';
import type { XmlSchemaBase } from './base.js';

const ROOT_WRITE_CONFIG = Symbol('rootWriteConfig');
const OWN_WRITE_CONFIG = Symbol('ownWriteConfig');

type InternalWriteOptions = XmlWriteOptions & {
  [ROOT_WRITE_CONFIG]?: XmlElementWriteConfig;
  [OWN_WRITE_CONFIG]?: XmlElementWriteConfig;
};

export function getWriteConfig(schema: XmlSchemaBase<unknown, unknown>): XmlElementWriteConfig | undefined {
  const configured = (schema as unknown as { writeConfig?: XmlElementWriteConfig }).writeConfig;
  if (configured) return configured;
  if (schema.schemaType === 'OPTIONAL' && 'schema' in schema) {
    return getWriteConfig((schema as unknown as { schema: XmlSchemaBase<unknown, unknown> }).schema);
  }
  return undefined;
}

export function getRootWriteConfig(options?: XmlWriteOptions): XmlElementWriteConfig | undefined {
  return (options as InternalWriteOptions | undefined)?.[ROOT_WRITE_CONFIG];
}

export function getOwnWriteConfig(options?: XmlWriteOptions): XmlElementWriteConfig | undefined {
  return (options as InternalWriteOptions | undefined)?.[OWN_WRITE_CONFIG];
}

export function rootWriteOptions(
  options: XmlWriteOptions | undefined,
  config?: XmlElementWriteConfig
): XmlWriteOptions | undefined {
  if (!config || getRootWriteConfig(options)) return options;
  const configured: InternalWriteOptions = { ...options, [ROOT_WRITE_CONFIG]: config };
  return configured;
}

export function ownWriteOptions(
  options: XmlWriteOptions | undefined,
  config?: XmlElementWriteConfig
): XmlWriteOptions | undefined {
  if (!config) return options;
  const configured: InternalWriteOptions = { ...options, [OWN_WRITE_CONFIG]: config };
  return configured;
}

export function nestedWriteOptions(
  options: XmlWriteOptions | undefined,
  writer: NonNullable<XmlWriteOptions['writer']>,
  rootElement: string | undefined,
  config?: XmlElementWriteConfig
): XmlWriteOptions {
  const nested: InternalWriteOptions = {
    ...options,
    writer,
    rootElement,
    includeDeclaration: false
  };
  delete nested[OWN_WRITE_CONFIG];
  if (config) nested[ROOT_WRITE_CONFIG] = config;
  else delete nested[ROOT_WRITE_CONFIG];
  return nested;
}

export function elementOptions(
  config: XmlElementWriteConfig | undefined,
  extra: { attributes?: Record<string, string | AttributeInfo>; selfClosing?: boolean } = {}
): WriteElementOptions {
  return {
    prefix: config?.namespace?.prefix,
    uri: config?.namespace?.uri,
    comment: config?.comment,
    attributes: extra.attributes,
    selfClosing: extra.selfClosing
  };
}
