import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const packageDir = process.argv[2];
if (!packageDir) {
  throw new Error('Usage: node scripts/smoke-platform-package.mjs <platform-package-dir>');
}

const module = await import(pathToFileURL(resolve(packageDir, 'index.mjs')).href);
const requiredExports = [
  'parseAggregateBuffer',
  'parseStructuralIndexUint8Array',
  'parseItemRowsViaTableUint8Array',
  'parseObjectRowsUint8Array',
  'parseObjectRowsViaTableUint8Array',
  'parseObjectRecordsUint8Array',
  'createObjectProjectionPlan',
];

for (const name of requiredExports) {
  if (typeof module[name] !== 'function') {
    throw new Error(`${name} export missing from ${packageDir}`);
  }
}

const encoder = new TextEncoder();
const xml =
  '<root>' +
  '<item id="7"><name>Alice</name><value>안녕</value></item>' +
  '<entry code="a"><label>Alice</label><score>7</score></entry>' +
  '<entry code="b"><label>Bob</label><score></score></entry>' +
  '<entry code="c"><label>Cy</label></entry>' +
  '</root>';
const input = encoder.encode(xml);

const aggregate = module.parseAggregateBuffer(Buffer.from(input), 'count-only');
assertEqual(aggregate.eventCount ?? aggregate.event_count, 32, 'aggregate event count');

const table = module.parseStructuralIndexUint8Array(input);
assertEqual(Buffer.isBuffer(table), true, 'structural index Buffer');
assertEqual(table.readUInt32LE(0), 0x31545053, 'structural index magic');

const itemRows = module.parseItemRowsViaTableUint8Array(input);
assertEqual(itemRows.rows.length, 1, 'item rows length');
assertEqual(itemRows.rows[0].name, 'Alice', 'item first name');
assertEqual(itemRows.rows[0].value, '안녕', 'item first value');

const objectRowsSpec = {
  itemName: 'entry',
  fields: [
    { outputName: 'code', valueKind: 'string', sourceKind: 'attribute', sourceName: 'code', textMode: 'direct' },
    { outputName: 'label', valueKind: 'string', sourceKind: 'element', sourceName: 'label', textMode: 'subtree' },
    { outputName: 'score', valueKind: 'number', sourceKind: 'element', sourceName: 'score', textMode: 'subtree' },
  ],
};
const directObjectRows = module.parseObjectRowsUint8Array(input, objectRowsSpec);
const objectRows = module.parseObjectRowsViaTableUint8Array(input, objectRowsSpec);
const objectRecords = module.parseObjectRecordsUint8Array(input, objectRowsSpec);
const objectProjectionPlan = module.createObjectProjectionPlan(objectRowsSpec);
const compiledObjectRecords = objectProjectionPlan.projectRecords(input);
const objectRecordRows = JSON.parse(objectRecords.json);
const compiledObjectRecordRows = JSON.parse(compiledObjectRecords.json);
assertObjectRows(directObjectRows, 'direct object');
assertObjectRows(objectRows, 'object');
assertEqual(objectRecords.rowCount, 3, 'object records row count');
assertEqual(objectRecordRows[0].code, 'a', 'object records first code');
assertEqual(objectRecordRows[0].label, 'Alice', 'object records first label');
assertEqual(objectRecordRows[1].score, null, 'object records empty score value');
assertEqual(compiledObjectRecords.rowCount, 3, 'compiled object records row count');
assertEqual(compiledObjectRecordRows[0].code, 'a', 'compiled object records first code');

console.log(`platform package smoke ok: ${packageDir}`);

function assertObjectRows(objectRows, label) {
  assertEqual(objectRows.rowCount, 3, 'object row count');
  assertEqual(objectRows.fieldCount, 3, 'object field count');
  assertEqual(stringValues(input, objectRows.columns[0]).join('|'), 'a|b|c', `${label} code values`);
  assertEqual(stringValues(input, objectRows.columns[1]).join('|'), 'Alice|Bob|Cy', `${label} label values`);
  assertEqual(objectRows.columns[2].present.join('|'), 'true|true|false', `${label} score present flags`);
  assertEqual(objectRows.columns[2].values.length, 0, `${label} score string values`);
  const scoreValues = numberValues(objectRows.columns[2]);
  assertEqual(scoreValues[0], 7, `${label} first score value`);
  assertEqual(Number.isNaN(scoreValues[1]), true, `${label} empty score value`);
  assertEqual(scoreValues[2], 0, `${label} missing score placeholder`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function numberValues(column) {
  return column.numberValues ?? column.number_values;
}

function stringValues(source, column) {
  const spanStarts = column.spanStarts ?? column.span_starts;
  const spanEnds = column.spanEnds ?? column.span_ends;
  return column.present.map((_, index) => {
    const start = spanStarts?.[index] ?? -1;
    const end = spanEnds?.[index] ?? -1;
    if (start >= 0 && end >= start) {
      return Buffer.from(source.buffer, source.byteOffset + start, end - start).toString('utf8');
    }
    return column.values?.[index] ?? '';
  });
}
