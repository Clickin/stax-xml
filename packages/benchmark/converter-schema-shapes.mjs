#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { StreamReaderSync, XmlEventType } from 'stax-xml';
import { x } from 'stax-xml/converter';

const mib = 1024 * 1024;
const sizeMiB = Number(arg('size-mib') ?? 4);
const runs = Number(arg('runs') ?? 10);
const warmups = Number(arg('warmups') ?? 3);
const minimumRatio = arg('min-ratio');
const diagnostic = arg('diagnostic');
const target = sizeMiB * mib;
const options = { documentMode: 'fragment', maxEvents: 20_000_000 };
const encoder = new TextEncoder();
const cursorOnlySchema = x.object({});

const allCases = [flatRecords(), multipleArrays(), nestedArray(), positionedFields(), descendantRecords()];
const selectedShape = arg('shape');
const cases = selectedShape
  ? allCases.filter(item => item.name === selectedShape)
  : allCases;
if (cases.length === 0) throw new Error(`Unknown converter benchmark shape: ${selectedShape}`);
for (const item of cases) {
  const manualExpected = item.summary(item.manual(item.bytes));
  const converterExpected = item.summary(item.schema.parseSync(item.bytes, options));
  if (JSON.stringify(manualExpected) !== JSON.stringify(converterExpected)) {
    throw new Error(`${item.name} parity mismatch: ${JSON.stringify({ manualExpected, converterExpected })}`);
  }
}

console.log(`Converter schema-shape benchmark (${sizeMiB} MiB target, ${warmups} warmups, ${runs} runs)`);
if (diagnostic) {
  runDiagnostic(diagnostic);
  process.exit(0);
}
console.log('shape'.padEnd(24), 'manual'.padStart(12), 'converter'.padStart(12), 'ratio'.padStart(8));
const results = [];
for (const item of cases) {
  const manual = measure(() => item.manual(item.bytes));
  const converter = measure(() => item.schema.parseSync(item.bytes, options));
  const manualRate = item.bytes.byteLength / mib / (manual / 1000);
  const converterRate = item.bytes.byteLength / mib / (converter / 1000);
  const ratio = converterRate / manualRate;
  results.push({ name: item.name, ratio });
  console.log(
    item.name.padEnd(24),
    `${manualRate.toFixed(2)} MiB/s`.padStart(12),
    `${converterRate.toFixed(2)} MiB/s`.padStart(12),
    ratio.toFixed(3).padStart(8)
  );
}
if (minimumRatio !== undefined) {
  const minimum = Number(minimumRatio);
  const failed = results.filter(result => result.ratio < minimum);
  if (failed.length) {
    throw new Error(`Converter throughput below ${minimum}x manual: ${failed.map(result => `${result.name}=${result.ratio.toFixed(3)}x`).join(', ')}`);
  }
}

function measure(run) {
  for (let index = 0; index < warmups; index++) run();
  const samples = [];
  for (let index = 0; index < runs; index++) {
    globalThis.gc?.();
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }
  samples.sort((left, right) => left - right);
  return samples[Math.floor(samples.length / 2)];
}

function runDiagnostic(mode) {
  if (mode === 'waterfall') {
    runDiagnosticWaterfall();
    return;
  }
  if (!['reader-only', 'cursor-only', 'state-only', 'converter-only', 'event-loop', 'text-loop', 'attribute-loop', 'position-loop'].includes(mode)) {
    throw new Error(`Unknown converter diagnostic: ${mode}`);
  }
  console.log(`diagnostic=${mode}`);
  console.log('shape'.padEnd(24), 'median'.padStart(12));
  for (const item of cases) {
    const elapsed = measure(() => {
      if (mode === 'reader-only') {
        const reader = new StreamReaderSync(item.bytes, options);
        while (reader.next() !== null) {}
        return;
      }
      if (mode === 'cursor-only') {
        cursorOnlySchema.parseSync(item.bytes, options);
        return;
      }
      if (mode === 'state-only') item.stateSchema.parseSync(item.bytes, options);
      else if (mode === 'converter-only') item.schema.parseSync(item.bytes, options);
      else runReaderDiagnostic(item.bytes, mode);
    });
    console.log(item.name.padEnd(24), `${elapsed.toFixed(3)} ms`.padStart(12));
  }
}

