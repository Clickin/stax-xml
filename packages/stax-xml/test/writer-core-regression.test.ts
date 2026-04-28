import { describe, expect, it } from 'vitest';
import WriterSync from '../src/WriterSync';
import { Writer } from '../src/Writer';

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
