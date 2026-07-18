import { EventReaderSync, StreamReaderSync, XmlEventType } from 'stax-xml';
import { x } from 'stax-xml/converter';
import { XMLParser } from 'fast-xml-parser';
import * as txml from 'txml';
import xml2js from 'xml2js';
import { ASSET_PATHS } from './utils.mjs';

export const STAX_PARSER_SURFACE_SCENARIOS = [
  {
    label: 'stax-xml EventReaderSync (JS object)',
    display: '**EventReaderSync**',
    notes: 'Public string event iterator building the same object shape manually',
  },
  {
    label: 'stax-xml StreamReaderSync (JS object)',
    display: '**StreamReaderSync**',
    notes: 'Current-token byte-buffer reader building the same object shape manually',
  },
  {
    label: 'stax-xml Converter API (JS object)',
    display: '**Converter**',
    notes: 'Declarative schema compiled once and returning the same object shape through the public converter API',
  },
];

const PERSON_FIELDS = [
  { outputName: 'id', sourceKind: 'attribute', sourceName: 'id' },
  { outputName: 'name', sourceKind: 'element', sourceName: 'name' },
  { outputName: 'age', sourceKind: 'element', sourceName: 'age' },
];

const BOOK_FIELDS = [
  { outputName: 'id', sourceKind: 'attribute', sourceName: 'id' },
  { outputName: 'title', sourceKind: 'element', sourceName: 'title' },
  { outputName: 'author', sourceKind: 'element', sourceName: 'author' },
  { outputName: 'price', sourceKind: 'element', sourceName: 'price' },
];
const BENCHMARK_PARSE_OPTIONS = { documentMode: 'fragment' };

const FIXTURE_CONTRACTS = new Map([
  [ASSET_PATHS.complex, createFixtureContract({
    itemName: 'person',
    rootXPath: '/any_name/person',
    outputDescription: 'Array<{ id, name, age }>',
    fields: PERSON_FIELDS,
  })],
  [ASSET_PATHS.midsize, createFixtureContract({
    itemName: 'person',
    rootXPath: '/root/any_name/person',
    outputDescription: 'Array<{ id, name, age }>',
    fields: PERSON_FIELDS,
  })],
  [ASSET_PATHS.large, createFixtureContract({
    itemName: 'person',
    rootXPath: '/root/any_name/person',
    outputDescription: 'Array<{ id, name, age }>',
    fields: PERSON_FIELDS,
  })],
  [ASSET_PATHS.books, createFixtureContract({
    itemName: 'book',
    rootXPath: '/catalog/book',
    outputDescription: 'Array<{ id, title, author, price }>',
    fields: BOOK_FIELDS,
  })],
]);

export function parserFixtureContractForAssetPath(assetPath) {
  const contract = FIXTURE_CONTRACTS.get(assetPath);
  if (!contract) {
    throw new Error(`No parser fixture contract registered for asset: ${assetPath}`);
  }
  return contract;
}

export function createStaxParserSurfaceRunners({ assetPath, xmlString, inputBuffer }) {
  const contract = parserFixtureContractForAssetPath(assetPath);
  return [
    {
      label: 'stax-xml EventReaderSync (JS object)',
      run: () => parseWithEventReader(xmlString, contract),
    },
    {
      label: 'stax-xml StreamReaderSync (JS object)',
      run: () => parseWithStreamReader(inputBuffer, contract),
    },
    {
      label: 'stax-xml Converter API (JS object)',
      run: () => parseWithConverter(inputBuffer, contract),
    },
    {
      label: 'fast-xml-parser XMLParser (JS object)',
      run: () => projectObjectTree(
        new XMLParser({ ignoreAttributes: false }).parse(xmlString),
        contract,
        'fxp',
      ),
    },
    {
      label: 'txml parse (JS object)',
      run: () => projectTxmlTree(txml.parse(xmlString), contract),
    },
    {
      label: 'xml2js parseString (JS object)',
      run: async () => projectObjectTree(await parseWithXml2js(xmlString), contract, 'xml2js'),
    },
  ];
}