function runReaderDiagnostic(bytes, mode) {
  const reader = new StreamReaderSync(bytes, options);
  const stack = [];
  const scopes = mode === 'position-loop' ? [] : undefined;
  while (true) {
    const type = reader.next();
    if (type === null) return;
    if (type === XmlEventType.START_ELEMENT) {
      const name = reader.name() ?? '';
      const depth = stack.length;
      if (scopes) {
        const scope = scopes[depth] ??= new Map();
        scope.set(name, (scope.get(name) ?? 0) + 1);
        scopes.length = depth + 2;
      }
      stack.push(name);
      if (mode === 'attribute-loop' && reader.attributeCount() > 0) reader.attributeValue(0);
    } else if (type === XmlEventType.CHARACTERS || type === XmlEventType.CDATA) {
      if (mode === 'text-loop') reader.text();
    } else if (type === XmlEventType.END_ELEMENT) {
      stack.pop();
      if (scopes) scopes.length = stack.length + 1;
    }
  }
}

function runDiagnosticWaterfall() {
  console.log('diagnostic=waterfall');
  console.log('shape'.padEnd(24), 'manual'.padStart(12), 'converter'.padStart(12), 'reader'.padStart(12), 'event'.padStart(12), 'position'.padStart(12), 'state'.padStart(12));
  for (const item of cases) {
    const manual = measure(() => item.manual(item.bytes));
    const converter = measure(() => item.schema.parseSync(item.bytes, options));
    const reader = measure(() => {
      const event = new StreamReaderSync(item.bytes, options);
      while (event.next() !== null) {}
    });
    const eventLoop = measure(() => runReaderDiagnostic(item.bytes, 'event-loop'));
    const positionLoop = measure(() => runReaderDiagnostic(item.bytes, 'position-loop'));
    const state = measure(() => item.stateSchema.parseSync(item.bytes, options));
    console.log(
      item.name.padEnd(24),
      manual.toFixed(3).padStart(12),
      converter.toFixed(3).padStart(12),
      reader.toFixed(3).padStart(12),
      eventLoop.toFixed(3).padStart(12),
      positionLoop.toFixed(3).padStart(12),
      state.toFixed(3).padStart(12)
    );
  }
}

function fixture(open, close, row) {
  const rows = [];
  let length = open.length + close.length;
  for (let index = 0; length < target; index++) {
    const value = row(index);
    rows.push(value);
    length += value.length;
  }
  return encoder.encode(open + rows.join('') + close);
}

function flatRecords() {
  const schema = x.object({
    rows: x.array(x.object({
      id: x.string().xpath('./@id'),
      name: x.string().xpath('./name'),
      score: x.number().xpath('./score'),
      note: x.string().xpath('./note').optional()
    }), '/root/row'),
    firstName: x.string().xpath('/root/row/name').optional()
  });
  const bytes = fixture('<root>', '</root>', index =>
    `<row id="${index}"><name>N${index}</name><score>${index % 100}</score>${index % 3 ? '' : `<note>X${index}</note>`}</row>`
  );
  return {
    name: 'flat-records', schema, bytes,
    stateSchema: x.array(x.object({}), '/root/row'),
    manual: input => manualFlat(input),
    summary: value => [value.rows.length, value.firstName, value.rows.at(-1)?.id]
  };
}

