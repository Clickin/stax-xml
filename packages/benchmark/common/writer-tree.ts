/**
 * Precompiled writer tree to keep benchmark time focused on writer calls
 * instead of repeated JSON-shape adaptation.
 */

export interface WriterTreeNode {
  name: string;
  openOptions?: { attributes: Record<string, string> };
  selfClosingOptions?: { attributes?: Record<string, string>; selfClosing: true };
  text?: string;
  children?: WriterTreeNode[];
}

function normalizeAttributes(rawAttributes: unknown): Record<string, string> | undefined {
  if (!rawAttributes || typeof rawAttributes !== 'object') {
    return undefined;
  }

  let normalized: Record<string, string> | undefined;
  const attributes = rawAttributes as Record<string, string>;
  for (const attrKey in attributes) {
    const normalizedKey = attrKey.charCodeAt(0) === 64 && attrKey.charCodeAt(1) === 95
      ? attrKey.slice(2)
      : attrKey;

    if (!normalized) {
      normalized = {};
    }
    normalized[normalizedKey] = attributes[attrKey]!;
  }

  return normalized;
}

function normalizeFxpElement(name: string, value: unknown): WriterTreeNode | WriterTreeNode[] {
  if (Array.isArray(value)) {
    const nodes: WriterTreeNode[] = [];
    for (const item of value) {
      nodes.push(normalizeFxpElement(name, item) as WriterTreeNode);
    }
    return nodes;
  }

  if (value === undefined || value === null) {
    return {
      name,
      selfClosingOptions: { selfClosing: true }
    };
  }

  if (typeof value !== 'object') {
    return {
      name,
      text: String(value)
    };
  }

  const objectValue = value as Record<string, unknown>;
  const attributes = normalizeAttributes(objectValue._attr);
  const text = objectValue.__text !== undefined ? String(objectValue.__text) : undefined;
  const children: WriterTreeNode[] = [];

  for (const key in objectValue) {
    if (key === '_attr' || key === '__text') {
      continue;
    }
    const child = normalizeFxpElement(key, objectValue[key]);
    if (Array.isArray(child)) {
      for (const node of child) {
        children.push(node);
      }
    } else {
      children.push(child);
    }
  }

  if (children.length === 0 && text === undefined) {
    return attributes
      ? { name, selfClosingOptions: { attributes, selfClosing: true } }
      : { name, selfClosingOptions: { selfClosing: true } };
  }

  return {
    name,
    openOptions: attributes ? { attributes } : undefined,
    text,
    children: children.length > 0 ? children : undefined
  };
}

export function normalizeFxpWriterTree(root: Record<string, unknown>): WriterTreeNode[] {
  const nodes: WriterTreeNode[] = [];
  for (const key in root) {
    if (key === '_attr' || key === '__text') {
      continue;
    }
    const node = normalizeFxpElement(key, root[key]);
    if (Array.isArray(node)) {
      for (const item of node) {
        nodes.push(item);
      }
    } else {
      nodes.push(node);
    }
  }
  return nodes;
}

function normalizeOrderedNode(name: string, value: unknown): WriterTreeNode {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return {
        name,
        selfClosingOptions: { selfClosing: true }
      };
    }

    if (value.length === 1) {
      const item = value[0] as Record<string, unknown> | undefined;
      if (item && typeof item === 'object' && item['#text'] !== undefined && Object.keys(item).length === 1) {
        return {
          name,
          text: String(item['#text'])
        };
      }
    }

    const children: WriterTreeNode[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const objectItem = item as Record<string, unknown>;
      if (objectItem['#text'] !== undefined && Object.keys(objectItem).length === 1) {
        return {
          name,
          text: String(objectItem['#text'])
        };
      }
      for (const childName in objectItem) {
        children.push(normalizeOrderedNode(childName, objectItem[childName]));
      }
    }
    return {
      name,
      children
    };
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    if (objectValue['#text'] !== undefined && Object.keys(objectValue).length === 1) {
      return {
        name,
        text: String(objectValue['#text'])
      };
    }

    const children: WriterTreeNode[] = [];
    for (const childName in objectValue) {
      children.push(normalizeOrderedNode(childName, objectValue[childName]));
    }
    return {
      name,
      children
    };
  }

  return {
    name,
    text: String(value)
  };
}

export function normalizeOrderedWriterTree(root: Record<string, unknown>): WriterTreeNode[] {
  const nodes: WriterTreeNode[] = [];
  for (const key in root) {
    nodes.push(normalizeOrderedNode(key, root[key]));
  }
  return nodes;
}

export function writeWriterTreeSync(
  writer: { writeStartElement(name: string, options?: { attributes?: Record<string, string>; selfClosing?: boolean }): unknown; writeCharacters(text: string): unknown; writeEndElement(): unknown },
  nodes: WriterTreeNode[],
): void {
  for (const node of nodes) {
    if (node.selfClosingOptions) {
      writer.writeStartElement(node.name, node.selfClosingOptions);
      continue;
    }

    writer.writeStartElement(node.name, node.openOptions);
    if (node.text !== undefined) {
      writer.writeCharacters(node.text);
    }
    if (node.children) {
      writeWriterTreeSync(writer, node.children);
    }
    writer.writeEndElement();
  }
}

export async function writeWriterTreeAsync(
  writer: { writeStartElement(name: string, options?: { attributes?: Record<string, string>; selfClosing?: boolean }): Promise<unknown>; writeCharacters(text: string): Promise<unknown>; writeEndElement(): Promise<unknown> },
  nodes: WriterTreeNode[],
): Promise<void> {
  for (const node of nodes) {
    if (node.selfClosingOptions) {
      await writer.writeStartElement(node.name, node.selfClosingOptions);
      continue;
    }

    await writer.writeStartElement(node.name, node.openOptions);
    if (node.text !== undefined) {
      await writer.writeCharacters(node.text);
    }
    if (node.children) {
      await writeWriterTreeAsync(writer, node.children);
    }
    await writer.writeEndElement();
  }
}
