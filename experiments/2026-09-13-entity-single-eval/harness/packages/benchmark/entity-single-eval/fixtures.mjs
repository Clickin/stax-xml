import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURE_SEED = 260913;
export const PROCESS_ORDER_SEED = 90317;
export const VALUE_LENGTHS = [8, 32, 128];
export const FIXTURE_IDS = [
  'ascii-none',
  'unicode-none',
  'astral-none',
  'rare',
  'named-attr',
  'numeric-attr',
  'custom-attr',
  'named-text',
  'mixed',
  'xmlns',
];
export const ACTUAL_FIXTURE_IDS = ['midsize.xml', 'large.xml'];

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCAL_ASSETS = resolve(HERE, '../assets');
const SOURCE_ASSETS = '/Users/senghyunjo/github/stax-xml/packages/benchmark/assets';
const encoder = new TextEncoder();

export const CUSTOM_ENTITIES = Object.freeze([
  { entity: 'company', value: 'Clickin & Co.' },
  { entity: 'empty', value: '' },
  { entity: 'literalAmp', value: 'A&B' },
]);

const TARGET_GROUP_SIZE = 100;
const ASCII_VALUE_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%()*+,-./:;=?@[]^_{|}~';
const UNICODE_VALUE_ALPHABET = Array.from({ length: 2048 }, (_, index) => String.fromCodePoint(0x400 + index));
const ASTRAL_VALUE_ALPHABET = Array.from({ length: 2048 }, (_, index) => String.fromCodePoint(0x10000 + index));
const ENTITY_REFERENCE = /&(?:#(?:x[0-9a-f]+|\d+)|[A-Za-z_:][\w:.-]*);/gu;
const PREDEFINED_ENTITIES = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
]);
const CUSTOM_ENTITY_VALUES = new Map(CUSTOM_ENTITIES.map(({ entity, value }) => [entity, value]));

function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha256Bytes(value) {
  return hashBytes(typeof value === 'string' ? encoder.encode(value) : value);
}

export function sha256File(filePath) {
  return hashBytes(readFileSync(filePath));
}

export function resolveAsset(name, explicitPath) {
  const candidates = [];
  if (explicitPath) candidates.push(resolve(explicitPath));
  candidates.push(join(LOCAL_ASSETS, name));
  candidates.push(join(SOURCE_ASSETS, name));
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) {
    throw new Error(`Actual benchmark asset not found: ${name} (tried ${candidates.join(', ')})`);
  }
  if (!isAbsolute(path)) throw new Error(`Asset path must be absolute: ${path}`);
  return path;
}

export function loadActualFixture(name, explicitPath) {
  const path = resolveAsset(name, explicitPath);
  const bytes = readFileSync(path);
  return {
    id: name.replace(/\.xml$/u, ''),
    name,
    kind: 'actual',
    path,
    source: bytes.toString('utf8'),
    bytes,
    bytesLength: bytes.byteLength,
    sha256: hashBytes(bytes),
    entityStats: scanEntityStats(bytes.toString('utf8')),
  };
}

function nextSeed(seed) {
  return (Math.imul(seed ^ 0x9e3779b9, 1664525) + 1013904223) >>> 0;
}

function encodeId(value, alphabet, slots) {
  const result = new Array(slots);
  let cursor = Math.max(0, Number(value));
  for (let index = slots - 1; index >= 0; index--) {
    result[index] = alphabet[cursor % alphabet.length];
    cursor = Math.floor(cursor / alphabet.length);
  }
  return result.join('');
}

