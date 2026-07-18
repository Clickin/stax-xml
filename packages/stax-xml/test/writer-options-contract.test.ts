import { describe, expect, it } from 'vitest';
import { Writer, type AsyncTextSink } from 'stax-xml-async';
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

    await expect(writer.writeStartDocument('1.0', 'iso-8859-1')).rejects.toThrow(/does not match output encoding/i);
    await writer.writeStartDocument('1.0', 'Utf-8');
    await writer.writeStartElement('root');
    await writer.writeCharacters('é');
    await writer.close();

    expect(decode(chunks)).toBe('<?xml version="1.0" encoding="UTF-8"?><root>é</root>');
  });

  it('streams async text to an external encoder sink with backpressure', async () => {
    const chunks: string[] = [];
    const lifecycle: string[] = [];
    const sink: AsyncTextSink = {
      encoding: 'Shift_JIS',
      async write(chunk) {
        await Promise.resolve();
        chunks.push(chunk);
      },
      flush() { lifecycle.push('flush'); },
      close() { lifecycle.push('close'); },
    };
    const writer = new Writer(sink, { bufferSize: 8 });

    await writer.writeStartDocument();
    await writer.writeStartElement('root');
    await writer.writeCharacters('日本語');
    await writer.close();

    expect(chunks.join('')).toBe('<?xml version="1.0" encoding="Shift_JIS"?><root>日本語</root>');
    expect(lifecycle).toEqual(['flush', 'close']);
    expect(writer.getMetrics().totalBytesWritten).toBe(0);
    expect(writer.getMetrics().totalCharactersWritten).toBe(chunks.join('').length);
  });

  it('rejects invalid or mismatched async text-sink encoding metadata', async () => {
    expect(() => new Writer({ encoding: 'bad name', write() {} })).toThrow(/invalid XML encoding name/i);
    expect(() => new Writer(
      { encoding: 'Shift_JIS', write() {} },
      { encoding: 'EUC-JP' }
    )).toThrow(/does not match output encoding/i);

    const writer = new Writer({ encoding: 'Shift_JIS', write() {} });
    await expect(writer.writeStartDocument('1.0', 'EUC-JP')).rejects.toThrow(/does not match output encoding/i);
    await writer.writeStartDocument();
    await writer.close();
  });

  it('keeps async text-sink buffering bounded when automatic flushing is disabled', async () => {
    const chunks: string[] = [];
    const writer = new Writer(
      { encoding: 'UTF-8', write(chunk) { chunks.push(chunk); } },
      { bufferSize: 4, enableAutoFlush: false }
    );

    await writer.writeRaw('abcdef');
    expect(chunks).toEqual(['abcdef']);
    await writer.close();
  });

  it('rejects non-UTF-8 sync writer options', () => {
    expect(() => new WriterSync({ encoding: 'utf-16' })).toThrow(/only supports UTF-8/i);
    expect(() => new WriterSyncSink({ write() {} }, { encoding: 'utf-16' })).toThrow(/only supports UTF-8/i);
  });

  it('treats sync encoding as UTF-8 declaration metadata only', () => {
    const writer = new WriterSync();

    expect(() => writer.writeStartDocument('1.0', 'iso-8859-1')).toThrow(/does not match output encoding/i);
    writer.writeStartDocument('1.0', 'UTF-8');
    writer.writeStartElement('root').writeCharacters('é').writeEndElement();

    expect(writer.getXmlString()).toBe('<?xml version="1.0" encoding="UTF-8"?><root>é</root>');
  });

  it('streams sync text to an external encoder sink and declares its encoding', () => {
    const chunks: string[] = [];
    const lifecycle: string[] = [];
    const writer = new WriterSyncSink({
      encoding: 'EUC-KR',
      write(chunk) { chunks.push(chunk); },
      flush() { lifecycle.push('flush'); },
      close() { lifecycle.push('close'); },
    }, { flushOnClose: true, bufferSize: 8 });

    writer.writeStartDocument();
    writer.writeStartElement('root').writeCharacters('한국어').writeEndElement();
    writer.close();

    expect(chunks.join('')).toBe('<?xml version="1.0" encoding="EUC-KR"?><root>한국어</root>');
    expect(lifecycle).toEqual(['flush', 'close']);
  });

  it('rejects invalid or mismatched sync text-sink encoding metadata', () => {
    expect(() => new WriterSyncSink({ encoding: 'bad name', write() {} }))
      .toThrow(/invalid XML encoding name/i);
    expect(() => new WriterSyncSink(
      { encoding: 'EUC-KR', write() {} },
      { encoding: 'Shift_JIS' }
    )).toThrow(/does not match output encoding/i);

    const writer = new WriterSyncSink({ encoding: 'EUC-KR', write() {} });
    expect(() => writer.writeStartDocument('1.0', 'Shift_JIS')).toThrow(/does not match output encoding/i);
    writer.writeStartDocument();
    writer.close();
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
