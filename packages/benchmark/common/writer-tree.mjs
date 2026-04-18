/**
 * Precompiled writer tree to keep benchmark time focused on writer calls
 * instead of repeated JSON-shape adaptation.
 */

function normalizeAttributes(rawAttributes) {
  if (!rawAttributes || typeof rawAttributes !== 'object') {
    return undefined;
  }

  let normalized;
  for (const attrKey in rawAttributes) {
    const normalizedKey = attrKey.charCodeAt(0) === 64 && attrKey.charCodeAt(1) === 95
      ? attrKey.slice(2)
      : attrKey;

    if (!normalized) {
      normalized = {};
    }
    normalized[normalizedKey] = rawAttributes[attrKey];
  }

  return normalized;
}

function normalizeFxpElement(name, value) {
  if (Array.isArray(value)) {
    const nodes = [];
    for (const item of value) {
      nodes.push(normalizeFxpElement(name, item));
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
      openOptions: undefined,
      text: String(value)
    };
  }

  const attributes = normalizeAttributes(value._attr);
  const text = value.__text !== undefined ? String(value.__text) : undefined;
  const children = [];

  for (const key in value) {
    if (key === '_attr' || key === '__text') {
      continue;
    }
    const child = normalizeFxpElement(key, value[key]);
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

export function normalizeFxpWriterTree(root) {
  const nodes = [];
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

function normalizeOrderedNode(name, value) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return {
        name,
        selfClosingOptions: { selfClosing: true }
      };
    }

    if (value.length === 1) {
      const item = value[0];
      if (item && typeof item === 'object' && item['#text'] !== undefined && Object.keys(item).length === 1) {
        return {
          name,
          text: String(item['#text'])
        };
      }
    }

    const children = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      if (item['#text'] !== undefined && Object.keys(item).length === 1) {
        return {
          name,
          text: String(item['#text'])
        };
      }
      for (const childName in item) {
        children.push(normalizeOrderedNode(childName, item[childName]));
      }
    }
    return {
      name,
      children
    };
  }

  if (value && typeof value === 'object') {
    if (value['#text'] !== undefined && Object.keys(value).length === 1) {
      return {
        name,
        text: String(value['#text'])
      };
    }

    const children = [];
    for (const childName in value) {
      children.push(normalizeOrderedNode(childName, value[childName]));
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

export function normalizeOrderedWriterTree(root) {
  const nodes = [];
  for (const key in root) {
    nodes.push(normalizeOrderedNode(key, root[key]));
  }
  return nodes;
}

export function writeWriterTreeSync(writer, nodes) {
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

export async function writeWriterTreeAsync(writer, nodes) {
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
