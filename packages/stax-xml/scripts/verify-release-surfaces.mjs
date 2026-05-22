#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  EventReader,
  EventReaderSync,
  StreamEventType,
  StreamReaderSync,
  Writer,
  WriterSync,
  WriterSyncSink,
  XmlEventType,
  parseXmlObjectSync,
  parseXmlTree,
} from 'stax-xml';
import { x } from 'stax-xml/converter';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const xml = [
  '<catalog>',
  '<book id="b1"><title>StAX</title><price>12.5</price></book>',
  '<book id="b2"><title>XML</title><price>8.25</price></book>',
  '</catalog>',
].join('');
const xmlBytes = encoder.encode(xml);

function assertIncludes(value, expected, label) {
  assert.ok(value.includes(expected), `${label} should include ${expected}`);
}

function streamFromChunks(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
      }
      controller.close();
    },
  });
}

function eventReaderSyncSmoke() {
  let startElements = 0;
  const titles = [];

  for (const event of new EventReaderSync(xml)) {
    if (event.type === XmlEventType.START_ELEMENT) {
      startElements++;
    }
    if (event.type === XmlEventType.CHARACTERS && event.value === 'StAX') {
      titles.push(event.value);
    }
  }

  assert.equal(startElements, 7);
  assert.deepEqual(titles, ['StAX']);
}

async function eventReaderSmoke() {
  const midpoint = Math.floor(xmlBytes.length / 2);
  const reader = new EventReader(streamFromChunks([
    xmlBytes.subarray(0, midpoint),
    xmlBytes.subarray(midpoint),
  ]));

  let startElements = 0;
  let textChecksum = '';
  for await (const event of reader) {
    if (event.type === XmlEventType.START_ELEMENT) {
      startElements++;
    }
    if (event.type === XmlEventType.CHARACTERS) {
      textChecksum += event.value;
    }
  }

  assert.equal(startElements, 7);
  assert.equal(textChecksum, 'StAX12.5XML8.25');
}

function streamReaderSyncSmoke() {
  function* byteBatches() {
    yield [xmlBytes.subarray(0, 19)];
    yield [xmlBytes.subarray(19, 48), xmlBytes.subarray(48)];
  }

  let startElements = 0;
  const titles = [];

  for (const batch of new StreamReaderSync(byteBatches())) {
    for (let index = 0; index < batch.eventCount; index++) {
      const type = batch.typeAt(index);
      if (type === StreamEventType.START_ELEMENT) {
        startElements++;
      }
      if (type === StreamEventType.CHARACTERS) {
        const text = batch.textAt(index);
        if (text === 'StAX' || text === 'XML') {
          titles.push(text);
        }
      }
    }
  }

  assert.equal(startElements, 7);
  assert.deepEqual(titles, ['StAX', 'XML']);
}

async function objectHelpersSmoke() {
  const tree = await parseXmlTree(streamFromChunks([
    '<catalog><book id="b1">',
    '<title>StAX</title></book></catalog>',
  ]));
  assert.equal(tree.children[0]?.type, 'element');
  assert.equal(tree.children[0]?.name, 'catalog');

  const object = parseXmlObjectSync(xml, { alwaysArray: true });
  assert.equal(object.catalog[0].book[0]['@id'], 'b1');
  assert.equal(object.catalog[0].book[1].title[0], 'XML');
}

function converterSmoke() {
  const catalogSchema = x.object({
    books: x.array(
      x.object({
        id: x.string().xpath('./@id'),
        title: x.string().xpath('./title'),
        price: x.number().xpath('./price'),
      }),
      '/catalog/book',
    ),
  });
  const compiledCatalogSchema = catalogSchema.compile();

  const direct = catalogSchema.parseSync(xmlBytes);
  const compiled = compiledCatalogSchema.parseSync(xmlBytes);

  assert.equal(direct.books.length, 2);
  assert.equal(direct.books[0].title, 'StAX');
  assert.deepEqual(compiled, direct);
}

async function writerSmoke() {
  const chunks = [];
  const stream = new WritableStream({
    write(chunk) {
      chunks.push(chunk);
    },
  });
  const writer = new Writer(stream);

  await writer.writeStartDocument('1.0', 'utf-8');
  await writer.writeStartElement('catalog');
  await writer.writeStartElement('book', { attributes: { id: 'b1' } });
  await writer.writeCharacters('StAX & XML');
  await writer.writeEndElement();
  await writer.writeEndElement();
  await writer.writeEndDocument();
  await writer.close();

  const output = decoder.decode(Buffer.concat(chunks));
  assertIncludes(output, '<book id="b1">StAX &amp; XML</book>', 'async writer output');
}

function writerSyncSmoke() {
  const writer = new WriterSync();
  writer.writeStartDocument('1.0', 'utf-8');
  writer.writeStartElement('catalog');
  writer.writeStartElement('book', { attributes: { id: 'b1' } });
  writer.writeCharacters('StAX & XML');
  writer.writeEndElement();
  writer.writeEndElement();
  writer.writeEndDocument();

  assertIncludes(writer.getXmlString(), '<book id="b1">StAX &amp; XML</book>', 'sync writer output');
}

function writerSyncSinkSmoke() {
  const chunks = [];
  let closed = false;
  const writer = new WriterSyncSink(
    {
      write(chunk) {
        chunks.push(chunk);
      },
      close() {
        closed = true;
      },
    },
    { bufferSize: 8 },
  );

  writer.writeStartDocument('1.0', 'utf-8');
  writer.writeStartElement('catalog');
  writer.writeStartElement('book', { attributes: { id: 'b1' } });
  writer.writeCharacters('StAX & XML');
  writer.writeEndElement();
  writer.writeEndElement();
  writer.close();

  const output = chunks.join('');
  assert.equal(closed, true);
  assertIncludes(output, '<book id="b1">StAX &amp; XML</book>', 'sync sink writer output');
}

await eventReaderSmoke();
eventReaderSyncSmoke();
streamReaderSyncSmoke();
await objectHelpersSmoke();
converterSmoke();
await writerSmoke();
writerSyncSmoke();
writerSyncSinkSmoke();

console.log(JSON.stringify({
  status: 'ok',
  surfaces: [
    'EventReader',
    'EventReaderSync',
    'StreamReaderSync',
    'parseXmlTree/parseXmlObject',
    'stax-xml/converter',
    'Writer',
    'WriterSync',
    'WriterSyncSink',
  ],
}, null, 2));