function parseWithXml2js(xmlString) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xmlString, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

export async function assertParserSurfaceParity({ assetPath, xmlString, inputBuffer }) {
  const contract = parserFixtureContractForAssetPath(assetPath);
  const reference = parseWithEventReader(xmlString, contract);
  const candidates = [
    ['StreamReaderSync', parseWithStreamReader(inputBuffer, contract)],
    ['Converter', parseWithConverter(inputBuffer, contract)],
    ['fast-xml-parser', projectObjectTree(new XMLParser({ ignoreAttributes: false }).parse(xmlString), contract, 'fxp')],
    ['txml', projectTxmlTree(txml.parse(xmlString), contract)],
    ['xml2js', projectObjectTree(await parseWithXml2js(xmlString), contract, 'xml2js')],
  ];

  const referenceJson = JSON.stringify(reference);
  for (const [label, candidate] of candidates) {
    const candidateJson = JSON.stringify(candidate);
    if (candidateJson !== referenceJson) {
      throw new Error(
        `${label} produced a different object shape for ${assetPath}.\n`
        + `Expected: ${referenceJson.slice(0, 512)}\n`
        + `Actual: ${candidateJson.slice(0, 512)}`,
      );
    }
  }

  return {
    contract: contract.outputDescription,
    records: reference.length,
  };
}

function projectObjectTree(root, contract, kind) {
  const nodes = [];
  collectObjectNodes(root, contract.itemName, nodes);
  return nodes.map((node) => Object.fromEntries(contract.fields.map((field) => {
    const value = field.sourceKind === 'attribute'
      ? (kind === 'fxp' ? node[`@_${field.sourceName}`] : node.$?.[field.sourceName])
      : firstText(node[field.sourceName]);
    return [field.outputName, value === undefined ? '' : String(value)];
  })));
}

function collectObjectNodes(value, itemName, nodes) {
  if (Array.isArray(value)) {
    for (const item of value) collectObjectNodes(item, itemName, nodes);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [name, child] of Object.entries(value)) {
    if (name === itemName) {
      if (Array.isArray(child)) nodes.push(...child);
      else nodes.push(child);
    } else if (name !== '$' && name !== '#text' && name !== '_') {
      collectObjectNodes(child, itemName, nodes);
    }
  }
}

function firstText(value) {
  const first = Array.isArray(value) ? value[0] : value;
  if (first && typeof first === 'object') return first['#text'] ?? first._;
  return first;
}

function projectTxmlTree(root, contract) {
  const nodes = [];
  collectTxmlNodes(root, contract.itemName, nodes);
  return nodes.map((node) => Object.fromEntries(contract.fields.map((field) => {
    const value = field.sourceKind === 'attribute'
      ? node.attributes?.[field.sourceName]
      : node.children.find((child) => child?.tagName === field.sourceName)?.children
        .filter((child) => typeof child === 'string').join('').trim();
    return [field.outputName, value === undefined ? '' : String(value)];
  })));
}

