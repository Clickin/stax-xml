import { performance } from 'node:perf_hooks';

const COUNTS = [1, 4, 8, 16, 32];
const RUNS = 7;
const WARMUPS = 2;

class SerializableAttributeMap extends Map {
  toJSON() {
    return Object.fromEntries(this);
  }
}

function fixture(count) {
  return Array.from({ length: count }, (_, index) => ({
    name: `attribute-${index}`,
    localName: `attribute-${index}`,
    prefix: '',
    namespaceURI: '',
    value: String(index),
  }));
}

function buildRecord(attributes) {
  const result = Object.create(null);
  for (const attribute of attributes) result[attribute.name] = attribute;
  return result;
}

function buildMap(attributes) {
  const result = new SerializableAttributeMap();
  for (const attribute of attributes) result.set(attribute.name, attribute);
  return result;
}

function buildArray(attributes) {
  return attributes.slice();
}

function median(values) {
  const sorted = values.slice().sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function measure(operation, iterations) {
  let sink;
  const samples = [];
  for (let run = -WARMUPS; run < RUNS; run++) {
    const start = performance.now();
    for (let index = 0; index < iterations; index++) sink = operation(index);
    const elapsed = performance.now() - start;
    if (run >= 0) samples.push(elapsed * 1e6 / iterations);
  }
  if (sink === Symbol.for('unreachable')) throw new Error('unreachable');
  return median(samples);
}

function benchmark(count) {
  const attributes = fixture(count);
  const record = buildRecord(attributes);
  const map = buildMap(attributes);
  const array = buildArray(attributes);
  const lookupName = attributes[count - 1].name;
  const buildIterations = Math.max(20_000, Math.floor(800_000 / count));
  const operationIterations = 400_000;
  const stringifyIterations = Math.max(2_000, Math.floor(40_000 / count));

  return {
    count,
    build: {
      record: measure(() => buildRecord(attributes), buildIterations),
      map: measure(() => buildMap(attributes), buildIterations),
      array: measure(() => buildArray(attributes), buildIterations),
    },
    lookup: {
      record: measure(() => record[lookupName], operationIterations),
      map: measure(() => map.get(lookupName), operationIterations),
      array: measure(() => array.find(attribute => attribute.name === lookupName), operationIterations),
    },
    iterate: {
      record: measure(() => {
        let size = 0;
        for (const name in record) size += record[name].value.length;
        return size;
      }, operationIterations),
      map: measure(() => {
        let size = 0;
        for (const attribute of map.values()) size += attribute.value.length;
        return size;
      }, operationIterations),
      array: measure(() => {
        let size = 0;
        for (const attribute of array) size += attribute.value.length;
        return size;
      }, operationIterations),
    },
    stringify: {
      record: measure(() => JSON.stringify(record), stringifyIterations),
      map: measure(() => JSON.stringify(map), stringifyIterations),
      array: measure(() => JSON.stringify(array), stringifyIterations),
    },
  };
}

function verifySafetyAndSerialization() {
  const attributes = [
    { name: '__proto__', value: 'safe' },
    { name: 'constructor', value: 'also-safe' },
  ];
  const record = buildRecord(attributes);
  const map = buildMap(attributes);
  const recordJson = JSON.stringify(record);
  const mapJson = JSON.stringify(map);
  if (record.__proto__.value !== 'safe' || record.constructor.value !== 'also-safe') throw new Error('Unsafe record keys.');
  if (map.get('__proto__').value !== 'safe' || map.get('constructor').value !== 'also-safe') throw new Error('Unsafe map keys.');
  if (recordJson !== mapJson || recordJson === '{}') throw new Error('Map JSON serialization does not match the record.');
  return recordJson;
}

function inspectV8Shapes() {
  try {
    const haveSameMap = Function('left', 'right', 'return %HaveSameMap(left, right)');
    const hasFastProperties = Function('value', 'return %HasFastProperties(value)');
    const firstRecord = buildRecord(fixture(4));
    const secondRecord = buildRecord(fixture(4));
    const firstMap = buildMap(fixture(4));
    const secondMap = buildMap(fixture(4));
    return {
      recordSameShape: haveSameMap(firstRecord, secondRecord),
      recordFastProperties: hasFastProperties(firstRecord),
      mapSameShape: haveSameMap(firstMap, secondMap),
      mapFastProperties: hasFastProperties(firstMap),
    };
  } catch {
    return 'run with node --allow-natives-syntax to inspect V8 shapes';
  }
}

console.log('Event attribute container comparison (median ns/op)');
console.log(`Node ${process.version}; V8 ${process.versions.v8}`);
console.log(`reserved-key JSON: ${verifySafetyAndSerialization()}`);
console.log('V8 shapes:', inspectV8Shapes());
for (const result of COUNTS.map(benchmark)) {
  console.log(`\n${result.count} attribute(s)`);
  console.table({
    record: Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'count').map(([key, value]) => [key, value.record.toFixed(1)])),
    map: Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'count').map(([key, value]) => [key, value.map.toFixed(1)])),
    array: Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'count').map(([key, value]) => [key, value.array.toFixed(1)])),
  });
}
