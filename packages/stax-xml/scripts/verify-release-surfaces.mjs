#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as stax from 'stax-xml';
import { x } from 'stax-xml/converter';

const EXPECTED_ROOT_EXPORTS = [
  'EventReader',
  'EventReaderSync',
  'StreamReader',
  'StreamReaderSync',
  'Writer',
  'WriterSync',
  'WriterSyncSink',
  'XmlEventType',
  'isCdata',
  'isCharacters',
  'isEndDocument',
  'isEndElement',
  'isStartDocument',
  'isStartElement',
].sort();

assert.deepEqual(Object.keys(stax).sort(), EXPECTED_ROOT_EXPORTS);

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.deepEqual(Object.keys(packageJson.exports).sort(), ['.', './converter']);

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const xml = '<catalog><book id="b1"><title>StAX</title></book></catalog>';

function byteStream(value) {
  const bytes = encoder.encode(value);
  const split = Math.floor(bytes.byteLength / 2);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.subarray(0, split));
      controller.enqueue(bytes.subarray(split));
      controller.close();
    },
  });
}

function verifyStreamReaderSync() {
  const reader = new stax.StreamReaderSync(xml);
  const starts = [];
  while (reader.next() !== null) {
    if (reader.eventType() === stax.XmlEventType.START_ELEMENT) starts.push(reader.name());
  }
  assert.deepEqual(starts, ['catalog', 'book', 'title']);
}

function verifyEventReaderSync() {
  const starts = Array.from(new stax.EventReaderSync(xml))
    .filter(stax.isStartElement)
    .map((event) => event.name);
  assert.deepEqual(starts, ['catalog', 'book', 'title']);
}

async function verifyStreamReader() {
  const reader = new stax.StreamReader(byteStream(xml));
  const starts = [];
  while (await reader.next() !== null) {
    if (reader.eventType() === stax.XmlEventType.START_ELEMENT) starts.push(reader.name());
  }
  assert.deepEqual(starts, ['catalog', 'book', 'title']);
}

async function verifyEventReader() {
  const starts = [];
  for await (const event of new stax.EventReader(byteStream(xml))) {
    if (stax.isStartElement(event)) starts.push(event.name);
  }
  assert.deepEqual(starts, ['catalog', 'book', 'title']);
}

async function verifyWriters() {
  const chunks = [];
  const writer = new stax.Writer(new WritableStream({ write(chunk) { chunks.push(chunk); } }));
  await writer.writeStartElement('root');
  await writer.writeCharacters('StAX & XML');
  await writer.close();
  assert.equal(decoder.decode(concatBytes(chunks)), '<root>StAX &amp; XML</root>');

  const textChunks = [];
  const textWriter = new stax.Writer({
    encoding: 'Shift_JIS',
    write(chunk) { textChunks.push(chunk); },
  });
  await textWriter.writeStartDocument();
  await textWriter.writeStartElement('root');
  await textWriter.close();
  assert.equal(textChunks.join(''), '<?xml version="1.0" encoding="Shift_JIS"?><root></root>');

  const syncWriter = new stax.WriterSync();
  syncWriter.writeStartElement('root').writeCharacters('ok').writeEndElement();
  assert.equal(syncWriter.getXmlString(), '<root>ok</root>');

  const sinkChunks = [];
  const sinkWriter = new stax.WriterSyncSink({ write(chunk) { sinkChunks.push(chunk); } });
  sinkWriter.writeStartElement('root').writeCharacters('ok').writeEndElement();
  sinkWriter.close();
  assert.equal(sinkChunks.join(''), '<root>ok</root>');

  const encodedSinkChunks = [];
  const encodedSinkWriter = new stax.WriterSyncSink({
    encoding: 'EUC-KR',
    write(chunk) { encodedSinkChunks.push(chunk); },
  });
  encodedSinkWriter.writeStartDocument();
  encodedSinkWriter.close();
  assert.equal(encodedSinkChunks.join(''), '<?xml version="1.0" encoding="EUC-KR"?>');
}

async function verifyConverter() {
  const schema = x.object({ title: x.string('/catalog/book/title') });
  assert.deepEqual(schema.parseSync(xml), { title: 'StAX' });
  assert.deepEqual(await schema.parse(xml), { title: 'StAX' });
}

function concatBytes(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

verifyStreamReaderSync();
verifyEventReaderSync();
await verifyStreamReader();
await verifyEventReader();
await verifyWriters();
await verifyConverter();

console.log(JSON.stringify({
  status: 'ok',
  packageSubpaths: ['stax-xml', 'stax-xml/converter'],
  runtimeSurfaces: [
    'StreamReaderSync',
    'EventReaderSync',
    'StreamReader',
    'EventReader',
    'WriterSync',
    'WriterSyncSink',
    'Writer',
    'converter',
  ],
}, null, 2));