function seededValue(seed, length, kind, uniqueId = 0) {
  if (!Number.isInteger(length) || length < 0) throw new Error(`Invalid fixture value length: ${length}`);
  if (kind === 'astral' && length % 2 !== 0) throw new Error(`Astral fixture value length must be even: ${length}`);
  const alphabet = kind === 'unicode' ? UNICODE_VALUE_ALPHABET : kind === 'astral' ? ASTRAL_VALUE_ALPHABET : ASCII_VALUE_ALPHABET;
  const unitLength = kind === 'astral' ? length / 2 : length;
  const chars = [];
  let cursor = (seed ^ Math.imul(uniqueId + 1, 0x45d9f3b)) >>> 0;
  for (let index = 0; index < unitLength; index++) {
    cursor = nextSeed(cursor);
    chars.push(alphabet[cursor % alphabet.length]);
  }
  const idChars = Array.from(encodeId(uniqueId, alphabet, Math.min(unitLength, 8)));
  for (let index = 0; index < idChars.length; index++) chars[index] = idChars[index];
  return chars.join('');
}

function escapeAttribute(value, entityKind, index) {
  let escaped = '';
  for (const character of value) {
    if ((entityKind === 'named' || entityKind === 'named-rich') && character === '&') escaped += '&amp;';
    else if ((entityKind === 'named' || entityKind === 'named-rich') && character === '<') escaped += '&lt;';
    else if ((entityKind === 'named' || entityKind === 'named-rich') && character === '>') escaped += '&gt;';
    else if ((entityKind === 'named' || entityKind === 'named-rich') && character === '"') escaped += '&quot;';
    else if ((entityKind === 'named' || entityKind === 'named-rich') && character === "'") escaped += '&apos;';
    else if (entityKind === 'numeric' && character === '<') escaped += index % 2 ? '&#x3c;' : '&#60;';
    else if (entityKind === 'numeric' && character === '>') escaped += index % 2 ? '&#62;' : '&#x3e;';
    else if (character === '&') escaped += '&amp;';
    else if (character === '<') escaped += '&lt;';
    else if (character === '"') escaped += '&quot;';
    else escaped += character;
  }
  return escaped;
}

function makeFixtureValue(seed, length, kind, entityKind, uniqueId) {
  if (!entityKind) {
    const semantic = seededValue(seed, length, kind, uniqueId);
    return { semantic, raw: semantic };
  }
  if (entityKind === 'named-rich') {
    const specials = '&<>\"\'';
    const base = seededValue(seed, length - specials.length, 'ascii', uniqueId);
    const semantic = specials + base;
    return { semantic, raw: escapeAttribute(semantic, entityKind, uniqueId) };
  }
  if (entityKind === 'named') {
    const special = ['&', '<', '>', '"', "'"][uniqueId % 5];
    if (kind === 'astral') {
      const base = seededValue(seed, length, kind, uniqueId);
      const semantic = special + base.slice(2) + 'a';
      return { semantic, raw: escapeAttribute(semantic, entityKind, uniqueId) };
    }
    const base = seededValue(seed, length, kind, uniqueId);
    const semantic = special + base.slice(1);
    return { semantic, raw: escapeAttribute(semantic, entityKind, uniqueId) };
  }
  if (entityKind === 'numeric') {
    if (kind === 'astral') {
      const base = seededValue(seed, length, kind, uniqueId);
      const semantic = '<>' + base.slice(4) + 'aa';
      return { semantic, raw: escapeAttribute(semantic, entityKind, uniqueId) };
    }
    const base = seededValue(seed, length, kind, uniqueId);
    const semantic = '<>' + base.slice(2);
    return { semantic, raw: escapeAttribute(semantic, entityKind, uniqueId) };
  }
  if (entityKind === 'custom') {
    if (kind === 'astral') {
      const base = seededValue(seed, length, kind, uniqueId);
      return { semantic: base, raw: `&empty;${base}` };
    }
    const choices = length >= 13 ? ['company', 'empty', 'literalAmp'] : length >= 3 ? ['empty', 'literalAmp'] : ['empty'];
    const entity = choices[uniqueId % choices.length];
    const replacement = CUSTOM_ENTITY_VALUES.get(entity);
    const base = seededValue(seed, length - replacement.length, kind, uniqueId);
    return { semantic: replacement + base, raw: `&${entity};${base}` };
  }
  throw new Error(`Unknown fixture entity kind: ${entityKind}`);
}

