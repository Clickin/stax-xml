import { EventReaderSync, initStaxXml, StreamEventType, StreamReaderSync, XmlEventType } from 'stax-xml';
import { x } from 'stax-xml/converter';
import { ProjectionReader } from 'stax-xml/projection';
import { ASSET_PATHS } from './utils.mjs';

const projectionReader = new ProjectionReader({ backend: 'native' });

export const STAX_PARSER_SURFACE_SCENARIOS = [
  {
    label: 'stax-xml EventReaderSync (native object)',
    display: '**EventReaderSync**',
    notes: 'Public string event iterator building the same object shape manually',
  },
  {
    label: 'stax-xml StreamReaderSync (native object)',
    display: '**StreamReaderSync**',
    notes: 'Public byte-stream pull reader building the same object shape manually',
  },
  {
    label: 'stax-xml ProjectionReader (native object records)',
    display: '**ProjectionReader**',
    notes: 'Public projection surface returning the same object shape through object records',
  },
  {
    label: 'stax-xml Converter API (native object)',
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

const FIXTURE_CONTRACTS = new Map([
  [ASSET_PATHS.complex, createFixtureContract({
    itemName: 'person',
    rootXPath: '/any_name/person',
    outputDescription: 'Array<{ id, name, age }>',
    fields: PERSON_FIELDS,
  })],
  [ASSET_PATHS.midsize, createFixtureContract({
    itemName: 'person',
    rootXPath: '/any_name/person',
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

export async function ensureNativeReaderRuntime() {
  const runtime = await initStaxXml({ backend: 'native', fallbackOnLoadError: false });
  if (
    runtime.backend.kind !== 'native'
    || !runtime.capabilities.streamingEventBatches
    || !runtime.capabilities.objectRecordsProjection
    || !runtime.capabilities.createObjectProjectionPlan
  ) {
    throw new Error(
      'The native stax-xml runtime must expose streamingEventBatches, objectRecordsProjection, and createObjectProjectionPlan before public parser benchmarks can run.',
    );
  }
  return runtime;
}

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
      label: 'stax-xml EventReaderSync (native object)',
      run: () => parseWithEventReader(xmlString, contract),
    },
    {
      label: 'stax-xml StreamReaderSync (native object)',
      run: () => parseWithStreamReader(inputBuffer, contract),
    },
    {
      label: 'stax-xml ProjectionReader (native object records)',
      run: () => parseWithProjectionReader(inputBuffer, contract),
    },
    {
      label: 'stax-xml Converter API (native object)',
      run: () => parseWithConverter(inputBuffer, contract),
    },
  ];
}

export function assertStaxParserSurfaceParity({ assetPath, xmlString, inputBuffer }) {
  const contract = parserFixtureContractForAssetPath(assetPath);
  const reference = parseWithEventReader(xmlString, contract);
  const candidates = [
    ['StreamReaderSync', parseWithStreamReader(inputBuffer, contract)],
    ['ProjectionReader', parseWithProjectionReader(inputBuffer, contract)],
    ['Converter', parseWithConverter(inputBuffer, contract)],
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

function createFixtureContract({ itemName, rootXPath, fields, outputDescription }) {
  const elementFields = fields.filter((field) => field.sourceKind === 'element');
  const attributeFields = fields.filter((field) => field.sourceKind === 'attribute');
  const elementFieldByName = new Map(elementFields.map((field) => [field.sourceName, field]));
  const projectionSpec = {
    itemName,
    fields: fields.map((field) => ({
      outputName: field.outputName,
      valueKind: 'string',
      sourceKind: field.sourceKind,
      sourceName: field.sourceName,
      textMode: 'direct',
    })),
  };

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
    projectionSpec,
    converterSchema: x.array(x.object(converterShape), rootXPath).compile(),
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
    { autoDecodeEntities: false },
    'native',
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
            currentRow[field.outputName] = event.attributes?.[field.sourceName] ?? '';
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
  const parser = new StreamReaderSync(inputBuffer);
  const rows = [];
  const elementStack = [];
  let currentRow = null;

  for (const batch of parser) {
    for (const event of batch) {
      switch (event.type) {
        case StreamEventType.START_ELEMENT: {
          const name = event.name();
          elementStack.push(name);
          if (name === contract.itemName) {
            currentRow = createEmptyRow(contract);
            const attrCount = event.getAttributeCount();
            for (let index = 0; index < attrCount; index++) {
              const attrName = event.getAttributeName(index);
              const field = contract.attributeFields.find((candidate) => candidate.sourceName === attrName);
              if (field) {
                currentRow[field.outputName] = event.getAttributeValue(index) ?? '';
              }
            }
          }
          break;
        }
        case StreamEventType.CHARACTERS:
        case StreamEventType.CDATA: {
          if (!currentRow) break;
          const currentElement = elementStack[elementStack.length - 1];
          const parentElement = elementStack[elementStack.length - 2];
          if (parentElement !== contract.itemName) break;
          const field = contract.elementFieldByName.get(currentElement);
          if (!field) break;
          appendFieldText(currentRow, field.outputName, event.text()?.trim());
          break;
        }
        case StreamEventType.END_ELEMENT: {
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
  }

  return rows;
}

function parseWithProjectionReader(inputBuffer, contract) {
  const result = projectionReader.projectObjectRecordsSync(inputBuffer, contract.projectionSpec, { backend: 'native' });
  if (Array.isArray(result.rows)) {
    return result.rows;
  }
  if (typeof result.json === 'string') {
    return JSON.parse(result.json);
  }
  throw new Error('ProjectionReader object-record projection did not return rows or json.');
}

function parseWithConverter(inputBuffer, contract) {
  return contract.converterSchema.parseSync(inputBuffer, {
    acceleration: { backend: 'native' },
    maxEvents: 20_000_000,
  });
}