function multipleArrays() {
  const schema = x.object({
    users: x.array(x.object({
      id: x.string().xpath('./@id'),
      name: x.string().xpath('./name'),
      score: x.number().xpath('./score').transform(value => value * 2)
    }), '/root/users/user'),
    codes: x.array(x.object({
      value: x.string().xpath('./@value'),
      label: x.string().xpath('./label')
    }), '/root/codes/code'),
    firstName: x.string().xpath('//user/name').optional()
  });
  const bytes = fixture('<root>', '</root>', index =>
    `<users><user id="${index}"><name>U${index}</name><score>${index % 100}</score></user></users>` +
    `<codes><code value="C${index}"><label>L${index}</label></code></codes>`
  );
  return {
    name: 'multiple-arrays', schema, bytes,
    stateSchema: x.object({
      users: x.array(x.object({}), '/root/users/user'),
      codes: x.array(x.object({}), '/root/codes/code')
    }),
    manual: input => manualMultiple(input),
    summary: value => [value.users.length, value.codes.length, value.firstName, value.users.at(-1)?.score]
  };
}

function nestedArray() {
  const schema = x.array(x.object({
    id: x.string().xpath('./@id'),
    title: x.string().xpath('./title'),
    chapters: x.array(x.object({
      number: x.string().xpath('./@number'),
      text: x.string().xpath('.')
    }), './chapters/chapter')
  }), '/root/book');
  const bytes = fixture('<root>', '</root>', index =>
    `<book id="${index}"><title>B${index}</title><chapters>` +
    `<chapter number="1">A${index}</chapter><chapter number="2">Z${index}</chapter>` +
    `</chapters></book>`
  );
  return {
    name: 'nested-child-array', schema, bytes,
    stateSchema: x.array(x.object({
      chapters: x.array(x.object({}), './chapters/chapter')
    }), '/root/book'),
    manual: input => manualNested(input),
    summary: value => [value.length, value[0]?.chapters.length, value.at(-1)?.chapters[1]?.text]
  };
}

function positionedFields() {
  const schema = x.array(x.object({
    id: x.string().xpath('./entry[2]/@id'),
    text: x.string().xpath('./entry[2]/text()')
  }), '/root/group');
  const bytes = fixture('<root>', '</root>', index =>
    `<group><entry id="a${index}">A${index}</entry><entry id="b${index}">B${index}</entry></group>`
  );
  return {
    name: 'position-selector', schema, bytes,
    stateSchema: x.array(x.object({}), '/root/group'),
    manual: input => manualPosition(input),
    summary: value => [value.length, value[0]?.id, value.at(-1)?.text]
  };
}

function descendantRecords() {
  const schema = x.array(x.object({
    key: x.string().xpath('./@key'),
    value: x.number().xpath('./value')
  }), '//item');
  const bytes = fixture('<root>', '</root>', index =>
    `<box><item key="${index}"><value>${index % 1000}</value></item></box>`
  );
  return {
    name: 'descendant-records', schema, bytes,
    stateSchema: x.array(x.object({}), '//item'),
    manual: input => manualDescendant(input),
    summary: value => [value.length, value[0]?.key, value.at(-1)?.value]
  };
}

function manualFlat(bytes) {
  const result = { rows: [], firstName: undefined };
  let row; let current = '';
  const event = new StreamReaderSync(bytes, { documentMode: 'fragment' });
  while (event.next()) {
    if (event.eventType() === XmlEventType.START_ELEMENT) {
      current = event.name() ?? '';
      if (current === 'row') row = { id: event.attributeValue('id') ?? '', name: '', score: NaN, note: undefined };
    } else if (event.eventType() === XmlEventType.CHARACTERS && row) {
      const text = event.text()?.trim(); if (!text) continue;
      if (current === 'name') { row.name += text; result.firstName ??= row.name; }
      else if (current === 'score') row.score = Number(text);
      else if (current === 'note') row.note = (row.note ?? '') + text;
    } else if (event.eventType() === XmlEventType.END_ELEMENT) {
      if (event.name() === 'row' && row) { result.rows.push(row); row = undefined; }
      current = '';
    }
  }
  return result;
}