function decodeValue(raw, lexical = true) {
  if (!lexical) return raw;
  return raw.replace(ENTITY_REFERENCE, (reference) => {
    const body = reference.slice(1, -1);
    if (PREDEFINED_ENTITIES.has(body)) return PREDEFINED_ENTITIES.get(body);
    if (CUSTOM_ENTITY_VALUES.has(body)) return CUSTOM_ENTITY_VALUES.get(body);
    if (body.startsWith('#x')) {
      const codePoint = Number.parseInt(body.slice(2), 16);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : reference;
    }
    if (body.startsWith('#')) {
      const codePoint = Number.parseInt(body.slice(1), 10);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : reference;
    }
    return reference;
  });
}

function fixtureProfile(id) {
  return {
    'ascii-none': { density: 0, kind: 'ascii', entity: null },
    'unicode-none': { density: 0, kind: 'unicode', entity: null },
    'astral-none': { density: 0, kind: 'astral', entity: null },
    rare: { density: 0.01, kind: 'ascii', entity: 'named' },
    'named-attr': { density: 1, kind: 'ascii', entity: 'named-rich', target: 'attr' },
    'numeric-attr': { density: 1, kind: 'ascii', entity: 'numeric', target: 'attr' },
    'custom-attr': { density: 1, kind: 'unicode', entity: 'custom', target: 'attr' },
    'named-text': { density: 1, kind: 'ascii', entity: 'named-rich', target: 'text' },
    mixed: { density: 0.1, kind: 'mixed', entity: 'mixed' },
    xmlns: { density: 0, kind: 'named', entity: null },
  }[id];
}

function valueKind(profile, row) {
  if (profile.kind !== 'mixed') return profile.kind;
  return ['ascii', 'unicode', 'astral'][row % 3];
}

function entityKind(profile, valueIndex, target) {
  if (!profile.entity || profile.density === 0) return null;
  if (profile.target && profile.target !== target) return null;
  if (profile.density < 1 && valueIndex % Math.round(1 / profile.density) !== 0) return null;
  if (profile.entity !== 'mixed') return profile.entity;
  return ['named', 'numeric', 'custom'][(valueIndex / 10) % 3];
}

function attributeCount(row) {
  const mod = row % 10;
  return mod < 5 ? 0 : mod < 9 ? 4 : 16;
}

function buildRow(id, row, seed, valueIndex, countOverride) {
  const profile = fixtureProfile(id);
  const kind = valueKind(profile, row);
  const length = VALUE_LENGTHS[row % VALUE_LENGTHS.length];
  const count = countOverride ?? attributeCount(row);
  const attrs = [];
  for (let index = 0; index < count; index++) {
    const currentValueIndex = valueIndex + index;
    const attrEntity = entityKind(profile, currentValueIndex, 'attr');
    const attrValue = makeFixtureValue(seed + index * 31, length, kind, attrEntity, currentValueIndex);
    attrs.push(` a${index}="${attrValue.raw}"`);
  }
  const textValueIndex = valueIndex + count;
  const textEntity = entityKind(profile, textValueIndex, 'text');
  const textValue = makeFixtureValue(seed + 97, length, kind, textEntity, textValueIndex);
  const namespaceAttrs = id === 'xmlns'
    ? ` xmlns:p="urn:stax:shadow-${row}-${seed.toString(36)}&amp;uri" xmlns="" p:ref="${seededValue(seed + 7, 32, 'ascii', textValueIndex)}"`
    : '';
  const body = `<t>${textValue.raw}</t>`;
  return {
    source: `<r id="r-${seed.toString(36)}-${row}"${namespaceAttrs}${attrs.join('')}>${body}</r>`,
    targetValues: count + 1,
    valueIndex: textValueIndex + 1,
  };
}