function collectTxmlNodes(value, itemName, nodes) {
  if (Array.isArray(value)) {
    for (const item of value) collectTxmlNodes(item, itemName, nodes);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (value.tagName === itemName) nodes.push(value);
  else collectTxmlNodes(value.children, itemName, nodes);
}

function createFixtureContract({ itemName, rootXPath, fields, outputDescription }) {
  const elementFields = fields.filter((field) => field.sourceKind === 'element');
  const attributeFields = fields.filter((field) => field.sourceKind === 'attribute');
  const elementFieldByName = new Map(elementFields.map((field) => [field.sourceName, field]));
  const converterShape = Object.fromEntries(fields.map((field) => [
    field.outputName,
    field.sourceKind === 'attribute'
      ? x.string().xpath(`./@${field.sourceName}`)
      : x.string().xpath(`./${field.sourceName}`),
  ]));

  return {
    itemName,
    fields,
    outputDescription,
    elementFields,
    attributeFields,
    elementFieldByName,
    converterSchema: x.array(x.object(converterShape), rootXPath),
  };
}

function createEmptyRow(contract) {
  return Object.fromEntries(contract.fields.map((field) => [field.outputName, '']));
}

function appendFieldText(target, fieldName, text) {
  if (!text) return;
  target[fieldName] = target[fieldName] ? `${target[fieldName]}${text}` : text;
}

function parseWithEventReader(xmlString, contract) {
  const parser = new EventReaderSync(
    xmlString,
    { autoDecodeEntities: false, ...BENCHMARK_PARSE_OPTIONS },
  );
  const rows = [];
  const elementStack = [];
  let currentRow = null;
  let currentText = '';

  const flushText = () => {
    const text = currentText.trim();
    currentText = '';
    if (!currentRow || !text) return;
    const currentElement = elementStack[elementStack.length - 1];
    const parentElement = elementStack[elementStack.length - 2];
    if (parentElement !== contract.itemName) return;
    const field = contract.elementFieldByName.get(currentElement);
    if (!field) return;
    appendFieldText(currentRow, field.outputName, text);
  };

  for (const event of parser) {
    switch (event.type) {
      case XmlEventType.START_ELEMENT: {
        flushText();
        const name = event.name ?? event.localName;
        elementStack.push(name);
        if (name === contract.itemName) {
          currentRow = createEmptyRow(contract);
          for (const field of contract.attributeFields) {
            currentRow[field.outputName] = event.attributes?.get(field.sourceName)?.value ?? '';
          }
        }
        break;
      }
      case XmlEventType.CHARACTERS:
      case XmlEventType.CDATA:
        currentText += event.value ?? '';
        break;
      case XmlEventType.END_ELEMENT: {
        flushText();
        const name = elementStack.pop();
        if (name === contract.itemName && currentRow) {
          rows.push(currentRow);
          currentRow = null;
        }
        break;
      }
      default:
        break;
    }
  }

  return rows;
}

function parseWithStreamReader(inputBuffer, contract) {
  const parser = new StreamReaderSync(inputBuffer, BENCHMARK_PARSE_OPTIONS);
  const rows = [];
  const elementStack = [];
  let currentRow = null;

  while (parser.next()) {
    switch (parser.eventType()) {
      case XmlEventType.START_ELEMENT: {
        const name = parser.name();
        elementStack.push(name);
        if (name === contract.itemName) {
          currentRow = createEmptyRow(contract);
          const attrCount = parser.attributeCount();
          for (let index = 0; index < attrCount; index++) {
            const attrName = parser.attributeName(index);
            const field = contract.attributeFields.find((candidate) => candidate.sourceName === attrName);
            if (field) {
              currentRow[field.outputName] = parser.attributeValue(index) ?? '';
            }
          }
        }
        break;
      }
      case XmlEventType.CHARACTERS:
      case XmlEventType.CDATA: {
        if (!currentRow) break;
        const currentElement = elementStack[elementStack.length - 1];
        const parentElement = elementStack[elementStack.length - 2];
        if (parentElement !== contract.itemName) break;
        const field = contract.elementFieldByName.get(currentElement);
        if (!field) break;
        appendFieldText(currentRow, field.outputName, parser.text()?.trim());
        break;
      }
      case XmlEventType.END_ELEMENT: {
        const name = elementStack.pop();
        if (name === contract.itemName && currentRow) {
          rows.push(currentRow);
          currentRow = null;
        }
        break;
      }
      default:
        break;
    }
  }

  return rows;
}

function parseWithConverter(inputBuffer, contract) {
  return contract.converterSchema.parseSync(inputBuffer, {
    ...BENCHMARK_PARSE_OPTIONS,
    maxEvents: 20_000_000,
  });
}