function manualMultiple(bytes) {
  const result = { users: [], codes: [], firstName: undefined };
  let user; let code; let current = '';
  const event = new StreamReaderSync(bytes, { documentMode: 'fragment' });
  while (event.next()) {
    if (event.eventType() === XmlEventType.START_ELEMENT) {
      current = event.name() ?? '';
      if (current === 'user') user = { id: event.attributeValue('id') ?? '', name: '', score: NaN };
      else if (current === 'code') code = { value: event.attributeValue('value') ?? '', label: '' };
    } else if (event.eventType() === XmlEventType.CHARACTERS) {
      const text = event.text()?.trim(); if (!text) continue;
      if (user && current === 'name') { user.name += text; result.firstName ??= user.name; }
      else if (user && current === 'score') user.score = Number(text) * 2;
      else if (code && current === 'label') code.label += text;
    } else if (event.eventType() === XmlEventType.END_ELEMENT) {
      const name = event.name();
      if (name === 'user' && user) { result.users.push(user); user = undefined; }
      else if (name === 'code' && code) { result.codes.push(code); code = undefined; }
      current = '';
    }
  }
  return result;
}

function manualNested(bytes) {
  const result = []; let book; let chapter; let current = '';
  const event = new StreamReaderSync(bytes, { documentMode: 'fragment' });
  while (event.next()) {
    if (event.eventType() === XmlEventType.START_ELEMENT) {
      current = event.name() ?? '';
      if (current === 'book') book = { id: event.attributeValue('id') ?? '', title: '', chapters: [] };
      else if (current === 'chapter') chapter = { number: event.attributeValue('number') ?? '', text: '' };
    } else if (event.eventType() === XmlEventType.CHARACTERS) {
      const text = event.text()?.trim(); if (!text) continue;
      if (book && current === 'title') book.title += text;
      else if (chapter && current === 'chapter') chapter.text += text;
    } else if (event.eventType() === XmlEventType.END_ELEMENT) {
      const name = event.name();
      if (name === 'chapter' && chapter && book) { book.chapters.push(chapter); chapter = undefined; }
      else if (name === 'book' && book) { result.push(book); book = undefined; }
      current = '';
    }
  }
  return result;
}

function manualPosition(bytes) {
  const result = []; let group; let position = 0; let selected = false;
  const event = new StreamReaderSync(bytes, { documentMode: 'fragment' });
  while (event.next()) {
    if (event.eventType() === XmlEventType.START_ELEMENT) {
      const name = event.name();
      if (name === 'group') { group = { id: '', text: '' }; position = 0; }
      else if (name === 'entry' && group) { selected = ++position === 2; if (selected) group.id = event.attributeValue('id') ?? ''; }
    } else if (event.eventType() === XmlEventType.CHARACTERS && group && selected) {
      group.text += event.text()?.trim() ?? '';
    } else if (event.eventType() === XmlEventType.END_ELEMENT) {
      const name = event.name();
      if (name === 'entry') selected = false;
      else if (name === 'group' && group) { result.push(group); group = undefined; }
    }
  }
  return result;
}

function manualDescendant(bytes) {
  const result = []; let item; let current = '';
  const event = new StreamReaderSync(bytes, { documentMode: 'fragment' });
  while (event.next()) {
    if (event.eventType() === XmlEventType.START_ELEMENT) {
      current = event.name() ?? '';
      if (current === 'item') item = { key: event.attributeValue('key') ?? '', value: NaN };
    } else if (event.eventType() === XmlEventType.CHARACTERS && item && current === 'value') {
      const text = event.text()?.trim(); if (text) item.value = Number(text);
    } else if (event.eventType() === XmlEventType.END_ELEMENT) {
      if (event.name() === 'item' && item) { result.push(item); item = undefined; }
      current = '';
    }
  }
  return result;
}

function arg(name) {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length);
}
