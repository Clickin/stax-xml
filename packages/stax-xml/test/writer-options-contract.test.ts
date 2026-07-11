import { describe, expect, it } from 'vitest';
import { Writer } from 'stax-xml-async';
import { WriterSync, WriterSyncSink } from 'stax-xml-sync';

describe('writer encoding contract', () => {
  it('rejects a non-UTF-8 async writer option before locking the stream', () => {
    const stream = new WritableStream<Uint8Array>();
    expect(() => new Writer(stream, { encoding: 'utf-16' })).toThrow(/only supports UTF-8/i);
    expect(stream.locked).toBe(false);
  });

  it('rejects a non-UTF-8 declaration without changing async writer state', async () => {
    const chunks: Uint8Array[] = [];
    const writer = new Writer(new WritableStream({ write(chunk) { chunks.push(chunk); } }));

    await expect(writer.writeStartDocument('1.0', 'iso-8859-1')).rejects.toThrow(/only supports UTF-8/i);
    await writer.writeStartDocument('1.0', 'Utf-8');
    await writer.writeStartElement('root');
    await writer.writeCharacters('é');
    await writer.close();

    expect(decode(chunks)).toBe('<?xml version="1.0" encoding="UTF-8"?><root>é</root>');
  });

  it('rejects non-UTF-8 sync writer options', () => {
    expect(() => new WriterSync({ encoding: 'utf-16' })).toThrow(/only supports UTF-8/i);
    expect(() => new WriterSyncSink({ write() {} }, { encoding: 'utf-16' })).toThrow(/only supports UTF-8/i);
  });

  it('treats sync encoding as UTF-8 declaration metadata only', () => {
    const writer = new WriterSync();

    expect(() => writer.writeStartDocument('1.0', 'iso-8859-1')).toThrow(/only supports UTF-8/i);
    writer.writeStartDocument('1.0', 'UTF-8');
    writer.writeStartElement('root').writeCharacters('é').writeEndElement();

    expect(writer.getXmlString()).toBe('<?xml version="1.0" encoding="UTF-8"?><root>é</root>');
  });
});

function decode(chunks: Uint8Array[]): string {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