export function scanEntityStats(source) {
  const values = [];
  const readTagEnd = (start) => {
    let quote = '';
    for (let index = start; index < source.length; index++) {
      const character = source[index];
      if (quote) {
        if (character === quote) quote = '';
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '>') {
        return index;
      }
    }
    return source.length;
  };
  const readDeclarationEnd = (start) => {
    let quote = '';
    let subsetDepth = 0;
    for (let index = start; index < source.length; index++) {
      const character = source[index];
      if (quote) {
        if (character === quote) quote = '';
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '[') {
        subsetDepth++;
      } else if (character === ']' && subsetDepth > 0) {
        subsetDepth--;
      } else if (character === '>' && subsetDepth === 0) {
        return index;
      }
    }
    return source.length;
  };
  const readAttributes = (start, end) => {
    let index = start + 1;
    if (source[index] === '/') index++;
    while (index < end && /[\s]/u.test(source[index])) index++;
    while (index < end && /[A-Za-z_:]/u.test(source[index])) index++;
    while (index < end) {
      while (index < end && /[\s/]/u.test(source[index])) index++;
      if (index >= end || source[index] === '>') break;
      const nameStart = index;
      while (index < end && /[A-Za-z0-9_.:-]/u.test(source[index])) index++;
      const name = source.slice(nameStart, index);
      while (index < end && /\s/u.test(source[index])) index++;
      if (!name || source[index] !== '=') {
        while (index < end && !/[\s/]/u.test(source[index])) index++;
        continue;
      }
      index++;
      while (index < end && /\s/u.test(source[index])) index++;
      const quote = source[index];
      if (quote !== '"' && quote !== "'") continue;
      index++;
      const valueStart = index;
      while (index < end && source[index] !== quote) index++;
      values.push({ kind: 'attribute', name, raw: source.slice(valueStart, index), lexical: true });
      if (index < end) index++;
    }
  };
  const pushText = (raw, lexical = true) => {
    if (raw.length) values.push({ kind: 'text', raw, lexical });
  };
  let index = 0;
  let textStart = 0;
  while (index < source.length) {
    if (source[index] !== '<') {
      index++;
      continue;
    }
    pushText(source.slice(textStart, index));
    if (source.startsWith('<!--', index)) {
      const end = source.indexOf('-->', index + 4);
      index = end < 0 ? source.length : end + 3;
    } else if (source.startsWith('<![CDATA[', index)) {
      const end = source.indexOf(']]>', index + 9);
      pushText(source.slice(index + 9, end < 0 ? source.length : end), false);
      index = end < 0 ? source.length : end + 3;
    } else if (source.startsWith('<?', index)) {
      const end = readTagEnd(index + 2);
      index = Math.min(source.length, end + 1);
    } else if (source.startsWith('<!', index)) {
      const end = readDeclarationEnd(index + 2);
      index = Math.min(source.length, end + 1);
    } else {
      const end = readTagEnd(index + 1);
      readAttributes(index, end);
      index = Math.min(source.length, end + 1);
    }
    textStart = index;
  }
  pushText(source.slice(textStart));
  const attributes = values.filter((item) => item.kind === 'attribute');
  const isNamespaceName = (name) => name === 'xmlns' || name.startsWith('xmlns:');
  const isIdName = (name) => name === 'id' || name.endsWith(':id');
  const targetValues = values.filter((item) => item.kind === 'text'
    || (item.kind === 'attribute' && !isIdName(item.name) && !isNamespaceName(item.name)));
  const idValues = attributes.filter((item) => isIdName(item.name));
  const namespaceValues = attributes.filter((item) => isNamespaceName(item.name));
  const hasEntity = (item) => {
    ENTITY_REFERENCE.lastIndex = 0;
    return item.lexical && ENTITY_REFERENCE.test(item.raw);
  };
  const withEntities = targetValues.filter(hasEntity);
  const allWithEntities = values.filter(hasEntity);
  const byKind = { attribute: 0, text: 0 };
  for (const item of withEntities) byKind[item.kind]++;
  const allByKind = { attribute: 0, text: 0 };
  for (const item of allWithEntities) allByKind[item.kind]++;
  const rawValueLengths = {};
  const semanticValueLengths = {};
  let rawCodeUnits = 0;
  let semanticCodeUnits = 0;
  let invalidSurrogates = 0;
  const semanticValues = [];
  for (const item of targetValues) {
    const semantic = decodeValue(item.raw, item.lexical);
    rawValueLengths[item.raw.length] = (rawValueLengths[item.raw.length] ?? 0) + 1;
    semanticValueLengths[semantic.length] = (semanticValueLengths[semantic.length] ?? 0) + 1;
    rawCodeUnits += item.raw.length;
    semanticCodeUnits += semantic.length;
    semanticValues.push(semantic);
    for (let position = 0; position < semantic.length; position++) {
      const codeUnit = semantic.charCodeAt(position);
      if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
        const next = semantic.charCodeAt(position + 1);
        if (next < 0xdc00 || next > 0xdfff) invalidSurrogates++;
        else position++;
      } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
        invalidSurrogates++;
      }
    }
  }
  const occurrences = (items) => items.reduce((count, item) => count + (item.lexical ? (item.raw.match(ENTITY_REFERENCE) ?? []).length : 0), 0);
  const targetRawOccurrences = occurrences(targetValues);
  const namespaceRawOccurrences = occurrences(namespaceValues);
  const idRawOccurrences = occurrences(idValues);
  const namespaceValuesWithEntities = namespaceValues.filter(hasEntity).length;
  const idValuesWithEntities = idValues.filter(hasEntity).length;
  const allRawCodeUnits = values.reduce((total, item) => total + item.raw.length, 0);
  const allSemanticCodeUnits = values.reduce((total, item) => total + decodeValue(item.raw, item.lexical).length, 0);
  return {
    targetValues: targetValues.length,
    valuesWithEntities: withEntities.length,
    entityDensity: targetValues.length ? withEntities.length / targetValues.length : 0,
    rawOccurrences: occurrences(values),
    targetRawOccurrences,
    targetValuesWithEntities: withEntities.length,
    attributeValues: targetValues.filter((item) => item.kind === 'attribute').length,
    textValues: targetValues.filter((item) => item.kind === 'text').length,
    entityAttributeValues: byKind.attribute,
    entityTextValues: byKind.text,
    namespaceValues: namespaceValues.length,
    idValues: idValues.length,
    namespaceAttributeValues: namespaceValues.length,
    idAttributeValues: idValues.length,
    namespaceValuesWithEntities,
    idValuesWithEntities,
    namespaceRawOccurrences,
    idRawOccurrences,
    entityOccurrences: {
      target: targetRawOccurrences,
      namespace: namespaceRawOccurrences,
      id: idRawOccurrences,
      all: targetRawOccurrences + namespaceRawOccurrences + idRawOccurrences,
    },
    allEntityAttributeValues: allByKind.attribute,
    allEntityTextValues: allByKind.text,
    rawValueLengths,
    semanticValueLengths,
    valueLengths: rawValueLengths,
    rawCodeUnits,
    semanticCodeUnits,
    outputCodeUnits: semanticCodeUnits,
    allRawCodeUnits,
    allSemanticCodeUnits,
    uniqueValueCount: new Set(semanticValues).size,
    uniqueSemanticValues: new Set(semanticValues).size,
    invalidSurrogates,
    targetGroupSize: TARGET_GROUP_SIZE,
    completeGroups: Math.floor(targetValues.length / TARGET_GROUP_SIZE),
    remainderValues: targetValues.length % TARGET_GROUP_SIZE,
  };
}

