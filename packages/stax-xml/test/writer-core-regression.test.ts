import { describe, expect, it } from 'vitest';
import { WriterSync } from 'stax-xml-sync';
import { Writer } from 'stax-xml-async';

function createCountingWritableStream(): { stream: WritableStream<Uint8Array>; getBytesWritten: () => number } {
  let bytesWritten = 0;

  return {
    stream: new WritableStream<Uint8Array>({
      write(chunk) {
        bytesWritten += chunk.length;
      }
    }),
    getBytesWritten: () => bytesWritten
  };
}

describe('Writer hot-path regression coverage', () => {
  it('should preserve deep pretty-print indentation with repeated levels', () => {
    const writer = new WriterSync({
      prettyPrint: true,
      indentString: '    '
    });

    writer.writeStartDocument();
    writer.writeStartElement('root');
    writer.writeStartElement('level1');
    writer.writeStartElement('level2');
    writer.writeStartElement('level3');
    writer.writeCharacters('value');
    writer.writeEndElement();
    writer.writeEndElement();
    writer.writeEndElement();
    writer.writeEndElement();
    writer.writeEndDocument();

    expect(writer.getXmlString()).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<root>\n' +
      '    <level1>\n' +
      '        <level2>\n' +
      '            <level3>value</level3>\n' +
      '        </level2>\n' +
      '    </level1>\n' +
      '</root>'
    );
  });

  it('should not leak namespace declarations across sibling elements in async writer', async () => {
    const { stream } = createCountingWritableStream();
    const writer = new Writer(stream, {
      prettyPrint: false
    });

    await writer.writeStartDocument();
    await writer.writeStartElement('root');

    await writer.writeStartElement('first');
    await writer.writeStartElement('localNode', {
      prefix: 'local',
      uri: 'http://example.com/local',
      attributes: {
        value: { value: 'ok', prefix: 'local' }
      }
    });
    await writer.writeEndElement();
    await writer.writeEndElement();

    await expect(writer.writeStartElement('second', {
      attributes: {
        value: { value: 'should-fail', prefix: 'local' }
      }
    })).rejects.toThrow("Namespace prefix 'local' is not defined");
  });

  it('restores a shadowed namespace binding for sync and async siblings', async () => {
    const sync = new WriterSync();
    sync.writeStartElement('root', { prefix: 'p', uri: 'urn:root' });
    sync.writeStartElement('inner', { prefix: 'p', uri: 'urn:inner' });
    sync.writeEndElement();
    sync.writeStartElement('sibling', { attributes: { id: { value: '1', prefix: 'p' } } });
    sync.writeEndElement();
    sync.writeEndElement();
    expect(sync.getXmlString()).toContain('<sibling p:id="1"></sibling>');

    const chunks: Uint8Array[] = [];
    const async = new Writer(new WritableStream<Uint8Array>({ write: chunk => chunks.push(chunk) }));
    await async.writeStartElement('root', { prefix: 'p', uri: 'urn:root' });
    await async.writeStartElement('inner', { prefix: 'p', uri: 'urn:inner' });
    await async.writeEndElement();
    await async.writeStartElement('sibling', { attributes: { id: { value: '1', prefix: 'p' } } });
    await async.writeEndElement();
    await async.writeEndElement();
    await async.writeEndDocument();
    expect(new TextDecoder().decode(concat(chunks))).toContain('<sibling p:id="1"></sibling>');
  });

  it('rejects malformed structured names, characters, duplicate attributes, and undeclared prefixes', async () => {
    const sync = new WriterSync();
    expect(() => sync.writeStartElement('bad name')).toThrow(/invalid XML element name/i);
    sync.writeStartElement('root');
    expect(() => sync.writeAttribute('id', '1').writeAttribute('id', '2')).toThrow(/duplicate attribute/i);
    expect(() => sync.writeAttribute('id', '1', 'missing')).toThrow(/not defined/i);
    expect(() => sync.writeCharacters('\u0000')).toThrow(/invalid XML character/i);

    const async = new Writer(new WritableStream<Uint8Array>({ write() {} }));
    await expect(async.writeStartElement('bad name')).rejects.toThrow(/invalid XML element name/i);
    await expect(async.writeStartElement('root', { attributes: { ['bad name']: '1' } }))
      .rejects.toThrow(/invalid XML attribute name/i);
    await expect(async.writeCharacters('\u0000')).rejects.toThrow(/invalid XML character/i);
  });

  it('preserves sink failures and rejects subsequent writes', async () => {
    const sync = new (class extends WriterSync { protected _emit(): void { throw new Error('sync sink failed'); } })();
    expect(() => sync.writeCharacters('x')).toThrow('sync sink failed');
    expect(() => sync.writeStartElement('root')).toThrow(/closed or in error/i);

    const async = new Writer(new WritableStream<Uint8Array>({ write() { throw new Error('async sink failed'); } }), { bufferSize: 1 });
    await expect(async.writeCharacters('x')).rejects.toThrow('async sink failed');
    await expect(async.writeStartElement('root')).rejects.toThrow(/closed or in error/i);
  });

  it('should flush async output without dropping bytes on a tiny buffer boundary', async () => {
    const { stream, getBytesWritten } = createCountingWritableStream();
    const writer = new Writer(stream, {
      prettyPrint: false,
      bufferSize: 32,
      flushThreshold: 16
    });

    await writer.writeStartDocument();
    await writer.writeStartElement('root');
    await writer.writeCharacters('A'.repeat(128));
    await writer.writeEndElement();
    await writer.writeEndDocument();

    expect(getBytesWritten()).toBeGreaterThan(140);
    expect(writer.getMetrics().flushCount).toBeGreaterThan(1);
  });
});

function concat(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