export function createSyntheticFixture(id, options = {}) {
  if (!FIXTURE_IDS.includes(id)) throw new Error(`Unknown entity-single-eval fixture: ${id}`);
  const targetBytes = Math.max(1024, Math.floor((options.targetBytes ?? 16 * 1024 * 1024)));
  const seed = Number.isInteger(options.seed) ? options.seed : FIXTURE_SEED;
  const parts = [];
  const rootStart = id === 'xmlns'
    ? '<root xmlns="urn:stax:root&amp;uri" xmlns:p="urn:stax:p&amp;uri" xmlns:q="urn:stax:q&amp;uri">'
    : '<root>';
  const rootEnd = '</root>';
  let byteLength = encoder.encode(rootStart).byteLength;
  const rootEndBytes = encoder.encode(rootEnd).byteLength;
  parts.push(rootStart);
  let row = 0;
  let valueIndex = 0;
  while (byteLength + rootEndBytes < targetBytes) {
    const built = buildRow(id, row, seed + row * 131, valueIndex);
    parts.push(built.source);
    byteLength += encoder.encode(built.source).byteLength;
    valueIndex = built.valueIndex;
    row++;
  }
  const beforePaddingBytes = byteLength;
  const beforePaddingRows = row;
  while (valueIndex % TARGET_GROUP_SIZE !== 0) {
    const count = Math.min(16, TARGET_GROUP_SIZE - (valueIndex % TARGET_GROUP_SIZE) - 1);
    const built = buildRow(id, row, seed + row * 131, valueIndex, Math.max(0, count));
    parts.push(built.source);
    byteLength += encoder.encode(built.source).byteLength;
    valueIndex = built.valueIndex;
    row++;
  }
  parts.push(rootEnd);
  const source = parts.join('');
  const bytes = encoder.encode(source);
  const stats = scanEntityStats(source);
  return {
    id,
    name: id,
    kind: 'synthetic',
    seed,
    targetBytes,
    rows: row,
    source,
    bytes,
    bytesLength: bytes.byteLength,
    sha256: hashBytes(bytes),
    entityStats: stats,
    paddingRows: row - beforePaddingRows,
    paddingBytes: byteLength - beforePaddingBytes,
    paddingRatio: (byteLength - beforePaddingBytes) / Math.max(1, targetBytes),
    options: fixtureOptions(id),
  };
}

export function createFixtures(options = {}) {
  const ids = options.ids ?? FIXTURE_IDS;
  const targetBytes = options.targetBytes ?? 16 * 1024 * 1024;
  return ids.map((id) => createSyntheticFixture(id, { ...options, targetBytes }));
}

export function createFixtureManifest(options = {}) {
  const synthetic = createFixtures(options).map(({ source, bytes, ...manifest }) => manifest);
  const actual = (options.actual === false ? [] : ACTUAL_FIXTURE_IDS).map((name) => {
    const fixture = loadActualFixture(name, options.assets?.[name]);
    const { source, bytes, ...manifest } = fixture;
    return manifest;
  });
  return {
    schemaVersion: 1,
    seed: options.seed ?? FIXTURE_SEED,
    targetBytes: options.targetBytes ?? 16 * 1024 * 1024,
    valueLengths: VALUE_LENGTHS,
    fixtures: [...synthetic, ...actual],
  };
}

export function fixtureById(id, options = {}) {
  if (FIXTURE_IDS.includes(id)) return createSyntheticFixture(id, options);
  if (ACTUAL_FIXTURE_IDS.includes(id) || id === 'midsize' || id === 'large') return loadActualFixture(id.endsWith('.xml') ? id : `${id}.xml`, options.assets?.[id]);
  throw new Error(`Unknown entity-single-eval fixture: ${id}`);
}

export function fixtureOptions(id, options = {}) {
  return {
    namespaceAware: true,
    autoDecodeEntities: true,
    documentMode: 'document',
    ...(id === 'custom-attr' || id === 'mixed' ? { addEntities: CUSTOM_ENTITIES } : {}),
    ...(id === 'xmlns' ? { namespaceAware: true } : {}),
  };
}
